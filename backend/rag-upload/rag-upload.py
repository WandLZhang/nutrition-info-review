import os
import xml.etree.ElementTree as ET
import json
import hashlib
from google.cloud import discoveryengine
from google.api_core import retry
from google.api_core.exceptions import NotFound, PermissionDenied, ResourceExhausted, AlreadyExists
from google.protobuf import field_mask_pb2

class XMLProcessor:
    def __init__(self, project_id, location):
        self.project_id = project_id
        self.location = location
        self.client = discoveryengine.DataStoreServiceClient()
        self.doc_client = discoveryengine.DocumentServiceClient()

    def explore(self, root: ET.Element, text: list[str], metadata: dict[str, dict[str, str]]):
        if root.attrib:
            for key, value in root.attrib.items():
                if key == "id":
                    text.append("")
                    person = metadata.get("participants", {}).get(value, "Unknown")
                    line = f"{person}:"
                elif key == "type" and value.lower() == "q":
                    line = "Question:"
                elif key == "type" and value.lower() == "a":
                    line = "Answer:"
                else:
                    line = f"{key}: {value}"
                if line:
                    text.append(line.strip())
        if root.tag == "HEAD" and root.text:
            text.append(root.text.strip())    
        if root.tag == "P" and root.text and root.text.strip() != "":
            text.append(root.text.strip())
        if root.tag == "CITA":
            text.append(ET.tostring(root, encoding='unicode').strip())
        if root.tag == "TABLE":
            text.append(ET.tostring(root, encoding='unicode').strip())
        for element in root:
            self.explore(element, text, metadata)

    def process_xml(self, xml_file_path):
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
        
        document_chunks = {}
        visited = set()

        def process_div(div, parent_names=None):
            if parent_names is None:
                parent_names = []

            head = div.find("HEAD")
            if head is not None and head.text:
                current_name = head.text.strip()
                names = parent_names + [current_name]
            else:
                names = parent_names

            if div.attrib.get("TYPE") == "SECTION":
                section_id = div.attrib.get("N", "")
                if section_id and section_id not in visited:
                    visited.add(section_id)
                    text_content = []
                    self.explore(div, text_content, {})
                    section_name = " - ".join(names)
                    document_chunks[(section_id, section_name)] = "\n".join(text_content)
            else:
                for child_div in div:
                    if child_div.tag.startswith("DIV"):
                        process_div(child_div, names)

        for div1 in root.findall("DIV1"):
            process_div(div1)

        return document_chunks

    @retry.Retry()
    def get_or_create_datastore(self, collection, data_store_id):
        parent = f"projects/{self.project_id}/locations/global/collections/{collection}"
        data_store_name = f"{parent}/dataStores/{data_store_id}"
        
        try:
            existing_datastore = self.client.get_data_store(name=data_store_name)
            print(f"Data Store {data_store_id} already exists.")
            if existing_datastore.content_config == discoveryengine.DataStore.ContentConfig.CONTENT_REQUIRED:
                print("Existing Data Store has the correct content configuration.")
                return existing_datastore
            else:
                print("Existing Data Store has incorrect content configuration. Creating a new one.")
                new_data_store_id = f"{data_store_id}_content_required"
                return self.create_datastore(collection, new_data_store_id)
        except NotFound:
            print(f"Data Store {data_store_id} not found. Creating a new one.")
            return self.create_datastore(collection, data_store_id)

    @retry.Retry()
    def create_datastore(self, collection, data_store_id):
        parent = f"projects/{self.project_id}/locations/global/collections/{collection}"
        
        print(f"Creating Data Store {data_store_id} in parent {parent}...")

        data_store = discoveryengine.DataStore()
        data_store.display_name = data_store_id
        data_store.industry_vertical = "GENERIC"
        data_store.solution_types = ["SOLUTION_TYPE_SEARCH"]
        data_store.content_config = discoveryengine.DataStore.ContentConfig.CONTENT_REQUIRED

        data_store.document_processing_config = discoveryengine.DocumentProcessingConfig()
        data_store.document_processing_config.default_parsing_config = discoveryengine.DocumentProcessingConfig.ParsingConfig()
        data_store.document_processing_config.default_parsing_config.digital_parsing_config = discoveryengine.DocumentProcessingConfig.ParsingConfig.DigitalParsingConfig()

        try:
            operation = self.client.create_data_store(
                parent=parent,
                data_store_id=data_store_id,
                data_store=data_store
            )
            response = operation.result()
            print(f"Data Store created: {response.name}")
            return response
        except AlreadyExists:
            print(f"Data Store {data_store_id} already exists. Retrieving existing Data Store.")
            return self.client.get_data_store(name=f"{parent}/dataStores/{data_store_id}")
        except PermissionDenied:
            print("Permission denied. Please check your credentials and project permissions.")
            raise
        except ResourceExhausted:
            print("Resource quota exceeded. Please check your project quotas.")
            raise

    def generate_document_id(self, section_id: str, section_name: str) -> str:
        clean_section_id = ''.join(c for c in section_id if c.isalnum())
        
        if not clean_section_id or not clean_section_id[0].isalpha():
            clean_section_id = 'S' + clean_section_id
        
        combined = f"{clean_section_id}_{section_name}"
        
        if len(combined) <= 63:
            return combined
        
        hash_object = hashlib.md5(combined.encode())
        hash_str = hash_object.hexdigest()
        
        return f"{clean_section_id[:7]}_{hash_str}"[:63]

    @retry.Retry()
    def upload_to_datastore(self, document_chunks, collection, data_store_id, branch="default_branch"):
        parent = f"projects/{self.project_id}/locations/global/collections/{collection}/dataStores/{data_store_id}/branches/{branch}"

        print(f"Uploading documents to parent {parent}...")

        for (section_id, section_name), content in document_chunks.items():
            document = discoveryengine.Document()
            document.id = self.generate_document_id(section_id, section_name)
            document.content = discoveryengine.Document.Content()
            document.content.raw_bytes = content.encode('utf-8')
            document.content.mime_type = "text/plain"
            document.struct_data = {
                "section_id": section_id,
                "section_name": section_name,
            }

            try:
                response = self.doc_client.create_document(
                    parent=parent,
                    document=document,
                    document_id=document.id
                )
                print(f"Document created: {response.name}")
            except discoveryengine.exceptions.BadRequest as e:
                print(f"Bad Request Error creating document: {e}")
            except discoveryengine.exceptions.AlreadyExists as e:
                print(f"Document already exists: {e}")
            except Exception as e:
                print(f"Unexpected error creating document: {e}")

    def process_and_upload(self, xml_file_path, collection, data_store_id):
        chunks = self.process_xml(xml_file_path)
        datastore = self.get_or_create_datastore(collection, data_store_id)
        self.upload_to_datastore(chunks, collection, datastore.name.split('/')[-1])

if __name__ == "__main__":
    project_id = "gemini-med-lit-review"
    location = "us-central1"
    xml_file_path = "title21.xml"
    collection = "default_collection"
    data_store_id = "fda-title21"

    processor = XMLProcessor(project_id, location)
    processor.process_and_upload(xml_file_path, collection, data_store_id)

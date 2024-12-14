import os
from google.cloud import discoveryengine
from google.cloud import aiplatform
from vertexai.preview.generative_models import GenerativeModel, ChatSession

# Set up the clients
project_id = "gemini-med-lit-review"
location = "global"
data_store_id = "fda-title21_content_required"
search_client = discoveryengine.SearchServiceClient()

# Initialize Vertex AI
aiplatform.init(project=project_id, location=location)

def search_datastore(query):
    serving_config = search_client.serving_config_path(
        project=project_id,
        location=location,
        data_store=data_store_id,
        serving_config="default_config",
    )
    
    request = discoveryengine.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=5,
    )
    
    response = search_client.search(request)
    return response.results

def generate_response(query, search_results):
    model = GenerativeModel("gemini-pro")
    chat = model.start_chat()
    
    context = "Based on the following FDA regulations:\n\n"
    for result in search_results:
        context += f"Section: {result.document.struct_data['section_name']}\n"
        context += f"Content: {result.document.derived_struct_data['snippets'][0]}\n\n"
    
    prompt = f"{context}\nQuestion: {query}\nPlease provide a detailed answer citing the relevant FDA regulations."
    
    response = chat.send_message(prompt)
    return response.text

def main():
    query = "The temperature in this fridge is too warm, which code section does this violate?"
    
    print(f"Searching for: {query}")
    search_results = search_datastore(query)
    
    if search_results:
        print("Generating response based on search results...")
        response = generate_response(query, search_results)
        print("\nGenerated Response:")
        print(response)
    else:
        print("No relevant results found in the datastore.")

if __name__ == "__main__":
    main()

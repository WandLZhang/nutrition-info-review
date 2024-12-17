import base64
import io
import os
import cv2
import PIL.Image
from google import genai
from google.genai import types
from dotenv import load_dotenv
import json
import logging
from rag_utils import get_relevant_codes, DATA_STORE_ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

MODEL = "gemini-2.0-flash-exp"

class InspectionApp:
    def __init__(self):
        self.client = genai.Client(
            vertexai=True,
            project="gemini-med-lit-review",
            location="us-central1"
        )
        self.cap = cv2.VideoCapture(0)

    def _get_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return None
        img = PIL.Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        img.thumbnail([1024, 1024])
        image_io = io.BytesIO()
        img.save(image_io, format="jpeg")
        image_io.seek(0)
        return types.Part.from_bytes(data=image_io.getvalue(), mime_type="image/jpeg")

    def generate_initial_response(self, inspection_type, image):
        text_prompt = types.Part.from_text(f"""As an FDA inspector performing a {inspection_type} inspection, analyze the given image.
        Based on Title 21 regulations, identify potential citation opportunities and reference 
        the specific sections of Title 21 that apply. Provide a detailed explanation for each 
        potential citation, including what is observed in the image and how it relates to the 
        regulation. Format your response as a JSON object with the following structure:
        {{
            "citations": [
                {{
                    "section": "Cited Title 21 section number",
                    "text": "Relevant text from the cited section",
                    "reason": "Detailed explanation of why this citation applies based on the image"
                }},
                // Additional citations...
            ]
        }}
        Ensure that the JSON is valid and properly formatted. Also, more likely the image will show a picture presented on a phone or screen. Do not remark about the act of showing the screen, it's the content's of the image being shown that matters, because this is for demonstration purposes and we won't be able to go to an inspection site often.""")

        contents = [
            types.Content(
                role="user",
                parts=[text_prompt, image]
            )
        ]

        generate_content_config = types.GenerateContentConfig(
            temperature=0.2,
            top_p=0.95,
            max_output_tokens=8192,
            response_modalities=["TEXT"],
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
            ],
        )

        response = self.client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=generate_content_config,
        )

        return self.format_response(response)

    def verify_and_complete_response(self, initial_response):
        verified_citations = []
        for citation in initial_response.get('citations', []):
            relevant_codes = get_relevant_codes(citation['text'], DATA_STORE_ID)
            
            verification_prompt = f"""Given the following citation and relevant codes from the FDA Title 21 regulations, 
            verify if the cited section is correct. If not, suggest the correct section based on the relevant codes. 
            Then, generate a valid URL for the (corrected) section.

            Original Citation:
            {json.dumps(citation, indent=2)}

            Relevant Codes:
            {relevant_codes}

            Provide your response as a JSON object with the following structure:
            {{
                "section": "Verified or corrected Title 21 section number",
                "text": "Verified or corrected text from the cited section",
                "reason": "Original reason for the citation",
                "url": "Generated URL of the Title 21 eCFR regulation"
            }}

            For the 'url' field, generate a valid URL to the specific section of the Title 21 eCFR regulation. 
            The URL should follow this format: 
            https://www.ecfr.gov/current/title-21/chapter-[CHAPTER]/subchapter-[SUB CHAPTER]/part-[PART]#[SECTION]

            Ensure that the generated URL is correct and points to the specific section cited."""

            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(verification_prompt)]
                )
            ]

            generate_content_config = types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.95,
                max_output_tokens=8192,
                response_modalities=["TEXT"],
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
                ],
            )

            response = self.client.models.generate_content(
                model=MODEL,
                contents=contents,
                config=generate_content_config,
            )

            verified_citation = self.format_response(response)
            if verified_citation:
                verified_citations.append(verified_citation)

        return {"citations": verified_citations}

    def format_response(self, response):
        try:
            response_text = response.text.strip()
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != -1:
                json_str = response_text[start:end]
                return json.loads(json_str)
            else:
                raise ValueError("No valid JSON object found in the response")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse response as JSON: {str(e)}")
            return {"error": "Failed to parse response as JSON"}
        except Exception as e:
            logger.error(f"Error formatting response: {str(e)}")
            return {"error": "An unexpected error occurred while formatting the response"}

    def run(self):
        print("Hello FDA inspector! What type of inspection are you performing today?")
        
        try:
            while True:
                inspection_type = input("message > ")
                if inspection_type.lower() == 'q':
                    break

                frame = self._get_frame()
                if frame is None:
                    print("Failed to capture video frame.")
                    continue

                initial_response = self.generate_initial_response(inspection_type, frame)
                verified_response = self.verify_and_complete_response(initial_response)
                
                print("\nGemini Analysis:")
                print(json.dumps(verified_response, indent=2))
                print("\n")
        finally:
            self.cap.release()

if __name__ == "__main__":
    app = InspectionApp()
    app.run()

import base64
import io
import os
import json
import logging
import uuid

import functions_framework
from flask import jsonify, request
from PIL import Image

from google import genai
from google.cloud import storage
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Project configuration
PROJECT_ID = "gemini-med-lit-review"
LOCATION = "us-central1"

# Initialize Vertex AI client and GCS client
genai_client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

# Initialize GCS client
storage_client = storage.Client()
BUCKET_NAME = "gps-rit-patient-referral-match"

def extract_patient_attributes(image_data):
    """
    Extract patient attributes (name, date of birth, date of first procedure) from an image
    using Gemini model.
    
    Args:
        image_data: Base64 encoded image data
        
    Returns:
        dict: Dictionary containing extracted attributes
    """
    print("Starting patient attribute extraction")
    
    # Prepare the prompt for Gemini
    text_prompt = """Examine the picture and extract these attributes:
name, date of birth, date of first procedure

Return the results in a JSON format with these exact keys:
{
  "name": "extracted name",
  "date_of_birth": "extracted date of birth",
  "date_of_first_procedure": "extracted date of first procedure"
}

If you cannot find a specific attribute, use an empty string for its value.
"""

    # Prepare the content for Gemini
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=text_prompt),
                types.Part.from_bytes(data=base64.b64decode(image_data), mime_type="image/jpeg")
            ]
        )
    ]

    # Generate content with Gemini
    print("Sending request to Gemini model for attribute extraction")
    response = genai_client.models.generate_content(
        model="gemini-2.0-flash-001",
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0.2,  # Lower temperature for more deterministic results
            top_p=0.95,
            max_output_tokens=8192,
            response_modalities=["TEXT"],
        )
    )
    
    print(f"Received response from Gemini model with length: {len(response.text)}")
    
    # Parse the response to extract the JSON
    try:
        response_text = response.text.strip()
        # Find JSON in the response
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        
        if start != -1 and end != -1:
            json_str = response_text[start:end]
            parsed_response = json.loads(json_str)
            
            # Ensure all required keys are present
            attributes = {
                "name": parsed_response.get("name", ""),
                "date_of_birth": parsed_response.get("date_of_birth", ""),
                "date_of_first_procedure": parsed_response.get("date_of_first_procedure", "")
            }
            
            print(f"Successfully extracted attributes: {attributes}")
            return attributes
        else:
            print("No valid JSON found in the response")
            return {
                "name": "",
                "date_of_birth": "",
                "date_of_first_procedure": ""
            }
    except Exception as e:
        print(f"Error parsing attribute extraction response: {str(e)}")
        return {
            "name": "",
            "date_of_birth": "",
            "date_of_first_procedure": ""
        }

@functions_framework.http
def process_patient_referral(request):
    """
    Process a patient referral image:
    1. Delete all existing objects in the GCS bucket
    2. Upload the image to GCS
    3. Extract patient attributes from the image
    4. Return the extracted attributes
    """
    print("Starting process_patient_referral")
    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600'
    }

    if request.method == 'OPTIONS':
        return ('', 204, headers)

    # Handle POST request for patient referral image processing
    if request.method == 'POST':
        headers['Content-Type'] = 'application/json'
        try:
            request_json = request.get_json()
            if not request_json:
                return jsonify({'error': 'No JSON data received'}), 400, headers

            # Get image data from request
            image_data = request_json.get('image', '').split(',')[1]  # Remove data URL prefix
            if not image_data:
                return jsonify({'error': 'Missing image data'}), 400, headers

            # Initialize GCS bucket
            bucket = storage_client.bucket(BUCKET_NAME)
            
            # Delete all existing objects in the bucket
            print(f"Deleting all existing objects in bucket {BUCKET_NAME}")
            blobs = bucket.list_blobs()
            for blob in blobs:
                blob.delete()
                print(f"Deleted blob {blob.name}")
            
            # Generate unique filename and upload image to GCS
            filename = f"patient_referral_{uuid.uuid4()}.jpeg"
            blob = bucket.blob(filename)
            
            # Upload image to GCS
            image_bytes = base64.b64decode(image_data)
            blob.upload_from_string(image_bytes, content_type='image/jpeg')
            print(f"Image uploaded to gs://{BUCKET_NAME}/{filename}")
            
            # Extract patient attributes from the image
            attributes = extract_patient_attributes(image_data)
            
            # Return the extracted attributes
            return jsonify(attributes), 200, headers

        except Exception as e:
            logger.error(f"Error processing patient referral: {str(e)}")
            return jsonify({"error": str(e)}), 500, headers

    # If not OPTIONS or POST, return method not allowed
    return jsonify({"error": "Method not allowed"}), 405, headers

if __name__ == "__main__":
    # This is used when running locally only. When deploying to Google Cloud Functions,
    # a webserver will be used to run the app instead
    app = functions_framework.create_app(target="process_patient_referral")
    port = int(os.environ.get('PORT', 8080))
    app.run(host="0.0.0.0", port=port, debug=True)

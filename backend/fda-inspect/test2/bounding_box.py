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
import random
from PIL import Image, ImageDraw, ImageFont

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

MODEL = "gemini-2.0-flash-exp"

client = genai.Client(
    vertexai=True,
    project="gemini-med-lit-review",
    location="us-central1"
)

def generate_citation_opportunities(image_path, inspection_type):
    img = PIL.Image.open(image_path)
    img = img.convert('RGB')  # Convert image to RGB mode
    img.thumbnail([1024, 1024])
    image_io = io.BytesIO()
    img.save(image_io, format="jpeg")
    image_io.seek(0)
    image = types.Part.from_bytes(data=image_io.getvalue(), mime_type="image/jpeg")

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
                "reason": "Detailed explanation of why this citation applies based on the image",
                "box_2d": [y1, x1, y2, x2]
            }},
            // Additional citations...
        ]
    }}
    Ensure that the JSON is valid and properly formatted. For each citation, provide specific 
    bounding box coordinates (normalized to 1000x1000) that focus only on the area of the image 
    relevant to that particular citation. Do not use the entire image for every citation.""")

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

    response = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=generate_content_config,
    )

    return response.text

def plot_bounding_box(image_path, citation, index):
    img = Image.open(image_path)
    img = img.convert('RGB')  # Convert image to RGB mode
    draw = ImageDraw.Draw(img)
    width, height = img.size

    color = 'red'
    outline_thickness = 5  # Increased thickness of the bounding box
    
    # Load a larger font
    try:
        font = ImageFont.truetype("Arial.ttf", 36)  # Increased font size
    except IOError:
        font = ImageFont.load_default()
        font = ImageFont.font.Font(font, 36)  # Fallback to default font with increased size

    # Convert normalized coordinates to absolute coordinates
    y1, x1, y2, x2 = citation['box_2d']
    x1 = int(x1 * width / 1000)
    y1 = int(y1 * height / 1000)
    x2 = int(x2 * width / 1000)
    y2 = int(y2 * height / 1000)

    # Draw thicker bounding box
    for i in range(outline_thickness):
        draw.rectangle([x1+i, y1+i, x2-i, y2-i], outline=color)

    # Draw larger label
    label = f"Section {citation['section']}"
    text_bbox = draw.textbbox((0, 0), label, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    draw.rectangle([x1, y1-text_height-10, x1+text_width+10, y1], fill='white')
    draw.text((x1+5, y1-text_height-5), label, fill=color, font=font)

    # Save the image with bounding box
    output_path = f"citation_{index+1}.jpg"
    img.save(output_path)
    print(f"Saved citation image: {output_path}")


def parse_json(json_output):
    lines = json_output.splitlines()
    for i, line in enumerate(lines):
        if line == "```json":
            json_output = "\n".join(lines[i+1:])
            json_output = json_output.split("```")[0]
            break
    return json_output

if __name__ == "__main__":
    image_path = "image.jpg"
    inspection_type = input("Enter the inspection type: ")
    citation_opportunities_response = generate_citation_opportunities(image_path, inspection_type)
    
    print("Raw response:")
    print(citation_opportunities_response)
    
    try:
        parsed_json = parse_json(citation_opportunities_response)
        citation_data = json.loads(parsed_json)
        print("\nParsed JSON:")
        print(json.dumps(citation_data, indent=2))
        
        for i, citation in enumerate(citation_data['citations']):
            plot_bounding_box(image_path, citation, i)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        print("Parsed content:")
        print(parsed_json)

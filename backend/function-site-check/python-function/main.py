import base64
import io
import os
import json
import logging
import functions_framework
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types
from flask import jsonify, request

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Vertex AI clients
genai_client = genai.Client(
    vertexai=True,
    project="gemini-med-lit-review",
    location="us-central1"
)

def plot_vehicle_boxes(img_base64: str) -> tuple[dict, str]:
    """
    Analyze image with Gemini 2.0 to detect vehicles and draw bounding boxes.
    Returns the analysis results and a new base64 image with boxes drawn.
    """
    # Convert base64 to PIL Image
    img_bytes = io.BytesIO(base64.b64decode(img_base64))
    img = Image.open(img_bytes)
    draw = ImageDraw.Draw(img)
    width, height = img.size

    # Prepare prompt for Gemini
    text_prompt = types.Part.from_text("""
    Analyze this satellite image and identify all vehicles (cars, trucks, vans) visible in the image.
    For each vehicle, provide its location using normalized coordinates (0-1000 range).
    Format your response as a JSON object with this structure:
    {
        "vehicles": [
            {
                "type": "car/truck/van",
                "box_2d": [y1, x1, y2, x2],
                "confidence": 0.0-1.0
            }
        ],
        "total_count": number,
        "observations": [
            "Any notable patterns or observations about vehicle placement"
        ]
    }
    """)

    # Get analysis from Gemini
    contents = [
        types.Content(
            role="user",
            parts=[text_prompt, types.Part.from_bytes(data=base64.b64decode(img_base64), mime_type="image/jpeg")]
        )
    ]

    response = genai_client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0.4,
            top_p=0.8,
            max_output_tokens=8192
        )
    )

    try:
        # Parse response
        response_text = response.text.strip()
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start != -1 and end != -1:
            json_str = response_text[start:end]
            analysis = json.loads(json_str)
        else:
            raise ValueError("No valid JSON object found in the response")

        # Draw boxes for each vehicle
        try:
            # Try system-specific default font paths
            if os.name == 'nt':  # Windows
                font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 24)
            else:  # Linux/Mac
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        except OSError:
            # If all else fails, use default font
            font = ImageFont.load_default()

        for vehicle in analysis.get('vehicles', []):
            y1, x1, y2, x2 = vehicle['box_2d']
            # Convert normalized coordinates to image coordinates
            x1 = int(x1 * width / 1000)
            y1 = int(y1 * height / 1000)
            x2 = int(x2 * width / 1000)
            y2 = int(y2 * height / 1000)

            # Draw green rectangle
            outline_thickness = 3
            for i in range(outline_thickness):
                draw.rectangle([x1+i, y1+i, x2-i, y2-i], outline='green')

            # Draw vehicle type label
            label = f"{vehicle['type']} ({int(vehicle['confidence']*100)}%)"
            text_bbox = draw.textbbox((0, 0), label, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            
            # Draw white background for text
            draw.rectangle([x1, y1-30, x1+text_width+10, y1], fill='white')
            # Draw text
            draw.text((x1+5, y1-25), label, fill='green', font=font)

        # Convert back to base64
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG')
        img_byte_arr.seek(0)
        new_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

        return analysis, f"data:image/jpeg;base64,{new_base64}"

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return {"error": str(e)}, None

@functions_framework.http
def analyze_site_precheck(request):
    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    try:
        request_json = request.get_json()
        if not request_json:
            return jsonify({'error': 'No JSON data received'}), 400, headers

        image_data = request_json.get('image', '')
        if not image_data:
            return jsonify({'error': 'Missing image data'}), 400, headers

        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Analyze image and get vehicle boxes
        analysis, annotated_image = plot_vehicle_boxes(image_data)
        if 'error' in analysis:
            return jsonify(analysis), 500, headers

        return jsonify({
            'vehicle_analysis': analysis,
            'annotated_image': annotated_image
        }), 200, headers

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"error": str(e)}), 500, headers

# This is a Cloud Function, so we don't need the __main__ block

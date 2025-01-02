import base64
import io
import os
import re
import json
import time
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

def compress_image(img: Image.Image, max_size_kb: int = 800) -> Image.Image:
    """Compress image to target size while maintaining quality"""
    quality = 95
    img_bytes = io.BytesIO()
    
    while quality > 5:  # Don't go below quality=5
        img_bytes.seek(0)
        img_bytes.truncate()
        img.save(img_bytes, format='JPEG', quality=quality)
        if len(img_bytes.getvalue()) <= max_size_kb * 1024:
            break
        quality -= 5
    
    img_bytes.seek(0)
    return Image.open(img_bytes)

def clean_json_response(text: str) -> str:
    """Clean and validate JSON response from Gemini"""
    # Remove any non-JSON text before or after the JSON object
    text = text.strip()
    start = text.find('{')
    end = text.rfind('}') + 1
    
    if start == -1 or end == 0:
        raise ValueError("No JSON object found in response")
        
    json_str = text[start:end]
    
    # Remove markdown code block markers
    json_str = json_str.replace('```json', '').replace('```', '').strip()
    
    # Fix common JSON formatting issues
    json_str = json_str.replace('\n', ' ')  # Remove newlines
    json_str = json_str.replace('  ', ' ')  # Normalize spaces
    json_str = ' '.join(json_str.split())   # Normalize whitespace
    
    # Fix unquoted keys
    json_str = re.sub(r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', json_str)
    
    # Fix single quotes
    json_str = json_str.replace("'", '"')
    
    # Validate JSON structure
    try:
        parsed = json.loads(json_str)
        return json.dumps(parsed)  # Re-serialize to ensure proper formatting
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse cleaned JSON: {str(e)}\nJSON string: {json_str}")
        raise ValueError(f"Failed to parse JSON response: {str(e)}")

def analyze_image_stream(img_base64: str) -> tuple[dict, str]:
    """
    Analyze image with Gemini 2.0 to detect vehicles and draw bounding boxes.
    Returns the analysis results and a new base64 image with boxes drawn.
    """
    try:
        # Convert base64 to PIL Image
        img_bytes = io.BytesIO(base64.b64decode(img_base64))
        img = Image.open(img_bytes)
        # Convert to RGB mode if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
            
        # Compress image if needed
        img = compress_image(img)
        
        draw = ImageDraw.Draw(img)
        width, height = img.size

        # Prepare prompt for Gemini
        text_prompt = types.Part.from_text("""
    Analyze this satellite image and identify areas with vehicle activity, focusing on groups/clusters of vehicles.

    Vehicle Activity Assessment Rules:
    1. Look for these characteristics:
       - Groups/clusters of parked vehicles
       - Areas with clear vehicle presence
       - Loading/unloading zones with vehicles
       
    2. For each cluster:
       - Draw ONE box around the entire group of vehicles
       - Include some margin around the cluster
       - Don't try to count individual vehicles
       - Just assess if it's a small cluster (1-3 vehicles) or large cluster (4+ vehicles)
       - Assign a confidence score (0.0-1.0) based on:
         * Image clarity in that area
         * Distinctness of vehicle shapes
         * Presence of shadows/reflections matching vehicles
         * Consistent size/shape with typical vehicles
       
    3. STRICTLY EXCLUDE:
       - Ground markings without clear vehicles
       - Building features or architectural elements
       - Areas where you're unsure if objects are vehicles
       - Any cluster with confidence below 0.7

    Coordinate System:
    - Origin (0,0) at top-left corner
    - X increases left to right (width)
    - Y increases top to bottom (height)
    - All coordinates normalized to 0-1000 range
    
    Response Format:
    {
        "clusters": [
            {
                "type": "parking_lot/loading_zone/etc",
                "box_2d": [y1, x1, y2, x2],  // [top, left, bottom, right]
                "size": "small/large",  // small = 1-3 vehicles, large = 4+ vehicles
                "confidence": 0.0-1.0,  // How confident these are actual vehicles
                "description": "Brief description of cluster location"
            }
        ],
        "total_clusters": number,  // Total number of vehicle clusters found
        "activity_level": "low/high",  // low = 6 or fewer total vehicles estimated, high = more than 6 vehicles
        "observations": [
            "Brief description of overall site activity"
        ]
    }

    Example of a good cluster detection:
    {
        "type": "parking_lot",
        "box_2d": [100, 150, 200, 300],
        "size": "large",
        "confidence": 0.95,
        "description": "Main parking area with multiple vehicles"
    }
    """)

        # Get analysis from Gemini with streaming
        contents = [
            types.Content(
                role="user",
                parts=[text_prompt, types.Part.from_bytes(data=base64.b64decode(img_base64), mime_type="image/jpeg")]
            )
        ]

        tools = [types.Tool(google_search=types.GoogleSearch())]
        generate_content_config = types.GenerateContentConfig(
            temperature=0.4,
            top_p=0.8,
            max_output_tokens=8192,
            response_modalities=["TEXT"],
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF")
            ],
            tools=tools
        )

        response_text = ""
        for chunk in genai_client.models.generate_content_stream(
            model="gemini-2.0-flash-exp",
            contents=contents,
            config=generate_content_config
        ):
            if not chunk.candidates or not chunk.candidates[0].content.parts:
                continue
            response_text += chunk.text

        # Clean and validate response text
        json_str = clean_json_response(response_text)
        analysis = json.loads(json_str)
        
        # Validate expected structure
        if not isinstance(analysis, dict):
            raise ValueError("Response is not a JSON object")
        if 'clusters' not in analysis:
            raise ValueError("Response missing 'clusters' array")
        if not isinstance(analysis['clusters'], list):
            raise ValueError("'clusters' is not an array")
        if 'activity_level' not in analysis:
            raise ValueError("Response missing 'activity_level'")
        if analysis['activity_level'] not in ['low', 'high']:
            raise ValueError("Invalid activity_level value")

        # Draw boxes only for large clusters with high confidence
        for cluster in analysis.get('clusters', []):
            # Skip small clusters or low confidence detections
            if cluster.get('size') != 'large' or cluster.get('confidence', 0) < 0.7:
                continue
                
            coords = cluster['box_2d']
            # Validate coordinate ranges
            if not all(0 <= c <= 1000 for c in coords):
                logger.warning(f"Invalid coordinate range: {coords}")
                continue
                
            # First order the normalized coordinates
            x1, x2 = min(coords[1], coords[3]), max(coords[1], coords[3])
            y1, y2 = min(coords[0], coords[2]), max(coords[0], coords[2])
            
            # Validate coordinate ordering
            if x1 >= x2 or y1 >= y2:
                logger.warning(f"Invalid coordinate ordering: {[y1, x1, y2, x2]}")
                continue
            
            # Convert to image coordinates and round to integers
            x1 = max(0, min(width, int(x1 * width / 1000)))
            y1 = max(0, min(height, int(y1 * height / 1000)))
            x2 = max(0, min(width, int(x2 * width / 1000)))
            y2 = max(0, min(height, int(y2 * height / 1000)))
            
            # Draw cluster bounding box
            outline_thickness = 3  # Slightly thicker for clusters
            draw.rectangle(
                [x1, y1, x2, y2],
                outline='lime',
                width=outline_thickness
            )

        # Convert back to base64
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG')
        img_byte_arr.seek(0)
        new_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

        return analysis, f"data:image/jpeg;base64,{new_base64}"

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        return {"error": str(e)}, None

def generate_status_stream():
    """Generate simple status stream with delays"""
    def generate():
        messages = [
            ("Initializing satellite image analysis...", 0.5),
            ("Processing high-resolution imagery...", 1.5),
            ("Scanning for vehicle signatures...", 2),
            ("Analyzing site activity patterns...", 2),
            ("Validating detection results...", 1.5),
            ("Generating activity report...", 1),
            ("Finalizing analysis...", 1.5)  # Changed from "Analysis complete"
        ]
        
        total_delay = sum(delay for _, delay in messages)
        logger.info(f"Total streaming delay: {total_delay} seconds")
        
        for msg, delay in messages:
            yield f'data: {{"type":"status","content":"{msg}"}}\n\n'
            time.sleep(delay)  # Longer delays to better match analysis time
            
    return generate()

@functions_framework.http
def analyze_site_precheck(request):
    """Cloud Function to analyze satellite imagery for vehicles"""
    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600'
    }

    if request.method == 'OPTIONS':
        return ('', 204, headers)

    # Handle streaming endpoint
    if request.method == 'GET' and request.path.endswith('/stream'):
        headers['Content-Type'] = 'text/event-stream'
        headers['Cache-Control'] = 'no-cache'
        headers['Connection'] = 'keep-alive'
        headers['X-Accel-Buffering'] = 'no'  # Disable proxy buffering
        
        return generate_status_stream(), 200, headers

    # Handle regular POST request for image analysis
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
        analysis, annotated_image = analyze_image_stream(image_data)
        if 'error' in analysis:
            return jsonify(analysis), 500, headers

        # Return analysis results and annotated image
        return jsonify({
            'vehicle_analysis': analysis,
            'annotated_image': annotated_image
        }), 200, headers

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"error": str(e)}), 500, headers

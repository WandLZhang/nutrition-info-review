import cv2
import numpy as np
from PIL import Image
import io
import base64

def process_video_frame(frame_data: bytes) -> np.ndarray:
    # Convert base64 encoded frame to numpy array
    nparr = np.frombuffer(frame_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Convert BGR to RGB
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Resize frame to a standard size (e.g., 640x480)
    frame_resized = cv2.resize(frame_rgb, (640, 480))
    
    return frame_resized

def frame_to_base64(frame: np.ndarray) -> str:
    # Convert numpy array to PIL Image
    pil_image = Image.fromarray(frame)
    
    # Save image to bytes buffer
    buffer = io.BytesIO()
    pil_image.save(buffer, format="JPEG")
    
    # Encode as base64
    base64_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    return base64_image

def detect_objects(frame: np.ndarray) -> list:
    # Placeholder for object detection
    # In a real implementation, you would use a pre-trained model here
    # For now, we'll return a dummy result
    return [
        {"label": "Equipment", "confidence": 0.95, "bbox": [100, 100, 200, 200]},
        {"label": "Worker", "confidence": 0.88, "bbox": [300, 150, 400, 350]}
    ]

def annotate_frame(frame: np.ndarray, objects: list) -> np.ndarray:
    annotated_frame = frame.copy()
    for obj in objects:
        label = obj["label"]
        confidence = obj["confidence"]
        bbox = obj["bbox"]
        
        # Draw bounding box
        cv2.rectangle(annotated_frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 255, 0), 2)
        
        # Add label and confidence
        text = f"{label}: {confidence:.2f}"
        cv2.putText(annotated_frame, text, (bbox[0], bbox[1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
    
    return annotated_frame

def extract_frame_metadata(frame: np.ndarray) -> dict:
    height, width, channels = frame.shape
    return {
        "width": width,
        "height": height,
        "channels": channels,
        "dtype": str(frame.dtype)
    }

def process_frame_for_inspection(frame_data: bytes) -> dict:
    # Process the incoming frame
    frame = process_video_frame(frame_data)
    
    # Detect objects in the frame
    detected_objects = detect_objects(frame)
    
    # Annotate the frame with detected objects
    annotated_frame = annotate_frame(frame, detected_objects)
    
    # Convert the annotated frame to base64 for easy transmission
    base64_frame = frame_to_base64(annotated_frame)
    
    # Extract metadata
    metadata = extract_frame_metadata(frame)
    
    return {
        "processed_frame": base64_frame,
        "detected_objects": detected_objects,
        "metadata": metadata
    }

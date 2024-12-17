import asyncio
import json
import base64
from typing import Dict, Any

import websockets
from websockets.legacy.server import WebSocketServerProtocol
from google import genai
from google.genai import types
from google.oauth2 import service_account

from rag_utils import search_datastore, process_search_results
from video_processor import process_video_frame

PROJECT_ID = "your-project-id"
LOCATION = "us-central1"
MODEL_ID = "gemini-2.0-flash-exp"
DATA_STORE_ID = "fda-title21_6"

# Initialize Gemini client
genai_client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)

async def generate_gemini_response(prompt: str) -> str:
    """Generate a response using Gemini 2.0 model."""
    model = genai_client.models.get(MODEL_ID)
    response = model.generate_content(prompt)
    return response.text

async def handle_client(websocket: WebSocketServerProtocol) -> None:
    try:
        auth_message = await websocket.recv()
        auth_data = json.loads(auth_message)
        credentials = service_account.Credentials.from_service_account_file(
            auth_data.get("credentials_path", "backend/service-account-key.json")
        )

        facility_type = None

        async for message in websocket:
            data = json.loads(message)
            
            if "facility_type" in data:
                facility_type = data["facility_type"]
                topics_prompt = f"Generate a list of inspection topics for a {facility_type} facility based on FDA Title 21 regulations."
                topics_response = await generate_gemini_response(topics_prompt)
                await websocket.send(json.dumps({"topics": topics_response}))
            
            elif "confirm_topics" in data:
                confirmed_topics = data["confirm_topics"]
            
            elif "video_frame" in data:
                frame_data = base64.b64decode(data["video_frame"])
                processed_frame = process_video_frame(frame_data)
                
                frame_analysis_prompt = f"Analyze this image for potential FDA inspection points in a {facility_type} facility."
                frame_analysis = await generate_gemini_response(frame_analysis_prompt)
                
                for point in frame_analysis.split('\n'):
                    search_results = search_datastore(point, DATA_STORE_ID)
                    relevant_codes = process_search_results(search_results, point)
                    
                    rag_prompt = f"Based on the inspection point '{point}' and these relevant Title 21 codes: {relevant_codes}, generate an inspection opportunity description."
                    rag_response = await generate_gemini_response(rag_prompt)
                    
                    await websocket.send(json.dumps({
                        "inspection_point": point,
                        "relevant_codes": relevant_codes,
                        "description": rag_response
                    }))
            
            elif "query" in data:
                query = data["query"]
                query_response = await generate_gemini_response(query)
                await websocket.send(json.dumps({"query_response": query_response}))

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {str(e)}")

async def main() -> None:
    server = await websockets.serve(handle_client, "localhost", 8765)
    print(f"WebSocket server started on ws://localhost:8765")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())

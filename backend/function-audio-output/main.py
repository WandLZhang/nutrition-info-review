import functions_framework
from flask import jsonify
from google.cloud import texttospeech
import base64
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Text-to-Speech client
tts_client = texttospeech.TextToSpeechClient()

def get_audio_content(text: str) -> str:
    """Generate audio content for the given text and return as base64."""
    try:
        # Configure voice
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Journey-F"
        )

        # Configure audio
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,
            effects_profile_id=["small-bluetooth-speaker-class-device"]
        )

        # Build synthesis input
        synthesis_input = texttospeech.SynthesisInput(text=text)

        # Perform text-to-speech request
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )

        # Return base64 encoded audio content
        return base64.b64encode(response.audio_content).decode('utf-8')
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        return None

@functions_framework.http
def fda_generate_audio(request):
    # Set CORS headers for preflight requests
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    # Set CORS headers for main requests
    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    try:
        request_json = request.get_json()
        if not request_json or 'text' not in request_json:
            return (jsonify({'error': 'Text is required'}), 400, headers)

        text = request_json['text']
        
        # Generate audio
        audio_content = get_audio_content(text)
        if not audio_content:
            return (jsonify({'error': 'Failed to generate audio'}), 500, headers)

        return (jsonify({
            'audio': audio_content  # Base64 encoded audio content
        }), 200, headers)
        
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return (jsonify({'error': str(e)}), 500, headers)

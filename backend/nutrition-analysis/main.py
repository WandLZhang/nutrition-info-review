# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import functions_framework
from flask import jsonify, request, Response, stream_with_context
import vertexai
from google import genai
from google.genai import types
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize clients
vertexai.init(project="gemini-med-lit-review")
genai_client = genai.Client(
    vertexai=True,
    project="gemini-med-lit-review",
    location="us-central1",
)

def create_nutrition_analysis_prompt(query, articles):
    """Create the prompt for nutrition analysis."""
    
    # Create a list of articles with their content
    articles_text = []
    for article in articles:
        pmid = article.get('pmid', 'N/A')
        content = article.get('content', '')
        
        articles_text.append(f"""
PMID: {pmid}
Content:
{content}
{'='*80}
""")

    prompt = f"""You are a nutrition expert analyzing scientific literature to answer health questions. Your goal is to provide evidence-based answers that validate user concerns while citing relevant research.

USER QUERY:
{query}

PUBMED ARTICLES:
{'='*80}
{'\n'.join(articles_text)}
{'='*80}

Based on the user query and the PubMed articles provided, please create a comprehensive response that:

1. Validates the user's concerns and acknowledges where these concerns might originate from
2. Analyzes the scientific evidence from the provided articles
3. Uses Google Search to find current FDA and USDA guidelines on this topic
4. Explains how government guidelines might cause confusion or may not be fully evidence-based
5. Provides a clear, evidence-based conclusion

FORMAT YOUR RESPONSE:
- Use markdown formatting throughout
- ALWAYS cite evidence from articles using clickable links in this exact format: [PMID](https://pubmed.ncbi.nlm.nih.gov/PMID/)
- For example: [12345678](https://pubmed.ncbi.nlm.nih.gov/12345678/), [87654321](https://pubmed.ncbi.nlm.nih.gov/87654321/)
- DO NOT use formats like [number, PMID: xxxxx] or any other non-clickable citation format
- DO NOT use section headers
- **Bold key conclusions based on the evidence**
- **Bold any points where current government guidelines might cause confusion or contradict evidence**
- Be balanced and nuanced in your assessment
- Prioritize high-quality evidence and recent research
- Acknowledge limitations in the available evidence

IMPORTANT:
- Your response should be informative but accessible to a general audience
- Validate the user's concerns without being dismissive
- Highlight areas where government guidelines may not align with current research
- Provide practical takeaways based on the evidence
- Format all PMID citations as clickable links
- Use proper markdown formatting throughout
- Make sure to bold (using ** **) important conclusions and points about guideline confusion

Return your analysis in markdown format. Focus on being evidence-based while acknowledging the user's concerns."""

    return prompt

def analyze_with_gemini_stream(prompt):
    """Analyze nutrition query and articles using Gemini with streaming response."""
    model = "gemini-2.0-flash-001"
    
    # Configure Gemini with Google Search capability
    tools = [types.Tool(google_search=types.GoogleSearch())]
    
    generate_content_config = types.GenerateContentConfig(
        temperature=0.2,
        top_p=0.8,
        max_output_tokens=8192,
        response_modalities=["TEXT"],
        safety_settings=[
            types.SafetySetting(category=cat, threshold="OFF")
            for cat in ["HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_DANGEROUS_CONTENT", 
                      "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_HARASSMENT"]
        ],
        tools=tools
    )
    
    contents = [types.Content(role="user", parts=[{"text": prompt}])]
    
    try:
        # Return the streaming response generator
        return genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        
    except Exception as e:
        logger.error(f"Error in analyze_with_gemini_stream: {str(e)}")
        return None

@functions_framework.http
def nutrition_analysis(request):
    """HTTP Cloud Function for nutrition analysis with streaming response."""
    # Handle CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    }

    try:
        request_json = request.get_json()
        logger.info(f"Received request body: {json.dumps(request_json, indent=2)}")
        
        if not request_json:
            logger.error("No JSON data received in request")
            return jsonify({'error': 'No JSON data received'}), 400, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

        # Extract required fields
        query = request_json.get('query')
        articles = request_json.get('articles')

        # Log each field's presence/absence
        missing_fields = []
        if not query:
            missing_fields.append('query')
        if not articles:
            missing_fields.append('articles')

        if missing_fields:
            error_msg = f"Missing required fields: {', '.join(missing_fields)}"
            logger.error(error_msg)
            return jsonify({'error': error_msg}), 400, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

        # Create prompt
        prompt = create_nutrition_analysis_prompt(query, articles)
        
        # Get streaming response generator
        response_stream = analyze_with_gemini_stream(prompt)
        
        if not response_stream:
            return jsonify({'error': 'Failed to generate analysis'}), 500, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

        # Define the streaming response function
        def generate():
            try:
                for chunk in response_stream:
                    if chunk.text:
                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                        
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
            yield "data: [DONE]\n\n"

        return Response(
            stream_with_context(generate()),
            headers={
                **headers,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        )

    except Exception as e:
        logger.error(f"Error in nutrition_analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

if __name__ == "__main__":
    app = functions_framework.create_app(target="nutrition_analysis")
    app.run(host="0.0.0.0", port=8080, debug=True)

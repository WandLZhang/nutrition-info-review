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
from flask import jsonify, request, Response
from google.cloud import bigquery
import json
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize BigQuery client
bq_client = bigquery.Client(project="playground-439016")

def create_bq_query(query_text, num_articles=20):
    return f"""
    DECLARE query_text STRING;
    SET query_text = \"\"\"
    {query_text}
    \"\"\";

    WITH query_embedding AS (
      SELECT ml_generate_embedding_result AS embedding_col
      FROM ML.GENERATE_EMBEDDING(
        MODEL `playground-439016.pmid_uscentral.textembed`,
        (SELECT query_text AS content),
        STRUCT(TRUE AS flatten_json_output)
      )
    )
    SELECT 
  base.name as name,  -- This is the PMCID from pmid_embed_nonzero table
  PMID,              -- This is the PMID from pmid_metadata table
  base.content,
  distance
    FROM VECTOR_SEARCH(
    TABLE `playground-439016.pmid_uscentral.pmid_embed_nonzero`,
    'ml_generate_embedding_result',
    (SELECT embedding_col FROM query_embedding),
    top_k => {num_articles}
    ) results
    JOIN `playground-439016.pmid_uscentral.pmid_embed_nonzero` base 
    ON results.base.name = base.name  -- Join on PMCID
    JOIN playground-439016.pmid_uscentral.pmid_metadata metadata
    ON base.name = metadata.AccessionID  -- Join on PMCID (AccessionID is PMCID)
    ORDER BY distance ASC;
    """

def stream_response(query_text, num_articles=20):
    try:
        # Execute BigQuery
        query = create_bq_query(query_text, num_articles)
        query_job = bq_client.query(query)
        results = list(query_job.result())
        
        # Create response array
        response_array = []
        
        # Process each article
        for row in results:
            pmcid = row['name']  # This is PMCID
            pmid = row['PMID']   # This is PMID
            content = row['content']
            distance = row['distance']
            
            # Log article details
            logger.info(f"Processing article:\nPMCID: {pmcid}\nPMID: {pmid}\nDistance: {distance}")
            
            # Add to response array
            response_array.append({
                "name": pmcid,
                "pmid": pmid,
                "content": content,
                "distance": str(distance)
            })
        
        # Return the complete array as JSON
        return json.dumps(response_array)

    except Exception as e:
        logger.error(f"Error in stream_response: {str(e)}")
        return json.dumps({
            "error": str(e)
        })

@functions_framework.http
def retrieve_full_articles(request):
    # Enable CORS
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
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    }

    try:
        request_json = request.get_json()
        if not request_json:
            return jsonify({'error': 'No JSON data received'}), 400, headers

        query_text = request_json.get('events_text')
        if not query_text:
            return jsonify({'error': 'Missing events_text field'}), 400, headers

        # Get num_articles if provided, default to 20
        num_articles = request_json.get('num_articles', 20)

        # Get results and return immediately
        results = stream_response(query_text, num_articles)
        return Response(results, headers=headers, mimetype='application/json')

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"error": str(e)}), 500, headers

if __name__ == "__main__":
    app = functions_framework.create_app(target="retrieve_full_articles")
    app.run(host="0.0.0.0", port=8080, debug=True)

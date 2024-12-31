import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import fetch from 'node-fetch';

// Initialize Express apps
const processInspectionApp = express();
const analyzeSitePrecheckApp = express();

// Enable CORS
processInspectionApp.use(cors());
analyzeSitePrecheckApp.use(cors());

// Parse JSON bodies
processInspectionApp.use(express.json({ limit: '50mb' }));
analyzeSitePrecheckApp.use(express.json());

// Initialize clients
const vertexai = new VertexAI({project: 'gemini-med-lit-review', location: 'us-central1'});
const visionClient = new ImageAnnotatorClient();
const storage = new Storage();
const model = vertexai.preview.getGenerativeModel({model: 'gemini-2.0-flash-exp'});

// Process inspection images
processInspectionApp.post('/', async (req, res) => {
  try {
    const { image, background } = req.body;
    if (!image || !background) {
      return res.status(400).send('Missing image or background information');
    }

    // Convert base64 image to buffer
    const imageBuffer = Buffer.from(image.split(',')[1], 'base64');

    // Upload image to temporary Cloud Storage
    const bucket = storage.bucket('fda-inspection-images');
    const filename = `temp-${Date.now()}.jpg`;
    const file = bucket.file(filename);
    await file.save(imageBuffer);

    // Get signed URL for the uploaded image
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000 // 15 minutes
    });

    // Analyze image with Vision API
    const [visionResult] = await visionClient.annotateImage({
      image: { source: { imageUri: url } },
      features: [
        { type: 'OBJECT_LOCALIZATION' },
        { type: 'TEXT_DETECTION' }
      ]
    });

    // Prepare prompt for Gemini
    const prompt = `As an FDA inspector performing a ${background} inspection, analyze the given image.
      Based on Title 21 regulations, identify potential citation opportunities and reference 
      the specific sections of Title 21 that apply. Provide a detailed explanation for each 
      potential citation, including what is observed in the image and how it relates to the 
      regulation. Format your response as a JSON object with citations array.`;

    // Generate analysis with Gemini
    const geminiResult = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } }] }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 40
      }
    });

    // Process the response
    const response = geminiResult.response;
    let citations = [];
    
    try {
      const jsonResponse = JSON.parse(response.text());
      citations = jsonResponse.citations || [];
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      citations = [];
    }

    // Clean up - delete temporary image
    await file.delete();

    // Return the citations
    res.json({ citations });

  } catch (error) {
    console.error('Error processing inspection:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Analyze site precheck using Maps Static API and Gemini
analyzeSitePrecheckApp.post('/', async (req, res) => {
  try {
    const { coordinates } = req.body;
    if (!coordinates) {
      return res.status(400).send('Missing coordinates');
    }

    // Get static map image from Google Maps API
    const [lat, lng] = coordinates.split(',').map(c => c.trim());
    const zoom = 19; // Higher zoom level for better detail
    const functions = require('firebase-functions');
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=800x600&maptype=satellite&key=${functions.config().maps.api_key}`;

    // Download the map image
    const response = await fetch(mapUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch map image: ${response.statusText}`);
    }
    const imageBuffer = await response.buffer();
    const base64Image = imageBuffer.toString('base64');

    // Save map image to Cloud Storage for reference
    const bucket = storage.bucket('fda-inspection-images');
    const filename = `site-precheck-${Date.now()}.jpg`;
    const file = bucket.file(filename);
    await file.save(imageBuffer);

    // Analyze with Gemini
    const prompt = `You are an FDA inspector analyzing a satellite image of a potential inspection site.
      
      Look for and describe:
      1. Presence and number of vehicles in parking lots or loading areas
      2. Visible building entrances, loading docks, and their condition
      3. Signs of recent activity (e.g. fresh tire marks, maintained landscaping)
      4. Building and property maintenance status
      5. Any visible industrial or manufacturing equipment/facilities
      
      Based on these observations, determine if this appears to be an active site.
      
      Format your response as a JSON object with:
      {
        "isActive": boolean,
        "confidence": number (0-1),
        "observations": string[] (list specific details you observed),
        "recommendation": string (provide a clear recommendation for inspection planning)
      }`;

    const geminiResult = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }] }
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 40
      }
    });

    const analysis = JSON.parse(geminiResult.response.text());
    res.json(analysis);

  } catch (error) {
    console.error('Error analyzing site:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Export the Cloud Functions
export const processInspection = onRequest({
  memory: '2GB',
  timeoutSeconds: 540,
}, processInspectionApp);

export const analyzeSitePrecheck = onRequest({
  memory: '2GB',
  timeoutSeconds: 540,
}, analyzeSitePrecheckApp);

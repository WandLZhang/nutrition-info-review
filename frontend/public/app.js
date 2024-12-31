// DOM Elements
const menuButton = document.getElementById('menuButton');
const menuPanel = document.getElementById('menuPanel');
const precheckView = document.getElementById('precheckView');
const inspectionView = document.getElementById('inspectionView');
const cameraToggle = document.getElementById('cameraToggle');
const captureButton = document.getElementById('captureButton');
const camera = document.getElementById('camera');
const micButton = document.getElementById('micButton');
const inspectionInput = document.getElementById('inspectionInput');
const processButton = document.getElementById('processButton');
const citationResults = document.getElementById('citationResults');
const menuItems = document.querySelectorAll('.menu-item');

// State
let isMenuOpen = false;
let isCameraOn = false;
let isRecording = false;
let currentView = null;
let mediaStream = null;
let recognition = null;
let capturedImage = null;
const retakeButton = document.getElementById('retakeButton');
const fileInput = document.getElementById('fileInput');

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        micButton.classList.add('recording');
        isRecording = true;
    };

    recognition.onend = () => {
        micButton.classList.remove('recording');
        isRecording = false;
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            }
        }
        if (finalTranscript) {
            inspectionInput.value = finalTranscript;
        }
    };
}

// Get location details from coordinates dropdown
function getLocationDetails(address) {
    const coordinates = document.getElementById('coordinates');
    const locationData = JSON.parse(coordinates.dataset.coordinates);
    return locationData.find(location => location.address === address);
}

// Load satellite image for a location
async function loadSatelliteImage(address) {
    console.log('Fetching satellite image...');
    try {
        const imageResult = await window.getMapData({ address });
        
        if (!imageResult.data) {
            console.error('No data received from getMapData');
            throw new Error('Failed to get satellite image data');
        }
        
        const { mapUrl, mapImage } = imageResult.data;
        if (!mapImage) {
            console.error('No image data received from getMapData');
            throw new Error('Failed to get satellite image');
        }
        
        console.log('Successfully received satellite image');
        
        // Get location details
        const locationDetails = getLocationDetails(address);
        
        // Display satellite image
        mapContainer.innerHTML = `
            <img src="${mapImage}" alt="Satellite view" class="w-full h-full object-cover rounded-lg">
        `;
        
        return { mapImage, locationDetails };
    } catch (err) {
        console.error('Error loading satellite image:', err);
        mapContainer.innerHTML = '<div class="p-4 text-red-600">Error loading satellite image</div>';
        throw err;
    }
}

// Analyze site image
async function analyzeSite(mapImage) {
    console.log('Starting vehicle detection analysis...');
    try {
        const analysisResult = await fetch('https://us-central1-gemini-med-lit-review.cloudfunctions.net/site-check-py', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: mapImage })
        });

        if (!analysisResult.ok) {
            const errorText = await analysisResult.text();
            console.error('Analysis failed:', errorText);
            throw new Error(`Failed to analyze image: ${errorText}`);
        }

        console.log('Received analysis response');
        const analysisData = await analysisResult.json();
        console.log('Analysis data:', {
            hasVehicleAnalysis: !!analysisData.vehicle_analysis,
            hasAnnotatedImage: !!analysisData.annotated_image,
            vehicleCount: analysisData.vehicle_analysis?.total_count
        });

        const { vehicle_analysis, annotated_image } = analysisData;
        if (!vehicle_analysis || !annotated_image) {
            console.error('Invalid analysis response:', analysisData);
            throw new Error('Invalid analysis response');
        }

        return { vehicle_analysis, annotated_image };
    } catch (err) {
        console.error('Error during analysis:', err);
        throw err;
    }
}

// Initialize map view
let mapContainer = null;
async function initMap() {
    mapContainer = document.getElementById('map');
    const coordinates = document.getElementById('coordinates');
    const defaultAddress = "10 Riverside Dr, Long Prairie, MN 56347";
    
    // Set the default value
    coordinates.value = defaultAddress;
    
    // Start analysis for default address
    await analyzeLocation(defaultAddress);
}

// Analyze a location
async function analyzeLocation(address) {
    const resultElement = document.getElementById('precheckResult');
    resultElement.textContent = 'Loading satellite image...';

    try {
        // First load the satellite image
        const { mapImage, locationDetails } = await loadSatelliteImage(address);
        
        // Show initial location info while analysis runs
        resultElement.innerHTML = `
            <div class="mb-2">
                <span class="font-semibold">Location:</span>
                <div class="text-sm font-bold">${locationDetails.name}</div>
                <div class="text-sm">${locationDetails.address}</div>
                <div class="text-sm text-gray-600">Coordinates: ${locationDetails.lat}, ${locationDetails.lon}</div>
            </div>
            <div class="animate-pulse mt-4">
                <div class="text-sm">Analyzing site activity...</div>
            </div>
        `;
        
        // Then analyze the image
        const { vehicle_analysis, annotated_image } = await analyzeSite(mapImage);
        
        // Generate activity alert
        const activityAlert = `Based on this month's aerial images, there ${vehicle_analysis.total_count > 0 ? 'have' : 'have not'} been signs of activity and usage at this inspection site. ${vehicle_analysis.total_count > 0 ? `The presence of ${vehicle_analysis.total_count} vehicle${vehicle_analysis.total_count > 1 ? 's' : ''} suggests ongoing operations.` : 'No vehicles were detected in the current image.'}`;
        
        // Format the vehicle observations as a list
        const vehicleObservations = vehicle_analysis.observations.map(obs => `• ${obs}`).join('\n');
        
        // Display analysis results
        resultElement.innerHTML = `
            <div class="mb-2">
                <span class="font-semibold">Location:</span>
                <div class="text-sm font-bold">${locationDetails.name}</div>
                <div class="text-sm">${locationDetails.address}</div>
                <div class="text-sm text-gray-600">Coordinates: ${locationDetails.lat}, ${locationDetails.lon}</div>
            </div>
            <div class="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
                ${activityAlert}
            </div>
            <div class="mb-2">
                <span class="font-semibold">Vehicle Analysis:</span>
                <div class="pl-4 text-sm">
                    <div class="mb-1">Total Vehicles: ${vehicle_analysis.total_count}</div>
                    <div class="mb-1">Vehicle Types:</div>
                    ${Object.entries(vehicle_analysis.vehicles.reduce((acc, v) => {
                        acc[v.type] = (acc[v.type] || 0) + 1;
                        return acc;
                    }, {})).map(([type, count]) => `• ${count} ${type}${count > 1 ? 's' : ''}`).join('\n')}
                </div>
            </div>
            <div class="mb-2">
                <span class="font-semibold">Observations:</span>
                <div class="pl-4 text-sm">${vehicleObservations}</div>
            </div>
        `;
    } catch (error) {
        console.error('Error analyzing location:', error);
        resultElement.innerHTML = `
            <div class="p-4 text-red-600">
                Error: ${error.message}
            </div>
        `;
    }
}

// Menu Toggle
menuButton.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    menuPanel.classList.toggle('hidden');
    menuPanel.classList.toggle('visible');
});

// View Switching
menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.target.dataset.view;
        switchView(view);
        isMenuOpen = false;
        menuPanel.classList.add('hidden');
        menuPanel.classList.remove('visible');
    });
});

function switchView(view) {
    if (currentView === view) return;
    
    // Hide all views
    precheckView.classList.add('hidden');
    inspectionView.classList.add('hidden');
    
    // Show selected view
    if (view === 'precheck') {
        precheckView.classList.remove('hidden');
        initMap();
    } else if (view === 'inspection') {
        inspectionView.classList.remove('hidden');
    }
    
    currentView = view;
    
    // Update active menu item
    menuItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
}

// Camera Controls
async function toggleCamera() {
    if (!isCameraOn) {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment'
                }
            });
            camera.srcObject = mediaStream;
            isCameraOn = true;
            cameraToggle.querySelector('.material-icons').textContent = 'videocam';
            cameraToggle.classList.remove('bg-blue-500');
            cameraToggle.classList.add('bg-red-500');
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Unable to access camera. Please ensure you have granted camera permissions.');
        }
    } else {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            camera.srcObject = null;
        }
        isCameraOn = false;
        cameraToggle.querySelector('.material-icons').textContent = 'videocam_off';
        cameraToggle.classList.remove('bg-red-500');
        cameraToggle.classList.add('bg-blue-500');
    }
}

// Microphone Controls
function toggleMicrophone() {
    if (!recognition) {
        alert('Speech recognition is not supported in this browser.');
        return;
    }

    if (!isRecording) {
        recognition.start();
    } else {
        recognition.stop();
    }
}

// Handle file upload
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            capturedImage = e.target.result;
            showPreview(capturedImage);
        };
        reader.readAsDataURL(file);
    }
});

// Capture frame
function captureFrame() {
    if (!isCameraOn) {
        alert('Please turn on the camera first.');
        return;
    }

    // Create a canvas to capture the current video frame
    const canvas = document.createElement('canvas');
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(camera, 0, 0);

    // Get base64 image data
    capturedImage = canvas.toDataURL('image/jpeg');
    showPreview(capturedImage);
}

// Show preview
function showPreview(imageData) {
    // Show preview
    const preview = document.createElement('img');
    preview.src = imageData;
    preview.className = 'absolute inset-0 w-full h-full object-contain bg-black';
    preview.id = 'preview';
    
    // Remove any existing preview
    const existingPreview = document.getElementById('preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Add preview to camera container
    camera.parentElement.appendChild(preview);
    
    // Show retake button, hide capture button
    captureButton.classList.add('hidden');
    retakeButton.classList.remove('hidden');
}

// Retake photo
function retakePhoto() {
    // Remove preview
    const preview = document.getElementById('preview');
    if (preview) {
        preview.remove();
    }
    
    // Show capture button, hide retake button
    captureButton.classList.remove('hidden');
    retakeButton.classList.add('hidden');
    
    // Clear captured image and file input
    capturedImage = null;
    fileInput.value = '';
}

// Process Inspection
async function processInspection() {
    if (!capturedImage) {
        alert('Please capture a photo first.');
        return;
    }

    const background = inspectionInput.value.trim();
    if (!background) {
        alert('Please provide inspection background information.');
        return;
    }

    try {
        processButton.disabled = true;
        processButton.textContent = 'Processing...';

        // Use Firebase Function with App Check
        const processInspectionFn = httpsCallable(functions, 'processInspection');
        const result = await processInspectionFn({
            image: capturedImage,
            background: background
        });

        displayCitations(result.data.citations);

    } catch (err) {
        console.error('Error processing inspection:', err);
        alert('An error occurred while processing the inspection.');
    } finally {
        processButton.disabled = false;
        processButton.textContent = 'Process';
    }
}

// Display Citations
function displayCitations(citations) {
    citationResults.innerHTML = '';
    citations.forEach(citation => {
        const card = document.createElement('div');
        card.className = 'citation-card';
        card.innerHTML = `
            <img src="${citation.image}" alt="Citation evidence">
            <h3>Section ${citation.section}</h3>
            <p class="text-gray-600 mb-2">${citation.text}</p>
            <p>${citation.reason}</p>
        `;
        citationResults.appendChild(card);
    });
}

// Event Listeners
cameraToggle.addEventListener('click', toggleCamera);
micButton.addEventListener('click', toggleMicrophone);
captureButton.addEventListener('click', captureFrame);
retakeButton.addEventListener('click', retakePhoto);
processButton.addEventListener('click', processInspection);

// Initialize first view
switchView('precheck');

// Handle location selection for precheck
document.getElementById('coordinates').addEventListener('change', async (e) => {
    const address = e.target.value;
    if (!address) return;
    await analyzeLocation(address);
});

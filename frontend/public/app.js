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

// Initialize Google Maps
let map = null;
async function initMap() {
    if (!map) {
        // Default to first location
        const defaultAddress = "10 Riverside Dr, Long Prairie, MN 56347";
        const coordinates = document.getElementById('coordinates');
        coordinates.value = defaultAddress;

        try {
            // Create map instance
            map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: 44.7862, lng: -93.2650 },
                zoom: 8,
                mapTypeId: 'satellite',
                tilt: 0
            });

            // Initialize geocoder
            const geocoder = new google.maps.Geocoder();
            
            // Geocode default address
            const geocodeResult = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: defaultAddress }, (results, status) => {
                    if (status === 'OK') {
                        resolve(results[0]);
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });

            const location = geocodeResult.geometry.location;
            
            // Update map with satellite view
            map.setCenter(location);
            map.setZoom(19);
            map.setMapTypeId('satellite');

            // Add marker
            new google.maps.Marker({
                map,
                position: location,
                title: defaultAddress
            });

            // Trigger analysis for default location
            const event = new Event('change');
            coordinates.dispatchEvent(event);

        } catch (error) {
            console.error('Error initializing map:', error);
        }
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

        const response = await fetch('https://us-central1-gemini-med-lit-review.cloudfunctions.net/process-inspection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: capturedImage,
                background: background
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayCitations(data.citations);

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

    const resultElement = document.getElementById('precheckResult');
    resultElement.textContent = 'Loading location...';

    try {
        // Initialize geocoder if needed
        const geocoder = new google.maps.Geocoder();
        
        // Geocode the address
        const geocodeResult = await new Promise((resolve, reject) => {
            geocoder.geocode({ address }, (results, status) => {
                if (status === 'OK') {
                    resolve(results[0]);
                } else {
                    reject(new Error(`Geocoding failed: ${status}`));
                }
            });
        });

        const location = geocodeResult.geometry.location;
        const coords = `${location.lat()},${location.lng()}`;
        
        // Update map with satellite view
        map.setCenter(location);
        map.setZoom(19); // Closer zoom for better satellite detail
        map.setMapTypeId('satellite');

        // Add a marker
        new google.maps.Marker({
            map,
            position: location,
            title: address
        });

        resultElement.textContent = 'Analyzing location...';

        const response = await fetch('https://analyzesiteprecheck-jlrwvtesnq-uc.a.run.app', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ coordinates: coords })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const analysis = await response.json();
        
        // Format the observations as a list
        const observationsList = analysis.observations.map(obs => `• ${obs}`).join('\n');
        
        resultElement.innerHTML = `
            <div class="mb-2">
                <span class="font-semibold">Status:</span> 
                ${analysis.isActive ? 
                    '<span class="text-green-600">Active</span>' : 
                    '<span class="text-red-600">Inactive</span>'}
                (${Math.round(analysis.confidence * 100)}% confidence)
            </div>
            <div class="mb-2">
                <span class="font-semibold">Location:</span>
                <div class="text-sm">${geocodeResult.formatted_address}</div>
            </div>
            <div class="mb-2">
                <span class="font-semibold">Observations:</span>
                <div class="pl-4 text-sm">${observationsList}</div>
            </div>
            <div class="mt-2">
                <span class="font-semibold">Recommendation:</span>
                <div class="text-sm">${analysis.recommendation}</div>
            </div>
        `;

    } catch (err) {
        console.error('Error analyzing site:', err);
        alert('Error analyzing the location. Please try again.');
        resultElement.textContent = 'Error analyzing location.';
    }
});

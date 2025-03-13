// DOM Elements
console.log('App.js loaded - Medical Encounter Document Capture', new Date().toISOString());
const camera = document.getElementById('camera');
const cameraToggle = document.getElementById('cameraToggle');
const captureButton = document.getElementById('captureButton');
const fileInput = document.getElementById('fileInput');
const previewArea = document.getElementById('previewArea');
const imagePreview = document.getElementById('imagePreview');
const retakeButton = document.getElementById('retakeButton');
const confirmButton = document.getElementById('confirmButton');
const placeholderMessage = document.querySelector('.placeholder-message');

// State
let isCameraOn = false;
let mediaStream = null;
let capturedImage = null;

// Camera Controls
async function toggleCamera() {
    if (!isCameraOn) {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            camera.srcObject = mediaStream;
            camera.classList.remove('hidden');
            placeholderMessage.classList.add('hidden');
            isCameraOn = true;
            cameraToggle.querySelector('.material-symbols-outlined').textContent = 'videocam_off';
            cameraToggle.classList.add('active');
            captureButton.disabled = false;
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Unable to access camera. Please ensure you have granted camera permissions.');
        }
    } else {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            camera.srcObject = null;
        }
        camera.classList.add('hidden');
        placeholderMessage.classList.remove('hidden');
        isCameraOn = false;
        cameraToggle.querySelector('.material-symbols-outlined').textContent = 'videocam';
        cameraToggle.classList.remove('active');
        captureButton.disabled = true;
    }
}

// Capture frame
function captureFrame() {
    if (!isCameraOn) {
        alert('Please turn on the camera first.');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    canvas.getContext('2d').drawImage(camera, 0, 0);
    capturedImage = canvas.toDataURL('image/jpeg');
    showPreview(capturedImage);
}

// Handle file upload
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            capturedImage = e.target.result;
            showPreview(capturedImage);
            console.log('Image loaded from file, preview should be visible now');
        };
        reader.readAsDataURL(file);
    }
});

// Show preview
function showPreview(imageData) {
    console.log('showPreview called with image data');
    imagePreview.src = imageData;
    camera.classList.add('hidden');
    placeholderMessage.classList.add('hidden');
    previewArea.classList.remove('hidden');
    console.log('Preview area should now be visible, hidden class removed');
    console.log('previewArea element:', previewArea);
    console.log('previewArea classes:', previewArea.className);
}

// Retake photo
function retakePhoto() {
    capturedImage = null;
    previewArea.classList.add('hidden');
    if (isCameraOn) {
        camera.classList.remove('hidden');
    } else {
        placeholderMessage.classList.remove('hidden');
    }
    fileInput.value = '';
}

// Confirm photo
function confirmPhoto() {
    console.log('Photo confirmed. Ready for processing.');

    if (capturedImage) {
        // Show loading state
        const confirmButton = document.getElementById('confirmButton');
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span>';

        fetch('https://patient-referral-match-934163632848.us-central1.run.app', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: capturedImage })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Backend Response:', data);

            // Get attribute display elements
            const attributesDisplay = document.getElementById('attributesDisplay');
            const attributeName = document.getElementById('attributeName').querySelector('span');
            const attributeDOB = document.getElementById('attributeDOB').querySelector('span');
            const attributeProcedureDate = document.getElementById('attributeProcedureDate').querySelector('span');

            // Update the display with extracted attributes
            attributeName.textContent = data.name || 'N/A';
            attributeDOB.textContent = data.date_of_birth || 'N/A';
            attributeProcedureDate.textContent = data.date_of_first_procedure || 'N/A';

            // Apply animations for the transition
            const buttonContainer = document.querySelector('.button-container');
            const previewArea = document.getElementById('previewArea');
            const resultsLayout = document.querySelector('.results-layout');
            const previewContainer = document.querySelector('.preview-container');
            const attributesContainer = document.querySelector('.attributes-container');
            
            // First fade out the buttons
            buttonContainer.classList.add('fade-out');
            
            // After a short delay, switch to results mode layout and animate
            setTimeout(() => {
                // Add the results-mode class to change the layout and background
                previewArea.classList.add('results-mode');
                resultsLayout.classList.add('results-mode');
                
                // Slide the preview to the left
                previewContainer.classList.add('slide-left');
                
                // After the slide animation starts, fade in the attributes
                setTimeout(() => {
                    attributesContainer.classList.add('fade-in');
                }, 300);
            }, 500);
        })
        .catch(error => {
            console.error('Error sending image to backend:', error);
            alert('Error sending image to backend: ' + error.message);
        })
        .finally(() => {
            // Reset button state
            confirmButton.disabled = false;
            confirmButton.innerHTML = '<span class="material-symbols-outlined">check</span>';
        });
    } else {
        alert('No image captured.');
    }
}

// Event Listeners
cameraToggle.addEventListener('click', toggleCamera);
captureButton.addEventListener('click', captureFrame);
retakeButton.addEventListener('click', retakePhoto);
confirmButton.addEventListener('click', confirmPhoto);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    captureButton.disabled = true; // Disable capture button until camera is on
    
    // Ensure preview area is hidden on page load
    if (previewArea) {
        previewArea.classList.add('hidden');
        console.log('Preview area hidden on page load');
    }
});

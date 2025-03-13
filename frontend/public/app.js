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
        };
        reader.readAsDataURL(file);
    }
});

// Show preview
function showPreview(imageData) {
    imagePreview.src = imageData;
    camera.classList.add('hidden');
    placeholderMessage.classList.add('hidden');
    previewArea.classList.remove('hidden');
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
    alert('Photo confirmed. In a real application, this would be sent for processing.');
}

// Event Listeners
cameraToggle.addEventListener('click', toggleCamera);
captureButton.addEventListener('click', captureFrame);
retakeButton.addEventListener('click', retakePhoto);
confirmButton.addEventListener('click', confirmPhoto);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    captureButton.disabled = true; // Disable capture button until camera is on
});

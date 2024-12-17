let socket;
let videoStream;
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const connectButton = document.getElementById('connectButton');
const facilityTypeInput = document.getElementById('facilityType');
const topicsList = document.getElementById('topicsList');
const startInspectionButton = document.getElementById('startInspection');
const stopInspectionButton = document.getElementById('stopInspection');
const userQueryInput = document.getElementById('userQuery');
const sendQueryButton = document.getElementById('sendQuery');
const outputDiv = document.getElementById('output');
const connectionStatus = document.getElementById('connectionStatus');

const SERVER_URL = 'ws://localhost:8765';

connectButton.addEventListener('click', connectWebSocket);
startInspectionButton.addEventListener('click', startInspection);
stopInspectionButton.addEventListener('click', stopInspection);
sendQueryButton.addEventListener('click', sendQuery);

function connectWebSocket() {
    socket = new WebSocket(SERVER_URL);
    
    socket.onopen = function(event) {
        connectionStatus.textContent = 'Connected to server';
        connectButton.disabled = true;
    };
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.topics) {
            topicsList.value = data.topics;
        } else if (data.inspection_point) {
            outputDiv.innerHTML += `<p><strong>Inspection Point:</strong> ${data.inspection_point}<br>
                                    <strong>Relevant Codes:</strong> ${data.relevant_codes}<br>
                                    <strong>Description:</strong> ${data.description}</p>`;
        } else if (data.query_response) {
            outputDiv.innerHTML += `<p><strong>Query Response:</strong> ${data.query_response}</p>`;
        }
    };
    
    socket.onclose = function(event) {
        connectionStatus.textContent = 'Disconnected from server';
        connectButton.disabled = false;
    };
    
    socket.onerror = function(error) {
        console.error(`WebSocket Error: ${error}`);
        connectionStatus.textContent = 'Error: Could not connect to server';
    };
}

let audioContext;
let audioWorkletNode;

async function setupAudioProcessing() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.audioWorklet.addModule('pcm-processor.js');
        audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        audioWorkletNode.connect(audioContext.destination);
        console.log('Audio processing setup completed successfully');
    } catch (error) {
        console.error('Failed to setup audio processing:', error);
    }
}

function processAudio(audioData) {
    if (audioWorkletNode) {
        audioWorkletNode.port.postMessage(audioData);
    }
}

async function startInspection() {
    try {
        await setupAudioProcessing();
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoElement.srcObject = videoStream;
        sendFacilityType();
        captureAndSendFrames();
        // Setup audio processing
        const audioTrack = videoStream.getAudioTracks()[0];
        const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        audioSource.connect(audioWorkletNode);
    } catch (error) {
        console.error('Error starting inspection:', error);
        outputDiv.innerHTML += '<p>Error: Could not access webcam or setup audio</p>';
    }
}

function stopInspection() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    if (audioContext) {
        audioContext.close().then(() => {
            console.log('AudioContext closed');
        }).catch(error => {
            console.error('Error closing AudioContext:', error);
        });
    }
}

function sendFacilityType() {
    const facilityType = facilityTypeInput.value;
    socket.send(JSON.stringify({ facility_type: facilityType }));
}

function captureAndSendFrames() {
    const context = canvasElement.getContext('2d');

    function sendFrame() {
        console.log('Attempting to capture frame...');

        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            console.log('Video ready state: HAVE_ENOUGH_DATA');
            console.log(`Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);

            // Ensure video has valid dimensions
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;

                context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                console.log('Frame drawn to canvas');

                canvasElement.toBlob(function(blob) {
                    if (blob) {
                        console.log(`Blob created successfully. Size: ${blob.size} bytes`);
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            const base64data = reader.result.split(',')[1];
                            console.log('Base64 data created. Sending to server...');
                            socket.send(JSON.stringify({ video_frame: base64data }));
                        };
                        reader.onerror = function(error) {
                            console.error('Error reading blob:', error);
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        console.error('Failed to create blob from canvas');
                    }
                }, 'image/jpeg', 0.95);  // Specify image format and quality
            } else {
                console.warn('Video dimensions are invalid. Skipping frame capture.');
            }
        } else {
            console.warn(`Video not ready. Current state: ${videoElement.readyState}`);
        }
    }

    const frameInterval = setInterval(sendFrame, 1000);

    stopInspectionButton.addEventListener('click', () => {
        clearInterval(frameInterval);
        console.log('Frame capture stopped');
    });
}

function sendQuery() {
    const query = userQueryInput.value;
    socket.send(JSON.stringify({ query: query }));
    userQueryInput.value = '';
}

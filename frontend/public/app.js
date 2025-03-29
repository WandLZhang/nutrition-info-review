// DOM Elements for slides
console.log('App.js loaded - Nutrition Info Review', new Date().toISOString());

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    // Initialize the slide view
    console.log('Initializing slide view for nutrition info review');
    
    // Add event listener for the example button
    const exampleButton = document.getElementById('exampleButton');
    const searchInput = document.getElementById('searchInput');
    
    if (exampleButton && searchInput) {
        console.log('Found example button and search input, adding event listener');
        exampleButton.addEventListener('click', () => {
            console.log('Example button clicked');
            searchInput.value = "Are saturated fats really bad?";
            searchInput.focus();
        });
    }
    
    // Add event listener for the submit button
    const submitButton = document.getElementById('submitButton');
    if (submitButton && searchInput) {
        console.log('Found submit button, adding event listener');
        submitButton.addEventListener('click', async () => {
            console.log('Submit button clicked');
            const query = searchInput.value.trim();
            
            if (query) {
                console.log('Submitting search query:', query);
                
                // Get references to elements
                const exampleButton = document.getElementById('exampleButton');
                const searchInputGroup = document.querySelector('.search-input-group');
                const loadingContainer = document.getElementById('loadingContainer');
                const transitionText = document.getElementById('transition-text');
                
                // Store the query text for later use
                const queryText = query;
                
                // Trigger the text transition
                if (transitionText) {
                    transitionText.classList.add('text-transition');
                    
                    // Change the text content when the opacity is 0 (middle of the animation)
                    setTimeout(() => {
                        transitionText.textContent = "The search will always have guaranteed hits";
                    }, 800); // 800ms is 40% of the 2s animation duration
                }
                
                // 1. Fade out the example button, submit button, and search input text
                exampleButton.classList.add('elements-fade-out');
                submitButton.classList.add('elements-fade-out');
                
                // Add fade-out effect to the search input text while preserving the input element
                searchInput.classList.add('elements-fade-out');
                
                // 2. Expand the search bar into a box (non-editable)
                setTimeout(() => {
                    // Hide the buttons completely
                    exampleButton.style.display = 'none';
                    submitButton.style.display = 'none';
                    
                    // Create a new div element to replace the input
                    const outputBox = document.createElement('div');
                    outputBox.id = 'outputBox';
                    
                    // Copy the position and dimensions of the search input
                    const inputRect = searchInput.getBoundingClientRect();
                    
                    // Get the position of the slide-card in slide-3
                    const slideCard = document.querySelector('#slide-3 .slide-card');
                    const slideCardRect = slideCard.getBoundingClientRect();
                    const searchContainerRect = document.querySelector('.search-container').getBoundingClientRect();
                    
                    // Calculate the top position relative to the search container
                    // Subtract a larger offset to ensure perfect alignment with the top of the card
                    const topPosition = slideCardRect.top - searchContainerRect.top - 20;
                    
                    // Calculate the height to match the bottom of the slide card
                    const slideCardHeight = slideCardRect.height;
                    const slideCardBottom = slideCardRect.bottom - searchContainerRect.top;
                    const boxHeight = slideCardBottom - topPosition;
                    
                    // First, make it match the search bar exactly
                    outputBox.style.cssText = `
                        width: ${inputRect.width}px !important;
                        height: ${inputRect.height}px !important;
                        position: absolute !important;
                        top: ${topPosition}px !important;
                        left: ${searchInput.offsetLeft}px !important;
                        background-color: white !important;
                        border-radius: 25px !important;
                        border: none !important;
                        box-shadow: 0 0 8px 2px rgba(66, 133, 244, 0.5) !important;
                        transition: all 0.8s ease !important;
                        opacity: 0 !important;
                        overflow: hidden !important;
                        z-index: 100 !important;
                    `;
                    
                    // Hide the original search input
                    searchInput.style.display = 'none';
                    
                    // Add the output box to the search input's parent
                    searchInput.parentNode.appendChild(outputBox);
                    
                    // Trigger reflow to ensure the initial styles are applied before animation
                    void outputBox.offsetWidth;
                    
                    // Fade in the output box
                    outputBox.style.opacity = '1 !important';
                    
                    // After a short delay, start the expansion animation
                    setTimeout(() => {
                        // Apply custom animation instead of using the class
                        outputBox.style.cssText = `
                            width: ${inputRect.width}px !important;
                            height: ${boxHeight}px !important;
                            position: absolute !important;
                            top: ${topPosition}px !important;
                            left: ${searchInput.offsetLeft}px !important;
                            background-color: white !important;
                            border-radius: 8px !important;
                            border: none !important;
                            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2) !important;
                            transition: all 0.8s ease !important;
                            opacity: 1 !important;
                            overflow: auto !important;
                            z-index: 100 !important;
                            padding: 20px !important;
                        `;
                    }, 100);
                    
                    // Get the position of the output box
                    const outputBoxRect = outputBox.getBoundingClientRect();
                    
                    // Position the loading container relative to the slide card
                    loadingContainer.style.position = 'absolute';
                    loadingContainer.style.top = `${topPosition + 20}px`; // Add padding to position it inside the expanded box
                    loadingContainer.style.left = `${searchInput.offsetLeft + 20}px`; // Add padding from the left edge
                    loadingContainer.style.zIndex = '1000';
                    
                    // 3. Show the loading animation
                    setTimeout(() => {
                        loadingContainer.classList.remove('hidden');
                        loadingContainer.classList.add('visible');
                    }, 500);
                }, 500); // Increased timeout to allow fade-out to complete
                
                try {
                    // Call the nutrition-retrieve-articles API
                    const response = await fetch('https://nutrition-retrieve-articles-934163632848.us-central1.run.app', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            events_text: query,
                            num_articles: 20
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('API Response:', data);
                    
                    // 4. Hide the loading animation when the API call completes
                    loadingContainer.classList.remove('visible');
                    setTimeout(() => {
                        loadingContainer.classList.add('hidden');
                    }, 500);
                    
                    // 5. Display the PMC boxes in a grid
                    displayPmcBoxes(data);
                    
                    // 6. Call the nutrition analysis endpoint with the articles and query
                    analyzeArticles(data, queryText);
                    
                } catch (error) {
                    console.error('Error fetching nutrition articles:', error);
                    
                    // Hide loading animation on error too
                    loadingContainer.classList.remove('visible');
                    setTimeout(() => {
                        loadingContainer.classList.add('hidden');
                    }, 500);
                }
            } else {
                console.log('Empty search query, not submitting');
            }
        });
    } else {
        console.error('Submit button or search input not found');
    }
    
    // Make sure all slides are hidden first
    const allSlides = document.querySelectorAll('.slide');
    allSlides.forEach(slide => {
        slide.classList.add('hidden');
    });
    
    // Ensure only slide 1 is visible initially
    const slide1 = document.getElementById('slide-1');
    if (slide1) {
        console.log('Found slide-1, making it visible');
        slide1.classList.remove('hidden');
    } else {
        console.error('Slide 1 not found');
    }
    
    // Add event listener for the next slide button
    const nextSlideButton = document.getElementById('nextSlideButton');
    if (nextSlideButton) {
        console.log('Found next slide button, adding event listener');
        nextSlideButton.addEventListener('click', () => {
            console.log('Next slide button clicked');
            
            // Get the slide element
            const slide = document.getElementById('slide-1');
            console.log('Slide element:', slide);
            
            if (slide) {
                // Add the transitioning class to the slide to trigger the card fade-out
                slide.classList.add('slide-transitioning');
                console.log('Added slide-transitioning class');
                
                // Get the slide card element to listen for animation end
                const slideCard = slide.querySelector('.slide-card');
                
                if (slideCard) {
                    // Listen for the animation to end before changing slides
                    slideCard.addEventListener('animationend', function animationEndHandler(event) {
                        console.log('Animation ended:', event.animationName);
                        
                        // Remove the event listener to prevent multiple triggers
                        slideCard.removeEventListener('animationend', animationEndHandler);
                        
                        // Navigate to the next slide
                        navigateToSlide(2);
                    });
                }
                
                // Fallback in case animation event doesn't fire
                setTimeout(() => {
                    console.log('Fallback timeout triggered');
                    navigateToSlide(2);
                }, 1000); // 1 second fallback
            } else {
                console.error('Slide element not found');
                // Navigate anyway if we can't find the slide
                navigateToSlide(2);
            }
        });
    } else {
        console.error('Next slide button not found');
    }
    
    // Add event listener for slide 2 button
    const slide2Button = document.getElementById('slide2Button');
    if (slide2Button) {
        console.log('Found slide 2 button, adding event listener');
        slide2Button.addEventListener('click', () => {
            console.log('Slide 2 button clicked');
            
            // Get the slide element
            const slide = document.getElementById('slide-2');
            console.log('Slide element:', slide);
            
            if (slide) {
                // Add the transitioning class to the slide to trigger the card fade-out
                slide.classList.add('slide-transitioning');
                console.log('Added slide-transitioning class');
                
                // Get the slide card element to listen for animation end
                const slideCard = slide.querySelector('.slide-card');
                
                if (slideCard) {
                    // Listen for the animation to end before changing slides
                    slideCard.addEventListener('animationend', function animationEndHandler(event) {
                        console.log('Animation ended:', event.animationName);
                        
                        // Remove the event listener to prevent multiple triggers
                        slideCard.removeEventListener('animationend', animationEndHandler);
                        
                        // Navigate to the next slide
                        navigateToSlide(3);
                    });
                }
                
                // Fallback in case animation event doesn't fire
                setTimeout(() => {
                    console.log('Fallback timeout triggered');
                    navigateToSlide(3);
                }, 1000); // 1 second fallback
            } else {
                console.error('Slide element not found');
                // Navigate anyway if we can't find the slide
                navigateToSlide(3);
            }
        });
    } else {
        console.error('Slide 2 button not found');
    }
});

// Slide Navigation
function navigateToSlide(slideNumber) {
    console.log(`Navigating to slide ${slideNumber}`);
    
    // Hide all slides
    const slides = document.querySelectorAll('.slide');
    slides.forEach(slide => {
        slide.classList.add('hidden');
    });
    
    // Show the target slide
    const targetSlide = document.getElementById(`slide-${slideNumber}`);
    if (targetSlide) {
        console.log(`Found slide-${slideNumber}, removing hidden class`);
        targetSlide.classList.remove('hidden');
    } else {
        console.error(`Slide ${slideNumber} not found`);
    }
}

// Display PMC Boxes in a grid
function displayPmcBoxes(data) {
    console.log('Displaying PMC boxes for', data.length, 'articles');
    
    // Get the output box
    const outputBox = document.getElementById('outputBox');
    
    if (!outputBox) {
        console.error('Output box not found');
        return;
    }
    
    // Clear any existing content in the output box
    outputBox.innerHTML = '';
    
    // Create a container for the PMC grid
    const pmcGridContainer = document.createElement('div');
    pmcGridContainer.className = 'pmc-grid-container';
    pmcGridContainer.style.cssText = `
        background-color: transparent !important;
        padding: 10px 10px 5px 10px !important;
        width: 100% !important;
    `;
    
    // Create the grid inside the container
    const pmcGrid = document.createElement('div');
    pmcGrid.className = 'pmc-grid';
    pmcGrid.style.cssText = `
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 15px !important;
        width: 100% !important;
    `;
    pmcGridContainer.appendChild(pmcGrid);
    
    // Add the grid container directly to the output box
    outputBox.appendChild(pmcGridContainer);
    
    // Create a box for each article (up to 20)
    const maxArticles = Math.min(data.length, 20);
    
    for (let i = 0; i < maxArticles; i++) {
        const article = data[i];
        
        // Create a link element for the box
        const boxLink = document.createElement('a');
        boxLink.style.cssText = `
            background-color: white !important;
            border-radius: 8px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
            padding: 15px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: #4285f4 !important;
            text-decoration: none !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
            opacity: 0 !important;
            transform: translateY(10px) !important;
        `;
        boxLink.href = `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
        boxLink.target = '_blank'; // Open in new tab
        boxLink.textContent = article.name; // PMC number (PMCID)
        
        // Add the box to the grid
        pmcGrid.appendChild(boxLink);
        
        // Apply the animation with a staggered delay
        setTimeout(() => {
            boxLink.style.opacity = '1';
            boxLink.style.transform = 'translateY(0)';
        }, i * 50); // 50ms delay between each box animation
    }
    
    // Create a container for the analysis response
    const analysisContainer = document.createElement('div');
    analysisContainer.id = 'analysisContainer';
    analysisContainer.style.cssText = `
        margin-top: 5px !important;
        padding: 10px !important;
        background-color: white !important;
        border-radius: 0 !important;
        border: none !important;
        box-shadow: none !important;
        width: 100% !important;
        overflow-y: auto !important;
        display: none !important;
    `;
    
    // Add the analysis container to the output box
    outputBox.appendChild(analysisContainer);
    
    // Raw response container removed as requested
}

// Analyze articles using the nutrition-analysis endpoint
function analyzeArticles(articles, query) {
    console.log('Analyzing articles with query:', query);
    
    // Get the output box and create a new loading container for analysis
    const outputBox = document.getElementById('outputBox');
    const analysisContainer = document.getElementById('analysisContainer');
    
    if (!outputBox || !analysisContainer) {
        console.error('Output box or analysis container not found');
        return;
    }
    
    // Show the analysis container
    analysisContainer.style.display = 'block';
    
    // Create a loading container for the analysis
    const analysisLoadingContainer = document.createElement('div');
    analysisLoadingContainer.className = 'loading-container';
    analysisLoadingContainer.id = 'analysisLoadingContainer';
    analysisLoadingContainer.style.cssText = `
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        margin: 0 !important;
        background-color: rgba(255, 255, 255, 0.8) !important;
        padding: 2px 2px 2px 2px !important;
        border-radius: 5px !important;
        opacity: 1 !important;
        visibility: visible !important;
        left: 0 !important;
        top: 0 !important;
    `;
    
    // Create loading icon
    const loadingIcon = document.createElement('div');
    loadingIcon.className = 'loading-icon';
    loadingIcon.innerHTML = '<span class="material-symbols-outlined">settings</span>';
    analysisLoadingContainer.appendChild(loadingIcon);
    
    // Create loading text
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.innerHTML = '<span>Analyzing</span>';
    analysisLoadingContainer.appendChild(loadingText);
    
    // Add the loading container to the analysis container
    analysisContainer.appendChild(analysisLoadingContainer);
    
    // Create a container for the streamed response
    const responseContainer = document.createElement('div');
    responseContainer.id = 'responseContainer';
    responseContainer.className = 'markdown-content';
    responseContainer.style.cssText = `
        width: 100% !important;
        font-size: 14px !important;
        line-height: 1.6 !important;
        color: #333 !important;
    `;
    
    // Add the response container to the analysis container
    analysisContainer.appendChild(responseContainer);
    
    // Make the POST request to start the analysis and handle streaming response
    let responseText = '';
    let chunkCounter = 0;
    let allChunks = [];
    
    console.log('Starting API call to nutrition-analysis endpoint');
    console.log('Request payload:', { query, articlesCount: articles.length });
    
    // Use fetch with streaming response handling
    fetch('https://nutrition-analysis-934163632848.us-central1.run.app', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
            query: query,
            articles: articles
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Get a reader from the response body stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // Function to process the stream chunks
        function processStream() {
            return reader.read().then(({ done, value }) => {
                // If the stream is done, hide the loading container
                if (done) {
                    analysisLoadingContainer.style.display = 'none';
                    return;
                }
                
                // Decode the chunk
                const chunk = decoder.decode(value, { stream: true });
                chunkCounter++;
                
                // Log the raw chunk for debugging
                console.log(`Raw chunk #${chunkCounter} received:`, chunk);
                
                // Process SSE events more robustly
                // Match "data: " at the beginning of a line and capture everything after it
                // Only stop at a new event that starts with a blank line followed by "data: "
                const eventRegex = /^data: ([\s\S]+?)(?=\n\ndata: |$)/gm;
                let match;
                
                while ((match = eventRegex.exec(chunk)) !== null) {
                    const data = match[1].trim();
                    if (!data) continue;
                    
                    console.log(`Processing SSE event from chunk #${chunkCounter}:`, data);
                    
                    // Store the chunk for later analysis
                    allChunks.push({
                        chunkNumber: chunkCounter,
                        rawChunk: chunk,
                        extractedData: data
                    });
                    
                    // Check if it's the end marker
                    if (data === '[DONE]') {
                        console.log('End of stream detected');
                        analysisLoadingContainer.style.display = 'none';
                        
                        // Log the complete response for comparison
                        console.log('COMPLETE RESPONSE:', responseText);
                        console.log('ALL CHUNKS:', allChunks);
                        
                        return;
                    }
                    
                    // Parse the JSON data to extract the text property
                    try {
                        const jsonData = JSON.parse(data);
                        if (jsonData.text) {
                            // Append the text to the response text
                            responseText += jsonData.text;
                            
                            // Hide the loading animation after the first text chunk is displayed
                            if (chunkCounter === 1 || responseText.trim().length > 0) {
                                analysisLoadingContainer.style.display = 'none';
                                console.log('Hiding analysis loading container after first text chunk');
                            }
                        } else if (data === '[DONE]') {
                            // End marker, do nothing
                        } else {
                            // If no text property but not end marker, append the raw data
                            responseText += data;
                        }
                    } catch (e) {
                        // If it's not valid JSON, just append the raw data
                        console.warn('Failed to parse JSON, using raw data:', e);
                        responseText += data;
                    }
                    
                    // Use a markdown renderer to properly display the content
                    // This preserves all formatting including newlines
                    responseContainer.innerHTML = marked.parse(responseText);
                    console.log(`Updated response container with content from chunk #${chunkCounter}`);
                    
                    // Raw response container code removed as requested
                    
                    // Auto-scroll to the bottom
                    analysisContainer.scrollTop = analysisContainer.scrollHeight;
                }
                
                // Continue processing the stream
                return processStream();
            });
        }
        
        // Start processing the stream
        return processStream();
    })
    .catch(error => {
        console.error('Error with streaming response:', error);
        
        // Hide the loading container
        analysisLoadingContainer.style.display = 'none';
        
        // Show error message
        responseContainer.innerHTML = '<p style="color: red;">Error loading analysis. Please try again.</p>';
    });
}

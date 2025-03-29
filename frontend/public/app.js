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
                
                // Store the query text for later use
                const queryText = query;
                
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
                            height: 400px !important;
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
        padding: 10px !important;
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
}

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
                
                // 2. Expand the search bar into a box
                setTimeout(() => {
                    // Hide the buttons completely
                    exampleButton.style.display = 'none';
                    submitButton.style.display = 'none';
                    
                    // Clear the search input text but keep the element
                    searchInput.value = '';
                    
                    // Remove the fade-out class to make the input visible again
                    searchInput.classList.remove('elements-fade-out');
                    
                    // Remove any inline styles
                    searchInput.style = '';
                    
                    // Make sure the input is visible
                    searchInput.style.opacity = '1';
                    searchInput.style.visibility = 'visible';
                    
                    // Expand the search box
                    searchInput.classList.add('search-box-expand');
                    
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
                    
                    // Process the results as needed
                    // For now, just log to console as requested
                    
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

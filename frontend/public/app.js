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

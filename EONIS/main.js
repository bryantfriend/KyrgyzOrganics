/* ==============================================
main.js for eONIS Landing Page
- Handles interactive elements like the mobile menu and form submissions.
==============================================
*/

// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', () => {

    // --- Mobile Menu Functionality ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    // Check if the menu button and menu exist
    if (mobileMenuButton && mobileMenu) {
        // Toggle the 'hidden' class on the mobile menu when the button is clicked
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Add event listener to all links within the mobile menu
        const mobileMenuLinks = mobileMenu.querySelectorAll('a');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Hide the menu when a link is clicked for a smoother navigation experience
                mobileMenu.classList.add('hidden');
            });
        });
    }

    // --- Email Signup Form Functionality ---
    const signupForm = document.getElementById('signup-form');
    const emailInput = document.getElementById('email-input');
    const formMessage = document.getElementById('form-message');

    // Check if the form elements exist
    if (signupForm && emailInput && formMessage) {
        signupForm.addEventListener('submit', (e) => {
            // Prevent the default form submission behavior
            e.preventDefault();

            // Display a success message to the user
            formMessage.textContent = 'Thank you for signing up!';
            formMessage.style.color = '#34D399'; // A pleasant green color for success

            // Clear the input field after successful submission
            emailInput.value = '';

            // Remove the success message after 3 seconds
            setTimeout(() => {
                formMessage.textContent = '';
            }, 3000);
        });
    }

});

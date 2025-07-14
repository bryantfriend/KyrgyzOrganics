document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.node-button');
    const modal = document.getElementById('info-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const closeModalButton = document.getElementById('close-modal-button');

    // Show modal on button click
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            modalTitle.textContent = button.getAttribute('data-title');
            modalContent.textContent = button.getAttribute('data-content');
            modal.classList.remove('modal-hidden');
            modal.classList.add('flex'); // Show modal
        });
    });

    // Hide modal on close
    closeModalButton.addEventListener('click', () => {
        modal.classList.add('modal-hidden');
        modal.classList.remove('flex');
    });

    // Optional: Close modal when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('modal-hidden');
            modal.classList.remove('flex');
        }
    });
});

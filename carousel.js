
// carousel.js
(function () {
  const track = document.querySelector('.hero-carousel .carousel-track');
  const slides = Array.from(track.querySelectorAll('.carousel-slide'));
  const dots = Array.from(document.querySelectorAll('.hero-carousel .dot'));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let timerId = null;
  const INTERVAL = 5000;

  function goTo(i, { fromUser = false } = {}) {
    const prev = index;
    index = (i + slides.length) % slides.length;
    slides[prev]?.classList.remove('is-active');
    slides[index]?.classList.add('is-active');

    dots[prev]?.classList.remove('is-active');
    dots[index]?.classList.add('is-active');

    dots.forEach((d, di) =>
      d.setAttribute('aria-selected', di === index ? 'true' : 'false')
    );

    if (fromUser) restart();
  }

  function next() {
    goTo(index + 1);
  }

  function start() {
    if (prefersReduced) return;
    if (timerId) return;
    timerId = setInterval(next, INTERVAL);
  }

  function stop() {
    clearInterval(timerId);
    timerId = null;
  }

  function restart() {
    stop();
    start();
  }

  // Dot controls
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i, { fromUser: true }));
    dot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goTo(i, { fromUser: true });
      }
    });
  });

  // Pause on hover/focus
  const carousel = document.querySelector('.hero-carousel');
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);
  carousel.addEventListener('focusin', stop);
  carousel.addEventListener('focusout', start);

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.closest('.hero-carousel')) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1, { fromUser: true });
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1, { fromUser: true });
      }
    }
  });

  // Initialize
  slides[0]?.classList.add('is-active');
  dots[0]?.classList.add('is-active');
  start();
})();

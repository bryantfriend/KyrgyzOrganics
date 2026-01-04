export class Carousel {
  constructor(root, { interval = 5000 } = {}) {
    this.root = root;
    this.track = root.querySelector('.carousel-track');
    this.slides = Array.from(root.querySelectorAll('.carousel-slide'));
    this.dots = Array.from(root.querySelectorAll('.dot'));
    this.interval = interval;

    this.index = 0;
    this.timer = null;

    if (!this.slides.length) return;

    this.bind();
    this.start();
  }

  bind() {
    this.dots.forEach((dot, i) => {
      dot.addEventListener('click', () => this.goTo(i, true));
    });

    this.root.addEventListener('mouseenter', () => this.stop());
    this.root.addEventListener('mouseleave', () => this.start());
  }

  goTo(i, user = false) {
    this.slides[this.index].classList.remove('is-active');
    this.dots[this.index].classList.remove('is-active');

    this.index = (i + this.slides.length) % this.slides.length;

    this.slides[this.index].classList.add('is-active');
    this.dots[this.index].classList.add('is-active');

    if (user) this.restart();
  }

  next() {
    this.goTo(this.index + 1);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.next(), this.interval);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  restart() {
    this.stop();
    this.start();
  }
}

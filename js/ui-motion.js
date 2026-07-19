(function () {
  document.documentElement.classList.add('motion-enabled');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function markRevealElements() {
    const selectors = [
      '.hero-grid > *', '.hero-card', '.about-card', '.contact-card', '.project-card',
      '.auth-info', '.auth-card',
      '.china-hero-copy', '.china-hero-card', '.steps-grid > *', '.roles-grid > *',
      '.calculator-grid > *', '.security-grid > *', '.hunt-intro-card',
      '.welcome-card', '.stat-card', '.panel-card', '.data-card', '.hint-card', '.empty-state'
    ];

    document.querySelectorAll(selectors.join(',')).forEach((element, index) => {
      if (element.closest('[hidden]')) return;
      element.classList.add('ui-reveal');
      element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
    });
  }

  function startRevealObserver() {
    const items = document.querySelectorAll('.ui-reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px' });

    items.forEach((item) => observer.observe(item));
  }

  function addButtonFeedback() {
    document.querySelectorAll('button, .button, .dashboard-button').forEach((control) => {
      control.classList.add('ui-control');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => document.documentElement.classList.add('page-ready'));
    markRevealElements();
    startRevealObserver();
    addButtonFeedback();
  });
})();

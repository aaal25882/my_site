/* =============================================================
   portfolio-3d.js — عمق و حرکت سه‌بعدی صفحه‌ی اصلی
   بدون هیچ کتابخانه‌ی خارجی. همه‌چیز روی CSS transform سوار است،
   پس اگر این فایل بارگذاری نشود سایت کاملاً سالم می‌ماند.
   ============================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- نوار پیشرفت اسکرول ---------- */
  function initScrollProgress() {
    var bar = document.querySelector('.scroll-progress span');
    if (!bar || reduceMotion) return;

    var ticking = false;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? window.scrollY / max : 0;
      bar.style.setProperty('--progress', (ratio * 100).toFixed(2) + '%');
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* ---------- چرخش کارت‌ها نسبت به موس ---------- */
  function initTilt() {
    var cards = document.querySelectorAll('[data-tilt]');

    // عمق لایه‌های داخلی را از data-layer بخوان
    document.querySelectorAll('[data-layer]').forEach(function (layer) {
      layer.style.setProperty('--layer', layer.dataset.layer || 0);
    });

    if (reduceMotion || !finePointer) return;

    cards.forEach(function (card) {
      var max = parseFloat(card.dataset.tiltMax || '8');
      var frame = null;

      card.addEventListener('pointermove', function (event) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          var rect = card.getBoundingClientRect();
          var px = (event.clientX - rect.left) / rect.width;
          var py = (event.clientY - rect.top) / rect.height;

          card.style.setProperty('--ry', ((px - 0.5) * max * 2).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - py) * max * 2).toFixed(2) + 'deg');
          card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
          frame = null;
        });
      });

      card.addEventListener('pointerenter', function () {
        card.classList.add('is-tilting');
      });

      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
        if (frame) {
          cancelAnimationFrame(frame);
          frame = null;
        }
      });
    });
  }

  /* ---------- پارالاکس صحنه‌ی Hero ---------- */
  function initHeroParallax() {
    var scene = document.querySelector('[data-parallax-scene]');
    if (!scene || reduceMotion || !finePointer) return;

    var orbs = scene.querySelectorAll('.orb[data-depth]');
    var plane = scene.querySelector('.hero-grid-plane');
    var frame = null;

    scene.addEventListener('pointermove', function (event) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        var rect = scene.getBoundingClientRect();
        var dx = (event.clientX - rect.left) / rect.width - 0.5;
        var dy = (event.clientY - rect.top) / rect.height - 0.5;

        orbs.forEach(function (orb) {
          var depth = parseFloat(orb.dataset.depth || '0.05');
          orb.style.setProperty('--ox', (-dx * rect.width * depth).toFixed(1) + 'px');
          orb.style.setProperty('--oy', (-dy * rect.height * depth).toFixed(1) + 'px');
        });

        if (plane) {
          plane.style.setProperty('--gx', (-dx * 60).toFixed(1) + 'px');
        }

        frame = null;
      });
    });

    scene.addEventListener('pointerleave', function () {
      orbs.forEach(function (orb) {
        orb.style.setProperty('--ox', '0px');
        orb.style.setProperty('--oy', '0px');
      });
      if (plane) plane.style.setProperty('--gx', '0px');
    });
  }

  /* ---------- شمارش عددی آمار Hero ---------- */
  function initCounters() {
    var nodes = document.querySelectorAll('[data-count-to]');
    if (!nodes.length || reduceMotion || !('IntersectionObserver' in window)) return;

    function toPersian(value) {
      return String(value).replace(/\d/g, function (d) {
        return '۰۱۲۳۴۵۶۷۸۹'[Number(d)];
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        var target = parseInt(entry.target.dataset.countTo, 10);
        if (!Number.isFinite(target)) return;

        var start = performance.now();
        var duration = 900;

        (function step(now) {
          var progress = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          entry.target.textContent = toPersian(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(step);
        })(start);
      });
    }, { threshold: 0.5 });

    nodes.forEach(function (node) { observer.observe(node); });
  }

  function init() {
    initScrollProgress();
    initTilt();
    initHeroParallax();
    initCounters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

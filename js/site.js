/* =========================================================
   site.js — شمارنده‌ی آمار، منوی موبایل، ظاهرشدن هنگام اسکرول
   ========================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ارقام فارسی — بقیه‌ی سایت هم فارسی است، پس آمار هم باید باشد */
  function fa(s) {
    return String(s).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
  }

  /* ---------------------------------------------------------
     شمارنده — یک‌بار، وقتی ردیف آمار وارد قاب شد
     --------------------------------------------------------- */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function countUp(el, index) {
    var target = parseFloat(el.dataset.target);
    var decimals = parseInt(el.dataset.decimals, 10) || 0;
    var suffix = el.dataset.suffix || '';

    if (!isFinite(target)) return;

    if (reduce) {
      el.textContent = fa(target.toFixed(decimals)) + suffix;
      return;
    }

    var duration = 1500 + index * 80;
    var startOffset = 480 + index * 90;
    var final = fa(target.toFixed(decimals)) + suffix;
    var done = false;

    setTimeout(function () {
      var t0 = performance.now();
      (function tick(now) {
        var p = Math.min((now - t0) / duration, 1);
        el.textContent = fa((target * easeOutCubic(p)).toFixed(decimals)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else done = true;
      })(performance.now());
    }, startOffset);

    /* تور ایمنی: در تبِ پس‌زمینه requestAnimationFrame اجرا نمی‌شود و
       عدد روی صفر می‌ماند. اگر تا پایان زمانِ انتظار نرسیده بود،
       مقدار نهایی را می‌نشانیم تا هیچ‌وقت صفر نماند. */
    setTimeout(function () {
      if (!done) el.textContent = final;
    }, startOffset + duration + 400);
  }

  var stats = document.getElementById('stats');
  var values = [].slice.call(document.querySelectorAll('.stat-value'));

  if (stats && values.length) {
    if (!('IntersectionObserver' in window)) {
      values.forEach(countUp);
    } else {
      var statObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          statObs.disconnect();
          values.forEach(countUp);
        });
      }, { threshold: 0.25 });
      statObs.observe(stats);
    }
  }

  /* ---------------------------------------------------------
     ظاهرشدن بخش‌ها هنگام اسکرول
     --------------------------------------------------------- */
  var revealables = [].slice.call(document.querySelectorAll('.rv'));

  function showAll() {
    revealables.forEach(function (el) { el.classList.add('rv-in'); });
  }

  if (reduce || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('rv-in');
        revObs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -70px' });

    revealables.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 4, 3) * 60 + 'ms';
      revObs.observe(el);
    });

    // اگر به هر دلیل ناظر شلیک نکرد، محتوا نباید نامرئی بماند
    setTimeout(function () {
      if (!document.querySelector('.rv-in')) showAll();
    }, 2500);
  }

  /* ---------------------------------------------------------
     گزینه‌ی فعال منو بر اساس بخشی که در قاب است
     --------------------------------------------------------- */
  var navLinks = [].slice.call(document.querySelectorAll('.nav-link'));
  var sectionIds = navLinks
    .map(function (a) { return a.getAttribute('href'); })
    .filter(function (h) { return h && h.charAt(0) === '#'; });

  var sections = sectionIds
    .map(function (id) { return document.querySelector(id); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = '#' + entry.target.id;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'page');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { navObs.observe(s); });
  }

  /* ---------------------------------------------------------
     منوی موبایل
     --------------------------------------------------------- */
  var burger = document.getElementById('burger');
  var overlay = document.getElementById('overlay');
  var sheet = document.getElementById('mobileMenu');

  if (burger && overlay && sheet) {
    var isOpen = function () { return burger.getAttribute('aria-expanded') === 'true'; };

    var openMenu = function () {
      overlay.hidden = false;
      sheet.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'بستن منو');
      document.body.classList.add('menu-open');
    };

    var closeMenu = function () {
      overlay.hidden = true;
      sheet.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'باز کردن منو');
      document.body.classList.remove('menu-open');
    };

    burger.addEventListener('click', function () {
      if (isOpen()) closeMenu(); else openMenu();
    });
    overlay.addEventListener('click', closeMenu);
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closeMenu();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 760 && isOpen()) closeMenu();
    });
  }

  /* ---------------------------------------------------------
     سال در پاورقی
     --------------------------------------------------------- */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().toLocaleDateString('fa-IR', { year: 'numeric' });

  /* ابزار بررسی */
  window.Site = {
    stats: values.length,
    works: document.querySelectorAll('.work').length,
    revealables: revealables.length,
    revealed: function () { return document.querySelectorAll('.rv-in').length; }
  };
})();

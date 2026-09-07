/* =============================================================
   space-3d.js — فضای شناور سه‌بعدی صفحه‌ی اصلی

   این فایل صاحب کل حرکت این صفحه است و جای js/ui-motion.js را
   می‌گیرد. دلیلش: ui-motion.js روی همان ویژگی transform می‌نوشت
   و هر افکت سه‌بعدی را خنثی می‌کرد.

   سه سیستم:
     ۱. دوربین عمق  — اسکرول، بخش‌ها را در محور Z جابه‌جا می‌کند
     ۲. فیزیک ذرات  — برخورد واقعی با جعبه‌ی المان‌های صفحه
     ۳. چرخش نسبت به موس + ظاهرشدن

   بدون هیچ کتابخانه‌ی خارجی.
   ============================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var coarse = window.matchMedia('(max-width: 760px)').matches;

  document.documentElement.classList.add('space-enabled');

  /* =============================================================
     ۱. دوربین عمق — اسکرول به‌عنوان حرکت در فضا
     ============================================================= */
  var SpaceCamera = (function () {
    var items = [];

    function collect() {
      items = [].slice.call(document.querySelectorAll('[data-space]')).map(function (el) {
        return {
          el: el,
          // ضریب عمق: هرچه بزرگ‌تر، المان دورتر و حرکتش شدیدتر
          depth: parseFloat(el.dataset.space) || 1
        };
      });
    }

    function update() {
      var vh = window.innerHeight;
      var mid = vh / 2;

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var r = it.el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue; // خیلی دور، رد شو

        // t = ۰ وقتی المان وسط قاب است، مثبت وقتی پایین‌تر، منفی وقتی بالاتر
        var t = (r.top + r.height / 2 - mid) / vh;
        var ad = Math.abs(t);

        // پایین قاب: هنوز دور است و نزدیک می‌شود.
        // بالای قاب: از کنار دوربین رد شده و جلو می‌آید.
        var z = (t > 0 ? -t * 460 : -t * 150) * it.depth;

        // چرخش خفیف حول محور افقی، انگار صفحه در فضا معلق است
        var rx = -t * 7 * it.depth;

        // محو و تار شدن فقط در فاصله‌های دور، تا متن وسط قاب همیشه خوانا بماند
        var fade = Math.max(0, ad - 0.42);
        var op = Math.max(0, 1 - fade * 1.9);
        var blur = Math.min(6, fade * 7);

        it.el.style.setProperty('--sz', z.toFixed(1) + 'px');
        it.el.style.setProperty('--srx', rx.toFixed(2) + 'deg');
        it.el.style.setProperty('--sop', op.toFixed(3));
        it.el.style.setProperty('--sblur', blur.toFixed(2) + 'px');
      }
    }

    return { collect: collect, update: update, count: function () { return items.length; } };
  })();

  /* =============================================================
     ۲. فیزیک — ذرات شناور که با المان‌های واقعی صفحه برخورد می‌کنند
     ============================================================= */
  var Physics = (function () {
    var canvas, ctx, particles = [], obstacles = [];
    var w = 0, h = 0, dpr = 1;
    var pointer = { x: -9999, y: -9999, active: false };
    var running = false;

    // المان‌هایی که ذرات باید از آن‌ها کمانه کنند
    var OBSTACLE_SELECTOR = [
      '.hero-card', '.project-card', '.about-card', '.contact-card',
      '.resume-block', '.honor-card', '.hero-content h1', '.section-title'
    ].join(',');

    function makeCanvas() {
      canvas = document.createElement('canvas');
      canvas.className = 'space-field';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* جعبه‌ی المان‌ها را در مختصات سند ذخیره می‌کنیم تا هر فریم
       فقط scrollY را کم کنیم و layout را دوباره وادار به محاسبه نکنیم. */
    function measureObstacles() {
      var sy = window.scrollY || window.pageYOffset;
      var sx = window.scrollX || window.pageXOffset;
      obstacles = [].slice.call(document.querySelectorAll(OBSTACLE_SELECTOR)).map(function (el) {
        var r = el.getBoundingClientRect();
        return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
      });
    }

    /* چگالی بر اساس مساحت قاب حساب می‌شود، نه یک عدد ثابت —
       وگرنه روی نمایشگر بزرگ فضا خالی به نظر می‌رسد. */
    function targetCount() {
      // مهم: تنگی قاب باید همین‌جا سنجیده شود، نه یک‌بار موقع بارگذاری.
      // قبلاً یک‌بار خوانده می‌شد و پنجره‌ای که کوچک باز شده بود
      // تا آخر با چگالی موبایل می‌ماند حتی وقتی بزرگش می‌کردی.
      var narrow = window.innerWidth <= 760;
      var area = w * h;
      var n = Math.round(area / (narrow ? 5200 : 3400));
      return Math.max(46, Math.min(narrow ? 110 : 240, n));
    }

    /* ذرات در چند خوشه متولد می‌شوند تا از همان ابتدا
       حالت نیمه‌منسجم داشته باشند، نه پخشِ کاملاً تصادفی. */
    function spawn() {
      var count = targetCount();
      var clusters = Math.max(3, Math.round(count / 26));
      var seeds = [];
      for (var c = 0; c < clusters; c++) {
        seeds.push({ x: (0.12 + Math.random() * 0.76) * w,
                     y: (0.12 + Math.random() * 0.76) * h });
      }

      particles = [];
      for (var i = 0; i < count; i++) {
        var s = seeds[i % clusters];
        var ang = Math.random() * 6.2832;
        var rad = Math.pow(Math.random(), 0.65) * 210;
        particles.push({
          x: Math.min(w - 4, Math.max(4, s.x + Math.cos(ang) * rad)),
          y: Math.min(h - 4, Math.max(4, s.y + Math.sin(ang) * rad)),
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: 1 + Math.random() * 1.9,
          // عمق مجازی: ذرات دورتر کندتر و کم‌رنگ‌ترند
          d: 0.4 + Math.random() * 0.6
        });
      }
    }

    function collide(p) {
      var sy = window.scrollY || window.pageYOffset;
      for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        var oy = o.y - sy;
        if (oy > h || oy + o.h < 0) continue; // خارج از قاب

        // نزدیک‌ترین نقطه‌ی مستطیل به مرکز ذره
        var cx = p.x < o.x ? o.x : (p.x > o.x + o.w ? o.x + o.w : p.x);
        var cy = p.y < oy ? oy : (p.y > oy + o.h ? oy + o.h : p.y);
        var dx = p.x - cx, dy = p.y - cy;
        var d2 = dx * dx + dy * dy;
        var rad = p.r + 1.5;

        if (d2 < rad * rad) {
          var d = Math.sqrt(d2) || 0.0001;
          var nx = dx / d, ny = dy / d;

          // اگر مرکز ذره داخل مستطیل افتاده، از نزدیک‌ترین ضلع بیرونش بیاور
          if (d2 < 0.0001) {
            var left = p.x - o.x, right = o.x + o.w - p.x;
            var top = p.y - oy, bottom = oy + o.h - p.y;
            var m = Math.min(left, right, top, bottom);
            nx = m === left ? -1 : (m === right ? 1 : 0);
            ny = m === top ? -1 : (m === bottom ? 1 : 0);
          }

          // بیرون راندن + بازتاب سرعت با کمی اتلاف انرژی
          p.x = cx + nx * rad;
          p.y = cy + ny * rad;
          var dot = p.vx * nx + p.vy * ny;
          p.vx = (p.vx - 2 * dot * nx) * 0.72;
          p.vy = (p.vy - 2 * dot * ny) * 0.72;
        }
      }
    }

    var accX = [], accY = [], accN = [];

    function step() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      var isDark = document.documentElement.dataset.theme !== 'light';
      var base = isDark ? '160, 175, 255' : '70, 90, 200';
      var n = particles.length;
      var LINK = 128, LINK2 = LINK * LINK;
      var SEP = 42, SEP2 = SEP * SEP;
      var i, j, a, b, dx, dy, d2, d;

      /* ---------- گذر اول: همسایه‌ها، خطوط پیوند و نیروهای گله‌ای ----------
         همین پیوندها هستند که فضا را «یک تکه» نشان می‌دهند؛ ذرات
         دیگر نقطه‌های جدا نیستند بلکه یک شبکه‌ی به‌هم‌پیوسته‌اند. */
      for (i = 0; i < n; i++) { accX[i] = 0; accY[i] = 0; accN[i] = 0; }

      ctx.lineWidth = 1;
      for (i = 0; i < n; i++) {
        a = particles[i];
        for (j = i + 1; j < n; j++) {
          b = particles[j];
          dx = b.x - a.x; dy = b.y - a.y;
          d2 = dx * dx + dy * dy;
          if (d2 > LINK2 || d2 < 0.0001) continue;
          d = Math.sqrt(d2);

          var la = (1 - d / LINK) * (isDark ? 0.18 : 0.13) * Math.min(a.d, b.d);
          ctx.strokeStyle = 'rgba(' + base + ',' + la.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          accX[i] += b.x; accY[i] += b.y; accN[i]++;
          accX[j] += a.x; accY[j] += a.y; accN[j]++;

          // دافعه‌ی نزدیک تا روی هم جمع نشوند
          if (d2 < SEP2) {
            var sf = (1 - d / SEP) * 0.16;
            a.vx -= dx / d * sf; a.vy -= dy / d * sf;
            b.vx += dx / d * sf; b.vy += dy / d * sf;
          }
        }
      }

      /* ---------- گذر دوم: حرکت و رسم ---------- */
      for (i = 0; i < n; i++) {
        var p = particles[i];

        /* چسبندگی به مرکز همسایه‌ها — سازنده‌ی حالت نیمه‌منسجم.
           نیرو سقف دارد: بدون سقف با فاصله رشد می‌کرد و کل میدان
           در چند گلوله‌ی فشرده جمع می‌شد به‌جای یک شبکه‌ی باز. */
        if (accN[i]) {
          var tx = accX[i] / accN[i] - p.x;
          var ty = accY[i] / accN[i] - p.y;
          var td = Math.sqrt(tx * tx + ty * ty) || 1;
          var cf = Math.min(td * 0.0011, 0.030);
          p.vx += (tx / td) * cf;
          p.vy += (ty / td) * cf;
        } else {
          // ذره‌ی تنها خیلی آرام به میدان برمی‌گردد تا گوشه‌ها خالی نماند
          p.vx += (w / 2 - p.x) * 0.00005;
          p.vy += (h / 2 - p.y) * 0.00005;
        }

        // نیروی دافعه‌ی نشانگر
        if (pointer.active) {
          var dx = p.x - pointer.x, dy = p.y - pointer.y;
          var dist2 = dx * dx + dy * dy;
          if (dist2 < 26000 && dist2 > 0.01) {
            var dist = Math.sqrt(dist2);
            var force = (1 - dist / 161) * 0.85 * p.d;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // رانش آرام + میرایی — کم نگه داشته می‌شود تا خوشه‌ها نپاشند
        p.vx += (Math.random() - 0.5) * 0.008;
        p.vy += (Math.random() - 0.5) * 0.008;
        p.vx *= 0.986;
        p.vy *= 0.986;

        // سقف سرعت
        var sp = Math.hypot(p.vx, p.vy);
        if (sp > 2.6) { p.vx = p.vx / sp * 2.6; p.vy = p.vy / sp * 2.6; }

        p.x += p.vx * p.d;
        p.y += p.vy * p.d;

        // برخورد با المان‌های واقعی صفحه
        collide(p);

        // کمانه از لبه‌های قاب
        if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx) * 0.8; }
        if (p.x > w - p.r) { p.x = w - p.r; p.vx = -Math.abs(p.vx) * 0.8; }
        if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy) * 0.8; }
        if (p.y > h - p.r) { p.y = h - p.r; p.vy = -Math.abs(p.vy) * 0.8; }

        var alpha = (isDark ? 0.5 : 0.34) * p.d;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.d + 0.4, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + base + ',' + alpha.toFixed(3) + ')';
        ctx.fill();
      }

      requestAnimationFrame(step);
    }

    /* ضربه به فضا — تایپ‌شدن حرف ذرات را پس می‌راند،
       پاک‌شدن (strength منفی) آن‌ها را به سمت مکان‌نما می‌کشد. */
    function pulse(x, y, strength) {
      var reach = 190;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var dx = p.x - x, dy = p.y - y;
        var d2 = dx * dx + dy * dy;
        if (d2 > reach * reach || d2 < 0.01) continue;
        var d = Math.sqrt(d2);
        var f = (1 - d / reach) * strength * p.d;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
    }

    function init() {
      makeCanvas();
      resize();
      measureObstacles();
      spawn();
      running = true;
      requestAnimationFrame(step);

      window.addEventListener('pointermove', function (e) {
        pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
      }, { passive: true });

      window.addEventListener('pointerleave', function () { pointer.active = false; });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { running = false; }
        else if (!running) { running = true; requestAnimationFrame(step); }
      });
    }

    return {
      init: init,
      pulse: pulse,
      ready: function () { return running; },
      resize: function () {
        if (!canvas) return;
        var prev = particles.length;
        resize();
        measureObstacles();
        // چگالی به مساحت قاب بسته است؛ اگر قاب زیاد عوض شد دوباره بچین
        if (Math.abs(targetCount() - prev) > prev * 0.15) spawn();
      },
      remeasure: measureObstacles,
      particleCount: function () { return particles.length; },
      obstacleCount: function () { return obstacles.length; },
      // میانگین تندی ذرات — برای سنجش اثر ضربه‌ها
      speed: function () {
        if (!particles.length) return 0;
        var s = 0;
        for (var i = 0; i < particles.length; i++) {
          s += Math.hypot(particles[i].vx, particles[i].vy);
        }
        return s / particles.length;
      }
    };
  })();

  /* =============================================================
     ماشین‌تحریر — هر ضربه‌ی کلید فضا را تکان می‌دهد
     ============================================================= */
  function initTypewriter() {
    var out = document.querySelector('[data-typewriter]');
    if (!out) return;

    var caret = out.parentElement.querySelector('.type-caret');
    var lines = [];
    try {
      lines = JSON.parse(out.dataset.typewriter);
    } catch (e) {
      return;
    }
    if (!lines.length) return;

    if (reduceMotion) {
      out.textContent = lines[0];
      return;
    }

    var li = 0, ci = 0, deleting = false;

    function shake(strength) {
      if (!Physics.ready || !Physics.ready()) return;
      var node = caret || out;
      var r = node.getBoundingClientRect();
      if (!r.width && !r.height) return;
      Physics.pulse(r.left + r.width / 2, r.top + r.height / 2, strength);
    }

    function tick() {
      var full = lines[li];

      if (!deleting) {
        ci++;
        out.textContent = full.slice(0, ci);
        shake(1.15);                       // تایپ: ذرات را پس می‌راند
        if (ci >= full.length) {
          deleting = true;
          return setTimeout(tick, 1700);   // مکث روی جمله‌ی کامل
        }
        return setTimeout(tick, 52 + Math.random() * 58);
      }

      ci--;
      out.textContent = full.slice(0, ci);
      shake(-0.9);                         // پاک‌شدن: ذرات را به داخل می‌کشد
      if (ci <= 0) {
        deleting = false;
        li = (li + 1) % lines.length;
        return setTimeout(tick, 420);
      }
      return setTimeout(tick, 26 + Math.random() * 22);
    }

    setTimeout(tick, 900);
  }

  /* =============================================================
     ۳. ظاهرشدن، چرخش نسبت به موس، نوار پیشرفت
     ============================================================= */
  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      [].forEach.call(items, function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px' });
    [].forEach.call(items, function (el, i) {
      el.style.setProperty('--reveal-delay', Math.min(i % 6, 5) * 60 + 'ms');
      io.observe(el);
    });
  }

  function initTilt() {
    [].forEach.call(document.querySelectorAll('[data-layer]'), function (l) {
      l.style.setProperty('--layer', l.dataset.layer || 0);
    });
    if (reduceMotion || !finePointer) return;

    [].forEach.call(document.querySelectorAll('[data-tilt]'), function (card) {
      var max = parseFloat(card.dataset.tiltMax || '8');
      var frame = null;

      card.addEventListener('pointermove', function (ev) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          var r = card.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width;
          var py = (ev.clientY - r.top) / r.height;
          card.style.setProperty('--ry', ((px - 0.5) * max * 2).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - py) * max * 2).toFixed(2) + 'deg');
          card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
          frame = null;
        });
      });

      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
        if (frame) { cancelAnimationFrame(frame); frame = null; }
      });
    });
  }

  function initControls() {
    [].forEach.call(document.querySelectorAll('button, .button'), function (c) {
      c.classList.add('ui-control');
    });
  }

  function initCounters() {
    var nodes = document.querySelectorAll('[data-count-to]');
    if (!nodes.length || reduceMotion || !('IntersectionObserver' in window)) return;
    function fa(v) { return String(v).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var target = parseInt(e.target.dataset.countTo, 10);
        if (!Number.isFinite(target)) return;
        var t0 = performance.now();
        (function tick(now) {
          var p = Math.min((now - t0) / 900, 1);
          e.target.textContent = fa(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.5 });
    [].forEach.call(nodes, function (n) { io.observe(n); });
  }

  /* ---------- حلقه‌ی اصلی اسکرول ---------- */
  function initScrollLoop() {
    var bar = document.querySelector('.scroll-progress span');
    var ticking = false;
    var settle = null;

    function frame() {
      if (!reduceMotion) SpaceCamera.update();
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? (window.scrollY || window.pageYOffset) / max : 0;
        bar.style.setProperty('--progress', (ratio * 100).toFixed(2) + '%');
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
      // بعد از توقف اسکرول، جعبه‌ی المان‌ها را دوباره اندازه بگیر
      clearTimeout(settle);
      settle = setTimeout(Physics.remeasure, 140);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      SpaceCamera.collect();
      Physics.resize();
      frame();
    });
    frame();
  }

  function init() {
    SpaceCamera.collect();
    initReveal();
    initTilt();
    initControls();
    initCounters();
    initScrollLoop();
    if (!reduceMotion) Physics.init();
    initTypewriter();

    // برای تست و اشکال‌زدایی
    window.AaalSpace = {
      camera: SpaceCamera,
      physics: Physics,
      reduceMotion: reduceMotion
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

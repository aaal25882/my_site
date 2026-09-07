/* =============================================================
   labyrinth.js — هزارتوی پروژه‌ها

   یک صحنه‌ی سه‌بعدی WebGL: حلقه‌های هم‌مرکز که یک هزارتو می‌سازند،
   و روی آن هشت نشانگر نورانی — هر پروژه با رنگ خودش. با بردن موس
   روی هر نشانگر، اطلاعات آن پروژه نمایان می‌شود.

   داده‌ها از روی همان کارت‌های موجود در صفحه خوانده می‌شوند، پس
   یک منبع حقیقت بیشتر وجود ندارد؛ کارت‌ها هم برای موبایل و حالتی
   که WebGL نیست سر جایشان می‌مانند.

   Three.js فقط وقتی دانلود می‌شود که کاربر واقعاً به این بخش برسد.
   ============================================================= */
(function () {
  'use strict';

  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';

  var COLORS = {
    aora:      '#7c3aed',
    charity:   '#14b8a6',
    domestika: '#f97316',
    resume:    '#0ea5e9',
    china:     '#f43f5e',
    tooper:    '#65a30d',
    excel:     '#10b981',
    motion:    '#db2777'
  };

  var mount = document.querySelector('[data-labyrinth]');
  if (!mount) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  // روی صفحه‌ی باریک، بدون WebGL، یا با prefers-reduced-motion
  // هزارتو ساخته نمی‌شود و فقط کارت‌ها می‌مانند.
  if (reduceMotion || !webglOK() || window.innerWidth < 760) {
    mount.setAttribute('hidden', '');
    return;
  }

  /* ---------- خواندن پروژه‌ها از روی کارت‌های موجود ---------- */
  function readProjects() {
    return [].slice.call(document.querySelectorAll('.project-card')).map(function (card) {
      var img = card.querySelector('.project-image');
      var link = card.querySelector('.project-link');
      var desc = card.querySelector('.project-content > p');
      return {
        title: (card.querySelector('h3') || {}).textContent || '',
        cat: (card.querySelector('.project-category') || {}).textContent || '',
        desc: desc ? desc.textContent.trim().replace(/\s+/g, ' ') : '',
        mark: (card.querySelector('.project-mark') || {}).textContent || '',
        stack: [].slice.call(card.querySelectorAll('.project-stack li'))
                 .map(function (li) { return li.textContent; }),
        href: link ? link.getAttribute('href') : null,
        linkText: link ? link.textContent.trim() : null,
        color: COLORS[img ? img.dataset.scheme : ''] || '#7c3aed'
      };
    });
  }

  var projects = readProjects();
  if (!projects.length) { mount.setAttribute('hidden', ''); return; }

  /* ---------- بارگذاری تنبل Three.js ---------- */
  var loading = false;
  function loadThree(cb) {
    if (window.THREE) return cb();
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = THREE_SRC;
    s.async = true;
    s.onload = function () { cb(); };
    s.onerror = function () { mount.setAttribute('hidden', ''); };
    document.head.appendChild(s);
  }

  /* شروع وقتی کاربر به این بخش نزدیک می‌شود.
     فقط به IntersectionObserver تکیه نمی‌کنیم: در بعضی محیط‌ها
     (پنل‌های پیش‌نمایش، تب پس‌زمینه، صفحه‌ای که هنوز رسم نشده)
     اصلاً فراخوانی نمی‌شود و صحنه هرگز ساخته نمی‌شد. اندازه‌گیری
     مستقیم به‌عنوان تور ایمنی کنارش می‌ماند. */
  var started = false;
  var io = null;

  function stopWatching() {
    if (io) { io.disconnect(); io = null; }
    window.removeEventListener('scroll', maybeStart);
    window.removeEventListener('resize', maybeStart);
    clearInterval(poll);
  }

  function maybeStart() {
    if (started) return;
    var r = mount.getBoundingClientRect();
    if (r.top < window.innerHeight + 300 && r.bottom > -300) {
      started = true;
      stopWatching();
      loadThree(build);
    }
  }

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { maybeStart(); return; }
      }
    }, { rootMargin: '300px' });
    io.observe(mount);
  }

  var poll = setInterval(maybeStart, 600);
  window.addEventListener('scroll', maybeStart, { passive: true });
  window.addEventListener('resize', maybeStart);
  maybeStart();

  /* =============================================================
     ساخت صحنه
     ============================================================= */
  function build() {
    var stage = mount.querySelector('.lab-stage');
    var panel = mount.querySelector('.lab-panel');
    var hintEl = mount.querySelector('.lab-hint');

    var W = stage.clientWidth, H = stage.clientHeight;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x080d1a, 34, 78);

    var camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);

    /* ---------- نور ---------- */
    scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x05070f, 0.75));
    var key = new THREE.DirectionalLight(0xaebcff, 0.85);
    key.position.set(14, 22, 10);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x5f7bff, 0.5);
    rim.position.set(-16, 9, -12);
    scene.add(rim);

    /* ---------- کف ---------- */
    var floor = new THREE.Mesh(
      new THREE.CircleGeometry(26, 96),
      new THREE.MeshStandardMaterial({ color: 0x0d1426, roughness: 1, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.35;
    scene.add(floor);

    /* ---------- حلقه‌های هزارتو ----------
       هر حلقه یک کمان ناقص است؛ همان شکافِ باقی‌مانده
       چیزی است که مسیر هزارتو را می‌سازد. */
    var labGroup = new THREE.Group();
    var RINGS = 8;
    for (var i = 0; i < RINGS; i++) {
      var radius = 3.4 + i * 2.15;
      var gap = 0.42 + Math.random() * 0.5;              // اندازه‌ی شکاف
      var geo = new THREE.TorusGeometry(radius, 0.30, 10, 150, Math.PI * 2 - gap);
      var shade = 0x16203a + i * 0x000308;
      var mat = new THREE.MeshStandardMaterial({
        color: shade,
        roughness: .82,
        metalness: .18,
        emissive: 0x0a1020,
        emissiveIntensity: .5
      });
      var ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.random() * Math.PI * 2;      // چرخش شکاف
      ring.position.y = 0.1 + i * 0.055;                  // پلکانی، مثل تراس
      labGroup.add(ring);
    }
    scene.add(labGroup);

    /* ---------- بافت درخشش نشانگرها ---------- */
    function glowTexture() {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }
    var glowTex = glowTexture();

    /* ---------- نشانگر هر پروژه ---------- */
    var markers = [];
    projects.forEach(function (p, idx) {
      var col = new THREE.Color(p.color);
      var ringIdx = 1 + (idx % (RINGS - 2));
      var radius = 3.4 + ringIdx * 2.15;
      var angle = (idx / projects.length) * Math.PI * 2 + 0.42;

      var group = new THREE.Group();
      group.position.set(
        Math.cos(angle) * radius,
        0.95 + ringIdx * 0.055,
        Math.sin(angle) * radius
      );

      var core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.42, 1),
        new THREE.MeshBasicMaterial({ color: col })
      );
      group.add(core);

      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex,
        color: col,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: .85
      }));
      halo.scale.set(3.6, 3.6, 1);
      group.add(halo);

      // ستون نور تا کف، تا جای نشانگر روی هزارتو خوانده شود
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .32 })
      );
      beam.position.y = -0.95;
      group.add(beam);

      // کره‌ی نامرئیِ بزرگ‌تر، فقط برای اینکه گرفتن نشانگر با موس آسان باشد
      var hit = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData.index = idx;
      group.add(hit);

      group.userData = { index: idx, baseY: group.position.y, phase: idx * 0.8, core: core, halo: halo };
      scene.add(group);
      markers.push({ group: group, hit: hit, data: p });
    });

    /* ---------- دوربین: چرخش با درگ + پیشروی با اسکرول صفحه ---------- */
    var camState = { theta: -0.6, phi: 0.86, radius: 34, dragTheta: 0, dragPhi: 0 };

    function placeCamera() {
      var phi = Math.min(1.32, Math.max(0.28, camState.phi + camState.dragPhi));
      var theta = camState.theta + camState.dragTheta;
      camera.position.set(
        camState.radius * Math.sin(phi) * Math.cos(theta),
        camState.radius * Math.cos(phi),
        camState.radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(0, 0, 0);
    }

    var dragging = false, lastX = 0, lastY = 0;
    stage.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('is-dragging');
    });
    stage.addEventListener('pointerup', function (e) {
      dragging = false;
      stage.classList.remove('is-dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointerleave', function () {
      dragging = false;
      stage.classList.remove('is-dragging');
    });

    var pointer = new THREE.Vector2(-10, -10);
    var hasPointer = false;

    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      hasPointer = true;

      if (dragging) {
        camState.dragTheta -= (e.clientX - lastX) * 0.005;
        camState.dragPhi -= (e.clientY - lastY) * 0.004;
        lastX = e.clientX; lastY = e.clientY;
        if (hintEl) hintEl.classList.add('is-faded');
      }
    });

    /* اسکرول صفحه دوربین را دور هزارتو می‌چرخاند — بدون
       ربودن اسکرول، چون صفحه طبیعی خودش را ادامه می‌دهد. */
    function scrollDrive() {
      var r = mount.getBoundingClientRect();
      var vh = window.innerHeight;
      var prog = 1 - (r.top + r.height / 2) / (vh + r.height / 2);
      prog = Math.min(1.2, Math.max(-0.2, prog));
      camState.theta = -0.6 + prog * 1.15;
      camState.radius = 36 - prog * 9;
    }
    window.addEventListener('scroll', scrollDrive, { passive: true });
    scrollDrive();

    /* ---------- پنل اطلاعات ---------- */
    var raycaster = new THREE.Raycaster();
    var activeIdx = -1;

    function showPanel(m) {
      var p = m.data;
      panel.innerHTML =
        '<span class="lab-panel-cat" style="color:' + p.color + '">' + esc(p.cat) + '</span>' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p>' + esc(p.desc) + '</p>' +
        (p.stack.length
          ? '<ul class="lab-panel-stack">' +
            p.stack.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
            '</ul>'
          : '') +
        (p.href ? '<span class="lab-panel-link" style="color:' + p.color + '">' +
                  esc(p.linkText || 'مشاهده') + ' ↗</span>' : '');
      panel.style.setProperty('--accent', p.color);
      panel.classList.add('is-on');
    }

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function positionPanel(group) {
      var v = group.position.clone().project(camera);
      var r = stage.getBoundingClientRect();
      var x = (v.x * 0.5 + 0.5) * r.width;
      var y = (-v.y * 0.5 + 0.5) * r.height;
      panel.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      // اگر نشانگر سمت راست قاب است، پنل به چپش برود و برعکس
      panel.classList.toggle('flip-x', x > r.width * 0.58);
      panel.classList.toggle('flip-y', y > r.height * 0.62);
    }

    stage.addEventListener('click', function () {
      if (activeIdx < 0) return;
      var href = markers[activeIdx].data.href;
      if (!href) return;
      if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
      else window.location.href = href;
    });

    stage.addEventListener('pointerleave', function () {
      hasPointer = false;
      activeIdx = -1;
      panel.classList.remove('is-on');
      stage.classList.remove('is-hot');
    });

    /* ---------- حلقه‌ی رسم ---------- */
    var clock = new THREE.Clock();

    /* وقتی صحنه از قاب بیرون است رسم نمی‌کنیم.
       اینجا هم به IntersectionObserver تکیه نمی‌کنیم چون در بعضی
       محیط‌ها فراخوانی نمی‌شود و حلقه برای همیشه متوقف می‌ماند. */
    var visible = true;
    var visCheck = 0;
    function updateVisible() {
      var r = mount.getBoundingClientRect();
      visible = r.top < window.innerHeight + 200 && r.bottom > -200;
    }

    function frame() {
      requestAnimationFrame(frame);
      if (++visCheck % 12 === 0) updateVisible();   // هر ۱۲ فریم، نه هر فریم
      if (!visible) return;

      var t = clock.getElapsedTime();

      // بالا و پایین رفتن آرام نشانگرها
      markers.forEach(function (m) {
        var u = m.group.userData;
        m.group.position.y = u.baseY + Math.sin(t * 1.15 + u.phase) * 0.22;
        u.core.rotation.y += 0.011;
        u.core.rotation.x += 0.006;
      });

      labGroup.rotation.y += 0.0006;   // چرخش بسیار آرام کل هزارتو

      placeCamera();

      // تشخیص نشانگر زیر موس
      if (hasPointer && !dragging) {
        raycaster.setFromCamera(pointer, camera);
        var hits = raycaster.intersectObjects(markers.map(function (m) { return m.hit; }), false);
        var idx = hits.length ? hits[0].object.userData.index : -1;

        if (idx !== activeIdx) {
          activeIdx = idx;
          if (idx >= 0) {
            showPanel(markers[idx]);
            stage.classList.add('is-hot');
            if (hintEl) hintEl.classList.add('is-faded');
          } else {
            panel.classList.remove('is-on');
            stage.classList.remove('is-hot');
          }
        }
        if (activeIdx >= 0) positionPanel(markers[activeIdx].group);
      }

      // نشانگر فعال بزرگ‌تر و پرنورتر می‌شود
      markers.forEach(function (m, i) {
        var on = i === activeIdx;
        var target = on ? 5.2 : 3.6;
        var s = m.group.userData.halo.scale.x;
        m.group.userData.halo.scale.setScalar(s + (target - s) * 0.14);
        m.group.userData.core.scale.setScalar(
          m.group.userData.core.scale.x + ((on ? 1.45 : 1) - m.group.userData.core.scale.x) * 0.14
        );
      });

      renderer.render(scene, camera);
    }
    frame();

    /* ---------- تغییر اندازه ---------- */
    window.addEventListener('resize', function () {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    mount.classList.add('is-ready');

    window.AaalLabyrinth = {
      markers: markers.length,
      rings: RINGS,
      hovered: function () { return activeIdx; },
      colors: projects.map(function (p) { return p.color; }),

      /* ابزار بررسی — جای هر نشانگر روی صفحه (مختصات NDC) */
      markerScreen: function () {
        return markers.map(function (m) {
          var v = m.group.position.clone().project(camera);
          return {
            title: m.data.title,
            color: m.data.color,
            x: +v.x.toFixed(3),
            y: +v.y.toFixed(3),
            onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1
          };
        });
      },

      /* یک فریم را دستی اجرا می‌کند و می‌گوید زیر آن نقطه چه چیزی هست.
         در محیط‌هایی که rAF اجرا نمی‌شود تنها راه بررسی صحنه است. */
      probe: function (nx, ny) {
        if (typeof nx === 'number') { pointer.set(nx, ny); hasPointer = true; }
        placeCamera();
        raycaster.setFromCamera(pointer, camera);
        var hits = raycaster.intersectObjects(
          markers.map(function (m) { return m.hit; }), false);
        var idx = hits.length ? hits[0].object.userData.index : -1;
        if (idx >= 0) { showPanel(markers[idx]); positionPanel(markers[idx].group); }
        else panel.classList.remove('is-on');
        renderer.render(scene, camera);
        // بلافاصله پس از رسم خوانده می‌شود، پیش از پاک‌شدن بافر
        var png = renderer.domElement.toDataURL('image/png');
        return {
          hovered: idx,
          title: idx >= 0 ? markers[idx].data.title : null,
          panelOn: panel.classList.contains('is-on'),
          panelText: panel.textContent.slice(0, 70),
          pngBytes: png.length
        };
      }
    };
  }
})();

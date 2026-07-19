(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.button, .role-card a, .game-option, .hunt-promo button').forEach((element) => {
    element.classList.add('interactive-control');
    element.addEventListener('pointerdown', (event) => {
      if (reducedMotion) return;
      const rect = element.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'control-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      element.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  });

  const revealElements = document.querySelectorAll('[data-reveal]');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    revealElements.forEach((element) => observer.observe(element));
  }

  const routeItems = [...document.querySelectorAll('.route-item')];
  let routeIndex = 0;
  if (routeItems.length && !reducedMotion) {
    window.setInterval(() => {
      routeIndex = (routeIndex + 1) % routeItems.length;
      routeItems.forEach((item, index) => {
        item.classList.toggle('active', index === routeIndex);
        item.classList.toggle('complete', index < routeIndex);
      });
    }, 1900);
  }

  const STORAGE_KEY = 'aaal258_hunt_reward_v1';
  const cart = document.getElementById('hunt-cart');
  const cartStatus = document.getElementById('hunt-cart-status');
  const tokenCount = document.getElementById('hunt-token-count');
  const toast = document.getElementById('hunt-toast');
  const modal = document.getElementById('coupon-modal');
  const couponCodeNode = document.getElementById('coupon-code');
  const copyButton = document.getElementById('copy-coupon');
  const guideButton = document.getElementById('hunt-guide');
  if (!cart || !modal) return;

  const productIcons = ['🎧', '⌚', '📷', '🧸', '⌨️', '💡', '🎮', '👜'];
  let product = null;
  let dragOffset = { x: 0, y: 0 };
  let dragging = false;
  let justDropped = false;

  const getReward = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  };

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  };

  const openCoupon = (reward) => {
    couponCodeNode.textContent = reward.code;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  const closeCoupon = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  const updateRewardUI = () => {
    const reward = getReward();
    if (reward?.code) {
      tokenCount.textContent = '۱';
      cartStatus.textContent = 'توکن ۵٪ آماده استفاده است';
      cart.classList.add('has-token');
      cart.setAttribute('aria-label', `سبد جایزه؛ کد تخفیف ${reward.code}`);
    } else {
      tokenCount.textContent = '۰';
      cartStatus.textContent = 'کالای مخفی را اینجا بینداز';
      cart.classList.remove('has-token');
    }
  };

  const createCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 6; i += 1) suffix += chars[Math.floor(Math.random() * chars.length)];
    return `AAAL5-${suffix}`;
  };

  const awardReward = () => {
    const existing = getReward();
    if (existing?.code) {
      openCoupon(existing);
      showToast('توکن تخفیف قبلاً برای این مرورگر صادر شده است.');
      return;
    }
    const reward = {
      code: createCode(),
      discountPercent: 5,
      maxOrders: 1,
      status: 'available',
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reward));
    updateRewardUI();
    openCoupon(reward);
  };

  const isOverCart = (clientX, clientY) => {
    const rect = cart.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  const finishDrop = (clientX, clientY) => {
    if (!product) return;
    dragging = false;
    justDropped = true;
    window.setTimeout(() => { justDropped = false; }, 120);
    product.classList.remove('is-dragging');
    cart.classList.remove('is-target');
    if (isOverCart(clientX, clientY)) {
      product.classList.add('is-found');
      window.setTimeout(() => product?.remove(), 480);
      awardReward();
      return;
    }
    product.style.left = product.dataset.homeLeft;
    product.style.top = product.dataset.homeTop;
    showToast('کالا را داخل سبد خرید پایین صفحه رها کن.');
  };

  const beginDrag = (event) => {
    if (!product || getReward()?.code) return;
    event.preventDefault();
    const rect = product.getBoundingClientRect();
    dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    dragging = true;
    product.classList.add('is-dragging');
    product.setPointerCapture?.(event.pointerId);
    product.style.left = `${rect.left}px`;
    product.style.top = `${rect.top}px`;
  };

  const moveDrag = (event) => {
    if (!dragging || !product) return;
    product.style.left = `${event.clientX - dragOffset.x}px`;
    product.style.top = `${event.clientY - dragOffset.y}px`;
    cart.classList.toggle('is-target', isOverCart(event.clientX, event.clientY));
  };

  const spawnProduct = () => {
    if (getReward()?.code) return;
    const hosts = [...document.querySelectorAll('main > section')].filter((section) => section.offsetHeight > 220);
    const host = hosts[Math.floor(Math.random() * hosts.length)];
    if (!host) return;
    const style = getComputedStyle(host);
    if (style.position === 'static') host.style.position = 'relative';

    product = document.createElement('button');
    product.type = 'button';
    product.className = 'hidden-product';
    product.setAttribute('aria-label', 'کالای مخفی؛ آن را داخل سبد خرید بکش');
    product.textContent = productIcons[Math.floor(Math.random() * productIcons.length)];

    const maxLeft = Math.max(40, host.clientWidth - 90);
    const maxTop = Math.max(80, host.clientHeight - 100);
    const left = Math.round(24 + Math.random() * Math.max(10, maxLeft - 48));
    const top = Math.round(40 + Math.random() * Math.max(20, maxTop - 70));
    product.style.left = `${left}px`;
    product.style.top = `${top}px`;
    product.dataset.homeLeft = `${left}px`;
    product.dataset.homeTop = `${top}px`;
    host.appendChild(product);

    product.addEventListener('pointerdown', beginDrag);
    product.addEventListener('pointermove', moveDrag);
    product.addEventListener('pointerup', (event) => finishDrop(event.clientX, event.clientY));
    product.addEventListener('pointercancel', (event) => finishDrop(event.clientX, event.clientY));
    product.addEventListener('click', () => {
      if (!dragging && !justDropped) showToast('کالا را نگه دار و به سبد خرید پایین صفحه بکش.');
    });
  };

  cart.addEventListener('click', () => {
    const reward = getReward();
    if (reward?.code) openCoupon(reward);
    else showToast('ابتدا کالای مخفی را در بخش‌های مختلف صفحه پیدا کن.');
  });

  cart.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cart.click();
    }
  });

  guideButton?.addEventListener('click', () => {
    if (getReward()?.code) {
      openCoupon(getReward());
      return;
    }
    showToast('در کل صفحه جست‌وجو کن؛ کالای کوچک را بگیر و داخل سبد ثابت پایین صفحه رها کن.');
  });

  document.querySelectorAll('[data-close-coupon]').forEach((node) => node.addEventListener('click', closeCoupon));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeCoupon(); });

  copyButton?.addEventListener('click', async () => {
    const code = couponCodeNode.textContent.trim();
    try {
      await navigator.clipboard.writeText(code);
      copyButton.textContent = 'کپی شد ✓';
      window.setTimeout(() => { copyButton.textContent = 'کپی کد'; }, 1800);
    } catch {
      showToast(`کد تخفیف: ${code}`);
    }
  });

  updateRewardUI();
  window.setTimeout(spawnProduct, 650);
})();

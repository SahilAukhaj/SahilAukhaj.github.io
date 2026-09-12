/* ==========================================================================
   Sahil Aukhaj — portfolio interactions
   Lenis smooth scroll + GSAP/ScrollTrigger animations, preloader, hero mask,
   horizontal work track and small UI helpers.
   - Content stays usable if the animation libraries fail to load (html.no-anim).
   - With "reduce motion" enabled in the OS, fades and counters remain but
     smooth scrolling, parallax and the pinned track are skipped.
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  // Helpers that do not depend on animation libraries
  initClock();
  initYear();
  initMenu();
  initCopy();
  const laptopVideo = initLaptopVideo();
  initQr();
  initFitText();

  if (!hasGsap) {
    root.classList.add('no-anim');
    window.__siteReady = true;
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  if (reduced) root.classList.add('reduced-motion');

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

  const lenis = reduced ? null : initLenis();
  initAnchors(lenis);
  window.__siteReady = true;

  const hero = heroIntro();
  runPreloader(() => {
    hero.play();
    const target = location.hash && document.querySelector(location.hash);
    if (target) {
      if (lenis) lenis.scrollTo(target, { immediate: true });
      else target.scrollIntoView();
    }
  });

  if (!reduced) heroScroll();
  wordsReveal();
  laptop();
  if (!reduced) workTrack();
  reveals();
  counters();

  ScrollTrigger.sort();
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* ---------------------------------------------------------------- Lenis */
  function initLenis() {
    if (typeof window.Lenis === 'undefined') return null;
    const instance = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    instance.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => instance.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return instance;
  }

  function initAnchors(smooth) {
    if (!smooth) return;
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const hash = link.getAttribute('href');
        const target = hash === '#top' ? 0 : document.querySelector(hash);
        if (target === null) return;
        event.preventDefault();
        smooth.scrollTo(target, { duration: 1.4 });
        if (hash !== '#top') history.replaceState(null, '', hash);
      });
    });
  }

  /* ------------------------------------------------------------ Preloader */
  function runPreloader(onReveal) {
    const pre = document.querySelector('.preloader');
    if (!pre) {
      root.classList.add('is-loaded');
      onReveal();
      return;
    }
    const fill = pre.querySelector('.preloader__fill');
    const countEl = pre.querySelector('[data-preloader-count]');
    const counter = { value: 0 };
    const render = () => { countEl.textContent = String(Math.round(counter.value)).padStart(3, '0'); };
    const finish = () => root.classList.add('is-loaded');

    if (reduced) {
      gsap.set(fill, { autoAlpha: 0 });
      gsap.timeline({ onComplete: finish })
        .to(counter, { value: 100, duration: .6, ease: 'none', onUpdate: render })
        .add(onReveal)
        .to(pre, { autoAlpha: 0, duration: .4 }, '<');
      return;
    }

    if (lenis) lenis.stop();

    const heroImg = document.querySelector('.stage__photo img');
    const imageReady = new Promise((resolve) => {
      if (!heroImg || heroImg.complete) return resolve();
      heroImg.addEventListener('load', resolve, { once: true });
      heroImg.addEventListener('error', resolve, { once: true });
    });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const assetsReady = Promise.race([Promise.all([imageReady, fontsReady]), wait(3500)]);

    const introDone = new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(fill, { clipPath: 'inset(28% 49% 28% 49%)', duration: 1, ease: 'expo.inOut' }, 0)
        .to(counter, { value: 74, duration: 1.1, ease: 'power2.out', onUpdate: render }, 0);
    });

    // Never keep visitors waiting on a slow asset
    Promise.race([Promise.all([assetsReady, introDone]), wait(6000)]).then(() => {
      gsap.timeline({ onComplete: finish })
        .to(counter, { value: 100, duration: .45, ease: 'power2.out', onUpdate: render })
        .to(fill, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'expo.inOut' }, '>-0.1')
        .add(() => {
          if (lenis) lenis.start();
          onReveal();
        }, '>-0.15')
        .to(pre, { autoAlpha: 0, duration: .5, ease: 'power1.out' }, '<');
    });
  }

  /* ----------------------------------------------------------------- Hero */
  function heroIntro() {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    if (reduced) {
      return tl
        .from('.stage__photo', { autoAlpha: 0, duration: 1 }, 0)
        .from('[data-hero-title], [data-hero-line], .stage__icon, .stage__foot', { autoAlpha: 0, duration: .8, stagger: .06 }, .1);
    }
    const tiles = gsap.utils.toArray('#stage-mask [data-tile]');
    return tl
      .from(tiles, { attr: { height: 0 }, duration: 1.7, stagger: { each: .09, from: 'center' } }, 0)
      .from('.stage__photo img', { scale: 1.3, duration: 2.4 }, 0)
      .from('[data-hero-title]', { yPercent: 105, duration: 1.4, stagger: .1 }, .1)
      .from('[data-hero-line]', { y: 24, autoAlpha: 0, duration: 1.2, stagger: .08 }, .35)
      .from('.stage__icon, .stage__foot', { autoAlpha: 0, duration: 1 }, .7);
  }

  function heroScroll() {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    const tiles = gsap.utils.toArray('#stage-mask [data-tile]');
    const scrub = () => ({ trigger: stage, start: 'top top', end: 'bottom top', scrub: true });

    gsap.to('.stage__photo img', { yPercent: 6, ease: 'none', scrollTrigger: scrub() });
    // Tiles drift apart as the hero scrolls away
    gsap.to(tiles[0], { attr: { y: -.1 }, ease: 'none', scrollTrigger: scrub() });
    gsap.to(tiles[1], { attr: { x: -.08 }, ease: 'none', scrollTrigger: scrub() });
    gsap.to(tiles[3], { attr: { x: .78 }, ease: 'none', scrollTrigger: scrub() });
    gsap.to(tiles[4], { attr: { y: .72 }, ease: 'none', scrollTrigger: scrub() });
    gsap.to('.stage__content', { yPercent: -6, ease: 'none', scrollTrigger: scrub() });
  }

  /* --------------------------------------------------------------- Laptop */
  // Scroll-scrubbed like the device on filmbot.com: the 3D laptop (js/laptop3d.js,
  // three.js) starts turned away with its lid shut and ends facing the visitor,
  // lid open and screen on. It loads as the section gets close; until then, or
  // without WebGL, the CSS laptop's lid swings open instead. Once the lid is fully
  // open, the player for the project video shows (initLaptopVideo).
  // Runs with reduced motion as well: it only moves while the visitor is scrolling.
  function laptop() {
    const lid = document.querySelector('[data-laptop-lid]');
    if (!lid) return;
    const figure = lid.closest('.device');
    // Shutting the lid again hides the player and pauses the video
    const setOpen = (open) => {
      figure.classList.toggle('device--open', open);
      if (laptopVideo) laptopVideo.setOpen(open);
    };
    let fallback = lidSwing(lid, setOpen);
    if (!('WebGL2RenderingContext' in window && 'IntersectionObserver' in window)) return;

    const nearby = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      nearby.disconnect();
      import(new URL('js/laptop3d.js', document.baseURI).href)
        .then(({ mountLaptop }) => mountLaptop(figure, {
          gsap,
          onOpen: setOpen,
          onLost: () => {
            figure.classList.remove('device--3d');
            fallback = lidSwing(lid, setOpen);
          },
        }))
        .then(() => {
          fallback.scrollTrigger.kill();
          fallback.kill();
          figure.classList.add('device--3d');
        })
        .catch((error) => console.warn('3D laptop unavailable, keeping the CSS one.', error));
    }, { rootMargin: '150% 0px' });
    nearby.observe(figure);
  }

  // Without WebGL: the lid opens as the page scrolls down and closes again going up
  function lidSwing(lid, onOpen) {
    const opened = (self) => onOpen(self.progress > .97);
    return gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: lid.parentElement, start: 'top 65%', end: 'top 10%', scrub: .8, onUpdate: opened, onRefresh: opened },
    })
      .fromTo(lid, { rotationX: -90 }, { rotationX: 0, duration: 1, ease: 'power1.inOut' }, 0)
      .fromTo(lid.querySelector('.device__power'), { autoAlpha: .75 }, { autoAlpha: 0, duration: .5 }, .45)
      .fromTo(lid.querySelector('.device__glare'), { xPercent: -100, autoAlpha: 1 }, { xPercent: 100, duration: .4 }, .6);
  }

  /* ---------------------------------------------------------- Text reveals */
  function wordsReveal() {
    document.querySelectorAll('[data-words]').forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map((word) => `<span class="word">${escapeHtml(word)}</span>`).join(' ');
      gsap.fromTo(el.querySelectorAll('.word'),
        { color: '#cbcbcb' },
        {
          color: '#171717',
          stagger: .05,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
        });
    });
  }

  function reveals() {
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.to(el, {
        autoAlpha: 1,
        y: 0,
        duration: reduced ? .6 : 1.2,
        ease: reduced ? 'power1.out' : 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
  }

  function counters() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      const pad = Number(el.dataset.pad || 0);
      const state = { value: 0 };
      const render = () => { el.textContent = String(Math.round(state.value)).padStart(pad, '0'); };
      render();
      gsap.to(state, {
        value: end,
        duration: 1.6,
        ease: 'power3.out',
        onUpdate: render,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  }

  /* ----------------------------------------------------- Horizontal work */
  function workTrack() {
    const viewport = document.querySelector('[data-work]');
    const track = document.querySelector('[data-work-track]');
    if (!viewport || !track) return;
    const bar = document.querySelector('[data-work-progress]');

    gsap.matchMedia().add('(min-width: 768px)', () => {
      viewport.classList.add('is-pinned');
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: viewport,
          start: () => {
            const free = window.innerHeight - viewport.offsetHeight;
            return free > 80 ? `top ${Math.round(free / 2 + 16)}px` : 'top 40px';
          },
          end: () => `+=${distance()}`,
          pin: true,
          scrub: .6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => { if (bar) gsap.set(bar, { scaleX: self.progress }); },
        },
      });
      return () => viewport.classList.remove('is-pinned');
    });
  }
})();

/* ------------------------------------------------------------ UI helpers */
function initClock() {
  const els = document.querySelectorAll('[data-clock]');
  if (!els.length) return;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Indian/Mauritius', hour: '2-digit', minute: '2-digit' });
  const tick = () => {
    const time = format.format(new Date());
    els.forEach((el) => { el.textContent = time; });
  };
  tick();
  setInterval(tick, 15000);
}

function initYear() {
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (!toggle || !menu) return;
  const label = toggle.querySelector('[data-text]');

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) {
      label.textContent = open ? 'Close' : 'Menu';
      label.dataset.text = label.textContent;
    }
  };

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
}

function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const original = button.textContent;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied ✓';
      } catch {
        button.textContent = button.dataset.copy;
      }
      setTimeout(() => { button.textContent = original; }, 2000);
    });
  });
}

// YouTube-style player for the project video on the experience laptop: a big play button,
// then a progress bar that also shows what has loaded, and a play/pause button. The video
// loops, pauses while the lid is shut or the laptop is off screen, and carries on when it is
// back. laptop() shows the player once the lid is fully open; js/laptop3d.js puts the video
// on the 3D screen.
function initLaptopVideo() {
  const player = document.querySelector('[data-player]');
  const video = document.querySelector('[data-laptop-video]');
  if (!player || !video) return null;
  const progress = player.querySelector('[data-player-progress]');
  const seek = player.querySelector('[data-player-seek]');
  const toggles = player.querySelectorAll('[data-player-toggle]');
  const [big, small] = toggles;
  let idleTimer = 0;
  let frame = 0;
  let pointer = 'mouse';

  const toggle = () => (video.paused ? video.play().catch(() => {}) : video.pause());
  // Like YouTube, the controls fade out while the pointer rests on a playing video
  const setIdle = (idle) => player.classList.toggle('is-idle', idle && !video.paused);
  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setIdle(true), 2500);
  };
  const showTime = () => {
    const played = video.duration ? video.currentTime / video.duration : 0;
    progress.style.setProperty('--played', played);
    if (document.activeElement !== seek) seek.value = Math.round(played * 1000);
  };
  const tick = () => {
    showTime();
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    const playing = !video.paused;
    player.classList.toggle('is-playing', playing);
    toggles.forEach((button) => button.setAttribute('aria-label', playing ? 'Pause video' : 'Play video'));
    cancelAnimationFrame(frame);
    if (playing) {
      tick();
      wake();
    } else {
      showTime();
      setIdle(false);
      player.classList.remove('is-loading');
    }
  };

  toggles.forEach((button) => button.addEventListener('click', () => {
    const moveFocus = button === big && big.matches(':focus-visible');
    toggle();
    // The big button hides once playing, so keyboard focus moves to the small one
    if (moveFocus) requestAnimationFrame(() => small.focus({ preventScroll: true }));
  }));
  player.addEventListener('pointerdown', (event) => { pointer = event.pointerType; });
  player.addEventListener('click', (event) => {
    if (event.target !== player) return;
    // On a touch screen, the first tap on a playing video brings the controls back
    if (pointer !== 'mouse' && player.classList.contains('is-idle')) wake();
    else toggle();
  });
  player.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse') wake(); });
  player.addEventListener('pointerleave', () => setIdle(true));
  player.addEventListener('focusin', wake);

  video.addEventListener('play', () => {
    player.classList.add('is-started');
    player.classList.toggle('is-loading', video.readyState < video.HAVE_FUTURE_DATA);
    sync();
  });
  video.addEventListener('pause', sync);
  video.addEventListener('waiting', () => player.classList.add('is-loading'));
  video.addEventListener('playing', () => player.classList.remove('is-loading'));
  video.addEventListener('progress', () => {
    const { buffered, duration } = video;
    if (buffered.length && duration) progress.style.setProperty('--buffered', buffered.end(buffered.length - 1) / duration);
  });
  seek.addEventListener('input', () => {
    if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
    showTime();
  });

  // Pause while the lid is shut or the laptop is off screen, and carry on when it is back
  const away = new Set();
  let resume = false;
  const setAway = (reason, isAway) => {
    if (isAway) away.add(reason);
    else away.delete(reason);
    if (away.size && !video.paused) {
      resume = true;
      video.pause();
    } else if (!away.size && resume) {
      resume = false;
      video.play().catch(() => {});
    }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => setAway('offscreen', !entry.isIntersecting)).observe(player.closest('.device'));
  }
  return { setOpen: (open) => setAway('shut', !open) };
}

// Decorative QR-style grid for the treasure hunt card (not a scannable code)
function initQr() {
  const grid = document.querySelector('[data-qr]');
  if (!grid) return;
  const size = 25;
  const finders = [[0, 0], [size - 7, 0], [0, size - 7]];
  let seed = 11;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const fragment = document.createDocumentFragment();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = finders.find(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
      let on;
      if (finder) {
        const ring = Math.max(Math.abs(x - finder[0] - 3), Math.abs(y - finder[1] - 3));
        on = ring !== 2;
      } else if (finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7)) {
        on = false;
      } else {
        on = random() > .52;
      }
      const cell = document.createElement('i');
      if (!on) cell.className = 'is-off';
      fragment.appendChild(cell);
    }
  }
  grid.appendChild(fragment);
}

// Scale single-line text (footer wordmark) to the full container width
function initFitText() {
  const els = document.querySelectorAll('[data-fit]');
  if (!els.length) return;
  const fit = () => els.forEach((el) => {
    const parent = el.parentElement;
    const styles = getComputedStyle(parent);
    const available = parent.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    el.style.display = 'inline-block';
    el.style.fontSize = '100px';
    const width = el.getBoundingClientRect().width;
    el.style.display = '';
    el.style.fontSize = `${(100 * available) / width}px`;
  });
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  window.addEventListener('resize', debounce(fit, 150));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

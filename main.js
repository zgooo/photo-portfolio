/* ============================================================
   MR.z · 摄影作品集  —  main.js
   纯原生 JS，无依赖。职责：
   1) 读取站点数据（photos.json → localStorage → data.js 兜底）
   2) 渲染各区块   3) 交互：导航 / Hero 轮播 / 筛选 / Lightbox / 表单
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  const DATA_KEY = 'pf:data';       // 管理后台写入的本地数据
  const THEME_KEY = 'pf:theme';     // 手动主题偏好
  const HERO_INTERVAL = 5500;       // Hero 轮播间隔（ms）

  const ICONS = {
    wechat:
      '<path d="M9.6 4.8C6 4.8 3.1 7.2 3.1 10.2c0 1.7 1 3.2 2.6 4.2L5 16.9l2.8-1.4c.6.1 1.2.2 1.8.2h.3"/>' +
      '<path d="M20.9 13.8c0-2.4-2.4-4.4-5.3-4.4s-5.3 2-5.3 4.4 2.4 4.4 5.3 4.4c.6 0 1.1-.1 1.6-.2l2.4 1.2-.5-1.9c1.1-.8 1.8-2.1 1.8-3.5z"/>' +
      '<circle cx="13.9" cy="13.3" r="0.7" fill="currentColor" stroke="none"/>' +
      '<circle cx="17.3" cy="13.3" r="0.7" fill="currentColor" stroke="none"/>',
    xiaohongshu:
      '<rect x="3.5" y="4.5" width="17" height="15" rx="4"/><path d="M8 9.6h8M8 13.2h4.8"/><path d="M15.2 12.4v3.2M13.6 14l1.6 1.6 1.6-1.6"/>',
    douyin:
      '<path d="M14.6 4.2v10.1"/>' +
      '<circle cx="10.3" cy="14.6" r="4.3"/>' +
      '<path d="M14.6 5.4c.4 2.1 2.2 3.7 4.4 4"/>',
    instagram:
      '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none"/>',
    weibo:
      '<path d="M20 5.5c-1.6-1-3.9-.6-5 1"/><path d="M10.6 8.4C6.6 9 3.6 11.5 3.6 14.2c0 2.6 3 4.4 6.9 4.4 4.3 0 7.4-2.3 7.4-5 0-2.1-2-3.8-4.6-4.1"/><circle cx="8.6" cy="14.4" r="2.7"/>',
    camera:
      '<path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h1.8l1.3-2h5.8l1.3 2H18a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z"/><circle cx="12" cy="12.6" r="3.6"/>',
    link:
      '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.4 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.4-3.6-8.5S9.6 5.9 12 3.5z"/>'
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    data: null,
    filter: '全部',
    visible: [],
    socials: [],      // 前台渲染用的社交/二维码条目
    qrIndex: 0,       // 当前浮层里的平台下标
    lbIndex: 0,
    heroIndex: 0,
    heroTimer: null,
    lastFocus: null,
    openedAt: 0,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarse: window.matchMedia('(pointer: coarse)').matches
  };

  /* 图片查看的放大 / 拖动状态 */
  const zoom = {
    on: false,
    scale: 1,
    tx: 0,
    ty: 0,
    pointers: new Map(),  // 活动中的指针（支持双指缩放）
    pinch: null,          // 双指缩放会话的初始状态
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  };

  /* ============================================================
     一、数据加载
     ============================================================ */
  async function loadData() {
    const sources = [];

    // 1) 同目录下的 photos.json（由管理后台或本地服务写入）
    try {
      const res = await fetch('photos.json', { cache: 'no-store' });
      if (res.ok) sources.push(await res.json());
    } catch (err) {
      /* file:// 打开时 fetch 会被浏览器拦截，属预期情况 */
    }

    // 2) 管理后台保存在浏览器里的数据
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) sources.push(JSON.parse(raw));
    } catch (err) { /* 忽略损坏的本地数据 */ }

    // 3) data.js 兜底（无需服务器即可打开）
    if (window.PORTFOLIO_DATA) sources.push(window.PORTFOLIO_DATA);

    if (!sources.length) {
      document.body.insertAdjacentHTML(
        'afterbegin',
        '<div style="padding:16px 20px;background:#111;color:#fff;font-size:14px">' +
          '未能读取站点数据。请确认 photos.json / data.js 与页面在同一目录，或运行 <code>node server.js</code> 后访问 http://localhost:8080' +
        '</div>'
      );
      return null;
    }

    // 以 updatedAt 最新的一份为准
    sources.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
    return sources[0];
  }

  /* ============================================================
     二、渲染
     ============================================================ */
  function renderSite() {
    const { site } = state.data;
    $$('[data-site]').forEach((el) => {
      const key = el.dataset.site;
      if (site[key] != null) el.textContent = site[key];
    });

    // 标题：中英文名都在且不重复时才拼接，避免出现「MR.z 摄影作品集 · 摄影作品集」
    const siteName = String(site.name || '').trim();
    const nameEn = String(site.nameEn || '').trim();
    const titleParts = [siteName];
    if (nameEn && nameEn !== siteName && !/[\u4e00-\u9fa5]/.test(nameEn)) titleParts.push(nameEn);
    titleParts.push('摄影作品集');
    document.title = titleParts.join(' ');
    const desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', `${site.name}，${site.location}的独立摄影师。${site.tagline}。`);

    $('#footerCopy').textContent = site.copyright || '';
    const icp = $('#footerIcp');
    icp.textContent = site.icp || '';
    icp.hidden = !site.icp;

    // 可选水印（后台「站点信息」里的开关，默认关闭）
    document.body.classList.toggle('has-watermark', !!site.watermark);

    // 拍摄理念（联系板块左列；后台「站点信息 → 拍摄理念」维护，全部留空自动隐藏）
    const phil = (site.philosophy || []).filter((p) => p && (p.t || p.d));
    $('#ideaList').innerHTML = phil
      .map((p) => `<li><h4>${esc(p.t || '')}</h4><p>${esc(p.d || '')}</p></li>`)
      .join('');
    $('#ideaBlock').hidden = !phil.length;

    // 社交 / 二维码：有二维码的直接平铺显示（无需点击），没有的保留为图标链接
    const socials = (site.social || []).filter((s) => s.url || s.qr);
    state.socials = socials;

    const withQr = socials.filter((s) => s.qr);
    $('#qrStrip').innerHTML = withQr
      .map(
        (s, i) =>
          `<figure class="qrstrip__card" data-qr="${socials.indexOf(s)}" role="button" tabindex="0" title="点击放大 ${esc(s.label)} 二维码" aria-label="查看 ${esc(s.label)} 二维码">` +
            `<span class="qrstrip__imgwrap"><img src="${esc(s.qr)}" alt="${esc(s.label)}二维码" decoding="async" draggable="false" /></span>` +
            `<figcaption>${esc(s.label)}</figcaption>` +
            `<span class="qrstrip__hint">点击放大</span>` +
          '</figure>'
      )
      .join('');
    $('#qrStrip').hidden = !withQr.length;

    const svg = (s) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.icon] || ICONS.link}</svg>`;
    const noQr = socials.filter((s) => !s.qr);
    $('#socialLinks').innerHTML = noQr
      .map(
        (s) =>
          `<a class="social__item" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.label)}" title="${esc(s.label)}">${svg(s)}</a>`
      )
      .join('');
    $('#socialLinks').hidden = !noQr.length; // 空容器也会占位，把右列底部撑高 20px
  }

  function renderHero() {
    const slides = state.data.hero || [];
    const wrap = $('#heroSlides');
    const dots = $('#heroDots');

    if (!slides.length) {
      wrap.innerHTML = '<div class="hero__slide is-active"><img src="" alt="" /></div>';
      return;
    }

    wrap.innerHTML = slides
      .map(
        (s, i) =>
          `<div class="hero__slide${i === 0 ? ' is-active' : ''}">` +
          `<img src="${esc(s.url)}" alt="${esc(s.alt || '')}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />` +
          '</div>'
      )
      .join('');

    dots.innerHTML = slides
      .map(
        (s, i) =>
          `<button type="button" aria-current="${i === 0}" aria-label="第 ${i + 1} 张：${esc(s.alt || '')}" data-slide="${i}"></button>`
      )
      .join('');

    // 图注：后台「图片说明」填的内容会显示在这里，随图片切换
    const cap = $('#heroCap');
    if (cap) cap.textContent = slides[0] && slides[0].alt ? slides[0].alt : '';

    dots.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-slide]');
      if (btn) goSlide(Number(btn.dataset.slide));
    });

    if (slides.length > 1 && !state.reduceMotion) {
      startHeroTimer();
      document.addEventListener('visibilitychange', () => {
        document.hidden ? stopHeroTimer() : startHeroTimer();
      });
    }
  }

  function goSlide(i) {
    const slides = $$('.hero__slide');
    if (!slides.length) return;
    state.heroIndex = (i + slides.length) % slides.length;
    slides.forEach((el, k) => el.classList.toggle('is-active', k === state.heroIndex));
    $$('#heroDots button').forEach((el, k) => el.setAttribute('aria-current', String(k === state.heroIndex)));
    const cap = $('#heroCap');
    if (cap) cap.textContent = (state.data.hero || [])[state.heroIndex]?.alt || '';
    startHeroTimer();
  }
  function startHeroTimer() {
    stopHeroTimer();
    if (state.reduceMotion) return;
    state.heroTimer = setInterval(() => goSlide(state.heroIndex + 1), HERO_INTERVAL);
  }
  function stopHeroTimer() {
    if (state.heroTimer) clearInterval(state.heroTimer);
    state.heroTimer = null;
  }

  /* ---------- 作品集 ---------- */
  function renderFilter() {
    const photos = state.data.photos || [];
    const cats = ['全部'].concat(state.data.categories || []);
    $('#filter').innerHTML = cats
      .map((c) => {
        const n = c === '全部' ? photos.length : photos.filter((p) => p.category === c).length;
        if (n === 0 && c !== '全部') return '';
        return (
          `<button type="button" aria-pressed="${c === state.filter}" data-cat="${esc(c)}">` +
          `${esc(c)}<span>${n}</span></button>`
        );
      })
      .join('');

    $('#filter').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cat]');
      if (btn) setFilter(btn.dataset.cat);
    });
  }

  function renderGallery() {
    const photos = state.data.photos || [];
    const mark = '© ' + (state.data.site.name || '');
    $('#gallery').innerHTML = photos
      .map((p) => {
        const ratio = p.ratio ? `aspect-ratio:${p.ratio}` : '';
        return (
          `<figure class="gallery__item" data-cat="${esc(p.category)}" data-id="${esc(p.id)}">` +
            `<button class="gallery__btn" type="button" data-watermark="${esc(mark)}" aria-label="查看《${esc(p.title)}》，移动端双击可放大">` +
              `<img class="gallery__img" src="${esc(p.url)}" alt="${esc(p.alt || p.title)}" ` +
              `style="${ratio}" width="1200" height="${p.ratio ? Math.round(1200 / p.ratio) : 1200}" ` +
              `loading="lazy" decoding="async" draggable="false" />` +
            '</button>' +
            '<figcaption class="gallery__cap">' +
              `<span class="gallery__title">${esc(p.title)}</span>` +
              `<span class="gallery__cat">${esc(p.category)}${p.year ? ' · ' + esc(p.year) : ''}</span>` +
            '</figcaption>' +
          '</figure>'
        );
      })
      .join('');

    $('#gallery').addEventListener('click', (e) => {
      const btn = e.target.closest('.gallery__btn');
      if (!btn) return;
      const item = btn.closest('.gallery__item');
      const idx = state.visible.findIndex((p) => p.id === item.dataset.id);
      if (idx < 0) return;

      // 桌面端：单击直接打开
      if (!state.coarse) return openLightbox(idx, false);

      // 移动端：单击打开，双击直接放大到 100%
      const now = Date.now();
      if (now - lastGalleryTap < 320) {
        lastGalleryTap = 0;
        clearTimeout(galleryTapTimer);
        openLightbox(idx, true);
        return;
      }
      lastGalleryTap = now;
      clearTimeout(galleryTapTimer);
      galleryTapTimer = setTimeout(() => openLightbox(idx, false), 320);
    });
  }

  let lastGalleryTap = 0;
  let galleryTapTimer = null;

  function setFilter(cat) {
    state.filter = cat;
    $$('#filter button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));

    const items = $$('#gallery .gallery__item');
    const matches = (el) => cat === '全部' || el.dataset.cat === cat;

    // 连续快速切换时，取消上一轮还没执行的过渡，避免旧分类的回调覆盖新状态
    clearTimeout(filterTimer);

    if (state.reduceMotion) {
      items.forEach((el) => {
        el.hidden = !matches(el);
        el.classList.remove('is-out');
      });
    } else {
      items.forEach((el) => el.classList.add('is-out'));
      filterTimer = window.setTimeout(() => {
        items.forEach((el) => {
          const ok = matches(el);
          el.hidden = !ok;
          if (ok) el.classList.remove('is-out');
        });
      }, 240);
    }

    state.visible = (state.data.photos || []).filter((p) => cat === '全部' || p.category === cat);
    $('#galleryEmpty').hidden = state.visible.length > 0;
  }

  let filterTimer = null;

  /* ---------- 关于我 ---------- */
  function renderAbout() {
    const a = state.data.about || {};
    const img = $('#aboutAvatar');
    if (a.avatar) img.src = a.avatar;
    img.alt = `${state.data.site.name} 的照片`;
    if (a.subtitle) $('#aboutSubtitle').textContent = a.subtitle;
    if (a.title) $('#aboutTitle').textContent = a.title;
    $('#aboutBio').innerHTML = String(a.bio || '')
      .split('\n')
      .filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join('');
    $('#aboutGear').innerHTML = (a.gear || []).map((g) => `<li>${esc(g)}</li>`).join('');

    // 图片标注：名称、参数各一行（各自有值才显示）
    const capName = String(a.capName || '').trim();
    const capInfo = String(a.capInfo || '').trim();
    const setCap = (sel, v) => { const el = $(sel); el.textContent = v; el.hidden = !v; };
    setCap('#capName', capName);
    setCap('#capInfo', capInfo);
    $('#aboutCaption').hidden = !(capName || capInfo);
  }


  /* ============================================================
     三、交互
     ============================================================ */
  function initNav() {
    const nav = $('#nav');
    const burger = $('#burger');
    const hero = $('#home');

    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 40);
      const heroH = hero ? hero.offsetHeight : window.innerHeight;
      nav.dataset.overHero = String(y < heroH - 120);
      $('#toTop').classList.toggle('is-visible', y > window.innerHeight * 0.9);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // 移动端抽屉
    burger.addEventListener('click', () => toggleMenu(nav.classList.contains('is-open') ? false : true));
    $$('#navMenu a').forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
    function toggleMenu(open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
      document.body.classList.toggle('is-locked', open);
      // 全屏菜单打开时暂停首屏轮播，关闭后恢复
      const slides = state.data && state.data.hero ? state.data.hero.length : 0;
      if (open) stopHeroTimer();
      else if (slides > 1) startHeroTimer();
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) toggleMenu(false);
    });

    $('#toTop').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: state.reduceMotion ? 'auto' : 'smooth' });
    });

    // 锚点高亮
    const sections = ['home', 'works', 'about', 'contact']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          $$('#navMenu a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.nav === en.target.id)));
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => spy.observe(s));
  }

  function initTheme() {
    const btn = $('#themeToggle');
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* 隐私模式 */ }
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;

    const sync = () => {
      const isDark =
        document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
    };
    sync();

    btn.addEventListener('click', () => {
      const isDark =
        document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const next = isDark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 忽略 */ }
      sync();
    });
  }

  function initReveal() {
    const els = $$('.reveal');
    if (state.reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-visible');
          obs.unobserve(en.target); // 只触发一次
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Lightbox ---------- */
  /* 手势约定：
     · 双击      → 放大到 100%（按图片原始像素显示）/ 再次双击还原
     · 放大后拖动 → 任意查看图片各个位置（鼠标、触屏一致）
     · 单击      → 回到瀑布流页面（关闭查看器）
     · 未放大时左右滑动 → 上一张 / 下一张                                  */

  const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
  let lastTap = 0;
  let tapTimer = null;

  function openLightbox(index, startZoomed) {
    state.lbIndex = index;
    state.lastFocus = document.activeElement;
    state.openedAt = Date.now();
    const lb = $('#lightbox');
    lb.hidden = false;
    renderLightbox();
    resetZoom();
    requestAnimationFrame(() => {
      lb.classList.add('is-open');
      if (startZoomed) setZoom(true);
    });
    document.body.classList.add('is-locked');
    $('#lbClose').focus({ preventScroll: true });
    preload(index + 1);
    preload(index - 1);
  }

  function closeLightbox() {
    const lb = $('#lightbox');
    clearTimeout(tapTimer);
    lastTap = 0;
    resetZoom();
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(() => { lb.hidden = true; }, 240);
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll: true });
  }

  function renderLightbox() {
    const list = state.visible.length ? state.visible : (state.data.photos || []);
    if (!list.length) return;
    state.lbIndex = (state.lbIndex + list.length) % list.length;
    const p = list[state.lbIndex];

    const img = $('#lbImg');
    img.src = p.url;
    img.alt = p.alt || p.title;
    $('#lbTitle').textContent = p.title;
    $('#lbCounter').textContent = `${state.lbIndex + 1} / ${list.length}`;

    const meta = [
      [p.camera, p.lens].filter(Boolean).join(' + '),
      [p.aperture, p.shutter, p.iso ? 'ISO ' + p.iso : ''].filter(Boolean).join(' · '),
      [p.location, p.year].filter(Boolean).join(' · ')
    ].filter(Boolean);
    $('#lbMeta').textContent = meta.join('　|　');
  }

  function preload(offset) {
    const list = state.visible.length ? state.visible : (state.data.photos || []);
    const p = list[(offset + list.length) % list.length];
    if (p) { const im = new Image(); im.src = p.url; }
  }

  /* ---------- 放大 / 拖动 / 双指缩放 ---------- */
  function resetZoom() {
    zoom.on = false;
    zoom.scale = 1;
    zoom.tx = 0;
    zoom.ty = 0;
    zoom.dragging = false;
    zoom.moved = false;
    zoom.pointers.clear();
    zoom.pinch = null;
    const img = $('#lbImg');
    img.style.transition = '';
    img.style.transform = '';
    $('#lightbox').classList.remove('is-zoomed', 'is-panning');
  }

  function applyZoom() {
    $('#lbImg').style.transform = zoom.on
      ? `translate3d(${zoom.tx}px, ${zoom.ty}px, 0) scale(${zoom.scale})`
      : '';
  }

  /* 把拖动范围夹在图片边界内，保证任何位置都能看到、又不会拖出空白 */
  function clampPan() {
    const img = $('#lbImg');
    const stage = $('#lbStage');
    const scaledW = img.clientWidth * zoom.scale;
    const scaledH = img.clientHeight * zoom.scale;
    const maxX = Math.max(0, (scaledW - stage.clientWidth) / 2);
    const maxY = Math.max(0, (scaledH - stage.clientHeight) / 2);
    zoom.tx = Math.min(maxX, Math.max(-maxX, zoom.tx));
    zoom.ty = Math.min(maxY, Math.max(-maxY, zoom.ty));
  }

  function setZoom(on) {
    const img = $('#lbImg');

    // 图片还没加载完就先等它，否则量不出尺寸
    if (on && (!img.complete || !img.naturalWidth || !img.clientWidth)) {
      img.addEventListener('load', () => { if (!$('#lightbox').hidden) setZoom(true); }, { once: true });
      return;
    }

    zoom.on = on;
    if (on) {
      // 100% = 一像素对应一像素，按图片原始尺寸显示
      zoom.scale = Math.max(1, img.naturalWidth / img.clientWidth);
      zoom.tx = 0;
      zoom.ty = 0;
    } else {
      zoom.scale = 1;
      zoom.tx = 0;
      zoom.ty = 0;
    }

    if (!state.reduceMotion) {
      img.style.transition = `transform 220ms ${EASE}`;
      setTimeout(() => { if (!zoom.dragging) img.style.transition = ''; }, 240);
    }
    applyZoom();
    $('#lightbox').classList.toggle('is-zoomed', on);
  }

  /* 单击 / 双击判定 */
  const DOUBLE_TAP_MS = state.coarse ? 300 : 240; // 触摸端留足判定时间，桌面端更跟手

  function handleStageTap() {
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_MS) {     // 双击 → 放大 / 还原
      lastTap = 0;
      clearTimeout(tapTimer);
      setZoom(!zoom.on);
      return;
    }
    lastTap = now;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      if (Date.now() - state.openedAt < 320) return;   // 刚打开的那一下不算
      closeLightbox();                                  // 单击 → 回到瀑布流
    }, DOUBLE_TAP_MS);
  }

  function initLightbox() {
    const stage = $('#lbStage');
    const lb = $('#lightbox');

    const step = (delta) => {
      resetZoom();
      state.lbIndex += delta;
      renderLightbox();
      preload(state.lbIndex + delta);
    };

    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', () => step(-1));
    $('#lbNext').addEventListener('click', () => step(1));

    // 点击图片以外的空白处关闭
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });

    // 缩放上限：图片原始尺寸相对当前显示尺寸的倍数（封顶 5 倍）
    const maxScale = () => {
      const img = $('#lbImg');
      const m = img.naturalWidth && img.clientWidth ? img.naturalWidth / img.clientWidth : 3;
      return Math.max(1, Math.min(m, 5));
    };

    // 指针事件：拖动查看 + 双指捏合缩放 + 单击 / 双击 / 滑动切换
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      zoom.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      zoom.moved = false;
      zoom.dragging = false;

      if (zoom.pointers.size === 1) {
        zoom.startX = e.clientX;
        zoom.startY = e.clientY;
        zoom.originX = zoom.tx;
        zoom.originY = zoom.ty;
      } else if (zoom.pointers.size === 2) {
        // 第二根手指落下 → 进入双指缩放（取消待定的单击/双击判定）
        clearTimeout(tapTimer);
        lastTap = 0;
        const [a, b] = [...zoom.pointers.values()];
        const sRect = stage.getBoundingClientRect();
        const imgRect = $('#lbImg').getBoundingClientRect();
        zoom.pinch = {
          dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          scale0: zoom.on ? zoom.scale : 1,
          tx0: zoom.tx,
          ty0: zoom.ty,
          sl: sRect.left,
          st: sRect.top,
          m0x: (a.x + b.x) / 2 - sRect.left,
          m0y: (a.y + b.y) / 2 - sRect.top,
          // 图片未变换时的中心（rect 中心减去当前位移）
          cx: imgRect.left + imgRect.width / 2 - sRect.left - zoom.tx,
          cy: imgRect.top + imgRect.height / 2 - sRect.top - zoom.ty
        };
      }
    });

    stage.addEventListener('pointermove', (e) => {
      const pt = zoom.pointers.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;

      /* 双指缩放：按两指间距比例改缩放，并让中点跟随手指 */
      if (zoom.pinch && zoom.pointers.size >= 2) {
        const [a, b] = [...zoom.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const s = Math.min(maxScale(), Math.max(1, zoom.pinch.scale0 * dist / zoom.pinch.dist0));
        const mx = (a.x + b.x) / 2 - zoom.pinch.sl;
        const my = (a.y + b.y) / 2 - zoom.pinch.st;
        const k = s / zoom.pinch.scale0;
        zoom.scale = s;
        zoom.tx = mx - zoom.pinch.cx - k * (zoom.pinch.m0x - zoom.pinch.cx - zoom.pinch.tx0);
        zoom.ty = my - zoom.pinch.cy - k * (zoom.pinch.m0y - zoom.pinch.cy - zoom.pinch.ty0);
        zoom.on = s > 1.001;
        zoom.dragging = true;
        lb.classList.toggle('is-zoomed', zoom.on);
        lb.classList.add('is-panning');
        clampPan();
        applyZoom();
        return;
      }

      const dx = e.clientX - zoom.startX;
      const dy = e.clientY - zoom.startY;
      if (!zoom.moved && Math.abs(dx) + Math.abs(dy) > 6) zoom.moved = true;
      if (!zoom.moved) return;

      if (zoom.on) {                       // 放大状态：拖动平移
        zoom.dragging = true;
        lb.classList.add('is-panning');
        zoom.tx = zoom.originX + dx;
        zoom.ty = zoom.originY + dy;
        clampPan();
        applyZoom();
      }
    });

    const endPointer = (e) => {
      if (!zoom.pointers.has(e.pointerId)) return;
      zoom.pointers.delete(e.pointerId);

      /* 双指缩放进行中：少于一指则结束缩放会话 */
      if (zoom.pinch) {
        if (zoom.pointers.size < 2) {
          zoom.pinch = null;
          lb.classList.remove('is-panning');
          const rest = [...zoom.pointers.values()][0];
          if (rest) {
            // 剩下的一根手指无缝转为拖动平移
            zoom.startX = rest.x;
            zoom.startY = rest.y;
            zoom.originX = zoom.tx;
            zoom.originY = zoom.ty;
            zoom.moved = true;
            zoom.dragging = zoom.on;
          } else {
            zoom.dragging = false;
          }
        }
        return;   // 双指手势不触发单击/双击/滑动切换
      }

      const moved = zoom.moved;
      const dx = e.clientX - zoom.startX;
      const dy = e.clientY - zoom.startY;
      zoom.moved = false;
      zoom.dragging = false;
      lb.classList.remove('is-panning');
      if (moved) {
        // 未放大时的左右滑动 → 切换作品（触屏快速滑动被浏览器取消时也按位移兜底判断）
        if (!zoom.on && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? -1 : 1);
        return;
      }
      handleStageTap();
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // 鼠标滚轮：放大后滚动改为上下平移
    stage.addEventListener('wheel', (e) => {
      if (!zoom.on) return;
      e.preventDefault();
      zoom.tx -= e.deltaX;
      zoom.ty -= e.deltaY;
      clampPan();
      applyZoom();
    }, { passive: false });

    // 屏蔽浏览器自带的双击放大
    stage.addEventListener('dblclick', (e) => e.preventDefault());

    // 键盘操作
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') return closeLightbox();
      if (e.key === 'ArrowLeft') return step(-1);
      if (e.key === 'ArrowRight') return step(1);
      if (e.key === 'Tab') {
        // 焦点锁在弹层内
        const focusables = [$('#lbClose'), $('#lbPrev'), $('#lbNext')];
        const i = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i === focusables.length - 1 ? 0 : i + 1);
        focusables[next].focus();
      }
    });

    // 屏幕旋转 / 改变窗口大小后重新夹取位置
    window.addEventListener('resize', () => { if (zoom.on) { clampPan(); applyZoom(); } });
  }

  /* ---------- 联系表单 ---------- */
  /* ---------- 图片防盗 ----------
     说明：前端的任何手段都只能提高保存门槛，不能 100% 阻止。
     这里做的是「挡住普通右键/长按保存 + 阻止拖拽与复制」，
     真正的威慑请打开后台的水印开关，自建服务器时还有 Referer 防盗链。 */
  function initAntiTheft() {
    // 屏蔽图片上的右键菜单（二维码除外——要支持长按识别 / 右键保存）
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.qrstrip__card, #qrModal')) return;
      if (e.target.closest('img, .gallery__btn, .gallery__item, .hero__slide, .about__media, #lbStage')) e.preventDefault();
    });

    // 屏蔽拖拽图片（拖到桌面/新标签页都算；二维码除外）
    document.addEventListener('dragstart', (e) => {
      if (e.target && e.target.tagName === 'IMG' && !e.target.closest('.qrstrip__card, #qrModal')) e.preventDefault();
    });

    // 复制时如果选中了图片，只留下版权提示
    document.addEventListener('copy', (e) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const frag = sel.getRangeAt(0).cloneContents();
      if (frag.querySelector && frag.querySelector('img') && e.clipboardData) {
        e.clipboardData.setData('text/plain', '图片版权归作者所有，未经授权请勿使用。');
        e.preventDefault();
      }
    });

    // 图片元素统一禁用原生拖拽（含后续动态插入的图片）
    $$('img').forEach((im) => im.setAttribute('draggable', 'false'));
  }

  /* ---------- 二维码浮层（微信 / 小红书 / 抖音） ---------- */
  function copyText(text) {
    return new Promise((resolve) => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => resolve(true), () => resolve(fallbackCopy(text)));
      } else {
        resolve(fallbackCopy(text));
      }
    });
    function fallbackCopy(t) {
      try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (err) {
        return false;
      }
    }
  }

  function initQrPanel() {
    const modal = $('#qrModal');
    if (!modal) return;

    const showAt = (i) => {
      const list = (state.socials || []).filter((s) => s.qr);
      if (!list.length) return;
      const item = list[i] || list[0];
      state.qrIndex = list.indexOf(item);
      $('#qrTitle').textContent = item.label || '扫码联系';
      $('#qrSub').textContent = item.qrSub || '长按识别，或扫码添加';
      const img = $('#qrImg');
      const empty = $('#qrEmpty');
      if (item.qr) {
        img.src = item.qr;
        img.alt = (item.label || '') + ' 二维码';
        img.hidden = false;
        empty.hidden = true;
      } else {
        img.removeAttribute('src');
        img.hidden = true;
        empty.hidden = false;
      }
      const handle = $('#qrHandle');
      if (item.copy) {
        handle.textContent = item.copy;
        handle.hidden = false;
      } else {
        handle.hidden = true;
      }
      const copyBtn = $('#qrCopy');
      copyBtn.textContent = '复制' + (item.label || '账号');
      copyBtn.hidden = !item.copy;
      // 平台切换
      $('#qrTabs').innerHTML = list
        .map(
          (s, k) =>
            `<button type="button" class="qr__tab${k === state.qrIndex ? ' is-active' : ''}" data-tab="${k}"` +
            ` aria-label="切换到${esc(s.label)}">${esc(s.label)}</button>`
        )
        .join('');
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('is-open'));
      // 有「复制账号」就聚焦它，否则聚焦关闭按钮（避免把焦点丢给隐藏元素）
      const target = item.copy ? $('#qrCopy') : $('.qr__close', modal);
      if (target) target.focus({ preventScroll: true });
    };

    const close = () => {
      modal.classList.remove('is-open');
      setTimeout(() => { modal.hidden = true; }, 220);
      if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll: true });
    };

    modal.addEventListener('click', async (e) => {
      if (e.target.closest('[data-qr-close]')) return close();
      const tab = e.target.closest('[data-tab]');
      if (tab) return showAt(Number(tab.dataset.tab));
      if (e.target.closest('#qrCopy')) {
        const item = (state.socials || []).filter((s) => s.qr)[state.qrIndex];
        if (!item || !item.copy) return;
        const ok = await copyText(item.copy);
        toast(ok ? '已复制：' + item.copy : '复制失败，请手动输入');
      }
    });

    // 入口：直接平铺的二维码卡片（点击放大 + 复制账号）
    const openFromCard = (card) => {
      const item = state.socials[Number(card.dataset.qr)];
      if (!item) return;
      const list = state.socials.filter((s) => s.qr);
      state.lastFocus = card;
      showAt(list.indexOf(item));
    };
    $('#qrStrip').addEventListener('click', (e) => {
      const card = e.target.closest('[data-qr]');
      if (card) openFromCard(card);
    });
    // 键盘可达：卡片是 role="button"，Enter / 空格也能打开
    $('#qrStrip').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      const card = e.target.closest('[data-qr]');
      if (!card) return;
      e.preventDefault();
      openFromCard(card);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  /* ---------- 二维码条宽度 = 联系标题墨迹宽度（桌面端） ---------- */
  function fitQrStrip() {
    const strip = $('#qrStrip');
    const title = document.querySelector('#contact .contact__intro .section__title');
    const desc = document.querySelector('#contact .contact__desc');
    const intro = document.querySelector('#contact .contact__intro');
    if (!strip || !title) return;

    const resetDesc = () => {
      if (!desc) return;
      desc.style.maxWidth = '';
      desc.style.whiteSpace = '';
      desc.style.fontSize = '';
    };

    // 把引言压成一行，并缩放到恰好等于给定宽度
    const fitDesc = (target) => {
      if (!desc || !target) return;
      resetDesc();
      desc.style.whiteSpace = 'nowrap';
      desc.style.maxWidth = target.toFixed(1) + 'px';
      let fs = parseFloat(getComputedStyle(desc).fontSize) || 15;
      const range = document.createRange();
      for (let i = 0; i < 2; i++) { // 两次逼近，消除字距取整误差
        range.selectNodeContents(desc);
        const natural = range.getBoundingClientRect().width;
        if (!natural) break;
        fs = fs * (target / natural);
        desc.style.fontSize = fs.toFixed(2) + 'px';
      }
    };

    // 手机：四码整行均分，引言按可用宽度压成一行
    const ideaBlock = document.querySelector('#contact .contact__idea');
    if (innerWidth < 641) {
      strip.style.width = '';
      if (ideaBlock) ideaBlock.style.height = '';
      fitDesc(intro ? intro.getBoundingClientRect().width : 0);
      return;
    }

    // 桌面：二维码条与引言占满右列全宽（右缘与「关于我」等内容对齐）
    const w = intro ? intro.getBoundingClientRect().width : 0;
    if (!w) return;
    strip.style.width = (Math.round(w * 10) / 10) + 'px';
    fitDesc(w);

    // 左列高度由右列自然撑高（grid align-items: stretch），不再用 JS 写入高度
    if (ideaBlock) ideaBlock.style.height = '';
  }

  /* ---------- 轻提示 ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => { el.hidden = true; }, 280);
    }, 3200);
  }

  /* ============================================================
     四、启动
     ============================================================ */
  async function init() {
    state.data = await loadData();
    if (!state.data) return;

    renderSite();
    renderHero();
    renderFilter();
    renderGallery();
    renderAbout();

    state.visible = (state.data.photos || []).slice();
    setFilter('全部');

    initNav();
    initTheme();
    initLightbox();
    initQrPanel();
    initAntiTheft();
    initReveal(); // 放在渲染之后，保证动态插入的节点也能被观察到

    // 二维码条宽度对齐联系标题（字体加载完/窗口尺寸变化时重算）
    fitQrStrip();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitQrStrip);
    let fitTimer = null;
    window.addEventListener('resize', () => {
      if (fitTimer) cancelAnimationFrame(fitTimer);
      fitTimer = requestAnimationFrame(() => { fitQrStrip(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

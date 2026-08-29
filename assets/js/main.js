/* =============================================================
   黄振宇 · 个人简历网站 —— 全局交互脚本
   功能：主题切换 / 移动端菜单 / 滚动进场动画 / 数字滚动 / 导航高亮
   ============================================================= */

(function () {
  'use strict';

  /* ---------- 图标定义（内联 SVG，避免外链依赖） ---------- */
  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  const doc = document;

  /* =========================================================
     1. 主题切换（深色 ⇄ 工业蓝图浅色），状态存 localStorage
     ========================================================= */
  const THEME_KEY = 'hzy-resume-theme';
  const themeBtn = doc.getElementById('themeBtn');

  function applyTheme(theme) {
    doc.documentElement.setAttribute('data-theme', theme);
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
      themeBtn.title = theme === 'dark' ? '切换到浅色模式' : '切换到深色模式';
    }
  }

  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const next = doc.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  /* =========================================================
     2. 移动端汉堡菜单
     ========================================================= */
  const menuBtn = doc.getElementById('menuBtn');
  const navLinks = doc.getElementById('navLinks');

  if (menuBtn && navLinks) {
    menuBtn.innerHTML = ICONS.menu;

    menuBtn.addEventListener('click', function () {
      const opened = navLinks.classList.toggle('open');
      menuBtn.innerHTML = opened ? ICONS.close : ICONS.menu;
    });

    // 点击导航项后自动关闭菜单
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        menuBtn.innerHTML = ICONS.menu;
      });
    });
  }

  /* =========================================================
     3. 滚动进场动画（IntersectionObserver）
     ========================================================= */
  const revealEls = doc.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // 降级：不支持时直接显示
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* =========================================================
     4. 数字滚动动画（数据仪表盘）
        用法：<div class="stat-num" data-count="40" data-suffix="%">0<span>%</span></div>
     ========================================================= */
  function animateCount(el) {
    const target = parseFloat(el.getAttribute('data-count')) || 0;
    const duration = 1400;          // 动画时长（毫秒）
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic：先快后慢，机械仪表指针减速的感觉
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(target * eased);
      const suffix = el.getAttribute('data-suffix') || '';
      el.innerHTML = current + '<span>' + suffix + '</span>';
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const counters = doc.querySelectorAll('.stat-num[data-count]');

  if ('IntersectionObserver' in window) {
    const counterIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { counterIO.observe(el); });
  } else {
    counters.forEach(animateCount);
  }

  /* =========================================================
     5. 导航滚动高亮（滚动时给顶栏加边框加深效果）
     ========================================================= */
  const nav = doc.querySelector('.nav');

  if (nav) {
    let ticking = false;

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          const scrolled = window.scrollY > 20;
          nav.style.borderBottomColor = scrolled
            ? 'color-mix(in srgb, var(--amber) 40%, var(--line))'
            : 'var(--line)';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* =========================================================
     6. 滚动视差（仅首页生效）
     原理：JS 只负责把滚动量写进 CSS 变量 --py / --sy，
           具体位移由 CSS 用 calc() 乘以不同系数完成，
           各层系数不同 → 移动速度不同 → 产生纵深感
     ========================================================= */
  (function initParallax() {
    const hero = doc.querySelector('.hero');
    if (!hero) return;              // 其他页面没有 hero，直接跳过

    // 系统开启"减少动效"时不做视差
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // 按"元素中心与视口中心的偏移量"位移的层
    const offsetLayers = doc.querySelectorAll('.stats, .sec-head');
    let ticking = false;

    function update() {
      // ① 首屏层：直接吃滚动距离
      hero.style.setProperty('--py', (window.scrollY || window.pageYOffset) + 'px');

      // ② 其它层：元素滚到画面正中时位移为 0，越靠边偏移越大
      const viewportCenter = window.innerHeight / 2;

      offsetLayers.forEach(function (el) {
        const rect = el.getBoundingClientRect();
        // 元素在视口之外就跳过，省掉不必要的计算
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
        const delta = (rect.top + rect.height / 2) - viewportCenter;
        el.style.setProperty('--sy', delta.toFixed(1) + 'px');
      });

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();   // 首屏进来先算一次，避免初始位置跳动
  })();
})();

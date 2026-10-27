/* =============================================================
   黄振宇 · 个人简历网站 —— 星空背景
   说明：全站共用的一层 Canvas 星空，固定在最底层。
         包含三类元素：
           ① 静态星点（大小/亮度随机，缓慢漂移）
           ② 闪烁的亮星（正弦呼吸）
           ③ 偶尔划过的流星
   性能：星点数量按屏幕面积计算并设上限；
         系统开启"减少动效"时降级为静态星图，不跑动画循环。
   ============================================================= */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 创建画布 ---------- */
  var canvas = document.createElement('canvas');
  canvas.id = 'starfield';
  canvas.setAttribute('aria-hidden', 'true');

  function mount() {
    // 插到 body 最前面，保证在内容层之下
    if (document.body.firstChild) {
      document.body.insertBefore(canvas, document.body.firstChild);
    } else {
      document.body.appendChild(canvas);
    }
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }

  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;

  /* ---------- 2. 星点数据 ---------- */
  var stars = [];
  var meteors = [];

  // 星点配色：以奶油白为主，掺少量星尘蓝与暖金
  var PALETTE = [
    { c: '#fff8dc', w: 62 },   // 奶油白
    { c: '#cfe2ff', w: 22 },   // 冷白
    { c: '#8fb8e8', w: 11 },   // 星尘蓝
    { c: '#e8cb79', w: 5 }     // 暖金
  ];

  // 按权重随机取一个颜色
  var TOTAL_W = PALETTE.reduce(function (s, p) { return s + p.w; }, 0);

  function pickColor() {
    var r = Math.random() * TOTAL_W;
    for (var i = 0; i < PALETTE.length; i++) {
      r -= PALETTE[i].w;
      if (r <= 0) return PALETTE[i].c;
    }
    return PALETTE[0].c;
  }

  function buildStars() {
    // 面积换算数量，桌面约 200 颗，小屏自动减少
    var count = Math.floor((W * H) / 9000);
    count = Math.max(70, Math.min(230, count));

    stars = [];
    for (var i = 0; i < count; i++) {
      var big = Math.random() > 0.93;      // 少数亮星更大更亮
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: big ? 1.3 + Math.random() * 1.1 : 0.35 + Math.random() * 0.85,
        a: big ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 1.05,     // 闪烁速度
        dx: (Math.random() - 0.5) * 0.02,       // 极缓慢的横向漂移
        dy: -0.012 - Math.random() * 0.03,      // 整体微微上升，像在呼吸
        color: pickColor(),
        glow: big
      });
    }
  }

  /* ---------- 3. 尺寸处理 ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildStars();
    if (reduceMotion) drawStatic();
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  }, { passive: true });

  /* ---------- 4. 绘制 ---------- */
  function drawStars(t) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      // 闪烁：正弦呼吸，振幅固定，保证最暗时也看得见
      var tw = 0.62 + 0.38 * Math.sin(t * s.speed + s.phase);
      var alpha = s.a * tw;

      if (s.glow) {
        // 亮星带一圈柔和光晕
        var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
        g.addColorStop(0, s.color);
        g.addColorStop(1, 'rgba(255, 248, 220, 0)');
        ctx.globalAlpha = alpha * 0.32;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // 缓慢漂移，移出边界后从另一侧回绕
      s.x += s.dx;
      s.y += s.dy;
      if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
      if (s.x < -4) s.x = W + 4;
      if (s.x > W + 4) s.x = -4;
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 5. 流星 ---------- */
  function spawnMeteor() {
    // 从上方随机位置出发，斜向左下划过
    var startX = W * (0.35 + Math.random() * 0.65);
    meteors.push({
      x: startX,
      y: -40,
      vx: -(1.9 + Math.random() * 2.4),
      vy: 2.2 + Math.random() * 2.6,
      len: 90 + Math.random() * 130,
      life: 1,
      decay: 0.008 + Math.random() * 0.008
    });
  }

  function drawMeteors() {
    for (var i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i];
      var tailX = m.x - m.vx * (m.len / 9);
      var tailY = m.y - m.vy * (m.len / 9);

      var g = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      g.addColorStop(0, 'rgba(255, 248, 220, ' + m.life + ')');
      g.addColorStop(0.4, 'rgba(232, 203, 121, ' + m.life * 0.5 + ')');
      g.addColorStop(1, 'rgba(143, 184, 232, 0)');

      ctx.globalAlpha = 1;
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      m.x += m.vx;
      m.y += m.vy;
      m.life -= m.decay;

      // 淡尽或跑出画面就移除
      if (m.life <= 0 || m.y > H + 60 || m.x < -160) meteors.splice(i, 1);
    }
  }

  /* ---------- 6. 静态星图（减少动效模式） ---------- */
  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 7. 动画主循环 ---------- */
  var start = null;
  var running = false;                      // 防止重复启动导致多个循环并行
  var nextMeteor = 4 + Math.random() * 6;   // 首颗流星延迟（秒）

  function loop(now) {
    if (!running) return;
    if (start === null) start = now;
    var t = (now - start) / 1000;

    ctx.clearRect(0, 0, W, H);
    drawStars(t);

    // 按时间间隔生成流星
    if (t > nextMeteor) {
      spawnMeteor();
      nextMeteor = t + 6 + Math.random() * 11;
    }
    drawMeteors();

    requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running || reduceMotion) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
  }

  /* ---------- 8. 启动 ---------- */
  resize();
  startLoop();

  // 页面切到后台时停止绘制省电，回到前台再继续（避免多个循环叠加）
  document.addEventListener('visibilitychange', function () {
    if (reduceMotion) return;
    if (document.hidden) {
      stopLoop();
    } else {
      start = null;      // 重置时间基准，避免回来后相位突跳
      startLoop();
    }
  });
})();

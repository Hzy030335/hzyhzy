/* =============================================================
   黄振宇 · 个人简历网站 —— 星球引导页逻辑
   流程：星球升起 → 状态文案推进 → 抵达完成 → 出现进入按钮
         → 点击（或倒计时结束）淡出 → 露出主页
   说明：同一次会话内只播放一次，避免每次翻页都重来。
         系统开启"减少动效"时直接跳过。
   ============================================================= */

(function () {
  'use strict';

  var gate = document.getElementById('planetGate');
  if (!gate) return;

  var KEY = 'hzy-planet-gate';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 本次会话是否已经看过引导页
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { seen = false; }

  /* ---------- 跳过：直接移除引导页 ---------- */
  function skip() {
    if (gate.parentNode) gate.parentNode.removeChild(gate);
    document.body.classList.remove('gate-open');
  }

  if (seen || reduceMotion) {
    skip();
    return;
  }

  /* ---------- 正常播放 ---------- */
  var statusEl = document.getElementById('gateStatus');
  var enterBtn = document.getElementById('gateEnter');

  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  var entered = false;

  // 进入主页：淡出引导页并解锁滚动
  function enter() {
    if (entered) return;
    entered = true;

    timers.forEach(clearTimeout);
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* 隐私模式下忽略 */ }

    gate.classList.add('gone');
    document.body.classList.remove('gate-open');

    // 等淡出动画走完再移除节点
    setTimeout(function () {
      if (gate.parentNode) gate.parentNode.removeChild(gate);
    }, 1100);
  }

  // 状态文案推进：与进度条动画节奏对齐
  later(function () {
    if (statusEl) statusEl.textContent = '正在穿过大气层…';
  }, 1500);

  later(function () {
    if (statusEl) {
      statusEl.textContent = '抵达完成';
      statusEl.classList.add('done');
    }
  }, 3500);

  later(function () {
    if (enterBtn) enterBtn.classList.add('show');
  }, 3600);

  // 兜底：用户一直不点，9 秒后自动进入
  later(enter, 9000);

  if (enterBtn) enterBtn.addEventListener('click', enter);

  // 键盘也能进入，兼顾无障碍
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') enter();
  });
})();

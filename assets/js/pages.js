/* =============================================================
   子页面交互脚本
   功能：技能雷达图（原生 SVG）/ 进度条动画 / 经历筛选 / 证书灯箱 / 一键复制 / 打印
   依赖：main.js
   ============================================================= */

(function () {
  'use strict';

  const doc = document;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** 创建 SVG 元素的快捷方法 */
  function svgEl(tag, attrs) {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  /* =========================================================
     1. 技能雷达图（纯原生 SVG 绘制，无第三方库）
     ========================================================= */
  const SKILLS = [
    { name: 'AI 应用开发', value: 85 },
    { name: '演示汇报', value: 88 },
    { name: '调研与写作', value: 85 },
    { name: '工具开发', value: 82 },
    { name: '提示词工程', value: 80 },
    { name: '前端基础', value: 60 }
  ];

  const RADAR_CFG = {
    cx: 200,        // 圆心 X
    cy: 200,        // 圆心 Y
    radius: 122,    // 最大半径
    rings: 5,       // 网格层数
    labelOffset: 30 // 标签外扩距离
  };

  /**
   * 计算某个维度某个数值对应的坐标
   * @param {number} index 维度下标
   * @param {number} ratio 0~1 的占比
   */
  function pointAt(index, ratio) {
    const total = SKILLS.length;
    // 从正上方（-90°）开始顺时针排列
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const r = RADAR_CFG.radius * ratio;
    return {
      x: RADAR_CFG.cx + r * Math.cos(angle),
      y: RADAR_CFG.cy + r * Math.sin(angle),
      angle: angle
    };
  }

  /** 由一组点生成 polygon 的 points 字符串 */
  function toPoints(list) {
    return list.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  }

  function drawRadar() {
    const svg = doc.getElementById('radar');
    if (!svg) return;

    const { cx, cy, radius, rings } = RADAR_CFG;

    // ---- ① 背景同心网格（六边形蛛网） ----
    for (let ring = rings; ring >= 1; ring--) {
      const ratio = ring / rings;
      const pts = SKILLS.map(function (_, i) { return pointAt(i, ratio); });
      svg.appendChild(svgEl('polygon', {
        points: toPoints(pts),
        class: 'radar-web',
        'stroke-opacity': ring === rings ? 1 : 0.45
      }));
    }

    // ---- ② 从圆心出发的轴线 ----
    SKILLS.forEach(function (_, i) {
      const outer = pointAt(i, 1);
      svg.appendChild(svgEl('line', {
        x1: cx, y1: cy, x2: outer.x, y2: outer.y, class: 'radar-axis'
      }));
    });

    // ---- ③ 数据区域多边形（初始为 0，稍后动画展开） ----
    const area = svgEl('polygon', {
      points: toPoints(SKILLS.map(function () { return { x: cx, y: cy }; })),
      class: 'radar-area'
    });
    svg.appendChild(area);

    // ---- ④ 各维度的数据点 ----
    const dots = SKILLS.map(function () {
      const dot = svgEl('circle', { cx: cx, cy: cy, r: 4, class: 'radar-point' });
      svg.appendChild(dot);
      return dot;
    });

    // ---- ⑤ 维度名称与数值标签 ----
    SKILLS.forEach(function (skill, i) {
      const p = pointAt(i, 1);
      const lx = cx + (radius + RADAR_CFG.labelOffset) * Math.cos(p.angle);
      const ly = cy + (radius + RADAR_CFG.labelOffset) * Math.sin(p.angle);

      // 根据水平位置决定对齐方式，避免标签压到图形上
      const cosA = Math.cos(p.angle);
      let anchor = 'middle';
      if (cosA > 0.3) anchor = 'start';
      else if (cosA < -0.3) anchor = 'end';

      // 标签竖向微调：正上方/正下方的点需要往外挪一点
      const dy = Math.abs(cosA) < 0.3 ? (Math.sin(p.angle) > 0 ? 12 : -4) : 4;

      const label = svgEl('text', {
        x: lx, y: ly + dy, class: 'radar-label', 'text-anchor': anchor
      });
      label.textContent = skill.name;
      svg.appendChild(label);

      const value = svgEl('text', {
        x: lx, y: ly + dy + 15, class: 'radar-value', 'text-anchor': anchor
      });
      value.textContent = skill.value + '%';
      svg.appendChild(value);
    });

    // ---- ⑥ 展开动画（easeOutCubic，1200ms） ----
    function runAnimation() {
      const duration = 1200;
      const start = performance.now();

      function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // 先快后慢

        const pts = SKILLS.map(function (skill, i) {
          return pointAt(i, (skill.value / 100) * eased);
        });

        area.setAttribute('points', toPoints(pts));
        pts.forEach(function (p, i) {
          dots[i].setAttribute('cx', p.x.toFixed(1));
          dots[i].setAttribute('cy', p.y.toFixed(1));
        });

        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    // 滚动到可视区域时再播放动画
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runAnimation();
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.35 });
      io.observe(svg);
    } else {
      runAnimation();
    }
  }

  /* =========================================================
     2. 技能进度条动画
     ========================================================= */
  function animateBars() {
    const fills = doc.querySelectorAll('.skill-fill[data-w]');

    function fill() {
      fills.forEach(function (el, i) {
        const w = el.getAttribute('data-w');
        // 逐条延迟，形成依次推进的节奏感
        setTimeout(function () { el.style.width = w + '%'; }, i * 120);
      });
    }

    if ('IntersectionObserver' in window && fills.length) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            fill();
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });
      io.observe(doc.getElementById('skillBars') || fills[0]);
    } else {
      fill();
    }
  }

  /* =========================================================
     3. 经历页 —— 分类筛选
     ========================================================= */
  function initFilters() {
    const buttons = doc.querySelectorAll('.filter-btn');
    const items = doc.querySelectorAll('.tl-item');
    const noResult = doc.getElementById('noResult');

    if (!buttons.length || !items.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        // 切换按钮激活态
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        let visible = 0;

        items.forEach(function (item) {
          const match = filter === 'all' || item.getAttribute('data-cat') === filter;
          item.classList.toggle('hide', !match);
          if (match) visible++;
        });

        if (noResult) noResult.style.display = visible ? 'none' : 'block';
      });
    });
  }

  /* =========================================================
     4. 证书页 —— 3D 翻转卡片 + 灯箱
     ========================================================= */

  // 把灯箱的 open 方法暴露出来，供翻转卡片背面的「查看大图」按钮调用
  let openLightbox = null;

  /** 3D 翻转卡片：点击翻面，键盘 Enter / 空格同样可翻 */
  function initFlipCards() {
    const cards = doc.querySelectorAll('.flip-card');
    if (!cards.length) return;

    cards.forEach(function (card, index) {
      // 点击卡片翻面；若点的是背面的按钮，则交给按钮自己处理
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-zoom]') || e.target.closest('[data-unflip]')) return;
        card.classList.toggle('flipped');
      });

      // 键盘可达性：Enter / 空格翻面
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.classList.toggle('flipped');
        }
      });

      // 背面「查看大图」→ 打开灯箱
      const zoom = card.querySelector('[data-zoom]');
      if (zoom) {
        zoom.addEventListener('click', function (e) {
          e.stopPropagation();
          if (openLightbox) openLightbox(index);
        });
      }

      // 背面「翻回正面」
      const unflip = card.querySelector('[data-unflip]');
      if (unflip) {
        unflip.addEventListener('click', function (e) {
          e.stopPropagation();
          card.classList.remove('flipped');
        });
      }
    });
  }

  function initLightbox() {
    const cards = doc.querySelectorAll('.flip-card');
    const box = doc.getElementById('lightbox');
    const boxImg = doc.getElementById('lbImg');
    const boxTitle = doc.getElementById('lbTitle');
    const boxSub = doc.getElementById('lbSub');
    const closeBtn = doc.getElementById('lbClose');

    if (!cards.length || !box) return;

    let current = 0;

    function open(index) {
      current = index;
      const card = cards[index];
      boxImg.src = card.getAttribute('data-src');
      boxImg.alt = card.getAttribute('data-title') || '证书';
      boxTitle.textContent = card.getAttribute('data-title') || '';
      boxSub.textContent = card.getAttribute('data-sub') || '';
      box.classList.add('open');
      doc.body.style.overflow = 'hidden';   // 打开时锁定页面滚动
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      box.classList.remove('open');
      doc.body.style.overflow = '';
    }

    function step(offset) {
      current = (current + offset + cards.length) % cards.length;
      open(current);
    }

    cards.forEach(function (card, i) {
      card.addEventListener('click', function () { open(i); });
    });

    if (closeBtn) closeBtn.addEventListener('click', close);

    // 点击图片以外的空白区域关闭
    box.addEventListener('click', function (e) {
      if (e.target === box) close();
    });

    // 键盘控制
    doc.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    });

    // 暴露给翻转卡片使用
    openLightbox = open;
  }

  /* =========================================================
     5. 一键复制 + 吐司提示
     ========================================================= */
  function initCopy() {
    const btns = doc.querySelectorAll('.copy-btn');
    const toast = doc.getElementById('toast');
    let toastTimer = null;

    function showToast(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
    }

    function buttonDone(btn) {
      const old = btn.textContent;
      btn.textContent = '已复制 ✓';
      btn.classList.add('done');
      setTimeout(function () {
        btn.textContent = old;
        btn.classList.remove('done');
      }, 1800);
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const text = btn.getAttribute('data-copy') || '';

        // 优先用现代剪贴板 API，失败时回退到 textarea + execCommand
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text)
            .then(function () { buttonDone(btn); showToast('已复制：' + text); })
            .catch(function () { fallbackCopy(text, btn, showToast); });
        } else {
          fallbackCopy(text, btn, showToast);
        }
      });
    });

    function fallbackCopy(text, btn, showToast) {
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      try {
        doc.execCommand('copy');
        buttonDone(btn);
        showToast('已复制：' + text);
      } catch (err) {
        showToast('复制失败，请手动选中');
      }
      doc.body.removeChild(ta);
    }
  }

  /* =========================================================
     6. 打印 / 存为 PDF
     ========================================================= */
  function initPrint() {
    const btn = doc.getElementById('printBtn');
    if (btn) btn.addEventListener('click', function () { window.print(); });
  }

  /* =========================================================
     启动
     ========================================================= */
  function init() {
    drawRadar();
    animateBars();
    initFilters();
    initLightbox();
    initFlipCards();
    initCopy();
    initPrint();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

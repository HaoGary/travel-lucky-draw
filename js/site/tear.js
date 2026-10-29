/* ==========================================================
   tear.js — 撕籤效果（像撕紙一樣）
   - 籤頭沿一條不規則的鋸齒撕線，被切成多條細片；
     手指往右拖，撕開的部分會一片片翹起、捲曲（跟著手指走，撕了就回不去）。
   - 撕過一半放手或按「直接撕開」→ 自動撕完，整條籤頭飛走、灑出紙屑，
     接著下方折起的籤紙翻開，露出結果。
   用法：App.tear.mount(ticketEl, { label, onDone })
   ========================================================== */
window.App = window.App || {};

App.tear = (function () {
  const SLICES = 28;          // 籤頭切成幾條（越多越細緻）
  const STRIP_H = 58;         // 籤頭高度（含撕線區）
  const TEAR_Y = 48;          // 撕線平均高度
  const AUTO_FINISH = 0.55;   // 放手時超過這個比例就自動撕完
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 固定種子亂數：每張籤的撕痕都不同，但同一張重畫不會跳動 */
  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  /* 產生撕線：每 3–6px 一個點，上下抖動，偶爾有較深的纖維缺口 */
  function tearLine(width, rand) {
    const pts = [];
    let x = 0;
    while (x < width) {
      const deep = rand() < .12 ? (rand() * 4 + 2) : 0;
      pts.push([x, TEAR_Y + (rand() - .5) * 6 + deep]);
      x += 3 + rand() * 3;
    }
    pts.push([width, TEAR_Y + (rand() - .5) * 6]);
    return pts;
  }

  /* 取撕線在 [x0, x1] 區間的點（含兩端插值），給每條細片當下緣 */
  function segment(pts, x0, x1) {
    const yAt = x => {
      for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] >= x) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
          return ay + (by - ay) * ((x - ax) / (bx - ax || 1));
        }
      }
      return pts[pts.length - 1][1];
    };
    return [[x0, yAt(x0)], ...pts.filter(p => p[0] > x0 && p[0] < x1), [x1, yAt(x1)]];
  }

  function mount(ticket, { label, onDone }) {
    const strip = ticket.querySelector(".ib-ticket__strip");
    const edge = ticket.querySelector(".ib-ticket__edge");
    const bits = ticket.querySelector(".ib-ticket__bits");
    const W = ticket.offsetWidth;
    const rand = rng((Date.now() & 0xffff) + 7);
    const line = tearLine(W, rand);
    const sw = W / SLICES;

    /* ---- 籤頭細片 ---- */
    const faceHTML = `
      <div class="ib-ticket__face" style="width:${W}px">
        <span class="ib-ticket__label">${label}</span>
        <span class="ib-ticket__grip" aria-hidden="true"></span>
        <span class="ib-ticket__perf"></span>
      </div>`;
    const slices = [];
    for (let i = 0; i < SLICES; i++) {
      const x0 = i * sw, x1 = Math.min(W, x0 + sw + 1); // +1px 重疊，避免細縫
      const seg = segment(line, x0, x1);
      const poly = [`0px 0px`, `${x1 - x0}px 0px`, ...seg.reverse().map(([x, y]) => `${(x - x0).toFixed(1)}px ${y.toFixed(1)}px`)];
      const el = document.createElement("div");
      el.className = "ib-ticket__shred";
      el.style.cssText = `left:${x0}px;width:${x1 - x0}px;height:${STRIP_H}px`;
      el.innerHTML = `<div class="ib-ticket__shred-clip" style="clip-path:polygon(${poly.join(",")})"><div class="ib-ticket__shred-face" style="left:${-x0}px">${faceHTML}</div></div>`;
      strip.appendChild(el);
      slices.push(el);
    }
    strip.style.height = STRIP_H + "px";

    /* ---- 籤紙上緣的撕痕（撕掉籤頭後露出，米白紙纖維） ---- */
    const top = TEAR_Y - 8;
    const d = "M0 " + (STRIP_H - top) + " " +
      line.map(([x, y]) => `L${x.toFixed(1)} ${(y - top).toFixed(1)}`).join(" ") +
      ` L${W} ${STRIP_H - top} Z`;
    edge.setAttribute("viewBox", `0 0 ${W} ${STRIP_H - top}`);
    edge.style.top = top + "px";
    edge.style.height = (STRIP_H - top) + "px";
    edge.innerHTML = `<path d="${d}" class="ib-ticket__edge-paper"/>` +
      `<path d="${"M" + line.map(([x, y]) => `${x.toFixed(1)} ${(y - top).toFixed(1)}`).join(" L")}" class="ib-ticket__edge-fiber"/>`;

    /* ---- 撕開進度 ---- */
    let p = 0, last = -1, finished = false;
    const ease = t => 1 - Math.pow(1 - t, 2);
    /* 撕開的部分沿一道弧線往上捲（像紙被拉起、反折），整段是連續的一片：
       撕點 xt 左邊的每條細片，依與撕點的距離放到弧線上並旋轉同樣角度 */
    const R = W * 0.42;                        // 捲曲半徑
    function render() {
      const xt = p * W;
      const torn = Math.floor(p * SLICES);
      slices.forEach((el, i) => {
        const cx = (i + 0.5) * sw;
        const dist = xt - cx;
        if (dist <= 0) {
          el.style.transform = "";
          el.style.setProperty("--lift", 0);
          el.classList.remove("is-torn");
          return;
        }
        const th = Math.min(dist / R, 2.4);    // 弧度，上限約 137°
        const X = xt - R * Math.sin(th);
        const Y = -R * (1 - Math.cos(th)) * 0.55;  // 壓扁一點，避免捲太高
        el.style.transform = `translate(${(X - cx).toFixed(1)}px, ${Y.toFixed(1)}px) rotate(${(th * 57.3).toFixed(1)}deg)`;
        el.style.setProperty("--lift", Math.min(1, th / 1.2).toFixed(3));
        el.classList.add("is-torn");
      });
      ticket.style.setProperty("--p", p.toFixed(3));
      if (torn > last && last >= 0) {
        try { navigator.vibrate && navigator.vibrate(6); } catch (e) {}
      }
      last = torn;
    }
    render();

    function animateTo(target, ms, cb) {
      if (reduce) { p = target; render(); cb && cb(); return; }
      const from = p, t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / ms);
        p = from + (target - from) * ease(k);
        render();
        if (k < 1) requestAnimationFrame(step); else cb && cb();
      };
      requestAnimationFrame(step);
    }

    /* 撕完：籤頭飛走 → 紙屑 → 翻開籤紙 → 顯示結果 */
    function finish() {
      if (finished) return;
      finished = true;
      ticket.classList.add("is-tearing");
      animateTo(1, 260, () => {
        ticket.classList.add("is-ripped");
        spawnBits();
        setTimeout(() => ticket.classList.add("is-open"), reduce ? 0 : 380);
        setTimeout(() => onDone && onDone(), reduce ? 300 : 1500);
      });
    }

    function spawnBits() {
      if (reduce) return;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 14; i++) {
        const b = document.createElement("i");
        const x = rand() * W;
        b.className = "ib-ticket__bit" + (rand() < .5 ? " is-red" : "");
        b.style.cssText = `left:${x}px;top:${TEAR_Y}px;--dx:${((rand() - .3) * 120).toFixed(0)}px;--dy:${(-40 - rand() * 70).toFixed(0)}px;--r:${((rand() - .5) * 540).toFixed(0)}deg;--s:${(.6 + rand() * .8).toFixed(2)};animation-delay:${(rand() * 120).toFixed(0)}ms`;
        frag.appendChild(b);
      }
      bits.appendChild(frag);
    }

    /* ---- 拖曳 ---- */
    let x0 = null, p0 = 0;
    strip.addEventListener("pointerdown", e => {
      if (finished) return;
      x0 = e.clientX; p0 = p;
      strip.setPointerCapture(e.pointerId);
      ticket.classList.add("is-grabbing");
    });
    strip.addEventListener("pointermove", e => {
      if (x0 === null || finished) return;
      const np = Math.min(1, p0 + Math.max(0, e.clientX - x0) / W);
      if (np > p) { p = np; render(); }   // 只會往前撕，不會黏回去
      if (p >= .98) finish();
    });
    const release = () => {
      if (x0 === null) return;
      x0 = null;
      ticket.classList.remove("is-grabbing");
      if (!finished && p >= AUTO_FINISH) finish();
    };
    strip.addEventListener("pointerup", release);
    strip.addEventListener("pointercancel", release);

    return { finish, get progress() { return p; } };
  }

  return { mount };
})();

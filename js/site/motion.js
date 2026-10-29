/* ==========================================================
   motion.js — 全站動畫（GSAP 3 + ScrollTrigger）
   --------------------------------------------------------
   原則：只在有目的的地方加動畫（開場層次、捲動引導、數據變化、操作回饋、區塊切換）。
   - 只動 opacity（autoAlpha）與 transform，不動版面屬性。
   - GSAP 沒載入、或使用者開啟「減少動態效果」時，所有函式直接套用最終狀態，功能不受影響。
   - 其他模組只呼叫這裡的函式，不直接寫 gsap，調整動畫只需改這支檔案。

   調整方式：改下方 MOTION 設定即可
     dur.*        各類動畫時長（秒）
     ease.*       緩動曲線
     stagger      錯開進場的間隔（秒）
     rise         進場時向上位移的距離（px）
     scrollStart  捲動觸發點："top 85%" = 元素頂端進到視窗 85% 高度時播放
   ========================================================== */
window.App = window.App || {};

App.motion = (function () {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const prefersReduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ON = !!gsap && !prefersReduce;     // 是否播放動畫

  /* ---------- 統一動畫規範 ---------- */
  const MOTION = {
    dur: { fast: 0.25, base: 0.5, slow: 0.8, count: 0.7 },
    ease: { out: "power3.out", in: "power2.in", soft: "power2.out", pop: "back.out(1.4)" },
    stagger: 0.08,
    rise: 24,
    scrollStart: "top 85%"
  };

  if (gsap) {
    if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ duration: MOTION.dur.base, ease: MOTION.ease.out });
  }

  let ready = false;   // init() 之前的第一次渲染直接套最終值，不播放更新動畫
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* ======================================================
     1. 頁面進場：主視覺 timeline
     ====================================================== */
  function intro() {
    const tl = gsap.timeline({ defaults: { ease: MOTION.ease.out } });
    tl.from(".ib-hero__bg", { autoAlpha: 0, scale: 1.04, duration: MOTION.dur.slow })
      .from(".ib-hero__logo", { autoAlpha: 0, y: -16 }, "-=0.45")
      .from([".ib-hero__subtitle", ".ib-hero__title-a", ".ib-hero__title-b"],
        { autoAlpha: 0, y: -20, stagger: 0.1 }, "-=0.25")
      .from(".ib-hero__ribbon", { autoAlpha: 0, y: 12, scaleX: 0.92 }, "-=0.3")
      // 按鈕提早出現，整段開場約 1.2 秒內完成，不讓使用者久等
      .from(".ib-quicklinks__btn", { opacity: 0, y: 16, stagger: MOTION.stagger }, "-=0.4");
    return tl;
  }

  /* ======================================================
     2. 捲動進場（各區塊只觸發一次）
     ====================================================== */
  /* 捲動進場用 opacity（不用 autoAlpha）：元素在動畫前仍可被點擊、鍵盤聚焦，不阻擋操作 */
  function onScroll(target, vars, trigger) {
    return gsap.from(target, {
      opacity: 0,
      y: MOTION.rise,
      ...vars,
      scrollTrigger: { trigger: trigger || target, start: MOTION.scrollStart, once: true }
    });
  }

  function scrollReveals() {
    // 區塊標題、遊戲區：整塊淡入上移
    onScroll(".ib-game-title");
    onScroll("#board", { y: MOTION.rise * 1.5, duration: MOTION.dur.slow });

    // 角色縮圖：錯開進場（只影響初次渲染的縮圖，切換角色後重建的縮圖直接顯示）
    onScroll(".ib-picker__item", { y: 16, stagger: 0.06, duration: MOTION.dur.base }, "#picker");

    // 本輪狀態：區塊淡入，同時剩餘數字從 0 數上來、進度條展開
    const status = $(".ib-status");
    if (status) {
      gsap.timeline({ scrollTrigger: { trigger: status, start: MOTION.scrollStart, once: true } })
        .from(status, { opacity: 0, y: MOTION.rise })
        .from(".ib-status__round", { scale: 0.6, opacity: 0, ease: MOTION.ease.pop }, "-=0.3")
        .add(() => {
          const left = $("#left"), fill = $("#leftFill");
          const value = +left.textContent;
          countTo(left, value, { from: 0 });
          if (fill) gsap.from(fill, { scaleX: 0, duration: MOTION.dur.count, ease: MOTION.ease.soft });
        }, "-=0.35");
    }

    // 獎項掛軸與卡片：掛軸先出現，卡片進到畫面時分批錯開進場
    onScroll(".ib-scroll", { duration: MOTION.dur.slow });
    const cards = $$(".ib-prize-card");
    if (cards.length && ScrollTrigger) {
      gsap.set(cards, { opacity: 0, y: MOTION.rise });
      ScrollTrigger.batch(cards, {
        start: "top 90%",
        once: true,
        onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: MOTION.stagger, overwrite: true })
      });
    }

    // 活動說明：整塊淡入即可，不逐行動畫
    onScroll(".ib-rules");
  }

  /* ======================================================
     3. 數字與進度
     ====================================================== */
  const fmt = n => Math.round(n).toLocaleString("en-US");

  /* 數字滾動到新值；from 未指定時從畫面目前的數字開始 */
  function countTo(el, value, { from, format = fmt } = {}) {
    if (!el) return;
    if (!ON || !ready) { el.textContent = format(value); return; }
    const start = from != null ? from : +String(el.textContent).replace(/[^\d.-]/g, "") || 0;
    if (start === value) { el.textContent = format(value); return; }
    const obj = { v: start };
    gsap.killTweensOf(el._countObj || {});
    el._countObj = obj;
    gsap.to(obj, {
      v: value,
      duration: MOTION.dur.count,
      ease: MOTION.ease.soft,
      onUpdate: () => { el.textContent = format(obj.v); }
    });
  }

  /* 進度條：以 scaleX 表示比例（0–1） */
  function progress(el, ratio) {
    if (!el) return;
    if (!ON || !ready) { el.style.transform = `scaleX(${ratio})`; return; }
    gsap.to(el, { scaleX: ratio, duration: MOTION.dur.count, ease: MOTION.ease.soft, overwrite: true });
  }

  /* 數值改變時的輕微脈動（數位幣扣款／回饋） */
  function pulse(el) {
    if (!el) return;
    if (!ON) {   // 沒有 GSAP 時沿用 CSS 版
      el.classList.remove("ib-wallet__amount--bump");
      void el.offsetWidth;
      el.classList.add("ib-wallet__amount--bump");
      return;
    }
    gsap.fromTo(el, { scale: 1.15 }, { scale: 1, duration: 0.45, ease: MOTION.ease.soft, overwrite: true });
  }

  /* ======================================================
     4. 狀態切換
     ====================================================== */
  /* 換角色：遊戲區底圖淡入 */
  function swapImage(img) {
    if (!ON || !ready || !img) return;
    gsap.fromTo(img, { autoAlpha: 0, scale: 1.02 }, { autoAlpha: 1, scale: 1, duration: MOTION.dur.base, overwrite: true });
  }

  /* 從下方滑入（抽獎操作列） */
  function slideUp(el) {
    if (!ON || !ready || !el) return;
    gsap.fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: MOTION.dur.fast + 0.1, overwrite: true });
  }

  /* ======================================================
     5. 彈窗
     ====================================================== */
  function modalIn(modal, { wasOpen = false } = {}) {
    if (!ON || !modal) return;
    gsap.killTweensOf(modal);
    modal.style.pointerEvents = "";
    const panel = modal.firstElementChild;
    const tl = gsap.timeline();
    if (!wasOpen) tl.fromTo(modal, { autoAlpha: 0 }, { autoAlpha: 1, duration: MOTION.dur.fast, ease: "none" });
    else gsap.set(modal, { autoAlpha: 1 });
    if (!panel) return tl;

    const isTear = panel.classList.contains("ib-tear");
    // 撕籤畫面只做位移淡入（不縮放，避免影響撕籤手勢的座標）
    tl.fromTo(panel,
      { autoAlpha: 0, y: 20, scale: isTear ? 1 : 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: MOTION.dur.base, clearProps: "transform" },
      wasOpen ? 0 : "<0.05");

    // 中獎結果：內容依序出現，賞別稍微強調
    if (panel.classList.contains("ib-win")) {
      const items = panel.querySelectorAll(".ib-win__badge, .ib-win__icon, .ib-win__name, .ib-win__note, .ib-win__extra, .ib-win__confirm");
      tl.from(panel.querySelector(".ib-win__grade"), { autoAlpha: 0, scale: 0.8, ease: MOTION.ease.pop }, "-=0.3")
        .from(items, { autoAlpha: 0, y: 12, stagger: 0.07, duration: MOTION.dur.base * 0.8 }, "-=0.3");
    }

    // 中獎看板：剩餘數量的進度條展開
    const bars = panel.querySelectorAll(".ib-stock .progress__fill");
    if (bars.length) {
      tl.from(bars, { scaleX: 0, transformOrigin: "left center", stagger: 0.05, duration: MOTION.dur.count, ease: MOTION.ease.soft }, "-=0.3");
    }
    return tl;
  }

  /* 關閉：播完才移除內容；期間若又開新彈窗，openModal 會中止這段動畫 */
  function modalOut(modal, done) {
    if (!ON || !modal) { done(); return; }
    modal.style.pointerEvents = "none";
    const panel = modal.firstElementChild;
    gsap.timeline({ onComplete: () => { gsap.set(modal, { clearProps: "opacity,visibility" }); modal.style.pointerEvents = ""; done(); } })
      .to(panel, { autoAlpha: 0, y: 12, duration: 0.2, ease: MOTION.ease.in })
      .to(modal, { autoAlpha: 0, duration: 0.2, ease: "none" }, "<0.05");
  }

  /* ======================================================
     6. 提示訊息
     ====================================================== */
  function toastIn(el) {
    if (!ON || !el) return;
    gsap.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: MOTION.dur.fast, overwrite: true });
  }

  function toastOut(el, done) {
    if (!ON || !el) { done(); return; }
    gsap.to(el, { autoAlpha: 0, y: 8, duration: 0.2, ease: MOTION.ease.in, overwrite: true,
      onComplete: () => { gsap.set(el, { clearProps: "opacity,visibility,transform" }); done(); } });
  }

  /* ======================================================
     初始化：只執行一次
     ====================================================== */
  function init() {
    if (ready) return;
    const root = document.documentElement;
    if (ON) {
      intro();
      if (ScrollTrigger) scrollReveals();
    }
    root.classList.remove("motion-pending");   // 進場初始狀態已由 GSAP 設好，取消防閃爍的隱藏
    ready = true;
  }

  return { MOTION, enabled: ON, init, countTo, progress, pulse, swapImage, slideUp, modalIn, modalOut, toastIn, toastOut };
})();

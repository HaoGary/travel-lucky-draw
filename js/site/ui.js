/* ==========================================================
   ui.js — 畫面渲染、彈窗、提示
   ========================================================== */
window.App = window.App || {};

App.ui = (function () {
  const { config, CHARS, PRIZES, PRIZE_ORDER, art, store } = App;
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString("en-US");

  let selected = null;
  const motion = () => App.motion;   // 動畫模組（motion.js）；未載入時各處直接套最終狀態
  const getSel = () => selected;
  const setSel = v => { selected = v; renderBoard(); };

  /* ---------- 頂部幣值 ---------- */
  function renderCoins(bump) {
    const s = store.state, el = $("bal");
    if (motion()) {
      motion().countTo(el, s.balance);
      if (bump) motion().pulse(el);
    } else {
      el.textContent = fmt(s.balance);
    }
  }

  /* ---------- 角色選擇 ----------
     已建立過就只更新選中狀態，不重建 HTML（避免切換角色時橫向捲動位置被重置、整列跳動） */
  function renderPicker(force) {
    const cur = store.state.cur, picker = $("picker");
    const items = picker.children;
    if (!force && items.length === CHARS.length) {         // 只更新選中狀態，保留捲動位置
      for (let i = 0; i < items.length; i++) items[i].setAttribute("aria-pressed", String(i === cur));
      return;
    }
    picker.innerHTML = CHARS.map((c, i) =>
      `<button class="ib-picker__item" aria-pressed="${i === cur}" aria-label="${c.name}" data-i="${i}">${art.figure(c, "ib-picker__figure")}</button>`
    ).join("");
  }

  /* 選到角色時，讓這隻靠近左緣、把下一隻帶進視野（平滑捲動；最後一隻才不再往左推） */
  function scrollPickerTo(i) {
    const picker = $("picker"), item = picker.children[i];
    if (!item) return;
    const pad = parseFloat(getComputedStyle(picker).paddingLeft) || 0;
    const target = item.offsetLeft - picker.offsetLeft - pad;
    const max = picker.scrollWidth - picker.clientWidth;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    picker.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------- 遊戲區格子 ---------- */
  function renderBoard() {
    const c = store.currentChar(), b = store.currentBoard();
    const boardEl = $("board");
    boardEl.style.setProperty("--board-cols", config.COLS);
    boardEl.style.setProperty("--board-rows", config.ROWS);
    const artEl = $("art");
    if (artEl.getAttribute("src") !== c.board) {
      artEl.src = c.board; artEl.alt = `${c.name} 遊戲區`;
      motion() && motion().swapImage(artEl);
    }

    const g = $("grid");
    g.innerHTML = "";
    b.cells.forEach((k, i) => {
      const el = document.createElement("button");
      el.className = "ib-board__cell";
      el.dataset.i = i;
      if (b.opened[i]) {
        el.disabled = true;
        el.setAttribute("aria-label", `第${i + 1}格 已抽出 ${k}賞`);
      } else {
        el.setAttribute("aria-label", `第${i + 1}格`);
        if (selected === i) el.classList.add("ib-board__cell--selected");
        // 只在管理頁預覽中顯示每格賞別；正式頁面不輸出，避免從頁面原始碼看到位置
        if (store.reveal) { el.dataset.grade = k; el.classList.add("ib-board__cell--reveal"); }
      }
      g.appendChild(el);
    });

    const left = store.leftCount(b), total = b.cells.length;
    $("round").textContent = b.round;
    $("total").textContent = total;
    if (motion()) {
      motion().countTo($("left"), left);
      motion().progress($("leftFill"), left / total);
    } else {
      $("left").textContent = left;
      $("leftFill").style.transform = `scaleX(${left / total})`;
    }
    const bar = $("leftBar");
    bar.setAttribute("aria-valuemax", total);
    bar.setAttribute("aria-valuenow", left);
    const bar2 = $("actionbar"), wasHidden = bar2.hidden;
    bar2.hidden = selected === null;
    if (wasHidden && !bar2.hidden && motion()) motion().slideUp(bar2);
    if (selected !== null) $("selText").textContent = `已選 ${c.name}・第 ${selected + 1} 格`;
    renderPrizes();
  }

  /* ---------- 獎項介紹（卡片，剩餘數量跟著目前角色的籤池） ---------- */
  function stockText(k, b) {
    if (k === "L") {
      const left = store.leftCount(b);
      return left === 1 ? "只剩最後 1 張，抽中即得" : "抽出本輪最後一張即可獲得";
    }
    const r = store.remain(b)[k];
    return r === 0 ? "本輪已抽完" : `本輪剩餘 ${r} / ${store.poolOf(b)[k]}`;
  }

  /* 卡片只建立一次（保留進場動畫與事件），之後只更新剩餘數量與「已抽完」狀態 */
  function renderPrizes() {
    const b = store.currentBoard(), r = store.remain(b);
    const wrap = $("prizes");
    if (wrap.children.length === PRIZE_ORDER.length) {
      PRIZE_ORDER.forEach((k, i) => {
        const card = wrap.children[i];
        card.querySelector(".ib-prize-card__stock").textContent = stockText(k, b);
        card.classList.toggle("ib-prize-card--soldout", k !== "L" && r[k] === 0);
      });
      return;
    }
    wrap.innerHTML = PRIZE_ORDER.map(k => {
      const mods = (k === "L" ? " ib-prize-card--last" : "") + (k !== "L" && r[k] === 0 ? " ib-prize-card--soldout" : "");
      return `
      <article class="ib-prize-card${mods}" style="--card-tint:${PRIZES[k].tint}">
        <div class="ib-prize-card__media">
          <span class="ib-prize-card__badge">${k === "L" ? "LAST ONE" : k + " 賞"}</span>
          ${art.prize(k, "ib-prize-card__icon")}
        </div>
        <div class="ib-prize-card__body">
          <p class="ib-prize-card__label">${PRIZES[k].type}</p>
          <h3 class="ib-prize-card__title">${PRIZES[k].name}</h3>
          <p class="ib-prize-card__stock">${stockText(k, b)}</p>
          <button class="ib-prize-card__cta" data-prize="${k}">查看詳情<span class="ib-prize-card__cta-dot" aria-hidden="true"></span></button>
        </div>
        <span class="ib-prize-card__arrow" aria-hidden="true"></span>
      </article>`;
    }).join("");
  }

  /* 獎品詳情 */
  function showPrize(k) {
    const b = store.currentBoard();
    openModal(sheet(`${art.gradeLabel(k)}｜${PRIZES[k].name}`, `
      <div class="ib-prize-detail">
        ${art.prize(k, "ib-prize-detail__icon")}
        <p class="ib-prize-detail__spec"><b>商品規格</b><br>${PRIZES[k].spec}</p>
        <p class="ib-prize-detail__stock">${store.currentChar().name}・${stockText(k, b)}</p>
      </div>`));
  }

  /* ---------- 提示 ---------- */
  function toast(t) {
    const el = $("toast");
    el.textContent = t; el.hidden = false;
    motion() && motion().toastIn(el);
    clearTimeout(toast.t);
    toast.t = setTimeout(() => {
      const hide = () => (el.hidden = true);
      motion() ? motion().toastOut(el, hide) : hide();
    }, 2200);
  }

  /* ---------- 彈窗 ---------- */
  let modalSeq = 0;   // 用來判斷關閉動畫結束時，是否已被新的彈窗取代
  /* 彈窗開啟時鎖住背景捲動（手機也有效：固定 body 並記住捲動位置） */
  let lockedScrollY = 0;
  function lockScroll() {
    if (document.body.dataset.scrollLock) return;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.scrollLock = "1";
    document.body.style.cssText += `position:fixed;top:${-lockedScrollY}px;left:0;right:0;width:100%;overflow:hidden;`;
  }
  function unlockScroll() {
    if (!document.body.dataset.scrollLock) return;
    delete document.body.dataset.scrollLock;
    ["position", "top", "left", "right", "width", "overflow"].forEach(p => document.body.style.removeProperty(p));
    window.scrollTo(0, lockedScrollY);
  }
  function openModal(html, { lock = false } = {}) {
    const m = $("modal");
    const wasOpen = !m.hidden && m.style.pointerEvents !== "none";
    modalSeq++;
    lockScroll();
    m.innerHTML = html; m.hidden = false;
    motion() && motion().modalIn(m, { wasOpen });
    if (lock) m.dataset.lock = "1"; else delete m.dataset.lock;
    const f = m.querySelector("input, button"); f && f.focus();
  }
  function closeModal() {
    const m = $("modal");
    if (m.hidden) return;
    const seq = ++modalSeq;
    delete m.dataset.lock;
    const done = () => { if (seq === modalSeq) { m.hidden = true; m.innerHTML = ""; unlockScroll(); } };
    motion() ? motion().modalOut(m, done) : done();
  }
  function bindModal() {
    const m = $("modal");
    m.addEventListener("click", e => {
      if (m.dataset.lock) return;
      if (e.target === m || e.target.closest(".modal__close")) closeModal();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !m.hidden && !m.dataset.lock) closeModal();
    });
  }

  const sheet = (title, body) =>
    `<div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="mh">
      <header class="modal__header"><h3 class="modal__title" id="mh">${title}</h3><button class="modal__close" aria-label="關閉">×</button></header>
      <div class="modal__body">${body}</div></div>`;

  /* 抽獎紀錄 */
  function showRecords() {
    const rows = store.state.records.slice().reverse().map(r =>
      `<tr><td>${r.t}</td><td>${r.c}・第${r.cell}格<br><b>${art.gradeLabel(r.g)}</b> ${PRIZES[r.g].name}${
        r.last ? `<br><b class="ib-records__last-one">＋LAST ONE 賞</b>` : ""}</td></tr>`).join("");
    const body = rows
      ? `<table class="table"><thead><tr><th class="ib-records__time-col">時間</th><th>獎項</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="ib-records__empty">還沒有抽獎紀錄。<br>選一個角色、點一格就能開始抽。</div>`;
    openModal(sheet("抽獎紀錄", body +
      `<p class="ib-records__note">目前累積購物金 ${fmt(store.state.voucher)} 枚，將於活動結束後匯入。<br>實體獎項將於中獎後 30 個工作天內寄出。</p>`));
  }

  /* 中獎看板 */
  function showBoard() {
    const c = store.currentChar(), b = store.currentBoard(), r = store.remain(b), left = store.leftCount(b);
    const pool = store.poolOf(b);
    const rows = Object.keys(pool).map(k => `
      <div class="ib-stock">${art.prize(k, "ib-stock__icon")}<div>
        <div class="ib-stock__name">${art.gradeLabel(k)}｜${PRIZES[k].name}</div>
        <div class="progress ib-stock__bar"><span class="progress__fill" style="width:${(r[k] / pool[k]) * 100}%"></span></div>
        <div class="ib-stock__count">剩餘 ${r[k]} / ${pool[k]}</div>
      </div></div>`).join("");
    const lastRow = `
      <div class="ib-stock">${art.prize("L", "ib-stock__icon")}<div>
        <div class="ib-stock__name">LAST ONE 賞｜${PRIZES.L.name}</div>
        <div class="ib-stock__count ib-stock__count--message">${left === 1 ? "只剩最後 1 張，抽中即得！" : `剩 ${left} 張籤，抽出最後一張者獲得`}</div>
      </div></div>`;
    openModal(sheet(`中獎看板・${c.name} 第${b.round}輪`, rows + lastRow));
  }

  return {
    $, renderCoins, renderPicker, scrollPickerTo, renderBoard, renderPrizes,
    toast, openModal, closeModal, bindModal, showRecords, showBoard, showPrize, getSel, setSel
  };
})();

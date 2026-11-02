/* ==========================================================
   catalog.js — 獎品與角色「內容」的定義與套用（活動頁與獎品管理頁共用）
   --------------------------------------------------------
   可在後台修改：獎項的分類文字、名稱、規格、描述、商品圖、圖片裁切、卡片底色；
                 角色的名稱、去背人物圖、遊戲區底圖。
   不在此頁修改：每輪數量與獎品分佈（見 rules.js／遊戲規則頁）；
                 獎項等級、角色數量與順序影響存檔，仍由 config.js 管理。

   資料流程與「活動頁設計管理」相同：
     管理頁（prizes.html）編輯 → 儲存草稿（只存在管理端）→ 發布（寫入已發布版本）→ 活動頁載入時套用
   原型以 localStorage 存放；串接後端時只需改 loadPublished / savePublished。
   ========================================================== */
window.App = window.App || {};

App.catalog = (function () {
  const KEY_PUBLISHED = "ichiban-catalog-published";

  /* 獎項欄位（type = 後台輸入元件；max = 字數上限） */
  const PRIZE_FIELDS = [
    { key: "type", name: "分類文字",  input: "text",     max: 10,  hint: "" },
    { key: "name", name: "商品名稱",  input: "text",     max: 24,  required: true },
    { key: "spec", name: "商品規格",  input: "textarea", max: 120, hint: "尺寸、材質、數量等；顯示在獎品詳情" }
  ];
  const PRIZE_IMG = { size: [640, 640], hint: "正方形" };
  const CHAR_IMGS = [
    { key: "figure", name: "人物去背圖",  size: [500, 500], hint: "透明背景 PNG" },
    { key: "board",  name: "遊戲區底圖",  size: [960, 960], hint: "圖上含角色名，改名請一併更新" }
  ];
  const PRIZE_KEYS = ["type", "name", "spec", "img", "fit", "tint"];

  /* 賞別代碼：1～4 碼英數（與後端一致） */
  const CODE_RE = /^[A-Z0-9]{1,4}$/;
  const pickPrize = (p, fb) => Object.fromEntries(PRIZE_KEYS.map(f => [f, (p && p[f]) ?? (fb ? fb[f] : "")]));

  /* 單一賞別正規化（補欄位、限制安全格式） */
  function normGrade(g) {
    const code = String((g && g.code) || "").toUpperCase();
    return {
      code,
      label: String((g && g.label) || (code + " 賞")),
      color: App.safeColor((g && g.color) || "", "#888888"),
      occupiesCell: !g || g.occupiesCell !== false,
      rewardCurrency: (g && (g.rewardCurrency === "VOUCHER" || g.rewardCurrency === "DIGITAL")) ? g.rewardCurrency : ""
    };
  }

  /* 預設值：取自 config.js 目前的 App.GRADES（必須在 config.js 之後載入） */
  const defaultGrades = () => App.GRADES.map(g => ({ ...g }));
  function defaults() {
    const grades = defaultGrades();
    const prizes = {};
    grades.forEach(g => { prizes[g.code] = pickPrize(App.PRIZES[g.code], App.defaultPrize(g)); });
    const chars = App.CHARS.map(c => ({ id: c.id, name: c.name, figure: c.figure, board: c.board }));
    return JSON.parse(JSON.stringify({ grades, prizes, chars }));
  }

  /* 補上缺少的欄位（舊資料或新增欄位時）；賞別清單以 cat.grades 為準，動態增刪 */
  function normalize(cat) {
    const d = defaults();
    if (!cat) return d;
    const rawGrades = Array.isArray(cat.grades) && cat.grades.length ? cat.grades : d.grades;
    const seen = {};
    const grades = rawGrades.map(normGrade).filter(g => { if (!CODE_RE.test(g.code) || seen[g.code]) return false; seen[g.code] = 1; return true; });
    if (!grades.length) grades.push(...d.grades.map(g => ({ ...g })));
    const prizes = {};
    grades.forEach(g => {
      const saved = (cat.prizes || {})[g.code];
      const fb = d.prizes[g.code] || pickPrize(App.PRIZES[g.code], App.defaultPrize(g));
      const p = Object.fromEntries(PRIZE_KEYS.map(f => [f, (saved && saved[f]) ?? fb[f]]));
      // 安全性：圖片、底色、顯示方式限制成安全格式（避免被當成 HTML／指令碼）
      p.img = App.safeImg(p.img);
      p.tint = App.safeColor(p.tint, fb.tint || g.color);
      p.fit = App.safeFit(p.fit);
      prizes[g.code] = p;
    });
    const chars = d.chars.map(c => {
      const m = { ...c, ...((cat.chars || []).find(x => x.id === c.id) || {}) };
      m.figure = App.safeImg(m.figure);
      m.board = App.safeImg(m.board);
      return m;
    });
    return { grades, prizes, chars };
  }

  /* 活動頁以 innerHTML 輸出這些文字，套用前先轉義；換行轉成 <br> */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const multi = s => esc(s).replace(/\n/g, "<br>");

  /* ---------- 套用到活動頁：就地更新 App.PRIZES / App.CHARS（ui.js 持有同一個物件） ---------- */
  function apply(cat) {
    const c = normalize(cat);
    // 先依賞別清單重建 PRIZE_ORDER / PRIZES / POOL / REWARD 的鍵（動態增刪賞別）
    App.applyGrades(c.grades);
    App.PRIZE_ORDER.forEach(k => {
      const src = c.prizes[k], dst = App.PRIZES[k];
      if (!src || !dst) return;
      dst.type = esc(src.type);
      dst.name = esc(src.name);
      dst.spec = multi(src.spec);
      dst.img = src.img;
      dst.fit = src.fit || "cover";
      dst.tint = src.tint;
    });
    App.CHARS.forEach(ch => {
      const src = c.chars.find(x => x.id === ch.id);
      if (!src) return;
      ch.name = esc(src.name);
      ch.figure = src.figure;
      ch.board = src.board;
    });
  }

  /* 已在畫面上的角色列、遊戲區、獎項卡片重新渲染（預覽模式用） */
  function refresh() {
    const ui = App.ui;
    if (!ui) return;
    const wrap = document.getElementById("prizes");
    if (wrap) wrap.innerHTML = "";           // 讓 renderPrizes 重建卡片
    ui.renderPicker(true);                   // 角色圖文可能有變，強制重建
    ui.renderBoard();
  }

  function loadPublished() {
    try { return JSON.parse(localStorage.getItem(KEY_PUBLISHED)); } catch (e) { return null; }
  }
  function savePublished(snapshot) {
    localStorage.setItem(KEY_PUBLISHED, JSON.stringify(snapshot));  // 容量不足時由呼叫端處理例外
  }

  /* ---------- 預覽：捲到對應位置並開啟內容 ---------- */
  function focus(target) {
    const ui = App.ui;
    if (!ui || !target) return;
    if (target.kind === "prize") {
      const btn = document.querySelector(`[data-prize="${target.key}"]`);
      const card = btn && btn.closest(".ib-prize-card");
      if (card) App.scrollToEl(card);
      if (target.open) ui.showPrize(target.key);
      else if (card) flash(card);
    }
    if (target.kind === "char") {
      if (ui.closeModal && document.querySelector(".modal:not([hidden])")) ui.closeModal();
      App.store.setChar(target.index);
      ui.setSel(null);
      ui.renderPicker();
      const el = document.querySelector(target.part === "board" ? ".ib-board" : ".ib-picker");
      if (el) { App.scrollToEl(el); flash(el); }
    }
  }
  function flash(el) {
    el.classList.remove("is-theme-focus");
    void el.offsetWidth;
    el.classList.add("is-theme-focus");
    setTimeout(() => el.classList.remove("is-theme-focus"), 1800);
  }

  /* ---------- 活動頁啟動 ---------- */
  function boot() {
    const preview = /[?&]preview\b/.test(location.search);
    if (!preview) {
      // 連線模式由 main.js 套用後端的線上內容，這裡不套用瀏覽器裡的舊資料
      const pub = App.api && App.api.enabled ? null : loadPublished();
      if (pub && pub.catalog) apply(pub.catalog);
      return;
    }
    window.addEventListener("message", e => {
      if (!App.fromAdmin(e) || !e.data) return;                 // 只接受同網站管理頁（上層視窗）送來的預覽訊息
      if (e.data.type === "catalog:preview") { apply(e.data.catalog); refresh(); }
      if (e.data.type === "catalog:focus") focus(e.data.target);
    });
    // 等整頁腳本（ui.js、main.js）都執行完再通知管理頁傳資料
    window.addEventListener("load", () => {
      if (window.parent !== window) window.parent.postMessage({ type: "catalog:ready" }, "*");
    });
  }

  return { KEY_PUBLISHED, PRIZE_FIELDS, PRIZE_IMG, CHAR_IMGS, defaults, normalize, apply, refresh, loadPublished, savePublished, boot };
})();

/* ==========================================================
   theme.js — 活動頁「視覺風格」定義與套用（活動頁與管理頁共用）
   --------------------------------------------------------
   視覺風格只包含：背景、主視覺、標題文字圖、按鈕、區塊標題、裝飾、色彩。
   不包含：獎項／獎品圖片與內容、角色圖、遊戲規則（這些由各自的設定管理，換風格不受影響）。

   資料流程
     管理頁（admin.html）編輯 → 儲存草稿（只存在管理端）
                              → 正式發布（寫入「已發布」設定）→ 活動頁載入時套用
   原型階段以 localStorage 存放；串接後端時只需改 loadPublished / savePublished。
   ========================================================== */
window.App = window.App || {};

/** 捲動到元素：只捲動「這一頁」（管理頁預覽的 iframe 內不會連帶捲動外層後台頁面）
    block："center"（預設）或 "start"；橫向捲動的清單（例如角色列）也會一起對齊 */
App.scrollToEl = function (el, block) {
  if (!el) return;
  let box = el.parentElement;
  while (box && box !== document.body) {
    if (box.scrollWidth > box.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowX)) {
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      box.scrollTo({ left: box.scrollLeft + r.left - b.left - (b.width - r.width) / 2, behavior: "smooth" });
      break;
    }
    box = box.parentElement;
  }
  const r = el.getBoundingClientRect();
  const top = block === "start" ? r.top + scrollY - 8 : r.top + scrollY - (innerHeight - r.height) / 2;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
};

App.theme = (function () {
  const KEY_PUBLISHED = "ichiban-theme-published";   // 活動頁讀取的正式版本

  /* ---------- 可替換的素材欄位 ----------
     key        欄位代號（活動頁以 data-slot 或 CSS 變數對應）
     size       建議尺寸（px）
     target     img = 活動頁 <img data-slot="key">；css:--name = 寫入 CSS 變數（背景圖） */
  const GROUPS = ["背景", "主視覺", "標題文字圖", "按鈕", "區塊標題", "裝飾"];
  const SLOTS = [
    { key: "topbg",      group: "背景",       name: "頁首背景",         size: [2560, 2000], target: "css:--theme-topbg",  hint: "寬 2560 置中裁切，手機只看得到中段" },
    { key: "visualBg",   group: "主視覺",     name: "主視覺底圖",       size: [960, 991],   target: "img", hint: "上方 100–550px 會疊標題，避開主體" },
    { key: "logo",       group: "主視覺",     name: "活動 Logo",        size: [717, 132],   target: "img" },
    { key: "subtitle",   group: "標題文字圖", name: "副標（第一彈）",   size: [272, 75],    target: "img" },
    { key: "titleA",     group: "標題文字圖", name: "主標・前段",       size: [296, 167],   target: "img" },
    { key: "titleB",     group: "標題文字圖", name: "主標・後段",       size: [453, 215],   target: "img" },
    { key: "ribbon",     group: "標題文字圖", name: "標語緞帶",         size: [714, 135],   target: "img" },
    { key: "btnRecords", group: "按鈕",       name: "按鈕：抽獎紀錄",   size: [480, 147],   target: "img" },
    { key: "btnBoard",   group: "按鈕",       name: "按鈕：中獎看板",   size: [480, 147],   target: "img" },
    { key: "gameTitle",  group: "區塊標題",   name: "遊戲區標題",       size: [960, 424],   target: "img" },
    { key: "scroll",     group: "裝飾",       name: "獎項區外框",       size: [960, 1132],  target: "css:--theme-scroll", hint: "上 700px、下 107px 固定，中段延伸；左右內緣 90／86px" }
  ];
  /* ---------- 可設定的顏色 ----------
     group  管理頁色彩分頁中的分組
     cssVar 活動頁使用的 CSS 變數（未設定時 CSS 用預設值） */
  /* 介面元件（抽獎操作列、活動說明、彈窗）共用同一組面板色與按鈕色，三處一起調整、風格一致 */
  const COLOR_GROUPS = ["頁面", "面板", "按鈕"];
  const COLOR_GROUP_NOTE = {
    "面板": "套用在：抽獎操作列、活動說明、所有彈窗",
    "按鈕": "套用在：抽獎操作列（重新選擇／確認抽獎）、中獎彈窗（確定）"
  };
  const COLORS = [
    { key: "topbar",           group: "頁面", name: "頂部列底色",               cssVar: "--color-topbar",              def: "#298d9c" },
    { key: "bg",               group: "頁面", name: "頁面底色",                 cssVar: "--color-bg",                  def: "#f2e6d0" },
    { key: "panelBg",          group: "面板", name: "面板底色",                 cssVar: "--theme-panel-bg",            def: "#fffaf0" },
    { key: "panelText",        group: "面板", name: "內容文字",                 cssVar: "--theme-panel-text",          def: "#2b2420" },
    { key: "headBg",           group: "面板", name: "標題色（標題列底色、彈窗標題、外框）", cssVar: "--theme-head-bg", def: "#2b2420" },
    { key: "headText",         group: "面板", name: "標題列文字",               cssVar: "--theme-head-text",           def: "#f2e6d0" },
    { key: "accent",           group: "面板", name: "強調文字（小標、提示）",   cssVar: "--theme-accent",              def: "#c23a2b" },
    { key: "btnPrimaryBg",     group: "按鈕", name: "主要按鈕底色",             cssVar: "--theme-btn-primary-bg",      def: "#c23a2b" },
    { key: "btnPrimaryText",   group: "按鈕", name: "主要按鈕文字",             cssVar: "--theme-btn-primary-text",    def: "#ffffff" },
    { key: "btnSecondaryBg",   group: "按鈕", name: "次要按鈕底色",             cssVar: "--theme-btn-secondary-bg",    def: "#fffaf0" },
    { key: "btnSecondaryText", group: "按鈕", name: "次要按鈕文字與框線",       cssVar: "--theme-btn-secondary-text",  def: "#2b2420" }
  ];
  /* 需要檢查對比的「文字／底色」組合（WCAG 一般文字建議 ≥ 4.5:1） */
  const CONTRAST_PAIRS = [
    ["panelText", "panelBg"], ["headBg", "panelBg"], ["headText", "headBg"], ["accent", "panelBg"],
    ["btnPrimaryText", "btnPrimaryBg"], ["btnSecondaryText", "btnSecondaryBg"]
  ];
  const defaultColors = () => Object.fromEntries(COLORS.map(c => [c.key, c.def]));
  /* 補上缺少的顏色欄位（只保留 COLORS 定義的欄位） */
  function normalize(theme) {
    if (!theme) return theme;
    const old = theme.colors || {};
    // 安全性：顏色限制成 #RRGGBB，素材網址限制成安全格式
    theme.colors = Object.fromEntries(COLORS.map(c => [c.key, App.safeColor(old[c.key], c.def)]));
    const assets = theme.assets || {};
    Object.keys(assets).forEach(k => { assets[k] = App.safeImg(assets[k]); });
    theme.assets = assets;
    return theme;
  }
  /* 對比值（WCAG 相對亮度） */
  function contrast(a, b) {
    const lum = hex => {
      const n = parseInt(hex.slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255]
        .map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); })
        .reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    };
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + .05) / (y + .05);
  }

  /* ---------- 現行風格（Figma 素材） ---------- */
  function defaultTheme() {
    const p = "assets/img/hero/";
    return {
      id: "ink",
      name: "國潮水墨（現行）",
      style: "國潮水墨",
      assets: {
        topbg: p + "topbg.png", visualBg: p + "visual-bg.png", logo: p + "logo.png",
        subtitle: p + "ani3-subtitle.png", titleA: p + "ani1-title.png", titleB: p + "ani2-title.png",
        ribbon: p + "ani4-ribbon.png", btnRecords: p + "btn-records.png", btnBoard: p + "btn-board.png",
        gameTitle: p + "game-title.png", scroll: p + "prize-scroll.png"
      },
      colors: defaultColors()
    };
  }

  /* 相對路徑轉成絕對網址（CSS 變數裡的 url() 需要絕對路徑） */
  const abs = u => (!u || u.startsWith("data:") || u.startsWith("blob:")) ? u : new URL(u, document.baseURI).href;

  /* ---------- 套用到活動頁 ---------- */
  function apply(theme) {
    if (!theme) return;
    normalize(theme);
    const root = document.documentElement;
    const assets = theme.assets || {};
    SLOTS.forEach(s => {
      const url = assets[s.key];
      if (s.target === "img") {
        document.querySelectorAll(`img[data-slot="${s.key}"]`).forEach(img => {
          if (url) { if (img.getAttribute("src") !== url) img.src = url; img.hidden = false; }
          else if (s.optional) { img.hidden = true; img.removeAttribute("src"); }
        });
      } else if (s.target.startsWith("css:")) {
        const v = s.target.slice(4);
        if (url) root.style.setProperty(v, `url("${abs(url)}")`); else root.style.removeProperty(v);
      }
    });
    COLORS.forEach(c => {
      const v = theme.colors && theme.colors[c.key];
      if (v) root.style.setProperty(c.cssVar, v);
    });
    root.dataset.themeStyle = theme.style || "";
  }

  /* ---------- 正式版本存取 ---------- */
  function loadPublished() {
    try { return JSON.parse(localStorage.getItem(KEY_PUBLISHED)); } catch (e) { return null; }
  }
  function savePublished(snapshot) {
    localStorage.setItem(KEY_PUBLISHED, JSON.stringify(snapshot)); // 容量不足時由呼叫端處理例外
  }

  /* ---------- 預覽：捲到某個素材的位置並短暫標示 ---------- */
  const FOCUS_TARGET = { topbg: ".ib-hero", scroll: ".ib-scroll", rules: ".ib-rules", drawbarEl: "#actionbar" };
  function focus(key) {
    // 彈窗：開一個實際的彈窗（中獎看板）讓管理者看到顏色效果
    // 抽獎操作列：選一格讓操作列出現
    if (key === "drawbar") {
      const cell = document.querySelector(".ib-board__cell:not(:disabled)");
      if (cell && App.ui) App.ui.setSel(+cell.dataset.i);
      key = "drawbarEl";
    }
    if (key === "modal") {
      if (App.ui && App.ui.showBoard) App.ui.showBoard();
      return;
    }
    const el = document.querySelector(FOCUS_TARGET[key] || `img[data-slot="${key}"]:not([hidden])`) ||
      document.querySelector(".ib-hero");
    if (!el) return;
    App.scrollToEl(el);
    el.classList.remove("is-theme-focus");
    void el.offsetWidth;
    el.classList.add("is-theme-focus");
    setTimeout(() => el.classList.remove("is-theme-focus"), 1800);
  }

  /* ---------- 活動頁啟動：套用已發布風格；管理頁預覽模式接收即時樣式 ---------- */
  function boot() {
    const preview = /[?&]preview\b/.test(location.search);
    if (preview) {
      document.documentElement.classList.add("is-theme-preview");
      window.addEventListener("message", e => {
        if (!App.fromAdmin(e) || !e.data) return;           // 只接受同網站管理頁送來的預覽訊息
        if (e.data.type === "theme:preview") apply(e.data.theme);
        if (e.data.type === "theme:focus") focus(e.data.slot);
      });
      if (window.parent !== window) window.parent.postMessage({ type: "theme:ready" }, "*");
    } else {
      // 連線模式由 main.js 套用後端的線上內容，這裡不套用瀏覽器裡的舊資料
      const pub = App.api && App.api.enabled ? null : loadPublished();
      if (pub && pub.theme) apply(pub.theme);
    }
  }

  return { GROUPS, SLOTS, COLORS, COLOR_GROUPS, COLOR_GROUP_NOTE, CONTRAST_PAIRS, KEY_PUBLISHED, defaultTheme, defaultColors, normalize, contrast, apply, loadPublished, savePublished, boot };
})();

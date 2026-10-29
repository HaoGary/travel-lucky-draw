/* ==========================================================
   rules.js — 遊戲規則與獎品分佈（活動頁與規則管理頁共用）
   --------------------------------------------------------
   可在後台修改：
     cost     每抽消耗的數位幣
     pool     每輪各賞數量（總和須等於格數 COLS × ROWS）
     reward   即時回饋（E 賞購物金、F 賞數位幣）
     text     活動說明文字（可用 {COST} {CURRENCY} {E} {F} 代入目前數值）
     layout   獎品分佈：default 為全角色共用，overrides[角色 id] 為個別設定
   生效時間：
     費用、回饋、說明文字 → 發布後立即生效
     數量、分佈           → 只套用到「之後開始的新一輪」，進行中的輪次不變（維持公平）

   分佈模式
     random       每輪隨機打散（原本的做法）
     fixed        固定配置：在格子上指定每格的賞別；vary = 每輪隨機鏡像翻轉，避免玩家記住位置
     constrained  隨機但有限制：指定的高賞不放最外圈、不放禁放格、彼此至少間隔 gap 格

   ※ 原型的籤序存在瀏覽器裡；正式上線時「每格是哪一賞」必須由伺服器決定與保存，
     不可傳到前端，否則玩家可從程式或網路請求看到位置。
   ========================================================== */
window.App = window.App || {};

App.rules = (function () {
  const KEY_PUBLISHED = "ichiban-rules-published";
  const cfg = App.config;
  const COLS = cfg.COLS, ROWS = cfg.ROWS, N = COLS * ROWS;
  const GRADES = Object.keys(cfg.POOL);              // A–F（LAST ONE 不佔格子）
  const MODES = {
    random: { name: "每輪隨機", desc: "每一輪重新隨機打散，所有格子機會相同。" },
    fixed: { name: "固定配置", desc: "在格子上指定每格的賞別，每輪使用同一張配置。" },
    constrained: { name: "隨機＋限制", desc: "每輪隨機，但高賞須符合位置限制。" }
  };

  /* 活動說明預設文字（活動辦法逐條；注意事項為最後一條的子項） */
  const DEFAULT_TEXT = {
    items: [
      "活動時間：即日起至 2026/12/31 23:59 止。",
      "活動資格：已完成會員註冊並綁定手機號碼之會員，即可參加。",
      "活動內容：每次抽獎使用{CURRENCY} {COST} 枚，選擇任一格即抽出一張籤，每張籤必中 A～F 賞其中之一；每輪抽出最後一張籤者，加碼獲得 LAST ONE 賞。",
      "購物金將於活動結束後 14 天內陸續匯入會員帳戶，使用期限為匯入後 30 天。"
    ],
    notes: [
      "此活動僅限官方網站參加。",
      "實體獎項將於中獎後 30 個工作天內寄出，請確認收件資料正確。",
      "F 賞{CURRENCY}將於中獎當下立即回饋至帳戶。",
      "每輪籤數固定，抽完即開新一輪，獎項數量以中獎看板為準。",
      "主辦單位保有活動變更、修改或終止之權利，如有異動，修改後之內容將公布於活動頁。"
    ]
  };
  const TOKENS = [
    { key: "{COST}", name: "每抽費用" },
    { key: "{CURRENCY}", name: "幣別名稱" },
    { key: "{E}", name: "E 賞購物金數量" },
    { key: "{F}", name: "F 賞回饋數量" }
  ];

  const defaultLayout = () => ({
    mode: "random",
    fixed: [],                       // 長度 N，每格一個賞別；未配置為 ""
    vary: true,                      // 固定配置：每輪隨機鏡像
    high: ["A", "B"],                // 隨機＋限制：受限制的賞別
    avoidEdge: true,                 // 高賞不放最外圈
    gap: 1,                          // 高賞彼此至少間隔幾格（0 = 不限）
    zone: []                         // 高賞禁放格（格子編號）
  });
  const DEFAULT = JSON.stringify({
    cost: cfg.COST,
    pool: { ...cfg.POOL },
    reward: { E: cfg.REWARD.E.voucher, F: cfg.REWARD.F.coins },
    text: DEFAULT_TEXT,
    layout: { default: defaultLayout(), overrides: {} }
  });
  const defaults = () => JSON.parse(DEFAULT);

  function normalize(r) {
    const d = defaults();
    if (!r) return d;
    const fixLayout = l => ({ ...defaultLayout(), ...(l || {}) });
    const overrides = {};
    Object.entries((r.layout && r.layout.overrides) || {}).forEach(([id, l]) => (overrides[id] = fixLayout(l)));
    return {
      cost: r.cost ?? d.cost,
      pool: { ...d.pool, ...(r.pool || {}) },
      reward: { ...d.reward, ...(r.reward || {}) },
      text: { items: (r.text && r.text.items) || d.text.items, notes: (r.text && r.text.notes) || d.text.notes },
      layout: { default: fixLayout(r.layout && r.layout.default), overrides }
    };
  }

  /* ---------- 格子幾何 ---------- */
  const rc = i => [Math.floor(i / COLS), i % COLS];
  const isEdge = i => { const [r, c] = rc(i); return r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1; };
  const dist = (a, b) => { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)); };
  const mirror = (i, h, v) => { let [r, c] = rc(i); if (h) c = COLS - 1 - c; if (v) r = ROWS - 1 - r; return r * COLS + c; };

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const bag = pool => { const a = []; GRADES.forEach(k => { for (let i = 0; i < pool[k]; i++) a.push(k); }); return a; };

  /* ---------- 產生一輪的籤序 ----------
     回傳長度 N 的賞別陣列；條件無法滿足時回傳 null（呼叫端退回純隨機） */
  function generate(layout, pool, rnd) {
    if (layout.mode === "fixed") {
      if (validateFixed(layout.fixed, pool).length) return null;
      if (!layout.vary) return layout.fixed.slice();
      const h = rnd() < .5, v = rnd() < .5;
      const out = new Array(N);
      layout.fixed.forEach((g, i) => (out[mirror(i, h, v)] = g));
      return out;
    }
    if (layout.mode === "constrained") return constrained(layout, pool, rnd);
    return shuffle(bag(pool), rnd);
  }

  function constrained(l, pool, rnd) {
    // 數量少（較稀有）的先放，比較不會卡住
    const high = GRADES.filter(g => l.high.includes(g)).sort((a, b) => pool[a] - pool[b]);
    const zone = new Set(l.zone);
    for (let attempt = 0; attempt < 200; attempt++) {
      const cells = new Array(N).fill("");
      const placed = [];
      let ok = true;
      for (const g of high) {
        for (let n = 0; n < pool[g] && ok; n++) {
          const cand = [];
          for (let i = 0; i < N; i++) {
            if (cells[i] || zone.has(i) || (l.avoidEdge && isEdge(i))) continue;
            if (l.gap && placed.some(p => dist(p, i) <= l.gap)) continue;
            cand.push(i);
          }
          if (!cand.length) { ok = false; break; }
          const i = cand[Math.floor(rnd() * cand.length)];
          cells[i] = g; placed.push(i);
        }
        if (!ok) break;
      }
      if (!ok) continue;
      const rest = shuffle(bag(pool).filter(g => !high.includes(g)), rnd);
      let j = 0;
      for (let i = 0; i < N; i++) if (!cells[i]) cells[i] = rest[j++];
      return cells;
    }
    return null;
  }

  /* ---------- 檢查 ---------- */
  function validateFixed(fixed, pool) {
    const errs = [];
    const count = Object.fromEntries(GRADES.map(g => [g, 0]));
    let empty = 0;
    for (let i = 0; i < N; i++) { const g = fixed[i]; if (count[g] != null) count[g]++; else empty++; }
    if (empty) errs.push(`尚有 ${empty} 格未配置`);
    GRADES.forEach(g => { if (count[g] !== pool[g]) errs.push(`${g} 賞已放 ${count[g]} 個，應為 ${pool[g]} 個`); });
    return errs;
  }

  /* 簡單亂數（與 store.js 相同演算法） */
  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  /* 回傳錯誤訊息陣列；空陣列代表可以發布 */
  function validate(r, charNames = {}) {
    const errs = [];
    if (!(r.cost >= 1)) errs.push("每抽費用至少 1");
    const total = GRADES.reduce((s, g) => s + (r.pool[g] || 0), 0);
    if (total !== N) errs.push(`各賞數量總和為 ${total}，須等於格數 ${N}`);
    GRADES.forEach(g => { if (!(r.pool[g] >= 1)) errs.push(`${g} 賞數量至少 1`); });
    if (!(r.reward.E >= 0) || !(r.reward.F >= 0)) errs.push("回饋數量不可小於 0");
    if (!r.text.items.some(s => s.trim())) errs.push("活動辦法至少要有一條");
    if (total !== N) return errs;          // 數量不對時分佈一定不成立，先不檢查
    const check = (l, who) => layoutErrors(l, r.pool).forEach(e => errs.push(`${who}：${e}`));
    check(r.layout.default, "預設分佈");
    Object.entries(r.layout.overrides).forEach(([id, l]) => check(l, `${charNames[id] || id} 的分佈`));
    return errs;
  }
  function layoutErrors(l, pool) {
    if (l.mode === "fixed") return validateFixed(l.fixed, pool);
    if (l.mode === "constrained") {
      if (!l.high.length) return ["請至少選一個受限制的賞別"];
      // 用多組亂數試產生，任何一次失敗都代表條件太嚴格
      for (let s = 1; s <= 120; s++) if (!constrained(l, pool, rng(s * 7919))) return ["限制條件太嚴格，無法每次都排得出來；請減少禁放格、縮小間隔或取消「不放最外圈」"];
    }
    return [];
  }

  /* 模擬 n 輪，回傳每格出現指定賞別的次數（熱度圖用） */
  function simulate(layout, pool, grades, n = 400) {
    const heat = new Array(N).fill(0);
    for (let s = 1; s <= n; s++) {
      const cells = generate(layout, pool, rng(s * 104729 + 11));
      if (!cells) continue;
      cells.forEach((g, i) => { if (grades.includes(g)) heat[i]++; });
    }
    return heat;
  }

  /* ---------- 套用到活動頁 ---------- */
  let current = defaults();
  const fill = s => String(s)
    .replace(/\{COST\}/g, current.cost).replace(/\{CURRENCY\}/g, cfg.CURRENCY)
    .replace(/\{E\}/g, current.reward.E).replace(/\{F\}/g, current.reward.F);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function apply(r) {
    current = normalize(r);
    cfg.COST = current.cost;
    GRADES.forEach(g => (cfg.POOL[g] = current.pool[g]));
    cfg.REWARD.E = { voucher: current.reward.E };
    cfg.REWARD.F = { coins: current.reward.F };
    renderPage();
  }

  /* 活動頁上與規則有關的文字：抽獎按鈕、活動說明 */
  function renderPage() {
    const btn = document.getElementById("btnDraw");
    if (btn) btn.textContent = `確認抽獎（${current.cost} ${cfg.CURRENCY}）`;
    const body = document.querySelector(".ib-rules__body");
    if (!body) return;
    const li = s => `<li>${esc(fill(s))}</li>`;
    const items = current.text.items.filter(s => s.trim());
    const notes = current.text.notes.filter(s => s.trim());
    body.innerHTML = `<h4 class="ib-rules__heading">【活動辦法】</h4>
      <ol class="ib-rules__list">${items.map(li).join("")}${notes.length
        ? `<li>注意事項：<ul class="ib-rules__sublist">${notes.map(li).join("")}</ul></li>` : ""}</ol>`;
  }

  /* store.js 開新一輪時呼叫：依角色取得分佈設定並產生籤序 */
  function layoutFor(charId) { return current.layout.overrides[charId] || current.layout.default; }
  function makeCells(charId, rnd) {
    return generate(layoutFor(charId), cfg.POOL, rnd) || shuffle(bag(cfg.POOL), rnd);
  }

  function loadPublished() {
    try { return JSON.parse(localStorage.getItem(KEY_PUBLISHED)); } catch (e) { return null; }
  }
  function savePublished(snapshot) { localStorage.setItem(KEY_PUBLISHED, JSON.stringify(snapshot)); }

  /* ---------- 活動頁啟動 ----------
     一般模式：套用已發布規則
     預覽模式：接收管理頁的規則；可要求重新產生各角色的格子並顯示每格賞別（只在預覽中） */
  function boot() {
    const preview = /[?&]preview\b/.test(location.search);
    if (!preview) {
      // 連線模式由 main.js 套用後端的線上內容，這裡不套用瀏覽器裡的舊資料
      const pub = App.api && App.api.enabled ? null : loadPublished();
      if (pub && pub.rules) apply(pub.rules);
      return;
    }
    window.addEventListener("message", e => {
      if (!App.fromAdmin(e)) return;                        // 只接受同網站管理頁送來的預覽訊息
      const d = e.data;
      if (!d) return;
      if (d.type === "rules:preview") {
        apply(d.rules);
        if (App.store && App.store.rebuild) App.store.rebuild();   // 用新規則重排所有角色（不寫入存檔）
        if (App.ui) { App.ui.renderBoard(); }
      }
      if (d.type === "rules:focus") focus(d.target);
    });
    window.addEventListener("load", () => {
      if (window.parent !== window) window.parent.postMessage({ type: "rules:ready" }, "*");
    });
  }
  function focus(t) {
    const ui = App.ui;
    if (!ui || !t) return;
    if (document.querySelector(".modal:not([hidden])")) ui.closeModal();
    App.store.reveal = !!t.reveal;
    ui.renderBoard();
    if (t.part === "board") {
      if (t.index != null) { App.store.setChar(t.index); ui.renderPicker(); }
      ui.setSel(null);
      const el = document.querySelector(".ib-board");
      el && App.scrollToEl(el);
    }
    if (t.part === "rules") {
      const el = document.querySelector(".ib-rules");
      el && App.scrollToEl(el, "start");
    }
    if (t.part === "stock") ui.showBoard();
    if (t.part === "drawbar") {
      const cell = document.querySelector(".ib-board__cell:not(:disabled)");
      if (cell) ui.setSel(+cell.dataset.i);
      const bar = document.getElementById("actionbar");
      bar && App.scrollToEl(bar);
    }
  }

  return {
    KEY_PUBLISHED, COLS, ROWS, N, GRADES, MODES, TOKENS,
    defaults, defaultLayout, normalize, validate, layoutErrors, validateFixed,
    generate, simulate, rng, isEdge, apply, makeCells, layoutFor,
    get current() { return current; }, loadPublished, savePublished, boot
  };
})();

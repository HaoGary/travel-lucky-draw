/* ==========================================================
   config.js — 活動設定（營運調整只需改這支檔案）
   ----------------------------------------------------------
   賞別（獎項等級）現在改為「動態」：以 App.GRADES 陣列為單一來源，
   後台可新增／刪除賞別。載入後端資料時由 App.applyGrades() 就地重建
   App.PRIZE_ORDER / App.PRIZES / config.POOL / config.REWARD，
   讓持有同一份參考的其他模組（rules.js、ui.js…）立即看到最新賞別。
   下方的預設值僅用於離線示範與第一次載入前的骨架。
   ========================================================== */
window.App = window.App || {};

App.config = {
  CURRENCY: "數位幣", // 幣別名稱（顯示用）
  COST: 100,          // 每抽消耗數位幣
  COLS: 7,            // 格子欄數（依 Figma 遊戲區 7 × 10）
  ROWS: 10,           // 格子列數（COLS × ROWS = 每輪籤數）
  START_BALANCE: 99999,
  START_ROUND: 2,
  STORAGE_KEY: "ichiban-v2", // 格數改變，換新 key 避免讀到舊的 80 格存檔

  /* 每輪各賞數量，總和須等於 COLS × ROWS（鍵 = 佔格的賞別，由 applyGrades 維護） */
  POOL: { A: 1, B: 2, C: 4, D: 8, E: 20, F: 35 },

  /* 中獎即時回饋（鍵 = 有回饋幣別的賞別） */
  REWARD: {
    E: { voucher: 20 },  // 購物金
    F: { coins: 30 }     // 數位幣回饋
  }
};

/* 賞別預設種子（與後端 GRADE_SEED 對齊）
   code           = 賞別代碼（1～4 碼英數）
   label          = 顯示名稱
   color          = 賞別標籤顏色（徽章色）
   occupiesCell   = 是否佔棋盤格（計入每輪籤數；false＝像 LAST ONE 不佔格）
   rewardCurrency = 中獎回饋幣別：'' 無／VOUCHER 購物金／DIGITAL 數位幣 */
App.GRADE_SEED = [
  { code: "A", label: "A 賞",        color: "#d32f2f", occupiesCell: true,  rewardCurrency: "" },
  { code: "B", label: "B 賞",        color: "#e65100", occupiesCell: true,  rewardCurrency: "" },
  { code: "C", label: "C 賞",        color: "#f9a825", occupiesCell: true,  rewardCurrency: "" },
  { code: "D", label: "D 賞",        color: "#2e7d32", occupiesCell: true,  rewardCurrency: "" },
  { code: "E", label: "E 賞",        color: "#1565c0", occupiesCell: true,  rewardCurrency: "VOUCHER" },
  { code: "F", label: "F 賞",        color: "#7b2cbf", occupiesCell: true,  rewardCurrency: "DIGITAL" },
  { code: "L", label: "LAST ONE 賞", color: "#37474f", occupiesCell: false, rewardCurrency: "" }
];

/* 賞別清單（單一來源，會被 applyGrades 就地覆寫；請勿重新指派參考） */
App.GRADES = App.GRADE_SEED.map(g => ({ ...g }));

/* 獎項內容預設（L = LAST ONE 賞）
   img/fit/type/tint/name/spec：卡片顯示用；新增賞別時以 defaultPrize() 補齊 */
App.PRIZES = {
  A: { type: "實體獎品",     tint: "#b8862b", img: "assets/img/prize/a.webp",    fit: "cover",   name: "經典手工皂禮盒",     spec: "規格待提供", icon: "pillow" },
  B: { type: "實體獎品",     tint: "#3c6fa8", img: "assets/img/prize/b.webp",    fit: "cover",   name: "麻將造型護照套",     spec: "規格待提供", icon: "blanket" },
  C: { type: "實體獎品",     tint: "#2f7f86", img: "assets/img/prize/c.webp",    fit: "cover",   name: "臺灣圖騰束口袋",     spec: "規格待提供", icon: "bag" },
  D: { type: "實體獎品",     tint: "#8a6a3a", img: "assets/img/prize/d.webp",    fit: "cover",   name: "護照造型行李吊牌",   spec: "規格待提供", icon: "tag" },
  E: { type: "購物金",       tint: "#a7742a", img: "assets/img/prize/e.webp",    fit: "contain", name: "購物金 20 枚",       spec: "活動結束後匯入會員帳戶", icon: "ingot" },
  F: { type: "數位幣回饋",   tint: "#6b5aa8", img: "assets/img/prize/f.webp",    fit: "contain", name: "數位幣 30 枚",       spec: "中獎當下立即回饋", icon: "coin" },
  L: { type: "最後一抽加碼", tint: "#c23a2b", img: "assets/img/prize/last.webp", fit: "cover",   name: "臺灣插畫玻璃杯組",   spec: "規格待提供", icon: "pillow" }
};
App.PRIZE_ORDER = App.GRADES.map(g => g.code);

/* 新增賞別時的預設獎項內容 */
App.defaultPrize = function (grade) {
  const tint = (grade && grade.color) || "#888888";
  return { type: grade && grade.occupiesCell === false ? "加碼獎項" : "獎項", tint, img: "", fit: "cover",
           name: (grade && grade.label) || ((grade && grade.code) || "") + " 賞", spec: "規格待提供", icon: "gift" };
};

/* ---------- 賞別查詢小工具（供各模組共用） ---------- */
App.gradeMeta    = code => App.GRADES.find(g => g.code === code) || null;
App.gradeLabel   = code => { const g = App.gradeMeta(code); return g ? g.label : code + " 賞"; };
App.gradeColor   = code => { const g = App.gradeMeta(code); return g ? g.color : "#888888"; };
App.occupyGrades = () => App.GRADES.filter(g => g.occupiesCell).map(g => g.code);     // 佔格賞別（計入籤數）
App.rewardGrades = () => App.GRADES.filter(g => !!g.rewardCurrency).map(g => g.code); // 有回饋的賞別
App.isLastGrade  = code => { const g = App.gradeMeta(code); return !!g && !g.occupiesCell; };

/* ---------- 套用一組賞別：就地重建 GRADES / PRIZE_ORDER / PRIZES / POOL / REWARD ----------
   list：[{code,label,color,occupiesCell,rewardCurrency}, ...]（順序即顯示順序）
   amounts（選填）：{ pool:{code:數量}, reward:{code:數量} } 讓新鍵有合理預設 */
App.applyGrades = function (list, amounts) {
  if (!Array.isArray(list) || !list.length) return;
  const cfg = App.config;
  const codes = list.map(g => String(g.code || "").toUpperCase()).filter(Boolean);
  const pool = (amounts && amounts.pool) || {};
  const reward = (amounts && amounts.reward) || {};

  // 1) GRADES 就地覆寫（保留同一個陣列參考）
  App.GRADES.length = 0;
  list.forEach(g => App.GRADES.push({
    code: String(g.code || "").toUpperCase(),
    label: String(g.label || ((g.code || "") + " 賞")),
    color: App.safeColor ? App.safeColor(g.color, "#888888") : (g.color || "#888888"),
    occupiesCell: g.occupiesCell !== false,
    rewardCurrency: g.rewardCurrency === "VOUCHER" || g.rewardCurrency === "DIGITAL" ? g.rewardCurrency : ""
  }));

  // 2) PRIZE_ORDER 就地覆寫
  App.PRIZE_ORDER.length = 0;
  App.GRADES.forEach(g => App.PRIZE_ORDER.push(g.code));

  // 3) PRIZES：補上新賞、移除已刪賞
  App.GRADES.forEach(g => {
    if (!App.PRIZES[g.code]) App.PRIZES[g.code] = App.defaultPrize(g);
  });
  Object.keys(App.PRIZES).forEach(code => { if (codes.indexOf(code) < 0) delete App.PRIZES[code]; });

  // 4) config.POOL：鍵 = 佔格賞別（保留既有數量，新鍵給預設，移除已刪）
  const occ = App.occupyGrades();
  Object.keys(cfg.POOL).forEach(code => { if (occ.indexOf(code) < 0) delete cfg.POOL[code]; });
  occ.forEach(code => { if (cfg.POOL[code] == null) cfg.POOL[code] = pool[code] != null ? pool[code] : 1; });

  // 5) config.REWARD：鍵 = 有回饋賞別
  const rew = App.rewardGrades();
  Object.keys(cfg.REWARD).forEach(code => { if (rew.indexOf(code) < 0) delete cfg.REWARD[code]; });
  rew.forEach(code => {
    const cur = App.gradeMeta(code).rewardCurrency;
    const amt = reward[code] != null ? reward[code] : 0;
    cfg.REWARD[code] = cur === "VOUCHER" ? { voucher: amt } : { coins: amt };
  });
};

/* 角色：圖檔來自 Figma「[一番賞遊戲] 元件」
   figure = 人物去背圖（500×500，用於角色選擇）
   board  = 人物背景圖（960×960，遊戲區底圖，已含一番賞章與角色名） */
App.CHARS = [
  ["01", "素還真"], ["02", "葉小釵"], ["03", "一頁書"], ["04", "亂世狂刀"], ["05", "風采鈴"],
  ["06", "棄天帝"], ["07", "疏樓龍宿"], ["08", "解鋒鏑"], ["09", "談無欲"], ["10", "吞佛童子"]
].map(([no, name]) => ({
  id: "c" + no,
  name,
  figure: `assets/img/figure/${no}.png`,
  board: `assets/img/board/${no}.png`
}));

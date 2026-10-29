/* ==========================================================
   config.js — 活動設定（營運調整只需改這支檔案）
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

  /* 每輪各賞數量，總和須等於 COLS × ROWS */
  POOL: { A: 1, B: 2, C: 4, D: 8, E: 20, F: 35 },

  /* 中獎即時回饋 */
  REWARD: {
    E: { voucher: 20 },  // 購物金
    F: { coins: 30 }     // 數位幣回饋
  }
};

/* 獎項資料（L = LAST ONE 賞）
   img  = 商品圖（Figma「素材提供 / 商品圖」image 1–7 依序對應 A–F、LAST ONE）
   fit  = 商品圖在卡片中的裁切方式：cover 填滿裁切（實拍照）／contain 完整顯示（去背或含文字的圖）
   type = 卡片上的分類文字；tint = 卡片圖片區底色
   icon = 沒有商品圖時的備用 SVG 圖示
   ※ 商品名稱依商品圖暫定，規格待提供後更新 */
App.PRIZES = {
  A: { type: "實體獎品",     tint: "#b8862b", img: "assets/img/prize/a.webp",    fit: "cover",   name: "經典手工皂禮盒",     spec: "規格待提供", icon: "pillow" },
  B: { type: "實體獎品",     tint: "#3c6fa8", img: "assets/img/prize/b.webp",    fit: "cover",   name: "麻將造型護照套",     spec: "規格待提供", icon: "blanket" },
  C: { type: "實體獎品",     tint: "#2f7f86", img: "assets/img/prize/c.webp",    fit: "cover",   name: "臺灣圖騰束口袋",     spec: "規格待提供", icon: "bag" },
  D: { type: "實體獎品",     tint: "#8a6a3a", img: "assets/img/prize/d.webp",    fit: "cover",   name: "護照造型行李吊牌",   spec: "規格待提供", icon: "tag" },
  E: { type: "購物金",       tint: "#a7742a", img: "assets/img/prize/e.webp",    fit: "contain", name: "購物金 20 枚",       spec: "活動結束後匯入會員帳戶", icon: "ingot" },
  F: { type: "數位幣回饋",   tint: "#6b5aa8", img: "assets/img/prize/f.webp",    fit: "contain", name: "數位幣 30 枚",       spec: "中獎當下立即回饋", icon: "coin" },
  L: { type: "最後一抽加碼", tint: "#c23a2b", img: "assets/img/prize/last.webp", fit: "cover",   name: "臺灣插畫玻璃杯組",   spec: "規格待提供", icon: "pillow" }
};
App.PRIZE_ORDER = ["A", "B", "C", "D", "E", "F", "L"];

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

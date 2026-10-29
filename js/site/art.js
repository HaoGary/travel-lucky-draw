/* ==========================================================
   art.js — 角色與獎品圖像
   角色圖使用 Figma 匯出的 PNG（路徑設定在 config.js 的 App.CHARS）。
   獎品圖使用 Figma「商品圖」匯出的 WebP（路徑設定在 config.js 的 App.PRIZES）；
   SVG 圖示僅在商品沒有圖時備用。
   ========================================================== */
window.App = window.App || {};

App.art = (function () {
  /* 角色去背圖；cls 套在 img 上，由呼叫端依位置決定 */
  function figure(c, cls = "") {
    return `<img class="${cls}" src="${c.figure}" alt="${c.name}" width="500" height="500" loading="lazy" decoding="async">`;
  }

  const dots = [0, 1, 2].map(r => [0, 1, 2].map(c => `<circle cx="${26 + c * 20}" cy="${36 + r * 18}" r="4" fill="#fff"/>`).join("")).join("");

  const ICONS = {
    pillow: `<svg viewBox="0 0 100 100"><path d="M50 14a36 36 0 1 0 30 56l-14-8a20 20 0 1 1-2-36z" fill="#9cc3e0" stroke="#1f5a60" stroke-width="3"/><circle cx="34" cy="40" r="4" fill="#fff"/><circle cx="46" cy="70" r="4" fill="#fff"/><circle cx="64" cy="32" r="3" fill="#fff"/><rect x="58" y="72" width="34" height="14" rx="7" fill="#f6ecd9" stroke="#1f5a60" stroke-width="3"/></svg>`,
    blanket: `<svg viewBox="0 0 100 100"><path d="M14 24h64v58H14z" fill="#3c6fa8" stroke="#1f3e66" stroke-width="3"/><path d="M78 24q10 4 8 20l-8 38" fill="#2f5f8a" stroke="#1f3e66" stroke-width="3"/>${dots}</svg>`,
    bag: `<svg viewBox="0 0 100 100"><rect x="18" y="30" width="64" height="52" rx="8" fill="#2f7f86" stroke="#1f5a60" stroke-width="3"/><path d="M38 30v-8h24v8" fill="none" stroke="#1f5a60" stroke-width="4"/><path d="M18 50h64" stroke="#f3d48a" stroke-width="4"/><rect x="44" y="45" width="12" height="10" rx="2" fill="#c8902c"/></svg>`,
    tag: `<svg viewBox="0 0 100 100"><path d="M30 18h40l8 10v58H22V28z" fill="#f3d48a" stroke="#8f6216" stroke-width="3"/><circle cx="50" cy="30" r="5" fill="#fff" stroke="#8f6216" stroke-width="3"/><path d="M50 25V8" stroke="#c23a2b" stroke-width="3"/><path d="M34 52h32M34 64h22" stroke="#8f6216" stroke-width="4" stroke-linecap="round"/></svg>`,
    ingot: `<svg viewBox="0 0 100 100"><path d="M12 52q4 26 38 26t38-26q-14 8-20 0l-4-14q-14-6-28 0l-4 14q-6 8-20 0z" fill="#f0b93a" stroke="#8f6216" stroke-width="3"/><ellipse cx="50" cy="44" rx="14" ry="8" fill="#ffd96b" stroke="#8f6216" stroke-width="3"/></svg>`,
    coin: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="#f0b93a" stroke="#8f6216" stroke-width="4"/><circle cx="50" cy="50" r="26" fill="none" stroke="#ffd96b" stroke-width="4"/><text x="50" y="62" text-anchor="middle" font-size="32" font-weight="900" fill="#8f6216" font-family="serif">東</text></svg>`
  };

  const icon = (k, cls = "") => ICONS[App.PRIZES[k].icon].replace("<svg ", `<svg class="${cls}" `);

  /* 獎品圖：有商品圖用 <img>（依 fit 加上 --cover／--contain），沒有則用備用 SVG 圖示 */
  function prize(k, cls = "") {
    const p = App.PRIZES[k];
    if (!p.img) return icon(k, cls);
    const fit = cls ? ` ${cls}--${p.fit || "cover"}` : "";
    return `<img class="${cls}${fit}" src="${p.img}" alt="${p.name}" loading="lazy" decoding="async">`;
  }
  const gradeLabel = k => (k === "L" ? "LAST ONE 賞" : k + " 賞");

  return { figure, icon, prize, gradeLabel };
})();

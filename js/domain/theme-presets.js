/* ==========================================================
   theme-presets.js — 管理頁內建的風格範本（簡約／科技／可愛插畫／節慶）
   --------------------------------------------------------
   範本素材以 SVG 程式產生，作為「示意用的起始稿」：
   管理者可直接套用，或在管理頁逐一上傳正式設計圖替換。
   所有尺寸與現行素材一致，替換後版面不需調整。
   Logo 沿用活動現行 Logo（品牌識別不隨風格改變）。
   ========================================================== */
window.App = window.App || {};

App.themePresets = (function () {
  const svg = (w, h, body) =>
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

  const STYLES = {
    minimal: {
      name: "簡約風", style: "簡約",
      bg: ["#f7f6f2", "#ecebe5"], ink: "#1f1f1f", accent: "#e4572e", accent2: "#2b2b2b", paper: "#ffffff",
      font: "'Helvetica Neue', Arial, 'Noto Sans TC', sans-serif", weight: 700,
      topbar: "#1f1f1f", pageBg: "#f4f3ee",
      ui: { panelBg: "#ffffff", panelText: "#2b2b2b", headBg: "#1f1f1f", headText: "#ffffff", accent: "#c2401f", btnPrimaryBg: "#c2401f", btnPrimaryText: "#ffffff", btnSecondaryBg: "#ffffff", btnSecondaryText: "#1f1f1f" },
      motif: (w, h) => `<circle cx="${w * .72}" cy="${h * .42}" r="${h * .28}" fill="#e4572e" opacity=".9"/>
        <line x1="0" y1="${h * .78}" x2="${w}" y2="${h * .78}" stroke="#1f1f1f" stroke-width="3"/>
        <rect x="${w * .12}" y="${h * .55}" width="${w * .18}" height="${h * .23}" fill="#2b2b2b"/>`
    },
    tech: {
      name: "科技風", style: "科技",
      bg: ["#0a0f2c", "#1a2a6c"], ink: "#e8f6ff", accent: "#36e2ff", accent2: "#8a5cff", paper: "#0f1638",
      font: "'Arial Black', 'Noto Sans TC', sans-serif", weight: 900,
      topbar: "#0a0f2c", pageBg: "#0d1433",
      ui: { panelBg: "#111a40", panelText: "#e8f6ff", headBg: "#36e2ff", headText: "#0a0f2c", accent: "#36e2ff", btnPrimaryBg: "#36e2ff", btnPrimaryText: "#0a0f2c", btnSecondaryBg: "#111a40", btnSecondaryText: "#36e2ff" },
      motif: (w, h) => {
        let g = "";
        for (let x = 0; x <= w; x += 40) g += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#36e2ff" stroke-opacity=".08"/>`;
        for (let y = 0; y <= h; y += 40) g += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#36e2ff" stroke-opacity=".08"/>`;
        return g + `<circle cx="${w / 2}" cy="${h * .7}" r="${h * .2}" fill="none" stroke="#36e2ff" stroke-width="3" opacity=".7"/>
          <circle cx="${w / 2}" cy="${h * .7}" r="${h * .28}" fill="none" stroke="#8a5cff" stroke-width="2" stroke-dasharray="14 10" opacity=".7"/>`;
      }
    },
    cute: {
      name: "可愛插畫風", style: "可愛插畫",
      bg: ["#ffe6f0", "#fff6d6"], ink: "#5a3b5c", accent: "#ff7aa8", accent2: "#7cc8ff", paper: "#fffaf3",
      font: "'Chalkboard SE', 'Comic Sans MS', 'Noto Sans TC', sans-serif", weight: 900,
      topbar: "#ff7aa8", pageBg: "#fff3f6",
      ui: { panelBg: "#fffaf3", panelText: "#5a3b5c", headBg: "#c92a63", headText: "#ffffff", accent: "#c92a63", btnPrimaryBg: "#c92a63", btnPrimaryText: "#ffffff", btnSecondaryBg: "#ffffff", btnSecondaryText: "#5a3b5c" },
      motif: (w, h) => `<g fill="#fff"><ellipse cx="${w * .2}" cy="${h * .25}" rx="${w * .1}" ry="${h * .06}"/><ellipse cx="${w * .27}" cy="${h * .22}" rx="${w * .08}" ry="${h * .07}"/>
        <ellipse cx="${w * .78}" cy="${h * .3}" rx="${w * .1}" ry="${h * .055}"/></g>
        <g fill="#ffd34d">${[[.1, .5], [.88, .55], [.5, .15], [.65, .62]].map(([x, y]) => star(w * x, h * y, h * .03)).join("")}</g>
        <ellipse cx="${w / 2}" cy="${h * 1.02}" rx="${w * .7}" ry="${h * .25}" fill="#b6e7a8"/>`
    },
    festival: {
      name: "節慶風", style: "節慶",
      bg: ["#b3121b", "#6e0a0f"], ink: "#ffe7a3", accent: "#ffcc33", accent2: "#ff7b3c", paper: "#fff3d6",
      font: "'Noto Serif TC', 'Songti TC', serif", weight: 900,
      topbar: "#8e0e14", pageBg: "#fbeedc",
      ui: { panelBg: "#fff3d6", panelText: "#4a1a10", headBg: "#8e0e14", headText: "#ffe7a3", accent: "#b3121b", btnPrimaryBg: "#b3121b", btnPrimaryText: "#ffe7a3", btnSecondaryBg: "#fff3d6", btnSecondaryText: "#8e0e14" },
      motif: (w, h) => [[.12, .2], [.88, .2], [.25, .05], [.75, .05]].map(([x, y]) => lantern(w * x, h * y, h * .09)).join("") +
        [[.2, .55], [.8, .5], [.5, .35]].map(([x, y]) => burst(w * x, h * y, h * .09)).join("")
    }
  };

  function star(cx, cy, r) {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .45 : r;
      d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return `<path d="${d}Z"/>`;
  }
  function lantern(cx, cy, r) {
    return `<line x1="${cx}" y1="0" x2="${cx}" y2="${cy - r}" stroke="#ffcc33" stroke-width="2"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${r * .9}" ry="${r}" fill="#e8251f" stroke="#ffcc33" stroke-width="3"/>
      <rect x="${cx - r * .35}" y="${cy - r - 6}" width="${r * .7}" height="10" fill="#ffcc33"/>
      <rect x="${cx - r * .35}" y="${cy + r - 4}" width="${r * .7}" height="10" fill="#ffcc33"/>`;
  }
  function burst(cx, cy, r) {
    let g = "";
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 6 * i;
      g += `<line x1="${(cx + Math.cos(a) * r * .3).toFixed(1)}" y1="${(cy + Math.sin(a) * r * .3).toFixed(1)}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="#ffcc33" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    }
    return g;
  }

  const grad = (id, a, b, vertical = true) =>
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
  const text = (s, x, y, size, fill, st, extra = "") =>
    `<text x="${x}" y="${y}" font-family="${st.font}" font-weight="${st.weight}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle" ${extra}>${s}</text>`;

  function build(id) {
    const st = STYLES[id];
    const W = 960;
    const outline = id === "tech" ? `stroke="${st.accent}" stroke-width="2"` : `stroke="${st.paper}" stroke-width="8" paint-order="stroke"`;
    const assets = {
      topbg: svg(2560, 2000, grad("g", st.bg[0], st.bg[1]) + `<rect width="2560" height="2000" fill="url(#g)"/>` + st.motif(2560, 2000)),
      visualBg: svg(W, 991, grad("g", st.bg[0], st.bg[1]) + `<rect width="${W}" height="991" fill="url(#g)" opacity=".35"/>` +
        `<g transform="translate(0 420)">${st.motif(W, 571)}</g>`),
      logo: "assets/img/hero/logo.png",
      subtitle: svg(272, 75, text("～第一彈～", 136, 40, 44, st.accent, st, outline)),
      titleA: svg(296, 167, text("旅遊", 148, 90, 128, st.ink === "#e8f6ff" ? st.ink : st.accent2, st, outline)),
      titleB: svg(453, 215, text("一番賞", 226, 110, 136, st.id === "tech" ? st.accent : st.ink, st, outline)),
      ribbon: svg(714, 135, `<path d="M20 20H694L670 67L694 115H20L44 67Z" fill="${st.accent}"/>` +
        text("最後一抽加碼送 LAST ONE 賞！！", 357, 68, 40, id === "minimal" ? "#fff" : (id === "festival" ? "#7a0b10" : st.paper), st)),
      btnRecords: svg(480, 147, plaque(st, "• 抽獎紀錄 •")),
      btnBoard: svg(480, 147, plaque(st, "• 中獎看板 •")),
      gameTitle: svg(W, 424,
        `<rect x="140" y="40" width="680" height="230" rx="${id === "cute" ? 60 : 12}" fill="${st.paper}" stroke="${st.accent}" stroke-width="10"/>` +
        text("遊戲區", 440, 158, 120, id === "tech" ? st.accent : st.ink, st) +
        `<circle cx="700" cy="150" r="70" fill="${st.accent}"/>` + text("100%", 700, 135, 40, st.paper, st) + text("中獎率", 700, 178, 26, st.paper, st) +
        text("選取 1 格即可使用數位幣 100 枚進行抽獎", 480, 330, 40, id === "tech" ? st.ink : st.accent2, st) +
        text("每人抽獎次數無上限", 480, 385, 36, id === "tech" ? st.ink : st.accent2, st)),
      scroll: svg(W, 1132,
        `<rect x="66" y="40" width="832" height="1040" rx="16" fill="${st.accent2}"/>` +
        `<rect x="90" y="60" width="784" height="965" fill="${st.paper}"/>` +
        `<rect x="40" y="20" width="880" height="44" rx="22" fill="${st.accent}"/>` +
        `<rect x="40" y="1030" width="880" height="44" rx="22" fill="${st.accent}"/>` +
        text("獎項介紹", 480, 230, 110, id === "tech" ? st.accent : st.ink, st))
    };
    return {
      id, name: st.name, style: st.style, preset: true,
      assets,
      colors: { topbar: st.topbar, bg: st.pageBg, ...st.ui }
    };
  }

  function plaque(st, label) {
    const r = st.style === "可愛插畫" ? 60 : st.style === "簡約" ? 6 : 14;
    const fill = st.style === "科技" ? st.paper : st.accent;
    const ink = st.style === "科技" ? st.accent : (st.style === "節慶" ? "#7a0b10" : (st.style === "簡約" ? "#fff" : st.ink));
    return `<rect x="40" y="18" width="400" height="104" rx="${r}" fill="${fill}" ${st.style === "科技" ? `stroke="${st.accent}" stroke-width="3"` : ""}/>` +
      `<rect x="40" y="114" width="400" height="12" rx="6" fill="#000" opacity=".15"/>` +
      text(label, 240, 72, 52, ink, st);
  }

  STYLES.minimal.id = "minimal"; STYLES.tech.id = "tech"; STYLES.cute.id = "cute"; STYLES.festival.id = "festival";
  const list = () => Object.keys(STYLES).map(build);
  return { list, build };
})();

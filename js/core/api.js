/* ==========================================================
   api.js — 呼叫 Apps Script 後端
   ・GET 讀取；POST 以 text/plain 傳 JSON（Apps Script 不支援 CORS 預檢）
   ・回應格式 { ok, data, error }；失敗時丟出 Error（附 err.data）
   ・管理頁預覽（?preview）不連後端，由管理頁以 postMessage 傳資料
   ========================================================== */
window.App = window.App || {};

/* 預覽訊息安全檢查：只接受同源、且來自上層視窗（管理頁 iframe）的訊息。
   外部網站用彈出視窗開啟預覽頁時，window.parent === window，會被擋下。 */
/* ---------- 共用：把後端或預覽傳來的值限制成安全格式，避免被當成 HTML／指令碼 ---------- */
App.safeColor = function (v, fb) {
  v = String(v == null ? "" : v).trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : (fb || "#888888");
};
App.safeFit = function (v) {
  return String(v).toLowerCase() === "contain" ? "contain" : "cover";
};
/* 圖片來源：只允許 data:image、blob:、http(s) 網址或站內相對路徑；
   含引號、角括號、空白或其他協定（javascript: 等）一律拒絕，回傳空字串 */
App.safeImg = function (v) {
  v = String(v == null ? "" : v).trim();
  if (!v) return "";
  if (/["'<>`]/.test(v) || /\s/.test(v)) return "";
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(v)) return v;
  if (/^blob:https?:/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w./-]+$/.test(v) && !/^\/\//.test(v)) return v;   // 站內相對路徑
  return "";
};

/* 上傳圖片壓縮：先縮到建議寬度，再視需要逐步降品質／再縮小，
   讓結果塞得進試算表儲存格（免用 Drive 也能存）。回傳 WebP data URL。 */
App.fitImage = function (img, maxW, maxChars) {
  maxChars = maxChars || 44000;
  const draw = scale => {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    return cv;
  };
  let scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
  let best = null;
  // 先維持建議寬度逐步降品質；仍超過上限就再縮小，直到塞得下（寬度最低 100px）
  while (Math.round(img.naturalWidth * scale) >= 100) {
    const cv = draw(scale);
    for (const q of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
      const url = cv.toDataURL("image/webp", q);
      if (!best || url.length < best.length) best = url;
      if (url.length <= maxChars) return url;
    }
    scale *= 0.8;
  }
  return best;                     // 極端情況（例如純雜訊）已盡量壓到最小
};

App.fromAdmin = function (e) {
  return window.parent !== window && e.source === window.parent && e.origin === window.location.origin;
};

App.api = (function () {
  const URL_ = String(window.ICHIBAN_API_URL || "").trim();
  const preview = /[?&]preview\b/.test(location.search);
  const enabled = !!URL_ && !preview;
  const GUEST_KEY = "ichiban-guest";
  const TOKEN_KEY = "ichiban-admin-token";
  try { localStorage.removeItem("ichiban-member-key"); } catch (e) {}   // 舊版的匿名代碼，不再使用

  /* ---------- 活動頁訪客 ----------
     名稱＋手機號碼登入（目前不驗證手機是否屬實）；同一支手機＝同一位訪客。
     後端回傳「訪客代碼」存在這個瀏覽器，之後讀取錢包與抽獎都帶這個代碼。 */
  function guest() {
    try { const g = JSON.parse(localStorage.getItem(GUEST_KEY)); return g && g.key ? g : null; } catch (e) { return null; }
  }
  const memberKey = () => (guest() || {}).key || "";
  function saveGuest(g) { try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch (e) {} }
  function guestLogout() { try { localStorage.removeItem(GUEST_KEY); } catch (e) {} }
  /** 合併更新已登入訪客的欄位（例如重整後由 bootstrap 補上 uid） */
  function syncGuest(patch) { const g = guest(); if (g) saveGuest(Object.assign(g, patch || {})); }
  /** 手機號碼：09 開頭 10 碼（可含 - 或空白，也接受 +886） */
  function normPhone(p) {
    let s = String(p || "").replace(/[\s\-().]/g, "");
    if (/^\+?886/.test(s)) s = "0" + s.replace(/^\+?886/, "");
    return /^09\d{8}$/.test(s) ? s : null;
  }
  const phoneText = d => d.slice(0, 4) + "-" + d.slice(4, 7) + "-" + d.slice(7);
  /** 登入：連線模式由後端建立或找回訪客；離線示範只存在瀏覽器 */
  async function guestLogin(name, phone) {
    if (!enabled) {
      const d = normPhone(phone);
      const g = { key: "local-" + d, name: String(name).trim(), phone: phoneText(d) };
      saveGuest(g);
      return { guest: g, isNew: true };
    }
    const r = await post("guest.login", { name, phone });
    const g = { key: r.key, name: r.guest.name, phone: r.guest.phone, uid: r.guest.uid || "" };
    saveGuest(g);
    return Object.assign({}, r, { guest: g });
  }

  async function handle(res) {
    let body;
    try { body = await res.json(); } catch (e) { throw new Error("伺服器回應格式錯誤（HTTP " + res.status + "）"); }
    if (!body.ok) {
      const err = new Error(body.error || "伺服器錯誤");
      err.data = body.data;
      throw err;
    }
    return body.data;
  }
  async function get(action, params) {
    const u = new URL(URL_);
    u.searchParams.set("action", action);
    Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
    return handle(await fetch(u.toString(), { method: "GET" }));
  }
  async function post(action, body) {
    return handle(await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, body || {}))
    }));
  }

  /* ---------- 後台帳號登入 ----------
     登入成功後，後端發給「登入憑證」（12 小時有效），存在這個瀏覽器（三個後台頁共用）。
     憑證只放在 POST 內容，不放進網址；登出時通知後端作廢並清除。
     權限由後端判斷（角色 × 功能 × 動作，見後端 Auth.gs）；前端只依 perms 隱藏或停用按鈕。 */
  const SESSION_KEY = "ichiban-admin-session";
  const LOGIN_PAGE = "login.html";
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}          // 舊版的單一密碼，不再使用

  function session() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) {}
    if (!s || !s.token || !(s.expiresAt > Date.now())) return null;
    return s;
  }
  function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  /** 是否有某功能的某動作權限，例如 can("rules", "publish") */
  const can = (module, action) => { const s = session(); return !!(s && s.perms && s.perms[module] && s.perms[module][action]); };

  /** 前往登入頁，登入後回到目前頁面；reason：expired（逾時）等 */
  function toLogin(reason) {
    const here = location.pathname.split("/").pop() || "admin.html";
    location.replace(LOGIN_PAGE + "?next=" + encodeURIComponent(here + location.search) + (reason ? "&reason=" + reason : ""));
  }

  const register = (account, password, confirm) => post("auth.register", { account, password, confirm });
  async function login(account, password) {
    const r = await post("auth.login", { account, password });
    saveSession({ token: r.token, expiresAt: r.expiresAt, user: r.user, perms: r.perms });
    return r.user;
  }
  async function logout() {
    const s = session();
    clearSession();
    if (s) try { await post("auth.logout", { token: s.token }); } catch (e) {}
  }
  /** 向後端確認登入狀態，並更新角色（管理員可能調整過） */
  async function me() {
    const s = session();
    if (!s) throw Object.assign(new Error("請先登入"), { data: { auth: false } });
    const r = await post("auth.me", { token: s.token });
    saveSession(Object.assign(s, { user: r.user, perms: r.perms, expiresAt: r.expiresAt }));
    return r;
  }

  /** 後台請求：帶上登入憑證；未登入或已失效就清除並前往登入頁 */
  async function withSession(call) {
    const s = session();
    if (!s) { toLogin(); return new Promise(() => {}); }
    try { return await call(s.token); }
    catch (err) {
      if (err.data && err.data.auth === false) { clearSession(); toLogin("expired"); return new Promise(() => {}); }
      throw err;
    }
  }
  const adminGet = domain => withSession(token => post("admin.get", { domain, token }));
  const adminPost = (action, body) => withSession(token => post(action, Object.assign({}, body, { token })));
  /** 權限管理頁等其他後台動作 */
  const call = (action, body) => adminPost(action, body);

  return { enabled, url: URL_, memberKey, guest, syncGuest, guestLogin, guestLogout, normPhone, get, post, session, clearSession, can, toLogin, register, login, logout, me, adminGet, adminPost, call };
})();

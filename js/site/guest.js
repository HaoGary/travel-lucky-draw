/* ==========================================================
   guest.js — 訪客登入（App.guest）
   ----------------------------------------------------------
   ・一進活動頁就要登入：輸入名稱＋手機號碼（目前不驗證手機是否屬實）
   ・同一支手機號碼＝同一位訪客，換裝置登入會看到同一個錢包與抽獎紀錄
   ・登入前彈窗不能關閉；頂部列顯示訪客名稱與「登出」
   ・管理頁的預覽（index.html?preview）不需要登入
   ========================================================== */
window.App = window.App || {};

App.guest = (function () {
  const { api, store, ui } = App;
  const PREVIEW = /[?&]preview\b/.test(location.search);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const current = () => (PREVIEW ? { name: "預覽" } : api.guest());
  const ok = () => !!current();

  /* ---------- 頂部列：訪客名稱、登出 ---------- */
  function renderChip() {
    const box = $("guestBox");
    if (!box) return;
    const g = PREVIEW ? null : api.guest();
    box.hidden = !g;
    if (g) {
      $("guestName").textContent = g.name;
      $("guestName").title = g.name + "（" + g.phone + "）";
    }
  }

  /* ---------- 登入彈窗 ---------- */
  function showLogin(reason) {
    if (PREVIEW || $("guestForm")) return;
    const last = (() => { try { return JSON.parse(localStorage.getItem("ichiban-guest-last")) || {}; } catch (e) { return {}; } })();
    ui.openModal(`
      <div class="modal__panel ib-guest" role="dialog" aria-modal="true" aria-labelledby="guestTitle" aria-describedby="guestDesc">
        <header class="modal__header"><h3 class="modal__title" id="guestTitle">訪客登入</h3></header>
        <form class="modal__body ib-guest__form" id="guestForm" novalidate>
          <p class="ib-guest__desc" id="guestDesc">${reason ? esc(reason) + "<br>" : ""}輸入名稱與手機號碼即可開始抽獎。同一支手機號碼會保留您的數位幣與抽獎紀錄。</p>
          <p class="ib-guest__alert" id="guestAlert" role="alert" hidden></p>
          <div class="ib-guest__field" data-for="name">
            <label class="ib-guest__label" for="guestNameInput">名稱<span class="ib-guest__req" aria-hidden="true">＊</span></label>
            <input class="ib-guest__input" id="guestNameInput" name="name" type="text" maxlength="20" autocomplete="nickname"
              placeholder="例如：王小明" required aria-describedby="guestNameHelp" value="${esc(last.name || "")}">
            <p class="ib-guest__help" id="guestNameHelp" data-hint="最多 20 個字">最多 20 個字</p>
          </div>
          <div class="ib-guest__field" data-for="phone">
            <label class="ib-guest__label" for="guestPhoneInput">手機號碼<span class="ib-guest__req" aria-hidden="true">＊</span></label>
            <input class="ib-guest__input" id="guestPhoneInput" name="phone" type="tel" inputmode="numeric" maxlength="13"
              autocomplete="tel-national" placeholder="0912345678" required aria-describedby="guestPhoneHelp" value="${esc(last.phone || "")}">
            <p class="ib-guest__help" id="guestPhoneHelp" data-hint="09 開頭共 10 碼">09 開頭共 10 碼</p>
          </div>
          <button class="btn btn--primary btn--block ib-guest__submit" id="guestSubmit" type="submit">開始抽獎</button>
        </form>
      </div>`, { lock: true });
    const form = $("guestForm");
    const input = n => form.querySelector(`[name="${n}"]`);
    const setError = (n, text) => {
      const f = form.querySelector(`[data-for="${n}"]`), help = f.querySelector(".ib-guest__help");
      f.classList.toggle("is-error", !!text);
      input(n).setAttribute("aria-invalid", String(!!text));
      help.textContent = text || help.dataset.hint;
    };
    const check = n => {
      const v = input(n).value.trim();
      if (n === "name") return !v ? "請輸入名稱" : v.length > 20 ? "名稱最多 20 個字" : "";
      return !v ? "請輸入手機號碼" : !api.normPhone(v) ? "請輸入正確的手機號碼（09 開頭共 10 碼）" : "";
    };
    ["name", "phone"].forEach(n => {
      input(n).addEventListener("blur", () => { if (input(n).value) setError(n, check(n)); });
      input(n).addEventListener("input", () => { if (form.querySelector(`[data-for="${n}"]`).classList.contains("is-error")) setError(n, check(n)); });
    });
    // 彈窗淡入後才能取得焦點
    setTimeout(() => (last.name ? input("phone") : input("name")).focus(), 120);

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const alertBox = $("guestAlert");
      alertBox.hidden = true;
      const errs = { name: check("name"), phone: check("phone") };
      Object.keys(errs).forEach(n => setError(n, errs[n]));
      const bad = ["name", "phone"].find(n => errs[n]);
      if (bad) { input(bad).focus(); return; }
      const btn = $("guestSubmit");
      btn.disabled = true; btn.textContent = "登入中…";
      const name = input("name").value.trim(), phone = input("phone").value.trim();
      try {
        const r = await api.guestLogin(name, phone);
        try { localStorage.setItem("ichiban-guest-last", JSON.stringify({ name: r.guest.name, phone: r.guest.phone })); } catch (err) {}
        if (r.wallet) store.setGuest(r);
        renderChip();
        ui.closeModal();
        ui.renderCoins(true);
        ui.toast(`歡迎，${r.guest.name}！` + (r.wallet && !r.wallet.DIGITAL ? "目前數位幣為 0，加值後即可抽獎" : ""));
      } catch (err) {
        btn.disabled = false; btn.textContent = "開始抽獎";
        const field = err.data && err.data.field;
        if (field && form.querySelector(`[data-for="${field}"]`)) { setError(field, err.message); input(field).focus(); }
        else { alertBox.textContent = err.message || "登入失敗，請稍後再試"; alertBox.hidden = false; }
      }
    });
  }

  /* ---------- 登出 ---------- */
  function confirmLogout() {
    const g = api.guest();
    if (!g) return;
    ui.openModal(`
      <div class="modal__panel ib-guest" role="alertdialog" aria-modal="true" aria-labelledby="mh" aria-describedby="guestOutText">
        <header class="modal__header"><h3 class="modal__title" id="mh">確定要登出嗎？</h3><button class="modal__close" aria-label="關閉">×</button></header>
        <div class="modal__body">
          <p class="ib-guest__desc" id="guestOutText">登出後，再用同一支手機號碼（${esc(g.phone)}）登入，即可繼續使用原本的數位幣與抽獎紀錄。</p>
          <div class="ib-guest__actions">
            <button class="btn btn--outline" type="button" data-guest="cancel">取消</button>
            <button class="btn btn--primary" type="button" data-guest="out">登出</button>
          </div>
        </div>
      </div>`);
    $("modal").querySelector('[data-guest="cancel"]').addEventListener("click", ui.closeModal);
    $("modal").querySelector('[data-guest="out"]').addEventListener("click", () => signOut());
  }
  /** 清除訪客並顯示登入彈窗（reason：顯示在彈窗上的說明） */
  function signOut(reason) {
    api.guestLogout();
    store.signOut();
    ui.setSel(null);
    renderChip();
    ui.renderCoins();
    showLogin(reason);
  }

  /* ---------- 心跳：登入後每隔幾秒確認金鑰是否仍有效 ----------
     單一裝置登入：別人用同帳號登入後，這台的舊金鑰會失效，心跳偵測到就立刻登出。
     只在前景分頁、已登入、非預覽、有連後端時才打；背景分頁暫停以節省後端額度。 */
  const HEARTBEAT_MS = 8000;
  let hbTimer = 0, hbBusy = false;
  async function heartbeat() {
    if (hbBusy || PREVIEW || !api.enabled || document.hidden) return;
    const g = api.guest();
    if (!g || !g.key) return;
    hbBusy = true;
    try {
      const r = await api.get("ping", { member: g.key });
      if (r && r.valid === false) signOut("此帳號已在其他裝置登入，您已被登出。請重新登入。");
    } catch (e) { /* 網路暫時失敗就略過，下次再試 */ }
    finally { hbBusy = false; }
  }
  function startHeartbeat() {
    if (hbTimer) return;
    hbTimer = setInterval(heartbeat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) heartbeat(); });
    window.addEventListener("focus", heartbeat);
  }

  /** 進入頁面：沒有登入就顯示登入彈窗 */
  function init() {
    if (PREVIEW) return;
    const out = $("btnGuestOut");
    if (out) out.addEventListener("click", confirmLogout);
    renderChip();
    startHeartbeat();          // 啟動心跳（未登入時自動略過，登入後開始生效）
    if (!ok()) showLogin();
  }

  return { ok, current, init, showLogin, signOut, renderChip, preview: PREVIEW };
})();

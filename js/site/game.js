/* ==========================================================
   game.js — 抽獎流程：確認 → 撕籤動畫 → 中獎結果 → 換輪
   ========================================================== */
window.App = window.App || {};

App.game = (function () {
  const { config, PRIZES, art, store, ui } = App;

  let busy = false;
  function startDraw() {
    const sel = ui.getSel();
    if (sel === null || busy) return;
    if (App.guest && !App.guest.ok()) { App.guest.showLogin("請先登入再抽獎。"); return; }

    busy = true;
    const btn = ui.$("btnDraw");
    if (btn) btn.disabled = true;
    const done = () => { busy = false; if (btn) btn.disabled = false; };
    const fail = res => { ui.toast(res.error); ui.setSel(null); ui.renderCoins(); ui.renderBoard(); };

    // 離線版：同步回傳結果
    if (!store.remote) {
      const res = store.draw(sel);
      done();
      if (res.error) { fail(res); return; }
      ui.setSel(null);
      ui.renderCoins(true);
      showTear(res.char, res.cellIndex).ready(res);
      return;
    }
    // 連線版：先打開籤紙（顯示「開獎中…」），同時向後端抽獎，結果回來後才能撕開
    const ticket = showTear(store.currentChar(), sel);
    Promise.resolve(App.ready).catch(() => {}).then(() => store.draw(sel)).then(res => {
      done();
      if (res.error && res.guest === false) { App.guest.signOut("登入資料已失效，請重新登入。"); return; }
      if (res.error) { ui.closeModal(); fail(res); return; }
      ui.setSel(null);
      ui.renderCoins(true);
      ticket.ready(res);
    });
  }

  /* 撕籤：效果實作在 tear.js；結果到了（ready）才能撕開 */
  function showTear(char, cellIndex) {
    ui.openModal(`
      <div class="ib-tear" role="dialog" aria-modal="true" aria-label="撕籤">
        <p class="ib-tear__hint is-wait" id="tearHint">開獎中…</p>
        <div class="ib-ticket" id="ticket">
          <div class="ib-ticket__strip" id="strip" aria-label="籤頭，往右拖曳撕開"></div>
          <svg class="ib-ticket__edge" aria-hidden="true"></svg>
          <div class="ib-ticket__body">
            <div class="ib-ticket__result" id="ticketResult"></div>
            <div class="ib-ticket__flap"><span class="ib-ticket__flap-mark">一番賞</span></div>
          </div>
          <div class="ib-ticket__bits" aria-hidden="true"></div>
        </div>
        <div class="ib-tear__actions"><button class="btn btn--soft" id="tearBtn" disabled>直接撕開</button></div>
      </div>`, { lock: true });

    const $ = ui.$;
    return {
      ready({ grade, last }) {
        if (!$("ticket")) return;
        $("ticketResult").innerHTML = `${grade}<small class="ib-ticket__result-unit">賞</small>`;
        $("tearHint").classList.remove("is-wait");
        $("tearHint").textContent = "按住籤頭，沿虛線往右撕開";
        const tear = App.tear.mount($("ticket"), {
          label: `${char.name}・第${cellIndex + 1}籤`,
          onDone: () => showWin(grade, last)
        });
        $("tearBtn").disabled = false;
        $("tearBtn").addEventListener("click", () => {
          $("tearBtn").hidden = true;
          $("tearHint").textContent = "撕開中…";
          tear.finish();
        });
      }
    };
  }

  /* 中獎結果 */
  function showWin(grade, last) {
    const rw = config.REWARD[grade] || {};
    const note = rw.coins
      ? `<div class="ib-win__note">${rw.coins} 枚${config.CURRENCY}已回饋至帳戶</div>`
      : rw.voucher
        ? `<div class="ib-win__note">購物金將於活動結束後匯入</div>`
        : "";

    ui.openModal(`
      <div class="modal__panel ib-win" role="dialog" aria-modal="true" aria-labelledby="wh">
        <span class="ib-win__badge">恭喜您獲得</span>
        <div class="ib-win__grade" id="wh">${art.gradeLabel(grade)}</div>
        ${art.prize(grade, "ib-win__icon")}
        <h4 class="ib-win__name">${PRIZES[grade].name}</h4>
        ${note}
        ${last ? `<div class="ib-win__extra">你抽出本輪最後一張籤！<br>加碼獲得 LAST ONE 賞：${PRIZES.L.name}</div>` : ""}
        <button class="btn btn--primary btn--block ib-win__confirm" id="okBtn">確定</button>
      </div>`, { lock: true });

    ui.$("okBtn").addEventListener("click", () => {
      ui.closeModal();
      ui.renderCoins(!!rw.coins);
      if (last) ui.toast(`第 ${store.nextRound()} 輪開始，籤已全部補滿`);
      ui.renderBoard();
    });
  }

  return { startDraw };
})();

/* ==========================================================
   main.js — 進入點：綁定事件、初次渲染
   ========================================================== */
(function () {
  const { store, ui, game } = App;
  const $ = ui.$;

  /* 點格子：選取／取消選取 */
  $("grid").addEventListener("click", e => {
    const cell = e.target.closest(".ib-board__cell");
    if (!cell || cell.disabled) return;
    const i = +cell.dataset.i;
    ui.setSel(ui.getSel() === i ? null : i);
  });

  /* 切換角色 */
  $("picker").addEventListener("click", e => {
    const p = e.target.closest(".ib-picker__item");
    if (!p) return;
    store.setChar(+p.dataset.i);
    ui.setSel(null);
    ui.renderPicker();
    ui.scrollPickerTo(+p.dataset.i);     // 選到的角色順勢靠左，方便點選下一隻
    // 連線模式：取得最新籤盤（其他玩家可能剛抽過）
    if (store.remote) store.refreshBoard().then(b => { if (b) ui.renderBoard(); });
  });

  $("btnReset").addEventListener("click", () => ui.setSel(null));
  $("btnDraw").addEventListener("click", game.startDraw);
  $("btnRec").addEventListener("click", ui.showRecords);
  $("btnBoard").addEventListener("click", ui.showBoard);

  /* 獎項卡片：開啟獎品詳情 */
  $("prizes").addEventListener("click", e => {
    const btn = e.target.closest("[data-prize]");
    if (btn) ui.showPrize(btn.dataset.prize);
  });
  ui.bindModal();
  App.guest.init();                 // 沒有登入就先顯示訪客登入彈窗

  function render() {
    ui.renderCoins();
    ui.renderPicker();
    ui.renderBoard(); // 內含 renderPrizes()
    /* 動畫：在第一次渲染完成後初始化（進場、捲動觸發），只執行一次 */
    App.motion && App.motion.init();
  }

  /* 連線模式（js/core/api-config.js 有填網址）
     ・再次造訪：先用上次的資料（瀏覽器暫存）立即顯示，同時向後端取得最新資料，回來後有變動才重畫
     ・第一次造訪：等後端資料回來再顯示
     ・抽獎會等最新資料到了才送出（App.ready），避免用到舊的籤盤
     連不上時改用離線示範，頁面仍可瀏覽 */
  if (App.api && App.api.enabled) {
    const root = document.documentElement;
    const CACHE_KEY = "ichiban-boot-cache";
    const owner = { url: App.api.url, member: App.api.memberKey() };
    const readCache = () => {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY));
        return c && c.url === owner.url && c.member === owner.member ? c.data : null;
      } catch (e) { return null; }
    };
    const writeCache = data => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.assign({ data }, owner))); } catch (e) {} };

    const sigs = {};
    /** 套用後端資料；回傳獎品與角色內容是否有變（已顯示的卡片需要重建） */
    function useData(data) {
      const live = data.live || {};
      const changed = k => { const s = JSON.stringify(live[k] || null); if (s === sigs[k]) return false; sigs[k] = s; return !!live[k]; };
      if (changed("theme")) App.theme.apply(live.theme);
      const catalogChanged = changed("catalog");
      if (catalogChanged) App.catalog.apply(live.catalog);
      if (changed("rules")) App.rules.apply(live.rules);
      store.connect(data);
      return catalogChanged;
    }

    const cached = readCache();
    if (cached) { useData(cached); root.dataset.api = "connecting"; render(); }
    else root.classList.add("is-loading");

    App.ready = App.api.get("bootstrap", { member: owner.member })
      .then(data => {
        writeCache(data);
        const changed = !cached || JSON.stringify(cached) !== JSON.stringify(data);
        const catalogChanged = useData(data);
        // 瀏覽器記得的訪客代碼已不存在（例如資料被清除）：請重新登入
        if (owner.member && !data.guest && App.api.memberKey() === owner.member) App.guest.signOut("登入資料已失效，請重新登入。");
        else if (data.guest) { if (data.guest.uid) App.api.syncGuest({ uid: data.guest.uid }); App.guest.renderChip(); }
        root.dataset.api = "connected";                         // 除錯用：<html data-api="connected">
        console.info("[ichiban] 已連線 Apps Script：" + App.api.url);
        if (cached && changed) {
          ui.renderCoins();
          if (catalogChanged) App.catalog.refresh();               // 重建角色列與獎項卡片
          else { ui.renderPicker(); ui.renderBoard(); }
        }
      })
      .catch(err => {
        console.error(err);
        root.dataset.api = "error";
        ui.toast("暫時無法連線伺服器" + (cached ? "，目前顯示上次的資料" : "，目前顯示離線示範"));
      })
      .finally(() => {
        root.classList.remove("is-loading");
        if (!cached) render();
      });
  } else {
    document.documentElement.dataset.api = "offline";
    render();
  }
})();

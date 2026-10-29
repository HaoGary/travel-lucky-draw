/* ==========================================================
   store.js — 遊戲狀態（籤池、餘額、紀錄）
   目前存在瀏覽器 localStorage；串接後端時，
   把 load / save / draw 換成 API 呼叫即可，畫面層不用改。
   ========================================================== */
window.App = window.App || {};

App.store = (function () {
  const { config, CHARS } = App;
  const N = config.COLS * config.ROWS;
  // 管理頁的預覽（index.html?preview）不寫入存檔，避免影響真正的遊戲進度
  const PREVIEW = /[?&]preview\b/.test(location.search);

  /* 固定種子亂數：同一角色同一輪的籤序每次重整都一樣 */
  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function makeBoard(charIdx, round, preopen) {
    const r = rng(charIdx * 977 + round * 131 + 7);
    // 籤序依「遊戲規則」的分佈設定產生（rules.js）；未載入時為純隨機
    let cells;
    if (App.rules) cells = App.rules.makeCells(CHARS[charIdx].id, r);
    else {
      cells = [];
      for (const k in config.POOL) for (let i = 0; i < config.POOL[k]; i++) cells.push(k);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
    }
    const opened = new Array(N).fill(false);
    if (preopen) { // 示範用：模擬其他玩家已抽過的格子
      let k = 12 + Math.floor(r() * 18), tries = 0;
      while (k > 0 && tries++ < 500) {
        const i = Math.floor(r() * N);
        if (!opened[i] && cells[i] !== "A") { opened[i] = true; k--; }
      }
    }
    // pool：記下本輪的各賞數量，規則中途調整時，進行中的輪次仍以開輪時的數量顯示
    return { round, cells, opened, pool: { ...config.POOL } };
  }

  function fresh() {
    const s = { balance: config.START_BALANCE, voucher: 0, cur: 0, records: [], boards: {} };
    CHARS.forEach((c, i) => (s.boards[c.id] = makeBoard(i, config.START_ROUND, true)));
    return s;
  }

  let state;
  try { state = JSON.parse(localStorage.getItem(config.STORAGE_KEY)); } catch (e) {}
  if (!state || !state.boards) state = fresh();

  /* 連線模式：籤盤、餘額、紀錄都以後端為準（App.api），本機不再存檔 */
  let remote = false, pendingNext = null;

  function save() {
    if (PREVIEW || remote) return;
    try { localStorage.setItem(config.STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  const currentChar = () => CHARS[state.cur];
  const currentBoard = () => state.boards[currentChar().id];
  const leftCount = b => b.opened.filter(x => !x).length;

  const poolOf = b => b.pool || config.POOL;
  function remain(b) {
    if (b.remaining) return Object.assign({}, b.remaining);   // 後端提供的剩餘數量（未開格的賞別不會傳到前端）
    const o = {};
    for (const k in poolOf(b)) o[k] = 0;
    b.cells.forEach((k, i) => { if (!b.opened[i]) o[k]++; });
    return o;
  }

  function setChar(i) { state.cur = i; save(); }

  /* 抽一格；回傳結果或錯誤 */
  function draw(cellIndex) {
    if (remote) return drawRemote(cellIndex);
    const b = currentBoard(), c = currentChar();
    if (b.opened[cellIndex]) return { error: "這格已經被抽走了，請換一格" };
    if (state.balance < config.COST) return { error: `${config.CURRENCY}不足 ${config.COST} 枚，暫時無法抽獎` };

    state.balance -= config.COST;
    const grade = b.cells[cellIndex];
    b.opened[cellIndex] = true;
    const last = b.opened.every(Boolean);

    const rw = config.REWARD[grade] || {};
    if (rw.coins) state.balance += rw.coins;
    if (rw.voucher) state.voucher += rw.voucher;

    const d = new Date(), p = n => String(n).padStart(2, "0");
    state.records.push({
      t: `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`,
      c: c.name, cell: cellIndex + 1, g: grade, last
    });
    save();
    return { grade, last, char: c, cellIndex };
  }

  /* 本輪抽完 → 開新一輪 */
  function nextRound() {
    if (remote) {
      const id = currentChar().id;
      if (pendingNext) { state.boards[id] = pendingNext; pendingNext = null; }
      return state.boards[id].round;
    }
    const b = currentBoard();
    state.boards[currentChar().id] = makeBoard(state.cur, b.round + 1, false);
    save();
    return b.round + 1;
  }

  /* 預覽用：以目前規則重新產生所有角色的格子（不寫入存檔） */
  function rebuild() {
    if (!PREVIEW) return;
    CHARS.forEach((c, i) => (state.boards[c.id] = makeBoard(i, config.START_ROUND, false)));
  }

  /* ---------- 連線模式 ---------- */
  /** 套用後端 bootstrap 的資料（錢包、各角色籤盤、抽獎紀錄） */
  let guestData = null;   // 訪客登入取得的錢包與紀錄（登入可能比 bootstrap 先完成）
  function connect(data) {
    remote = true;
    const cur = state && state.cur < CHARS.length ? state.cur : 0;
    state = { balance: 0, voucher: 0, cur, records: [], boards: data.boards };
    if (data.wallet) guestData = data;
    applyGuest();
  }
  function applyGuest() {
    if (!remote || !guestData) return;
    state.balance = guestData.wallet.DIGITAL || 0;
    state.voucher = guestData.wallet.VOUCHER || 0;
    state.records = guestData.records || [];
  }
  /** 訪客登入後：套用錢包與抽獎紀錄 */
  function setGuest(data) {
    if (!data || !data.wallet) return;
    guestData = { wallet: data.wallet, records: data.records };
    applyGuest();
  }
  /** 訪客登出：連線模式清空錢包與紀錄（離線示範保留本機進度） */
  function signOut() {
    guestData = null;
    if (!remote) return;
    state.balance = 0; state.voucher = 0; state.records = [];
  }
  /** 抽一格（非同步）：回傳與離線版相同格式的結果，或 { error } */
  function drawRemote(cellIndex) {
    const c = currentChar(), b = currentBoard();
    if (b.opened[cellIndex]) return Promise.resolve({ error: "這格已經被抽走了，請換一格" });
    if (state.balance < config.COST) return Promise.resolve({ error: `${config.CURRENCY}不足 ${config.COST} 枚，暫時無法抽獎` });
    return App.api.post("draw", { member: App.api.memberKey(), character: c.id, cell: cellIndex + 1 })
      .then(res => {
        state.boards[c.id] = res.board;
        pendingNext = res.next;
        state.balance = res.wallet.DIGITAL || 0;
        state.voucher = res.wallet.VOUCHER || 0;
        state.records.push(res.record);
        return { grade: res.grade, last: res.last, char: c, cellIndex };
      })
      .catch(err => {
        if (err.data && err.data.board) state.boards[c.id] = err.data.board;   // 被別人抽走時更新籤盤
        return { error: err.message || "連線失敗，請稍後再試", guest: !(err.data && err.data.guest === false) };
      });
  }
  /** 重新取得目前角色的籤盤（切換角色時，看到其他玩家抽過的格子） */
  function refreshBoard() {
    if (!remote) return Promise.resolve(null);
    const c = currentChar();
    return App.api.get("board", { character: c.id }).then(b => { state.boards[c.id] = b; return b; }).catch(() => null);
  }

  return {
    get state() { return state; },
    get remote() { return remote; },
    connect, setGuest, signOut, refreshBoard,
    reveal: false,      // 預覽用：在格子上顯示賞別（只有管理頁預覽會開啟）
    currentChar, currentBoard, leftCount, remain, poolOf, setChar, draw, nextRound, rebuild
  };
})();

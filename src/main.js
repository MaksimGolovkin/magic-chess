import { Chess } from 'chess.js';
import { Board3D } from './board3d.js';
import { PIECE_NAMES, loadModels, loadHeroes, setPieceStyle } from './pieces.js';
import { Engine, LEVELS } from './ai.js';
import { Online, joinCodeFromHash } from './net.js';

const $ = (id) => document.getElementById(id);
const SIDE = { w: 'светлых', b: 'тёмных' };
const ARMY = { w: 'Люди и эльфы', b: 'Орки' };

const chess = new Chess();
const board = new Board3D($('stage'), { onSquareClick });
board.setPosition(chess.board());
board.idleSpin = true;
loadModels().then((loaded) => {
  // swap in sculpted models as soon as they arrive, unless a move is animating
  if (loaded.length && !state.busy) board.setPosition(chess.board());
});

const state = {
  mode: null, // 'ai' | 'online' | 'local'
  myColor: 'w',
  level: 1,
  busy: false,
  selected: null,
  lastMove: null,
  gameOver: false,
  gameId: 0,
  pending: [],
  connected: false,
};
let engine = null;
let online = null;

// ---------- menu ----------
function showMenu(section = 'modeList') {
  for (const id of ['modeList', 'aiSetup', 'onlineSetup', 'joinSetup']) $(id).hidden = id !== section;
  $('menu').hidden = false;
  $('hud').hidden = true;
  $('result').hidden = true;
  board.idleSpin = true;
}
function hideMenu() {
  $('menu').hidden = true;
  $('hud').hidden = false;
  board.idleSpin = false;
}

LEVELS.forEach((L, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.dataset.level = String(i);
  b.textContent = L.name;
  $('levelSeg').appendChild(b);
});
function syncSeg(seg, attr, value) {
  for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset[attr] === String(value)));
}
syncSeg($('levelSeg'), 'level', state.level);
$('levelSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.level = Number(b.dataset.level);
  syncSeg($('levelSeg'), 'level', state.level);
});
$('styleSeg').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const style = b.dataset.style;
  if (style === 'heroes' && !(await loadHeroes())) {
    toast('Не удалось загрузить героев. Обновите страницу и попробуйте ещё раз.');
    return;
  }
  setPieceStyle(style);
  syncSeg($('styleSeg'), 'style', style);
  if (!state.busy) board.setPosition(chess.board());
});
$('colorSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.myColor = b.dataset.color;
  syncSeg($('colorSeg'), 'color', state.myColor);
});
for (const b of document.querySelectorAll('.back')) b.addEventListener('click', () => { leaveOnline(); showMenu(); });

$('pickAI').onclick = () => showMenu('aiSetup');
$('pickLocal').onclick = () => { leaveOnline(); state.mode = 'local'; state.myColor = 'w'; hideMenu(); newGame(); };
$('startAI').onclick = () => {
  leaveOnline();
  state.mode = 'ai';
  engine ??= new Engine();
  hideMenu();
  newGame();
};
$('pickOnline').onclick = () => { showMenu('onlineSetup'); hostOnline(); };
$('joinBack').onclick = () => { leaveOnline(); history.replaceState(null, '', location.pathname); showMenu(); };

$('copyLink').onclick = async () => {
  const input = $('linkInput');
  try {
    await navigator.clipboard.writeText(input.value);
    $('copyLink').textContent = 'Скопировано';
  } catch {
    input.select();
    $('copyLink').textContent = 'Выделено, нажмите Ctrl+C';
  }
};

// ---------- HUD ----------
$('btnFlip').onclick = () => {
  board.setOrientation(Math.cos(board.thetaTarget) > 0 ? 'b' : 'w');
};
$('btnNew').onclick = () => {
  if (state.mode === 'online') {
    if (!state.connected) return;
    online.send({ t: 'rematch' });
  }
  newGame();
};
$('btnResign').onclick = () => {
  if (state.gameOver) return;
  if (state.mode === 'online') online.send({ t: 'resign' });
  const winner = state.myColor === 'w' ? 'b' : 'w';
  finish(`Победили ${SIDE[winner]}`, 'Вы сдались.');
};
$('btnMenu').onclick = () => { leaveOnline(); state.mode = null; state.gameId++; showMenu(); };
$('resultAgain').onclick = () => {
  if (state.mode === 'online') {
    if (!state.connected) { toast('Соперник отключился. Создайте новую ссылку в меню.'); return; }
    online.send({ t: 'rematch' });
  }
  newGame();
};
$('resultClose').onclick = () => { $('result').hidden = true; };

let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

// ---------- game flow ----------
function newGame() {
  state.gameId++;
  chess.reset();
  board.setPosition(chess.board());
  Object.assign(state, { selected: null, lastMove: null, gameOver: false, busy: false, pending: [] });
  board.setOrientation(state.mode === 'local' ? 'w' : state.myColor);
  $('result').hidden = true;
  $('btnResign').hidden = state.mode === 'local';
  $('modeLabel').textContent = {
    ai: `Против компьютера · ${LEVELS[state.level].name}`,
    online: 'Игра с другом',
    local: 'Вдвоём за одним экраном',
  }[state.mode];
  refresh();
  if (state.mode === 'ai') {
    engine.newGame();
    if (state.myColor !== 'w') aiMove();
  }
}

function canControl(color) {
  if (state.mode === 'local') return true;
  if (state.mode === 'ai') return color === state.myColor;
  if (state.mode === 'online') return state.connected && color === state.myColor;
  return false;
}

async function onSquareClick(sq) {
  if (state.busy || state.gameOver || !$('menu').hidden || !$('promo').hidden) return;
  const turn = chess.turn();
  if (!canControl(turn)) return;
  if (state.selected) {
    const options = chess.moves({ square: state.selected, verbose: true }).filter((m) => m.to === sq);
    if (options.length) {
      const move = { from: state.selected, to: sq };
      if (options.some((m) => m.promotion)) move.promotion = await askPromotion(turn);
      play(move);
      return;
    }
  }
  const piece = chess.get(sq);
  state.selected = piece && piece.color === turn && sq !== state.selected ? sq : null;
  refresh();
}

async function play(moveInput, { remote = false } = {}) {
  let mv;
  try {
    mv = chess.move(moveInput);
  } catch {
    return false;
  }
  if (!mv) return false;
  const id = state.gameId;
  state.selected = null;
  state.busy = true;
  board.setHighlights({ lastMove: [mv.from, mv.to] });
  if (state.mode === 'online' && !remote) online.send({ t: 'move', from: mv.from, to: mv.to, promotion: mv.promotion });
  await board.animateMove(mv);
  if (id !== state.gameId) return true; // a new game started mid-animation
  state.busy = false;
  state.lastMove = [mv.from, mv.to];
  if (state.mode === 'local' && !chess.isGameOver()) board.setOrientation(chess.turn());
  refresh();
  if (checkGameOver()) return true;
  if (state.mode === 'ai' && chess.turn() !== state.myColor) aiMove();
  if (state.pending.length) play(state.pending.shift(), { remote: true });
  return true;
}

async function aiMove() {
  const id = state.gameId;
  state.busy = true;
  refresh();
  const started = performance.now();
  const move = await engine.bestMove(chess.fen(), state.level);
  const waitMore = 450 - (performance.now() - started); // a short pause reads as "thinking"
  if (waitMore > 0) await new Promise((r) => setTimeout(r, waitMore));
  if (id !== state.gameId || state.gameOver) return;
  state.busy = false;
  play(move);
}

function askPromotion(color) {
  return new Promise((resolve) => {
    const grid = $('promoGrid');
    grid.textContent = '';
    for (const [type, label] of [['q', 'Ферзь'], ['r', 'Ладья'], ['b', 'Слон'], ['n', 'Конь']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span>${label}</span><small>${PIECE_NAMES[color][type]}</small>`;
      b.onclick = () => { $('promo').hidden = true; resolve(type); };
      grid.appendChild(b);
    }
    $('promo').hidden = false;
  });
}

function kingSquare(color) {
  for (const row of chess.board()) for (const c of row) if (c && c.type === 'k' && c.color === color) return c.square;
  return null;
}

function refresh() {
  const turn = chess.turn();
  const targets = state.selected
    ? chess.moves({ square: state.selected, verbose: true }).map((m) => ({ sq: m.to, capture: Boolean(m.captured) }))
    : [];
  board.setHighlights({
    selected: state.selected,
    targets,
    lastMove: state.lastMove,
    check: chess.inCheck() ? kingSquare(turn) : null,
    color: turn,
  });
  let text;
  if (state.mode === 'ai') text = turn === state.myColor ? 'Ваш ход' : 'Компьютер думает…';
  else if (state.mode === 'online') text = !state.connected ? 'Соперник не в сети' : turn === state.myColor ? 'Ваш ход' : 'Ход соперника';
  else text = `Ход ${SIDE[turn]}`;
  if (chess.inCheck() && !chess.isGameOver()) text += ' · шах!';
  const s = $('statusText');
  s.textContent = text;
  s.className = turn;
}

function checkGameOver() {
  if (!chess.isGameOver()) return false;
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'b' : 'w';
    finish(`Мат! Победили ${SIDE[winner]}`, `${ARMY[winner]} взяли верх в этой битве.`);
  } else if (chess.isStalemate()) finish('Ничья', 'Пат: ходить некуда, но и шаха нет.');
  else if (chess.isThreefoldRepetition()) finish('Ничья', 'Позиция повторилась три раза.');
  else if (chess.isInsufficientMaterial()) finish('Ничья', 'Ни у кого не хватает фигур, чтобы поставить мат.');
  else finish('Ничья', 'Правило 50 ходов.');
  return true;
}

function finish(title, text) {
  state.gameOver = true;
  state.gameId++; // stops a pending computer move
  state.busy = false;
  $('resultTitle').textContent = title;
  $('resultText').textContent = text;
  $('result').hidden = false;
}

// ---------- online ----------
function onlineHandlers() {
  return {
    onLink(url) {
      $('linkInput').value = url;
      $('linkBox').hidden = false;
      $('onlineInfo').textContent = 'Отправьте эту ссылку другу. Игра начнётся, как только он её откроет.';
    },
    onConnect() {
      state.connected = true;
      if (state.myColor === 'w') {
        online.send({ t: 'start' });
        hideMenu();
        newGame();
        toast('Соперник подключился. Вы играете за людей и эльфов.');
      }
    },
    onData(msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'start') {
        hideMenu();
        newGame();
        toast('Вы в игре! Вы играете за орков.');
      } else if (msg.t === 'move') {
        const move = { from: msg.from, to: msg.to, promotion: msg.promotion };
        if (state.busy) state.pending.push(move);
        else play(move, { remote: true });
      } else if (msg.t === 'resign') {
        finish(`Победили ${SIDE[state.myColor]}`, 'Соперник сдался.');
      } else if (msg.t === 'rematch') {
        newGame();
        toast('Соперник начал новую партию.');
      }
    },
    onClose() {
      state.connected = false;
      refresh();
      toast('Соперник отключился.');
    },
    onError(text) {
      if (!$('menu').hidden) {
        $('onlineInfo').textContent = text;
        $('joinInfo').textContent = text;
      } else toast(text);
    },
  };
}

function hostOnline() {
  leaveOnline();
  state.mode = 'online';
  state.myColor = 'w';
  $('linkBox').hidden = true;
  $('copyLink').textContent = 'Копировать';
  $('onlineInfo').textContent = 'Создаём ссылку…';
  online = new Online(onlineHandlers());
  online.host();
}

function joinOnline(code) {
  leaveOnline();
  state.mode = 'online';
  state.myColor = 'b';
  showMenu('joinSetup');
  online = new Online(onlineHandlers());
  online.join(code);
}

function leaveOnline() {
  if (online) online.destroy();
  online = null;
  state.connected = false;
}

// ---------- start ----------
const code = joinCodeFromHash();
if (code) joinOnline(code);
else showMenu();

// handy for debugging in the console
window.__game = { chess, board, state, click: onSquareClick };

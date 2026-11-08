// Peer-to-peer play by invite link (WebRTC through PeerJS's public signalling server).
import Peer from 'peerjs';

const PREFIX = 'magic-chess-';
// By default PeerJS uses its free public server. Set VITE_PEER_HOST (and VITE_PEER_PORT)
// at build time to use your own signalling server instead.
const env = import.meta.env;
const PEER_OPTIONS = env.VITE_PEER_HOST
  ? { host: env.VITE_PEER_HOST, port: Number(env.VITE_PEER_PORT || 443), path: env.VITE_PEER_PATH || '/', secure: env.VITE_PEER_SECURE !== 'false' }
  : {};

export function inviteLink(code) {
  return `${location.origin}${location.pathname}#join=${code}`;
}
export function joinCodeFromHash() {
  const m = location.hash.match(/^#join=([a-z0-9]+)$/i);
  return m ? m[1] : null;
}

export class Online {
  /** handlers: onLink(url), onConnect(), onData(msg), onClose(), onError(text) */
  constructor(handlers) {
    this.h = handlers;
    this.conn = null;
    this.peer = null;
  }

  host() {
    const code = Math.random().toString(36).slice(2, 10);
    this.peer = new Peer(PREFIX + code, PEER_OPTIONS);
    this.peer.on('open', () => this.h.onLink(inviteLink(code)));
    this.peer.on('connection', (conn) => {
      if (this.conn) { conn.close(); return; } // the game is already full
      this.#attach(conn);
    });
    this.peer.on('error', (e) => this.h.onError(describe(e)));
  }

  join(code) {
    this.peer = new Peer(PEER_OPTIONS);
    this.peer.on('open', () => this.#attach(this.peer.connect(PREFIX + code, { reliable: true })));
    this.peer.on('error', (e) => this.h.onError(describe(e)));
  }

  #attach(conn) {
    this.conn = conn;
    conn.on('open', () => this.h.onConnect());
    conn.on('data', (d) => this.h.onData(d));
    conn.on('close', () => { this.conn = null; this.h.onClose(); });
    conn.on('error', () => this.h.onError('Связь с соперником прервалась.'));
  }

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  destroy() {
    try { this.peer?.destroy(); } catch { /* already closed */ }
    this.peer = null;
    this.conn = null;
  }
}

function describe(e) {
  switch (e?.type) {
    case 'peer-unavailable': return 'Игра по этой ссылке не найдена. Возможно, друг закрыл вкладку или ссылка устарела.';
    case 'network':
    case 'server-error':
    case 'socket-error': return 'Не удалось связаться с сервером соединений. Проверьте интернет и попробуйте ещё раз.';
    case 'browser-incompatible': return 'Этот браузер не поддерживает игру по сети.';
    default: return 'Ошибка соединения: ' + (e?.message || e?.type || 'неизвестная');
  }
}

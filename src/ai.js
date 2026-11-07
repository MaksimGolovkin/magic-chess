// Stockfish 17.1 (lite, single-threaded WASM) running in a Web Worker.
export const LEVELS = [
  { name: 'Новичок', skill: 0, depth: 2, time: 250 },
  { name: 'Любитель', skill: 6, depth: 6, time: 450 },
  { name: 'Опытный', skill: 13, depth: 12, time: 900 },
  { name: 'Мастер', skill: 20, depth: 22, time: 1600 },
];

export class Engine {
  constructor() {
    const url = new URL('stockfish/stockfish.js', document.baseURI);
    this.worker = new Worker(url);
    this.listeners = new Set();
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      for (const f of [...this.listeners]) f(line);
    };
    this.ready = this.#cmd('uci', 'uciok').then(() => this.#cmd('isready', 'readyok'));
  }

  #cmd(command, until) {
    return new Promise((resolve) => {
      const f = (line) => {
        if (line.startsWith(until)) {
          this.listeners.delete(f);
          resolve(line);
        }
      };
      this.listeners.add(f);
      this.worker.postMessage(command);
    });
  }

  async newGame() {
    await this.ready;
    this.worker.postMessage('ucinewgame');
    await this.#cmd('isready', 'readyok');
  }

  /** Returns the best move as { from, to, promotion }. */
  async bestMove(fen, levelIndex) {
    await this.ready;
    const L = LEVELS[levelIndex] ?? LEVELS[1];
    this.worker.postMessage(`setoption name Skill Level value ${L.skill}`);
    this.worker.postMessage(`position fen ${fen}`);
    const line = await this.#cmd(`go depth ${L.depth} movetime ${L.time}`, 'bestmove');
    const uci = line.split(' ')[1];
    return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
  }

  stop() { this.worker.postMessage('stop'); }
}

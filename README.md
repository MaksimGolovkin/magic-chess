# Каменные армии

Browser 3D chess: humans and elves (light, marble) against orcs (dark, basalt).
The statue pieces fight when one captures another.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Stack

- Three.js: scene, pieces built from code (`src/pieces.js`), animations (`src/board3d.js`)
- chess.js: rules
- Stockfish 17.1 lite (WASM, in a Web Worker): computer opponent with 4 levels (`public/stockfish`, GPLv3, see COPYING.txt)
- PeerJS: play with a friend by invite link (`#join=<code>`)

## Status (work in progress)

Step 1 of the plan: a working game. Done in code: menu, vs computer, invite-link play, hot-seat, move highlights,
move/capture/castling/promotion animations. Known issue: in a quick test the game sometimes stays "busy" after the
computer's reply, so the next move is ignored. Still to check: online play between two browsers, phone layout.

`concept/pieces-sketch.html` is the first standalone sketch of the pieces.

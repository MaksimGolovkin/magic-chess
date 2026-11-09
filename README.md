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

Step 1 of the plan: a working game. Works: menu, vs computer (4 levels), invite-link play, hot-seat, move highlights,
move/capture/castling/promotion animations. Invite-link play was tested between two browsers against a local
PeerJS server; set `VITE_PEER_HOST`/`VITE_PEER_PORT`/`VITE_PEER_SECURE=false` at build time to use your own server.

`concept/pieces-sketch.html` is the first standalone sketch of the pieces.

## Animated heroes

The menu can switch the pieces to animated heroes: CC0 characters by Kay Lousberg from the
KayKit Adventurers (light army: knights, barbarian, mage, rogues) and KayKit Skeletons (dark army) packs,
in `public/models/heroes`. Each piece type has its own weapon and attack; shooters fire a bolt or a spell.

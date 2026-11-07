// Stone statue chess pieces built from simple shapes.
// Light army (white): elves and humans in marble with blue runes.
// Dark army (black): orcs in basalt with ember-red eyes.
// Every model faces +Z and stands on a base whose top is at y = 0.22.
import * as THREE from 'three';

const PI = Math.PI;

function stoneTexture(base, vein, speck, veins) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * speck;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = vein;
  for (let k = 0; k < veins; k++) {
    g.globalAlpha = 0.15 + Math.random() * 0.25;
    g.lineWidth = 0.4 + Math.random() * 1.4;
    g.beginPath();
    let x = Math.random() * 256, y = -10;
    g.moveTo(x, y);
    while (y < 266) { x += (Math.random() - 0.5) * 28; y += 10; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const textures = {
  marble: stoneTexture('#e6dfd2', '#8f8778', 22, 9),
  basalt: stoneTexture('#3b3632', '#7a3b22', 30, 5),
  slateLight: stoneTexture('#b3a998', '#6f675b', 18, 6),
  slateDark: stoneTexture('#2c2724', '#4a4038', 20, 4),
};

export const stone = (map, color, roughness, extra = {}) =>
  new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, color, roughness, metalness: 0, ...extra });

const glow = (color, emissive, intensity) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.35 });

export const MATERIALS = {
  w: {
    stone: stone(textures.marble, 0xffffff, 0.62),
    trim: stone(textures.marble, 0xc9bfae, 0.7),
    base: stone(textures.marble, 0xc9bfae, 0.7),
    dark: stone(textures.basalt, 0x6c6660, 0.9),
    glow: glow(0x9fdcff, 0x5cc0ff, 1.8),
  },
  b: {
    stone: stone(textures.basalt, 0xffffff, 0.88),
    trim: stone(textures.marble, 0x9b8f7c, 0.85),
    base: stone(textures.basalt, 0x8a7d72, 0.92),
    dark: stone(textures.basalt, 0x7a6a5e, 0.9),
    glow: glow(0xff6a3d, 0xff3a0c, 2.0),
  },
};
for (const side of ['w', 'b']) {
  MATERIALS[side].cape = MATERIALS[side].stone.clone();
  MATERIALS[side].cape.side = THREE.DoubleSide;
}
export const GLOW_COLOR = { w: 0x8fd3ff, b: 0xff5a2a };

// ---------- geometry helpers ----------
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const G = {
  sph: (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 16, open = false, ts = 0, tl = PI * 2) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open, ts, tl),
  cone: (r, h, s = 12) => new THREE.ConeGeometry(r, h, s),
  tor: (r, t, arc = PI * 2) => new THREE.TorusGeometry(r, t, 8, 32, arc),
  oct: (r) => new THREE.OctahedronGeometry(r, 0),
};

function M(parent, geo, mat, p, r, s) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function Gr(parent, p, r) {
  const g = new THREE.Group();
  if (p) g.position.set(p[0], p[1], p[2]);
  if (r) g.rotation.set(r[0], r[1], r[2]);
  parent.add(g);
  return g;
}
// n copies around the Y axis; tilt leans each one outward.
function ring(parent, n, radius, y, make, tilt = 0, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * PI * 2;
    const pivot = Gr(parent, [Math.sin(a) * radius, y, Math.cos(a) * radius], [0, a, 0]);
    make(Gr(pivot, null, [tilt, 0, 0]), i);
  }
}
const mirror = (f) => { f(1); f(-1); };

function base(g, m) {
  M(g, lathe([[0, 0], [0.42, 0], [0.44, 0.03], [0.43, 0.07], [0.37, 0.1], [0.34, 0.15], [0.36, 0.18], [0.31, 0.22], [0, 0.22]]), m.base);
}

// ---------- LIGHT ARMY ----------
const LIGHT = {
  p(g, m) { // elf spearman
    M(g, lathe([[0, .22], [.22, .22], [.19, .36], [.15, .56], [.12, .68], [0, .7]]), m.stone);
    M(g, G.tor(.163, .018), m.trim, [0, .5, 0], [PI / 2, 0, 0]);
    M(g, G.sph(1), m.stone, [0, .69, 0], null, [.16, .07, .12]);
    M(g, G.cyl(.04, .045, .08), m.stone, [0, .74, 0]);
    M(g, G.sph(.085), m.stone, [0, .82, .01]);
    M(g, G.sph(1), m.stone, [0, .77, -.055], null, [.085, .14, .06]);
    mirror((s) => M(g, G.cone(.022, .11), m.stone, [s * .085, .85, -.01], [0, 0, -s * 1.2]));
    M(g, G.cyl(.013, .013, 1.05, 8), m.trim, [.2, .68, .04]);
    M(g, G.cone(.032, .14, 8), m.trim, [.2, 1.27, .04]);
    M(g, G.sph(.035), m.stone, [.2, .6, .06]);
    M(g, G.cyl(.13, .13, .028, 24), m.trim, [-.2, .52, .04], [0, 0, PI / 2], [1.4, 1, 1]);
    M(g, G.oct(.03), m.glow, [-.218, .52, .04]);
  },
  r(g, m) { // white watchtower
    M(g, lathe([[0, .22], [.3, .22], [.28, .27], [.25, .32], [.24, .9], [.3, .94], [.3, 1.04], [0, 1.04]]), m.stone);
    ring(g, 8, .255, 1.09, (p) => M(p, G.box(.11, .11, .07), m.stone));
    [.55, .78].forEach((y) => M(g, G.tor(.243, .012), m.trim, [0, y, 0], [PI / 2, 0, 0]));
    ring(g, 3, .24, .66, (p) => M(p, G.box(.03, .13, .02), m.glow), 0, -1.15);
    M(g, G.box(.13, .2, .03), m.dark, [0, .33, .255]);
    M(g, G.cyl(.01, .01, .42, 6), m.trim, [0, 1.24, 0]);
    M(g, G.box(.18, .1, .01), m.trim, [.095, 1.38, 0]);
  },
  n(g, m) { // armoured warhorse
    const k = Gr(g, null, [0, -.55, 0]);
    M(k, lathe([[0, .22], [.24, .22], [.2, .3], [.17, .36], [0, .37]]), m.stone);
    const neck = Gr(k, [0, .36, -.03], [.25, 0, 0]);
    M(neck, G.box(.17, .56, .25), m.stone, [0, .27, 0]);
    M(neck, G.sph(1), m.stone, [0, .1, .07], null, [.13, .16, .15]);
    for (let i = 0; i < 6; i++) M(neck, G.box(.045, .1, .08), m.trim, [0, .06 + i * .09, -.14], [-.3, 0, 0]);
    const head = Gr(k, [0, .9, .1], [.55, 0, 0]);
    M(head, G.box(.15, .17, .42), m.stone, [0, 0, .13]);
    M(head, G.box(.135, .14, .13), m.stone, [0, -.02, .36]);
    M(head, G.box(.06, .02, .28), m.trim, [0, .095, .14]);
    mirror((s) => {
      M(head, G.cone(.03, .12), m.stone, [s * .045, .13, -.03], [-.3, 0, -s * .15]);
      M(head, G.sph(.02), m.glow, [s * .078, .04, .05]);
    });
  },
  b(g, m) { // elf mage
    M(g, lathe([[0, .22], [.25, .22], [.21, .36], [.16, .62], [.12, .86], [.1, .94], [0, .96]]), m.stone);
    M(g, G.sph(1), m.stone, [0, .92, 0], null, [.15, .07, .11]);
    M(g, G.sph(1), m.stone, [0, .99, -.01], null, [.13, .08, .13]);
    M(g, G.cone(.13, .34, 24), m.stone, [0, 1.13, -.02]);
    M(g, G.sph(.075), m.dark, [0, 1.02, .065]);
    mirror((s) => M(g, G.sph(.012), m.glow, [s * .025, 1.03, .13]));
    M(g, G.cyl(.05, .075, .26), m.stone, [-.15, .78, .07], [0, 0, -.6]);
    M(g, G.sph(.035), m.stone, [-.21, .72, .08]);
    M(g, G.cyl(.013, .016, 1.38, 8), m.trim, [-.21, .86, .07]);
    M(g, G.oct(.065), m.glow, [-.21, 1.62, .07]);
    ring(Gr(g, [-.21, 1.55, .07]), 3, .04, 0, (p) => M(p, G.cone(.012, .1, 6), m.trim, [0, .04, 0]), .5);
  },
  q(g, m) { // elf queen
    M(g, lathe([[0, .22], [.28, .22], [.25, .3], [.17, .55], [.11, .85], [.085, 1], [.11, 1.08], [.07, 1.13], [0, 1.14]]), m.stone);
    M(g, G.tor(.11, .014), m.trim, [0, .85, 0], [PI / 2, 0, 0]);
    M(g, G.sph(1), m.stone, [0, 1.1, 0], null, [.13, .05, .09]);
    M(g, G.cyl(.03, .035, .08), m.stone, [0, 1.17, 0]);
    M(g, G.sph(.08), m.stone, [0, 1.25, .01]);
    M(g, G.sph(1), m.stone, [0, 1.13, -.055], null, [.09, .2, .06]);
    mirror((s) => {
      M(g, G.cone(.018, .085), m.stone, [s * .078, 1.27, 0], [0, 0, -s * 1.2]);
      M(g, G.cyl(.03, .04, .32), m.stone, [s * .13, .98, .05], [.5, 0, s * .35]);
    });
    M(g, G.tor(.064, .01), m.trim, [0, 1.31, 0], [PI / 2, 0, 0]);
    ring(g, 7, .062, 1.37, (p) => M(p, G.cone(.012, .12, 6), m.trim), .18);
    M(g, G.oct(.022), m.glow, [0, 1.32, .07]);
    M(g, G.sph(.045), m.glow, [0, .9, .16]);
  },
  k(g, m) { // human king
    M(g, lathe([[0, .22], [.3, .22], [.27, .3], [.22, .5], [.18, .95], [.15, 1.12], [0, 1.14]]), m.stone);
    M(g, G.cyl(.2, .31, .88, 28, true, PI / 2, PI), m.cape, [0, .7, -.01]);
    M(g, G.sph(1), m.stone, [0, 1.12, 0], null, [.22, .09, .16]);
    M(g, G.tor(.15, .045), m.trim, [0, 1.13, 0], [PI / 2, 0, 0]);
    M(g, G.sph(.095), m.stone, [0, 1.27, .01]);
    M(g, G.cone(.07, .15), m.stone, [0, 1.18, .06], [PI, 0, 0]);
    M(g, G.cyl(.085, .08, .07, 18, true), m.cape, [0, 1.36, 0]);
    ring(g, 5, .082, 1.42, (p) => M(p, G.cone(.018, .07, 6), m.trim), .1);
    M(g, G.box(.022, .13, .022), m.trim, [0, 1.48, 0]);
    M(g, G.box(.075, .022, .022), m.trim, [0, 1.5, 0]);
    M(g, G.oct(.022), m.glow, [0, 1.37, .085]);
    M(g, G.box(.045, .56, .014), m.trim, [0, .53, .27]);
    M(g, G.box(.21, .03, .035), m.trim, [0, .82, .27]);
    M(g, G.cyl(.015, .015, .12, 8), m.trim, [0, .89, .27]);
    M(g, G.sph(.026), m.trim, [0, .96, .27]);
    M(g, G.oct(.018), m.glow, [0, .82, .29]);
    mirror((s) => {
      M(g, G.cyl(.04, .05, .36), m.stone, [s * .12, 1.0, .15], [.75, 0, s * .35]);
      M(g, G.sph(.04), m.stone, [s * .035, .9, .27]);
    });
  },
};

// ---------- DARK ARMY ----------
const DARK = {
  p(g, m) { // orc axeman
    M(g, lathe([[0, .22], [.26, .22], [.25, .36], [.22, .52], [.15, .6], [0, .62]]), m.stone);
    M(g, G.tor(.238, .025), m.trim, [0, .4, 0], [PI / 2, 0, 0]);
    M(g, G.sph(1), m.stone, [0, .58, .02], null, [.23, .1, .16]);
    mirror((s) => M(g, G.cone(.03, .11, 8), m.trim, [s * .19, .66, 0], [0, 0, -s * .5]));
    M(g, G.sph(1), m.stone, [0, .68, .08], null, [.125, .1, .115]);
    M(g, G.box(.17, .07, .1), m.stone, [0, .63, .13]);
    M(g, G.box(.19, .035, .06), m.stone, [0, .72, .15]);
    mirror((s) => {
      M(g, G.sph(.018), m.glow, [s * .045, .69, .185]);
      M(g, G.cone(.016, .07, 6), m.trim, [s * .055, .68, .18]);
    });
    const axe = Gr(g, [.29, .45, .06], [0, 0, -.15]);
    M(axe, G.cyl(.017, .017, .72, 8), m.trim);
    M(axe, G.box(.02, .2, .16), m.dark, [0, .26, .08]);
    M(axe, G.cone(.02, .08, 6), m.trim, [0, .4, 0]);
    M(g, G.sph(.04), m.stone, [.27, .42, .07]);
  },
  r(g, m) { // spiked fortress
    M(g, lathe([[0, .22], [.34, .22], [.31, .32], [.27, .5], [.22, .92], [.3, .96], [.27, 1.04], [0, 1.04]]), m.stone);
    ring(g, 7, .23, 1.1, (p) => M(p, G.cone(.045, .22, 8), m.dark), .35);
    ring(g, 6, .25, .62, (p) => M(p, G.cone(.03, .16, 8), m.dark, [0, 0, .07], [PI / 2, 0, 0]), 0, PI / 6);
    ring(g, 4, .235, .82, (p) => M(p, G.box(.025, .12, .02), m.glow), 0, PI / 4);
    M(g, G.sph(.07), m.trim, [0, .8, .235]);
    M(g, G.box(.07, .04, .05), m.trim, [0, .745, .25]);
    mirror((s) => M(g, G.sph(.016), m.glow, [s * .026, .81, .295]));
    M(g, G.box(.14, .2, .03), m.glow, [0, .33, .3]);
  },
  n(g, m) { // warg
    const k = Gr(g, null, [0, .55, 0]);
    M(k, lathe([[0, .22], [.25, .22], [.21, .3], [.18, .36], [0, .37]]), m.stone);
    const neck = Gr(k, [0, .36, -.03], [.22, 0, 0]);
    M(neck, G.box(.21, .52, .28), m.stone, [0, .25, 0]);
    M(neck, G.sph(1), m.stone, [0, .12, .08], null, [.15, .17, .16]);
    for (let i = 0; i < 6; i++) M(neck, G.cone(.035, .14, 6), m.dark, [0, .06 + i * .085, -.15], [-2.1, 0, 0]);
    const head = Gr(k, [0, .87, .1], [.3, 0, 0]);
    M(head, G.box(.19, .17, .22), m.stone, [0, 0, .02]);
    M(head, G.box(.11, .09, .27), m.stone, [0, -.02, .23]);
    M(head, G.box(.1, .035, .22), m.stone, [0, -.1, .19], [.32, 0, 0]);
    mirror((s) => {
      M(head, G.cone(.04, .17, 8), m.stone, [s * .065, .14, -.04], [-.4, 0, -s * .22]);
      M(head, G.sph(.021), m.glow, [s * .085, .03, .08]);
      M(head, G.cone(.012, .055, 6), m.trim, [s * .035, -.085, .33], [PI, 0, 0]);
    });
    M(head, G.box(.09, .04, .15), m.glow, [0, -.065, .2], null, [.8, .4, 1]);
  },
  b(g, m) { // shaman
    M(g, lathe([[0, .22], [.27, .22], [.25, .34], [.2, .55], [.14, .74], [0, .78]]), m.stone);
    M(g, G.sph(1), m.stone, [0, .74, .02], null, [.2, .09, .15]);
    M(g, G.sph(.1), m.trim, [0, .85, .08]);
    M(g, G.box(.1, .05, .08), m.trim, [0, .79, .13]);
    mirror((s) => {
      M(g, G.sph(.017), m.glow, [s * .035, .87, .17]);
      M(g, G.cone(.032, .15, 8), m.trim, [s * .11, .95, .05], [0, 0, -s * .95]);
      M(g, G.cone(.019, .11, 8), m.trim, [s * .19, 1.03, .05], [0, 0, -s * .25]);
    });
    ring(g, 10, .17, .69, (p) => M(p, G.sph(.022), m.trim), 0, -.6);
    M(g, G.cyl(.016, .021, 1.22, 8), m.dark, [.25, .73, .05], [0, 0, .05]);
    M(g, G.sph(.05), m.trim, [.22, 1.35, .05]);
    M(g, G.oct(.045), m.glow, [.22, 1.44, .05]);
    mirror((s) => M(g, G.box(.015, .09, .03), m.trim, [.22 + s * .05, 1.27, .05], [0, 0, s * .2]));
  },
  q(g, m) { // sorceress
    M(g, lathe([[0, .22], [.31, .22], [.27, .3], [.19, .55], [.14, .85], [.12, 1], [.16, 1.06], [0, 1.08]]), m.stone);
    ring(g, 10, .25, .3, (p) => M(p, G.cone(.05, .13, 6), m.stone, null, [PI, 0, 0]), .3);
    mirror((s) => {
      M(g, G.sph(.08), m.dark, [s * .15, 1.04, 0]);
      M(g, G.cone(.026, .15, 8), m.dark, [s * .18, 1.13, 0], [0, 0, -s * .45]);
      M(g, G.sph(.018), m.glow, [s * .035, 1.18, .11]);
      M(g, G.cone(.014, .05, 6), m.trim, [s * .04, 1.12, .12]);
    });
    M(g, G.sph(1), m.stone, [0, 1.16, .03], null, [.095, .085, .09]);
    ring(g, 6, .065, 1.28, (p, i) => M(p, G.cone(.02, .12 + (i % 2) * .09, 6), m.dark), .38);
    M(g, G.cyl(.014, .016, 1.32, 8), m.dark, [.25, .78, .03]);
    M(g, G.tor(.14, .016, PI * .7), m.trim, [.17, 1.42, .03], [0, 0, .25]);
    M(g, G.oct(.035), m.glow, [.25, 1.46, .03]);
  },
  k(g, m) { // orc chieftain
    M(g, lathe([[0, .22], [.34, .22], [.31, .3], [.27, .5], [.24, .85], [.2, 1.02], [0, 1.04]]), m.stone);
    M(g, G.tor(.2, .06), m.dark, [0, 1.0, 0], [PI / 2, 0, 0]);
    mirror((s) => {
      M(g, G.sph(.12), m.stone, [s * .22, 1.02, 0]);
      M(g, G.cone(.035, .18, 8), m.dark, [s * .26, 1.13, 0], [0, 0, -s * .5]);
      M(g, G.cone(.03, .15, 8), m.dark, [s * .32, 1.04, 0], [0, 0, -s * 1.15]);
      M(g, G.cone(.02, .09, 6), m.trim, [s * .065, 1.13, .17]);
      M(g, G.sph(.02), m.glow, [s * .05, 1.18, .16]);
      M(g, G.cone(.045, .22, 8), m.dark, [s * .15, 1.3, .03], [0, 0, -s * 1.0]);
      M(g, G.cone(.026, .15, 8), m.dark, [s * .25, 1.42, .03], [0, 0, -s * .2]);
      M(g, G.sph(.05), m.stone, [s * .045, 1.0, .3]);
    });
    M(g, G.sph(1), m.stone, [0, 1.16, .05], null, [.13, .12, .12]);
    M(g, G.box(.19, .08, .12), m.stone, [0, 1.09, .11]);
    M(g, new THREE.SphereGeometry(.135, 20, 10, 0, PI * 2, 0, PI / 2), m.dark, [0, 1.2, .04]);
    M(g, G.cyl(.02, .02, .42, 8), m.dark, [0, .98, .3]);
    M(g, G.box(.25, .5, .022), m.dark, [0, .52, .3]);
    M(g, G.box(.09, .06, .024), m.glow, [.07, .62, .3]);
  },
};

export const PIECE_NAMES = {
  w: { p: 'Эльф-копейщик', r: 'Белая башня', n: 'Боевой конь', b: 'Эльфийский маг', q: 'Королева эльфов', k: 'Король людей' },
  b: { p: 'Орк-рубака', r: 'Крепость', n: 'Варг', b: 'Шаман', q: 'Колдунья', k: 'Вождь орков' },
};

/**
 * Build one piece. color: 'w' | 'b', type: chess.js piece letter.
 * Returns { group, model, height } where group is positioned on the board
 * and model is the inner node that can be spun or tilted.
 */
export function buildPiece(color, type) {
  const group = new THREE.Group();
  const model = new THREE.Group();
  group.add(model);
  const mats = MATERIALS[color];
  base(model, mats);
  (color === 'w' ? LIGHT : DARK)[type](model, mats);
  const box = new THREE.Box3().setFromObject(group);
  return { group, model, height: box.max.y };
}

// The 3D stage: board, pieces, highlights, camera and all move animations.
import * as THREE from 'three';
import { buildPiece, MATERIALS, GLOW_COLOR, textures, stone } from './pieces.js';

const PI = Math.PI;
const FILES = 'abcdefgh';
const PIECE_SCALE = 0.95;

export function squareToPos(sq) {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  // White (light army) sits on ranks 1-2 at +Z, black on ranks 7-8 at -Z.
  return new THREE.Vector3(f - 3.5, 0, 3.5 - (r - 1));
}
const defaultYaw = (color) => (color === 'w' ? PI : 0); // face the opponent

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function lerpAngle(a, b, t) {
  const d = ((((b - a + PI) % (2 * PI)) + 2 * PI) % (2 * PI)) - PI;
  return a + d * t;
}

function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c9b79c';
  g.font = '600 40px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Board3D {
  constructor(container, { onSquareClick }) {
    this.container = container;
    this.onSquareClick = onSquareClick;
    this.pieces = new Map(); // square -> { group, model, height, color, type }
    this.tweens = [];
    this.effects = [];
    this.shake = 0;
    this.theta = 0;
    this.thetaTarget = 0;
    this.phi = 0.95;
    this.userDist = null;
    this.speed = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0c0b);
    scene.fog = new THREE.Fog(0x0d0c0b, 22, 40);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.target = new THREE.Vector3(0, 0.2, 0);

    this.#lights();
    this.#board();
    this.highlights = new THREE.Group();
    scene.add(this.highlights);
    this.flash = new THREE.PointLight(0xffffff, 0, 8, 2);
    scene.add(this.flash);
    this.dustTex = dustTexture();

    this.#controls();
    new ResizeObserver(() => this.#resize()).observe(container);
    this.#resize();
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.#frame());
    // used by the video recorder to step the scene with a fixed time step
    this.renderFrame = () => this.#frame();
  }

  // ---------- scene setup ----------
  #lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xcfd8e6, 0x2a2019, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
    sun.position.set(5, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.bias = -0.0005;
    s.add(sun);
    const rimW = new THREE.PointLight(GLOW_COLOR.w, 40, 18, 2);
    rimW.position.set(-6, 4, 6);
    s.add(rimW);
    const rimB = new THREE.PointLight(GLOW_COLOR.b, 45, 18, 2);
    rimB.position.set(6, 3.5, -6);
    s.add(rimB);
  }

  #board() {
    const light = stone(textures.slateLight, 0xffffff, 0.75);
    const dark = stone(textures.slateDark, 0xffffff, 0.85);
    this.squareMeshes = [];
    const geo = new THREE.BoxGeometry(1, 0.16, 1);
    for (let f = 0; f < 8; f++) {
      for (let r = 1; r <= 8; r++) {
        const sq = FILES[f] + r;
        // a1 is a dark square: (0 + 1) % 2 === 1
        const m = new THREE.Mesh(geo, (f + r) % 2 === 1 ? dark : light);
        m.position.copy(squareToPos(sq)).setY(-0.08);
        m.receiveShadow = true;
        m.userData.square = sq;
        this.scene.add(m);
        this.squareMeshes.push(m);
      }
    }
    const frameMat = stone(textures.slateDark, 0x8a7a6a, 0.9);
    const w = 0.55;
    const parts = [
      [0, 4 + w / 2, 8 + 2 * w, w], [0, -4 - w / 2, 8 + 2 * w, w],
      [4 + w / 2, 0, w, 8], [-4 - w / 2, 0, w, 8],
    ];
    for (const [x, z, sx, sz] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.24, sz), frameMat);
      m.position.set(x, -0.1, z);
      m.receiveShadow = true;
      this.scene.add(m);
    }
    // engraved coordinates on the frame
    const lg = new THREE.PlaneGeometry(0.34, 0.34);
    const addLabel = (text, x, z, rotZ) => {
      const mat = new THREE.MeshBasicMaterial({ map: labelTexture(text), transparent: true, depthWrite: false });
      const m = new THREE.Mesh(lg, mat);
      m.rotation.set(-PI / 2, 0, rotZ);
      m.position.set(x, 0.025, z);
      this.scene.add(m);
    };
    for (let i = 0; i < 8; i++) {
      addLabel(FILES[i], i - 3.5, 4 + w / 2, 0);
      addLabel(FILES[i], i - 3.5, -4 - w / 2, PI);
      addLabel(String(i + 1), -4 - w / 2, 3.5 - i, 0);
      addLabel(String(i + 1), 4 + w / 2, 3.5 - i, PI);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 1 }));
    floor.rotation.x = -PI / 2;
    floor.position.y = -0.22;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  // ---------- camera and input ----------
  #controls() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let down = null;
    let last = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      last = { ...down };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved > 6) {
        this.theta -= (e.clientX - last.x) * 0.006;
        this.thetaTarget = this.theta;
        this.phi = Math.min(1.42, Math.max(0.35, this.phi + (e.clientY - last.y) * 0.005));
      }
      last = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6) this.#pick(e);
      down = null;
    });
    el.addEventListener('pointercancel', () => (down = null));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const d = this.userDist || this.#fitDist();
      this.userDist = Math.min(30, Math.max(5, d * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });
  }

  #pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const targets = [...this.squareMeshes, ...[...this.pieces.values()].map((p) => p.group)];
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return;
    let o = hit.object;
    while (o && !o.userData.square) o = o.parent;
    if (o) this.onSquareClick(o.userData.square);
  }

  #fitDist() {
    const aspect = this.camera.aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return Math.max(4.9 / (t * aspect), (4.9 / t) * 0.9);
  }

  #resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setOrientation(color) {
    this.thetaTarget = color === 'w' ? 0 : PI;
    // spin the short way from wherever the user left the camera
    const d = ((((this.thetaTarget - this.theta + PI) % (2 * PI)) + 2 * PI) % (2 * PI)) - PI;
    this.thetaTarget = this.theta + d;
    this.userDist = null;
    this.phi = 0.95;
  }

  // ---------- pieces ----------
  setPosition(boardArray) {
    for (const p of this.pieces.values()) this.#dispose(p.group);
    this.pieces.clear();
    for (const row of boardArray) {
      for (const cell of row) {
        if (cell) this.#addPiece(cell.square, cell.color, cell.type);
      }
    }
  }

  #addPiece(sq, color, type) {
    const p = buildPiece(color, type);
    p.color = color;
    p.type = type;
    p.group.scale.setScalar(PIECE_SCALE);
    p.group.position.copy(squareToPos(sq));
    p.group.rotation.y = defaultYaw(color);
    p.group.userData.square = sq;
    this.scene.add(p.group);
    this.pieces.set(sq, p);
    return p;
  }

  #dispose(obj) {
    this.scene.remove(obj);
    obj.traverse((o) => o.geometry && !o.geometry.userData.shared && o.geometry.dispose());
  }

  // ---------- highlights ----------
  setHighlights({ selected, targets = [], lastMove, check, color = 'w' } = {}) {
    const g = this.highlights;
    while (g.children.length) {
      const c = g.children.pop();
      c.geometry.dispose();
      c.material.dispose();
    }
    const plane = (sq, size, col, opacity, y = 0.004) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -PI / 2;
      m.position.copy(squareToPos(sq)).setY(y);
      g.add(m);
      return m;
    };
    if (lastMove) for (const sq of lastMove) plane(sq, 0.98, 0xe0b46a, 0.22);
    if (selected) plane(selected, 0.98, GLOW_COLOR[color], 0.42, 0.006);
    for (const t of targets) {
      const geo = t.capture ? new THREE.RingGeometry(0.36, 0.46, 32) : new THREE.CircleGeometry(0.13, 24);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: GLOW_COLOR[color], transparent: true, opacity: 0.8, depthWrite: false }));
      m.rotation.x = -PI / 2;
      m.position.copy(squareToPos(t.sq)).setY(0.008);
      g.add(m);
    }
    if (check) {
      const m = plane(check, 0.98, 0xff2a10, 0.55, 0.007);
      m.userData.pulse = true;
    }
  }

  // ---------- animation core ----------
  tween(duration, fn) {
    return new Promise((resolve) => this.tweens.push({ t: 0, d: duration / this.speed, fn, resolve }));
  }
  wait(s) { return this.tween(s, () => {}); }

  async animateMove(mv) {
    const rec = this.pieces.get(mv.from);
    if (!rec) return;
    const to = squareToPos(mv.to);
    const isEp = mv.flags.includes('e');
    const victimSq = isEp ? mv.to[0] + mv.from[1] : mv.captured ? mv.to : null;
    const victim = victimSq ? this.pieces.get(victimSq) : null;
    this.pieces.delete(mv.from);
    if (victimSq) this.pieces.delete(victimSq);

    const jobs = [];
    if (victim) jobs.push(this.#captureAnim(rec, victim, to));
    else jobs.push(this.#moveAnim(rec, to, rec.type === 'n'));

    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      const rank = mv.from[1];
      const [rf, rt] = mv.flags.includes('k') ? ['h' + rank, 'f' + rank] : ['a' + rank, 'd' + rank];
      const rook = this.pieces.get(rf);
      if (rook) {
        this.pieces.delete(rf);
        rook.group.userData.square = rt;
        this.pieces.set(rt, rook);
        jobs.push(this.wait(0.15).then(() => this.#moveAnim(rook, squareToPos(rt), true)));
      }
    }
    rec.group.userData.square = mv.to;
    this.pieces.set(mv.to, rec);
    await Promise.all(jobs);
    if (mv.promotion) await this.#promoteAnim(mv.to, mv.color, mv.promotion);
  }

  async #moveAnim(rec, to, hop) {
    const g = rec.group;
    const from = g.position.clone();
    const dist = from.distanceTo(to);
    const yaw0 = g.rotation.y;
    const face = Math.atan2(to.x - from.x, to.z - from.z);
    await this.tween(0.16, (u) => { g.rotation.y = lerpAngle(yaw0, face, ease(u)); });
    const h = hop ? 0.9 : 0.16;
    await this.tween(Math.min(0.75, 0.28 + dist * 0.06), (u) => {
      g.position.lerpVectors(from, to, ease(u));
      g.position.y = Math.sin(PI * u) * h;
      rec.model.rotation.x = Math.sin(PI * u) * (hop ? 0.2 : 0.08);
    });
    g.position.copy(to);
    await this.tween(0.2, (u) => { g.rotation.y = lerpAngle(face, defaultYaw(rec.color), ease(u)); });
  }

  async #captureAnim(rec, victim, to) {
    const g = rec.group;
    const from = g.position.clone();
    const dir = new THREE.Vector3().subVectors(to, from).setY(0).normalize();
    const style = rec.type === 'p' ? 'stab' : 'bash';
    const reach = style === 'stab' ? 0.86 : 0.72;
    const P = to.clone().addScaledVector(dir, -reach);
    const yaw0 = g.rotation.y;
    const face = Math.atan2(dir.x, dir.z);
    const vYaw0 = victim.group.rotation.y;
    const vFace = Math.atan2(-dir.x, -dir.z);

    // both pieces turn to face each other
    await this.tween(0.22, (u) => {
      g.rotation.y = lerpAngle(yaw0, face, ease(u));
      victim.group.rotation.y = lerpAngle(vYaw0, vFace, ease(u));
    });
    // leap to striking distance
    const travel = from.distanceTo(P);
    if (travel > 0.05) {
      const h = Math.min(1.3, 0.35 + travel * 0.16);
      await this.tween(Math.min(0.8, 0.3 + travel * 0.07), (u) => {
        g.position.lerpVectors(from, P, ease(u));
        g.position.y = Math.sin(PI * u) * h;
        rec.model.rotation.x = Math.sin(PI * u) * 0.25;
      });
    }
    g.position.copy(P);

    if (style === 'stab') await this.#stab(rec, victim, P, dir);
    else await this.#bash(rec, victim, P, dir);

    await this.wait(0.12);
    // step into the conquered square
    const start = g.position.clone();
    await this.tween(0.32, (u) => {
      g.position.lerpVectors(start, to, ease(u));
      g.position.y = Math.sin(PI * u) * 0.25;
    });
    g.position.copy(to);
    await this.tween(0.2, (u) => { g.rotation.y = lerpAngle(face, defaultYaw(rec.color), ease(u)); });
  }

  // Generic blow: lean back, slam forward, the victim bursts.
  async #bash(rec, victim, P, dir) {
    const g = rec.group;
    await this.tween(0.16, (u) => {
      rec.model.rotation.x = -0.4 * ease(u);
      victim.model.rotation.x = -0.12 * ease(u);
    });
    let broken = false;
    await this.tween(0.1, (u) => {
      rec.model.rotation.x = -0.4 + 0.95 * u;
      const l = 0.38 * u;
      g.position.set(P.x + dir.x * l, 0, P.z + dir.z * l);
      if (!broken && u > 0.6) { broken = true; this.#shatter(victim, dir); }
    });
    if (!broken) this.#shatter(victim, dir);
    await this.tween(0.22, (u) => {
      const e = ease(u);
      rec.model.rotation.x = 0.55 * (1 - e);
      const l = 0.38 * (1 - e);
      g.position.set(P.x + dir.x * l, 0, P.z + dir.z * l);
    });
  }

  // Spearman: draw back, lunge, a streak of light runs the victim through,
  // the victim glows from inside, staggers and bursts.
  async #stab(rec, victim, P, dir) {
    const g = rec.group;
    const glowColor = GLOW_COLOR[rec.color];
    const at = (l) => g.position.set(P.x + dir.x * l, 0, P.z + dir.z * l);
    // the victim's stone starts to glow, so give it its own materials
    const hot = [];
    victim.group.traverse((o) => {
      if (o.isMesh && o.material.emissive) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(glowColor);
        o.material.emissiveIntensity = 0;
        hot.push(o.material);
      }
    });

    // draw back: lean back and step back a little
    await this.tween(0.24, (u) => {
      const e = ease(u);
      rec.model.rotation.x = -0.28 * e;
      at(-0.14 * e);
      victim.model.rotation.x = -0.08 * e;
    });
    // lunge
    let hit = false;
    await this.tween(0.09, (u) => {
      rec.model.rotation.x = -0.28 + 0.62 * u;
      at(-0.14 + 0.5 * u);
      if (!hit && u > 0.55) { hit = true; this.#spearStreak(rec, victim, dir, glowColor); }
    });
    if (!hit) this.#spearStreak(rec, victim, dir, glowColor);
    // the victim is pierced: glow from inside, stagger back
    const vp = victim.group.position.clone();
    await this.tween(0.34, (u) => {
      for (const m of hot) m.emissiveIntensity = 1.1 * ease(u);
      victim.model.rotation.x = -0.08 - 0.3 * Math.sin(u * PI * 0.5);
      victim.group.position.set(vp.x + dir.x * 0.12 * u + (Math.random() - 0.5) * 0.02 * u, 0, vp.z + dir.z * 0.12 * u);
    });
    this.#shatter(victim, dir);
    for (const m of hot) m.dispose();
    // recover from the lunge
    await this.tween(0.24, (u) => {
      const e = ease(u);
      rec.model.rotation.x = 0.34 * (1 - e);
      at(0.36 - 0.36 * e);
    });
  }

  #spearStreak(rec, victim, dir, color) {
    const s = PIECE_SCALE;
    const startP = rec.group.position.clone().addScaledVector(dir, 0.2).setY(0.62 * s);
    const endP = victim.group.position.clone().addScaledVector(dir, 0.45).setY(0.5 * s);
    const len = startP.distanceTo(endP);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.035, len, 10, 1, true), mat);
    const halo = new THREE.Mesh(new THREE.ConeGeometry(0.1, len, 12, 1, true), mat.clone());
    halo.material.opacity = 0.35;
    const streak = new THREE.Group();
    streak.add(core, halo);
    streak.position.lerpVectors(startP, endP, 0.5);
    // cones point +Y; turn the tip towards the victim
    streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endP.clone().sub(startP).normalize());
    this.scene.add(streak);

    // sparks at the point of impact
    const hitP = victim.group.position.clone().addScaledVector(dir, -0.15).setY(0.5 * s);
    const n = 60;
    const arr = new Float32Array(n * 3);
    const vels = [];
    for (let i = 0; i < n; i++) {
      arr.set([hitP.x, hitP.y, hitP.z], i * 3);
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 3 - dir.x * 1.5, Math.random() * 2.5, (Math.random() - 0.5) * 3 - dir.z * 1.5));
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({ map: this.dustTex, color, size: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sparks = new THREE.Points(pg, pm);
    this.scene.add(sparks);

    this.flash.color.set(color);
    this.flash.position.copy(hitP);
    this.flash.intensity = 22;
    this.shake = 0.06;

    let t = 0;
    this.effects.push((dt) => {
      t += dt;
      const fade = Math.max(0, 1 - t / 0.45);
      core.material.opacity = 0.95 * fade;
      halo.material.opacity = 0.35 * fade;
      streak.scale.set(1 + t * 2, 1, 1 + t * 2);
      const p = pg.attributes.position;
      for (let i = 0; i < n; i++) {
        vels[i].y -= 6 * dt;
        p.array[i * 3] += vels[i].x * dt;
        p.array[i * 3 + 1] = Math.max(0.02, p.array[i * 3 + 1] + vels[i].y * dt);
        p.array[i * 3 + 2] += vels[i].z * dt;
      }
      p.needsUpdate = true;
      pm.opacity = Math.max(0, 1 - t / 0.8);
      if (t > 0.8) {
        this.scene.remove(streak, sparks);
        core.geometry.dispose(); halo.geometry.dispose(); mat.dispose(); halo.material.dispose();
        pg.dispose(); pm.dispose();
        return false;
      }
      return true;
    });
  }

  #shatter(victim, dir) {
    const pos = victim.group.position.clone();
    const height = victim.height * PIECE_SCALE;
    const mats = MATERIALS[victim.color];
    this.#dispose(victim.group);

    const frags = [];
    for (let i = 0; i < 80; i++) {
      const r = 0.03 + Math.random() * 0.07;
      const geo = Math.random() < 0.5 ? new THREE.DodecahedronGeometry(r, 0) : new THREE.TetrahedronGeometry(r * 1.3, 0);
      const m = new THREE.Mesh(geo, Math.random() < 0.1 ? mats.glow : mats.stone);
      m.castShadow = true;
      const a = Math.random() * PI * 2;
      const rr = Math.sqrt(Math.random()) * 0.3;
      m.position.set(pos.x + Math.cos(a) * rr, Math.random() * height * 0.95, pos.z + Math.sin(a) * rr);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const sp = 1.2 + Math.random() * 2.6;
      const vel = new THREE.Vector3(dir.x * sp + (Math.random() - 0.5) * 2.2, 1 + Math.random() * 3.2, dir.z * sp + (Math.random() - 0.5) * 2.2);
      const spin = new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      this.scene.add(m);
      frags.push({ m, vel, spin, r });
    }
    const n = 140;
    const arr = new Float32Array(n * 3);
    const vels = [];
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 1] = Math.random() * height * 0.8;
      arr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 2 + dir.x * 0.8, Math.random() * 1.2, (Math.random() - 0.5) * 2 + dir.z * 0.8));
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({ map: this.dustTex, size: 0.35, transparent: true, opacity: 0.7, depthWrite: false, color: victim.color === 'w' ? 0xe9e2d4 : 0x6d625a });
    const dust = new THREE.Points(pg, pm);
    this.scene.add(dust);

    this.flash.color.set(GLOW_COLOR[victim.color === 'w' ? 'b' : 'w']);
    this.flash.position.set(pos.x, 1, pos.z);
    this.flash.intensity = 30;
    this.shake = 0.14;

    let t = 0;
    this.effects.push((dt) => {
      t += dt;
      const sink = Math.min(1, Math.max(0, (t - 2.4) / 1.2));
      for (const f of frags) {
        if (sink === 0) {
          f.vel.y -= 9.8 * dt;
          f.m.position.addScaledVector(f.vel, dt);
          if (f.m.position.y < f.r) {
            f.m.position.y = f.r;
            f.vel.y *= -0.28;
            f.vel.x *= 0.6;
            f.vel.z *= 0.6;
            f.spin.multiplyScalar(0.6);
          }
          f.m.rotation.x += f.spin.x * dt;
          f.m.rotation.y += f.spin.y * dt;
          f.m.rotation.z += f.spin.z * dt;
        } else {
          f.m.scale.setScalar(1 - sink);
          f.m.position.y -= dt * 0.05;
        }
      }
      const p = dust.geometry.attributes.position;
      for (let i = 0; i < vels.length; i++) {
        const v = vels[i];
        v.multiplyScalar(0.97);
        p.array[i * 3] += v.x * dt;
        p.array[i * 3 + 1] += v.y * dt;
        p.array[i * 3 + 2] += v.z * dt;
      }
      p.needsUpdate = true;
      pm.opacity = Math.max(0, 0.7 * (1 - t / 2));
      if (t > 3.7) {
        for (const f of frags) { this.scene.remove(f.m); f.m.geometry.dispose(); }
        this.scene.remove(dust);
        pg.dispose();
        pm.dispose();
        return false;
      }
      return true;
    });
  }

  async #promoteAnim(sq, color, type) {
    const old = this.pieces.get(sq);
    if (!old) return;
    this.flash.color.set(GLOW_COLOR[color]);
    this.flash.position.copy(old.group.position).setY(1.2);
    this.flash.intensity = 25;
    await this.tween(0.25, (u) => old.model.scale.setScalar(1 - ease(u) * 0.95));
    this.#dispose(old.group);
    this.pieces.delete(sq);
    const p = this.#addPiece(sq, color, type);
    p.model.scale.setScalar(0.05);
    await this.tween(0.35, (u) => p.model.scale.setScalar(0.05 + ease(u) * 0.95));
  }

  // ---------- loop ----------
  #frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.d);
      tw.fn(u);
      if (u >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
    this.effects = this.effects.filter((f) => f(dt) !== false);
    this.flash.intensity *= 0.9;
    for (const c of this.highlights.children) {
      if (c.userData.pulse) c.material.opacity = 0.35 + Math.sin(performance.now() / 180) * 0.2;
    }

    if (this.idleSpin) this.thetaTarget += dt * 0.08;
    this.theta += (this.thetaTarget - this.theta) * Math.min(1, dt * 4);
    const d = this.userDist || this.#fitDist();
    const c = this.camera;
    c.position.set(
      this.target.x + d * Math.sin(this.theta) * Math.cos(this.phi),
      this.target.y + d * Math.sin(this.phi),
      this.target.z + d * Math.cos(this.theta) * Math.cos(this.phi),
    );
    c.lookAt(this.target);
    if (this.shake > 0.004) {
      c.position.x += (Math.random() - 0.5) * this.shake;
      c.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.86;
    }
    this.renderer.render(this.scene, c);
  }
}

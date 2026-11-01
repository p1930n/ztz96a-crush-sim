/* ---------- tempered-glass fragments: small chunks that drop, bounce once or twice and lie on the ground ---------- */
const SHARDS = 240;
const shardMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: lin('#8fa3a6'), roughness: 0.38, metalness: 0.1, transparent: true, opacity: 0.8 }), SHARDS);
shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shardMesh.frustumCulled = false; scene.add(shardMesh);
const shardO = new THREE.Object3D(), shards = [], tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
shardO.scale.set(0, 0, 0); shardO.updateMatrix();
for (let i = 0; i < SHARDS; i++) {
  shards.push({ on: false, rest: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3() });
  shardMesh.setMatrixAt(i, shardO.matrix);
}
let shardNext = 0;
function shatter(pts, n, up) {
  for (let k = 0; k < n && pts.length; k++) {
    const sh = shards[shardNext]; shardNext = (shardNext + 1) % SHARDS;
    const P = pts[Math.floor(Math.random() * pts.length)];
    sh.on = true; sh.rest = false;
    sh.p.set(P.x + rand(-0.05, 0.05), P.y + rand(-0.04, 0.04), P.z + rand(-0.06, 0.06));
    sh.v.set(rand(-0.9, 0.9), rand(-0.6, 1.0) * up, P.sx * rand(0.2, 1.3));
    sh.s.set(rand(0.014, 0.034), rand(0.006, 0.012), rand(0.012, 0.03));
    sh.q.setFromEuler(tmpE.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)));
    sh.w.set(rand(-18, 18), rand(-18, 18), rand(-18, 18));
  }
}
function updateShards(dt) {
  let live = false;
  for (let i = 0; i < SHARDS; i++) {
    const sh = shards[i]; if (!sh.on) continue; live = true;
    if (!sh.rest) {
      sh.v.y -= GRAV * dt; sh.p.addScaledVector(sh.v, dt);
      tmpQ.setFromEuler(tmpE.set(sh.w.x * dt, sh.w.y * dt, sh.w.z * dt)); sh.q.multiply(tmpQ);
      const floor = sh.s.y * 0.5;
      if (sh.p.y < floor) {
        sh.p.y = floor;
        if (sh.v.y > -0.7) { sh.rest = true; sh.q.setFromEuler(tmpE.set(rand(-0.15, 0.15), rand(0, 6.3), rand(-0.15, 0.15))); }
        else { sh.v.y *= -0.22; sh.v.x *= 0.4; sh.v.z *= 0.4; sh.w.multiplyScalar(0.4); }
      }
    }
    sh.p.x -= speed * dt;                             // fragments are left behind on the ground
    if (sh.p.x < -40) { sh.on = false; shardO.scale.set(0, 0, 0); }
    else { shardO.position.copy(sh.p); shardO.quaternion.copy(sh.q); shardO.scale.copy(sh.s); }
    shardO.updateMatrix(); shardMesh.setMatrixAt(i, shardO.matrix);
  }
  if (live) shardMesh.instanceMatrix.needsUpdate = true;
}
function glassPoints(which) {   // world positions on the glass: the side windows, or wherever the screens have given way
  const m = car.cabin, A = m.geometry.attributes.position.array, H = m.userData.hitMask, pts = [];
  const take = j => { car.group.localToWorld(tmpV3.set(A[j * 3], A[j * 3 + 1], A[j * 3 + 2])); pts.push({ x: tmpV3.x, y: tmpV3.y, z: tmpV3.z, sx: Math.sign(tmpV3.z - car.z) || 1 }); };
  if (which === 'side') car.sideIdx.forEach(take);
  else for (let j = 0; j < H.length; j++) if (H[j] && Math.abs(A[j * 3]) < 0.5 && A[j * 3 + 1] > 1.0) take(j);
  return pts;
}

/* ---------- crush sounds ---------- */
function crunch(k) {             // sheet steel tearing and folding
  if (!soundOn || !audio()) return;
  const t = actx.currentTime + rand(0, 0.03);
  noiseBurst(t, rand(0.12, 0.32), rand(500, 1400), rand(160, 320), 0.22 + 0.45 * k, 'bandpass');
  if (Math.random() < 0.6) noiseBurst(t + rand(0.01, 0.06), rand(0.05, 0.12), rand(2200, 4200), 1100, 0.07 + 0.14 * k, 'bandpass');
  if (Math.random() < 0.35) {    // a short falling groan as a panel buckles
    const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain(), f0 = rand(140, 260);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rand(0.55, 0.75), t + 0.35);
    f.type = 'bandpass'; f.frequency.value = rand(600, 1100); f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04 + 0.07 * k, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.42);
  }
}
function glassSound(k) {
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 0.3 + 0.2 * k, 7500, 3500, 0.12 + 0.2 * k, 'highpass');
  const n = 4 + Math.round(8 * k);
  for (let i = 0; i < n; i++) noiseBurst(t + rand(0.02, 0.6), rand(0.02, 0.05), rand(4500, 9500), 3500, rand(0.03, 0.09), 'bandpass');
}
function tirePop() {
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 0.14, 1800, 200, 0.85);
  noiseBurst(t + 0.03, 0.7, 6000, 3000, 0.08, 'highpass');
}
function thump(k) {              // a road-wheel pair landing: hull mass on the bump stops, track links slapping
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 0.45 + 0.35 * k, 520, 60, 0.3 + 0.65 * k);
  const o = actx.createOscillator(), og = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(64, t); o.frequency.exponentialRampToValueAtTime(27, t + 0.45);
  og.gain.setValueAtTime(0.25 + 0.6 * k, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.6);
  noiseBurst(t + 0.02, 0.2, 2600, 900, 0.06 + 0.12 * k, 'bandpass');
}

function bottomOut() {           // the floor pan meets the ground through what is left of the car
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 0.3, 300, 50, 0.9);
  const o = actx.createOscillator(), og = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(24, t + 0.4);
  og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.55);
  noiseBurst(t + 0.01, 0.1, 1800, 700, 0.2, 'bandpass');
}
function squeak(k) {             // the squeaker in a toy, pressed flat
  if (!soundOn || !audio()) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(), f0 = rand(1250, 1650) * (1 + 0.25 * k);
  o.type = 'triangle'; o.frequency.setValueAtTime(f0 * 0.7, t); o.frequency.linearRampToValueAtTime(f0, t + 0.05); o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.34);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.38);
}
function creak(k) {              // stressed metal shifting under a standing load
  if (!soundOn || !audio()) return;
  const t = actx.currentTime, o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain(), f0 = rand(70, 170), d = rand(0.25, 0.8);
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * rand(0.7, 1.25), t + d);
  f.type = 'bandpass'; f.frequency.value = rand(350, 900); f.Q.value = 7;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 + 0.1 * k, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
  noiseBurst(t, 0.03, 3200, 1500, 0.05 + 0.1 * k, 'bandpass');
}
const FLUFF = lin('#a9a59a');
function fluffOut(c, i, n) {     // stuffing out of a split seam
  const u = c.plush[i].userData, h = sampleV(c, u.cx, u.cz) * 0.8;
  for (let k = 0; k < n; k++) {
    const p = carW(c, u.cx + rand(-0.25, 0.25), Math.max(0.2, h), u.cz + rand(-0.25, 0.35), gp), P = new THREE.Vector3(p[0], p[1], p[2]);
    if (k % 2) spawn({ pos: P, vel: new THREE.Vector3(rand(-0.7, 0.7), rand(0.1, 0.8), rand(-0.9, 0.9)), life: rand(1.0, 1.8), s0: 0.04, s1: rand(0.12, 0.22), op: 0.45, color: FLUFF, drag: 2.2, rise: 0.05 });
    else spawnBit(P, new THREE.Vector3(rand(-0.7, 0.7), rand(0.3, 1.3), rand(-0.9, 0.9)), rand(0.025, 0.06), FLUFF);
  }
}
function tearSound(k) {          // a seam or a hinge letting go: a hard crack, then the panel ringing
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 0.05, 3400, 1100, 0.25 + 0.4 * k, 'bandpass');
  const o = actx.createOscillator(), g = actx.createGain(), f0 = rand(320, 620);
  o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.35);
  g.gain.setValueAtTime(0.09 * (0.4 + k), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
}
function clangSound(k) {         // something heavy coming down on the ground
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 0.1 + 0.15 * k, 900, 180, 0.2 + 0.5 * k);
  noiseBurst(t, 0.03, 2600, 900, 0.1 + 0.2 * k, 'bandpass');
}
const FX = {
  tear: k => tearSound(k), clang: k => clangSound(k),
  crunch: k => crunch(k), glass: k => glassSound(k), pop: () => tirePop(), thump: k => thump(k), bottom: () => bottomOut(), creak: k => creak(k),
  squeak: k => squeak(k), fluff: i => { if (car) fluffOut(car, i, 22); },
  snap: () => { crunch(1); thump(0.5); }, bag: () => { if (soundOn && audio()) noiseBurst(actx.currentTime, 0.09, 1500, 500, 0.5); },
  shatter: n => { shatter(glassPoints(n > 100 ? 'side' : 'screen'), n, n > 100 ? 1 : 0.5); }, bits: n => carBits(car, n, 0.6),
};
function fx(type, k) { if (!replay.on) rec.events.push({ i: rec.frames.length, type, k }); FX[type](k); }
// the continuous sound of the car giving way: nothing is playing a recording, each level follows how fast the metal is moving
let layers = null, layerR = 0, clankAcc = 0;
function makeLayers() {
  const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const loop = (type, fq, Q) => { const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); src.buffer = buf; src.loop = true; f.type = type; f.frequency.value = fq; f.Q.value = Q; g.gain.value = 0; src.connect(f); f.connect(g); g.connect(master); src.start(); return { f, g }; };
  const oscs = (type, fq, fType, ff, Q) => { const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain(); o.type = type; o.frequency.value = fq; f.type = fType; f.frequency.value = ff; f.Q.value = Q; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start(); return { o, f, g }; };
  layers = { metal: loop('bandpass', 900, 1.1), scrape: loop('bandpass', 2600, 3), hiss: loop('highpass', 3800, 0.7), groan: oscs('sawtooth', 110, 'bandpass', 520, 5), alarm: oscs('square', 660, 'bandpass', 1400, 1) };
}
function updateLayers(r, c, dt) {
  if (!actx || !soundOn && !layers) return;
  if (!layers) makeLayers();
  const t = actx.currentTime, on = soundOn && !paused, set = (p, v, tc = 0.04) => p.setTargetAtTime(on ? v : 0, t, tc);
  layerR += (r - layerR) * Math.min(1, dt * 30 || 0.3);
  const q = layerR, prog = c ? Math.min(1, c.lost / c.f.vol) : 0;
  set(layers.metal.g.gain, 0.5 * Math.pow(q, 0.7));
  layers.metal.f.frequency.setTargetAtTime(350 + 1500 * q + rand(-120, 120), t, 0.03);
  set(layers.scrape.g.gain, (rubberTrack ? 0.015 : 0.05) * q * Math.min(1, (Math.abs(speed) + Math.abs(hull.w) * 1.4) / 0.8));
  set(layers.groan.g.gain, 0.16 * q);
  layers.groan.o.frequency.setTargetAtTime(125 * (1 - 0.5 * prog) * (0.85 + 0.3 * q), t, 0.08);
  if (c) c.hiss *= Math.exp(-dt / 2.2);
  set(layers.hiss.g.gain, c ? 0.09 * Math.min(1, c.hiss) : 0, 0.1);
  const al = c ? c.alarm : 0, live = al > 0;
  set(layers.alarm.g.gain, live ? 0.028 * al : 0);
  if (live) layers.alarm.o.frequency.setTargetAtTime((Math.floor(time * 2.6) % 2 ? 880 : 660) * (0.45 + 0.55 * al), t, 0.01);
  if (slowLP) slowLP.frequency.setTargetAtTime(replay.on || userRate < 1 ? 900 + 17000 * Math.pow(userRate, 1.5) : 18000, t, 0.1);
  clankAcc += (Math.abs(speed) + Math.abs(hull.w) * 1.4) * dt / 0.155;      // the links meeting the ground
  if (clankAcc > 1) { clankAcc = 0; if (soundOn) { if (rubberTrack) noiseBurst(t, 0.05, rand(500, 800), 260, 0.012 + (c && r > 0 ? 0.02 : 0.006), 'bandpass'); else noiseBurst(t, 0.035, rand(2200, 3400), 1200, 0.018 + (c && r > 0 ? 0.05 : 0.012), 'bandpass'); } }
}

/* ---------- loose bits: mud clods off the tracks, plastic and paint off the car ---------- */
const BITS = 320;
const bitGeo = new THREE.IcosahedronGeometry(0.5, 2);
{ // soft and uneven, not cut: this is mostly wet earth
  const a = bitGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) { const k = 0.82 + 0.3 * Math.sin(a[i] * 9.1 + a[i + 2] * 5.3) * Math.cos(a[i + 1] * 7.7 - a[i] * 4.1); a[i] *= k; a[i + 1] *= k; a[i + 2] *= k; }
  bitGeo.computeVertexNormals();
}
const bitMesh = new THREE.InstancedMesh(bitGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), BITS);
bitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bitMesh.frustumCulled = false; bitMesh.castShadow = true; scene.add(bitMesh);
const bits = [];
for (let i = 0; i < BITS; i++) { bits.push({ on: false, rest: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3() }); bitMesh.setMatrixAt(i, shardO.matrix); bitMesh.setColorAt(i, tmpC.set(0x553f2a)); }
let bitNext = 0;
function spawnBit(pos, vel, size, color, mud = false) {
  const b = bits[bitNext]; bitMesh.setColorAt(bitNext, color); bitMesh.instanceColor.needsUpdate = true; bitNext = (bitNext + 1) % BITS;
  b.on = true; b.rest = false; b.mud = mud; b.size = size; b.p.copy(pos); b.v.copy(vel);
  b.s.set(size * rand(0.7, 1.3), size * rand(0.45, 0.8), size * rand(0.7, 1.3));
  b.q.setFromEuler(tmpE.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3))); b.w.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
}
const mudP = new THREE.Vector3();
function updateBits(dt) {
  let live = false;
  for (let i = 0; i < BITS; i++) {
    const b = bits[i]; if (!b.on) continue; live = true;
    if (!b.rest) {
      b.v.y -= GRAV * dt; b.p.addScaledVector(b.v, dt);
      tmpQ.setFromEuler(tmpE.set(b.w.x * dt, b.w.y * dt, b.w.z * dt)); b.q.multiply(tmpQ);
      if (b.mud && car && !car.done && !replay.on && b.v.y < 0) {       // a clod that reaches the car stays on it
        const lp = car.group.worldToLocal(mudP.copy(b.p));
        const ix = Math.floor((lp.x + 1.2) / 0.2), iz = Math.floor((lp.z + 2.6) / 0.1);
        if (ix >= 0 && ix < TOPN && iz >= 0 && iz < TOPM && car.tops[ix + iz * TOPN] > 0 && lp.y <= car.tops[ix + iz * TOPN] + 0.02) {
          mudSplat(car, lp.x, lp.z, b.size); b.on = false;
          shardO.scale.set(0, 0, 0); shardO.updateMatrix(); bitMesh.setMatrixAt(i, shardO.matrix); continue;
        }
      }
      if (b.p.y < b.s.y * 0.4) {
        b.p.y = b.s.y * 0.4;
        if (b.mud && b.v.y < -0.5) { b.rest = true; b.s.set(b.s.x * 1.5, b.s.y * 0.32, b.s.z * 1.5); b.q.identity(); b.p.y = b.s.y * 0.4; }     // wet earth lands and stays where it lands, flat
        else if (b.v.y > -0.9) b.rest = true; else { b.v.y *= -0.18; b.v.x *= 0.35; b.v.z *= 0.35; b.w.multiplyScalar(0.3); }
      }
    }
    b.p.x -= speed * dt;
    if (b.p.x < -40) { b.on = false; shardO.scale.set(0, 0, 0); }
    else { shardO.position.copy(b.p); shardO.quaternion.copy(b.q); shardO.scale.copy(b.s); }
    shardO.updateMatrix(); bitMesh.setMatrixAt(i, shardO.matrix);
  }
  if (live) bitMesh.instanceMatrix.needsUpdate = true;
  if (car && car.mud.dirty) { car.mud.tex.needsUpdate = true; car.mud.dirty = false; }
}
// clods shaken off the tracks: flung forward off the idlers, up off the sprockets, dropping under the skirts
let clodAcc = 0;
const MUD_BITS = [lin('#4a3a28'), lin('#5c4a33'), lin('#3a2f22'), lin('#6b5a43')];
function shedMud(dt, jolt) {
  clodAcc += dt * (5 * Math.abs(speed) / VMAX + jolt * 40) * (rubberTrack ? 0.35 : 1);
  while (clodAcc > 1) {
    clodAcc--;
    const s = Math.random() < 0.5 ? 0 : 1, z = SIDES[s] + rand(-0.25, 0.25), r = Math.random();
    let lp, v;
    if (r < 0.45) { lp = tmpV3.set(rand(2.9, 3.25), rand(0.6, 1.0), z); v = new THREE.Vector3(speed * rand(0.2, 0.7), rand(-0.6, 0.6), rand(-0.3, 0.3)); }
    else if (r < 0.75) { lp = tmpV3.set(rand(-3.35, -3.0), rand(0.85, 1.08), z); v = new THREE.Vector3(-speed * rand(0.1, 0.5), rand(0.4, 1.6), rand(-0.4, 0.4)); }
    else { lp = tmpV3.set(rand(-2.6, 2.4), 0.58, z + Math.sign(z) * 0.2); v = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.4, 0), Math.sign(z) * rand(0, 0.3)); }
    spawnBit(tank.localToWorld(lp.clone()), v, rand(0.03, 0.075), MUD_BITS[Math.floor(Math.random() * 4)], true);
    if (Math.random() < 0.3) spawnBit(tank.localToWorld(lp.clone()), v.clone(), rand(0.012, 0.028), WEED[Math.floor(Math.random() * WEED.length)]);
  }
}
// as the left track climbs the car, clods shake off the top of the idler and rain forward onto what it is about to crush
let flingAcc = 0;
function flingMud(dt) {
  flingAcc += dt * (rubberTrack ? 6 : 18);
  while (flingAcc > 1) {
    flingAcc--;
    const lp = tmpV3.set(rand(2.5, 3.3), rand(1.0, 1.14), SIDES[1] + rand(-0.28, 0.28));
    const v = new THREE.Vector3(speed * rand(0.2, 1.8), rand(0.2, 2.1), rand(-1.0, 1.0));
    spawnBit(tank.localToWorld(lp.clone()), v, rand(0.03, 0.08), MUD_BITS[Math.floor(Math.random() * 4)], true);
    if (Math.random() < 0.3) spawnBit(tank.localToWorld(lp.clone()), v.clone(), rand(0.012, 0.028), WEED[Math.floor(Math.random() * WEED.length)]);
  }
}
function carBits(c, n, up) {   // paint and black plastic off the crushed nose and sides
  const pc = c.paint.color;
  for (let k = 0; k < n; k++) {
    const p = carW(c, rand(-0.9, 0.9), rand(0.4, 0.9), rand(-2.2, 2.2), gp);
    spawnBit(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(rand(-1, 1), rand(0.3, 1.5) * up, rand(-1.4, 1.4)), rand(0.04, 0.11), Math.random() < 0.55 ? pc : tmpC.set(0x1a1a1a));
  }
}


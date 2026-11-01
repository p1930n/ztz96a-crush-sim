/* ---------- the wreck ---------- */
function viewWreck() {
  const c = car || wrecks[wrecks.length - 1]; if (!c) return;
  setCam('free');
  const cx = c.u + c.X; controls.target.set(cx, 0.35, c.z); camera.position.set(cx + 3.4, 2.2, c.z - 4.6);
  setSpin(true); controls.update();
}
wreckBtn.addEventListener('click', viewWreck);
ghostBtn.addEventListener('click', () => {
  const c = car || wrecks[wrecks.length - 1]; if (!c) return;
  if (!c.ghost) {                  // the car as it left the factory, drawn in thin lines over what is left of it
    const mat = new THREE.MeshBasicMaterial({ color: lin('#e8b64e'), wireframe: true, transparent: true, opacity: 0.2, depthWrite: false });
    c.ghost = new THREE.Group(); c.ghost.userData.mat = mat;
    [c.meshes[0], c.cabin].forEach(m => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(m.userData.orig, 3)); g.setIndex(m.geometry.index); c.ghost.add(new THREE.Mesh(g, mat)); });
    c.ghost.visible = false; c.group.add(c.ghost);
  }
  c.ghost.visible = !c.ghost.visible; ghostBtn.setAttribute('aria-pressed', String(c.ghost.visible));
});
function setGlass(c, st) {
  if (c.glShown === st) return;
  c.glShown = st;
  const side = c.sideGlass, scr = c.screen;
  if (st >= 1) {
    Object.assign(side, { map: crazeTex, roughness: 0.45, metalness: 0.15, opacity: 0.9 }); side.color.copy(lin('#7d8589'));
    Object.assign(scr, { map: crackTex, roughness: 0.34, metalness: 0.2, opacity: 0.92 }); scr.color.copy(lin('#5e666b'));
  } else {
    Object.assign(side, { map: null, roughness: 0.04, metalness: 0.9, opacity: 0.78 }); side.color.copy(lin('#0c1418'));
    Object.assign(scr, { map: null, roughness: 0.04, metalness: 0.9, opacity: 0.8 }); scr.color.copy(lin('#0c1418'));
  }
  side.visible = st < 2; side.needsUpdate = true; scr.needsUpdate = true;
}
function updateBags(c) {
  const on = c.bagT >= 0;
  for (const b of c.bags) {
    if (!on) { b.visible = false; continue; }
    if (b.userData.y0 === undefined) b.userData.y0 = b.position.y;
    const v = sampleV(c, b.position.x, b.position.z), s = Math.min(1, c.bagT / 0.035) * (1 - 0.78 * smooth01(0.1, 0.55, c.bagT));   // they vent almost at once
    b.visible = v > 0.5; if (!b.visible) continue;
    const sy = Math.min(s, Math.max(0.05, (v - b.userData.y0 + 0.3) / 0.3) * s);
    b.scale.set(s * 1.05, sy * 0.8, s * 0.72); b.position.y = Math.min(b.userData.y0, v - 0.24 * sy - 0.02);
  }
}
function sampleV(c, x, z) {
  const fi = Math.max(0, Math.min(GNX - 1.001, (x - GX0) / GC)), fj = Math.max(0, Math.min(GNZ - 1.001, (z - GZ0) / GC)), i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, V = c.f.V, n = i * GNZ + j;
  return (V[n] * (1 - b) + V[n + 1] * b) * (1 - a) + (V[n + GNZ] * (1 - b) + V[n + GNZ + 1] * b) * a;
}
// steam off the burst radiator, hazards and alarm until the bonnet takes the battery with it, airbags on the first blow
const STEAM = lin('#e6e6e1');
function carSideshow(c, dt) {
  const f = c.f;
  if (c.lost > 0.02 && !c.alarm) c.alarm = 1;
  if (c.alarm === 1 && pressedIn(f, f.hoodN) > 0.34) { c.alarm = 0.99; fx('thump', 0.2); }
  if (c.lost > 0.03 && c.bagT < 0) { c.bagT = 0; fx('bag', 1); }
  if (c.bagT >= 0) { c.bagT += dt; updateBags(c); }
  if (!c.steam && pressedIn(f, f.hoodN) > 0.22) { c.steam = 1; c.hiss = Math.max(c.hiss, 0.7); }
  if (c.alarm > 0 && c.alarm < 1) c.alarm = Math.max(0.0001, c.alarm - dt / 0.8);
}
function carLights(c) {
  const live = c.alarm >= 0.2, on = live && Math.floor(time * 2.6) % 2 === 0;
  c.lamp.emissiveIntensity = c.alarm ? (on ? 26 : live ? 0.2 : 0) : 1; c.tail.emissiveIntensity = c.alarm ? (on ? 24 : live ? 0.2 : 0) : 1;
}
function carSteam(c, dt) {
  if (c.steam <= 0) return;
  c.steam = Math.max(0.0001, c.steam - dt / 6);
  if (c.steam < 0.01) return;
  if (Math.random() < 26 * c.steam * dt) {
    const p = carW(c, rand(-0.5, 0.5), 0.75 + c.V.ly, rand(1.3, 2.0), gp);
    spawn({ pos: new THREE.Vector3(p[0], p[1], p[2]), vel: new THREE.Vector3(rand(-0.3, 0.3), rand(0.7, 1.5), rand(-0.3, 0.3)), life: rand(1.1, 1.8), s0: 0.22, s1: rand(1.0, 1.7), op: 0.26, color: STEAM, drag: 0.9, rise: 0.8 });
  }
}

/* ---------- cameras ---------- */
let camMode = 'auto';
const insideLamp = new THREE.PointLight(0xffe2bd, 0, 7, 1.6); scene.add(insideLamp);
const insideGaze = new THREE.Vector3(), gazeTmp = new THREE.Vector3(), driverEye = new THREE.Vector3(); let gazeSet = false, eyeSet = false;
const look = { free: false, y: 0, p: 0, zoom: 1 }, lookPts = new Map(); let lookPinch = 0;
const zoomBy = k => { look.zoom = Math.max(0.35, Math.min(1.6, look.zoom * k)); look.free = true; $('#lookBack').hidden = false; };
function lookReset() { look.free = false; look.y = 0; look.p = 0; look.zoom = 1; lookPts.clear(); lookPinch = 0; $('#lookBack').hidden = true; }
{
  const el = renderer.domElement, on = () => camFixed();
  el.addEventListener('pointerdown', e => { if (!on()) return; el.setPointerCapture(e.pointerId); lookPts.set(e.pointerId, [e.clientX, e.clientY]); lookPinch = 0; });
  el.addEventListener('pointermove', e => {
    const q = lookPts.get(e.pointerId); if (!on() || !q) return;
    const dx = e.clientX - q[0], dy = e.clientY - q[1]; q[0] = e.clientX; q[1] = e.clientY;
    if (lookPts.size === 2) {
      const [a, b] = [...lookPts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lookPinch) zoomBy(lookPinch / d);
      lookPinch = d; return;
    }
    if (!dx && !dy) return;
    const k = 0.0042 * Math.min(1.3, camera.fov / 60);
    look.free = true; $('#lookBack').hidden = false;
    look.y = (look.y + dx * k) % (Math.PI * 2); look.p = camMode === 'inside' ? Math.max(-1.45, Math.min(1.45, look.p + dy * k)) : look.p + dy * k;
  });
  const up = e => { lookPts.delete(e.pointerId); lookPinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { if (!on()) return; e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.001)); }, { passive: false });
  el.addEventListener('dblclick', () => { if (on()) lookReset(); });
  $('#lookBack').addEventListener('click', lookReset);
}
const camFixed = () => camMode === 'low' || camMode === 'track' || camMode === 'top' || camMode === 'inside';
const camAt = new THREE.Vector3(), camLook = new THREE.Vector3(), orbitS = new THREE.Spherical();
const HINT_DRIVE = '按住前进或倒车（W / S）· P 暂停 · 1–6 切机位 · 空格开火', HINT_FREE = '拖动旋转 · 滚轮或双指缩放 · 右键或双指平移', HINT_LOOK = '拖动调角度 · 滚轮或双指调视野 · 双击复位';
camera.layers.enable(1);
function setCam(m) {
  if (m === 'inside' && (!car || car.prop)) m = car ? 'low' : 'free';      // a seat only a car has
  camMode = m; camSeg(m); camAnim = null;
  EYE_CUT.value.w = 0; insideLamp.intensity = 0; gazeSet = false; eyeSet = false; lookReset();
  $('#lookBack').textContent = m === 'inside' ? '回到跟随履带' : '回到默认角度';
  $('.hint').textContent = m === 'free' ? HINT_FREE : camFixed() ? HINT_LOOK : HINT_DRIVE;
  if (m !== 'auto' && shots) endShots();
  camera.near = m === 'inside' ? 0.04 : 0.1;
  if (m === 'inside') camera.layers.disable(1); else camera.layers.enable(1);
  if (m === 'auto') { if (car && !shots) startShots(); if (!car) controls.enabled = true; }
  else if (camFixed()) { controls.enabled = false; controls.autoRotate = false; spinBtn.setAttribute('aria-pressed', 'false'); }
  else { controls.enabled = true; camera.fov = 34; }
  camera.updateProjectionMatrix();
}
function updateCam(dt) {
  const c = car || wrecks[wrecks.length - 1];
  if (!c) { setCam('free'); return; }
  if (camMode === 'inside' && c.prop) { setCam('low'); return; }
  const cx = c.u + c.X, cz = c.z;
  let fov = 40;
  if (camMode === 'low') { camAt.set(cx + 1.0, 0.2, cz - 3.3); camLook.set(cx, 0.55, cz); fov = 44; }
  else if (camMode === 'track') {           // bolted to the hull: it rocks with the tank, the car comes through under it
    tank.updateMatrixWorld(); tank.localToWorld(camAt.set(3.95, 0.42, -2.55)); tank.localToWorld(camLook.set(2.45, 0.38, -1.4)); fov = 34;
  } else if (camMode === 'top') { const x = cx * 0.5 + 0.4; camAt.set(x, 11.5, cz - 0.02); camLook.set(x, 0.3, cz); fov = 36; }
  else {                                     // the driver's eye: carried by the seat, and forced down by what comes down on it
    const V = c.V, ex = 0.38, ey = 1.18 + V.sy, ez = Math.max(-0.12, V.dash - 0.9), sh = c.shell;
    let px = ex, py = ey, pz = ez;
    let floor = 0.16;
    if (sh) { const P = sh.S.p, q = sh.seatTop[0] * 3; px += P[q] - 0.38; py += P[q + 1] - (0.62 + V.sy); pz += P[q + 2] - 0.05; floor = Math.max(floor, P[q + 1] + 0.12); }   // the head cannot go lower than the seat under it
    const vh = sampleV(c, px, pz);
    gazeTmp.set(px, Math.max(floor, Math.min(py, vh - 0.1)), pz);
    if (!eyeSet) { driverEye.copy(gazeTmp); eyeSet = true; }
    driverEye.lerp(gazeTmp, 1 - Math.exp(-(dt || 0) * 14));
    c.group.updateMatrixWorld();
    c.group.localToWorld(camAt.copy(driverEye));
    // ahead through the screen; as the tank comes the head turns to the idler and lifts, as far as a neck goes, then back once it has gone
    tank.updateMatrixWorld(); c.group.worldToLocal(tank.localToWorld(gazeTmp.set(2.98, 0.6, SIDES[1])));
    const gd = gazeTmp.z - driverEye.z, near = (1 - smooth01(0.8, 3.6, gd)) * smooth01(-9, -6.5, gd);
    gazeTmp.set(driverEye.x + Math.max(-0.9, Math.min(0.9, gazeTmp.x - driverEye.x)) * near, driverEye.y - 0.1 + 0.7 * near, driverEye.z + 2);
    if (!gazeSet) { insideGaze.copy(gazeTmp); gazeSet = true; }
    insideGaze.lerp(gazeTmp, 1 - Math.exp(-(dt || 0) * 4));
    c.group.localToWorld(camLook.copy(insideGaze));
    // a person's eye takes in about 110° across, whatever the shape of the screen
    fov = Math.max(65, Math.min(105, 2 * Math.atan(Math.tan(55 * DEG) / camera.aspect) / DEG));
    // only once the metal is down at the eye does it open round it, by as much as the cabin has lost
    const cut = Math.max(0, Math.min(1, (ey + 0.14 - vh) / 0.5));
    EYE_CUT.value.set(camAt.x, camAt.y, camAt.z, cut * 0.7);
    insideLamp.position.copy(camAt); insideLamp.position.y += 0.05; insideLamp.intensity = 0.5 + 3 * cut;
  }
  if (camMode !== 'inside') {                // the camera goes round what it is looking at, and stays above the ground and off the tank
    orbitS.setFromVector3(camAt.sub(camLook));
    orbitS.theta -= look.y;
    look.p = Math.max(orbitS.phi - 1.72, Math.min(orbitS.phi - 0.002, look.p));
    orbitS.phi -= look.p;
    camAt.setFromSpherical(orbitS).add(camLook);
    if (camMode === 'track') {
      tank.worldToLocal(camAt);
      if (camAt.x > -3.7 && camAt.x < 3.75 && camAt.y < 1.5 && Math.abs(camAt.z) < 1.95) camAt.z = camAt.z < 0 ? -1.95 : 1.95;
      tank.localToWorld(camAt);
    }
    if (camAt.y < 0.06) camAt.y = 0.06;
  }
  fov = Math.max(12, Math.min(115, fov * look.zoom));
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const [jy, jx] = joltStep(dt);
  camera.position.copy(camAt); camera.lookAt(camLook);
  if (camMode === 'inside') { camera.rotateY(look.y); camera.rotateX(look.p); }
  camera.rotateY(jy); camera.rotateX(jx);
}



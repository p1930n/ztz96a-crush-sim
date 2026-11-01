/* ---------- the wreck ---------- */
function viewWreck() {
  const c = car || wrecks[wrecks.length - 1]; if (!c) return;
  setCam('free');
  const cx = c.u + c.X; controls.target.set(cx, 0.35, c.z); camera.position.set(cx + 3.4, 2.2, c.z - 4.6);
  controls.minDistance = 1.6; controls.maxDistance = 40; controls.maxPolarAngle = 1.52; setSpin(true); controls.update();
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
let camMode = 'auto', camLostT = 0;
const insideLamp = new THREE.PointLight(0xffe2bd, 0, 7, 1.6); scene.add(insideLamp);
const insideGaze = new THREE.Vector3(), gazeTmp = new THREE.Vector3(); let gazeSet = false;
const look = { free: false, y: 0, p: 0, fov: 74 }, lookPts = new Map(); let lookPinch = 0;
function lookReset() { look.free = false; look.y = 0; look.p = 0; look.fov = 74; lookPts.clear(); lookPinch = 0; $('#lookBack').hidden = true; }
{
  const el = renderer.domElement, on = () => camMode === 'inside';
  el.addEventListener('pointerdown', e => { if (!on()) return; el.setPointerCapture(e.pointerId); lookPts.set(e.pointerId, [e.clientX, e.clientY]); lookPinch = 0; });
  el.addEventListener('pointermove', e => {
    const q = lookPts.get(e.pointerId); if (!on() || !q) return;
    const dx = e.clientX - q[0], dy = e.clientY - q[1]; q[0] = e.clientX; q[1] = e.clientY;
    if (lookPts.size === 2) {
      const [a, b] = [...lookPts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lookPinch) look.fov = Math.max(28, Math.min(100, look.fov * lookPinch / d));
      lookPinch = d; return;
    }
    if (!dx && !dy) return;
    const k = 0.0042 * look.fov / 74;
    look.free = true; $('#lookBack').hidden = false;
    look.y = (look.y + dx * k) % (Math.PI * 2); look.p = Math.max(-1.45, Math.min(1.45, look.p + dy * k));
  });
  const up = e => { lookPts.delete(e.pointerId); lookPinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { if (!on()) return; e.preventDefault(); look.fov = Math.max(28, Math.min(100, look.fov * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  el.addEventListener('dblclick', () => { if (on()) lookReset(); });
  $('#lookBack').addEventListener('click', lookReset);
}
const camFixed = () => camMode === 'low' || camMode === 'track' || camMode === 'top' || camMode === 'inside';
const camAt = new THREE.Vector3(), camLook = new THREE.Vector3();
function setCam(m) {
  if (m === 'inside' && !car) m = 'free';
  camMode = m; camSeg(m); camAnim = null;
  $('#camLost').hidden = true; camLostT = 0;
  ROOF_CUT.value.w = 0; insideLamp.intensity = 0; gazeSet = false; lookReset();
  if (m !== 'auto' && shots) endShots();
  camera.near = m === 'inside' ? 0.04 : 0.1;
  if (m === 'auto') { if (car && !shots) startShots(); if (!car) controls.enabled = true; }
  else if (camFixed()) { controls.enabled = false; controls.autoRotate = false; spinBtn.setAttribute('aria-pressed', 'false'); }
  else { controls.enabled = true; camera.fov = 34; }
  camera.updateProjectionMatrix();
}
function updateCam(dt) {
  const c = car || wrecks[wrecks.length - 1];
  if (!c) { setCam('free'); return; }
  const cx = c.u + c.X, cz = c.z;
  let fov = 40;
  if (camMode === 'low') { camAt.set(cx + 1.0, 0.2, cz - 3.3); camLook.set(cx, 0.55, cz); fov = 44; }
  else if (camMode === 'track') {           // bolted to the hull: it rocks with the tank, the car comes through under it
    tank.updateMatrixWorld(); tank.localToWorld(camAt.set(3.95, 0.42, -2.55)); tank.localToWorld(camLook.set(2.45, 0.38, -1.4)); fov = 34;
  } else if (camMode === 'top') { const x = cx * 0.5 + 0.4; camAt.set(x, 11.5, cz - 0.02); camLook.set(x, 0.3, cz); fov = 36; }
  else {                                     // from the back seat, past the two bears, out through the screen
    const V = c.V, vh = sampleV(c, V.eye[0], V.eye[2]);
    c.group.updateMatrixWorld();
    c.group.localToWorld(camAt.set(V.eye[0], Math.min(V.eye[1], vh - 0.12), V.eye[2]));
    // the eye goes to the idler as it comes in, then tips back to watch the links roll over the roof opening
    tank.updateMatrixWorld(); c.group.worldToLocal(tank.localToWorld(gazeTmp.set(2.98, 0.6, SIDES[1])));
    const ez = V.eye[2], gd = gazeTmp.z - ez, gt = smooth01(0.4, 3.2, gd);
    gazeTmp.set(Math.max(-0.7, Math.min(0.7, gazeTmp.x)) * (gd > 0 ? 0.7 : 1), V.eye[1] + 1.6 * (1 - gt) + 0.04 * gt, ez + Math.max(0.28, Math.min(3.2, gd)));
    if (!gazeSet) { insideGaze.copy(gazeTmp); gazeSet = true; }
    if (!look.free) insideGaze.lerp(gazeTmp, 1 - Math.exp(-(dt || 0) * 4));
    c.group.localToWorld(camLook.copy(insideGaze)); fov = look.fov;
    ROOF_CUT.value.set(c.roofHole[0], c.roofHole[1], c.roofHole[2], 1);
    insideLamp.position.copy(camAt); insideLamp.position.y += 0.05; insideLamp.intensity = 2.2;
    if (vh < 0.62 + V.sy && !camLostT) { camLostT = 1.3; $('#camLost').hidden = false; }
    if (camLostT) { camLostT -= dt || 1 / 60; if (camLostT <= 0) { setCam('track'); return; } }
  }
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const [jy, jx] = joltStep(dt);
  camera.position.copy(camAt); camera.lookAt(camLook);
  if (camMode === 'inside') { camera.rotateY(look.y); camera.rotateX(look.p); }
  camera.rotateY(jy); camera.rotateX(jx);
}



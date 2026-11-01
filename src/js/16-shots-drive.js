/* ---------- the crossing the way it is usually filmed: fixed cameras by the track, cut on the action ---------- */
// each shot starts when the car reaches a point relative to the tank; its tripod stands on the ground and so scrolls
const SHOTS = [
  { at: 99, pos: [30, 1.7, -22], look: 'mid', fov: 17 },           // long lens from the roadside ahead
  { at: 6.6, pos: [10.5, 0.55, -9.6], look: 'nose', fov: 25 },     // low beside the car: the track climbs the bonnet
  { at: -0.6, pos: [-13, 0.95, -6.5], look: 'rear', fov: 19 },     // a little higher, from behind the track's quarter: what it leaves
];
let shots = null;
const shotLook = new THREE.Vector3();
function startShots() { shots = { i: -1, pos: new THREE.Vector3(), look: new THREE.Vector3(), t: 0 }; camAnim = null; controls.enabled = false; controls.autoRotate = false; }
function endShots() {
  if (!shots) return;
  shots = null; controls.enabled = true; camera.fov = 34; camera.updateProjectionMatrix();
  controls.target.copy(TARGET); controls.update();
}
let joltT = 0;
function joltStep(dt) {
  shake *= Math.exp(-5 * dt); joltT += dt;
  return [shake * 0.3 * (Math.sin(joltT * 31) + 0.5 * Math.sin(joltT * 47 + 1)), shake * 0.3 * (Math.sin(joltT * 37 + 2) + 0.5 * Math.sin(joltT * 53))];
}
function shotTarget(kind, c) {
  const cx = c ? c.u + c.X : 0;
  const cz = c ? c.z : CAR_Z;
  if (kind === 'car') return shotLook.set(cx, 0.75, cz);
  if (kind === 'nose') return shotLook.set((cx - 2.28 + 3.0) / 2, 0.85, cz * 0.8);
  if (kind === 'tank') return shotLook.set(0.6, 0.9, -0.7);
  if (kind === 'rear') return shotLook.set(Math.max(-3.6, cx * 0.5 - 1.6), 0.55, -1.25);
  return shotLook.set(Math.max(-6, Math.min(8, cx)) / 2 + 0.6, 1.0, -0.6);
}
function updateShots(dt) {
  const c = car || wrecks[wrecks.length - 1], cx = c ? c.u + c.X : -99;
  let next = shots.i; while (next + 1 < SHOTS.length && cx < SHOTS[next + 1].at) next++;
  if (next !== shots.i) {         // cut
    shots.i = next; const s = SHOTS[next];
    shots.pos.set(...s.pos); camera.fov = s.fov; camera.updateProjectionMatrix();
    shots.look.copy(shotTarget(s.look, c)); shots.t = 0;
  }
  if (c && c.pv && c.pv.on && !c.done) { pvCamera(c.pv, c, dt); return; }
  const s = SHOTS[shots.i]; shots.t += dt;
  shots.pos.x -= speed * hull.cy * dt; shots.pos.z += speed * hull.sy * dt;      // the tripod is on the ground
  shots.look.lerp(shotTarget(s.look, c), 1 - Math.exp(-3 * dt));   // the operator pans to follow
  camera.position.copy(shots.pos); camera.lookAt(shots.look);
  const tt = time * 1.0, hand = s.look === 'tank' ? 0.0015 : 0.0035;    // the drone is steadier than a hand
  const [jy, jx] = joltStep(dt);
  camera.rotateY(hand * (Math.sin(tt * 1.3) + 0.6 * Math.sin(tt * 2.7 + 1.1)) + jy);
  camera.rotateX(hand * (Math.sin(tt * 1.1 + 2.0) + 0.5 * Math.sin(tt * 3.1)) + jx);
  if (cx < -20 && shots.t > 2 && !replay.on && !(c && c.pv)) { setCam('free'); goView('iso'); }
}
renderer.domElement.addEventListener('pointerdown', () => { if (shots) setCam('free'); });

let lastThump = -9;
const beltKeys = SIDES.map(() => '');
const tmpW = new THREE.Vector3();
let engineLoad = 0;
function poseTank(near) {
  tank.position.y = hull.y; tank.rotation.set(-hull.r, hull.yaw, hull.a, 'YXZ');
  tank.updateMatrixWorld();
  // road wheels ride their arms; each track is relaid over its wheels and over whatever it is draped across
  for (let i = 0; i < WX.length; i++) SIDES.forEach((z, s) => { wheelArms[i][s].position.y = 0.42 + wd[s][i]; });
  let relaid = false;
  const onWreck = near && (car.shell || (car.pv && car.pv.on));
  if (near) { tankInv.copy(tank.matrixWorld).invert(); if (!onWreck) bandWorld(); }
  SIDES.forEach((z, s) => {
    const sup = [];
    if (onWreck) {
      for (let x = -2.1; x <= 2.11; x += 0.3) { const h = wreckTop(car, x, z, 0); if (h > 0.02) { const wx = x * hull.cy + z * hull.sy, wz = -x * hull.sy + z * hull.cy; tmpV3.set(wx, h, wz).applyMatrix4(tankInv); sup.push({ x: tmpV3.x, y: tmpV3.y + 0.05 }); } }
    } else if (near && z < 0) {
      for (let k = 0; k < car.nb; k++) { if (car.Hs[k] <= 0) continue; tmpV3.set(BP[k][0], BP[k][1], BP[k][2]).applyMatrix4(tankInv); sup.push({ x: tmpV3.x, y: tmpV3.y + 0.05 }); }
      sup.sort((a, b) => a.x - b.x);
    }
    const key = Array.from(wd[s], v => v.toFixed(3)).join() + sup.map(p => p.x.toFixed(2) + p.y.toFixed(3)).join();
    if (key !== beltKeys[s]) { beltKeys[s] = key; relayBelt(s, buildBelt(beltCircles(s, sup))); relaid = true; }
  });
  return relaid;
}
function scrollOthers(dt) {
  for (let i = wrecks.length - 1; i >= 0; i--) {
    const w = wrecks[i]; w.u -= speed * hull.cy * dt; w.z += speed * hull.sy * dt; placeCar(w); updateLoose(w, dt); carLights(w);
    if (Math.abs(w.z) > 60 || w.u + w.X < -45 || w.u + w.X > 60) { disposeCar(w); wrecks.splice(i, 1); }
  }
  for (const q of queue) { q.u -= speed * hull.cy * dt; q.z += speed * hull.sy * dt; placeCar(q); }
  updateLooseParts(dt);
  updateBits(dt);
  updateShards(dt);
}
function updateCar(dt) {
  if (car && car.shell && Math.hypot(car.u + car.X, car.z) < 6.6) { car.shell.awake = true; car.shell.quiet = 0; }
  const shellLive = !!car && !!car.shell && car.shell.awake, n = Math.max(1, Math.ceil(dt / (shellLive ? 0.001 : 0.002))), h = dt / n, L0 = car ? car.lost : 0;
  hits.length = 0;
  if (shellLive) { trackUnderside(0); trackUnderside(1); }
  for (let k = 0; k < n; k++) {
    hull.yaw += hull.w * h; hull.cy = Math.cos(hull.yaw); hull.sy = Math.sin(hull.yaw);
    if (car) { car.u -= speed * hull.cy * h; car.z += speed * hull.sy * h; }
    suspStep(h);
    if (shellLive) shellCarStep(car, h, true);
  }
  if (car && car.done && !car.pv && !car.shell && car.u + car.X > -7.5) { car.done = false; setCrushReady(true, '换一辆'); }   // backed onto it again
  const cx = car ? car.u + car.X : 99;
  // past the car on the single track run, the driver takes over for the broadside
  if (car && car.pv && !car.pv.on && auto && !queue.length && !car.done && cx < -6.2) {
    car.pv.on = true; car.pv.st = 0; car.th *= 0.5; car.ph *= 0.5; car.pvBedDrop = 0;
    car.pvBed = new Float32Array(GN); if (!car.shell) car.Y = Math.max(car.Y, CAR_CG - 0.02);
    for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) car.pvBed[n] = 0.22 + 0.22 * vnoise((GX0 + i * GC) * 2.3 + car.seed, (GZ0 + j * GC) * 2.3, 5);
  }
  const pvOn = !!car && !!car.pv && car.pv.on, near = pvOn || (!!car && !!car.shell && !car.done) ? Math.hypot(cx, car.z) < 9.5 : !!car && !car.done && cx > -7.5 && cx < 7.5;
  const relaid = poseTank(near);
  if (shellLive && !near && car) shellFrame(car);

  // landings: the heaviest one in a moment gets heard, and kicks up dust and mud
  let best = null, jolt = 0;
  for (const e of hits) if (!best || e.v > best.v) best = e;
  if (best && best.v > 0.35 && time - lastThump > 0.25) {
    lastThump = time;
    const k = Math.min(1, (best.v - 0.3) / 1.6); jolt = k;
    if (best.onCar) fx('crunch', k); else fx('thump', k);
    shake = Math.max(shake, 0.012 * k);
    if (!best.onCar && best.v > 0.6) {
      wheelArms[best.i][best.s].getWorldPosition(tmpW);
      for (let j = 0; j < 6 + Math.round(10 * k); j++)
        spawn({ pos: new THREE.Vector3(tmpW.x + rand(-0.6, 0.6), 0.2, tmpW.z + rand(-0.5, 0.5)), vel: new THREE.Vector3(rand(-1, 1.6), rand(0.4, 1.4), Math.sign(tmpW.z) * rand(0.6, 3)), life: rand(1.8, 3.2), s0: 0.6, s1: rand(2.2, 3.8), op: 0.3 + 0.25 * k, color: Math.random() < 0.5 ? DUST : DUSTLIT, drag: 1.6, rise: 0.15 });
    }
  }
  // dust ground out of the car and the dirt where the track grinds onto it
  if (pvOn && carLoad > 0.1 && (Math.abs(speed) > 0.1 || hull.w) && Math.random() < 22 * dt) {
    const zs = SIDES[Math.random() < 0.5 ? 0 : 1], xs = rand(-2.6, 2.6), wx = xs * hull.cy + zs * hull.sy, wz = -xs * hull.sy + zs * hull.cy;
    spawn({ pos: new THREE.Vector3(wx, rand(0.15, 0.5), wz), vel: new THREE.Vector3(rand(-1, 1), rand(0.3, 1.1), rand(-1, 1)), life: rand(1.4, 2.6), s0: 0.5, s1: rand(1.6, 3), op: 0.28, color: Math.random() < 0.5 ? DUST : DUSTLIT, drag: 1.4, rise: 0.2 });
    if (Math.random() < 0.3) fx('bits', 2);
    if (time - lastThump > 0.22 && Math.random() < 0.5) { lastThump = time; fx('crunch', 0.35 + Math.abs(hull.w) * 0.6); shake = Math.max(shake, 0.004); }
  }
  if (!pvOn && car && carLoad > 0.2 && Math.abs(speed) > 0.2 && Math.random() < 14 * dt) {
    const fx0 = rand(-1.0, 3.2);
    spawn({ pos: new THREE.Vector3(fx0, rand(0.3, 0.9), rand(-1.9, -0.9)), vel: new THREE.Vector3(rand(-0.6, 0.8), rand(0.3, 1.0), rand(-1.6, -0.3)), life: rand(1.6, 2.8), s0: 0.5, s1: rand(1.8, 3.2), op: 0.26, color: Math.random() < 0.5 ? DUST : DUSTLIT, drag: 1.4, rise: 0.2 });
  }
  let rate = 0;
  if (car) {
    placeCar(car);
    if (near) {
      trackUnderside(0); trackUnderside(1);
      if (car.shell) { pvStamp(car, dt); shellFrame(car); }
      else {
        if (pvOn) { pvCrush(car, dt); pvStamp(car, dt); car.th *= Math.exp(-dt * 2); car.ph *= Math.exp(-dt * 2); } else stampTrack(car);
        fieldStep(car, dt);
        warpCar(car);
      }
      if (!car.snapped) {           // the pillars hold, hold, and then let go all at once
        let onRoof = 0; for (const q of car.f.roofN) { const d = car.f.real[q] - car.f.R[q]; if (d > onRoof) onRoof = d; }
        if (onRoof > car.V.hold) { car.snapped = true; fx('snap', 1); shake = Math.max(shake, 0.014); }
      } else if (car.give < 1) car.give = Math.min(1, car.give + dt / 0.28);
      // backing over it, or coming round again, the tracks press what the last pass left
      const sp = Math.sign(speed);
      if (!pvOn && sp && sp !== car.dir && Math.abs(speed) > 0.3 && car.lost > 0.1) { car.dir = sp; if (carLoad > 0.05 || car.done) car.pass = Math.min(3, car.pass + 1); }
      const dC = (car.lost - L0) * 2.2;
      rate = dt > 0 ? Math.max(0, Math.min(1, (car.lost - L0) / dt / 1.6)) : 0;
      if (!car.nb && dC > 0) { hull.vy += dC * 0.2; hull.va += dC * 0.12; }   // the belly rides up on what it is flattening
      if (time - (car.topsAt || -1) > 0.08) { car.topsAt = time; carTops(car); }
      if (!pvOn && speed > 0.2 && cx < 7.5 && cx > -3 && car.nb) flingMud(dt);
      const crushed = car.lost * 2.2;
      // tempered side glass crazes white and then drops out; the laminated screens craze and stay in their frames
      const gm = car.cabin.userData, frac = gm.hit / (gm.orig.length / 3);
      if (car.glassStage === 0 && (crushed > 0.3 || frac > 0.02)) {
        car.glassStage = 1; fx('glass', 0.7); fx('bits', 5); setGlass(car, 1);
      } else if (car.glassStage === 1 && (frac > 0.12 || crushed > 3)) {
        car.glassStage = 2; fx('glass', 0.9); fx('shatter', 160); setGlass(car, 2);
      } else if (car.glassStage === 2 && frac > 0.4) { car.glassStage = 3; fx('glass', 0.35); fx('shatter', 30); }
      car.plush.forEach((m, i) => {
        const u = m.userData;
        if (!u.squeaked && u.maxDsp > 0.05) { u.squeaked = true; fx('squeak', i); }
        if (!u.burst && u.maxDsp > 0.3) { u.burst = true; car.stuffed = true; fx('fluff', i); fx('squeak', 0.4); }
      });
      for (const t of car.tires) if (!t.userData.popped && t.userData.maxDsp > 0.07) {
        t.userData.popped = true; car.popped++; car.hiss = Math.max(car.hiss, 1); fx('pop', 1);
        // the corner drops onto its rim
        for (const g of car.ground) if (g.tyre && g.L === t.userData.wz && Math.sign(g.x) === Math.sign(t.userData.wx)) g.k *= 0.35;
      }
      if (!car.leak && crushed > 5) car.leak = 0.001;
      crushAcc += dC * 0.12;
      if (crushAcc > crushNext) { fx('crunch', Math.min(1, dC / Math.max(dt, 1e-3) / 3)); crushAcc = 0; crushNext = rand(0.012, 0.035); }
      // standing still on it, the metal keeps shifting
      car.settle -= dt;
      if (rate < 0.02 && carLoad > 0.2 && Math.abs(speed) < 0.05 && car.settle <= 0) { car.settle = rand(0.5, 1.7); fx('creak', Math.min(1, carLoad / GRAV * 1.4)); if (Math.random() < 0.4) car.Y -= 0.0015; }
      // the car dropping back on its wheels or its sills after being levered up
      if (car.slam < -0.9) {
        const k = Math.min(1, (-car.slam - 0.6) / 2.5); fx('thump', k * 0.7); fx('crunch', k); carBits(car, 2 + Math.round(4 * k), 0.4); jolt = Math.max(jolt, k);
        const p = carW(car, 0, 0, 0, gp);
        for (let j = 0; j < 4 + Math.round(6 * k); j++) spawn({ pos: new THREE.Vector3(p[0] + rand(-2, 2), 0.15, p[2] + rand(-1, 1)), vel: new THREE.Vector3(rand(-1, 1), rand(0.3, 0.8), rand(-1.5, 1.5)), life: rand(1.2, 2.2), s0: 0.5, s1: rand(1.5, 2.6), op: 0.3, color: DUST, drag: 2, rise: 0.1 });
      }
      car.slam = 0;
      carSideshow(car, dt);
      checkStages(car);
      recFrame(dt, rate);
    }
    carSteam(car, dt); carLights(car);
    if (!car.done && !pvOn && cx < (queue.length ? -6.2 : -8)) {
      car.done = true;
      if (queue.length) { removeCar(); car = queue.shift(); beginRun(); }
      else setCrushReady(true, '再来一辆');
    }
    if (car && car.done && (cx < -45 || Math.abs(car.z) > 60)) { disposeCar(car); car = null; }
  }
  if (car) updateLoose(car, dt);
  scrollOthers(dt);
  shedMud(dt, jolt + (near && carLoad > 0 ? 0.08 : 0));
  updateLayers(rate, car, dt);

  // the engine labours while the hull is climbing or carrying the car
  engineLoad = Math.min(1, Math.max(0, hull.a / 0.1) + Math.abs(hull.r) / 0.25 + carLoad / GRAV * 0.4 + Math.abs(hull.w) * 0.7);
  return relaid;
}

const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
const PV_OFF = 6.8, PV_W = 0.62;
function pvTurn(goal, dt) {
  const e = wrapPi(goal - hull.yaw), w = Math.max(-PV_W, Math.min(PV_W, e * 1.6));
  hull.w = approach(hull.w, w, 1.4 * dt);
  if (Math.abs(e) < 0.006 && Math.abs(hull.w) < 0.03) { hull.yaw = goal; hull.w = 0; return true; }
  return false;
}
// returns the speed the driver wants, or null when nobody is driving this routine
function pvPilot(dt) {
  const c = car, p = c && c.pv;
  if (!p || !p.on || !auto || c.done) return null;
  p.t += dt;
  const rx = -(c.u + c.X), rz = -c.z;
  if (p.st === 0) {                 // stop clear of it, turn the tail toward the point to back up to
    if (Math.abs(speed) > 0.02) return 0;
    const dx = 0 - rx, dz = PV_OFF - rz; p.goal = Math.atan2(dz, -dx);
    if (pvTurn(p.goal, dt)) { p.st = 1; p.t = 0; }
    return 0;
  }
  if (p.st === 1) {                 // back away on the diagonal
    const d = Math.hypot(rx, PV_OFF - rz);
    if (d < 0.12) { p.st = 2; p.t = 0; return 0; }
    return -Math.min(4, Math.max(0.5, d * 0.9));
  }
  if (p.st === 2) {                 // face the wreck broadside
    if (Math.abs(speed) > 0.02) return 0;
    if (pvTurn(Math.PI / 2, dt)) { p.st = 3; p.t = 0; }
    return 0;
  }
  if (p.st === 3) {                 // and climb on
    if (rz < 0.05) { p.st = 4; p.t = 0; p.rot = 0; c.pass = Math.min(3, c.pass + 1); return 0; }
    return rz > 4.2 ? 3 : rz < 0.5 ? Math.max(0.3, crawl * rz * 2) : crawl;
  }
  if (p.st === 4) {                 // on top of it: one track forward, one back, a full circle
    if (Math.abs(speed) > 0.02) return 0;
    if (!c.scuff) pvScuff(c);
    const left = Math.PI * 2 - p.rot, w = left < 0.45 ? Math.max(0.05, left * 1.6) : PV_W;
    hull.w = approach(hull.w, w, 0.9 * dt);
    p.rot += hull.w * dt;
    if (!c.shell) c.yawC += hull.w * dt * Math.min(1, carLoad / GRAV * 2) * 0.14;      // the wreck is dragged part of the way round
    c.scuff.material.opacity = Math.min(0.36, p.rot / Math.PI * 0.36);
    if (p.rot > Math.PI && c.pass < 3 && !p.again) { p.again = true; c.pass++; c.pvBedDrop = -0.03; }
    if (left < 0.004) { hull.w = 0; p.st = 5; p.t = 0; }
    return 0;
  }
  if (p.st === 5) {                 // off the far side
    if (rz < -PV_OFF) { p.st = 6; p.t = 0; return 0; }
    return rz > -3.6 ? crawl : 3;
  }
  if (Math.abs(speed) > 0.02) return 0;
  if (pvTurn(0, dt)) { auto = false; c.done = true; pendingView = true; setCrushReady(true, '再来一辆'); }
  return 0;
}
// the routine's own cameras, standing on the ground by the wreck
const PV_SHOTS = [
  { pos: [17, 3.6, 4], fov: 30, tank: 0.5 }, { pos: [17, 3.6, 4], fov: 30, tank: 0.5 }, { pos: [-15, 2.8, 5], fov: 30, tank: 0.5 },
  { pos: [-11.5, 0.7, 2.6], fov: 28, tank: 0.45 }, { pos: [4.6, 10.5, 8.2], fov: 34, tank: 0.5 }, { pos: [14, 1.3, -10], fov: 28, tank: 0.5 }, { pos: [14, 1.3, -10], fov: 28, tank: 0.5 },
];
const PV_CLOSE = { pos: [7.2, 0.45, -6.6], fov: 26, tank: 0.3 };    // second half of the turn: down at track height
function pvCamera(p, c, dt) {
  const s = p.st === 4 && p.rot > Math.PI ? PV_CLOSE : PV_SHOTS[Math.max(0, p.st)], key = s === PV_CLOSE ? 9 : p.st;
  const cx = c.u + c.X, x = cx + s.pos[0], z = c.z + s.pos[2];
  shotLook.set(cx * (1 - s.tank), s === PV_CLOSE ? 0.5 : 0.75, c.z * (1 - s.tank));
  if (key !== p.camKey) { p.camKey = key; shots.look.copy(shotLook); camera.fov = s.fov; camera.updateProjectionMatrix(); }
  shots.look.lerp(shotLook, 1 - Math.exp(-3 * dt));
  camera.position.set(x, s.pos[1], z); camera.lookAt(shots.look);
  const [jy, jx] = joltStep(dt); camera.rotateY(jy); camera.rotateX(jx);
}


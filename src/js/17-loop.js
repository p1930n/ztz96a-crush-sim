/* ================= loop ================= */
const approach = (v, t, step) => v < t ? Math.min(t, v + step) : Math.max(t, v - step);
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const clock = new THREE.Clock();
let time = 0, exhaustAcc = 0, dustAcc = 0, shake = 0;
const qRock = new THREE.Quaternion(), qBob = new THREE.Quaternion(), axis = new THREE.Vector3(), tmpV = new THREE.Vector3();

let perfLast = 0, perfAvg = 16, perfN = 0;
function perfWatch() {
  const now = performance.now(), d = perfLast ? now - perfLast : 16; perfLast = now;
  if (d > 200 || document.hidden) return;              // a hidden tab or a pause is not a slow device
  perfAvg += (d - perfAvg) * 0.04; perfN++;
  if (perfN < 150 || perfAvg < 30) return;
  perfN = 0; perfAvg = 16;
  if (aoOn) aoOn = false;
  else if (renderer.getPixelRatio() > 1) { renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.25)); resize(); }
}
function tick() {
  perfWatch();
  const rdt = Math.min(clock.getDelta(), 0.05);
  let dt = paused ? 0 : rdt * userRate;
  if (replay.on) dt = replayAdvance(rdt);
  time += dt;

  // turret traverse and gun laying at finite rates
  azCur = approach(azCur, azTarget, 42 * dt);
  elCur = approach(elCur, elTarget, 9 * dt);
  turret.rotation.y = -azCur * DEG;
  gun.rotation.z = elCur * DEG;

  // drive: over a car the driver holds to the crossing speed; either way a 42 t tank takes its time to answer
  if (!replay.on) {
    const close = !!car && car.u < 9 && car.u > -4.5, goal = close ? crawl * car.crawlK : VMAX, pilot = hold ? null : pvPilot(dt);
    if (pilot === null) hull.w = approach(hull.w, 0, 1.4 * dt);
    const vTarget = pilot !== null ? pilot : hold ? hold * goal : auto || driving ? goal : 0, braking = Math.abs(vTarget) < Math.abs(speed) || speed * vTarget < 0;
    speed = approach(speed, vTarget, (braking ? 3.2 : 2.2) * dt);
  }
  const absV = Math.abs(speed);
  if (speed !== 0 || hull.w !== 0) {
    const vR = speed + hull.w * SIDES[0], vL = speed + hull.w * SIDES[1];
    beltPh[0] = (beltPh[0] - vR * dt / LPs[0]) % LINKS; beltPh[1] = (beltPh[1] - vL * dt / LPs[1]) % LINKS;
    for (const s of spinners) s.o.rotation.z -= (s.side > 0 ? vR : vL) * dt / s.r;
    groundTex.offset.x += speed * hull.cy * dt * GROUND_REPEAT / 160; groundTex.offset.y += speed * hull.sy * dt * GROUND_REPEAT / 160;
    markTex.offset.x += speed * dt / 0.155; markTexR.offset.x = markTex.offset.x;
    exhaustAcc += dt * (16 * Math.min(1, absV / VMAX) + 26 * engineLoad); dustAcc += dt * 12 * Math.min(1, (absV + Math.abs(hull.w) * 3) / VMAX);
    while (exhaustAcc > 1) {
      exhaustAcc--;
      const heavy = Math.random() < engineLoad;     // under load the diesel blows thick, dark smoke
      spawn({ pos: exhaustMark.getWorldPosition(tmpV).clone(), vel: new THREE.Vector3(-speed * 0.7 + rand(-0.3, 0.3), rand(0.6, 1.1) * (heavy ? 1.6 : 1), rand(-1.1, -0.5) * (heavy ? 1.8 : 1)), life: rand(1.2, 1.9) * (heavy ? 1.8 : 1), s0: 0.25, s1: rand(1.1, 1.7) * (heavy ? 2 : 1), op: heavy ? 0.34 : 0.3, color: heavy ? SOOT : EXHAUST, drag: 0.8, rise: heavy ? 0.7 : 0.4 });
    }
    while (dustAcc > 1) {
      dustAcc--;
      const m = dustMarks[Math.random() < 0.5 ? 0 : 1];
      spawn({ pos: m.getWorldPosition(tmpV).clone(), vel: new THREE.Vector3(-speed * 0.8 + rand(-0.4, 0.4), rand(0.3, 0.9), rand(-0.5, 0.5)), life: rand(1.1, 1.7), s0: 0.35, s1: rand(1.4, 2.2), op: 0.26, color: DUST, drag: 1.2, rise: 0.1 });
    }
  }

  if (replay.on) { if (speed !== 0 || hull.w !== 0) layTracks(); }
  else if (dt > 0 && (updateCar(dt) || speed !== 0 || hull.w !== 0)) layTracks();
  else if (dt === 0) updateLayers(0, car, 0);

  // the run ends with the tank stopped past the wreck, and the camera goes round what is left
  if (auto && car && car.done && !queue.length && car.u + car.X < -12) { auto = false; pendingView = true; setCrushReady(true, '再来一辆'); }
  if (pendingView && absV < 0.02) { pendingView = false; if (camMode === 'auto' || camMode === 'free') viewWreck(); }

  if (car && car.pv && car.pv.on) markMat.opacity = Math.max(0, markMat.opacity - rdt * 0.8);
  // engine: idles whenever someone is at the controls
  const wantEngine = soundOn && (driving || auto || !!hold || (!!car && !car.done));
  if (wantEngine !== !!rumble && (actx || !wantEngine)) setRumble(wantEngine);
  if (rumble) {
    const t = actx.currentTime, slow = replay.on || userRate < 1 ? 0.55 + 0.45 * userRate : 1;
    rumble.o.frequency.setTargetAtTime(41 * (1 + 0.2 * engineLoad + 0.22 * absV / VMAX) * slow, t, 0.25);
    rumble.o2.frequency.setTargetAtTime(20.5 * (1 + 0.2 * engineLoad + 0.22 * absV / VMAX) * slow, t, 0.25);
    rumble.f.frequency.setTargetAtTime(220 + 180 * engineLoad, t, 0.25);
    rumble.g.gain.setTargetAtTime(paused ? 0.02 : 0.06 + 0.05 * Math.min(1, absV / VMAX) + 0.05 * engineLoad, t, 0.2);
  }

  // firing: flash, recoil, hull rock, reload
  let rock = 0;
  if (fireT >= 0) {
    fireT += dt;
    const f = fireT < 0.09 ? 1 - fireT / 0.09 : 0;
    flashSprite.visible = flashCone.visible = f > 0;
    flashSprite.scale.setScalar(1.6 + 1.6 * (1 - f));
    flashSprite.material.opacity = f; flashCone.material.opacity = f * 0.9;
    flashCone.scale.set(0.6 + (1 - f) * 0.8, 1, 1);
    flashLight.intensity = 5 * Math.max(0, 1 - fireT / 0.18);
    recoil.position.x = fireT < 0.03 ? -0.34 * fireT / 0.03 : -0.34 * (1 - ease((fireT - 0.03) / 0.7));
    rock = 0.03 * Math.exp(-4.2 * fireT) * Math.sin(13 * fireT);
    if (fireT > 4) { fireT = -1; recoil.position.x = 0; flashLight.intensity = 0; }
  }
  if (reload > 0) {
    reload = Math.max(0, reload - dt);
    fireBtn.style.setProperty('--p', (1 - reload / RELOAD).toFixed(3));
    if (reload === 0) { fireBtn.dataset.busy = '0'; fireLbl.textContent = '开火'; fireBtn.style.setProperty('--p', 0); }
  }
  const th = turret.rotation.y;
  axis.set(Math.sin(th), 0, Math.cos(th));               // perpendicular to the gun in the ground plane
  qRock.setFromAxisAngle(axis, rock);
  const k = Math.min(1, absV / VMAX);
  qBob.setFromAxisAngle(tmpV.set(0, 0, 1), k * (0.004 * Math.sin(time * 6.3) + 0.002 * Math.sin(time * 11.1)));
  pivot.quaternion.copy(qRock).multiply(qBob);
  pivot.position.y = 0.85 + k * (0.008 * Math.sin(time * 9.0) + 0.004 * Math.sin(time * 14.7));

  // camera transitions; while the filmed shots run they hold the camera
  if (shots) updateShots(dt);
  else if (camFixed()) updateCam(rdt && dt);
  else if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt / 0.9);
    const e = ease(camAnim.t), A = camAnim.a, Bs = camAnim.b;
    const s = new THREE.Spherical(A.radius + (Bs.radius - A.radius) * e, A.phi + (Bs.phi - A.phi) * e, A.theta + camAnim.dth * e);
    camera.position.copy(controls.target).add(tmpV.setFromSpherical(s));
    if (camAnim.t >= 1) camAnim = null;
  }

  updateParticles(dt);
  if (!shots && !camFixed()) controls.update();
  scene.updateMatrixWorld();
  camoHull.userData.u.uRef.value.copy(body.matrixWorld).invert();
  camoTurret.userData.u.uRef.value.copy(turret.matrixWorld).invert();
  readouts(); updateHud(rdt);
  gradeMat.uniforms.uBars.value += ((shots ? 1 : 0) - gradeMat.uniforms.uBars.value) * (1 - Math.exp(-4 * rdt));
  renderFrame();
  requestAnimationFrame(tick);
}
resize(); goView('iso', true);
requestAnimationFrame(tick);
})();

/* ---------- memory of the crossing: every moment can be gone back to, watched again slowly, or driven on from ---------- */
const rec = { frames: [], events: [], acc: 0 }, replay = { on: false, pos: 0, drag: false, ev: 0, recording: null };
function recReset() { rec.frames.length = 0; rec.events.length = 0; rec.acc = 0; replay.on = false; replay.pos = 0; }
function recFrame(dt, r) {
  rec.acc += dt; if (rec.acc < 1 / 30) return; rec.acc = rec.acc > 2 / 30 ? 0 : rec.acc - 1 / 30;
  if (rec.frames.length >= 2400 || (Math.abs(speed) < 0.01 && !hull.w && Math.abs(hull.vy) < 0.004 && r < 0.002 && !(car.pv && car.pv.on) && !(car.shell && car.shell.awake))) return;
  const c = car, V = c.f.V, v = c.shell ? null : new Uint16Array(GN);
  if (v) for (let n = 0; n < GN; n++) v[n] = Math.min(65535, V[n] * 16000);
  rec.frames.push({ yaw: hull.yaw, hw: hull.w, z: c.z, yawC: c.yawC, pv: !!(c.pv && c.pv.on), pst: c.pv ? c.pv.st : 0, prot: c.pv ? c.pv.rot : 0, u: c.u, X: c.X, vX: c.vX, Y: c.Y, vY: c.vY, th: c.th, w: c.w, ph: c.ph, wr: c.wr, hy: hull.y, hvy: hull.vy, ha: hull.a, hva: hull.va, hr: hull.r, hvr: hull.vr,
    wd: Float32Array.from([...wd[0], ...wd[1]]), Hs: Float32Array.from(c.Hs), V: v, gl: c.glassStage, give: c.give, snapped: c.snapped, lost: c.lost, r, mudL: c.mudL, bagT: c.bagT, alarm: c.alarm, steam: c.steam });
  if (c.shell) shellRec(c, rec.frames[rec.frames.length - 1]);
}
function applyFrame(pos) {
  const F = rec.frames, N = F.length, i = Math.min(N - 1, Math.floor(pos)), t = Math.min(1, pos - i), a = F[i], b = F[Math.min(N - 1, i + 1)], c = car, L = k => a[k] + (b[k] - a[k]) * t;
  hull.yaw = L('yaw'); hull.w = a.hw; hull.cy = Math.cos(hull.yaw); hull.sy = Math.sin(hull.yaw); c.z = L('z'); c.yawC = L('yawC'); if (c.pv) { c.pv.on = a.pv; c.pv.st = a.pst; c.pv.rot = a.prot; }
  c.u = L('u'); c.X = L('X'); c.Y = L('Y'); c.th = L('th'); c.ph = L('ph'); hull.y = L('hy'); hull.a = L('ha'); hull.r = L('hr'); c.lost = L('lost');
  const W = WX.length; for (let q = 0; q < W; q++) { wd[0][q] = a.wd[q] + (b.wd[q] - a.wd[q]) * t; wd[1][q] = a.wd[W + q] + (b.wd[W + q] - a.wd[W + q]) * t; }
  for (let k = 0; k < c.nb; k++) c.Hs[k] = a.Hs[k] + (b.Hs[k] - a.Hs[k]) * t;
  const f = c.f;
  if (c.shell) shellShow(c, a, b, t);
  else for (let n = 0; n < GN; n++) {
    const v = (a.V[n] + (b.V[n] - a.V[n]) * t) / 16000;
    if (Math.abs(v - f.V[n]) > 2e-4) { f.V[n] = v; f.dirty[n] = 1; f.E[n] = v < f.top[n] ? squeezeEps(f.top[n], Math.max(0.02, v)) : 0; }
  }
  setGlass(c, a.gl); c.give = a.give; c.alarm = a.alarm; c.bagT = a.bagT; c.steam = a.steam; c.mudCut.value = c.across ? -9 : a.mudL;
  placeCar(c); if (!c.shell) warpCar(c); updateBags(c);
  return a;
}
function clearDebris() {
  shardO.scale.set(0, 0, 0); shardO.updateMatrix();
  for (let i = 0; i < SHARDS; i++) { shards[i].on = false; shardMesh.setMatrixAt(i, shardO.matrix); }
  for (let i = 0; i < BITS; i++) { bits[i].on = false; bitMesh.setMatrixAt(i, shardO.matrix); }
  shardMesh.instanceMatrix.needsUpdate = true; bitMesh.instanceMatrix.needsUpdate = true;
}
function replayStart(i) {
  if (!car || rec.frames.length < 2) return;
  replay.on = true; replay.pos = i; replay.drag = false; auto = false; hold = 0; pendingView = false;
  replay.ev = rec.events.findIndex(e => e.i > i); if (replay.ev < 0) replay.ev = rec.events.length;
  clearDebris(); setPaused(false); setCrushReady(true, '换一辆');
  if (camMode === 'free') setCam('auto'); else if (camMode === 'auto') startShots();
}
function contactIdx() { const i = rec.frames.findIndex(f => f.lost > 0.005); return Math.max(0, i - 30); }
function replayAdvance(rdt) {
  let dt = paused || replay.drag ? 0 : rdt * userRate;
  const last = rec.frames.length - 1, u0 = car.u, z0 = car.z;
  if (dt) {
    replay.pos = Math.min(last, replay.pos + dt * 30);
    while (replay.ev < rec.events.length && rec.events[replay.ev].i <= replay.pos) { const e = rec.events[replay.ev++]; FX[e.type](e.k); }
  }
  const a = applyFrame(replay.pos), du = (u0 - car.u) * hull.cy + (car.z - z0) * hull.sy;
  if (du) { if (!dt) dt = 1 / 240; speed = du / dt; } else speed = 0;
  const cx = car.u + car.X, relaid = poseTank(car.pv && car.pv.on ? Math.hypot(cx, car.z) < 9.5 : cx > -7.5 && cx < 7.5);
  if (relaid) layTracks();
  scrollOthers(dt);
  updateLayers(dt ? a.r : 0, car, dt);
  if (!replay.drag && !paused && replay.pos >= last) {
    if (replay.recording) stopClip();
    replayResume();
  }
  return dt;
}
function replayResume() {
  const F = rec.frames, i = Math.min(F.length - 1, Math.round(replay.pos)), a = applyFrame(i), c = car;
  Object.assign(hull, { vy: a.hvy, va: a.hva, vr: a.hvr }); c.vX = a.vX; c.vY = a.vY; c.w = a.w; c.wr = a.wr;
  if (c.shell) shellResume(c, F, i);
  F.length = i + 1; rec.events = rec.events.filter(e => e.i <= i);
  c.f.R.fill(Infinity); c.mudCut.value = -9; c.glassStage = a.gl; c.snapped = a.snapped;
  replay.on = false; replay.drag = false; speed = 0;
  c.done = c.pv && c.pv.on ? false : c.u + c.X < -8; hull.w = 0;
  if (shots) setCam('free');
}
tlIn.addEventListener('input', () => { if (!rec.frames.length) return; if (!replay.on) replayStart(+tlIn.value); replay.drag = true; replay.pos = +tlIn.value; });
tlIn.addEventListener('change', () => { replay.drag = false; setPaused(true); });
rplBtn.addEventListener('click', () => { if (replay.on) { replay.pos = rec.frames.length - 1; if (replay.recording) stopClip(); replayResume(); } else { if (userRate === 1) { userRate = 0.25; rateSeg('0.25'); } replayStart(contactIdx()); } });
// the slow replay as a video file: the canvas and the sound as they play
function startClip() {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'], type = types.find(t => MediaRecorder.isTypeSupported(t));
  if (!type) { clipBtn.disabled = true; return; }
  const stream = renderer.domElement.captureStream(60);
  if (audio()) { const d = actx.createMediaStreamDestination(); audioOut.connect(d); stream.addTrack(d.stream.getAudioTracks()[0]); replay.dest = d; }
  const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 14e6 }), parts = [];
  mr.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  mr.onstop = () => {
    if (replay.dest) { audioOut.disconnect(replay.dest); replay.dest = null; }
    stream.getTracks().forEach(t => t.stop());
    const url = URL.createObjectURL(new Blob(parts, { type })), a = document.createElement('a');
    a.href = url; a.download = 'ZTZ-96A-碾压慢放.' + (type.includes('mp4') ? 'mp4' : 'webm'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  if (userRate === 1) { userRate = 0.25; rateSeg('0.25'); }
  replayStart(contactIdx()); mr.start(); replay.recording = mr;
}
function stopClip() { if (replay.recording) { replay.recording.stop(); replay.recording = null; } }
clipBtn.addEventListener('click', () => { if (replay.recording) stopClip(); else startClip(); });


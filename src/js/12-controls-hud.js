/* ---------- the driver's controls ---------- */
function bindSeg(id, on) {
  const g = $(id), bs = g.querySelectorAll('button');
  const set = v => bs.forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === String(v))));
  bs.forEach(b => b.addEventListener('click', () => { set(b.dataset.v); on(b.dataset.v); }));
  return set;
}
// a choice made before the tank has started on the car applies at once; otherwise to the next car
const respawn = () => { if (car && !car.lost && !auto && !hold) spawnCar(); };
bindSeg('#sKind', v => { carKind = v; respawn(); });
bindSeg('#sCount', v => { carCount = +v; respawn(); });
bindSeg('#sMode', v => { carMode = v; respawn(); });
bindSeg('#sPlush', v => { carPlush = v === '1'; respawn(); });
bindSeg('#sTrack', v => setTrackKind(v === 'rubber'));
bindSeg('#sAuto', v => { autoDrive = v === '1'; if (!autoDrive && auto) { auto = false; setCrushReady(true, '换一辆'); } });
const rateSeg = bindSeg('#sRate', v => { userRate = +v; });
const camSeg = bindSeg('#sCam', v => setCam(v));
const pauseBtn = $('#pause'), tlIn = $('#tl'), tlOut = $('#tlOut'), rplBtn = $('#rpl'), clipBtn = $('#clip'), wreckBtn = $('#wreck'), ghostBtn = $('#ghost');
function setPaused(on) { paused = on; pauseBtn.setAttribute('aria-pressed', String(on)); pauseBtn.textContent = on ? '继续' : '暂停'; }
pauseBtn.addEventListener('click', () => setPaused(!paused));
$('#crawl').addEventListener('input', e => { crawl = +e.target.value; $('#crawlOut').textContent = crawl.toFixed(1) + ' m/s'; });
function press(dir) {
  if (replay.on) replayResume();             // driving from a rewound moment carries on from there
  if (auto) { auto = false; setCrushReady(true, '换一辆'); }
  if (paused) setPaused(false);
  pendingView = false; hold = dir; audio();
  $('#pFwd').dataset.on = dir > 0 ? '1' : '0'; $('#pRev').dataset.on = dir < 0 ? '1' : '0';
}
function release(dir) { if (hold === dir) { hold = 0; $('#pFwd').dataset.on = '0'; $('#pRev').dataset.on = '0'; } }
[['#pFwd', 1], ['#pRev', -1]].forEach(([id, dir]) => {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(dir); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, () => release(dir)));
  b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); press(dir); } });
  b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') release(dir); });
  b.addEventListener('blur', () => release(dir));
});
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'w') release(1); else if (k === 's') release(-1); });
window.addEventListener('blur', () => { hold = 0; $('#pFwd').dataset.on = '0'; $('#pRev').dataset.on = '0'; });
const tabRig = $('#tabRig'), tabGun = $('#tabGun');
[[tabRig, true], [tabGun, false]].forEach(([b, rig]) => b.addEventListener('click', () => {
  $('#rig').hidden = !rig; $('#gunpane').hidden = rig; tabRig.setAttribute('aria-selected', String(rig)); tabGun.setAttribute('aria-selected', String(!rig));
}));

/* ---------- what the viewer is told ---------- */
const STAGES = ['引擎盖下陷', 'A 柱弯折', '车顶折叠', '玻璃炸开', '车门外鼓', '爆胎', '底盘触地', '毛绒玩具爆棉', '顶到发动机'], MODE_NAME = { side: '单侧', centre: '骑中', across: '横向', pivot: '横压旋转' };
const hLog = $('#hLog'); STAGES.forEach(n => { const li = document.createElement('li'); li.innerHTML = '<span></span><i>—</i>'; li.firstChild.textContent = n; hLog.append(li); });
function hudLog(clear) {
  STAGES.forEach((n, i) => { const li = hLog.children[i], t = !clear && car && car.st[i] != null ? car.st[i] : null; li.dataset.on = t == null ? '0' : '1'; li.lastChild.textContent = t == null ? '—' : t.toFixed(2) + ' s'; });
}
const pressedIn = (f, L) => {
  const q = f.pressOf && f.pressOf.get(L);     // on a shell: how far the structure itself has come down, not its height read off a grid
  if (q) { const S = q.S, Y = q.Y; let p = 0; for (const i of q.nodes) { const d = Y[i * 3 + 1] - S.p[i * 3 + 1]; if (d > p) p = d; } return p; }
  let p = 0; for (const n of L) { const d = f.real[n] - f.V[n]; if (d > p) p = d; } return p;
};
function checkStages(c) {
  if (c.t0 < 0) { if (c.lost > 0.01) c.t0 = time; else return; }
  const f = c.f, mark = i => { if (c.st[i] == null) { c.st[i] = time - c.t0; hudLog(); } };
  if (pressedIn(f, f.hoodN) > 0.06) mark(0);
  if (pressedIn(f, f.pillarN) > 0.1) mark(1);
  if (c.give > 0.6) mark(2);
  if (c.glassStage >= 2) mark(3);
  if (pressedIn(f, f.doorN) > 0.12) mark(4);
  if (c.popped) mark(5);
  if (c.stuffed) mark(7);
  if (c.st[8] == null && (c.shell ? c.shell.engine.reduce((q, i) => q + c.shell.S.p[i * 3 + 1], 0) / c.shell.engine.length < c.shell.engY0 - 0.03 : c.engN.some(n => f.V[n] <= c.hardF[n] + 0.02))) { mark(8); fx('bottom', 1); fx('thump', 1); shake = Math.max(shake, 0.02); }
  const fl = floorOf(c) + 0.015;
  for (let k = 0; k < c.nb; k++) if (!c.over[k] && c.Hs[k] <= fl && c.floorMark[k] !== c.pass + 1) {
    c.floorMark[k] = c.pass + 1; mark(6);
    if (time - c.bottomT > 0.45) { c.bottomT = time; fx('bottom', 1); shake = Math.max(shake, 0.008); }
  }
}
let hudT = 0, hudLoadT = 0;
function updateHud(rdt) {
  hudT -= rdt; if (hudT > 0) return; hudT = 0.12;
  const n = rec.frames.length;
  tlIn.disabled = n < 2; rplBtn.disabled = n < 2; clipBtn.disabled = n < 2 || !window.MediaRecorder;
  rplBtn.textContent = replay.on ? '回到实时' : '回放';
  clipBtn.textContent = replay.recording ? '停止录制' : '录慢放视频';
  if (n) { tlIn.max = n - 1; if (!replay.drag) tlIn.value = replay.on ? Math.round(replay.pos) : n - 1; tlOut.textContent = ((+tlIn.value) / 30).toFixed(1) + ' s'; }
  const c = car; if (!c) return;
  const f = c.f; let h = 0;
  for (let k = 0; k < GN; k++) if (f.real[k] > 0) { const q = Math.min(f.real[k], f.V[k]); if (q > h) h = q; }
  let lowB = 9; for (let k = 0; k < c.nb; k++) if (!c.over[k] && c.Hs[k] < lowB) lowB = c.Hs[k];
  $('#hKind').textContent = c.V.name + ' · ' + MODE_NAME[c.modeKey];
  $('#hFps').textContent = Math.round(1000 / perfAvg) + ' FPS · 物理 ' + shCost.toFixed(1) + ' ms';
  $('#hTop').textContent = f.h0.toFixed(2) + ' → ' + h.toFixed(2) + ' m';
  $('#hBand').textContent = c.nb ? lowB.toFixed(2) + ' m' : '履带未压到';
  $('#hVol').textContent = Math.round(c.lost / f.vol * 100) + ' %';
  hudLoadT += ((replay.on ? 0 : carLoad / GRAV * 42.8) - hudLoadT) * 0.35; const t = hudLoadT; if (t > c.peak && !replay.on) c.peak = t;
  $('#hLoad').textContent = c.nb ? t.toFixed(1) + ' t · 峰值 ' + c.peak.toFixed(1) + ' t' : '车腹压过';
  $('#hPop').textContent = c.popped + ' / 4 · 第 ' + (c.pass + 1) + ' 遍';
}


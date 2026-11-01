/* ================= state & controls ================= */
let azTarget = 0, elTarget = 0, azCur = 0, elCur = 0;
let driving = false, speed = 0; const VMAX = 4.2;
let soundOn = true, fireT = -1, reload = 0; const RELOAD = 2.3;
const fireBtn = $('#fire'), fireLbl = $('#fireLbl'), azIn = $('#az'), elIn = $('#el'), azOut = $('#azOut'), elOut = $('#elOut');
const driveBtn = $('#drive'), spinBtn = $('#spin'), soundBtn = $('#sound');

function setSpin(on) { controls.autoRotate = on; spinBtn.setAttribute('aria-pressed', String(on)); }
setSpin(!reduceMotion);
controls.addEventListener('start', () => { if (controls.autoRotate) setSpin(false); });
spinBtn.addEventListener('click', () => setSpin(!controls.autoRotate));
driveBtn.addEventListener('click', () => { driving = !driving; driveBtn.setAttribute('aria-pressed', String(driving)); audio(); });
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn; soundBtn.setAttribute('aria-pressed', String(soundOn));
});
azIn.addEventListener('input', () => azTarget = +azIn.value);
elIn.addEventListener('input', () => elTarget = +elIn.value);
document.querySelectorAll('.paint button').forEach(b => b.addEventListener('click', () => setPaint(b.dataset.paint)));
setPaint('wood');

function fire() {
  if (reload > 0) return;
  reload = RELOAD; fireT = 0;
  fireBtn.dataset.busy = '1'; fireLbl.textContent = '装填中';
  scene.updateMatrixWorld();
  const pos = muzzle.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(1, 0, 0).transformDirection(muzzle.matrixWorld);
  flashSprite.position.copy(pos).addScaledVector(dir, 0.35);
  flashLight.position.copy(pos).addScaledVector(dir, 0.5);
  for (let i = 0; i < 16; i++) {
    const v = dir.clone().multiplyScalar(rand(2, 11)).add(new THREE.Vector3(rand(-1.4, 1.4), rand(-0.6, 1.4), rand(-1.4, 1.4)));
    spawn({ pos: pos.clone().addScaledVector(dir, rand(0.2, 1.2)), vel: v, life: rand(2.0, 3.4), s0: 0.5, s1: rand(2.4, 3.8), op: 0.55, color: SMOKE, drag: 1.6, rise: 0.35 });
  }
  const gp = pos.clone(); gp.y = 0.25;
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2);
    spawn({ pos: gp.clone().addScaledVector(dir, rand(0, 1.5)), vel: new THREE.Vector3(Math.cos(a) * rand(2, 5), rand(0.3, 1.2), Math.sin(a) * rand(2, 5)), life: rand(1.4, 2.4), s0: 0.6, s1: rand(2, 3.2), op: 0.35, color: DUST, drag: 2.2, rise: 0.1 });
  }
  boom();
}
fireBtn.addEventListener('click', fire);

window.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const kk = e.key.toLowerCase();
  if ((kk === 'w' || kk === 's') && !e.repeat) { press(kk === 'w' ? 1 : -1); return; }
  if (kk === 'p' && !e.repeat) { setPaused(!paused); return; }
  if (kk >= '1' && kk <= '6' && !e.repeat) { setCam(['auto', 'free', 'low', 'track', 'top', 'inside'][+kk - 1]); return; }
  if (tag === 'INPUT' || tag === 'BUTTON') return;
  if (e.key === ' ' || e.key === 'f' || e.key === 'F') { e.preventDefault(); fire(); }
  else if (e.key === 'ArrowLeft') { azTarget = Math.max(-180, azTarget - 5); azIn.value = azTarget; e.preventDefault(); }
  else if (e.key === 'ArrowRight') { azTarget = Math.min(180, azTarget + 5); azIn.value = azTarget; e.preventDefault(); }
  else if (e.key === 'ArrowUp') { elTarget = Math.min(12, elTarget + 1); elIn.value = elTarget; e.preventDefault(); }
  else if (e.key === 'ArrowDown') { elTarget = Math.max(-5, elTarget - 1); elIn.value = elTarget; e.preventDefault(); }
  else if (e.key === 'd' || e.key === 'D') driveBtn.click();
});

/* camera views */
let fit = 1;
const VIEWS = { iso: [9.5, 5.0, 10.5], side: [0.2, 2.4, 15.2], front: [15.2, 2.8, 0.02], top: [0.3, 15.5, 0.02], crush: [6.5, 3.4, 13.2] };
let camAnim = null;
function goView(key, instant) {
  controls.minDistance = 6; controls.maxDistance = 36; controls.maxPolarAngle = 1.47;
  const to = new THREE.Vector3(...VIEWS[key]).multiplyScalar(fit);
  const a = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const b = new THREE.Spherical().setFromVector3(to);
  let dth = b.theta - a.theta; while (dth > Math.PI) dth -= Math.PI * 2; while (dth < -Math.PI) dth += Math.PI * 2;
  if (instant) { camera.position.copy(controls.target).add(to); return; }
  camAnim = { a, b, dth, t: 0 };
}
document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => { setSpin(false); setCam('free'); controls.target.copy(TARGET); goView(b.dataset.view); }));

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); sizeTargets(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  return w / h;
}
let framed = false;
new ResizeObserver(() => {
  const asp = resize(); if (!asp) return;
  if (!framed) { framed = true; fit = Math.min(1.75, Math.max(1, 1.3 / asp)); goView('iso', true); controls.update(); }
}).observe(stage);

/* readouts */
const pad = (n, w) => String(Math.abs(n)).padStart(w, '0');
function mils(deg) { const m = Math.round(((deg % 360) + 360) % 360 / 360 * 6000) % 6000; return Math.floor(m / 100) + '-' + pad(m % 100, 2); }
let lastAz = null, lastEl = null;
function readouts() {
  const a = Math.round(azCur), e = Math.round(elCur * 10) / 10;
  if (a !== lastAz) { lastAz = a; azOut.textContent = (a < 0 ? '−' : '+') + pad(a, 3) + '° · ' + mils(a) + ' 密位'; }
  if (e !== lastEl) { lastEl = e; elOut.textContent = (e < 0 ? '−' : '+') + Math.abs(e).toFixed(1) + '°'; }
}



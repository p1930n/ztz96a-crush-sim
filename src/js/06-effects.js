/* ================= effects ================= */
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
const puffTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
const flashTex = radialTex([[0, 'rgba(255,255,240,1)'], [0.2, 'rgba(255,214,120,.95)'], [0.5, 'rgba(255,130,40,.45)'], [1, 'rgba(255,90,20,0)']]);
const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
flashSprite.visible = false; scene.add(flashSprite);
const flashLight = new THREE.PointLight(0xffa14a, 0, 14, 2); scene.add(flashLight);

const pool = [];
function spawn(o) {
  let p = pool.find(q => !q.alive);
  if (!p) {
    if (pool.length >= 160) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false }));
    scene.add(s); p = { s }; pool.push(p);
  }
  p.alive = true; p.age = 0; p.life = o.life; p.vel = o.vel.clone(); p.s0 = o.s0; p.s1 = o.s1;
  p.op = o.op; p.drag = o.drag || 1.2; p.rise = o.rise || 0.3;
  p.s.position.copy(o.pos); p.s.material.color.copy(o.color); p.s.material.rotation = Math.random() * 6.28;
  p.s.visible = true; p.s.scale.setScalar(o.s0); p.s.material.opacity = 0;
}
function updateParticles(dt) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dt; const t = p.age / p.life;
    if (t >= 1) { p.alive = false; p.s.visible = false; continue; }
    p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.vel.y += p.rise * dt;
    p.s.position.addScaledVector(p.vel, dt);
    p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - t, 2.2)));
    p.s.material.opacity = p.op * Math.min(1, t * 12) * Math.pow(1 - t, 1.6);
  }
}
const rand = (a, b) => a + Math.random() * (b - a);
const SMOKE = lin('#a3a39a'), EXHAUST = lin('#3d3c36'), DUST = lin('#c2a882'), DUSTLIT = lin('#e3c79b'), SOOT = lin('#57534d');


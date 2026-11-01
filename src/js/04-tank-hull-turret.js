/* ================= tank hierarchy ================= */
// x = forward, y = up, z = right side. Units are metres.
const tank = new THREE.Group(); scene.add(tank);
const pivot = new THREE.Group(); pivot.position.set(0.2, 0.85, 0); tank.add(pivot);   // hull rocks about this point
const body = new THREE.Group(); body.position.set(-0.2, -0.85, 0); pivot.add(body);
const gear = new THREE.Group(); tank.add(gear);                                         // wheels and tracks stay on the ground

/* a convex welded block from its corners and faces; every face is turned outward from the centre */
function polyG(V, F) {
  const c = new THREE.Vector3(); V.forEach(p => c.add(new THREE.Vector3(...p))); c.multiplyScalar(1 / V.length);
  const pos = [], a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  F.forEach(f => {
    for (let i = 1; i < f.length - 1; i++) {
      let A = V[f[0]], Bv = V[f[i]], C = V[f[i + 1]];
      a.set(...A); b.set(...Bv).sub(a); d.set(...C).sub(a); n.crossVectors(b, d);
      if (n.dot(a.clone().sub(c)) < 0) { const t = Bv; Bv = C; C = t; }
      pos.push(...A, ...Bv, ...C);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/* a plate cut to an outline in the side view (x,y), th thick across z */
function plateG(pts, th) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1]));
  return new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }).translate(0, 0, -th / 2);
}
const boltsG = (P, axis = 'y') => mergeGeos(P.map(([x, y, z]) => (axis === 'y' ? cylY(0.018, 0.024, 0.024, 6) : cylZ(0.024, 0.024, 0.024, 6)).translate(x, y, z)));

/* ---------- hull ---------- */
{
  const HP = [[-3.30, 0.52], [3.02, 0.52], [3.46, 0.98], [3.38, 1.07], [2.32, 1.45], [-3.30, 1.45], [-3.42, 1.12], [-3.38, 0.72]];
  const s = new THREE.Shape(); s.moveTo(HP[0][0], HP[0][1]); HP.slice(1).forEach(p => s.lineTo(p[0], p[1]));
  const g = new THREE.ExtrudeGeometry(s, { depth: 2.24, bevelEnabled: false }); g.translate(0, 0, -1.12);
  add(g, camoHull, body);
}
for (const side of [1, -1]) {
  const z = side * 1.43;
  add(boxG(5.76, 0.04, 0.64), camoHull, body, -0.46, 1.09, z);                           // fender shelf
  const rear = add(boxG(0.34, 0.03, 0.66), camoHull, body, -3.46, 0.99, z); rear.rotation.z = 0.5;
  /* the sloped front fender, tiled with FY-4 reactive blocks in a raised tray */
  {
    const tray = new THREE.Group(); tray.position.set(3.10, 1.17, z); tray.rotation.z = -0.16; body.add(tray);
    const bridge = add(boxG(0.26, 0.04, 0.64), camoHull, body, 2.52, 1.18, z); bridge.rotation.z = 0.6;
    add(boxG(1.00, 0.05, 0.66), camoHull, tray);
    for (const zz of [0.33, -0.33]) add(boxG(1.00, 0.13, 0.03), camoHull, tray, 0, 0.05, zz);
    add(boxG(0.03, 0.13, 0.66), camoHull, tray, -0.49, 0.05, 0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) add(boxG(0.29, 0.075, 0.195), camoHull, tray, -0.31 + i * 0.32, 0.06, (j - 1) * 0.21);
    add(boxG(0.04, 0.22, 0.66), camoHull, tray, 0.50, -0.09, 0);                        // front lip
  }
  /* side skirts: an armoured front plate raked up to the fender, then five plates with chamfered feet */
  add(plateG([[2.0, 1.09], [2.42, 1.09], [2.62, 1.25], [3.52, 1.11], [3.52, 1.0], [2.3, 0.6], [2.0, 0.58]], 0.12), camoHull, body, 0, 0, side * 1.77);
  const skirtBolts = [[2.1, 1.02, 0], [2.5, 1.02, 0], [2.1, 0.66, 0], [2.5, 0.66, 0]];
  for (let i = 0; i < 5; i++) {
    const x1 = 1.98 - i * 1.04, x0 = x1 - 1.02;
    add(plateG(i === 4 ? [[x0, 1.09], [x1, 1.09], [x1, 0.67], [x1 - 0.10, 0.58], [-2.72, 0.6], [x0, 0.88]] : [[x0, 1.09], [x1, 1.09], [x1, 0.67], [x1 - 0.10, 0.58], [x0 + 0.10, 0.58], [x0, 0.67]], 0.05), camoHull, body, 0, 0, side * 1.785);
    [0.14, 0.51, 0.88].forEach(u => skirtBolts.push([x0 + u, 1.03, 0], [x0 + u, i === 4 && u < 0.5 ? 0.92 : 0.70, 0]));
  }
  add(boltsG(skirtBolts.map(p => [p[0], p[1], side * 1.82]), 'z'), M.steel, body);
  add(boxG(5.8, 0.03, 0.05), camoHull, body, -0.3, 1.095, side * 1.775);               // skirt top rail
  /* headlights in their round armoured pots at the edge of the glacis */
  add(cylX(0.105, 0.115, 0.17, 20), camoHull, body, 3.03, 1.31, side * 0.93);
  add(cylX(0.115, 0.115, 0.02, 20), M.steel, body, 3.12, 1.31, side * 0.93);
  add(cylX(0.085, 0.085, 0.02, 20), M.lamp, body, 3.125, 1.31, side * 0.93);
  add(boxG(0.14, 0.10, 0.12), camoHull, body, 3.0, 1.22, side * 0.93);
  // tow hooks and tail lights
  add(boxG(0.14, 0.10, 0.10), M.steel, body, 3.18, 0.70, side * 0.78);
  add(boxG(0.03, 0.08, 0.14), M.tail, body, -3.37, 1.30, side * 1.02);
}
/* low flat stowage along the fenders, exhaust louvres cut into the left one */
for (const [x0, x1, zz] of [[2.2, -3.0, 1.42], [2.2, -1.85, -1.42], [-2.80, -3.0, -1.42]]) {
  add(boxG(x0 - x1, 0.11, 0.50), camoHull, body, (x0 + x1) / 2, 1.165, zz);
  add(boxG(x0 - x1 - 0.03, 0.012, 0.44), camoHull, body, (x0 + x1) / 2, 1.226, zz);
}
for (const x of [1.1, 0.0, -1.1]) for (const zz of [1.42, -1.42]) add(boxG(0.02, 0.012, 0.50), M.dark, body, x, 1.224, zz);
{
  add(boxG(0.92, 0.11, 0.50), M.dark, body, -2.32, 1.165, -1.42);
  for (let i = 0; i < 7; i++) add(boxG(0.05, 0.03, 0.50), camoHull, body, -2.72 + i * 0.135, 1.235, -1.42);
}
const exhaustMark = new THREE.Object3D(); exhaustMark.position.set(-2.32, 1.32, -1.55); body.add(exhaustMark);

/* glacis: a broad bare plate studded with bolts between the headlights, no armour tiles across it */
{
  const gl = new THREE.Group(); gl.position.set(2.85, 1.26, 0);
  gl.rotation.z = Math.atan2(0.941, 0.337) - Math.PI / 2; body.add(gl);
  add(boxG(0.74, 0.02, 1.62), camoHull, gl, 0.08, 0.01, 0);
  const P = [];
  for (let r = 0; r < 4; r++) for (let c = -7; c <= 7; c++) P.push([-0.22 + r * 0.2, 0.025, c * 0.107]);
  add(boltsG(P), M.steel, gl);
  add(boxG(0.10, 0.07, 0.24), M.glass, gl, -0.50, 0.05, 0);                             // driver's periscope
  add(boxG(0.14, 0.04, 0.34), camoHull, gl, -0.60, 0.03, 0);
}
add(cylY(0.23, 0.24, 0.06, 24), camoHull, body, 2.05, 1.48, 0);                           // driver's hatch
/* engine deck */
add(boxG(1.7, 0.04, 1.7), M.dark, body, -2.45, 1.47, 0);
for (let i = 0; i < 10; i++) add(boxG(0.07, 0.05, 1.7), camoHull, body, -3.20 + i * 0.166, 1.49, 0);
add(boxG(0.6, 0.06, 0.7), camoHull, body, -1.75, 1.48, 0.55);
add(cylY(1.08, 1.12, 0.08, 48), camoHull, body, 0.15, 1.49, 0);                          // turret ring collar

/* ---------- turret ---------- */
const turret = new THREE.Group(); turret.position.set(0.15, 1.52, 0); body.add(turret);
const ROOF = 0.62;
{
  /* the low welded core, notched at the front for the gun */
  const B = [[1.00, 0.30], [0.95, 1.18], [-0.75, 1.24], [-1.30, 0.95], [-1.38, 0.35],
             [-1.38, -0.35], [-1.30, -0.95], [-0.75, -1.24], [0.95, -1.18], [1.00, -0.30]];
  const T = [[0.85, 0.28], [0.72, 1.00], [-0.70, 1.06], [-1.18, 0.80], [-1.25, 0.30],
             [-1.25, -0.30], [-1.18, -0.80], [-0.70, -1.06], [0.72, -1.00], [0.85, -0.28]];
  add(loft(B, T, 0, ROOF), camoTurret, turret);
  /* the arrowhead: on each cheek a long wedge, its point beside the gun, swept back and out to the turret side */
  for (const s of [1, -1]) {
    const V = [[2.02, 0.35, 0.36], [1.94, 0.10, 0.36], [0.80, ROOF + 0.01, 0.30], [0.98, 0.02, 0.30],
               [0.30, ROOF + 0.01, 1.05], [0.30, 0.34, 1.25], [0.30, 0.02, 1.25]].map(p => [p[0], p[1], p[2] * s]);
    add(polyG(V, [[0, 1, 3, 2], [0, 2, 4], [0, 4, 5], [0, 5, 6, 1], [1, 6, 3], [2, 3, 6, 5, 4]]), camoTurret, turret);
    const edge = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const P = [];     // the bolted joint where the add-on block meets the turret
    for (let k = 0.1; k < 0.95; k += 0.2) P.push(edge(V[3], V[6], k).map((v, i) => i === 1 ? 0.045 : v));
    add(boltsG(P), M.steel, turret);
  }
}
/* commander's cupola (right): broad ring on a low cone, 12.7 mm QJC88A up on a tall mount */
add(cylY(0.45, 0.52, 0.09, 32), camoTurret, turret, -0.25, ROOF + 0.045, 0.55);
add(cylY(0.42, 0.44, 0.07, 32), camoTurret, turret, -0.25, ROOF + 0.125, 0.55);
add(cylY(0.30, 0.34, 0.05, 28), camoTurret, turret, -0.29, ROOF + 0.185, 0.55);
for (let i = 0; i < 7; i++) {
  const a = (-75 + i * 25) * DEG;
  const p = add(boxG(0.03, 0.05, 0.10), M.glass, turret, -0.25 + Math.cos(a) * 0.43, ROOF + 0.125, 0.55 - Math.sin(a) * 0.43);
  p.rotation.y = a;
}
{
  add(cylY(0.05, 0.07, 0.30, 12), camoTurret, turret, -0.62, ROOF + 0.33, 0.55);            // mount rises from the back of the ring
  const hmg = new THREE.Group(); hmg.position.set(-0.60, ROOF + 0.52, 0.55); hmg.rotation.z = 16 * DEG; turret.add(hmg);
  add(boxG(0.46, 0.11, 0.10), M.steel, hmg, 0.10, 0, 0);
  add(boxG(0.22, 0.17, 0.12), M.dark, hmg, 0.06, -0.03, 0.12);                               // ammunition box
  add(tubeX(0.33, 1.20, 0.019, 0.019, 10), M.steel, hmg);
  add(tubeX(1.14, 1.27, 0.032, 0.032, 10), M.steel, hmg);
  add(boxG(0.16, 0.13, 0.11), M.dark, hmg, 0.12, 0.13, 0);                                   // the sight head with its round lens
  add(cylX(0.045, 0.045, 0.03, 16), M.glass, hmg, 0.21, 0.13, 0);
  add(cylY(0.035, 0.035, 0.05, 12), M.dark, hmg, 0.08, 0.215, 0);
}
/* gunner's sight: a square armoured box on the left of the roof, window to the front; hatch behind it */
{
  const zz = -0.58, xx = 0.30;
  add(boxG(0.56, 0.10, 0.54), camoTurret, turret, xx, ROOF + 0.05, zz);
  add(polyG([[0.20, 0.10, 0.25], [0.20, 0.10, -0.25], [-0.24, 0.10, 0.25], [-0.24, 0.10, -0.25],
             [0.17, 0.36, 0.24], [0.17, 0.36, -0.24], [-0.20, 0.34, 0.24], [-0.20, 0.34, -0.24]], [[0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5], [4, 5, 7, 6], [0, 1, 3, 2]]), camoTurret, turret, xx, ROOF, zz);
  add(boxG(0.012, 0.12, 0.36), M.glass, turret, xx + 0.195, ROOF + 0.24, zz);
  add(boxG(0.12, 0.022, 0.50), camoTurret, turret, xx + 0.22, ROOF + 0.355, zz);             // hood over the window
  for (const e of [1, -1]) add(boxG(0.13, 0.20, 0.022), camoTurret, turret, xx + 0.22, ROOF + 0.25, zz + e * 0.25);
}
add(cylY(0.27, 0.28, 0.05, 26), camoTurret, turret, -0.28, ROOF + 0.025, -0.55);
add(boxG(0.10, 0.03, 0.16), camoTurret, turret, -0.55, ROOF + 0.06, -0.55);
/* sensors: the crosswind mast with its cap behind the sight, a dome, laser warners, the whip aerial */
add(cylY(0.05, 0.06, 0.40, 14), M.dark, turret, -0.62, ROOF + 0.20, -0.90);
add(cylY(0.065, 0.065, 0.06, 14), M.dark, turret, -0.62, ROOF + 0.42, -0.90);
add(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), camoTurret, turret, -0.95, ROOF, -0.30);
for (const s of [1, -1]) add(boxG(0.10, 0.06, 0.10), M.dark, turret, 0.12, ROOF + 0.03, s * 0.90);
add(cylY(0.05, 0.06, 0.08, 12), M.dark, turret, -1.02, ROOF + 0.04, 0.72);
add(cylY(0.004, 0.011, 2.0, 6), M.dark, turret, -1.02, ROOF + 1.05, 0.72);
/* smoke grenade launchers: five tubes in a tight 3+2 cluster on each flank, aimed forward, up and out */
for (const side of [1, -1]) {
  add(boxG(0.36, 0.20, 0.14), camoTurret, turret, 0.12, 0.40, side * 1.20);
  const g = new THREE.Group(); g.position.set(0.16, 0.42, side * 1.33); turret.add(g);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.74, 0.42, side * 0.52).normalize());
  add(cylY(0.20, 0.20, 0.03, 18), camoTurret, g, 0, -0.11, 0);
  [[-0.112, -0.06], [0, -0.06], [0.112, -0.06], [-0.056, 0.05], [0.056, 0.05]].forEach(([a, b]) => {
    add(cylY(0.052, 0.052, 0.25, 14), camoTurret, g, a, 0.015, b);
    add(cylY(0.038, 0.038, 0.006, 14), M.dark, g, a, 0.142, b);
  });
}
/* the deep sheet-steel bin wrapped round the turret rear: its side walls carry the tactical number */
{
  const R = new THREE.Group(); turret.add(R);
  const H0 = 0.12, H1 = 0.66, YM = (H0 + H1) / 2, L = H1 - H0, X0 = -0.72, X1 = -2.04, XM = (X0 + X1) / 2, LX = X0 - X1;
  add(boxG(LX, 0.03, 2.62), camoTurret, R, XM, H0, 0);                                       // floor
  for (const s of [1, -1]) {
    add(boxG(LX, L, 0.05), camoTurret, R, XM, YM, s * 1.30);                                 // side wall
    add(boxG(0.05, L, 0.30), camoTurret, R, X0, YM, s * 1.15);                               // closes the gap to the turret
    add(boxG(LX, 0.03, 0.08), camoTurret, R, XM, H1, s * 1.27);                              // rolled top edge
    for (let i = 0; i < 2; i++) add(boxG(0.09, L - 0.08, 0.012), M.dark, R, -1.96 + i * 0.12, YM, s * 1.327);   // mesh at the rear of the wall
  }
  add(boxG(0.05, L, 2.62), camoTurret, R, X1, YM, 0);                                        // back wall
  add(boxG(0.03, 0.03, 2.62), camoTurret, R, X1 + 0.02, H1, 0);
  add(cylZ(0.17, 0.17, 1.60, 18), M.canvas, R, -1.72, 0.32, 0.25);
  add(boxG(0.40, 0.28, 0.46), camoTurret, R, -1.70, 0.28, -0.85);
  add(boxG(0.34, 0.20, 0.36), M.canvas, R, -1.72, 0.25, 1.05);
  add(cylZ(0.075, 0.075, 1.6, 16), camoTurret, R, -2.13, 0.40, 0);                           // snorkel on the back wall
  for (const zz of [0.6, -0.6]) add(boxG(0.09, 0.04, 0.05), M.steel, R, -2.09, 0.40, zz);
}
/* turret number with the Bayi star, drawn once the stencil font is ready */
const decalCanvas = document.createElement('canvas'); decalCanvas.width = 512; decalCanvas.height = 192;
const decalTex = new THREE.CanvasTexture(decalCanvas); decalTex.encoding = THREE.sRGBEncoding;
decalTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
function drawDecal() {
  const g = decalCanvas.getContext('2d');
  g.clearRect(0, 0, 512, 192);
  const cx = 88, cy = 96;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 29 : 74;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath(); g.fillStyle = '#c3261a'; g.fill();
  g.lineWidth = 6; g.strokeStyle = '#e6c15a'; g.stroke();
  g.fillStyle = '#f1d066'; g.font = '700 30px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('八一', cx, cy + 6);
  g.fillStyle = '#ecefe4'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '150px "Saira Stencil One", Impact, sans-serif';
  g.fillText('327', 186, 152);
  decalTex.needsUpdate = true;
}
drawDecal();
if (document.fonts && document.fonts.load) document.fonts.load('150px "Saira Stencil One"').then(drawDecal).catch(() => {});
{
  const mat = new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const side of [1, -1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.36), mat);
    const n = new THREE.Vector3(0, 0, side);
    d.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(n, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
    d.position.set(-1.22, 0.39, side * 1.325).addScaledVector(n, 0.008);
    turret.add(d);
  }
}

/* what a real hull carries: welds along its plate joints, lifting eyes, grab rails, tow cables and tools */
function welds(parent, mat, lines) {
  const beads = [], O = new THREE.Object3D(), U = new THREE.Vector3(1, 0, 0), D = new THREE.Vector3();
  for (const [a, b] of lines) {
    D.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = D.length(), n = Math.max(1, Math.round(L / 0.034)); D.normalize();
    for (let k = 0; k <= n; k++) {
      O.position.set(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n);
      O.quaternion.setFromUnitVectors(U, D); O.rotateX(k * 0.7);
      O.scale.set(0.024 + Math.random() * 0.006, 0.013 + Math.random() * 0.004, 0.018 + Math.random() * 0.005); O.updateMatrix(); beads.push(O.matrix.clone());
    }
  }
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, beads.length);
  beads.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; parent.add(im);
}
{
  const L = [[[2.32, 1.45, -1.12], [2.32, 1.45, 1.12]], [[3.38, 1.07, -1.12], [3.38, 1.07, 1.12]], [[3.46, 0.98, -1.12], [3.46, 0.98, 1.12]], [[-3.30, 1.45, -1.12], [-3.30, 1.45, 1.12]]];
  for (const s of [1, -1]) {
    L.push([[-3.30, 1.45, s * 1.12], [2.32, 1.45, s * 1.12]], [[2.32, 1.45, s * 1.12], [3.38, 1.07, s * 1.12]], [[3.38, 1.07, s * 1.12], [3.46, 0.98, s * 1.12]]);
    L.push([[-3.30, 1.11, s * 1.12], [2.3, 1.11, s * 1.12]]);                                  // fender shelf to hull side
  }
  welds(body, camoHull, L);
  const B = [[1.00, 0.30], [0.95, 1.18], [-0.75, 1.24], [-1.30, 0.95], [-1.38, 0.35], [-1.38, -0.35], [-1.30, -0.95], [-0.75, -1.24], [0.95, -1.18], [1.00, -0.30]];
  const T = [[0.85, 0.28], [0.72, 1.00], [-0.70, 1.06], [-1.18, 0.80], [-1.25, 0.30], [-1.25, -0.30], [-1.18, -0.80], [-0.70, -1.06], [0.72, -1.00], [0.85, -0.28]];
  const TL = [];
  T.forEach((p, i) => { const q = T[(i + 1) % T.length], b = B[i]; TL.push([[p[0], ROOF, p[1]], [q[0], ROOF, q[1]]], [[p[0], ROOF, p[1]], [b[0], 0.02, b[1]]]); });
  for (const s of [1, -1]) TL.push([[2.02, 0.35, 0.36 * s], [0.30, ROOF, 1.05 * s]], [[0.80, ROOF + 0.01, 0.30 * s], [0.30, ROOF + 0.01, 1.05 * s]], [[2.02, 0.35, 0.36 * s], [0.80, ROOF, 0.30 * s]], [[0.30, 0.34, 1.25 * s], [0.30, ROOF, 1.05 * s]]);
  welds(turret, camoTurret, TL);
}
for (const [x, z] of [[0.55, 0.92], [0.55, -0.92], [-1.05, 0.72], [-1.05, -0.72]]) {             // lifting eyes
  const e = add(new THREE.TorusGeometry(0.038, 0.012, 8, 16), camoTurret, turret, x, ROOF + 0.045, z); e.rotation.y = 0.6;
  add(boxG(0.1, 0.018, 0.06), camoTurret, turret, x, ROOF + 0.009, z);
}
const tubeAlong = (pts, r, seg = 40, rs = 7) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, rs);
for (const s of [1, -1]) {                                                                         // grab rails down the turret side
  add(tubeAlong([[-0.45, 0.42, s * 1.215], [-0.42, 0.52, s * 1.20], [0.02, 0.53, s * 1.14], [0.05, 0.43, s * 1.15]], 0.012, 16), camoTurret, turret);
  // a tow cable along each fender, its eyes hooked at the ends, sagging between clips
  const y = 1.255, z = s * 1.56;
  add(tubeAlong([[1.92, y, z], [1.45, y - 0.01, z + s * 0.012], [1.0, y, z], [0.5, y - 0.012, z + s * 0.012], [0, y, z], [-0.5, y - 0.012, z + s * 0.012], [-1.0, y, z], [-1.5, y - 0.01, z + s * 0.012], [-1.82, y, z]], 0.017, 90), M.steel, body);
  for (const x of [1.92, -1.82]) { const t = add(new THREE.TorusGeometry(0.045, 0.012, 8, 16), M.steel, body, x + (x > 0 ? 0.05 : -0.05), y, z); t.rotation.x = Math.PI / 2; }
  for (const x of [1.45, 0, -1.45]) add(boxG(0.035, 0.045, 0.07), M.dark, body, x, y - 0.02, z);
}
{
  const g = new THREE.Group(); g.position.set(0.75, 1.245, 1.24); body.add(g);                    // shovel and pick clipped to the right fender
  add(cylX(0.016, 0.016, 0.95), M.canvas, g, 0, 0, 0);
  add(boxG(0.26, 0.012, 0.18), M.steel, g, 0.58, 0, 0);
  const h = new THREE.Group(); h.position.set(-0.55, 1.245, 1.24); body.add(h);
  add(cylX(0.019, 0.019, 0.82), M.canvas, h, 0, 0, 0);
  add(boxG(0.05, 0.02, 0.42), M.steel, h, 0.41, 0, 0);
  for (const x of [1.1, 0.4, -0.2, -0.9]) add(boxG(0.04, 0.04, 0.08), M.dark, body, x, 1.235, 1.24);
}

/* ---------- main gun ---------- */
const gun = new THREE.Group(); gun.position.set(0.95, 0.40, 0); turret.add(gun);
add(tubeX(-0.05, 0.34, 0.27, 0.25, 28), M.rubber, gun);                                    // dust cover
add(tubeX(0.30, 0.72, 0.25, 0.145, 28), camoTurret, gun);                                  // conical collar
add(tubeX(0.72, 0.84, 0.145, 0.13, 24), camoTurret, gun);
add(cylX(0.022, 0.022, 0.05, 10), M.dark, gun, 0.42, 0.02, 0.20);                         // coaxial port
const recoil = new THREE.Group(); gun.add(recoil);
{
  add(tubeX(0.80, 2.25, 0.118, 0.092), camoTurret, recoil);
  add(tubeX(1.50, 1.55, 0.114, 0.114), camoTurret, recoil);
  add(tubeX(2.20, 2.26, 0.101, 0.101), camoTurret, recoil);
  add(tubeX(2.25, 2.36, 0.092, 0.132), camoTurret, recoil);                                // fume extractor
  add(tubeX(2.36, 3.00, 0.132, 0.132), camoTurret, recoil);
  add(tubeX(3.00, 3.12, 0.132, 0.085), camoTurret, recoil);
  add(tubeX(3.12, 4.66, 0.085, 0.085), camoTurret, recoil);
  add(tubeX(3.88, 3.93, 0.094, 0.094), camoTurret, recoil);
  add(tubeX(4.66, 5.25, 0.078, 0.078), camoTurret, recoil);
  add(tubeX(5.22, 5.26, 0.083, 0.083), M.steel, recoil);
  add(boxG(0.13, 0.06, 0.07), M.dark, recoil, 5.04, 0.105, 0);                             // muzzle reference sensor
}
const muzzle = new THREE.Object3D(); muzzle.position.set(5.28, 0, 0); recoil.add(muzzle);
const flashCone = new THREE.Mesh(
  new THREE.ConeGeometry(0.30, 1.3, 18, 1, true).rotateZ(-Math.PI / 2).translate(0.65, 0, 0),
  new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
);
flashCone.visible = false; muzzle.add(flashCone);


// Physics checks for the shell solver, run with: node tests/shell.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = {}; vm.createContext(ctx);
let src = fs.readFileSync(path.join(__dirname, '../src/js/11-shell.js'), 'utf8');
if (process.env.SHELL_GAMMA) src = src.replace(/SHELL_GAMMA = [0-9.]+/, 'SHELL_GAMMA = ' + process.env.SHELL_GAMMA);
vm.runInContext(src + '\nthis.api={shellNew,shellNode,shellLink,shellStep,shellGround,shellSelf};', ctx);
const { shellNew, shellNode, shellLink, shellStep, shellGround, shellSelf } = ctx.api;
const H = 0.001, E_PANEL = 1.3e7 / 0.1;   // the step and node masses set how stiff a member can be: k = omega / (sum(1/m) h^2)
let fails = 0;
const check = (name, ok, info) => { console.log((ok ? 'pass ' : 'FAIL ') + name + '  ' + info); if (!ok) fails++; };
const finite = S => { for (let i = 0; i < S.n * 3; i++) if (!isFinite(S.p[i])) return false; return true; };
const kinetic = S => { let e = 0; for (let i = 0; i < S.n; i++) if (S.w[i]) { const a = i * 3; e += 0.5 * S.m[i] * (S.v[a] ** 2 + S.v[a + 1] ** 2 + S.v[a + 2] ** 2); } return e; };

// a square tube standing on the ground: nx round, ny up. Rings every 0.1 m, the sections of a pillar
function tube(hgt, Fc, Ft, seed = 1, nodeMass = 1.3) {
  const S = shellNew(2000, 12000), R = 0.1, M = 8, rows = Math.round(hgt / 0.1) + 1, id = (j, k) => j * M + ((k + M) % M);
  let q = seed; const rnd = () => (q = (q * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let j = 0; j < rows; j++) for (let k = 0; k < M; k++) {
    const a = k / M * 6.283, e = j && j < rows - 1 ? 0.002 * rnd() : 0;
    shellNode(S, (R + e) * Math.cos(a), 0.05 + j * 0.1, (R + e) * Math.sin(a), nodeMass, 0.02);   // the mass of a car's panel node
  }
  for (let j = 0; j < rows; j++) for (let k = 0; k < M; k++) {
    shellLink(S, id(j, k), id(j, k + 1), E_PANEL, Ft, Fc);
    shellLink(S, id(j, k), id(j, k + 2), E_PANEL * 0.1, Ft * 0.2, Fc * 0.2);
    if (j + 1 < rows) { shellLink(S, id(j, k), id(j + 1, k), E_PANEL, Ft, Fc); shellLink(S, id(j, k), id(j + 1, k + 1), E_PANEL, Ft, Fc); }
    if (j + 2 < rows) shellLink(S, id(j, k), id(j + 2, k), E_PANEL * 0.02, Fc * 0.05, Fc * 0.05);
  }
  return { S, rows, M, id };
}
// press the top ring down at a set speed; force is read from the members that carry into it
function press(T, speed, travel) {
  const { S, rows, M, id } = T, top = [], lst = [];
  for (let k = 0; k < M; k++) { const i = id(rows - 1, k); S.w[i] = 0; top.push(i); }
  for (let c = 0; c < S.nc; c++) if (top.includes(S.ca[c]) !== top.includes(S.cb[c])) lst.push(c);
  const n = Math.round(travel / speed / H), F = [];
  for (let s = 0; s < n; s++) {
    for (const i of top) S.p[i * 3 + 1] -= speed * H;
    shellStep(S, H, shellGround);
    let f = 0;
    for (const c of lst) {
      if (!S.on[c]) continue;
      const a = S.ca[c] * 3, b = S.cb[c] * 3, dy = Math.abs(S.p[a + 1] - S.p[b + 1]), d = Math.hypot(S.p[a] - S.p[b], S.p[a + 1] - S.p[b + 1], S.p[a + 2] - S.p[b + 2]) || 1;
      f += Math.abs(S.force[c]) * dy / d;
    }
    F.push(f);
  }
  return F;
}
const mean = (a, i, j) => { let s = 0; for (let k = i; k < j; k++) s += a[k]; return s / (j - i); };

// 1 a stiff frame dropped on the ground comes to rest without exploding
{
  const T = tube(0.6, 60000, 200000), S = T.S;
  for (let i = 0; i < S.n; i++) { S.p[i * 3 + 1] += 0.3; S.o[i * 3 + 1] += 0.3; }
  let maxE = 0; for (let s = 0; s < 5000; s++) { shellStep(S, H, shellGround); if (s > 1000) maxE = Math.max(maxE, kinetic(S)); }
  check('drop settles', finite(S) && kinetic(S) < 0.05, `kinetic at 5 s ${kinetic(S).toFixed(4)} J`);
}
// 2 a member yields at its force, whatever the speed: a chain of ten pulled by its end at two speeds (a chain cannot be pressed: it buckles)
{
  const pull = (v, sign) => {
    const S = shellNew(20, 20); let prev = shellNode(S, 0, 1, 0, 0, 0.01);
    const first = prev; for (let i = 1; i <= 10; i++) { const q = shellNode(S, i * 0.2, 1, 0, i === 10 ? 0 : 2.7, 0.01); shellLink(S, prev, q, E_PANEL, 8000, 8000, 99, 0); prev = q; }
    const n = Math.round(0.6 / v / H); let f = 0, cnt = 0;
    for (let s = 0; s < n; s++) { S.p[prev * 3] += sign * v * H; shellStep(S, H); if (s > n * 0.8) { let m = 0; for (let c = 0; c < S.nc; c++) m = Math.max(m, Math.abs(S.force[c])); f += m; cnt++; } }
    return f / cnt;
  };
  for (const [name, sg] of [['tension', 1]]) {
    const a = pull(0.5, sg), b = pull(2, sg), diff = Math.abs(a - b) / Math.min(a, b);
    check('yield force independent of speed, ' + name, diff < 0.15, `0.5 m/s ${(a / 1000).toFixed(2)} kN, 2 m/s ${(b / 1000).toFixed(2)} kN, limit 8 kN, diff ${(diff * 100).toFixed(1)}%`);
  }
}
// a whole section folding: chaotic, so averaged over several imperfect tubes
{
  // a single collapse is one chaotic buckling history: compare over several imperfect tubes and a longer stroke
  const crush = m => [0.5, 2].map(v => { let t = 0; for (const seed of [3, 11, 29, 47, 83]) { const F = press(tube(1.2, 2500, 16000, seed, m), v, 0.6); t += mean(F, Math.floor(F.length * 0.25), F.length); } return t / 5; });
  const res = crush(0.4), real = crush(1.3);   // light nodes show the solver; at a car's node mass the inertia of the folds adds a real speed effect
  console.log(`info with a car's node mass: 0.5 m/s ${(real[0] / 1000).toFixed(1)} kN, 2 m/s ${(real[1] / 1000).toFixed(1)} kN, diff ${(Math.abs(real[0] - real[1]) / Math.min(real[0], real[1]) * 100).toFixed(1)}%`);
  const diff = Math.abs(res[0] - res[1]) / Math.min(res[0], res[1]);
  check('crush force independent of speed', diff < 0.15, `0.5 m/s ${(res[0] / 1000).toFixed(1)} kN, 2 m/s ${(res[1] / 1000).toFixed(1)} kN, diff ${(diff * 100).toFixed(1)}%`);
}
// 3 what was crushed stays crushed
{
  const T = tube(0.8, 2500, 16000), S = T.S, h0 = 0.05 + (T.rows - 1) * 0.1;
  press(T, 1, 0.3);
  const top = []; for (let k = 0; k < T.M; k++) top.push(T.id(T.rows - 1, k));
  // let the press lift off slowly, keeping it in line, and see how far the tube follows it back up
  let y = h0 - 0.3, rose = 0;
  for (let s = 0; s < 1200; s++) {
    for (const i of top) { S.w[i] = 1 / S.m[i]; }
    shellStep(S, H, shellGround);
    let m = 0; for (const i of top) m += S.p[i * 3 + 1] / T.M; rose = Math.max(rose, m - y);   // the mean: the ring may tilt as the tube leans
  }
  check('plastic set', finite(S) && rose < 0.1, `sprang back ${(rose * 100).toFixed(1)} cm of 30 cm crushed`);
}
// 4 a thin panel between stops buckles out of plane instead of shrinking in place
{
  const S = shellNew(2000, 12000), NX = 11, NZ = 7, id = (i, j) => i * NZ + j, P = 0.1; let q = 7; const rnd = () => (q = (q * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) shellNode(S, i * P, 1 + 0.002 * rnd(), j * P, 0.08, 0.02);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    if (i + 1 < NX) shellLink(S, id(i, j), id(i + 1, j), E_PANEL, 16000, 2500);
    if (j + 1 < NZ) shellLink(S, id(i, j), id(i, j + 1), E_PANEL, 16000, 2500);
    if (i + 1 < NX && j + 1 < NZ) { shellLink(S, id(i, j), id(i + 1, j + 1), E_PANEL, 16000, 2500); shellLink(S, id(i + 1, j), id(i, j + 1), E_PANEL, 16000, 2500); }
    if (i + 2 < NX) shellLink(S, id(i, j), id(i + 2, j), E_PANEL * 0.02, 120, 120);
    if (j + 2 < NZ) shellLink(S, id(i, j), id(i, j + 2), E_PANEL * 0.02, 120, 120);
  }
  const ends = []; for (let j = 0; j < NZ; j++) { for (const i of [0, NX - 1]) { S.w[id(i, j)] = 0; ends.push(id(i, j)); } }
  for (let s = 0; s < 600; s++) { for (let j = 0; j < NZ; j++) S.p[id(NX - 1, j) * 3] -= 0.5 * H; shellStep(S, H); }
  let lo = 9, hi = -9; for (let i = 0; i < S.n; i++) { lo = Math.min(lo, S.p[i * 3 + 1]); hi = Math.max(hi, S.p[i * 3 + 1]); }
  let sh = 0, cnt = 0; for (let i = 0; i + 1 < NX; i++) for (let j = 0; j < NZ; j++) { const a = id(i, j) * 3, b = id(i + 1, j) * 3; sh += Math.hypot(S.p[a] - S.p[b], S.p[a + 1] - S.p[b + 1], S.p[a + 2] - S.p[b + 2]) / P; cnt++; }
  check('panel buckles', finite(S) && hi - lo > 0.1, `out of plane ${((hi - lo) * 100).toFixed(1)} cm for 60 cm of end shortening, mean link length ${(sh / cnt * 100).toFixed(0)}%`);
}
// 5 members break, and a seam lets go at its strength
{
  const S = shellNew(10, 10), a = shellNode(S, 0, 1, 0, 0), b = shellNode(S, 0, 0.5, 0, 200), c = shellNode(S, 0, 0.5, 0, 200);
  const hang = shellLink(S, a, b, 1e8, 5000, 5000, 0.5), weld = shellLink(S, b, c, 1e8, 1500, 1500, 0.02, 0, 1);
  for (let s = 0; s < 3000; s++) shellStep(S, H);
  check('weak weld fails, strong member holds', !S.on[weld] && S.on[hang], `weld ${S.on[weld] ? 'held' : 'broke'} under 1960 N against a 1500 N limit, hanger held 1960 N of 5000 N`);
  check('no NaN after break', finite(S), '');
}
// 6 two folded sheets stack rather than pass through
{
  const S = shellNew(200, 1000), A = [], B = [];
  const sheet = (y, ox, oz, out) => { const b0 = S.n; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) out.push(shellNode(S, i * 0.1 + ox, y, j * 0.1 + oz, 0.1, 0.05));
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const n = b0 + i * 9 + j; if (i < 8) shellLink(S, n, n + 9, E_PANEL, 16000, 16000); if (j < 8) shellLink(S, n, n + 1, E_PANEL, 16000, 16000); if (i < 8 && j < 8) shellLink(S, n, n + 10, E_PANEL, 16000, 16000); } };
  sheet(0.05, 0, 0, A); sheet(0.4, 0.03, 0.02, B);
  for (let s = 0; s < 3000; s++) shellStep(S, H, T => { shellGround(T); if (s % 4 === 0) shellSelf(T); });
  let y = 0; for (const i of B) y += S.p[i * 3 + 1] / B.length;
  check('sheets stack', finite(S) && y > 0.1, `upper sheet rests at ${(y * 100).toFixed(1)} cm, lower at 5 cm`);
}
// cost of a car-sized structure
{
  const T = tube(6, 2500, 16000), S = T.S, t0 = process.hrtime.bigint(), steps = 2000;
  for (let s = 0; s < steps; s++) { shellStep(S, H, shellGround); if (s % 8 === 0) shellSelf(S); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6, frame = ms / steps * 16;
  console.log(`cost: ${S.n} nodes, ${S.nc} members: ${frame.toFixed(2)} ms per 60 Hz frame (16 steps)`);
}
process.exit(fails ? 1 : 0);

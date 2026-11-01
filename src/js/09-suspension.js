/* ================= suspension, and the car to crush ================= */
// The tank stays at the origin and the world scrolls past it, so the car rides the ground toward the tank. The car
// lies lengthwise, nose to the tank, under the left track, the way these crossings are usually filmed.
// The hull is a sprung mass on twelve road wheels on torsion bars: it heaves, pitches and rolls, each wheel pushed up
// by whatever is under it. The car is a light rigid body (heave, pitch, roll, a shove along the ground) standing on
// four tyres and its own underside; the tank's load reaches it through the track. Where that load beats what the
// structure under the track can carry, the top of the car gives way; where it falls on an overhang, the car levers up
// on its axle instead. Every car vertex is then held under the tank's real underside (the track as laid, the belly,
// the skirts); the squeeze is shared down each column by stiffness, with crumple, and nothing springs back.
const crushBtn = $('#crush'), crushLbl = $('#crushLbl');
const XCG = WX.reduce((a, b) => a + b, 0) / WX.length;     // over the wheel stations, so it sits level at rest
const GRAV = 9.81, PITCH_I = 3.4, ROLL_I = 1.25;            // per unit hull mass: I ≈ (1.85 m)², (1.1 m)²
const S0 = 0.12, KW = GRAV / (2 * WX.length * S0);          // per wheel; 12 cm static deflection
const CW = 1.2, BUMP = 0.30, KB = 300, CB = 8;              // dampers; bump-stop travel and stiffness
const RKB = 90, RCB = 6, RW = 0.435, EDGE = 0.3;            // track runs against the car; wheel centre to grouser face
const CRAWL = 1.7;                                           // m/s: the driver eases off for the crossing
const hull = { y: 0, vy: 0, a: 0, va: 0, r: 0, vr: 0, yaw: 0, w: 0, cy: 1, sy: 0 };
const wAir = SIDES.map(() => new Uint8Array(WX.length)), hits = [];
function fRamp(x) {           // track run from the end road wheels up to idler and sprocket, tank frame
  if (x > 2.15) return (x - 2.15) * 0.46 + 5.4 * Math.pow(Math.max(0, x - 3.1), 2);
  if (x < -2.15) return (-2.15 - x) * 0.40 + 6 * Math.pow(Math.max(0, -3.25 - x), 2);
  return 0;
}
const fRampSlope = x => x > 2.15 ? 0.46 + 10.8 * Math.max(0, x - 3.1) : -(0.40 + 12 * Math.max(0, -3.25 - x));
const RAMP_X = [2.25, 2.45, 2.65, 2.85, 3.05, 3.2, 3.28, -2.25, -2.45, -2.65, -2.85, -3.05, -3.25, -3.4];

// the car as a body: 1.35 t against the tank's 42 t
// single: lengthwise under the left track. centre: lengthwise between the tracks, so the belly plates do the work.
// across: broadside, the left track over the cabin and the hull over the bonnet
const MODES = { side: { z: -1.15, track: true }, centre: { z: 0, track: false }, across: { z: -1.2, track: true, across: true }, pivot: { z: -1.15, track: true } };
let CAR_Z = MODES.side.z;
const CAR_M = 0.032, CAR_IP = CAR_M * 1.69, CAR_IR = CAR_M * 0.36, CAR_CG = 0.5, CAR_MU = 0.7;
const NB = 47, BL0 = -2.3, BDL = 0.1, BAND_X = SIDES[1] - MODES.side.z;     // the strip of car under the left track, along its length
const STRENGTH = (y, c) => (y > c.belt + 0.01 ? 0.04 : y > c.sill ? 0.09 : 0.13) * GRAV * BDL * c.V.strength;   // roof 0.15 t/m, body 0.85 t/m, sills and floor 4 t/m: 42 t puts about 5 t/m on each track
const OVERHANG = 0.008 * GRAV * BDL;     // past the axles there are no sills: nose and tail fold before they can lever the car up
const CRUSH_RATE = (y, c) => y > c.sill ? 60 : 24;   // cabin and bonnet fold almost freely; the sills go slowly
const floorOf = c => Math.max(0.16, 0.30 - 0.055 * c.pass);   // each pass flattens what the last one left
function carGround(V) {       // tyres (soft, then the rim), sills, floor pan and bumper corners
  const out = [], g = V.gy;
  for (const L of V.wheel.z) for (const x of [V.wheel.x, -V.wheel.x]) out.push({ x, y: 0, L, k: CAR_M * GRAV / (4 * 0.025), tyre: true });
  for (const [L, y] of [[2.25, 0.30], [-2.25, 0.33], [1.9, 0.23], [-1.9, 0.24], [0, 0.22], [0.9, 0.22], [-0.9, 0.22]]) for (const x of [0.7, -0.7]) out.push({ x, y: y + g, L, k: 400 });
  return out;
}
let car = null, carLoad = 0, crushAcc = 0, crushNext = 0.02, carKind = 'sedan', carMode = 'side', carPlush = true;
const wrecks = [], loose = [];
// car local (lateral x, up y, length L with the nose at +L) to world; the nose points at the tank (-x)
function carW(c, x, y, L, out) {
  const a = c.across ? -x : L, b = c.across ? L : x, ct = c.cth, st = c.sth, cr = c.cph, sr = c.sph, y0 = y - CAR_CG;
  const x1 = b * cr - y0 * sr, y1 = b * sr + y0 * cr, L2 = a * ct - y1 * st, y2 = a * st + y1 * ct;
  if (c.yawC) { const cc = Math.cos(c.yawC), sc = Math.sin(c.yawC), px = -L2, pz = x1; out[0] = c.u + c.X + px * cc + pz * sc; out[1] = c.Y + y2; out[2] = c.z - px * sc + pz * cc; return out; }
  out[0] = c.u + c.X - L2; out[1] = c.Y + y2; out[2] = c.z + x1; return out;
}
const BP = Array.from({ length: NB }, () => [0, 0, 0]), loads = new Float64Array(NB), carF = [];
function bandWorld() { car.cth = Math.cos(car.th); car.sth = Math.sin(car.th); car.cph = Math.cos(car.ph); car.sph = Math.sin(car.ph); for (let k = 0; k < car.nb; k++) carW(car, car.bx[k], car.Hs[k], car.bL[k], BP[k]); }
function bandTop(xw, rad) {   // the highest the car strip lifts something of radius rad centred at world x
  let best = 0, bk = -1;
  for (let k = 0; k < car.nb; k++) {
    if (car.Hs[k] <= 0) continue;
    const p = BP[k], dx = Math.abs(p[0] - xw);
    if (dx >= rad) continue;
    const t = p[1] - rad + Math.sqrt(rad * rad - dx * dx);
    if (t > best) { best = t; bk = k; }
  }
  return [best, bk];
}
// how high the wreck stands under a point on the tank (tank-frame x, z); 0 off the car
function wreckH(c, xl, zl) {
  const wx = xl * hull.cy + zl * hull.sy, wz = -xl * hull.sy + zl * hull.cy, px = wx - (c.u + c.X), pz = wz - c.z, cc = Math.cos(c.yawC), sc = Math.sin(c.yawC);
  let lx = px * sc + pz * cc, L = -(px * cc - pz * sc);
  if (c.across) { const t = lx; lx = -L; L = t; }
  if (Math.abs(lx) > 1.25 || Math.abs(L) > 2.58) return 0;
  return Math.max(0, sampleV(c, lx, L) + c.Y - CAR_CG);
}
const wreckTop = (c, x, z, r) => r ? Math.max(wreckH(c, x - r, z), wreckH(c, x, z), wreckH(c, x + r, z)) : wreckH(c, x, z);
// a strip of metal still folding can pass on only the force it folds at; once it is down on something solid it passes on everything
const bandSt = (c, k) => { const hard = c.bandHard[k], y = c.Hs[k]; return hard > 0.25 && y <= hard + 0.03 ? STRENGTH(0.2, c) * 1.6 : c.over[k] ? OVERHANG : STRENGTH(y, c); };
const bandLo = (c, k) => Math.max(c.bandHard[k], c.over[k] ? 0.1 : floorOf(c));
// the hollow nose and tail never carry the load, even folded flat: only something solid under them does
const bandCap = (c, k, f, n) => c.Hs[k] > bandLo(c, k) + 0.006 || (c.over[k] && c.bandHard[k] < 0.25) ? Math.min(f, bandSt(c, k) * n) : f;
function suspStep(h) {
  const ca = Math.cos(hull.a), sa = Math.sin(hull.a);
  let F = 0, Mp = 0, Mr = 0, Fc = 0;
  const pv = !!car && (!!car.shell || (!!car.pv && car.pv.on)), live = car && !car.done && !pv;
  shBudget.fill(0);
  if (live) { bandWorld(); loads.fill(0); carF.length = 0; }
  for (let s = 0; s < SIDES.length; s++) {
    const z = SIDES[s], band = live && z < 0;
    for (let i = 0; i < WX.length; i++) {
      const x = WX[i], xw = x * ca - 0.42 * sa;
      const [top, k] = pv ? [wreckTop(car, x, z, 0.22), -2] : band ? bandTop(xw, RW) : [0, -1];
      const d = top - (hull.y + x * sa + z * hull.r), v = -(hull.vy + x * ca * hull.va + z * hull.vr);
      if (d > -S0) {
        let f = KW * (S0 + d) + CW * v;
        if (d > BUMP) f += KB * (d - BUMP) + CB * v;
        if (f > 0) {
          F += f; Mp += f * (x - XCG); Mr += f * z;
          if (k === -2 && top > 0.02) { Fc += f; shBudget[s * 8 + i] = f * HULL_KG; }
          if (k >= 0) { Fc += f; for (let j = Math.max(0, k - 2); j <= Math.min(car.nb - 1, k + 2); j++) loads[j] += f / 5; carF.push(xw, top, z, 0, -bandCap(car, k, f, 5)); }
        }
        if (wAir[s][i]) { wAir[s][i] = 0; hits.push({ s, i, v, onCar: k >= 0 || (k === -2 && top > 0.02) }); }
        wd[s][i] = d;
      } else { wAir[s][i] = 1; wd[s][i] = -S0; }       // hanging on the torsion bar
    }
    for (const xr of RAMP_X) {
      const w = xr > 0 ? 0 : WX.length - 1;
      const u = fRamp(xr) + Math.max(0, wd[s][w]) * Math.max(0, 1 - Math.abs(xr - WX[w]) / 0.83);
      const xw = xr * ca - u * sa, [top, k] = pv ? [wreckTop(car, xr, z, 0), -2] : band ? bandTop(xw, EDGE) : [0, -1];
      const p = top - (hull.y + xr * sa + u * ca + z * hull.r);
      if (p > 0) {
        const f = RKB * p - RCB * (hull.vy + xr * ca * hull.va + z * hull.vr);
        if (f > 0) { F += f; Mp += f * (xr - XCG); Mr += f * z; if (k === -2 && top > 0.02) { Fc += f; shBudget[s * 8 + (xr > 0 ? 6 : 7)] += f * HULL_KG; } if (k >= 0) { Fc += f; for (let j = Math.max(0, k - 3); j <= Math.min(car.nb - 1, k + 3); j++) loads[j] += f / 7; const fc = bandCap(car, k, f, 7); carF.push(xw, top, z, fc * Math.max(-0.3, Math.min(0.3, fRampSlope(xr))), -fc); } }
      }
    }
  }
  hull.vy += (F - GRAV) * h; hull.va += Mp / PITCH_I * h; hull.vr += Mr / ROLL_I * h;
  hull.y += hull.vy * h; hull.a += hull.va * h; hull.r += hull.vr * h;
  carLoad = Fc;
  if (live) carStep(h);
}
const carCm = new Float64Array(9), gp = [0, 0, 0];
function carStep(h) {
  const Hs = car.Hs;
  for (let k = 0; k < car.nb; k++) { const over = car.over[k], st = bandSt(car, k), lo = bandLo(car, k); if (loads[k] > st && Hs[k] > lo) Hs[k] = Math.max(lo, Hs[k] - (over ? 90 : CRUSH_RATE(Hs[k], car)) * (loads[k] - st) * h); }
  // springs explicit; contact damping implicit and coupled (heave, pitch, roll), so the car pivots on whatever holds it
  let fx = 0, fy = -CAR_M * GRAV, tp = 0, tr = 0, N = 0, slam = 0;
  const cgx = car.u + car.X; carCm.fill(0);
  const addF = (px, py, pz, Fx, Fy) => { fx += Fx; fy += Fy; tp += (cgx - px) * Fy + (py - car.Y) * Fx; tr += (pz - car.z) * Fy; };
  for (let i = 0; i < carF.length; i += 5) addF(carF[i], carF[i + 1], carF[i + 2], carF[i + 3], carF[i + 4]);
  for (const g of car.ground) {
    carW(car, g.x, g.y, g.L, gp);
    if (gp[1] >= 0) continue;
    const pen = -gp[1], bot = g.tyre && pen > 0.13, kk = g.k + (bot ? 400 : 0), c = 2 * Math.sqrt(kk * CAR_M) * 0.7;
    const f = g.k * pen + (bot ? 400 * (pen - 0.13) : 0);
    addF(gp[0], gp[1], gp[2], 0, f); N += f;
    const j0 = 1, j1 = cgx - gp[0], j2 = gp[2] - car.z, vv = car.vY + car.w * j1 + car.wr * j2;
    if (!g.tyre && vv < slam) slam = vv;
    carCm[0] += c; carCm[1] += c * j1; carCm[2] += c * j2; carCm[4] += c * j1 * j1; carCm[5] += c * j1 * j2; carCm[8] += c * j2 * j2;
  }
  carCm[3] = carCm[1]; carCm[6] = carCm[2]; carCm[7] = carCm[5];
  if (slam < car.slam) car.slam = slam;
  const slide = Math.abs(fx) > CAR_MU * N ? fx - Math.sign(fx) * CAR_MU * N : 0;    // shoved only once the push beats friction
  car.vX = (car.vX + slide / CAR_M * h) / (1 + 8 * h);
  const A = [carCm[0] * h + CAR_M, carCm[1] * h, carCm[2] * h, carCm[3] * h, carCm[4] * h + car.ip * (1 + 2 * h), carCm[5] * h, carCm[6] * h, carCm[7] * h, carCm[8] * h + car.ir * (1 + 4 * h)];
  const b = [CAR_M * car.vY + h * fy, car.ip * car.w + h * tp, car.ir * car.wr + h * tr];
  const det = m => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const D = det(A), sol = [0, 1, 2].map(q => { const m = A.slice(); m[q] = b[0]; m[3 + q] = b[1]; m[6 + q] = b[2]; return det(m) / D; });
  car.vY = sol[0]; car.w = sol[1]; car.wr = sol[2];
  car.X += car.vX * h; car.Y += car.vY * h; car.th += car.w * h; car.ph += car.wr * h;
}


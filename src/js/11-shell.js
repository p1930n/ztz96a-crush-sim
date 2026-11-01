/* ---------- the shell solver: sheet steel and box sections as particles and plastic members ---------- */
/* XPBD with one pass per small step. Every member carries a force it can pass on: tension and compression limits in newtons.
   When a member reaches its limit it passes on no more, and the rest of the movement goes into its length for good: steel yields
   at a force, whatever the speed. Under compression a thin panel's limit is low, so sheets buckle out of plane; the members that
   skip a node resist bending, and yielding there leaves a crease. Units are metres, kilograms, seconds, newtons. */
const SHELL_G = 9.81, SHELL_VMAX = 14, SHELL_GAMMA = 0.35, SHELL_OMEGA = 0.6;
let SHELL_SWEEPS = 4;
function shellNew(maxN, maxC) {
  return {
    n: 0, nc: 0, maxN, maxC,
    p: new Float32Array(maxN * 3), o: new Float32Array(maxN * 3), v: new Float32Array(maxN * 3), p0: new Float32Array(maxN * 3),
    w: new Float32Array(maxN), m: new Float32Array(maxN), r: new Float32Array(maxN), grp: new Int16Array(maxN),
    ca: new Int32Array(maxC), cb: new Int32Array(maxC), L: new Float32Array(maxC), L0: new Float32Array(maxC), K: new Float32Array(maxC),
    Ft: new Float32Array(maxC), Fc: new Float32Array(maxC), ep: new Float32Array(maxC), ef: new Float32Array(maxC), H: new Float32Array(maxC),
    on: new Uint8Array(maxC), kind: new Uint8Array(maxC), force: new Float32Array(maxC),
    damp: 0.4, mu: 0.6, broke: [], hash: null, reactY: 0,
  };
}
function shellNode(S, x, y, z, mass, r = 0.05, grp = 0) {
  const i = S.n++, a = i * 3;
  if (i >= S.maxN) throw new Error('shell: too many nodes');
  S.p[a] = S.o[a] = S.p0[a] = x; S.p[a + 1] = S.o[a + 1] = S.p0[a + 1] = y; S.p[a + 2] = S.o[a + 2] = S.p0[a + 2] = z;
  S.m[i] = mass; S.w[i] = mass > 0 ? 1 / mass : 0; S.r[i] = r; S.grp[i] = grp;
  return i;
}
// kind: 0 a member, 1 a weld or hinge, which lets go once it has stretched past ef metres
function shellLink(S, a, b, E, Ft, Fc, ef = 0.3, H = 0.6, kind = 0) {
  const c = S.nc++, A = a * 3, B = b * 3;
  if (c >= S.maxC) throw new Error('shell: too many members');
  const dx = S.p[A] - S.p[B], dy = S.p[A + 1] - S.p[B + 1], dz = S.p[A + 2] - S.p[B + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  S.ca[c] = a; S.cb[c] = b; S.L[c] = S.L0[c] = d; S.K[c] = 1 / E;
  S.Ft[c] = Ft; S.Fc[c] = Fc; S.ef[c] = ef; S.H[c] = H; S.kind[c] = kind; S.on[c] = 1;
  return c;
}
// A plastic hinge at b, between a and c. A member skipping a node hardly changes length as a straight beam starts to bend, so it
// cannot stand for a box section; this holds b at its offset from the midpoint of a and c, which moves at once. F is the side force
// at the hinge when it yields (plastic moment = F x half the span), and what it yields by stays as a permanent kink.
function shellBend(S, a, b, c, F) {
  if (!S.bd) { const M = 1600; S.nb = 0; S.ba = new Int32Array(M * 3); S.bd = new Float32Array(M * 3); S.bF = new Float32Array(M); }
  const q = S.nb++, A = a * 3, B = b * 3, C = c * 3;
  S.ba[q * 3] = a; S.ba[q * 3 + 1] = b; S.ba[q * 3 + 2] = c; S.bF[q] = F;
  for (let k = 0; k < 3; k++) S.bd[q * 3 + k] = (S.p[A + k] + S.p[C + k]) / 2 - S.p[B + k];
}
function shellBends(S, h2, om) {
  const { p, w, ba, bd, bF, nb } = S;
  for (let q = 0, t = 0; q < nb; q++, t += 3) {
    const a = ba[t], b = ba[t + 1], c = ba[t + 2], A = a * 3, B = b * 3, C = c * 3, wa = w[a], wb = w[b], wc = w[c], W = (wa + wc) / 4 + wb;
    let ex = (p[A] + p[C]) / 2 - p[B] - bd[t], ey = (p[A + 1] + p[C + 1]) / 2 - p[B + 1] - bd[t + 1], ez = (p[A + 2] + p[C + 2]) / 2 - p[B + 2] - bd[t + 2];
    const mag = Math.sqrt(ex * ex + ey * ey + ez * ez); if (mag < 1e-9) continue;
    const held = bF[q] * h2 * W / om;       // the most this hinge can correct in a step is what its yield force can do
    if (mag > held) {
      const k = (mag - held) / mag;
      bd[t] += ex * k; bd[t + 1] += ey * k; bd[t + 2] += ez * k;
      ex *= 1 - k; ey *= 1 - k; ez *= 1 - k;
    }
    const l = om / W, ha = 0.5 * wa * l, hc = 0.5 * wc * l, hb = wb * l;
    p[A] -= ha * ex; p[A + 1] -= ha * ey; p[A + 2] -= ha * ez;
    p[C] -= hc * ex; p[C + 1] -= hc * ey; p[C + 2] -= hc * ez;
    p[B] += hb * ex; p[B + 1] += hb * ey; p[B + 2] += hb * ez;
  }
}
// one small step of the structure alone. `contact` runs after the members and may move nodes (ground, tank)
function shellStep(S, h, contact) {
  const { p, o, v, w, n, nc, ca, cb, L, L0, K, Ft, Fc, ep, ef, H, on, kind, force } = S, h2 = h * h, ih2 = 1 / h2;
  const keep = Math.max(0, 1 - S.damp * h), gy = (S.g === undefined ? SHELL_G : S.g) * h;
  for (let i = 0, a = 0; i < n; i++, a += 3) {
    o[a] = p[a]; o[a + 1] = p[a + 1]; o[a + 2] = p[a + 2];
    if (w[i] === 0) continue;
    v[a] *= keep; v[a + 1] = (v[a + 1] - gy) * keep; v[a + 2] *= keep;
    p[a] += v[a] * h; p[a + 1] += v[a + 1] * h; p[a + 2] += v[a + 2] * h;
  }
  // one sweep per step with momentum carried between steps is a heavy-ball iteration, and rings unless under-relaxed (see tests/)
  const G = SHELL_GAMMA, om = SHELL_OMEGA, again = S.again, na = again ? again.length : 0, passes = nc + na * SHELL_SWEEPS;
  for (let q = 0; q < passes; q++) {
    const c = q < nc ? q : again[(q - nc) % na];     // the frame's strong members get more sweeps: one leaves a chain of them far softer than the steel they stand for
    if (!on[c]) continue;
    const A = ca[c] * 3, B = cb[c] * 3, wa = w[ca[c]], wb = w[cb[c]], ws = wa + wb;
    if (ws === 0) continue;
    const dx = p[A] - p[B], dy = p[A + 1] - p[B + 1], dz = p[A + 2] - p[B + 2], d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1e-12) continue;
    const d = Math.sqrt(d2), C = d - L[c], at = K[c] * ih2;
    // relative movement along the member this step is damped: steel does not ring for long, and ringing must not ratchet into yield
    const dv = (dx * (p[A] - o[A] - p[B] + o[B]) + dy * (p[A + 1] - o[A + 1] - p[B + 1] + o[B + 1]) + dz * (p[A + 2] - o[A + 2] - p[B + 2] + o[B + 2])) / d;
    let lam = om * (C + G * dv) / ((1 + G) * ws + at), mag = lam < 0 ? -lam : lam;
    const f0 = lam > 0 ? Ft[c] : Fc[c], l0 = L0[c];
    const strain = kind[c] ? 0 : Math.abs(L[c] - l0) / (l0 + 1e-6);          // how far it has actually been drawn or shortened
    let lim = f0 * (1 + H[c] * Math.min(1.5, strain));
    if (lam < 0 && L[c] < 0.4 * l0) lim *= 1 + 40 * (0.4 - L[c] / l0);       // folded solid: no more room to give
    const cap = lim * h2;
    if (mag > cap) {
      const slip = Math.max(0, Math.abs(C) - cap * ((1 + G) * ws + at) / om); // what the member cannot carry goes into its length, leaving it at its limit
      if (lam > 0) { L[c] += slip; lam = cap; } else { L[c] -= slip; if (L[c] < 0.05 * l0) L[c] = 0.05 * l0; lam = -cap; }
      ep[c] = kind[c] ? L[c] - l0 : Math.abs(L[c] - l0) / (l0 + 1e-6);
      mag = cap;
      if (lam > 0 && ep[c] > ef[c]) { on[c] = 0; S.broke.push(c); continue; }      // only drawn out far enough does it part
    }
    // a member this solver holds is many times softer than steel, so near its limit that excess elastic stretch is passed into its
    // length: real steel would have yielded long before storing it, and it must not spring back when the load comes off
    else if (mag > 0.7 * cap && kind[c] === 0) L[c] += 0.003 * C;
    force[c] = lam * ih2;
    const s = lam / d;
    p[A] -= wa * s * dx; p[A + 1] -= wa * s * dy; p[A + 2] -= wa * s * dz;
    p[B] += wb * s * dx; p[B + 1] += wb * s * dy; p[B + 2] += wb * s * dz;
  }
  if (S.nb) for (let q = 0; q <= SHELL_SWEEPS; q++) shellBends(S, h2, om);
  if (contact) contact(S, h);
  const ih = 1 / h, vm = SHELL_VMAX;
  for (let i = 0, a = 0; i < n; i++, a += 3) {
    if (w[i] === 0) continue;
    let vx = (p[a] - o[a]) * ih, vy = (p[a + 1] - o[a + 1]) * ih, vz = (p[a + 2] - o[a + 2]) * ih;
    // reversing from one millisecond to the next is the solver chattering, not metal moving: that energy goes into the metal
    if (vx * v[a] + vy * v[a + 1] + vz * v[a + 2] < 0) { vx *= 0.25; vy *= 0.25; vz *= 0.25; }
    if (S.vUp && vy > S.vUp && S.air[i] !== 2) { vy = S.vUp; p[a + 1] = o[a + 1] + vy * h; }    // something this light squeezed out from under 42 t is stopped by the air and by its own limbs long before it could fly
    const s2 = vx * vx + vy * vy + vz * vz;
    if (s2 > vm * vm) {                                                       // a guard, not physics: nothing in this scene moves this fast
      const k = vm / Math.sqrt(s2); vx *= k; vy *= k; vz *= k;
      p[a] = o[a] + vx * h; p[a + 1] = o[a + 1] + vy * h; p[a + 2] = o[a + 2] + vz * h;
    }
    v[a] = vx; v[a + 1] = vy; v[a + 2] = vz;
  }
}
// the ground plane y = 0, with friction against the step's start position
function shellGround(S) {
  const { p, o, w, n } = S, mu = S.mu, r = S.gr || S.r;
  for (let i = 0, a = 0; i < n; i++, a += 3) {
    const pen = r[i] - p[a + 1];
    if (pen <= 0 || w[i] === 0) continue;
    p[a + 1] = r[i];
    if (S.v[a + 1] < -2) { const J = S.m[i] * -S.v[a + 1]; if (J > (S.hit || 0)) S.hit = J; }
    const tx = p[a] - o[a], tz = p[a + 2] - o[a + 2], t = Math.sqrt(tx * tx + tz * tz), lim = mu * pen;
    if (t > 1e-9) { const k = t <= lim ? 1 : lim / t; p[a] -= tx * k; p[a + 2] -= tz * k; }
  }
}
const SELF_NB = new Int8Array([0, 0, 0, 1, 0, 0, -1, 1, 0, 0, 1, 0, 1, 1, 0, -1, -1, 1, 0, -1, 1, 1, -1, 1, -1, 0, 1, 0, 0, 1, 1, 0, 1, -1, 1, 1, 0, 1, 1, 1, 1, 1]);
// nodes as spheres: folded sheet stacks up instead of passing through itself. A coarse pass, run every few steps
function shellSelf(S) {
  const { p, r, w, grp, n } = S, cell = 0.13, inv = 1 / cell, B = 4093;
  const head = S.hash || (S.hash = new Int32Array(B)), next = S.hnext || (S.hnext = new Int32Array(S.maxN));
  head.fill(-1);
  for (let i = 0, a = 0; i < n; i++, a += 3) {
    const cx = Math.floor(p[a] * inv), cy = Math.floor(p[a + 1] * inv), cz = Math.floor(p[a + 2] * inv);
    for (let q = 0; q < 14; q++) {
      const ox = SELF_NB[q * 3], oy = SELF_NB[q * 3 + 1], oz = SELF_NB[q * 3 + 2];
      let h = (((cx + ox) * 73856093) ^ ((cy + oy) * 19349663) ^ ((cz + oz) * 83492791)) % B; if (h < 0) h += B;
      for (let j = head[h]; j >= 0; j = next[j]) {
        const b = j * 3, dx = p[a] - p[b], dy = p[a + 1] - p[b + 1], dz = p[a + 2] - p[b + 2], R = r[i] + r[j], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R || d2 < 1e-10) continue;
        if (grp[i] && grp[i] === grp[j]) continue;
        const e0 = S.p0[a] - S.p0[b], e1 = S.p0[a + 1] - S.p0[b + 1], e2 = S.p0[a + 2] - S.p0[b + 2];
        if (e0 * e0 + e1 * e1 + e2 * e2 < R * R * 1.21) continue;      // neighbours built this close are the same sheet, not a collision
        const ws = w[i] + w[j]; if (ws === 0) continue;
        const d = Math.sqrt(d2), s = Math.min(R - d, 0.003) / (d * ws);    // eased apart, not knocked: a hard push here turns into speed
        p[a] += w[i] * s * dx; p[a + 1] += w[i] * s * dy; p[a + 2] += w[i] * s * dz;
        p[b] -= w[j] * s * dx; p[b + 1] -= w[j] * s * dy; p[b + 2] -= w[j] * s * dz;
      }
    }
    let h0 = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) % B; if (h0 < 0) h0 += B;
    next[i] = head[h0]; head[h0] = i;
  }
}

/* ================= materials ================= */
const CAMO_GLSL = `
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
uniform float uScale; uniform float uDigital; uniform vec3 uDustC; uniform float uDust; uniform float uDustY; uniform sampler2D tGrain; uniform float uGrain;
float castH(vec3 p, vec3 fn){ vec3 w = pow(abs(fn), vec3(4.0)); w /= w.x + w.y + w.z; return texture2D(tGrain, p.zy * 0.9).r * w.x + texture2D(tGrain, p.xz * 0.9).r * w.y + texture2D(tGrain, p.xy * 0.9).r * w.z; }
varying vec3 vCamo;
float camoHash(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float camoNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(camoHash(i),camoHash(i+vec3(1.,0.,0.)),f.x), mix(camoHash(i+vec3(0.,1.,0.)),camoHash(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(camoHash(i+vec3(0.,0.,1.)),camoHash(i+vec3(1.,0.,1.)),f.x), mix(camoHash(i+vec3(0.,1.,1.)),camoHash(i+vec3(1.,1.,1.)),f.x),f.y), f.z); }
float camoFbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*camoNoise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s; }
vec3 camoColor(vec3 p){
  vec3 q = p * uScale;
  if (uDigital > 0.5) q = floor(q * 10.0) / 10.0;
  float n1 = camoFbm(q*0.9 + vec3(3.1,0.0,7.7));
  float n2 = camoFbm(q*1.25 + vec3(11.0,5.0,1.0));
  float n3 = camoFbm(q*1.7 + vec3(-4.0,8.0,2.0));
  vec3 c = uC0;
  c = mix(c, uC1, step(0.52, n1));
  c = mix(c, uC2, step(0.56, n2));
  c = mix(c, uC3, step(0.61, n3));
  c = mix(c, vec3(dot(c, vec3(0.3, 0.6, 0.1))), 0.14);
  float wearPatch = camoNoise(p * 2.7 + vec3(3.0, 7.0, 1.0));
  float chip = smoothstep(0.68, 0.73, camoNoise(p * 27.0)) * smoothstep(0.4, 0.62, wearPatch);
  float runs = smoothstep(0.64, 0.82, camoNoise(vec3(p.x * 16.0, p.y * 1.5, p.z * 16.0))) * smoothstep(0.35, 0.6, camoNoise(p * 1.9 + vec3(9.0, 2.0, 4.0)));
  c = mix(c, c * 0.55 + vec3(0.02, 0.018, 0.015), chip * 0.6);
  c = mix(c, vec3(0.13, 0.055, 0.022), runs * 0.55);
  float dn = camoNoise(p * 3.1 + vec3(5.0, 1.0, 9.0)), dg = camoNoise(p * 11.0);
  float dust = uDust * (smoothstep(uDustY, uDustY - 0.55, p.y) * (0.45 + 0.55 * dn) + 0.14 * dg);
  return mix(c, uDustC, clamp(dust, 0.0, 0.75));
}
`;
function makeCamo() {
  const u = {
    uRef: { value: new THREE.Matrix4() },
    uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() },
    uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
    uScale: { value: 1 }, uDigital: { value: 0 },
    uDustC: { value: lin('#857659') }, uDust: { value: 1 }, uDustY: { value: 1.05 }
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.1 });
  m.userData.u = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u); sh.uniforms.tGrain = REAL.tRustD; sh.uniforms.uGrain = REAL.grainOn;
    sh.vertexShader = 'uniform mat4 uRef;\nvarying vec3 vCamo;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 camoP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        camoP = instanceMatrix * camoP;
      #endif
      vCamo = (uRef * modelMatrix * camoP).xyz;`);
    sh.fragmentShader = CAMO_GLSL + sh.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
  vec3 castN = normalize(cross(dFdx(vCamo), dFdy(vCamo))); float castV = uGrain > 0.5 ? castH(vCamo, castN) : 0.5;
  diffuseColor.rgb *= camoColor(vCamo) * mix(1.0, 0.72 + 0.56 * castV, uGrain);`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bumpGLSL('castV', '0.007 * uGrain')).replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor + 0.16 * (camoNoise(vCamo * 4.3) - 0.5), 0.35, 1.0);');
  };
  return m;
}
const camoHull = makeCamo(), camoTurret = makeCamo();
camoTurret.userData.u.uDust.value = 0.45; camoTurret.userData.u.uDustY.value = 0.3;
const M = {
  paint: new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.1 }),
  rubber: new THREE.MeshStandardMaterial({ color: lin('#1d1e1b'), roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: lin('#4a4a43'), roughness: 0.5, metalness: 0.65 }),
  track: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.25 }),
  glass: new THREE.MeshStandardMaterial({ color: lin('#16242c'), roughness: 0.12, metalness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: lin('#23251f'), roughness: 0.85 }),
  canvas: new THREE.MeshStandardMaterial({ color: lin('#5e5a3f'), roughness: 1 }),
  lamp: new THREE.MeshStandardMaterial({ color: lin('#d9d6c6'), roughness: 0.2, metalness: 0.3 }),
  tail: new THREE.MeshStandardMaterial({ color: lin('#8c1d14'), roughness: 0.4, emissive: lin('#2a0402') })
};

const WEAR_GLSL = `
varying vec3 vWear; varying float vWearSeed;
float wearHash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wearNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wearHash(i), wearHash(i + vec3(1., 0., 0.)), f.x), mix(wearHash(i + vec3(0., 1., 0.)), wearHash(i + vec3(1., 1., 0.)), f.x), f.y),
             mix(mix(wearHash(i + vec3(0., 0., 1.)), wearHash(i + vec3(1., 0., 1.)), f.x), mix(wearHash(i + vec3(0., 1., 1.)), wearHash(i + vec3(1., 1., 1.)), f.x), f.y), f.z); }
`;
// `body` sets wearC, wearRough and wearMetal from vWear (part coordinates) and vWearSeed (differs link to link)
function aged(mat, body) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vWear; varying float vWearSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vWear = position; vWearSeed = 0.0;
      #ifdef USE_INSTANCING_COLOR
        vWearSeed = instanceColor.r * 37.0 + instanceColor.b * 91.0;
      #endif`);
    sh.uniforms.tGrain = REAL.tRustD; sh.uniforms.uGrain = REAL.grainOn;
    sh.fragmentShader = 'uniform sampler2D tGrain; uniform float uGrain;\n' + WEAR_GLSL + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + bumpGLSL('texture2D(tGrain, vWear.xy * 2.1 + vWear.z * 1.3 + vWearSeed).r', '0.004 * uGrain')).replace('#include <color_fragment>', `#include <color_fragment>
      float wearRough = -1.0, wearMetal = -1.0; vec3 wearC = diffuseColor.rgb;
      ${body}
      diffuseColor.rgb = wearC;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  if (wearRough >= 0.0) roughnessFactor = wearRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  if (wearMetal >= 0.0) metalnessFactor = wearMetal;');
  };
}
// steel links: rust in the corners, the wheel path on the inside and the grouser tips rubbed bright
aged(M.track, `
  float n = wearNoise(vWear * 38.0 + vWearSeed), n2 = wearNoise(vWear * 110.0 - vWearSeed);
  float polish = step(0.02, vWear.y) * (1.0 - smoothstep(0.2, 0.25, abs(vWear.z))) * smoothstep(0.25, 0.55, wearNoise(vWear * 12.0 + vWearSeed * 2.0)) + smoothstep(-0.044, -0.052, vWear.y);
  polish = clamp(polish, 0.0, 1.0);
  float rust = smoothstep(0.56, 0.8, n * 0.75 + n2 * 0.25) * (1.0 - polish);
  wearC = mix(wearC, vec3(0.11, 0.05, 0.022) * (0.7 + 0.6 * n2), rust * 0.7);
  wearC = mix(wearC, vec3(0.17, 0.165, 0.155), polish * 0.7);
  wearRough = mix(mix(0.9, 1.0, rust), 0.62, polish); wearMetal = mix(mix(0.3, 0.05, rust), 0.55, polish);`);
// road wheels, idler, sprocket: paint worn away toward the rim, rust round the hub
aged(M.paint, `
  float n = wearNoise(vWear * 46.0), bare = smoothstep(0.74, 0.8, n + 0.12 * smoothstep(0.22, 0.34, length(vWear.xy)));
  float rust = smoothstep(0.58, 0.8, wearNoise(vWear * 16.0 + 4.0));
  wearC = mix(wearC, vec3(0.09, 0.05, 0.03), rust * 0.5);
  wearC = mix(wearC, vec3(0.14, 0.135, 0.12), bare * 0.65);
  wearRough = mix(0.84, 0.5, bare); wearMetal = mix(0.1, 0.65, bare);`);
// tyres: greyed and cracked, chunks gone from the edge
aged(M.rubber, `
  float n = wearNoise(vWear * 9.0);
  wearC = mix(wearC * 1.2, vec3(0.1, 0.085, 0.065), 0.08 + 0.1 * n);`);
aged(M.steel, `
  float n = wearNoise(vWear * 34.0), rust = smoothstep(0.5, 0.76, n);
  wearC = mix(wearC, vec3(0.14, 0.06, 0.025), rust * 0.75); wearRough = mix(0.5, 0.95, rust); wearMetal = mix(0.65, 0.1, rust);`);

const PAINTS = {
  wood:   { c: ['#5f6e43', '#3a4a2c', '#7a5238', '#8f9a72'], digital: 1, scale: 0.9, wheel: '#56633b' },
  desert: { c: ['#b9a57a', '#94805a', '#6f5f43', '#d3c59f'], digital: 1, scale: 0.8, wheel: '#ab986e' },
  olive:  { c: ['#566241', '#566241', '#4b5639', '#566241'], digital: 0, scale: 0.45, wheel: '#536040' }
};
function setPaint(key) {
  const p = PAINTS[key];
  [camoHull, camoTurret].forEach(m => {
    const u = m.userData.u;
    u.uC0.value.copy(lin(p.c[0])); u.uC1.value.copy(lin(p.c[1]));
    u.uC2.value.copy(lin(p.c[2])); u.uC3.value.copy(lin(p.c[3]));
    u.uDigital.value = p.digital; u.uScale.value = p.scale;
  });
  M.paint.color.copy(lin(p.wheel)).lerp(lin('#8a7a5e'), 0.35);   // road wheels carry the dust of the tracks
  document.querySelectorAll('.paint button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.paint === key)));
}


(function(){
'use strict';
const $ = s => document.querySelector(s);
const specBtn = $('#specBtn'), spec = $('#spec');
specBtn.addEventListener('click', () => { spec.hidden = !spec.hidden; specBtn.setAttribute('aria-expanded', String(!spec.hidden)); });
if (!window.THREE || !THREE.OrbitControls) { $('#fail').hidden = false; return; }

const DEG = Math.PI / 180;
const lin = h => new THREE.Color(h).convertSRGBToLinear();
const stage = $('#stage');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smallScreen = Math.min(innerWidth, innerHeight) < 600;

/* ================= renderer / scene ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen || matchMedia('(pointer:coarse)').matches ? 1.5 : 2));
renderer.outputEncoding = THREE.LinearEncoding;             // the scene is rendered linear; the grade pass tone-maps and encodes
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd8dbcd, 0.0125);           // haze: distance turns warm and pale, as in afternoon footage
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = true; controls.minDistance = 1.6; controls.maxDistance = 40;
controls.maxPolarAngle = 1.54; controls.autoRotateSpeed = 0.8;
const TARGET = new THREE.Vector3(1.0, 1.05, 0);
controls.target.copy(TARGET);

const hemi = new THREE.HemisphereLight(0xb9c8e0, 0x5a4a36, 0.3); scene.add(hemi);
// a low late-afternoon sun from behind the tank's left quarter: long shadows, lit edges, dust that glows
const SUN_DIR = new THREE.Vector3(-0.62, 0.44, 0.65).normalize();
const sun = new THREE.DirectionalLight(0xffd9a6, 3.0);
sun.position.copy(SUN_DIR).multiplyScalar(18).add(new THREE.Vector3(1, 0, 0)); sun.target.position.set(1, 0, 0);
scene.add(sun, sun.target);
sun.castShadow = true;
const sm = smallScreen ? 1024 : matchMedia('(pointer:coarse)').matches ? 2048 : 3072; sun.shadow.mapSize.set(sm, sm);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 2, far: 50 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
const sunU = new THREE.Vector3(0, 1, 0).cross(SUN_DIR).normalize(), sunV = SUN_DIR.clone().cross(sunU), sunF = new THREE.Vector3(), sunT = new THREE.Vector3();
function aimSun() {                // on the ground where the camera looks, moved in whole shadow-map texels so edges do not crawl
  camera.getWorldDirection(sunT);
  const k = sunT.y < -0.02 ? Math.min(30, camera.position.y / -sunT.y) : 18;
  sunF.copy(camera.position).addScaledVector(sunT, k); sunF.y = 0;
  const lim = Math.hypot(sunF.x, sunF.z); if (lim > 34) sunF.multiplyScalar(34 / lim);
  const tx = 26 / sm, a = Math.round(sunF.dot(sunU) / tx) * tx, b = Math.round(sunF.dot(sunV) / tx) * tx;
  sun.target.position.copy(sunU).multiplyScalar(a).addScaledVector(sunV, b);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 22);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
}
const fillLight = new THREE.DirectionalLight(0xa9c0e8, 0.55); fillLight.position.set(8, 5, -9); scene.add(fillLight);   // cool skylight on the shadow side

/* ================= the film look: the scene is rendered linear, then graded like footage ================= */
// ACES response, warm highlights against cooler shadows, a touch of bloom on hot metal and glass, lens fall-off at
// the edges, fine grain, and letterbox bars while the crossing is being filmed
const FS_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const gl2 = renderer.capabilities.isWebGL2;
const rtType = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: rtType, samples: gl2 ? 4 : 0 });
const bloomRT = [0, 1].map(() => new THREE.WebGLRenderTarget(4, 4, { type: rtType }));
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsScene = new THREE.Scene(), fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
fsQuad.frustumCulled = false; fsScene.add(fsQuad);
const fsMat = (uniforms, fragmentShader) => new THREE.ShaderMaterial({ uniforms, vertexShader: FS_VS, fragmentShader, depthTest: false, depthWrite: false });
const brightMat = fsMat({ tSrc: { value: null } }, `uniform sampler2D tSrc; varying vec2 vUv;
  void main(){ vec3 c = min(texture2D(tSrc, vUv).rgb, vec3(3.0)); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(1.2, 2.8, l), 1.0); }`);
const blurMat = fsMat({ tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
    c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
    c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
    gl_FragColor = vec4(c, 1.0); }`);
const aoOK = gl2 && !!THREE.DepthTexture;
const depthRT = aoOK ? new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true }) : null;
if (depthRT) { depthRT.depthTexture = new THREE.DepthTexture(4, 4); depthRT.depthTexture.type = THREE.UnsignedIntType; depthRT.depthTexture.minFilter = depthRT.depthTexture.magFilter = THREE.NearestFilter; }
const aoRT = [0, 1].map(() => new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }));
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const coarse = matchMedia('(pointer:coarse)').matches;
const aoMat = fsMat({ tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPi: { value: new THREE.Matrix4() }, uPy: { value: 1 } }, `
  uniform sampler2D tDepth; uniform vec2 uRes; uniform mat4 uPi; uniform float uPy; varying vec2 vUv;
  const float R = 0.42;
  vec3 vp(vec2 uv){ vec4 c = uPi * vec4(uv * 2.0 - 1.0, textureLod(tDepth, uv, 0.0).x * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
  void main(){
    if (texture2D(tDepth, vUv).x >= 0.9999) { gl_FragColor = vec4(1.0); return; }
    vec3 P = vp(vUv); vec2 e = 1.0 / uRes;
    vec3 dx1 = vp(vUv + vec2(e.x, 0.0)) - P, dx2 = P - vp(vUv - vec2(e.x, 0.0)), dy1 = vp(vUv + vec2(0.0, e.y)) - P, dy2 = P - vp(vUv - vec2(0.0, e.y));
    vec3 N = normalize(cross(abs(dx1.z) < abs(dx2.z) ? dx1 : dx2, abs(dy1.z) < abs(dy2.z) ? dy1 : dy2));
    float rad = min(0.16, R * uPy * 0.5 / -P.z), a0 = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832, ao = 0.0, asp = uRes.y / uRes.x;
    const int N_S = ${coarse ? 8 : 14};
    for (int i = 0; i < N_S; i++) {
      float t = (float(i) + 0.5) / float(N_S), a = a0 + float(i) * 2.39996;
      vec3 V = vp(vUv + vec2(cos(a) * asp, sin(a)) * rad * sqrt(t)) - P;
      float vv = dot(V, V);
      ao += max(0.0, dot(V, N) - 0.0035 * -P.z) / (vv + 0.004) * max(0.0, 1.0 - vv / (R * R * 1.4));
    }
    ao = max(0.0, 1.0 - 1.15 * ao / float(N_S));
    gl_FragColor = vec4(vec3(mix(1.0, sqrt(ao) * ao, exp(-length(P) * 0.022))), 1.0);
  }`);
const aoBlurMat = fsMat({ tSrc: { value: null }, tDepth: { value: null }, uDir: { value: new THREE.Vector2() }, uN: { value: 0.1 }, uF: { value: 300 } }, `
  uniform sampler2D tSrc, tDepth; uniform vec2 uDir; uniform float uN, uF; varying vec2 vUv;
  float lz(vec2 uv){ float d = textureLod(tDepth, uv, 0.0).x * 2.0 - 1.0; return 2.0 * uN * uF / (uF + uN - d * (uF - uN)); }
  void main(){
    float z = lz(vUv), sum = texture2D(tSrc, vUv).r * 2.0, w = 2.0;
    for (int i = 1; i <= 3; i++) for (int s = -1; s <= 1; s += 2) {
      vec2 q = vUv + uDir * float(i * s);
      float k = (4.0 - float(i)) / 3.0 * step(abs(lz(q) - z), 0.03 + z * 0.012);
      sum += textureLod(tSrc, q, 0.0).r * k; w += k;
    }
    gl_FragColor = vec4(vec3(sum / w), 1.0);
  }`);
const gradeMat = fsMat({ tAO: { value: null }, uAO: { value: 0 }, tScene: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uExp: { value: 1 }, uBars: { value: 0 } }, `
  uniform sampler2D tScene, tBloom, tAO; uniform vec2 uRes; uniform float uTime, uExp, uBars, uAO; varying vec2 vUv;
  vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 c){
    const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    return clamp(O * rrt(I * (c / 0.6)), 0.0, 1.0); }
  vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 d = vUv - 0.5, ca = d * dot(d, d) * 0.010;
    vec3 c = vec3(texture2D(tScene, vUv - ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv + ca).b);
    c *= mix(1.0, texture2D(tAO, vUv).r, uAO);
    c += texture2D(tBloom, vUv).rgb * 0.45;
    c = aces(c * uExp);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= mix(vec3(0.93, 0.99, 1.06), vec3(1.05, 1.0, 0.90), smoothstep(0.05, 0.65, l));   // split tone
    c = clamp(mix(vec3(l), c, 0.94), 0.0, 1.0);                                          // slightly muted, like broadcast footage
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);                                             // more bite in the mid-tones
    float asp = uRes.x / uRes.y, v = length(d * vec2(asp, 1.0)) / (0.5 * sqrt(asp * asp + 1.0));
    c *= 1.0 - 0.22 * smoothstep(0.42, 1.0, v);                                           // lens fall-off
    c = srgb(c) + (hash(vUv * uRes + fract(uTime * 7.13) * 113.0) - 0.5) * 0.03;            // grain
    float bar = uBars * min(0.12, max(0.0, (uRes.y - uRes.x / 2.39) * 0.5) / uRes.y);
    if (vUv.y < bar || vUv.y > 1.0 - bar) c = vec3(0.0);
    gl_FragColor = vec4(c, 1.0);
  }`);
let renderW = 4, renderH = 4;
function sizeTargets(w, h) {
  const pr = renderer.getPixelRatio(); renderW = Math.max(4, Math.round(w * pr)); renderH = Math.max(4, Math.round(h * pr));
  sceneRT.setSize(renderW, renderH); bloomRT.forEach(r => r.setSize(Math.max(2, renderW >> 2), Math.max(2, renderH >> 2)));
  gradeMat.uniforms.uRes.value.set(renderW, renderH);
  const aw = Math.max(2, renderW >> 1), ah = Math.max(2, renderH >> 1);
  if (depthRT) { depthRT.setSize(aw, ah); aoRT.forEach(r => r.setSize(aw, ah)); aoMat.uniforms.uRes.value.set(aw, ah); }
}
function fsPass(mat, target) { fsQuad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }
let aoOn = aoOK;
const aoHidden = [];
function renderAO() {
  // solid things only: smoke, decals, glass-thin sprites have no depth to shade with
  aoHidden.length = 0;
  scene.traverseVisible(o => { if (o.isSprite || (o.material && !Array.isArray(o.material) && (o.material.transparent || !o.material.depthWrite))) aoHidden.push(o); });
  aoHidden.forEach(o => { o.visible = false; });
  scene.overrideMaterial = depthOnly; renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera); scene.overrideMaterial = null;
  aoHidden.forEach(o => { o.visible = true; });
  const u = aoMat.uniforms; u.tDepth.value = depthRT.depthTexture; u.uPi.value.copy(camera.projectionMatrixInverse); u.uPy.value = camera.projectionMatrix.elements[5];
  fsPass(aoMat, aoRT[0]);
  const b = aoBlurMat.uniforms; b.tDepth.value = depthRT.depthTexture; b.uN.value = camera.near; b.uF.value = camera.far;
  b.tSrc.value = aoRT[0].texture; b.uDir.value.set(1 / aoRT[0].width, 0); fsPass(aoBlurMat, aoRT[1]);
  b.tSrc.value = aoRT[1].texture; b.uDir.value.set(0, 1 / aoRT[0].height); fsPass(aoBlurMat, aoRT[0]);
}
function renderFrame() {
  aimSun();
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
  // metal cut away round the driver's eye is only cut in its paint: the depth would still have it
  const ao = aoOn && !EYE_CUT.value.w;
  if (ao) renderAO();
  gradeMat.uniforms.uAO.value = ao ? 1 : 0; gradeMat.uniforms.tAO.value = aoRT[0].texture;
  brightMat.uniforms.tSrc.value = sceneRT.texture; fsPass(brightMat, bloomRT[0]);
  blurMat.uniforms.tSrc.value = bloomRT[0].texture; blurMat.uniforms.uDir.value.set(1 / bloomRT[0].width, 0); fsPass(blurMat, bloomRT[1]);
  blurMat.uniforms.tSrc.value = bloomRT[1].texture; blurMat.uniforms.uDir.value.set(0, 1 / bloomRT[0].height); fsPass(blurMat, bloomRT[0]);
  gradeMat.uniforms.tScene.value = sceneRT.texture; gradeMat.uniforms.tBloom.value = bloomRT[0].texture; gradeMat.uniforms.uTime.value = time;
  fsPass(gradeMat, null);
}

/* sky: a hazy afternoon gradient with a sun glow; the same sky lights the scene through image-based lighting */
const SKY = {
  light: { zen: [0.24, 0.36, 0.58], mid: [0.58, 0.64, 0.72], hor: [1.02, 0.86, 0.68], grd: [0.16, 0.13, 0.10], glow: [1.0, 0.72, 0.42], exp: 1.05, sun: 3.2, hemi: 0.42 },
  dark: { zen: [0.10, 0.16, 0.30], mid: [0.30, 0.33, 0.40], hor: [0.85, 0.60, 0.42], grd: [0.10, 0.085, 0.07], glow: [1.0, 0.62, 0.32], exp: 1.02, sun: 2.5, hemi: 0.34 },
};
function skyColor(p, d, out) {                // linear sky radiance in direction d
  const h = d.y, m = Math.max(0, d.dot(SUN_DIR));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  let c = h > 0 ? (h < 0.25 ? mix(p.hor, p.mid, h / 0.25) : mix(p.mid, p.zen, Math.min(1, (h - 0.25) / 0.6))) : mix(p.hor, p.grd, Math.min(1, -h / 0.12));
  const g = (Math.pow(m, 6) * 0.55 + Math.pow(m, 48) * 1.6) * (h > -0.05 ? 1 : 0);
  return out.setRGB(c[0] + p.glow[0] * g, c[1] + p.glow[1] * g, c[2] + p.glow[2] * g);
}
function skyGeo(radius, p, withSun) {
  const geo = new THREE.SphereGeometry(radius, 64, 32), pos = geo.attributes.position, col = [], d = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize(); skyColor(p, d, c);
    if (withSun) { const m = Math.max(0, d.dot(SUN_DIR)); c.r += Math.pow(m, 900) * 40; c.g += Math.pow(m, 900) * 36; c.b += Math.pow(m, 900) * 30; }
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
const pmrem = new THREE.PMREMGenerator(renderer), envCache = {};
function skyEnv(dark) {
  if (envCache[dark]) return envCache[dark];
  const s = new THREE.Scene(), p = SKY[dark ? 'dark' : 'light'];
  s.add(new THREE.Mesh(skyGeo(10, p, true), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  envCache[dark] = pmrem.fromScene(s, 0.02).texture;
  return envCache[dark];
}
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
skyDome.renderOrder = -1; scene.add(skyDome);
// soft contact shadow: the ambient light cannot get under a tank or a car
const aoTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
function aoDecal(w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, color: 0x000000 }));
  m.renderOrder = 1; return m;
}
const tankAO = aoDecal(8.6, 4.6); tankAO.position.set(0.0, -0.011, 0); scene.add(tankAO);

/* ground: packed dirt and grit, tiling, scrolls under the tank when it drives */
const GROUND_REPEAT = 53;        // one tile is 3 m of ground
const gridCanvas = document.createElement('canvas'); gridCanvas.width = gridCanvas.height = 512;
const groundTex = new THREE.CanvasTexture(gridCanvas);
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
groundTex.encoding = THREE.sRGBEncoding; groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const groundN = new THREE.DataTexture(new Uint8Array(512 * 512 * 4), 512, 512, THREE.RGBAFormat);
groundN.wrapS = groundN.wrapT = THREE.RepeatWrapping; groundN.repeat.copy(groundTex.repeat); groundN.minFilter = THREE.LinearMipmapLinearFilter; groundN.magFilter = THREE.LinearFilter; groundN.generateMipmaps = true; groundN.anisotropy = groundTex.anisotropy;
groundN.offset = groundTex.offset;                  // scrolls with the colour
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, normalMap: groundN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, envMapIntensity: 0.3 });
groundMat.onBeforeCompile = sh => {                 // soil changes colour over metres: the tile underneath never shows as a pattern
  sh.fragmentShader = `float gN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float h00 = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), h10 = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5), h01 = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), h11 = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
      return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y); }\n` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    { vec2 gp = vUv * 0.13; float g = gN(gp) * 0.5 + gN(gp * 2.3 + 7.1) * 0.3 + gN(gp * 5.7 + 3.3) * 0.2, w = gN(gp * 1.3 + 19.0);
      diffuseColor.rgb *= 0.66 + 0.68 * g; diffuseColor.rgb *= mix(vec3(1.06, 0.99, 0.92), vec3(0.94, 1.0, 1.05), w); }`);
};
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.016; ground.receiveShadow = true; scene.add(ground);
function tileNoise(period) {
  const P = Float32Array.from({ length: period * period }, Math.random);
  return (x, y) => {
    x *= period; y *= period;
    const xi = Math.floor(x), yi = Math.floor(y); let u = x - xi, v = y - yi; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const H = (i, j) => P[((yi + j) % period) * period + ((xi + i) % period)];
    return (H(0, 0) * (1 - u) + H(1, 0) * u) * (1 - v) + (H(0, 1) * (1 - u) + H(1, 1) * u) * v;
  };
}
let snowTone = [0.86, 0.88, 0.88];
function drawGround(base) {
  const N = 512, g = gridCanvas.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const c = new THREE.Color(base), n1 = tileNoise(3), n2 = tileNoise(9), n3 = tileNoise(32), n4 = tileNoise(128);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, big = n1(u, v), mid = n2(u, v), fine = n3(u, v), grit = n4(u, v);
    let k = 1 + 0.30 * (big - 0.5) + 0.22 * (mid - 0.5) + 0.16 * (fine - 0.5) + 0.20 * (grit - 0.5);
    if (grit > 0.8) k += (grit - 0.8) * 1.4;        // light grit and small stones
    if (grit < 0.12) k -= (0.12 - grit) * 2;
    const warm = 0.04 * (mid - 0.5), o = (y * N + x) * 4;
    let r = c.r * k * (1 + warm), gg = c.g * k, bb = c.b * k * (1 - warm);
    const sv = 0.45 * big + 0.3 * mid + 0.25 * fine + 0.12 * (grit - 0.5);
    const snow = Math.min(1, Math.max(0, (sv - 0.76) / 0.07)) * (0.25 + 0.6 * grit);   // old snow lying in thin, broken, dirty patches
    if (snow > 0) { const sw = snowTone; r += (sw[0] - r) * snow; gg += (sw[1] - gg) * snow; bb += (sw[2] - bb) * snow; }
    d[o] = Math.min(255, 255 * r); d[o + 1] = Math.min(255, 255 * gg); d[o + 2] = Math.min(255, 255 * bb); d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); groundTex.needsUpdate = true;
  // the same soil as height: clods at the scale of a hand, grit at the scale of a fingernail, stones proud of it
  const H = new Float32Array(N * N), nd = groundN.image.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N, gr = n4(u, v); H[y * N + x] = 0.55 * n2(u, v) + 0.5 * n3(u, v) + 0.22 * gr + (gr > 0.8 ? (gr - 0.8) * 1.6 : 0); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N], dy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x], k = 3.2, l = 1 / Math.hypot(dx * k, dy * k, 1), o = (y * N + x) * 4;
    nd[o] = (-dx * k * l * 0.5 + 0.5) * 255; nd[o + 1] = (dy * k * l * 0.5 + 0.5) * 255; nd[o + 2] = (l * 0.5 + 0.5) * 255; nd[o + 3] = 255;
  }
  groundN.needsUpdate = true;
}
/* track marks pressed into the dirt behind the tank: grouser bars, scrolling with the ground */
const markCanvas = document.createElement('canvas'); markCanvas.width = 32; markCanvas.height = 64;
{
  const g = markCanvas.getContext('2d');
  for (let y = 0; y < 64; y++) {
    const edge = Math.min(1, Math.min(y, 63 - y) / 8);
    g.fillStyle = `rgba(30,24,16,${(0.16 * edge).toFixed(3)})`; g.fillRect(0, y, 32, 1);
    g.fillStyle = `rgba(22,17,11,${(0.34 * edge).toFixed(3)})`; g.fillRect(4, y, 9, 1);
  }
}
const markTex = new THREE.CanvasTexture(markCanvas);
markTex.wrapS = THREE.RepeatWrapping; markTex.repeat.set(40 / 0.155, 1); markTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const markCanvasR = document.createElement('canvas'); markCanvasR.width = 32; markCanvasR.height = 64;
{
  const g = markCanvasR.getContext('2d');
  for (let y = 0; y < 64; y++) {
    const edge = Math.min(1, Math.min(y, 63 - y) / 5), pad = Math.abs(y - 31.5) > 3.5 ? 1 : 0.25;
    g.fillStyle = `rgba(24,21,17,${(0.07 * edge).toFixed(3)})`; g.fillRect(0, y, 32, 1);
    g.fillStyle = `rgba(20,18,15,${(0.2 * edge * pad).toFixed(3)})`; g.fillRect(3, y, 26, 1);
  }
}
const markTexR = new THREE.CanvasTexture(markCanvasR);
markTexR.wrapS = THREE.RepeatWrapping; markTexR.repeat.copy(markTex.repeat); markTexR.anisotropy = markTex.anisotropy;
const markMat = new THREE.MeshStandardMaterial({ map: markTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
const trackMarks = [1, -1].map(s => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.6).rotateX(-Math.PI / 2).translate(-20, 0, 0), markMat);
  m.position.set(-3.2, -0.012, s * 1.40); m.receiveShadow = true; scene.add(m); return m;
});
/* Real surfaces: scanned materials and a photographed sky. Each replaces the generated one as it arrives; a page opened
   straight from disk may not read images into WebGL, and keeps the generated ones. */
const REAL = { sky: null, rustOn: { value: 0 }, tRust: { value: null }, tRustD: { value: null }, grainOn: { value: 0 } };
// relief read from a height in the fragment shader, for surfaces without normal maps or tangents
const bumpGLSL = (h, k) => `{
    float dH = (${h}) * ${k};
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), R1 = cross(sy, normal), R2 = cross(normal, sx);
    float det = dot(sx, R1); det *= gl_FrontFacing ? 1.0 : -1.0;
    normal = normalize(abs(det) * normal - sign(det) * (dFdx(dH) * R1 + dFdy(dH) * R2));
  }`;
function useRealSky() {
  const S = REAL.sky; if (!S) return;
  scene.environment = S.env; scene.background = S.fog; scene.fog.color.copy(S.fog);
  skyDome.geometry = S.geo; skyDome.material = S.mat; skyDome.rotation.y = S.rot;
  hemi.intensity *= 0.3; fillLight.intensity = 0.15; sun.intensity *= 0.72;       // the sky now lights the shadow side itself
}
function loadReal() {
  if (location.protocol === 'file:') return;
  const tl = new THREE.TextureLoader(), tex = (f, srgb, done) => tl.load('assets/' + f, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = groundTex.anisotropy; if (srgb) t.encoding = THREE.sRGBEncoding; done(t);
  });
  const onGround = t => { t.offset = groundTex.offset; t.repeat = groundTex.repeat; };
  tex('ground_diff.jpg', true, t => { onGround(t); groundMat.map = t; groundMat.needsUpdate = true; });
  tex('ground_nor.jpg', false, t => { onGround(t); groundMat.normalMap = t; groundMat.normalScale.set(1.1, 1.1); groundMat.needsUpdate = true; });
  tex('rust_diff.jpg', true, t => { REAL.tRust.value = t; REAL.rustOn.value = 1; });
  tex('rust_disp.jpg', false, t => { REAL.tRustD.value = t; REAL.grainOn.value = 1; });
  tl.load('assets/sky.png', img => {
    // the photograph's range is stored as log2(1 + v) / 17 in each channel
    const w = img.image.width, h = img.image.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img.image, 0, 0);
    const px = cx.getImageData(0, 0, w, h).data, data = new Uint16Array(w * h * 4), toH = THREE.DataUtils.toHalfFloat, half = THREE.DataUtils.fromHalfFloat, dec = new Float32Array(256);
    for (let i = 0; i < 256; i++) dec[i] = toH(Math.pow(2, i / 255 * 17) - 1);
    for (let i = 0; i < px.length; i += 4) { data[i] = dec[px[i]]; data[i + 1] = dec[px[i + 1]]; data[i + 2] = dec[px[i + 2]]; data[i + 3] = toH(1); }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    t.flipY = true; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; img.dispose();
    // where the sun is in the photograph, and how bright the sky is apart from it
    let best = -1, bi = 0, bj = 0, sum = 0, n = 0, fr = 0, fg = 0, fb = 0, fn = 0;
    for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
      const o = (j * w + i) * 4, r = half(data[o]), g = half(data[o + 1]), b = half(data[o + 2]), l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (j < h / 2 && l > best) { best = l; bi = i; bj = j; }
      if (j < h / 2 && l < 20) { sum += l; n++; }
      if (j > h * 0.46 && j < h * 0.49) { fr += r; fg += g; fb += b; fn++; }
    }
    const K = 0.5 / (sum / n), el = Math.max(0.3, Math.min(1.05, Math.PI / 2 - bj / h * Math.PI)), u = (bi + 0.5) / w, ax = -Math.cos(2 * Math.PI * u), az = Math.sin(2 * Math.PI * u);
    const rot = Math.atan2(az, ax) - Math.atan2(SUN_DIR.z, SUN_DIR.x);
    SUN_DIR.set(Math.cos(Math.atan2(SUN_DIR.z, SUN_DIR.x)) * Math.cos(el), Math.sin(el), Math.sin(Math.atan2(SUN_DIR.z, SUN_DIR.x)) * Math.cos(el)).normalize();
    sunU.set(0, 1, 0).cross(SUN_DIR).normalize(); sunV.copy(SUN_DIR).cross(sunU);
    const mat = new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }); mat.color.setScalar(K);
    const geo = new THREE.SphereGeometry(140, 64, 32), s = new THREE.Scene(), ball = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat);
    ball.rotation.y = rot; s.add(ball);
    const env = pmrem.fromScene(s, 0.01).texture;
    mat.color.setScalar(K * 0.42);        // the sky seen in frame is held below the bloom's threshold; its light on the scene is not
    REAL.sky = { env, geo, mat, rot, fog: new THREE.Color(fr, fg, fb).multiplyScalar(Math.min(K / fn, 0.42 / (Math.max(fr, fg, fb) / 1))), sunEl: el };
    useRealSky();
  });
}
function applyTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = k => cs.getPropertyValue(k).trim();
  const dark = v('--is-dark') === '1';
  const p = SKY[dark ? 'dark' : 'light'];
  skyDome.geometry.dispose(); skyDome.geometry = skyGeo(140, p, false);
  scene.background = new THREE.Color(...p.hor); scene.fog.color.setRGB(...p.hor);   // the haze is the horizon colour
  scene.environment = skyEnv(dark);
  gradeMat.uniforms.uExp.value = p.exp;
  snowTone = dark ? [0.55, 0.57, 0.6] : [0.74, 0.76, 0.77];
  drawGround(dark ? '#5a4f3e' : '#85775f');
  hemi.intensity = p.hemi; sun.intensity = p.sun; useRealSky();
}
applyTheme();
loadReal();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });


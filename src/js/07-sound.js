/* ---------- sound (Web Audio, synthesised) ---------- */
let actx = null, master = null, rumble = null, slowLP = null, audioOut = null;
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    actx = new AC(); const comp = actx.createDynamicsCompressor();
    master = actx.createGain(); master.gain.value = 0.55; slowLP = actx.createBiquadFilter(); slowLP.type = 'lowpass'; slowLP.frequency.value = 18000; master.connect(slowLP); slowLP.connect(comp); comp.connect(actx.destination); audioOut = comp;
  }
  if (actx.state !== 'running') actx.resume();
  return actx;
}
function noiseBurst(t, dur, f0, f1, vol, type) {
  const len = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = type || 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}
function boom() {
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  noiseBurst(t, 1.6, 2400, 160, 1.0);
  const o = actx.createOscillator(), og = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.55);
  og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.75);
  noiseBurst(t + 1.05, 0.12, 5200, 2600, 0.25, 'bandpass');   // autoloader: carousel indexes
  noiseBurst(t + 1.55, 0.09, 4200, 2200, 0.3, 'bandpass');    // rammer
  noiseBurst(t + 1.95, 0.14, 3000, 1500, 0.35, 'bandpass');   // breech closes
}
function setRumble(on) {
  if (on && soundOn && audio()) {
    if (rumble) return;
    const o = actx.createOscillator(), o2 = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 41; o2.type = 'square'; o2.frequency.value = 20.5;
    f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.11, actx.currentTime + 0.8);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
    rumble = { o, o2, f, g, load: 0 };
  } else if (rumble) {
    const r = rumble, t = actx.currentTime; rumble = null;
    r.g.gain.cancelScheduledValues(t); r.g.gain.setValueAtTime(r.g.gain.value, t); r.g.gain.linearRampToValueAtTime(0, t + 0.6);
    r.o.stop(t + 0.65); r.o2.stop(t + 0.65);
  }
}

['touchend', 'click'].forEach(t => document.addEventListener(t, () => { if (soundOn) audio(); }, { passive: true }));


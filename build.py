#!/usr/bin/env python
"""Builds the page from src/.

The files in src/js/ are one script split by subject: they share a single scope and run in filename order.

  python -I build.py                   the page, next to this file
  python -I build.py test              also test.html, with a step clock and internals on window.__d
  python -I build.py hosted <file>     also the copy published as an artifact
  python -I build.py lan <dir>         also a copy for the local network, without web fonts or CDN scripts
"""
import glob, io, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(sys.argv[0]))
PAGE = os.path.join(HERE, "ZTZ-96A 主战坦克（实车外形）.html")
THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"
ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js"


def read(path):
    return io.open(path, encoding='utf-8', newline='').read()


def write(path, text):
    io.open(path, 'w', encoding='utf-8', newline='').write(text)


def once(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)


def page():
    js = ''.join(read(p) for p in sorted(glob.glob(os.path.join(HERE, 'src', 'js', '*.js'))))
    s = read(os.path.join(HERE, 'src', 'page.html'))
    s = once(s, '/*@@CSS@@*/\n', read(os.path.join(HERE, 'src', 'style.css')))
    return once(s, '/*@@JS@@*/\n', js)


def test(s):
    s = once(s, "/* ---------- the car: a lofted", "window.__d={get wrecks(){return wrecks},setSweeps(n){SHELL_SWEEPS=n},get BEND_N(){return BEND_N},newCar,shellGround,get look(){return look},carried,beltLo,beltHi,get grassCost(){return grassCost},get perfAvg(){return perfAvg},get shCost(){return shCost},shellEnergy,shellCarStep,shellFrame,shellSelf,shellStep,beltAt,belts,beltPh,LPs,LINKS,get time(){return time},hull,wd,get car(){return car},get speed(){return speed},get auto(){return auto},get queue(){return queue},get rec(){return rec},get replay(){return replay},get shake(){return shake},get camMode(){return camMode},camera,controls,scene,endShots};\n/* ---------- the car: a lofted")
    # frames run only when the test asks, each exactly 1/60 s, whether or not the pane is visible
    s = once(s, "const clock = new THREE.Clock();", "const clock = { getDelta(){ return 1/60; }, getElapsedTime(){ return window.__t||0; } };")
    return once(s, '<script src="' + THREE_URL, '<script>window.addEventListener("error",e=>{window.__err=e.message+" @"+e.lineno});window.__q=[];window.requestAnimationFrame=c=>{window.__q.push(c);return 1};window.__step=n=>{for(let i=0;i<n;i++){window.__t=(window.__t||0)+1/60;const q=window.__q;window.__q=[];q.forEach(c=>c(window.__t*1000));}};</script>\n<script src="' + THREE_URL)


def hosted(s):
    head, rest = s.split('\n', 1)
    assert head.startswith('<!doctype html>') and rest.startswith('<title>')
    rest = once(rest, '<button class="rigbtn" id="clip" disabled>', '<button class="rigbtn" id="clip" disabled hidden>').rstrip()
    assert rest.endswith('</body></html>')
    return rest[:-len('</body></html>')]


def lan(s):
    s = once(once(s, THREE_URL, 'three.min.js'), ORBIT_URL, 'OrbitControls.js')
    s, n = re.subn(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*', '', s)
    assert n >= 1
    assert not re.findall(r'https?://[^"\')\s]+', s)
    return s


if __name__ == '__main__':
    s = page()
    write(PAGE, s)
    a = sys.argv[1:]
    while a:
        k = a.pop(0)
        if k == 'test': write(os.path.join(HERE, 'test.html'), test(s))
        elif k == 'hosted': write(a.pop(0), hosted(s))
        elif k == 'lan':
            d = a.pop(0); write(os.path.join(d, 'index.html'), lan(s))
            shutil.copytree(os.path.join(HERE, 'assets'), os.path.join(d, 'assets'), dirs_exist_ok=True)
        else: sys.exit('unknown: ' + k)
    print('built', len(s), 'chars')

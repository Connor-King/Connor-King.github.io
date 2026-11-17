// Home hero: a real-time voxel heightfield (a nod to the DirectX open-world project).
// Heights come from value-noise fBm evaluated per instance in the vertex shader,
// the cursor raises terrain under it, a click/tap fires a shockwave, and a
// lidar-style scan band sweeps the field. Paused off-screen; DPR capped.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const hero = document.querySelector(".hero");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const fxOff = () => document.documentElement.classList.contains("fx-off");

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}

if (hero && webglOK()) init();

function init() {
  const small = window.matchMedia("(max-width: 720px)").matches;
  const N = small ? 34 : 64;              // cells per side
  const SPACING = 1.0;

  const canvas = document.createElement("canvas");
  canvas.className = "hero-canvas";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const frameEl = document.createElement("div"); frameEl.className = "hero-frame"; frameEl.setAttribute("aria-hidden", "true"); hero.appendChild(frameEl);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  const geo = new THREE.BoxGeometry(SPACING * 0.9, 1, SPACING * 0.9);
  geo.translate(0, 0.5, 0);
  const grid = new Float32Array(N * N * 2);

  for (let z = 0, i = 0; z < N; z++) for (let x = 0; x < N; x++, i++) {
    grid[i * 2] = x - (N - 1) / 2;
    grid[i * 2 + 1] = z - (N - 1) / 2;
  }
  const igeo = new THREE.InstancedBufferGeometry();
  igeo.index = geo.index;
  igeo.setAttribute("position", geo.getAttribute("position"));
  igeo.setAttribute("normal", geo.getAttribute("normal"));
  igeo.setAttribute("uv", geo.getAttribute("uv"));
  igeo.setAttribute("aGrid", new THREE.InstancedBufferAttribute(grid, 2));
  igeo.instanceCount = N * N;

  const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(9999, 9999) },
    uMouseAmt: { value: 0 },
    uWave: { value: new THREE.Vector3(0, 0, -100) }, // x, z, start time
    uDebug: { value: 0 },
    uHalf: { value: (N - 1) / 2 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */`
      attribute vec2 aGrid;
      uniform float uTime, uMouseAmt, uHalf;
      uniform vec2 uMouse;
      uniform vec3 uWave;
      varying vec3 vLocal; varying vec3 vN; varying float vH; varying float vHot; varying vec3 vWorld; varying float vWave;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec2 g = aGrid;
        float t = uTime;
        float n = fbm(g * 0.075 + vec2(t * 0.035, t * 0.02));
        float h = pow(smoothstep(0.2, 0.85, n), 1.4) * 10.0;
        float d = distance(g, uMouse);
        float hot = exp(-d*d / 22.0) * uMouseAmt;
        h += hot * 5.5;
        float age = t - uWave.z;
        float r = age * 16.0;
        float wd = distance(g, uWave.xy) - r;
        float wave = exp(-wd*wd / 6.0) * exp(-age * 0.9) * step(0.0, age);
        h += wave * 4.0;
        float edgeFade = smoothstep(uHalf, uHalf * 0.55, max(abs(g.x), abs(g.y)));
        h = floor(h * 2.0) / 2.0 + 0.15;           // quantise: voxel steps
        h *= mix(0.25, 1.0, edgeFade);
        vec3 p = position; p.y *= h;
        p.xz += g;
        vLocal = position; vN = normal; vH = h; vHot = hot + wave; vWave = wave;
        vec4 w = modelMatrix * vec4(p, 1.0); vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uDebug, uHalf;
      varying vec3 vLocal; varying vec3 vN; varying float vH; varying float vHot; varying vec3 vWorld; varying float vWave;
      void main(){
        vec3 deep = vec3(0.02, 0.05, 0.09);
        vec3 cyan = vec3(0.0, 0.78, 1.0);
        vec3 mint = vec3(0.0, 1.0, 0.78);
        vec3 violet = vec3(0.48, 0.36, 1.0);
        float hn = clamp(vH / 8.0, 0.0, 1.0);
        // edges of each voxel face (in local box space)
        vec3 q = abs(vLocal - vec3(0.0, 0.5, 0.0)) * vec3(2.0/0.9, 2.0, 2.0/0.9);
        vec3 aN = abs(vN);
        vec2 f = aN.y > 0.5 ? q.xz : (aN.x > 0.5 ? vec2(q.z, q.y) : q.xy);
        float worldY = vLocal.y * vH;

        float edge = smoothstep(0.86, 0.98, max(f.x, aN.y > 0.5 ? f.y : 0.0));
        edge = max(edge, smoothstep(0.86, 0.98, f.x));
        float top = step(0.5, vN.y);
        vec3 base = mix(deep, mix(violet * 0.35, cyan * 0.55, hn), hn * 0.9);
        base *= mix(0.55, 1.0, top);
        float scanX = mod(uTime * 9.0, uHalf * 4.0) - uHalf * 2.0;
        float scan = exp(-pow(vWorld.x - scanX, 2.0) / 3.0);
        vec3 lineCol = mix(cyan, mint, clamp(vHot, 0.0, 1.0));
        vec3 col = base + lineCol * edge * (0.35 + hn * 0.9 + vHot * 1.4);
        col += cyan * scan * (0.25 + edge * 0.8) * top;
        col += mint * vWave * 0.6 * top;
        col += cyan * vHot * 0.25 * top;
        float alpha = 1.0;
        if (uDebug > 0.5) { col = lineCol * edge * 1.4 + base * 0.15; alpha = max(edge, 0.15); }
        float fog = smoothstep(18.0, 70.0, length(vWorld - cameraPosition));
        col = mix(col, vec3(0.02, 0.03, 0.05), fog);
        gl_FragColor = vec4(col, alpha * (1.0 - fog * 0.6));
      }`,
  });
  const mesh = new THREE.Mesh(igeo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Camera rig
  const target = new THREE.Vector3(small ? 0 : 8, 0, 0);
  let camAngle = -0.65, camTilt = 0, camDist = small ? 42 : 46;
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  function placeCamera() {
    const a = camAngle + ptr.sx * 0.18;
    const elev = 0.62 + ptr.sy * 0.08;
    camera.position.set(
      target.x + Math.sin(a) * Math.cos(elev) * camDist,
      Math.sin(elev) * camDist,
      target.z + Math.cos(a) * Math.cos(elev) * camDist
    );
    camera.lookAt(target);
  }

  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 720 ? 55 : 42;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(hero);

  // Cursor -> grid plane
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  let mouseAmtTarget = 0;
  function toGrid(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, z: hit.z };
  }
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType === "touch") return;
    const g = toGrid(e.clientX, e.clientY);
    if (g) { uniforms.uMouse.value.set(g.x, g.z); mouseAmtTarget = 1; }
  });
  hero.addEventListener("pointerleave", () => { mouseAmtTarget = 0; });
  hero.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button")) return;
    const g = toGrid(e.clientX, e.clientY);
    if (g) pulse(g.x, g.z);
  });
  let pulses = 0;
  function pulse(x, z) {
    uniforms.uWave.value.set(x, z, uniforms.uTime.value);
    pulses++;
    if (hud) hud.pulses.textContent = String(pulses).padStart(3, "0");
    if (!running) renderOnce();
  }
  window.addEventListener("sim:debug", (e) => { uniforms.uDebug.value = e.detail ? 1 : 0; if (!running) renderOnce(); });
  window.addEventListener("sim:pulse", () => pulse((Math.random() - .5) * N * .5, (Math.random() - .5) * N * .5));

  // HUD
  const hudEl = document.createElement("div");
  hudEl.className = "hud";
  hudEl.setAttribute("aria-hidden", "true");
  hudEl.innerHTML =
    '<div class="row"><span>SIM</span><b>VOXEL FIELD</b></div>' +
    '<div class="row"><span>CELLS</span><b>' + (N * N).toLocaleString("en-GB") + '</b></div>' +
    '<div class="row"><span>FPS</span><b data-k="fps">--</b></div>' +
    '<div class="row opt"><span>CURSOR</span><b data-k="cur">--</b></div>' +
    '<div class="row opt"><span>PULSES</span><b data-k="pulses">000</b></div>' +
    '<div class="hint">' + (window.matchMedia("(hover: none)").matches ? "TAP TO PULSE" : "MOVE / CLICK TO PULSE") + '</div>';
  hero.appendChild(hudEl);
  const hud = { fps: hudEl.querySelector('[data-k="fps"]'), cur: hudEl.querySelector('[data-k="cur"]'), pulses: hudEl.querySelector('[data-k="pulses"]') };
  if (!small) { const cue = document.createElement("div"); cue.className = "scroll-cue"; cue.setAttribute("aria-hidden", "true"); hero.appendChild(cue); }

  // Loop
  const clock = new THREE.Clock();
  let running = false, visible = true, raf = 0, frames = 0, fpsT = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    uniforms.uMouseAmt.value += (mouseAmtTarget - uniforms.uMouseAmt.value) * Math.min(1, dt * 4);
    ptr.sx += (ptr.x - ptr.sx) * Math.min(1, dt * 2.5);
    ptr.sy += (ptr.y - ptr.sy) * Math.min(1, dt * 2.5);
    camAngle += dt * 0.02;
    placeCamera();
    renderer.render(scene, camera);
    frames++; fpsT += dt;
    if (fpsT > 0.5) {
      hud.fps.textContent = Math.round(frames / fpsT);
      const m = uniforms.uMouse.value;
      hud.cur.textContent = uniforms.uMouseAmt.value > 0.1 ? m.x.toFixed(1) + ", " + m.y.toFixed(1) : "--";
      frames = 0; fpsT = 0;
    }
  }
  function renderOnce() { uniforms.uTime.value += 0.0001; placeCamera(); renderer.render(scene, camera); }
  function update() {
    const want = visible && !document.hidden && !reduce.matches && !fxOff();
    if (want && !running) { running = true; clock.getDelta(); frame(); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
    if (!want) { hud.fps.textContent = reduce.matches || fxOff() ? "PAUSED" : "--"; renderOnce(); }
  }
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; update(); }, { threshold: 0 }).observe(hero);
  document.addEventListener("visibilitychange", update);
  reduce.addEventListener && reduce.addEventListener("change", update);
  window.addEventListener("sim:fx", update);

  uniforms.uTime.value = 12.0;
  placeCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(() => canvas.classList.add("ready"));
  update();
  // intro: a pulse from the centre once it fades in
  if (!reduce.matches && !fxOff()) setTimeout(() => pulse(4, 0), 500);
}

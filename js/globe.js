import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const RADIUS = 1.55;
const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
let scene;
let camera;
let controls;
let overlay;
let animId;
let canvasEl;
let resizeObserver;

function latLonToVec(lat, lon, radius = RADIUS) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function makeTube(from, to, color) {
  const dir = to.clone().sub(from);
  const length = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, length, 10),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function makeMarker(position, color, size = 0.045) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 14, 14),
    new THREE.MeshBasicMaterial({ color, depthWrite: false })
  );
  mesh.position.copy(position);
  return mesh;
}

function clearOverlay() {
  if (!overlay) return;
  while (overlay.children.length) {
    const child = overlay.children[0];
    overlay.remove(child);
    child.geometry?.dispose();
    child.material?.dispose();
  }
}

function sizeToCanvas() {
  if (!canvasEl || !renderer || !camera) return;
  const width = canvasEl.clientWidth || 320;
  const height = canvasEl.clientHeight || 320;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function tick() {
  animId = requestAnimationFrame(tick);
  controls?.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

async function mount(canvas) {
  if (canvasEl === canvas && renderer) {
    sizeToCanvas();
    return;
  }
  dispose();
  canvasEl = canvas;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 320;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 40);
  camera.position.set(0.15, 0.35, 4.15);

  controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.5;
  controls.maxDistance = 6.5;
  controls.autoRotate = !reduceMotion();
  controls.autoRotateSpeed = 0.55;

  scene.add(new THREE.AmbientLight(0x9aabbb, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(3.2, 1.8, 4.4);
  scene.add(key);

  let texture = null;
  try {
    texture = await new THREE.TextureLoader().loadAsync("assets/earth.jpg");
    texture.colorSpace = THREE.SRGBColorSpace;
  } catch {
    texture = null;
  }
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 64, 48),
    new THREE.MeshPhongMaterial({
      map: texture || undefined,
      color: texture ? 0xffffff : 0x3e7d8b,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      shininess: 12,
    })
  );
  scene.add(globe);

  overlay = new THREE.Group();
  scene.add(overlay);

  resizeObserver = new ResizeObserver(sizeToCanvas);
  resizeObserver.observe(canvas);
  tick();
}

function setPrompt(city) {
  if (!overlay) return;
  clearOverlay();
  const point = latLonToVec(city.lat, city.lon);
  overlay.add(makeMarker(point, 0xf4e4c1, 0.05));
  if (controls) controls.autoRotate = !reduceMotion();
}

function reveal({ prompt, official, guess, antipode }) {
  if (!overlay || !prompt || !antipode) return;
  clearOverlay();
  const start = latLonToVec(prompt.lat, prompt.lon);
  const exact = latLonToVec(antipode.lat, antipode.lon);
  overlay.add(makeTube(start, exact, 0x2f9e5c));
  overlay.add(makeMarker(start, 0xf4e4c1, 0.05));
  overlay.add(makeMarker(exact, 0x2f9e5c, 0.048));
  if (official) {
    const officialPoint = latLonToVec(official.lat, official.lon);
    if (officialPoint.distanceTo(exact) > 0.07) {
      overlay.add(makeMarker(officialPoint, 0x8fd4a8, 0.04));
    }
  }
  if (guess) {
    const guessPoint = latLonToVec(guess.lat, guess.lon);
    overlay.add(makeTube(start, guessPoint, 0xd6453c));
    overlay.add(makeMarker(guessPoint, 0xd6453c, 0.045));
  }
  if (controls) controls.autoRotate = false;
}

function dispose() {
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
  resizeObserver?.disconnect();
  resizeObserver = null;
  clearOverlay();
  controls?.dispose();
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  controls = null;
  overlay = null;
  canvasEl = null;
}

window.Globe = { mount, setPrompt, reveal, dispose };

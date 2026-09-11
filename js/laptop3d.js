/* ==========================================================================
   3D laptop for the experience section, loaded on demand by main.js.
   The motion follows the device on filmbot.com: scrubbed by the scroll, the
   laptop starts turned away with its lid shut and ends facing the visitor
   with the lid open and the screen on. The model is built from simple shapes
   (no model file to download) and only renders when the scroll or size changes.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const { clamp, lerp, degToRad } = THREE.MathUtils;

// Model size in scene units (1 unit ≈ 10 cm, about a 14-inch laptop)
const WIDTH = 3.2;
const DEPTH = 2.2; // depth of the base and height of the lid
const BASE_THICKNESS = 0.09;
const LID_THICKNESS = 0.045;
const HINGE_Y = BASE_THICKNESS + 0.018; // room for the keys under the shut lid
const BEZEL = { side: 0.1, top: 0.1, bottom: 0.14 };

// Keyboard rows in key widths, 15 to a row; 0 is the stacked up/down arrow pair
const KEY_ROWS = [
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1, 1, 1, 1.25, 5.5, 1.25, 1, 1, 0, 1],
];

// Scroll timeline from 0 to 1, shaped like filmbot.com's device
const START_TURN = { x: 0.5, y: 0.5, z: 0.1 }; // radians, eased back to face the camera
const LID = { shut: Math.PI / 2, open: degToRad(-8), span: [0.1, 1] };
const SCREEN_SPAN = [0.3, 0.8];
const REFLECTION_TURN = [degToRad(-50), degToRad(40)];

const FOV = 12;
const CAMERA_TILT = degToRad(6);
// How much of the CSS laptop's box the open laptop fills. It may run a little
// taller, into the gap above and the caption's margin below.
const FIT = { width: 0.96, height: 1.05 };

export async function mountLaptop(figure, { gsap, onLost }) {
  const box = figure.querySelector('.device__laptop');
  const image = figure.querySelector('.device__screen img');
  const holder = document.createElement('div');
  holder.className = 'device__gl';
  holder.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  holder.append(canvas);
  box.append(holder);

  let renderer;
  let texture;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    texture = await new THREE.TextureLoader().loadAsync(image.currentSrc || image.src);
  } catch (error) {
    renderer?.dispose();
    holder.remove();
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(-3, 5, 4);
  scene.add(light);

  const model = buildLaptop(texture, renderer.capabilities.getMaxAnisotropy());
  const pivot = new THREE.Group();
  pivot.add(model.root);
  scene.add(pivot);

  // Centre of the laptop shut and open: it turns about its own middle and stays centred
  const bounds = new THREE.Box3();
  const measure = () => {
    scene.updateMatrixWorld(true);
    return bounds.makeEmpty().expandByObject(model.base, true).expandByObject(model.lidShell, true);
  };
  model.lid.rotation.x = LID.shut;
  const shutCentre = measure().getCenter(new THREE.Vector3());
  model.lid.rotation.x = LID.open;
  const openCentre = measure().getCenter(new THREE.Vector3());
  const openSize = bounds.getSize(new THREE.Vector3());
  const open = {
    width: openSize.x,
    height: openSize.y * Math.cos(CAMERA_TILT) + openSize.z * Math.sin(CAMERA_TILT),
  };

  const ease = gsap.parseEase('power1.inOut');
  const within = (p, [from, to]) => clamp((p - from) / (to - from), 0, 1);
  function pose(p) {
    const turn = 1 - ease(p);
    const opened = ease(within(p, LID.span));
    pivot.rotation.set(START_TURN.x * turn, START_TURN.y * turn, START_TURN.z * turn);
    model.lid.rotation.x = lerp(LID.shut, LID.open, opened);
    model.root.position.lerpVectors(shutCentre, openCentre, opened).negate();
    model.screen.color.setScalar(ease(within(p, SCREEN_SPAN)));
    scene.environmentRotation.y = lerp(REFLECTION_TURN[0], REFLECTION_TURN[1], ease(p));
  }

  // Furthest the laptop reaches from the middle while it turns
  const reach = { x: 0, y: 0 };
  for (let step = 0; step <= 10; step++) {
    pose(step / 10);
    measure();
    reach.x = Math.max(reach.x, -bounds.min.x, bounds.max.x);
    reach.y = Math.max(reach.y, -bounds.min.y, bounds.max.y);
  }

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  let frame = 0;
  const render = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); });
  };

  function resize() {
    const width = holder.clientWidth;
    const height = holder.clientHeight;
    if (!width || !height || !box.clientWidth) return;
    renderer.setSize(width, height, false);
    // Scene units per CSS pixel: the open laptop fills the CSS laptop's box, and the
    // turning laptop stays on the canvas (parts nearer the camera look a bit bigger)
    const unit = Math.max(
      open.width / (box.clientWidth * FIT.width),
      open.height / (box.clientHeight * FIT.height),
      (reach.x * 2 * 1.08) / width,
      (reach.y * 2 * 1.08) / height,
    );
    const distance = (unit * height) / 2 / Math.tan(degToRad(FOV / 2));
    // Rest the open laptop on the bottom of its box so it never covers the caption:
    // any extra height goes up, into the gap under the heading
    const rise = Math.max(0, open.height * 1.04 - box.clientHeight * unit) / 2;
    camera.aspect = width / height;
    camera.near = Math.max(0.1, distance - 5);
    camera.far = distance + 5;
    camera.position.set(0, Math.sin(CAMERA_TILT), Math.cos(CAMERA_TILT)).multiplyScalar(distance);
    camera.position.y -= rise;
    camera.lookAt(0, -rise, 0);
    camera.updateProjectionMatrix();
    render();
  }

  const progress = { value: 0 };
  const tween = gsap.to(progress, {
    value: 1,
    ease: 'none',
    onUpdate: () => { pose(progress.value); render(); },
    scrollTrigger: { trigger: box, start: 'top 85%', end: 'center 50%', scrub: 0.8 },
  });
  pose(progress.value);
  resize();
  renderer.render(scene, camera);

  const resizer = new ResizeObserver(resize);
  resizer.observe(box);
  canvas.addEventListener('webglcontextlost', () => {
    tween.scrollTrigger.kill();
    tween.kill();
    resizer.disconnect();
    holder.remove();
    if (onLost) onLost();
  }, { once: true });
}

/* ---------------------------------------------------------------- Model */
function buildLaptop(texture, anisotropy) {
  const aluminium = new THREE.MeshStandardMaterial({ color: 0xc2c5ca, metalness: 0.85, roughness: 0.36 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.6 });
  // A shade lighter than the keyboard well so the keys still read
  const keycaps = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.5 });
  // Flat parts laid on another surface win the depth test against it
  const onSurface = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const root = new THREE.Group();

  // Base: aluminium deck with a keyboard, trackpad, hinge and feet
  const base = new THREE.Mesh(slab(WIDTH, DEPTH, BASE_THICKNESS, 0.14, 0.02).rotateX(-Math.PI / 2), aluminium);
  const deckY = BASE_THICKNESS + 0.0005;
  const well = new THREE.Mesh(
    flat(roundedRect(2.8, 1.16, 0.05)),
    new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, ...onSurface }),
  );
  well.position.set(0, deckY, -0.39);
  const trackpad = new THREE.Mesh(
    flat(roundedRect(1.3, 0.72, 0.06)),
    new THREE.MeshStandardMaterial({ color: 0xb2b6bc, metalness: 0.8, roughness: 0.22, ...onSurface }),
  );
  trackpad.position.set(0, deckY, 0.65);
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, WIDTH - 0.7, 24).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.6, roughness: 0.45 }),
  );
  hinge.position.set(0, HINGE_Y - 0.022, -DEPTH / 2 + 0.004);
  root.add(base, well, trackpad, hinge, keyboard(keycaps, -0.39));
  const foot = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 20);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const mesh = new THREE.Mesh(foot, rubber);
    mesh.position.set(x * (WIDTH / 2 - 0.3), -0.004, z * (DEPTH / 2 - 0.25));
    root.add(mesh);
  }

  // Lid, hinged along its bottom edge: rotation.x opens and shuts it
  const lid = new THREE.Group();
  lid.position.set(0, HINGE_Y, -DEPTH / 2);
  root.add(lid);
  const lidShell = new THREE.Mesh(
    slab(WIDTH, DEPTH, LID_THICKNESS, 0.14, 0.012).translate(0, DEPTH / 2, -LID_THICKNESS),
    aluminium,
  );
  const glassGeometry = new THREE.ShapeGeometry(roundedRect(WIDTH - 0.04, DEPTH - 0.04, 0.12), 12);
  const bezel = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.3, ...onSurface }),
  );
  bezel.position.set(0, DEPTH / 2, 0.001);

  const screenWidth = WIDTH - BEZEL.side * 2;
  const screenHeight = DEPTH - BEZEL.top - BEZEL.bottom;
  coverTop(texture, screenWidth / screenHeight);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, color: 0x000000, toneMapped: false, ...onSurface });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth, screenHeight), screenMaterial);
  screen.position.set(0, BEZEL.bottom + screenHeight / 2, 0.002);

  const webcam = new THREE.Mesh(
    new THREE.CircleGeometry(0.014, 16),
    new THREE.MeshBasicMaterial({ color: 0x1b2130, ...onSurface }),
  );
  webcam.position.set(0, DEPTH - BEZEL.top / 2, 0.002);

  // Glass over the display: black and additive, so it only adds reflections
  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x000000, roughness: 0.08, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  glass.position.set(0, DEPTH / 2, 0.004);
  lid.add(lidShell, bezel, screen, webcam, glass);

  return { root, base, lid, lidShell, screen: screenMaterial };
}

function keyboard(material, centreZ) {
  const unit = 2.68 / 15;
  const gap = 0.028;
  const rowDepths = KEY_ROWS.map((row, index) => (index === 0 ? 0.1 : 0.164));
  const keys = []; // [x, z, width, depth]
  let z = centreZ - (rowDepths.reduce((sum, depth) => sum + depth) + gap * (KEY_ROWS.length - 1)) / 2;
  KEY_ROWS.forEach((row, index) => {
    const depth = rowDepths[index];
    let x = -7.5 * unit;
    for (const size of row) {
      const span = (size || 1) * unit;
      const centreX = x + span / 2;
      if (size) {
        keys.push([centreX, z + depth / 2, span - gap, depth]);
      } else {
        const half = (depth - gap / 2) / 2;
        keys.push([centreX, z + half / 2, span - gap, half], [centreX, z + depth - half / 2, span - gap, half]);
      }
      x += span;
    }
    z += depth + gap;
  });

  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, keys.length);
  const matrix = new THREE.Matrix4();
  keys.forEach(([x, keyZ, width, depth], index) => {
    mesh.setMatrixAt(index, matrix.makeScale(width, 0.012, depth).setPosition(x, BASE_THICKNESS + 0.002, keyZ));
  });
  return mesh;
}

/* ------------------------------------------------------------- Geometry */
function roundedRect(width, height, radius) {
  const x = width / 2 - radius;
  const y = height / 2 - radius;
  const shape = new THREE.Shape();
  shape.absarc(x, y, radius, 0, Math.PI / 2);
  shape.absarc(-x, y, radius, Math.PI / 2, Math.PI);
  shape.absarc(-x, -y, radius, Math.PI, Math.PI * 1.5);
  shape.absarc(x, -y, radius, Math.PI * 1.5, Math.PI * 2);
  return shape;
}

// Rounded slab centred on x/y, from 0 to `thickness` along z, with softened edges
function slab(width, height, thickness, radius, bevel) {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(width - bevel * 2, height - bevel * 2, radius - bevel), {
    depth: thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  });
  return geometry.translate(0, 0, bevel);
}

// Shape lying face up on the x/z plane
function flat(shape) {
  return new THREE.ShapeGeometry(shape, 12).rotateX(-Math.PI / 2);
}

// Crop the screenshot like object-fit: cover, keeping its top edge
function coverTop(texture, aspect) {
  const imageAspect = texture.image.width / texture.image.height;
  if (imageAspect > aspect) {
    texture.repeat.set(aspect / imageAspect, 1);
    texture.offset.set((1 - texture.repeat.x) / 2, 0);
  } else {
    texture.repeat.set(1, imageAspect / aspect);
    texture.offset.set(0, 1 - texture.repeat.y);
  }
}

/**
 * The 3D studio viewport: renderer, lighting, camera and the object on show
 * (a product model, or a preview shape for the material library).
 *
 * Renders on demand: a frame is drawn only when something changed (camera
 * moved, material swapped, texture arrived), so an idle viewport costs
 * nothing. The floor shadow is drawn once per model, not every frame.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getGltfLoader } from './loaders';
import { toPhysical } from './slotMaterial';

const HIGHLIGHT = new THREE.Color('#d4a72c');
const VIEW_DIRECTIONS = {
  persp: new THREE.Vector3(0.58, 0.32, 0.8),
  front: new THREE.Vector3(0, 0.05, 1),
  back: new THREE.Vector3(0, 0.05, -1),
  side: new THREE.Vector3(1, 0.05, 0),
  top: new THREE.Vector3(0, 1, 0.0001),
};

/** Softbox studio: a dim room with large overhead and side panels. */
function softboxScene() {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x3a3a3a, side: THREE.BackSide }));
  room.position.y = 2;
  scene.add(room);
  const panel = (w, h, intensity, pos, rot) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }));
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    scene.add(mesh);
  };
  panel(5, 5, 4, [0, 4.9, 0], [Math.PI / 2, 0, 0]);
  panel(3, 4, 2.2, [-4.9, 2, 1], [0, Math.PI / 2, 0]);
  panel(3, 4, 1.4, [4.9, 2, -1], [0, -Math.PI / 2, 0]);
  panel(4, 2, 1, [0, 1.5, 4.9], [0, Math.PI, 0]);
  return scene;
}

function neutralScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.55, 0.55, 0.55);
  return scene;
}

export const ENVIRONMENTS = {
  studio: { label: 'Studio', build: () => new RoomEnvironment(), intensity: 1 },
  softbox: { label: 'Softbox', build: softboxScene, intensity: 1 },
  neutral: { label: 'Flat', build: neutralScene, intensity: 1.1 },
};

function disposeObject(object) {
  object.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry.dispose();
    for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      // Includes the model's own maps kept aside while a library material shows
      for (const value of [...Object.values(material), ...Object.values(material.userData.ecOriginal || {})]) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

export class StudioEngine {
  constructor(mount, { onSelect, onFrame } = {}) {
    this.mount = mount;
    this.onSelect = onSelect;
    this.onFrame = onFrame;
    this.object = null;
    this.selected = null;
    this.radius = 1;
    this.frames = [];
    // Bound first: setEnvironment() below already requests a frame
    this._render = this._render.bind(this);

    // alpha: the backdrop is CSS behind the canvas, so it costs no fill and
    // snapshots can be transparent
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);
    this.renderer = renderer;
    getGltfLoader(renderer);

    this.scene = new THREE.Scene();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envCache = {};
    this.setEnvironment('studio');

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.addEventListener('change', () => this.requestRender());

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1.5, 3, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 20;
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.01;
    this.scene.add(sun);
    this.sun = sun;

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.2 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.grid = new THREE.GridHelper(1, 20, 0x888888, 0x888888);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.25;
    this.grid.visible = false;
    this.scene.add(this.grid);

    this._resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.requestRender();
    };
    this.observer = new ResizeObserver(this._resize);
    this.observer.observe(mount);
    this._resize();

    // Click (not drag) picks a part
    this.raycaster = new THREE.Raycaster();
    let down = null;
    this._down = (e) => { down = { x: e.clientX, y: e.clientY }; };
    this._up = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      down = null;
      this.onSelect?.(this.pick(e));
    };
    renderer.domElement.addEventListener('pointerdown', this._down);
    renderer.domElement.addEventListener('pointerup', this._up);

    this.requestRender();
  }

  requestRender() {
    if (this.pending || this.disposed) return;
    this.pending = true;
    this.raf = requestAnimationFrame(this._render);
  }

  _render(now) {
    this.pending = false;
    if (this.tween) this._stepTween(now);
    // Fires 'change' (→ another frame) while damping or auto-rotating
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frames.push(now);
    while (this.frames.length && now - this.frames[0] > 1000) this.frames.shift();
    this.onFrame?.();
    if (this.tween || this.controls.autoRotate) this.requestRender();
  }

  /** Frames drawn in the last second (0 when idle). */
  get fps() {
    const now = performance.now();
    return this.frames.filter((t) => now - t <= 1000).length;
  }

  stats() {
    const info = this.renderer.info;
    return {
      triangles: info.render.triangles,
      calls: info.render.calls,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      fps: this.fps,
    };
  }

  setEnvironment(name) {
    const preset = ENVIRONMENTS[name] || ENVIRONMENTS.studio;
    if (!this.envCache[name]) {
      const source = preset.build();
      this.envCache[name] = this.pmrem.fromScene(source, 0.04).texture;
      source.traverse?.((obj) => {
        if (obj.isMesh) { obj.geometry.dispose(); obj.material.dispose(); }
      });
    }
    this.scene.environment = this.envCache[name];
    this.scene.environmentIntensity = preset.intensity;
    this.requestRender();
  }

  setExposure(value) {
    this.renderer.toneMappingExposure = value;
    this.requestRender();
  }

  setLightIntensity(value) {
    this.sun.intensity = value;
    this.requestRender();
  }

  setGrid(on) {
    this.grid.visible = on;
    this.requestRender();
  }

  setShadows(on) {
    this.floor.visible = on;
    this.requestRender();
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 1.2;
    this.requestRender();
  }

  setWireframe(on) {
    this.wireframe = on;
    this.object?.traverse((obj) => {
      if (!obj.isMesh || obj === this.floor) return;
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) m.wireframe = on;
    });
    this.requestRender();
  }

  /** Replace the object on show; frames the camera and redraws the shadow. */
  _show(object, { keepView = false } = {}) {
    if (this.object) {
      this.scene.remove(this.object);
      disposeObject(this.object);
    }
    this.selected = null;
    this.object = object;
    if (!object) {
      this.requestRender();
      return;
    }
    // Stand it on the floor, centred
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    this.size = box.getSize(new THREE.Vector3());
    this.radius = Math.max(this.size.length() / 2, 0.05);
    this.scene.add(object);
    if (this.wireframe) this.setWireframe(true);

    const r = this.radius;
    this.floor.scale.set(r * 8, r * 8, 1);
    this.grid.scale.set(r * 4, 1, r * 4);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -r * 1.6;
    cam.right = cam.top = r * 1.6;
    cam.updateProjectionMatrix();
    this.sun.position.set(r * 1.5, r * 3.2, r * 2);
    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();
    this.controls.minDistance = r * 0.6;
    this.controls.maxDistance = r * 8;
    this.camera.near = r / 100;
    this.camera.far = r * 40;
    this.camera.updateProjectionMatrix();
    if (!keepView) this.setView('persp', false);
    this.updateShadow();
  }

  /** Redraw the floor shadow (after the object or its shape changes). */
  updateShadow() {
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  /** Load a .glb; returns its meshes' materials (upgraded to physical). */
  async loadModel(url, { onProgress } = {}) {
    const started = performance.now();
    const gltf = await getGltfLoader(this.renderer).loadAsync(url, (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    });
    if (this.disposed) {
      disposeObject(gltf.scene);
      return null;
    }
    const model = gltf.scene;
    const upgraded = new Map();
    const parts = [];
    let vertices = 0;
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      vertices += obj.geometry.attributes.position?.count || 0;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      const next = list.map((m) => {
        if (!upgraded.has(m)) {
          const p = toPhysical(m);
          if (p !== m) m.dispose();
          upgraded.set(m, p);
          parts.push({ material: p, meshes: [] });
        }
        return upgraded.get(m);
      });
      obj.material = Array.isArray(obj.material) ? next : next[0];
      for (const m of next) parts.find((p) => p.material === m).meshes.push(obj);
    });
    this._show(model);
    return { parts, vertices, loadMs: Math.round(performance.now() - started), size: this.size.clone() };
  }

  /** A preview shape for the material library, with one physical material. */
  showPreview(shape = 'sphere') {
    const geometry = {
      sphere: () => new THREE.SphereGeometry(0.25, 96, 64),
      cushion: () => new RoundedBoxGeometry(0.5, 0.12, 0.45, 6, 0.05),
      cube: () => new RoundedBoxGeometry(0.4, 0.4, 0.4, 4, 0.02),
      plane: () => new THREE.BoxGeometry(0.7, 0.02, 0.5),
    }[shape] || (() => new THREE.SphereGeometry(0.25, 96, 64));
    const material = new THREE.MeshPhysicalMaterial({ color: 0xbbbbbb, roughness: 0.6 });
    const mesh = new THREE.Mesh(geometry(), material);
    mesh.castShadow = mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    this._show(group);
    if (shape === 'plane') this.setView('top', false);
    return material;
  }

  pick(event) {
    if (!this.object) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.object, true)[0];
    if (!hit) return null;
    const m = hit.object.material;
    return Array.isArray(m) ? m[hit.face?.materialIndex ?? 0] : m;
  }

  /** Tint the selected part so it reads in the viewport. */
  highlight(material) {
    if (this.selected === material) return;
    if (this.selected) {
      this.selected.emissive.copy(this.selected.userData.ecEmissive || new THREE.Color(0));
      this.selected.emissiveIntensity = this.selected.userData.ecEmissiveIntensity ?? 1;
    }
    this.selected = material || null;
    if (material) {
      material.userData.ecEmissive = material.emissive.clone();
      material.userData.ecEmissiveIntensity = material.emissiveIntensity;
      material.emissive.copy(HIGHLIGHT);
      material.emissiveIntensity = 0.35;
    }
    this.requestRender();
  }

  /** Move the camera to a preset direction, animated unless `animate` is false. */
  setView(name, animate = true) {
    const dir = (VIEW_DIRECTIONS[name] || VIEW_DIRECTIONS.persp).clone().normalize();
    const height = this.size?.y || this.radius;
    const target = new THREE.Vector3(0, name === 'top' ? 0 : height * 0.45, 0);
    const fit = this.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const position = target.clone().addScaledVector(dir, fit * 1.05);
    if (!animate) {
      this.tween = null;
      this.controls.target.copy(target);
      this.camera.position.copy(position);
      this.requestRender();
      return;
    }
    this.tween = {
      start: null,
      fromPos: this.camera.position.clone(), toPos: position,
      fromTarget: this.controls.target.clone(), toTarget: target,
    };
    this.requestRender();
  }

  _stepTween(now) {
    const t = this.tween;
    if (t.start === null) t.start = now;
    const k = Math.min((now - t.start) / 450, 1);
    const e = 1 - (1 - k) ** 3;
    this.camera.position.lerpVectors(t.fromPos, t.toPos, e);
    this.controls.target.lerpVectors(t.fromTarget, t.toTarget, e);
    if (k >= 1) this.tween = null;
  }

  /**
   * PNG data URL of the current view, `width` px wide. `background` fills
   * behind the model (null = transparent).
   */
  snapshot({ width = null, background = null } = {}) {
    if (this.selected) {
      // Snapshots never show the selection tint
      const sel = this.selected;
      this.highlight(null);
      const url = this.snapshot({ width, background });
      this.highlight(sel);
      return url;
    }
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const w = width || src.width;
    const h = Math.round((src.height / src.width) * w);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(src, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this._down);
    this.renderer.domElement.removeEventListener('pointerup', this._up);
    this.controls.dispose();
    if (this.object) disposeObject(this.object);
    Object.values(this.envCache).forEach((t) => t.dispose());
    this.pmrem.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }
}

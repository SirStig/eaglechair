/**
 * Three.js viewer for one configurable product model (.glb): orbit, studio
 * lighting, a soft floor shadow, and live upholstery / frame swaps.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SLOTS, applySlotOption, materialSlot } from './slotMaterial';

const ChairViewer = forwardRef(function ChairViewer({ url, options, settings, onSlotsFound, background = '#f4f2ee' }, ref) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [slotMaterials, setSlotMaterials] = useState(null);

  // Scene, renderer and controls live for the component's lifetime
  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    camera.position.set(1.6, 1.1, 2.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.4;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.53;

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1.5, 3, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 10;
    sun.shadow.radius = 6;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    stateRef.current = { renderer, scene, camera, controls, sun, model: null };
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      pmrem.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (stateRef.current) stateRef.current.scene.background = new THREE.Color(background);
  }, [background]);

  // Load the model, frame it and collect its configurable materials
  useEffect(() => {
    const s = stateRef.current;
    if (!s || !url) return undefined;
    let cancelled = false;
    setStatus('loading');
    setSlotMaterials(null);
    new GLTFLoader().loadAsync(url).then((gltf) => {
      if (cancelled) return;
      const model = gltf.scene;
      const found = Object.fromEntries(SLOTS.map((slot) => [slot, []]));
      model.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
          const slot = materialSlot(material);
          if (slot && !found[slot].includes(material)) found[slot].push(material);
        }
      });
      // Stand it on the floor, centred
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      const size = box.getSize(new THREE.Vector3());
      const radius = size.length() / 2;
      s.controls.target.set(0, size.y * 0.45, 0);
      s.camera.position.set(radius * 2.1, size.y * 0.95, radius * 2.9);
      s.sun.shadow.camera.left = s.sun.shadow.camera.bottom = -radius * 2;
      s.sun.shadow.camera.right = s.sun.shadow.camera.top = radius * 2;
      s.sun.shadow.camera.updateProjectionMatrix();

      if (s.model) disposeModel(s.scene, s.model);
      s.scene.add(model);
      s.model = model;
      setSlotMaterials(found);
      onSlotsFound?.(SLOTS.filter((slot) => found[slot].length));
      setStatus('ready');
    }).catch((err) => {
      console.error('Failed to load 3D model:', err);
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
    // onSlotsFound is a notification only; reloading on its identity would refetch the model
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => () => {
    const s = stateRef.current;
    if (s?.model) disposeModel(s.scene, s.model);
  }, []);

  // Apply the chosen option per slot
  useEffect(() => {
    if (!slotMaterials) return;
    for (const slot of SLOTS) {
      applySlotOption(slotMaterials[slot], options?.[slot] || null, settings?.[slot]).catch((err) => {
        console.error(`Failed to apply ${slot} option:`, err);
      });
    }
  }, [slotMaterials, options, settings]);

  useImperativeHandle(ref, () => ({
    /** PNG data URL of the current view */
    snapshot: () => {
      const s = stateRef.current;
      if (!s) return null;
      s.renderer.render(s.scene, s.camera);
      return s.renderer.domElement.toDataURL('image/png');
    },
    resetView: () => {
      const s = stateRef.current;
      if (!s?.model) return;
      const size = new THREE.Box3().setFromObject(s.model).getSize(new THREE.Vector3());
      const radius = size.length() / 2;
      s.controls.target.set(0, size.y * 0.45, 0);
      s.camera.position.set(radius * 2.1, size.y * 0.95, radius * 2.9);
    },
  }), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={mountRef} className="h-full w-full" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-dark-200">
          {status === 'loading' ? 'Loading model…' : 'This model could not be loaded.'}
        </div>
      )}
    </div>
  );
});

function disposeModel(scene, model) {
  scene.remove(model);
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry.dispose();
    for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

export default ChairViewer;

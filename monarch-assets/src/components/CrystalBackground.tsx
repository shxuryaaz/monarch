import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Subtle Three.js "crystal" background for the landing Hero.
 * - Slow auto-rotation
 * - Mouse parallax (small rotation offsets)
 * - Respects prefers-reduced-motion
 */
const CrystalBackground = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    // Still render a static background if reduced motion is enabled.
    const animateEnabled = !prefersReducedMotion;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.055);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    el.appendChild(renderer.domElement);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";

    // "Crystal burst" sphere:
    // - high detail sphere (circular base)
    // - vertex displacement to create sharp crystalline spikes
    const geometry = new THREE.SphereGeometry(1.55, 72, 72);

    // Lightweight deterministic displacement (no extra deps).
    // This creates the spiky/starburst look while keeping a circular silhouette.
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); // already on sphere
      const n = v.clone().normalize();

      // Pseudo "crystal noise" from position.
      const noise =
        Math.sin(n.x * 14.0 + n.y * 7.0 + n.z * 5.0) +
        Math.sin(n.x * 4.0 - n.y * 13.0 + n.z * 9.0) +
        Math.sin(n.x * 10.0 + n.y * 3.0 - n.z * 11.0);

      const spike = Math.pow(Math.abs(noise) / 3.0, 1.35); // 0..~1
      const amp = 0.28 * spike;
      const radius = 1.55 + amp;

      v.copy(n).multiplyScalar(radius);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();

    const crystalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      roughness: 0.08,
      metalness: 0.03,
      transmission: 0.96,
      thickness: 1.1,
      ior: 1.48,
      depthWrite: false,
      // Add a faint emission to help it read without a full environment map.
      emissive: new THREE.Color(0xbfdcff),
      emissiveIntensity: 0.22,
    });

    const mesh = new THREE.Mesh(geometry, crystalMaterial);
    mesh.scale.set(1, 1, 1);
    scene.add(mesh);

    const edges = new THREE.EdgesGeometry(geometry);
    const edgeLinesMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    edgeLinesMaterial.toneMapped = false;
    const edgeLines = new THREE.LineSegments(edges, edgeLinesMaterial);
    scene.add(edgeLines);

    // Bright points to sell the "burst/crystal" vibe.
    const pointsCount = 950;
    const pointsPos = new Float32Array(pointsCount * 3);
    const pointsColors = new Float32Array(pointsCount * 3);
    for (let i = 0; i < pointsCount; i++) {
      // Random point on a sphere.
      const u = Math.random();
      const v2 = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v2 - 1);
      const r = 1.65 + Math.random() * 0.2;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      pointsPos[i * 3 + 0] = x;
      pointsPos[i * 3 + 1] = y;
      pointsPos[i * 3 + 2] = z;

      const blueBias = Math.random();
      // Mix between white and icy-blue.
      const c = new THREE.Color().setRGB(1, 1, 1).lerp(new THREE.Color(0x86b7ff), blueBias);
      pointsColors[i * 3 + 0] = c.r;
      pointsColors[i * 3 + 1] = c.g;
      pointsColors[i * 3 + 2] = c.b;
    }

    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(pointsPos, 3));
    pointsGeometry.setAttribute("color", new THREE.BufferAttribute(pointsColors, 3));

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    pointsMaterial.toneMapped = false;

    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(3, 3, 3);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x88bbff, 1.2, 15, 2);
    rimLight.position.set(-3, -2, 2);
    scene.add(rimLight);

    const target = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };

    const onMouseMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (event.clientX - cx) / (rect.width / 2);
      const dy = (event.clientY - cy) / (rect.height / 2);
      // Clamp to avoid huge jumps on resize/orientation changes.
      mouse.x = Math.max(-1, Math.min(1, dx));
      mouse.y = Math.max(-1, Math.min(1, dy));
    };

    // Resize handling
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    let rafId = 0;
    const start = performance.now();

    const animate = () => {
      const now = performance.now();
      const t = (now - start) / 1000;

      // Slowly follow mouse without snapping.
      target.x += (mouse.x - target.x) * 0.05;
      target.y += (mouse.y - target.y) * 0.05;

      // Base rotation + small mouse offsets.
      mesh.rotation.x = t * 0.08 + target.y * 0.18;
      mesh.rotation.y = t * 0.12 + target.x * 0.22;
      edgeLines.rotation.x = mesh.rotation.x;
      edgeLines.rotation.y = mesh.rotation.y;
      points.rotation.x = mesh.rotation.x;
      points.rotation.y = mesh.rotation.y;

      // Slight float
      const floatY = Math.sin(t * 0.65) * 0.075;
      mesh.position.y = floatY;
      edgeLines.position.y = floatY;
      points.position.y = floatY;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    if (animateEnabled) rafId = requestAnimationFrame(animate);
    else {
      // Render a single frame at rest so it still looks alive.
      // (Keep rotations slightly implied by the target/mouse default.)
      mesh.rotation.x = target.y * 0.18;
      mesh.rotation.y = target.x * 0.22;
      edgeLines.rotation.x = mesh.rotation.x;
      edgeLines.rotation.y = mesh.rotation.y;
      points.rotation.x = mesh.rotation.x;
      points.rotation.y = mesh.rotation.y;
      renderer.render(scene, camera);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      ro.disconnect();
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geometry.dispose();
      crystalMaterial.dispose();
      edges.dispose();
      edgeLinesMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      el.innerHTML = "";
    };
  }, []);

  return <div ref={mountRef} className="relative h-full w-full" aria-hidden="true" />;
};

export default CrystalBackground;


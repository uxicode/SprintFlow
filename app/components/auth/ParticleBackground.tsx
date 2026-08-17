'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  isFormRevealed: boolean;
}

export default function ParticleBackground({
  isFormRevealed,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isFormRevealedRef = useRef(isFormRevealed);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    isFormRevealedRef.current = isFormRevealed;
  }, [isFormRevealed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Three.js Setup (Front View Camera)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 32);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Mouse Tracking
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current.targetX = nx * 22;
      mouseRef.current.targetY = ny * 16;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Circle Texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    const circleTexture = new THREE.CanvasTexture(canvas);

    // 2. Cascading Slide Particle Data
    const particleCount = 2400;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Slide physics arrays
    const basePositionsX = new Float32Array(particleCount);
    const slideSpeeds = new Float32Array(particleCount);
    const slideAmplitudes = new Float32Array(particleCount);
    const slideFrequencies = new Float32Array(particleCount);
    const slidePhases = new Float32Array(particleCount);

    const colorTemp = new THREE.Color();
    const slidePalette = [
      '#00f2fe',
      '#4facfe',
      '#8b5cf6',
      '#06b6d4',
      '#f09858',
      '#3b82f6',
      '#ffffff',
    ];

    for (let i = 0; i < particleCount; i++) {
      const baseX = (Math.random() - 0.5) * 65;
      const initialY = (Math.random() - 0.5) * 50;
      const zDepth = (Math.random() - 0.5) * 16;

      basePositionsX[i] = baseX;
      slideSpeeds[i] = 0.08 + Math.random() * 0.16;
      slideAmplitudes[i] = 1.5 + Math.random() * 3.5;
      slideFrequencies[i] = 0.08 + Math.random() * 0.12;
      slidePhases[i] = Math.random() * Math.PI * 2;

      positions[i * 3] = baseX;
      positions[i * 3 + 1] = initialY;
      positions[i * 3 + 2] = zDepth;

      const hex = slidePalette[Math.floor(Math.random() * slidePalette.length)];
      colorTemp.set(hex);
      const alphaDepth = 0.4 + (zDepth + 8) / 16 * 0.6;
      colors[i * 3] = colorTemp.r * alphaDepth;
      colors[i * 3 + 1] = colorTemp.g * alphaDepth;
      colors[i * 3 + 2] = colorTemp.b * alphaDepth;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.55,
      sizeAttenuation: true,
      vertexColors: true,
      map: circleTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 3. Slide Cascade Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let hoverFunnelFactor = 0;

    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      const isTargetActive = isFormRevealedRef.current;

      // Smooth funnel factor lerp when form is revealed
      if (isTargetActive) {
        hoverFunnelFactor += (1 - hoverFunnelFactor) * (delta * 3.5);
      } else {
        hoverFunnelFactor += (0 - hoverFunnelFactor) * (delta * 2.5);
      }

      // Mouse Parallax & Smooth Deflection
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      particles.rotation.y = mouseX * 0.003;

      const posArray = positionAttr.array as Float32Array;

      // Slide speed multiplier during hover funneling
      const speedMultiplier = 1 + hoverFunnelFactor * 0.6;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;

        let px = posArray[idx];
        let py = posArray[idx + 1];
        let pz = posArray[idx + 2];

        // 1. Smooth Downward Slide Gravity Motion
        py -= slideSpeeds[i] * speedMultiplier;

        // 2. Front Slide Parabolic/Sinusoidal Curve Trajectory (S-curve Slide)
        const baseX = basePositionsX[i];
        const slideCurveX =
          baseX + Math.sin(py * slideFrequencies[i] + slidePhases[i] + time * 1.2) * slideAmplitudes[i];

        // 3. Hover Funneling: Particles smoothly converge toward login card stream
        const funnelX = slideCurveX * (1 - hoverFunnelFactor * 0.5) + Math.sin(time * 3 + py * 0.15) * (1 - hoverFunnelFactor * 0.5);
        px = THREE.MathUtils.lerp(slideCurveX, funnelX, hoverFunnelFactor);

        // 4. Mouse Cursor Obstacle Deflection
        const dx = px - mouseX;
        const dy = py - mouseY;
        const distSq = dx * dx + dy * dy;

        if (distSq < 100) {
          const dist = Math.sqrt(distSq) + 0.001;
          const force = (1 - dist / 10) * 1.8;
          const pushDirection = dx >= 0 ? 1 : -1;
          px += pushDirection * force * 0.15;
          py -= force * 0.05; // Slide friction slowdown near cursor
        }

        // 5. Seamless Loop Reset when sliding past bottom threshold
        if (py < -26) {
          py = 25 + Math.random() * 6;
          px = basePositionsX[i];
        }

        posArray[idx] = px;
        posArray[idx + 1] = py;
        posArray[idx + 2] = pz;
      }

      positionAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    renderLoop();

    // Resize Handler
    let resizeTimeout: number;
    const handleResize = () => {
      if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
      resizeTimeout = requestAnimationFrame(() => {
        if (!container) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    };
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      circleTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="particle-background-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.95,
        transition: 'opacity 0.4s ease-in-out',
      }}
    />
  );
}

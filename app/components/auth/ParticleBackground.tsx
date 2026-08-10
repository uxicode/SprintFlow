'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleBackgroundProps {
  clickCount: number;
  isFormRevealed: boolean;
}

export default function ParticleBackground({
  clickCount,
  isFormRevealed,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clickCountRef = useRef(clickCount);
  const isFormRevealedRef = useRef(isFormRevealed);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Sync props to refs without triggering re-render of canvas animation
  useEffect(() => {
    clickCountRef.current = clickCount;
  }, [clickCount]);

  useEffect(() => {
    isFormRevealedRef.current = isFormRevealed;
  }, [isFormRevealed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 32;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Mouse Move Listener for Penderecki Garden Interactive Magnet Wave Effect
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse coordinates to [-1, 1]
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current.targetX = nx * 20; // 3D world space coordinate mapping
      mouseRef.current.targetY = ny * 15;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 2. Generate crisp flat solid Circle Texture programmatically
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(32, 32, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    const circleTexture = new THREE.CanvasTexture(canvas);

    // 3. Waterfall Cascade Particle Cloud Creation (Colliding & Flowing around card-compact)
    const particleCount = 1600;
    const geometry = new THREE.BufferGeometry();

    const initialPositions = new Float32Array(particleCount * 3);
    const currentPositions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3); // For assemble transition
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Waterfall Motion Physics Arrays
    const fallSpeeds = new Float32Array(particleCount);
    const xVelocities = new Float32Array(particleCount);
    const splashOffsets = new Float32Array(particleCount);
    const zDepths = new Float32Array(particleCount);

    const tempColor = new THREE.Color();

    // Vibrant flat solid color palette (Waterfall Cascading Colors)
    const flatColors = [
      '#00f2fe', // Electric Cyan (Waterfall Spray)
      '#4facfe', // Crystal Blue
      '#10b981', // Emerald Splash
      '#06b6d4', // Bright Teal
      '#3b82f6', // Ocean Blue
      '#8b5cf6', // Indigo Mist
      '#ff6b8b', // Coral Accent
      '#ffffff', // Crisp Water Foam
    ];

    for (let i = 0; i < particleCount; i++) {
      // Wide waterfall spread across screen width (X: -36 to +36)
      const x = (Math.random() - 0.5) * 72;
      // Staggered Y height from top (+15 to +35)
      const y = 15 + Math.random() * 25;

      // Deep Z-axis range (-28 to +16) for camera perspective & depth
      const zDepth = (Math.random() - 0.5) * 44;
      const depthFactor = (zDepth + 22) / 44; // 0 (far) to 1 (near)

      // Fall speed based on depth (Graceful slow motion waterfall flow)
      const fallSpeed = 0.06 + depthFactor * 0.12 + Math.random() * 0.04;

      fallSpeeds[i] = fallSpeed;
      xVelocities[i] = (Math.random() - 0.5) * 0.02;
      splashOffsets[i] = Math.random() * Math.PI * 2;
      zDepths[i] = zDepth;

      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = zDepth;

      currentPositions[i * 3] = x;
      currentPositions[i * 3 + 1] = y;
      currentPositions[i * 3 + 2] = zDepth;

      // Target positions when form is revealed: form a sleek rectangle card boundary
      let tx, ty, tz;
      if (i < particleCount * 0.7) {
        const side = Math.floor(Math.random() * 4);
        const marginX = (Math.random() - 0.5) * 18;
        const marginY = (Math.random() - 0.5) * 22;
        if (side === 0) { tx = -9; ty = marginY; tz = (Math.random() - 0.5) * 4; }
        else if (side === 1) { tx = 9; ty = marginY; tz = (Math.random() - 0.5) * 4; }
        else if (side === 2) { tx = marginX; ty = -11; tz = (Math.random() - 0.5) * 4; }
        else { tx = marginX; ty = 11; tz = (Math.random() - 0.5) * 4; }
      } else {
        const ringAngle = Math.random() * Math.PI * 2;
        const ringR = 15 + Math.random() * 14;
        tx = Math.cos(ringAngle) * ringR;
        ty = Math.sin(ringAngle) * ringR;
        tz = (Math.random() - 0.5) * 12;
      }
      targetPositions[i * 3] = tx;
      targetPositions[i * 3 + 1] = ty;
      targetPositions[i * 3 + 2] = tz;

      // Set crisp flat solid color from palette & apply Z-depth distance transparency scaling
      const hexColor = flatColors[Math.floor(Math.random() * flatColors.length)];
      tempColor.set(hexColor);

      const alphaDepth = 0.2 + Math.pow(depthFactor, 1.3) * 0.8;

      colors[i * 3] = tempColor.r * alphaDepth;
      colors[i * 3 + 1] = tempColor.g * alphaDepth;
      colors[i * 3 + 2] = tempColor.b * alphaDepth;

      // Foreground waterfall droplets are larger, background droplets are smaller
      sizes[i] = 0.35 + Math.pow(depthFactor, 1.5) * 1.3;
    }

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(currentPositions, 3)
    );
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material with sizeAttenuation: true for perspective depth rendering
    const material = new THREE.PointsMaterial({
      size: 1.25,
      sizeAttenuation: true,
      vertexColors: true,
      map: circleTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 4. Animation Loop: Waterfall Falling & Card Deflection Collision Physics
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let transitionProgress = 0; // 0 to 1 for assembly effect

    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      const currentClicks = clickCountRef.current;
      const isRevealed = isFormRevealedRef.current;

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      const clickSpeedMultiplier = 1 + currentClicks * 0.2;

      // Slight camera tilt with mouse
      particles.rotation.y = mouseX * 0.008;
      particles.rotation.x = -mouseY * 0.008;

      const posArray = positionAttr.array as Float32Array;

      if (isRevealed) {
        // Transition towards target positions (Magnetic Waterfall Suction Gathering)
        if (transitionProgress < 1) {
          transitionProgress += delta * 0.6;
          if (transitionProgress > 1) transitionProgress = 1;
        }

        if (transitionProgress < 0.65) {
          material.opacity = 0.95;
        } else {
          const fadeProgress = (transitionProgress - 0.65) / 0.35;
          material.opacity = THREE.MathUtils.lerp(0.95, 0, fadeProgress);
        }

        const ease =
          transitionProgress < 0.5
            ? 4 * transitionProgress * transitionProgress * transitionProgress
            : 1 - Math.pow(-2 * transitionProgress + 2, 3) / 2;

        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          const startX = posArray[idx];
          const startY = posArray[idx + 1];
          const startZ = posArray[idx + 2];

          const targetX = targetPositions[idx];
          const targetY = targetPositions[idx + 1];
          const targetZ = targetPositions[idx + 2];

          const swirl = (1 - transitionProgress) * Math.sin(time * 5 + i * 0.1) * 2.0;

          posArray[idx] = THREE.MathUtils.lerp(startX, targetX, ease) + swirl;
          posArray[idx + 1] = THREE.MathUtils.lerp(startY, targetY, ease) + swirl;
          posArray[idx + 2] = THREE.MathUtils.lerp(startZ, targetZ, ease);
        }
      } else {
        // Disassemble or Waterfall Cascade Physics Mode
        if (transitionProgress > 0) {
          transitionProgress -= delta * 1.0;
          if (transitionProgress < 0) transitionProgress = 0;

          material.opacity = THREE.MathUtils.lerp(0.85, 0.95, 1 - transitionProgress);

          const ease = Math.pow(transitionProgress, 2);

          for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;
            const targetX = targetPositions[idx];
            const targetY = targetPositions[idx + 1];
            const targetZ = targetPositions[idx + 2];

            const explodeOffset = (1 - transitionProgress) * (Math.random() - 0.5) * 6;

            posArray[idx] = THREE.MathUtils.lerp(initialPositions[idx], targetX, ease) + explodeOffset;
            posArray[idx + 1] = THREE.MathUtils.lerp(initialPositions[idx + 1], targetY, ease) + explodeOffset;
            posArray[idx + 2] = THREE.MathUtils.lerp(initialPositions[idx + 2], targetZ, ease);
          }
        } else {
          // INFINITE WATERFALL CASCADE & CARD TOP SPLATTER DEFLECTION PHYSICS
          material.opacity = 0.9;

          // Card bounding box dimensions in 3D world coordinates
          const cardWidth = 7.5;  // Half width of card-compact (~15 units wide)
          const cardTop = 3.2;    // Top boundary of card-compact
          const cardBottom = -3.5; // Bottom boundary of card-compact

          for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;

            let px = posArray[idx];
            let py = posArray[idx + 1];
            let pz = posArray[idx + 2];

            // 1. Gravity Fall Downward
            py -= fallSpeeds[i] * clickSpeedMultiplier;
            px += xVelocities[i];

            // 2. Card Top Collision Deflection & Waterfall Splatter Physics
            if (Math.abs(pz) < 8) {
              if (py <= cardTop + 0.8 && py >= cardBottom - 0.5 && Math.abs(px) < cardWidth + 0.8) {
                const pushDirection = px >= 0 ? 1 : -1;
                // Deflect outward around card edges with gentle slow splash vibration
                px += pushDirection * 0.14 * clickSpeedMultiplier;
                px += Math.sin(time * 8 + splashOffsets[i]) * 0.04;
                py -= fallSpeeds[i] * 0.3;
              }
            }

            // 3. STRICT CENTER LOGO OCCLUSION (Prevent particles from penetrating center logo text/icon)
            if (Math.abs(px) < 5.2 && Math.abs(py) < 2.8) {
              // Push Z-depth behind logo plane so particles never obscure or penetrate the center logo
              if (pz > -4.0 && pz < 4.0) {
                pz = -5.5 - Math.random() * 2.0;
              }
            }

            // 3. Mouse Interaction Wave Deflection
            const dx = px - mouseX;
            const dy = py - mouseY;
            const distSq = dx * dx + dy * dy;

            if (distSq < 144) { // Mouse influence radius
              const dist = Math.sqrt(distSq) + 0.001;
              const force = (1 - dist / 12) * 2.2;
              px += (dx / dist) * force * 0.12;
            }

            // 4. Reset Particle to Top when falling past bottom screen boundary
            if (py < -26) {
              py = 22 + Math.random() * 10; // Respawn above screen top
              px = (Math.random() - 0.5) * 72; // Randomize X across width
              xVelocities[i] = (Math.random() - 0.5) * 0.02; // Reset horizontal drift
            }

            posArray[idx] = px;
            posArray[idx + 1] = py;
            posArray[idx + 2] = pz;
          }
        }
      }

      positionAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    renderLoop();

    // 5. Responsive Resize Handler
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

    // 6. Visibility Change (Pause loop when tab is backgrounded)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        clock.start();
        renderLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 7. Clean up on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

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
        opacity: isFormRevealed ? 0 : 1,
        transition: 'opacity 0.4s ease-in-out 0.65s',
      }}
    />
  );
}


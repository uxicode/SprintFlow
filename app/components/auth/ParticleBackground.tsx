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

  // props 변경 사항을 ref 에 동기화
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

    // 마우스 이동 감지
    const handleMouseMove = (e: MouseEvent) => {
      // 마우스 좌표 정규화
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current.targetX = nx * 20; // 3D world space coordinate mapping
      mouseRef.current.targetY = ny * 15;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 부드러운 원형 그라데이션 텍스처 생성
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.3)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    const circleTexture = new THREE.CanvasTexture(canvas);

    // 3. 폭포수처럼 쏟아지는 파티클 (원형 점 구조)
    const particleCount = 900;
    const geometry = new THREE.BufferGeometry();

    const initialPositions = new Float32Array(particleCount * 3);
    const currentPositions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const fallSpeeds = new Float32Array(particleCount);
    const xVelocities = new Float32Array(particleCount);
    const splashOffsets = new Float32Array(particleCount);

    const tempColor = new THREE.Color();

    const flatColors = [
      '#00f2fe',
      '#4facfe',
      '#10b981',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ff6b8b',
      '#ffffff',
    ];

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 33;
      const y = 15 + Math.random() * 25;
      const zDepth = (Math.random() - 0.5) * 14;
      const depthFactor = (zDepth + 7) / 14;

      const fallSpeed = 0.025 + depthFactor * 0.05 + Math.random() * 0.015;
      fallSpeeds[i] = fallSpeed;
      xVelocities[i] = (Math.random() - 0.5) * 0.02;
      splashOffsets[i] = Math.random() * Math.PI * 2;

      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = zDepth;

      currentPositions[i * 3] = x;
      currentPositions[i * 3 + 1] = y;
      currentPositions[i * 3 + 2] = zDepth;

      // Target positions when form is revealed: Form login-logo-wrapper shape (tight rectangle & ring)
      let tx, ty, tz;
      if (i < particleCount * 0.75) {
        // Tight rectangle matching login-logo-wrapper boundary
        tx = (Math.random() - 0.5) * 12.4;
        ty = (Math.random() - 0.5) * 3.6;
        tz = (Math.random() - 0.5) * 2.0;
      } else {
        // Outer glowing ring around login-logo-wrapper
        const ringAngle = Math.random() * Math.PI * 2;
        const ringRx = 6.5 + Math.random() * 2.0;
        const ringRy = 2.0 + Math.random() * 1.0;
        tx = Math.cos(ringAngle) * ringRx;
        ty = Math.sin(ringAngle) * ringRy;
        tz = (Math.random() - 0.5) * 2.5;
      }
      targetPositions[i * 3] = tx;
      targetPositions[i * 3 + 1] = ty;
      targetPositions[i * 3 + 2] = tz;

      const hexColor = flatColors[Math.floor(Math.random() * flatColors.length)];
      tempColor.set(hexColor);
      const alphaDepth = 0.3 + Math.pow(depthFactor, 1.4) * 0.7;

      colors[i * 3] = tempColor.r * alphaDepth;
      colors[i * 3 + 1] = tempColor.g * alphaDepth;
      colors[i * 3 + 2] = tempColor.b * alphaDepth;

      sizes[i] = 0.44 + depthFactor * 0.1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.65,
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

    // 4. Animation Loop: Dispersal Burst Explosion & Waterfall Physics
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let transitionProgress = 0;
    let prevIsRevealed = isFormRevealedRef.current;

    // Dispersal scatter impulse velocities & gathering start snapshot
    const scatterVelocities = new Float32Array(particleCount * 3);
    const gatherStartPositions = new Float32Array(particleCount * 3);

    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      const currentClicks = clickCountRef.current;
      const isRevealed = isFormRevealedRef.current;
      const posArray = positionAttr.array as Float32Array;

      // 1. Detect 5th Logo Click: isRevealed turns from false -> true (Gathering Trigger)
      if (!prevIsRevealed && isRevealed) {
        transitionProgress = 0;
        // Snapshot exact live positions of all cascading particles
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          gatherStartPositions[idx] = posArray[idx];
          gatherStartPositions[idx + 1] = posArray[idx + 1];
          gatherStartPositions[idx + 2] = posArray[idx + 2];
        }
      }

      // 2. Detect Title 3-Click trigger: isRevealed turns from true -> false (Explosive Scatter Trigger)
      if (prevIsRevealed && !isRevealed) {
        // Trigger explosive radial scatter burst from login-logo-wrapper shape
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          // Start exactly from logo-wrapper shape position
          posArray[idx] = targetPositions[idx];
          posArray[idx + 1] = targetPositions[idx + 1];
          posArray[idx + 2] = targetPositions[idx + 2];

          // Radial explosion vector outward
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.4 + Math.random() * 0.9;
          scatterVelocities[idx] = Math.cos(angle) * speed;
          scatterVelocities[idx + 1] = Math.sin(angle) * speed * 0.7 + 0.2; // Upward bias
          scatterVelocities[idx + 2] = (Math.random() - 0.5) * 0.6;
        }
      }
      prevIsRevealed = isRevealed;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      const clickSpeedMultiplier = 1 + currentClicks * 0.15;

      particles.rotation.y = mouseX * 0.008;
      particles.rotation.x = -mouseY * 0.008;

      if (isRevealed) {
        // Smoothly Vacuum Gather live particles into login-logo-wrapper shape
        if (transitionProgress < 1) {
          transitionProgress += delta * 0.7; // ~1.4s gathering duration
          if (transitionProgress > 1) transitionProgress = 1;
        }

        material.opacity = 0.95;

        // Smooth cubic ease-out for magnetic gathering
        const ease = 1 - Math.pow(1 - transitionProgress, 3);

        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;

          const startX = gatherStartPositions[idx];
          const startY = gatherStartPositions[idx + 1];
          const startZ = gatherStartPositions[idx + 2];

          const targetX = targetPositions[idx];
          const targetY = targetPositions[idx + 1];
          const targetZ = targetPositions[idx + 2];

          const swirl = (1 - transitionProgress) * Math.sin(time * 6 + i * 0.15) * 1.5;

          posArray[idx] = THREE.MathUtils.lerp(startX, targetX, ease) + swirl;
          posArray[idx + 1] = THREE.MathUtils.lerp(startY, targetY, ease) + swirl;
          posArray[idx + 2] = THREE.MathUtils.lerp(startZ, targetZ, ease);
        }
      } else {
        // Disassemble/Waterfall Mode: Apply scatter velocities decay then gravity fall
        material.opacity = 0.9;

        const logoHalfWidth = 6.2;
        const logoTop = 1.8;
        const logoBottom = -2.2;

        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;

          let px = posArray[idx];
          let py = posArray[idx + 1];
          let pz = posArray[idx + 2];

          // Apply scatter impulse burst if active
          let vx = scatterVelocities[idx];
          let vy = scatterVelocities[idx + 1];
          let vz = scatterVelocities[idx + 2];

          if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001 || Math.abs(vz) > 0.001) {
            px += vx;
            py += vy;
            pz += vz;
            // Friction decay for burst impulse
            scatterVelocities[idx] *= 0.92;
            scatterVelocities[idx + 1] *= 0.92;
            scatterVelocities[idx + 2] *= 0.92;
          }

          // 1. Gravity Fall Downward
          py -= fallSpeeds[i] * clickSpeedMultiplier;
          px += xVelocities[i];

          // 2. COLLISION WITH login-logo-text
          if (Math.abs(pz) < 7) {
            if (py <= logoTop + 0.6 && py >= logoBottom - 0.4 && Math.abs(px) < logoHalfWidth + 0.6) {
              const pushDirection = px >= 0 ? 1 : -1;
              px += pushDirection * 0.08 * clickSpeedMultiplier;
              px += Math.sin(time * 8 + splashOffsets[i]) * 0.03;
              py -= fallSpeeds[i] * 0.3;
            }
          }

          // 3. ZERO-PENETRATION OCCLUSION
          if (Math.abs(px) < logoHalfWidth && Math.abs(py) < 2.5) {
            if (pz > -4.0 && pz < 4.0) {
              pz = -5.5 - Math.random() * 2.0;
            }
          }

          // Mouse Deflection
          const dx = px - mouseX;
          const dy = py - mouseY;
          const distSq = dx * dx + dy * dy;

          if (distSq < 144) {
            const dist = Math.sqrt(distSq) + 0.001;
            const force = (1 - dist / 12) * 2.2;
            px += (dx / dist) * force * 0.12;
          }

          // Reset point to Top when falling past bottom
          if (py < -26) {
            py = 22 + Math.random() * 10;
            px = (Math.random() - 0.5) * 33;
            xVelocities[i] = (Math.random() - 0.5) * 0.02;
          }

          posArray[idx] = px;
          posArray[idx + 1] = py;
          posArray[idx + 2] = pz;
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


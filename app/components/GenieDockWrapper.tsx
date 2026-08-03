'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import { useUiStore } from '../stores/ui-store';
import type { DockDirection, DockState, UiStoreSlice } from '../types';

interface GenieDockWrapperProps {
  sectionId: 'filter' | 'stats' | 'report';
  children: React.ReactNode;
}

export default function GenieDockWrapper({ sectionId, children }: GenieDockWrapperProps) {
  const filterDock = useUiStore((s) => (s as UiStoreSlice).filterDock);
  const statsDock = useUiStore((s) => (s as UiStoreSlice).statsDock);
  const reportDock = useUiStore((s) => (s as UiStoreSlice).reportDock);
  const setFilterDock = useUiStore((s) => (s as UiStoreSlice).setFilterDock);
  const setStatsDock = useUiStore((s) => (s as UiStoreSlice).setStatsDock);
  const setReportDock = useUiStore((s) => (s as UiStoreSlice).setReportDock);

  const dockState: DockState =
    sectionId === 'filter' ? filterDock : sectionId === 'stats' ? statsDock : reportDock;

  const updateDock = useCallback(
    (dock: Partial<DockState>) => {
      if (sectionId === 'filter') setFilterDock(dock);
      else if (sectionId === 'stats') setStatsDock(dock);
      else setReportDock(dock);
    },
    [sectionId, setFilterDock, setStatsDock, setReportDock]
  );

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeZone, setActiveZone] = useState<DockDirection | null>(null);

  const isPointerDownRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const isHandledByDragRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeZoneRef = useRef<DockDirection | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    activeZoneRef.current = activeZone;
  }, [activeZone]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isHandle =
      target.closest('.drag-handle') ||
      target.closest('.section-header') ||
      target.closest('.report-tabs-header');
    if (!isHandle || target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }

    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: 0, y: 0 });
    target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    if (!hasDraggedRef.current && Math.hypot(dx, dy) > 5) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }

    if (hasDraggedRef.current) {
      setDragOffset({ x: dx, y: dy });

      if (containerRef.current) {
        gsap.set(containerRef.current, {
          x: dx,
          y: dy,
          rotation: dx * 0.02,
        });
      }

      const { clientX, clientY } = e;
      const vWidth = window.innerWidth;

      if (clientY < 130) {
        setActiveZone('top');
      } else if (clientX < 380) {
        setActiveZone('left');
      } else if (clientX > vWidth - 250) {
        setActiveZone('right');
      } else {
        setActiveZone(null);
      }
    }
  };

  const getTargetDisplacement = useCallback((zone: DockDirection) => {
    if (!containerRef.current) return { deltaX: 0, deltaY: -200 };
    const rect = containerRef.current.getBoundingClientRect();
    const currentCenterX = rect.left + rect.width / 2;
    const currentCenterY = rect.top + rect.height / 2;

    let targetCenterX = 0;
    let targetCenterY = 0;

    const dockEl = document.querySelector(`.dock-bar--${zone}`);
    if (dockEl) {
      const dockRect = dockEl.getBoundingClientRect();
      targetCenterX = dockRect.left + dockRect.width / 2;
      targetCenterY = dockRect.top + dockRect.height / 2;
    } else {
      if (zone === 'top') {
        targetCenterX = window.innerWidth / 2;
        targetCenterY = 30;
      } else if (zone === 'left') {
        targetCenterX = 350;
        targetCenterY = window.innerHeight / 2;
      } else {
        targetCenterX = window.innerWidth - 60;
        targetCenterY = window.innerHeight / 2;
      }
    }

    return {
      deltaX: targetCenterX - currentCenterX,
      deltaY: targetCenterY - currentCenterY,
    };
  }, []);

  const finishDrag = useCallback(
    (targetZone: DockDirection | null) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      if (!hasDraggedRef.current) {
        setIsDragging(false);
        setActiveZone(null);
        setDragOffset({ x: 0, y: 0 });
        return;
      }

      setIsDragging(false);

      if (targetZone && containerRef.current) {
        isHandledByDragRef.current = true;
        const { deltaX, deltaY } = getTargetDisplacement(targetZone);
        const currentX = (gsap.getProperty(containerRef.current, 'x') as number) || 0;
        const currentY = (gsap.getProperty(containerRef.current, 'y') as number) || 0;

        updateDock({ position: targetZone, isAnimating: true });

        // Continuous ballistic throw trajectory directly from mid-air release position
        gsap.to(containerRef.current, {
          x: currentX + deltaX,
          y: currentY + deltaY,
          scale: 0.05,
          opacity: 0,
          rotation: 0,
          duration: 0.42,
          ease: 'power2.out',
          onComplete: () => {
            updateDock({ isDocked: true, isAnimating: false });
            setDragOffset({ x: 0, y: 0 });
            setActiveZone(null);
            isHandledByDragRef.current = false;
          },
        });
      } else if (containerRef.current) {
        // GSAP Spring Snap-back directly from current dragged position back to (0,0)
        gsap.to(containerRef.current, {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 0.35,
          ease: 'back.out(1.5)',
          onComplete: () => {
            setDragOffset({ x: 0, y: 0 });
            setActiveZone(null);
          },
        });
      }
    },
    [getTargetDisplacement, updateDock]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.target && 'releasePointerCapture' in (e.target as HTMLElement)) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    finishDrag(activeZoneRef.current);
  };

  // Global safety net listeners when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalUp = () => {
      finishDrag(activeZoneRef.current);
    };

    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    window.addEventListener('blur', handleGlobalUp);
    document.addEventListener('mouseleave', handleGlobalUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      window.removeEventListener('blur', handleGlobalUp);
      document.removeEventListener('mouseleave', handleGlobalUp);
    };
  }, [isDragging, finishDrag]);

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDraggedRef.current = false;
    }
  };

  // GSAP Docking (Button) & Unfold / Restore Animation
  useEffect(() => {
    if (isHandledByDragRef.current) {
      return;
    }

    if (dockState.isAnimating && containerRef.current) {
      const pos = dockState.position || 'top';
      const { deltaX, deltaY } = getTargetDisplacement(pos);
      const currentX = (gsap.getProperty(containerRef.current, 'x') as number) || 0;
      const currentY = (gsap.getProperty(containerRef.current, 'y') as number) || 0;

      if (dockState.isDocked) {
        // Undock / Restore
        gsap.fromTo(
          containerRef.current,
          {
            x: currentX + deltaX,
            y: currentY + deltaY,
            scale: 0.05,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.45,
            ease: 'back.out(1.2)',
          }
        );
      } else if (!isDragging) {
        // Button triggered Dock
        gsap.fromTo(
          containerRef.current,
          {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
          },
          {
            x: deltaX,
            y: deltaY,
            scale: 0.05,
            opacity: 0,
            duration: 0.45,
            ease: 'power3.inOut',
          }
        );
      }
    }
  }, [dockState.isAnimating, dockState.isDocked, dockState.position, getTargetDisplacement, isDragging]);

  // Reset GSAP transforms when completely undocked
  useEffect(() => {
    if (!dockState.isDocked && !dockState.isAnimating && containerRef.current) {
      gsap.set(containerRef.current, { clearProps: 'transform', opacity: 1 });
      setDragOffset({ x: 0, y: 0 });
    }
  }, [dockState.isDocked, dockState.isAnimating]);

  if (dockState.isDocked && !dockState.isAnimating) {
    return null;
  }

  return (
    <div className="genie-wrapper-relative">
      {/* Drop Zone Indicators while dragging */}
      {isDragging && (
        <div className="genie-drop-overlay">
          <div className={clsx('drop-zone drop-zone--top', activeZone === 'top' && 'active')}>
            <span className="drop-zone-badge">⚡ 상단 보관함 (Genie Drop)</span>
          </div>
          <div className={clsx('drop-zone drop-zone--left', activeZone === 'left' && 'active')}>
            <span className="drop-zone-badge">⚡ 좌측 보관함 (Genie Drop)</span>
          </div>
          <div className={clsx('drop-zone drop-zone--right', activeZone === 'right' && 'active')}>
            <span className="drop-zone-badge">⚡ 우측 보관함 (Genie Drop)</span>
          </div>
        </div>
      )}

      {/* Drag & GSAP Animated Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        className={clsx('genie-container', isDragging && 'is-dragging')}
      >
        {children}
      </div>
    </div>
  );
}

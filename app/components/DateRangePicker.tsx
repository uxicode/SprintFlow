'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, parseISO, isValid, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import './date-picker.css';

interface DateRangePickerProps {
  dateStart: string; // YYYY-MM-DD
  dateEnd: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  label?: string;
  variant?: 'form' | 'control';
  id?: string;
  className?: string;
}

export default function DateRangePicker({
  dateStart,
  dateEnd,
  onChange,
  label,
  variant = 'form',
  id,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Calculate position in viewport
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      let left = rect.left;

      // Prevent overflow right edge of window
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }

      setPopoverCoords({
        top: rect.bottom + 8,
        left: left,
      });
    }
  }, []);

  // Update position when open & on scroll/resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Click Outside & Escape key handling
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideTrigger = triggerRef.current?.contains(target);
      const isInsidePopover = popoverRef.current?.contains(target);

      if (!isInsideTrigger && !isInsidePopover) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Convert string (YYYY-MM-DD) to Date object safely
  const parseDateStr = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : undefined;
  };

  const selectedRange: DateRange | undefined = {
    from: parseDateStr(dateStart),
    to: parseDateStr(dateEnd),
  };

  const handleSelect = (range: DateRange | undefined) => {
    const fromStr = range?.from ? format(range.from, 'yyyy-MM-dd') : '';
    const toStr = range?.to ? format(range.to, 'yyyy-MM-dd') : (fromStr || '');
    onChange(fromStr, toStr);
  };

  const applyPreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth') => {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    switch (preset) {
      case 'today':
        from = today;
        to = today;
        break;
      case '7days':
        from = subDays(today, 6);
        break;
      case '30days':
        from = subDays(today, 29);
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'lastMonth': {
        const lastMonthDate = subMonths(today, 1);
        from = startOfMonth(lastMonthDate);
        to = endOfMonth(lastMonthDate);
        break;
      }
      default:
        from = today;
    }

    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(to, 'yyyy-MM-dd');
    onChange(fromStr, toStr);
  };

  // Formatted display text
  const displayText = React.useMemo(() => {
    if (dateStart && dateEnd) {
      return dateStart === dateEnd ? dateStart : `${dateStart} ~ ${dateEnd}`;
    }
    if (dateStart) return `${dateStart} ~`;
    if (dateEnd) return `~ ${dateEnd}`;
    return '날짜 범위 선택';
  }, [dateStart, dateEnd]);

  const groupClass = variant === 'control' ? 'control-group' : 'form-group';
  const triggerId = id ? `${id}-trigger` : undefined;

  return (
    <div
      className={`${groupClass} date-range-picker-container ${className}`}
      id={id}
    >
      {label && <label htmlFor={triggerId}>{label}</label>}

      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        className={`date-range-trigger ${isOpen ? 'date-range-trigger--open' : ''}`}
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <svg
          className="date-range-trigger__icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        <span className="date-range-trigger__text">{displayText}</span>

        <svg
          className="date-range-trigger__chevron"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && mounted && createPortal(
        <div
          ref={popoverRef}
          className="date-range-popover date-range-popover--portal"
          style={{
            position: 'fixed',
            top: `${popoverCoords.top}px`,
            left: `${popoverCoords.left}px`,
            zIndex: 999999,
          }}
        >
          <div className="date-range-presets">
            <button type="button" className="preset-btn" onClick={() => applyPreset('today')}>
              오늘
            </button>
            <button type="button" className="preset-btn" onClick={() => applyPreset('7days')}>
              최근 7일
            </button>
            <button type="button" className="preset-btn" onClick={() => applyPreset('30days')}>
              최근 30일
            </button>
            <button type="button" className="preset-btn" onClick={() => applyPreset('thisMonth')}>
              이번 달
            </button>
            <button type="button" className="preset-btn" onClick={() => applyPreset('lastMonth')}>
              지난 달
            </button>
          </div>

          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            locale={ko}
            numberOfMonths={1}
          />

          <div className="date-range-popover-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsOpen(false)}
            >
              닫기
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

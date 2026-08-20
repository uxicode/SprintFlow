'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import type { TodoItem } from '../../types';
import MonthCalendarView from './MonthCalendarView';
import WeeklySummaryView from './WeeklySummaryView';

dayjs.locale('ko');

type ViewMode = 'daily' | 'monthly' | 'weekly';

const STORAGE_KEY = 'sprintflow_todo_events';
const HOUR_HEIGHT = 52; // 1시간당 52px
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DEFAULT_COLOR = '#3b82f6'; // blue accent ('할 일' 기본)
const CATEGORY_COLORS: Record<string, string> = {
  '할 일': '#3b82f6',
  '일정': '#0d9488',
};

function formatHourLabel(h: number): string {
  if (h === 0) return '오전 12시';
  if (h === 12) return '오후 12시';
  if (h < 12) return `오전 ${h}시`;
  return `오후 ${h - 12}시`;
}

function formatSelectOptionLabel(h: number): string {
  const totalMinutes = Math.round(h * 60);
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const period = hour24 < 12 ? '오전' : '오후';
  const displayHour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const minStr = mins.toString().padStart(2, '0');
  return `${period} ${displayHour}:${minStr}`;
}

function formatTimeRange(startHour: number, endHour: number): string {
  const formatTime = (h: number) => {
    const totalMinutes = Math.round(h * 60);
    const hour24 = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const period = hour24 < 12 ? '오전' : '오후';
    const displayHour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const minStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
    return `${period} ${displayHour}${minStr}`;
  };

  return `${formatTime(startHour)} ~ ${formatTime(endHour)}`;
}

export default function TodoCalendarPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [currentMonth, setCurrentMonth] = useState(() => dayjs().startOf('month'));
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [items, setItems] = useState<TodoItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (e) {
          console.error('Todo 저장 데이터 파싱 실패:', e);
        }
      }
    }
    return [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'detail' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Partial<TodoItem> | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'move' | 'resize-top' | 'resize-bottom' | null>(null);
  const dragStartPosRef = useRef<{ startY: number; initialStartHour: number; initialEndHour: number }>({
    startY: 0,
    initialStartHour: 0,
    initialEndHour: 0,
  });
  const wasDraggedRef = useRef(false);

  const gridBodyRef = useRef<HTMLDivElement>(null);

  // 마운트 시 8 AM으로 스크롤 자동 이동 및 서버 data/todos.json 데이터 불러오기
  useEffect(() => {
    if (gridBodyRef.current) {
      gridBodyRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
    const fetchServerTodos = async () => {
      try {
        const res = await fetch('/api/todo');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setItems(data.data);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
          }
        }
      } catch (err) {
        console.warn('서버 data/todos.json 로드 미적용 (로컬 스토리지 사용 중):', err);
      }
    };
    fetchServerTodos();
  }, []);

  // 저장 (서버 파일 data/todos.json + 로컬 스토리지 동시 저장)
  const saveItemsToStorage = useCallback(async (newItems: TodoItem[]) => {
    setItems(newItems);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    }
    try {
      await fetch('/api/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItems),
      });
    } catch (err) {
      console.warn('서버 파일 저장 불가 (로컬 스토리지 데이터 유지됨):', err);
    }
  }, []);

  // 날짜 조작
  const handlePrevDay = () => setSelectedDate((prev) => dayjs(prev).subtract(1, 'day').format('YYYY-MM-DD'));
  const handleNextDay = () => setSelectedDate((prev) => dayjs(prev).add(1, 'day').format('YYYY-MM-DD'));
  const handleToday = () => setSelectedDate(dayjs().format('YYYY-MM-DD'));

  // 월 캘린더 / 주간 뷰에서 날짜 선택 → 일간 뷰 전환
  const handleCalendarDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode('daily');
  }, []);

  // 월 이동 핸들러
  const handlePrevMonth = useCallback(() => setCurrentMonth((prev) => prev.subtract(1, 'month')), []);
  const handleNextMonth = useCallback(() => setCurrentMonth((prev) => prev.add(1, 'month')), []);
  const handleMonthToday = useCallback(() => setCurrentMonth(dayjs().startOf('month')), []);

  // 필터링된 오늘 날짜의 일정들
  const dayItems = items.filter((item) => item.date === selectedDate);

  // 새 일정 모달 열기
  const handleOpenNewModal = (defaultStartHour = 9) => {
    setModalMode('create');
    setEditingItem({
      id: '',
      title: '',
      date: selectedDate,
      startHour: defaultStartHour,
      endHour: Math.min(defaultStartHour + 1, 24),
      category: '할 일',
      color: CATEGORY_COLORS['할 일'],
      notes: '',
      location: '',
    });
    setIsModalOpen(true);
  };

  // 할일 완료 토글
  const handleToggleCompleted = (itemId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    const updatedItems = items.map((it) =>
      it.id === itemId ? { ...it, completed: !it.completed } : it
    );
    saveItemsToStorage(updatedItems);
  };

  // 일정 상세 보기 모달 열기 (순수 클릭 시에만 노출, 드래그 후 드롭 시엔 방지)
  const handleViewDetail = (item: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    setModalMode('detail');
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  // 일정 수정 모달 열기
  const handleEditItem = (item: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    wasDraggedRef.current = false;
    setModalMode('edit');
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!editingItem || !editingItem.title?.trim()) {
      alert('제목을 입력해 주세요.');
      return;
    }

    const startH = Math.max(0, Math.min(editingItem.startHour ?? 9, 23.75));
    const endH = Math.max(startH + 0.25, Math.min(editingItem.endHour ?? 10, 24));

    const updatedItem: TodoItem = {
      id: editingItem.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: editingItem.title.trim(),
      date: editingItem.date || selectedDate,
      startHour: startH,
      endHour: endH,
      category: editingItem.category || '할 일',
      color: editingItem.color || CATEGORY_COLORS[editingItem.category || '할 일'] || DEFAULT_COLOR,
      notes: editingItem.notes || '',
      location: editingItem.location || '',
    };

    let newItems: TodoItem[];
    if (editingItem.id) {
      newItems = items.map((it) => (it.id === updatedItem.id ? updatedItem : it));
    } else {
      newItems = [...items, updatedItem];
    }

    saveItemsToStorage(newItems);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteModal = () => {
    if (!editingItem?.id) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    const newItems = items.filter((it) => it.id !== editingItem.id);
    saveItemsToStorage(newItems);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // 타임슬롯 그리드 클릭시
  const handleGridSlotClick = (h: number) => {
    handleOpenNewModal(h);
  };

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 삭제 아이콘 클릭 시
  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    const newItems = items.filter((it) => it.id !== id);
    saveItemsToStorage(newItems);
    if (editingItem?.id === id) {
      setIsModalOpen(false);
      setEditingItem(null);
    }
  };

  // 포인터 기반 드래그 시작 (시간 이동 & 리사이즈)
  const handlePointerDown = (
    e: React.PointerEvent,
    item: { id: string; startHour: number; endHour: number },
    type: 'move' | 'resize-top' | 'resize-bottom'
  ) => {
    e.stopPropagation();
    wasDraggedRef.current = false;

    setActiveDragId(item.id);
    setDragType(type);
    dragStartPosRef.current = {
      startY: e.clientY,
      initialStartHour: item.startHour,
      initialEndHour: item.endHour,
    };
  };

  // 윈도우 레벨 포인터 이동 & 업 이벤트 리스너 (완벽한 반응형 드래그 앤 드롭)
  useEffect(() => {
    if (!activeDragId || !dragType) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const deltaY = e.clientY - dragStartPosRef.current.startY;
      if (Math.abs(deltaY) > 3) {
        wasDraggedRef.current = true;
      }

      const deltaHours = deltaY / HOUR_HEIGHT;
      const snappedDeltaHours = Math.round(deltaHours * 4) / 4;

      const initStart = dragStartPosRef.current.initialStartHour;
      const initEnd = dragStartPosRef.current.initialEndHour;
      const duration = initEnd - initStart;

      let newStart = initStart;
      let newEnd = initEnd;

      if (dragType === 'move') {
        newStart = Math.max(0, Math.min(initStart + snappedDeltaHours, 24 - duration));
        newEnd = newStart + duration;
      } else if (dragType === 'resize-top') {
        newStart = Math.max(0, Math.min(initStart + snappedDeltaHours, initEnd - 0.25));
        newEnd = initEnd;
      } else if (dragType === 'resize-bottom') {
        newStart = initStart;
        newEnd = Math.max(initStart + 0.25, Math.min(initEnd + snappedDeltaHours, 24));
      }

      // 모달 편집 중인 아이템이 있을 경우 실시간 동기화
      if (editingItem) {
        if (editingItem.id === activeDragId || (!editingItem.id && activeDragId === 'draft-preview-block')) {
          setEditingItem((prev) => (prev ? { ...prev, startHour: newStart, endHour: newEnd } : null));
        }
      }

      // 저장된 아이템 드래그 이동
      setItems((prevItems) =>
        prevItems.map((it) => {
          if (it.id !== activeDragId) return it;
          return { ...it, startHour: newStart, endHour: newEnd };
        })
      );
    };

    const handleWindowPointerUp = () => {
      setActiveDragId(null);
      setDragType(null);
      saveItemsToStorage(itemsRef.current);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [activeDragId, dragType, editingItem, saveItemsToStorage]);

  return (
    <div className="todo-calendar-panel card">
      {/* 캘린더 패널 헤더 */}
      <div className="todo-panel-header">
        <div className="todo-panel-title-group">
          <span className="todo-panel-icon">📅</span>
          <h3 className="todo-panel-title">Todo & 일정 관리</h3>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm todo-add-btn"
          onClick={() => handleOpenNewModal(10)}
        >
          + 일정 추가
        </button>
      </div>

      {/* 뷰 모드 전환 탭 */}
      <div className="todo-view-tabs">
        <button
          type="button"
          className={`todo-view-tab ${viewMode === 'daily' ? 'active' : ''}`}
          onClick={() => setViewMode('daily')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          일간
        </button>
        <button
          type="button"
          className={`todo-view-tab ${viewMode === 'monthly' ? 'active' : ''}`}
          onClick={() => setViewMode('monthly')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <rect x="7" y="13" width="3" height="3" rx="0.5" />
            <rect x="14" y="13" width="3" height="3" rx="0.5" />
            <rect x="7" y="17" width="3" height="3" rx="0.5" />
          </svg>
          월간
        </button>
        <button
          type="button"
          className={`todo-view-tab ${viewMode === 'weekly' ? 'active' : ''}`}
          onClick={() => setViewMode('weekly')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          주간 요약
        </button>
      </div>

      {/* 일간 뷰: 날짜 컨트롤 바 */}
      {viewMode === 'daily' && (
        <div className="todo-date-nav">
          <button type="button" className="btn btn-secondary btn-xs" onClick={handleToday}>
            오늘
          </button>
          <div className="todo-date-arrows">
            <button type="button" className="btn btn-secondary btn-icon-xs" onClick={handlePrevDay}>
              ‹
            </button>
            <button type="button" className="btn btn-secondary btn-icon-xs" onClick={handleNextDay}>
              ›
            </button>
          </div>
          <span className="todo-current-date-label">
            {dayjs(selectedDate).format('YYYY년 M월 D일 (ddd)')}
          </span>
        </div>
      )}

      {/* 일간 뷰: 24시간 타임라인 그리드 영역 */}
      {viewMode === 'daily' && (
        <div className="todo-timeline-container" ref={gridBodyRef}>
          <div className="todo-timeline-scroll">
            {/* 타임라인 레이어 (그리드 배경 및 시간 눈금) */}
            <div className="todo-time-slots">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="todo-hour-slot"
                  onClick={() => handleGridSlotClick(h)}
                  title={`${formatHourLabel(h)} 일정 추가`}
                >
                  <div className="todo-hour-label">{formatHourLabel(h)}</div>
                  <div className="todo-hour-line" />
                </div>
              ))}
            </div>

            {/* 일정 사각 박스 오버레이 레이어 */}
            <div className="todo-events-overlay">
              {/* 작성 중인 신규 일정 실시간 프리뷰 블록 (구글 캘린더 동일 UX) */}
              {isModalOpen && editingItem && !editingItem.id && (
                (() => {
                  const previewStart = editingItem.startHour ?? 9;
                  const previewEnd = editingItem.endHour ?? 10;
                  const previewTop = previewStart * HOUR_HEIGHT;
                  const previewHeight = Math.max(0.25, previewEnd - previewStart) * HOUR_HEIGHT;
                  const previewTitle = editingItem.title?.trim() || '(제목 없음)';
                  const previewBg = editingItem.color || CATEGORY_COLORS[editingItem.category || '일정'] || DEFAULT_COLOR;

                  return (
                    <div
                      key="draft-preview-block"
                      className="todo-event-block todo-event-block--preview"
                      style={{
                        top: `${previewTop}px`,
                        height: `${previewHeight}px`,
                        backgroundColor: previewBg,
                      }}
                    >
                      <div className="todo-event-content">
                        <div className="todo-event-title">{previewTitle}</div>
                        <div className="todo-event-time">
                          {formatTimeRange(previewStart, previewEnd)}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* 기존 일정 블록 목록 (수정 중일 경우 실시간 변경사항 동기화) */}
              {dayItems.map((item) => {
                const currentItem = editingItem && editingItem.id === item.id ? { ...item, ...editingItem } : item;
                const startH = currentItem.startHour ?? 0;
                const endH = currentItem.endHour ?? 1;
                const topPx = startH * HOUR_HEIGHT;
                const heightPx = Math.max(0.25, endH - startH) * HOUR_HEIGHT;
                const isDraggingThis = activeDragId === currentItem.id;
                const bgColor = currentItem.color || CATEGORY_COLORS[currentItem.category || '일정'] || DEFAULT_COLOR;
                const displayTitle = currentItem.title?.trim() || '(제목 없음)';

                return (
                  <div
                    key={currentItem.id}
                    className={`todo-event-block ${isDraggingThis ? 'is-dragging' : ''} ${currentItem.completed ? 'is-completed' : ''}`}
                    style={{
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      backgroundColor: bgColor,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, currentItem, 'move')}
                    onClick={(e) => handleViewDetail(currentItem as TodoItem, e)}
                    title={`${displayTitle} (${formatTimeRange(startH, endH)})\n클릭 시 일정 상세 정보 보기, 드래그 시 시간대 이동`}
                  >
                    {/* 상단 리사이즈 핸들 */}
                    <div
                      className="todo-resize-handle todo-resize-handle--top"
                      onPointerDown={(e) => handlePointerDown(e, currentItem, 'resize-top')}
                      title="상단 핸들: 시작 시간 변경"
                    />

                    <div className="todo-event-content">
                      <div className="todo-event-header-row">
                        <label className="todo-event-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="todo-event-checkbox"
                            checked={!!currentItem.completed}
                            onChange={(e) => handleToggleCompleted(currentItem.id!, e)}
                            title={currentItem.completed ? '완료됨 — 클릭하여 해제' : '미완료 — 클릭하여 완료 처리'}
                          />
                          <span className="todo-event-checkmark" />
                        </label>
                        <div className="todo-event-title">{displayTitle}</div>
                        <div className="todo-event-actions">
                          <button
                            type="button"
                            className="todo-action-btn edit-btn"
                            onClick={(e) => handleEditItem(currentItem as TodoItem, e)}
                            title="일정 수정"
                            aria-label="일정 수정"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="todo-action-btn delete-btn"
                            onClick={(e) => handleDeleteItem(currentItem.id, e)}
                            title="일정 삭제"
                            aria-label="일정 삭제"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="todo-event-time">
                        {formatTimeRange(startH, endH)}
                      </div>
                    </div>

                    {/* 하단 리사이즈 핸들 */}
                    <div
                      className="todo-resize-handle todo-resize-handle--bottom"
                      onPointerDown={(e) => handlePointerDown(e, currentItem, 'resize-bottom')}
                      title="하단 핸들: 종료 시간 변경"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 월간 캘린더 뷰 */}
      {viewMode === 'monthly' && (
        <MonthCalendarView
          currentMonth={currentMonth}
          items={items}
          onSelectDate={handleCalendarDateSelect}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleMonthToday}
        />
      )}

      {/* 주간 요약 뷰 */}
      {viewMode === 'weekly' && (
        <WeeklySummaryView
          items={items}
          onSelectDate={handleCalendarDateSelect}
        />
      )}

      {/* 구글 캘린더 스타일 일정 생성/수정/상세보기 모달 */}
      {isModalOpen && editingItem && !activeDragId && typeof window !== 'undefined' && createPortal(
        <div className="todo-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="todo-modal-dialog card" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-header">
              <span className="todo-modal-type-badge">
                {modalMode === 'detail' ? '📌 일정 상세 정보' : modalMode === 'edit' ? '✏️ 일정 수정' : '✨ 새 일정 추가'}
              </span>
              <button
                type="button"
                className="todo-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {modalMode === 'detail' ? (
              <div className="todo-modal-body todo-detail-body">
                <div className="todo-detail-title-row">
                  <div className="todo-detail-color-dot" style={{ backgroundColor: editingItem.color || DEFAULT_COLOR }} />
                  <h3 className="todo-detail-title">{editingItem.title || '(제목 없음)'}</h3>
                </div>
                <div className="todo-detail-info-group">
                  <div className="todo-detail-info-row">
                    <span className="todo-detail-icon">🏷️</span>
                    <span className="todo-detail-badge">{editingItem.category || '할 일'}</span>
                  </div>
                  <div className="todo-detail-info-row">
                    <span className="todo-detail-icon">🕒</span>
                    <span>
                      {dayjs(editingItem.date || selectedDate).format('YYYY년 M월 D일 (ddd)')}{' '}
                      {formatTimeRange(editingItem.startHour ?? 9, editingItem.endHour ?? 10)}
                    </span>
                  </div>
                  {editingItem.location && (
                    <div className="todo-detail-info-row">
                      <span className="todo-detail-icon">📍</span>
                      <span>{editingItem.location}</span>
                    </div>
                  )}
                  {editingItem.notes && (
                    <div className="todo-detail-info-row">
                      <span className="todo-detail-icon">📝</span>
                      <span>{editingItem.notes}</span>
                    </div>
                  )}
                </div>
                <div className="todo-modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm danger-btn"
                    onClick={handleDeleteModal}
                  >
                    삭제
                  </button>
                  <div className="todo-footer-right">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setModalMode('edit')}
                    >
                      ✏️ 수정
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsModalOpen(false)}
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="todo-modal-body">
                  {/* 제목 입력 */}
                  <input
                    type="text"
                    className="todo-input-title"
                    placeholder="제목 추가"
                    value={editingItem.title || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    autoFocus
                  />

                  {/* 카테고리 탭 선택 */}
                  <div className="todo-category-tabs">
                    {(['할 일', '일정'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`todo-cat-btn ${editingItem.category === cat ? 'active' : ''}`}
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            category: cat,
                            color: CATEGORY_COLORS[cat] || DEFAULT_COLOR,
                          })
                        }
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* 시간 및 날짜 설정 */}
                  <div className="todo-form-row">
                    <span className="todo-form-icon">🕒</span>
                    <div className="todo-form-field">
                      <div className="todo-time-inputs">
                        <input
                          type="date"
                          className="todo-date-picker"
                          value={editingItem.date || selectedDate}
                          onChange={(e) => setEditingItem({ ...editingItem, date: e.target.value })}
                        />
                        <select
                          className="todo-time-select"
                          value={editingItem.startHour ?? 9}
                          onChange={(e) => {
                            const newStart = parseFloat(e.target.value);
                            const currentDur = (editingItem.endHour ?? 10) - (editingItem.startHour ?? 9);
                            setEditingItem({
                              ...editingItem,
                              startHour: newStart,
                              endHour: Math.min(newStart + Math.max(0.5, currentDur), 24),
                            });
                          }}
                        >
                          {Array.from({ length: 96 }, (_, i) => i * 0.25).map((h) => (
                            <option key={h} value={h}>
                              {formatSelectOptionLabel(h)}
                            </option>
                          ))}
                        </select>
                        <span>~</span>
                        <select
                          className="todo-time-select"
                          value={editingItem.endHour ?? 10}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              endHour: parseFloat(e.target.value),
                            })
                          }
                        >
                          {Array.from({ length: 96 }, (_, i) => (i + 1) * 0.25).map((h) => (
                            <option key={h} value={h} disabled={h <= (editingItem.startHour ?? 0)}>
                              {formatSelectOptionLabel(h)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 장소 / 참석자 */}
                  <div className="todo-form-row">
                    <span className="todo-form-icon">📍</span>
                    <input
                      type="text"
                      className="todo-form-input"
                      placeholder="회의실 또는 위치 추가"
                      value={editingItem.location || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                    />
                  </div>

                  {/* 설명 / 메모 */}
                  <div className="todo-form-row">
                    <span className="todo-form-icon">📝</span>
                    <textarea
                      className="todo-form-textarea"
                      placeholder="설명 또는 메모 추가"
                      rows={2}
                      value={editingItem.notes || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                    />
                  </div>

                  {/* 라벨 색상 선택 */}
                  <div className="todo-form-row">
                    <span className="todo-form-icon">🎨</span>
                    <div className="todo-color-picker">
                      {Object.entries(CATEGORY_COLORS).map(([name, colorHex]) => (
                        <button
                          key={name}
                          type="button"
                          className={`todo-color-swatch ${editingItem.color === colorHex ? 'selected' : ''}`}
                          style={{ backgroundColor: colorHex }}
                          onClick={() => setEditingItem({ ...editingItem, color: colorHex })}
                          title={name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="todo-modal-footer">
                  {editingItem.id && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm danger-btn"
                      onClick={handleDeleteModal}
                    >
                      삭제
                    </button>
                  )}
                  <div className="todo-footer-right">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsModalOpen(false)}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveModal}
                    >
                      저장
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

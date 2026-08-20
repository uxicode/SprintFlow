'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import type { TodoItem } from '../../types';

dayjs.locale('ko');

type Weekday = '월' | '화' | '수' | '목' | '금';

const WEEKDAY_OPTIONS: Weekday[] = ['월', '화', '수', '목', '금'];

const WEEKDAY_TO_DAY_OFFSET: Record<Weekday, number> = {
  '월': 0,
  '화': 1,
  '수': 2,
  '목': 3,
  '금': 4,
};

const CATEGORY_COLORS: Record<string, string> = {
  '할 일': '#3b82f6',
  '일정': '#0d9488',
};

interface WeeklySummaryViewProps {
  items: TodoItem[];
  onSelectDate: (date: string) => void;
}

/**
 * 월요일 기준 주간 범위를 계산합니다.
 * - 시작 요일이 월요일 이후(화~금)면 → 이번 주 기준
 * - 시작 요일이 월요일 이전이면 → 지난 주 기준 (여기서는 월~금만이므로 해당 없음)
 *
 * 핵심: 끝 요일이 시작 요일보다 앞이면 → 시작은 지난주로 이동
 * 예: 금~목 → 지난주 금 ~ 이번주 목
 */
function computeWeekRange(
  referenceDate: dayjs.Dayjs,
  startDay: Weekday,
  endDay: Weekday,
): { start: dayjs.Dayjs; end: dayjs.Dayjs; dates: dayjs.Dayjs[] } {
  // referenceDate 기준 이번 주 월요일 구하기
  // dayjs().day() → 0=Sun, 1=Mon ... 6=Sat
  const refDayOfWeek = referenceDate.day();
  const mondayOffset = refDayOfWeek === 0 ? -6 : 1 - refDayOfWeek;
  const thisMonday = referenceDate.add(mondayOffset, 'day').startOf('day');

  const startOffset = WEEKDAY_TO_DAY_OFFSET[startDay];
  const endOffset = WEEKDAY_TO_DAY_OFFSET[endDay];

  let startDate: dayjs.Dayjs;
  let endDate: dayjs.Dayjs;

  if (startOffset <= endOffset) {
    // 정상 순서: 예) 월~금, 화~목 등
    startDate = thisMonday.add(startOffset, 'day');
    endDate = thisMonday.add(endOffset, 'day');
  } else {
    // 역순: 예) 금~목 → 지난주 금 ~ 이번주 목
    startDate = thisMonday.subtract(7, 'day').add(startOffset, 'day');
    endDate = thisMonday.add(endOffset, 'day');
  }

  // 날짜 배열 생성 (주말 제외, 월~금만)
  const dates: dayjs.Dayjs[] = [];
  let cursor = startDate;
  while (cursor.isBefore(endDate) || cursor.isSame(endDate, 'day')) {
    const dow = cursor.day();
    // 토(6), 일(0) 제외
    if (dow !== 0 && dow !== 6) {
      dates.push(cursor);
    }
    cursor = cursor.add(1, 'day');
  }

  return { start: startDate, end: endDate, dates };
}

function formatTimeRange(startHour: number, endHour: number): string {
  const fmt = (h: number) => {
    const totalMinutes = Math.round(h * 60);
    const hour24 = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const period = hour24 < 12 ? '오전' : '오후';
    const displayHour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const minStr = mins > 0 ? `:${mins.toString().padStart(2, '0')}` : '';
    return `${period} ${displayHour}${minStr}`;
  };
  return `${fmt(startHour)} ~ ${fmt(endHour)}`;
}

const WEEKDAY_LABELS_MAP: Record<number, string> = {
  1: '월', 2: '화', 3: '수', 4: '목', 5: '금',
};

export default function WeeklySummaryView({ items, onSelectDate }: WeeklySummaryViewProps) {
  const [startDay, setStartDay] = useState<Weekday>('월');
  const [endDay, setEndDay] = useState<Weekday>('금');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = 이번 주

  const referenceDate = useMemo(() => dayjs().add(weekOffset * 7, 'day'), [weekOffset]);

  const { dates, start, end } = useMemo(
    () => computeWeekRange(referenceDate, startDay, endDay),
    [referenceDate, startDay, endDay],
  );

  // 날짜별 아이템 그룹핑
  const groupedByDate = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    for (const d of dates) {
      map.set(d.format('YYYY-MM-DD'), []);
    }
    for (const item of items) {
      const arr = map.get(item.date);
      if (arr) {
        arr.push(item);
      }
    }
    // 시간순 정렬
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startHour - b.startHour);
    }
    return map;
  }, [dates, items]);

  // 주간 통계
  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const arr of groupedByDate.values()) {
      total += arr.length;
      completed += arr.filter((it) => it.completed).length;
    }
    return { total, completed, incomplete: total - completed };
  }, [groupedByDate]);

  const handlePrevWeek = useCallback(() => setWeekOffset((prev) => prev - 1), []);
  const handleNextWeek = useCallback(() => setWeekOffset((prev) => prev + 1), []);
  const handleThisWeek = useCallback(() => setWeekOffset(0), []);

  return (
    <div className="weekly-summary-view">
      {/* 기간 필터 */}
      <div className="weekly-summary-filter">
        <div className="weekly-filter-row">
          <label className="weekly-filter-label">기간 설정</label>
          <div className="weekly-filter-selects">
            <select
              className="weekly-filter-select"
              value={startDay}
              onChange={(e) => setStartDay(e.target.value as Weekday)}
            >
              {WEEKDAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}요일</option>
              ))}
            </select>
            <span className="weekly-filter-separator">~</span>
            <select
              className="weekly-filter-select"
              value={endDay}
              onChange={(e) => setEndDay(e.target.value as Weekday)}
            >
              {WEEKDAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}요일</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 주 네비게이션 */}
      <div className="weekly-summary-nav">
        <button type="button" className="btn btn-secondary btn-xs" onClick={handleThisWeek}>
          이번 주
        </button>
        <div className="weekly-summary-arrows">
          <button type="button" className="btn btn-secondary btn-icon-xs" onClick={handlePrevWeek}>
            ‹
          </button>
          <button type="button" className="btn btn-secondary btn-icon-xs" onClick={handleNextWeek}>
            ›
          </button>
        </div>
        <span className="weekly-summary-range-label">
          {start.format('M/D')} ({start.format('ddd')}) ~ {end.format('M/D')} ({end.format('ddd')})
        </span>
      </div>

      {/* 주간 통계 */}
      <div className="weekly-summary-stats">
        <div className="weekly-stat-item">
          <span className="weekly-stat-value">{stats.total}</span>
          <span className="weekly-stat-label">전체</span>
        </div>
        <div className="weekly-stat-item weekly-stat-completed">
          <span className="weekly-stat-value">{stats.completed}</span>
          <span className="weekly-stat-label">완료</span>
        </div>
        <div className="weekly-stat-item weekly-stat-incomplete">
          <span className="weekly-stat-value">{stats.incomplete}</span>
          <span className="weekly-stat-label">미완료</span>
        </div>
      </div>

      {/* 요일별 컬럼 */}
      <div className="weekly-summary-columns">
        {dates.map((d) => {
          const dateStr = d.format('YYYY-MM-DD');
          const dayItems = groupedByDate.get(dateStr) ?? [];
          const isToday = dateStr === dayjs().format('YYYY-MM-DD');
          const weekdayLabel = WEEKDAY_LABELS_MAP[d.day()] ?? '';

          return (
            <div
              key={dateStr}
              className={`weekly-column ${isToday ? 'is-today' : ''}`}
            >
              <button
                type="button"
                className="weekly-column-header"
                onClick={() => onSelectDate(dateStr)}
                title={`${d.format('M월 D일')} 일간 뷰로 이동`}
              >
                <span className="weekly-column-weekday">{weekdayLabel}</span>
                <span className={`weekly-column-date ${isToday ? 'is-today-badge' : ''}`}>
                  {d.format('D')}
                </span>
              </button>
              <div className="weekly-column-body">
                {dayItems.length === 0 ? (
                  <div className="weekly-empty-slot">일정 없음</div>
                ) : (
                  dayItems.map((item) => {
                    const bgColor = item.color ?? CATEGORY_COLORS[item.category ?? '할 일'] ?? '#3b82f6';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`weekly-event-card ${item.completed ? 'is-completed' : ''}`}
                        style={{ borderLeftColor: bgColor }}
                        onClick={() => onSelectDate(dateStr)}
                        title={`${item.title}\n${formatTimeRange(item.startHour, item.endHour)}`}
                      >
                        <div className="weekly-event-time">
                          {formatTimeRange(item.startHour, item.endHour)}
                        </div>
                        <div className="weekly-event-title">{item.title}</div>
                        {item.completed && (
                          <span className="weekly-event-done-badge">✓</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

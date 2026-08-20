'use client';

import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import type { TodoItem } from '../../types';

dayjs.locale('ko');

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const CATEGORY_COLORS: Record<string, string> = {
  '할 일': '#3b82f6',
  '일정': '#0d9488',
};

interface MonthCalendarViewProps {
  currentMonth: dayjs.Dayjs;
  items: TodoItem[];
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

interface DayCellData {
  date: dayjs.Dayjs;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  todoCount: number;
  scheduleCount: number;
  totalCount: number;
}

function buildMonthGrid(month: dayjs.Dayjs, items: TodoItem[]): DayCellData[] {
  const firstOfMonth = month.startOf('month');
  const lastOfMonth = month.endOf('month');

  // 월요일 기준 (dayjs locale ko: 0=일, 1=월 ... 6=토)
  // 월요일을 0으로 맞추기 위한 오프셋
  const rawDay: number = firstOfMonth.day(); // 0=Sun, 1=Mon ... 6=Sat
  // 월요일 시작으로 변환: Mon=0, Tue=1, ... Sun=6
  const startDayOfWeek = rawDay === 0 ? 6 : rawDay - 1;

  const gridStart = firstOfMonth.subtract(startDayOfWeek, 'day');
  const totalDaysInMonth = lastOfMonth.date();
  const totalCells = startDayOfWeek + totalDaysInMonth;
  const rowCount = Math.ceil(totalCells / 7);
  const cellCount = rowCount * 7;

  const today = dayjs().format('YYYY-MM-DD');

  // 날짜별 카운트 미리 계산
  const countMap = new Map<string, { todo: number; schedule: number }>();
  for (const item of items) {
    const existing = countMap.get(item.date) ?? { todo: 0, schedule: 0 };
    if (item.category === '일정') {
      existing.schedule++;
    } else {
      existing.todo++;
    }
    countMap.set(item.date, existing);
  }

  const cells: DayCellData[] = [];
  for (let i = 0; i < cellCount; i++) {
    const date = gridStart.add(i, 'day');
    const dateStr = date.format('YYYY-MM-DD');
    const counts = countMap.get(dateStr) ?? { todo: 0, schedule: 0 };
    cells.push({
      date,
      dateStr,
      isCurrentMonth: date.month() === month.month(),
      isToday: dateStr === today,
      todoCount: counts.todo,
      scheduleCount: counts.schedule,
      totalCount: counts.todo + counts.schedule,
    });
  }

  return cells;
}

export default function MonthCalendarView({
  currentMonth,
  items,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: MonthCalendarViewProps) {
  const grid = useMemo(() => buildMonthGrid(currentMonth, items), [currentMonth, items]);

  const rows: DayCellData[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    rows.push(grid.slice(i, i + 7));
  }

  return (
    <div className="month-calendar-view">
      {/* 월 네비게이션 */}
      <div className="month-calendar-nav">
        <button type="button" className="btn btn-secondary btn-xs" onClick={onToday}>
          오늘
        </button>
        <div className="month-calendar-arrows">
          <button type="button" className="btn btn-secondary btn-icon-xs" onClick={onPrevMonth}>
            ‹
          </button>
          <button type="button" className="btn btn-secondary btn-icon-xs" onClick={onNextMonth}>
            ›
          </button>
        </div>
        <span className="month-calendar-title">
          {currentMonth.format('YYYY년 M월')}
        </span>
      </div>

      {/* 요일 헤더 */}
      <div className="month-calendar-grid">
        <div className="month-calendar-weekday-header">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="month-calendar-weekday-cell">
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="month-calendar-row">
            {row.map((cell) => (
              <button
                key={cell.dateStr}
                type="button"
                className={[
                  'month-calendar-day-cell',
                  !cell.isCurrentMonth && 'is-outside',
                  cell.isToday && 'is-today',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelectDate(cell.dateStr)}
                title={`${cell.date.format('M월 D일')} — 일정 ${cell.totalCount}건`}
              >
                <span className="month-calendar-day-number">{cell.date.date()}</span>
                {cell.totalCount > 0 && (
                  <div className="month-calendar-dots">
                    {cell.todoCount > 0 && (
                      <span
                        className="month-calendar-dot"
                        style={{ backgroundColor: CATEGORY_COLORS['할 일'] }}
                      />
                    )}
                    {cell.scheduleCount > 0 && (
                      <span
                        className="month-calendar-dot"
                        style={{ backgroundColor: CATEGORY_COLORS['일정'] }}
                      />
                    )}
                    {cell.totalCount > 2 && (
                      <span className="month-calendar-count">+{cell.totalCount}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="month-calendar-legend">
        <div className="month-calendar-legend-item">
          <span className="month-calendar-dot" style={{ backgroundColor: CATEGORY_COLORS['할 일'] }} />
          <span>할 일</span>
        </div>
        <div className="month-calendar-legend-item">
          <span className="month-calendar-dot" style={{ backgroundColor: CATEGORY_COLORS['일정'] }} />
          <span>일정</span>
        </div>
      </div>
    </div>
  );
}

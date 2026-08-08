import { useState, useEffect, useMemo } from 'react';
import GanttChart from './GanttChart';
import { useScheduleData } from '../../hooks/use-schedule-data';
import type { EpicSortOrder } from '../../types';

const EPIC_SORT_ORDER_STORAGE_KEY = 'sprintflow_epic_sort_order';
const SEARCH_KEYWORD_STORAGE_KEY = 'sprintflow_epic_search_keyword';

export default function ScheduleTab() {
  const [searchKeyword, setSearchKeyword] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEARCH_KEYWORD_STORAGE_KEY) || '';
    }
    return '';
  });

  const [epicSortOrder, setEpicSortOrder] = useState<EpicSortOrder>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(EPIC_SORT_ORDER_STORAGE_KEY) as EpicSortOrder) || 'latest';
    }
    return 'latest';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined') {
        const val = (localStorage.getItem(EPIC_SORT_ORDER_STORAGE_KEY) as EpicSortOrder) || 'latest';
        setEpicSortOrder(val);
        const kw = localStorage.getItem(SEARCH_KEYWORD_STORAGE_KEY) || '';
        setSearchKeyword(kw);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleSortChange = (newOrder: EpicSortOrder) => {
    setEpicSortOrder(newOrder);
    if (typeof window !== 'undefined') {
      localStorage.setItem(EPIC_SORT_ORDER_STORAGE_KEY, newOrder);
    }
  };

  const handleKeywordChange = (value: string) => {
    setSearchKeyword(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEARCH_KEYWORD_STORAGE_KEY, value);
    }
  };

  const handleClearKeyword = () => {
    setSearchKeyword('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SEARCH_KEYWORD_STORAGE_KEY);
    }
  };

  const { ganttData, isScheduleLoading } = useScheduleData(epicSortOrder);

  const filteredGanttData = useMemo(() => {
    if (!searchKeyword || !searchKeyword.trim() || !ganttData.epics.length) {
      return ganttData;
    }

    const keywords = searchKeyword
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) return ganttData;

    const filteredEpics = ganttData.epics.filter((epic) => {
      const summary = (epic.summary || '').toLowerCase();
      const key = (epic.key || '').toLowerCase();
      return keywords.some((kw) => summary.includes(kw) || key.includes(kw));
    });

    return {
      ...ganttData,
      epics: filteredEpics,
    };
  }, [ganttData, searchKeyword]);

  return (
    <div className="schedule-management-container">
      <div className="schedule-header-summary">
        <div>
          <h3>🗓️ 에픽별 프로젝트 개발 일정 및 진행 상황</h3>
          <p className="subtitle">각 에픽 하위 티켓의 제목 태그([BE], [FE], [MO]) 기준 진행율 통계</p>
        </div>
        <div className="epic-filter-controls-row" style={{ marginTop: 0 }}>
          <div className="epic-search-input-wrapper">
            <span className="epic-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="epic-search-input"
              placeholder="에픽 검색어 입력 (콤마(,)로 여러 검색어 구별 가능. 예: [관리자] 솔라시도, 대시보드)"
              value={searchKeyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              aria-label="일정 에픽 검색어 필터"
            />
            {searchKeyword && (
              <button
                type="button"
                className="epic-search-clear-btn"
                onClick={handleClearKeyword}
                aria-label="검색어 초기화"
              >
                ✕
              </button>
            )}
          </div>

          <div className="epic-sort-select-wrapper">
            <span className="epic-sort-icon" aria-hidden="true">📊</span>
            <select
              className="epic-sort-select"
              value={epicSortOrder}
              onChange={(e) => handleSortChange(e.target.value as EpicSortOrder)}
              aria-label="에픽 정렬 순서 필터"
              title="에픽 리스트 정렬 순서"
            >
              <option value="latest">🕒 최신 수정일순</option>
              <option value="name_asc">🔤 에픽 이름순</option>
              <option value="progress_desc">📈 진행률 높은순</option>
              <option value="progress_asc">📉 진행률 낮은순</option>
              <option value="due_date_asc">📅 마감일 임박순</option>
              <option value="due_date_desc">📅 마감일 여유순</option>
            </select>
          </div>
        </div>
      </div>

      {isScheduleLoading ? (
        <div className="analytics-loading-state">
          <div className="analytics-spinner"></div>
          <p>일정 데이터를 수집하고 있습니다. 잠시만 기다려 주세요...</p>
        </div>
      ) : ganttData.epics.length === 0 ? (
        <div className="empty-state empty-state--centered">
          <p>조회된 티켓 데이터가 없습니다. 상단 필터를 입력하고 조회를 먼저 진행해 주세요.</p>
        </div>
      ) : filteredGanttData.epics.length === 0 ? (
        <div className="empty-state empty-state--centered">
          <p>입력하신 검색어 ('{searchKeyword}') 와 일치하는 에픽 일정이 없습니다.</p>
        </div>
      ) : (
        <GanttChart ganttData={filteredGanttData} />
      )}
    </div>
  );
}

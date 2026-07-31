import { useState, useEffect } from 'react';
import TabButton from '../TabButton';
import TabPanel from '../TabPanel';
import ReportTabActions from '../ReportTabActions';
import MarkdownReportView from '../MarkdownReportView';
import TicketTable from './TicketTable';
import ScheduleTab from '../schedule/ScheduleTab';
import GenieDockWrapper from '../GenieDockWrapper';
import { useReportActions } from '../../hooks/use-report-actions';
import { applyWeeklyReportFilter } from '../../utils/jira';
import type { WeeklyReportTagFilters } from '../../types';

const SEARCH_KEYWORD_STORAGE_KEY = 'sprintflow_epic_search_keyword';
const TAG_FILTERS_STORAGE_KEY = 'sprintflow_weekly_tag_filters';
const REPORT_SECTION_COLLAPSED_KEY = 'sprintflow_report_section_collapsed';

export default function ReportSection() {
  const [searchKeyword, setSearchKeyword] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SEARCH_KEYWORD_STORAGE_KEY) || '';
    }
    return '';
  });

  const [tagFilters, setTagFilters] = useState<WeeklyReportTagFilters>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(TAG_FILTERS_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('태그 필터 설정 로드 실패:', e);
        }
      }
    }
    return {
      hideTicketNumber: false,
      hidePosition: false,
      hideDueDate: false,
      hideAssignee: false,
      groupCategory: false,
    };
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(REPORT_SECTION_COLLAPSED_KEY) === 'true';
    }
    return false;
  });

  // 저장 (상태 변경 시)
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

  const handleToggleTagFilter = (key: keyof WeeklyReportTagFilters) => {
    setTagFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== 'undefined') {
        localStorage.setItem(TAG_FILTERS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(REPORT_SECTION_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  };

  const {
    activeTab,
    handleTabChange,
    dailyReportMd,
    weeklyReportMd,
    tickets,
    parseMarkdownToHtml,
    handleCopyReport,
    handleDownloadReport,
    handlePublishConfluence,
    isDownloading,
  } = useReportActions();

  useEffect(() => {
    if (!isDownloading) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDownloading]);

  const processedWeeklyMd = applyWeeklyReportFilter(weeklyReportMd, searchKeyword, tagFilters);

  return (
    <GenieDockWrapper sectionId="report">
      <section className={`report-section card ${isCollapsed ? 'collapsed' : ''}`}>
        {isDownloading && (
          <div
            className="report-download-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-busy="true"
            aria-live="polite"
            aria-label="주간 업무 보고서 다운로드 중"
          >
            <div className="report-download-overlay__panel card">
              <div className="analytics-spinner" />
              <p className="report-download-overlay__message">
                주간 업무 보고서를 생성하는 중입니다...
              </p>
              <p className="report-download-overlay__hint">
                일정 데이터를 불러와 에픽 진행률을 계산하고 있습니다. 잠시만 기다려 주세요.
              </p>
              <div className="report-download-progress" aria-hidden="true">
                <div className="report-download-progress__bar" />
              </div>
            </div>
          </div>
        )}

        <div className="report-tabs-header">
          <div className="tabs">
            <TabButton isActive={activeTab === 'tab-daily'} onClick={() => handleTabChange('tab-daily')} disabled={isDownloading}>
              일일 업무
            </TabButton>
            <TabButton isActive={activeTab === 'tab-weekly'} onClick={() => handleTabChange('tab-weekly')} disabled={isDownloading}>
              주간 업무
            </TabButton>
            <TabButton isActive={activeTab === 'tab-raw'} onClick={() => handleTabChange('tab-raw')} disabled={isDownloading}>
              조회된 티켓 목록
            </TabButton>
            <TabButton isActive={activeTab === 'tab-schedule'} onClick={() => handleTabChange('tab-schedule')} disabled={isDownloading}>
              🗓️ 일정관리
            </TabButton>
          </div>
          <div className="report-header-actions">
            <ReportTabActions
              onCopy={() => handleCopyReport(searchKeyword, tagFilters)}
              onDownload={() => handleDownloadReport(searchKeyword, tagFilters)}
              onPublishConfluence={() => handlePublishConfluence(searchKeyword, tagFilters)}
              disabled={isDownloading}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm report-toggle-btn"
              onClick={handleToggleCollapse}
              aria-label={isCollapsed ? '보고서 영역 펼치기' : '보고서 영역 접기'}
              title={isCollapsed ? '보고서 영역 펼치기' : '보고서 영역 접기'}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`toggle-icon ${isCollapsed ? 'collapsed' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {activeTab === 'tab-weekly' && (
              <div className="weekly-filter-controls">
                <div className="epic-search-bar-container">
                  <div className="epic-search-input-wrapper">
                    <span className="epic-search-icon" aria-hidden="true">🔍</span>
                    <input
                      type="text"
                      className="epic-search-input"
                      placeholder="에픽 검색어 입력 (콤마(,)로 여러 검색어 구별 가능. 예: [관리자] 솔라시도, 대시보드)"
                      value={searchKeyword}
                      onChange={(e) => handleKeywordChange(e.target.value)}
                      aria-label="에픽 검색어 필터"
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
                </div>

                {/* 태그 칩(Chip) 필터 영역 */}
                <div className="tag-filter-chips-container">
                  <span className="tag-filter-chips-title">🏷️ 항목 숨김 필터:</span>
                  <div className="tag-chips-group">
                    <button
                      type="button"
                      className={`tag-chip ${tagFilters.hideTicketNumber ? 'active' : ''}`}
                      onClick={() => handleToggleTagFilter('hideTicketNumber')}
                      title="활성화 시 티켓넘버(예: DI26-625:)를 텍스트에서 숨깁니다"
                    >
                      <span className="chip-icon">🎟️</span>
                      <span>티켓넘버</span>
                      {tagFilters.hideTicketNumber && <span className="chip-badge">숨김</span>}
                    </button>

                    <button
                      type="button"
                      className={`tag-chip ${tagFilters.hidePosition ? 'active' : ''}`}
                      onClick={() => handleToggleTagFilter('hidePosition')}
                      title="활성화 시 포지션(예: (FE))을 텍스트에서 숨깁니다"
                    >
                      <span className="chip-icon">💻</span>
                      <span>포지션</span>
                      {tagFilters.hidePosition && <span className="chip-badge">숨김</span>}
                    </button>

                    <button
                      type="button"
                      className={`tag-chip ${tagFilters.hideDueDate ? 'active' : ''}`}
                      onClick={() => handleToggleTagFilter('hideDueDate')}
                      title="활성화 시 기한 및 갱신일을 텍스트에서 숨깁니다"
                    >
                      <span className="chip-icon">📅</span>
                      <span>기한</span>
                      {tagFilters.hideDueDate && <span className="chip-badge">숨김</span>}
                    </button>

                    <button
                      type="button"
                      className={`tag-chip ${tagFilters.hideAssignee ? 'active' : ''}`}
                      onClick={() => handleToggleTagFilter('hideAssignee')}
                      title="활성화 시 담당자를 텍스트에서 숨깁니다"
                    >
                      <span className="chip-icon">👤</span>
                      <span>담당자</span>
                      {tagFilters.hideAssignee && <span className="chip-badge">숨김</span>}
                    </button>

                    <button
                      type="button"
                      className={`tag-chip ${tagFilters.groupCategory ? 'active' : ''}`}
                      onClick={() => handleToggleTagFilter('groupCategory')}
                      title="활성화 시 동일한 카테고리를 가진 항목들을 하나로 묶어 표현합니다"
                    >
                      <span className="chip-icon">📂</span>
                      <span>카테고리 중복</span>
                      {tagFilters.groupCategory && <span className="chip-badge">그룹</span>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="tab-content-container">
              <TabPanel isActive={activeTab === 'tab-daily'}>
                <MarkdownReportView html={parseMarkdownToHtml(dailyReportMd)} />
              </TabPanel>
              <TabPanel isActive={activeTab === 'tab-weekly'}>
                <MarkdownReportView html={parseMarkdownToHtml(processedWeeklyMd)} />
              </TabPanel>
              <TabPanel isActive={activeTab === 'tab-raw'}>
                <TicketTable tickets={tickets} />
              </TabPanel>
              <TabPanel isActive={activeTab === 'tab-schedule'}>
                <ScheduleTab />
              </TabPanel>
            </div>
          </>
        )}
      </section>
    </GenieDockWrapper>
  );
}

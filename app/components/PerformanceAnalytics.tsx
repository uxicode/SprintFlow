'use client';

import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import type { Ticket } from '../types';
import clsx from 'clsx';
import DateRangePicker from './DateRangePicker';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  type PieLabelRenderProps,
} from 'recharts';
import {
  analyzeMonthlyPerformance,
  generateTrendTimeSeriesData,
  generateInsights,
  generatePerformanceReport,
  generateCSV,
  predictNextMonth,
  filterTicketsByDateRange,
  sumChartCompletedTotal,
} from '../utils/analytics';
import { buildAnalyticsJql } from '../utils/jqlHelpers';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import FormField from './FormField';
import SummaryMetricCard from './SummaryMetricCard';
import InsightsTicketSection from './InsightsTicketSection';

const PERIOD_PRESET_MONTHS = [1, 3, 6, 12];

/**
 * 기간 프리셋 날짜 계산 함수
 * @param {number} months - 개월 수
 * @returns {Object} - 시작일과 종료일
 */
function getPeriodDates(months: number) {
  const today = new Date();
  const end = endOfMonth(today);
  const start = startOfMonth(subMonths(today, months - 1));
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

/**
 * 기간 프리셋 감지 함수
 * @param {string} dateStart - 시작일
 * @param {string} dateEnd - 종료일
 * @returns {number | 'custom'} - 기간 프리셋 값 또는 'custom'
 */
function detectPeriodPreset(dateStart: string, dateEnd: string): number | 'custom' {
  for (const months of PERIOD_PRESET_MONTHS) {
    const { start, end } = getPeriodDates(months);
    if (dateStart === start && dateEnd === end) return months;
  }
  return 'custom';
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

function renderCompletionPieLabel(props: PieLabelRenderProps) {
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, name, percent } = props;
  const RADIAN = Math.PI / 180;
  const centerX = Number(cx);
  const centerY = Number(cy);
  const labelRadius = Number(outerRadius) + 14;
  const x = centerX + labelRadius * Math.cos(-midAngle * RADIAN);
  const y = centerY + labelRadius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > centerX ? 'start' : x < centerX ? 'end' : 'middle';
  const pct = ((percent ?? 0) * 100).toFixed(0);

  return (
    <text
      x={x}
      y={y}
      fill="#ccc"
      textAnchor={textAnchor}
      dominantBaseline="central"
      fontSize={12}
    >
      {`${String(name ?? '')} ${pct}%`}
    </text>
  );
}

export interface PerformanceAnalyticsProps {
  tickets: Ticket[];
  projectKey: string;
  setProjectKey: (value: string) => void;
  teamMembers: string;
  setTeamMembers: (value: string) => void;
  dateStart: string;
  dateEnd: string;
  setDateStart: (value: string) => void;
  setDateEnd: (value: string) => void;
  onFetch?: (dateStart: string, dateEnd: string) => void;
  isLoading: boolean;
}

export default function PerformanceAnalytics({
  tickets,
  projectKey,
  setProjectKey,
  teamMembers,
  setTeamMembers,
  dateStart,
  dateEnd,
  setDateStart,
  setDateEnd,
  onFetch,
  isLoading
}: PerformanceAnalyticsProps) {
  const [viewMode, setViewMode] = useState('trend');
  const [chartType, setChartType] = useState('line');
  const [periodPreset, setPeriodPreset] = useState<number | 'custom'>(1);
  const [excludedTicketKeys, setExcludedTicketKeys] = useState<Set<string>>(new Set());

  // 시작/종료일과 프리셋 동기화
  useEffect(() => {
    if (!dateStart || !dateEnd) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriodPreset(detectPeriodPreset(dateStart, dateEnd));
  }, [dateStart, dateEnd]);

  // 선택 기간 내 티켓만 집계 (JQL 보조 필터)
  const periodTickets = useMemo(() => {
    return filterTicketsByDateRange(tickets, dateStart, dateEnd);
  }, [tickets, dateStart, dateEnd]);

  // 티켓 데이터가 새로 조회되면 제외 목록 초기화
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExcludedTicketKeys(new Set());
  }, [periodTickets]);

  // 체크박스에서 제외된 티켓을 필터링한 활성 티켓 목록
  const activeTickets = useMemo(() => {
    if (!periodTickets || periodTickets.length === 0) return [];
    return periodTickets.filter((t: Ticket) => !excludedTicketKeys.has(t.key));
  }, [periodTickets, excludedTicketKeys]);

  const analyticsJql = useMemo(() => {
    return buildAnalyticsJql(projectKey, teamMembers, dateStart, dateEnd);
  }, [projectKey, teamMembers, dateStart, dateEnd]);

  const analysis = useMemo(() => {
    return analyzeMonthlyPerformance(activeTickets);
  }, [activeTickets]);

  const trendSeries = useMemo(() => {
    return generateTrendTimeSeriesData(activeTickets, dateStart, dateEnd);
  }, [activeTickets, dateStart, dateEnd]);

  const timeSeriesData = trendSeries.data;
  const isDailyTrend = trendSeries.granularity === 'day';
  const chartCompletedTotal = useMemo(
    () => sumChartCompletedTotal(timeSeriesData),
    [timeSeriesData]
  );

  const insights = useMemo(() => {
    return generateInsights(activeTickets, analysis);
  }, [activeTickets, analysis]);

  const predictions = useMemo(() => {
    return predictNextMonth(activeTickets);
  }, [activeTickets]);

  // useMemo를 쓴 이유는 계산 비용이 비싸거나(즉, activeTickets, tickets 등 데이터가 많을 때), 
  // 또는 매 렌더마다 불필요하게 재계산되지 않게 의존성 배열(deps) 값이 변경될 때만
  // 결과를 다시 계산하도록 메모이제이션(memoization) 하기 위해서입니다.
  // 예시:
  // - summaryStats: activeTickets가 변경될 때만 총합/완료/진행중/율을 다시 계산
  // - analysis, trendSeries, insights, predictions 등도 데이터/기간/preset이 바뀔 때만 계산
  // 즉, 성능 최적화(불필요한 재계산 방지, 렌더 효율화) 목적입니다.
  const summaryStats = useMemo(() => {
    if (!activeTickets || activeTickets.length === 0) {
      return { total: 0, completed: 0, inProgress: 0, completionRate: 0 };
    }
    const total = activeTickets.length;
    const completed = activeTickets.filter((t: Ticket) => {
      const st = (t.status || '').toLowerCase();
      return st.includes('done') || st.includes('resolved') || st.includes('완료') || st.includes('closed') || st.includes('성공');
    }).length;
    const inProgress = activeTickets.filter((t: Ticket) => {
      const st = (t.status || '').toLowerCase();
      return st.includes('progress') || st.includes('진행') || st.includes('doing') || st.includes('개발') || st.includes('selected') || st.includes('working');
    }).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, completionRate };
  }, [activeTickets]);

  // 원본 티켓 기준으로 MVP 및 고WIP 담당자 식별 (체크박스 목록 렌더링용)
  const { mvpMember, wipMembers } = useMemo(() => {
    if (!periodTickets || periodTickets.length === 0) return { mvpMember: null, wipMembers: [] };
    const byAssignee: Record<string, { completed: number; inProgress: number }> = {};
    periodTickets.forEach((t: Ticket) => {
      if (!byAssignee[t.assignee]) byAssignee[t.assignee] = { completed: 0, inProgress: 0 };
      const st = (t.status || '').toLowerCase();
      if (st.includes('done') || st.includes('resolved') || st.includes('완료') || st.includes('closed')) {
        byAssignee[t.assignee].completed++;
      } else if (st.includes('progress') || st.includes('진행') || st.includes('doing') || st.includes('개발')) {
        byAssignee[t.assignee].inProgress++;
      }
    });
    let topMember: string | null = null;
    let topCompleted = 0;
    const wipList: string[] = [];
    Object.keys(byAssignee).forEach(a => {
      if (byAssignee[a].completed > topCompleted) {
        topCompleted = byAssignee[a].completed;
        topMember = a;
      }
      if (byAssignee[a].inProgress > 5) wipList.push(a);
    });
    return { mvpMember: topMember, wipMembers: wipList };
  }, [periodTickets]);

  const completionPieData = useMemo(
    () => analysis.summary.filter((member) => member.completed > 0),
    [analysis.summary]
  );

  const handleToggleTicket = (ticketKey: string) => {
    setExcludedTicketKeys(prev => {
      const next = new Set(prev);
      if (next.has(ticketKey)) {
        next.delete(ticketKey);
      } else {
        next.add(ticketKey);
      }
      return next;
    });
  };

  const handleDownloadMonthlyReport = () => {
    const report = generatePerformanceReport(activeTickets, analysis, 'monthly');
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Monthly_Performance_${format(new Date(), 'yyyy-MM')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadYearlyReport = () => {
    const report = generatePerformanceReport(activeTickets, analysis, 'yearly');
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Yearly_Performance_${format(new Date(), 'yyyy')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV(analysis.summary);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Performance_Data_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = (type: 'monthly' | 'yearly') => {
    const report = generatePerformanceReport(activeTickets, analysis, type);
    navigator.clipboard.writeText(report)
      .then(() => alert(`${type === 'monthly' ? '월별' : '연간'} 실적 보고서가 클립보드에 복사되었습니다.`))
      .catch(() => alert('복사 중 오류가 발생했습니다.'));
  };

  const handlePeriodPresetChange = (value: string) => {
    if (value === 'custom') return;
    const months = Number(value);
    const { start, end } = getPeriodDates(months);
    setPeriodPreset(months);
    setDateStart(start);
    setDateEnd(end);
  };

  return (
    <div className="analytics-container">
      {/* 헤더 & 컨트롤 */}
      <div className="analytics-header">
        <div className="analytics-title">
          <h3>📊  담당자별 실적 분석</h3>
          <div className="jql-body">
          <p>프로젝트: {projectKey} | 기간: {dateStart} ~ {dateEnd} | 수집 {periodTickets.length}건</p>
            <code>
              <p className="analytics-jql-hint">JQL: {analyticsJql}</p>
            </code>
          </div>
        </div>
        <div className="analytics-controls">
          <FormField
            variant="control"
            id="analytics-project-key"
            label="프로젝트:"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            placeholder="예: DI26"
            inputClassName="control-input--project"
          />
          <FormField
            variant="control"
            id="analytics-team-members"
            label="팀원:"
            value={teamMembers}
            onChange={(e) => setTeamMembers(e.target.value)}
            placeholder="홍길동, 김철수"
            inputClassName="control-input--team"
          />

          <div className="control-divider control-divider--narrow"></div>

          <DateRangePicker
            variant="control"
            label="기간:"
            dateStart={dateStart}
            dateEnd={dateEnd}
            onChange={(start, end) => {
              setDateStart(start);
              setDateEnd(end);
            }}
          />
          <FormField
            variant="control"
            as="select"
            id="analytics-period-preset"
            label=""
            value={periodPreset}
            onChange={(e) => handlePeriodPresetChange(e.target.value)}
          >
            <option value={1}>1개월</option>
            <option value={3}>최근 3개월</option>
            <option value={6}>최근 6개월</option>
            <option value={12}>최근 12개월</option>
            {periodPreset === 'custom' && <option value="custom">직접 설정</option>}
          </FormField>
          <button
            onClick={() => onFetch && onFetch(dateStart, dateEnd)}
            disabled={isLoading}
            className="btn btn-primary btn-analytics-fetch"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>

          <div className="control-divider control-divider--wide"></div>

          <FormField variant="control" as="select" label="보기 모드:" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="trend">시계열 트렌드</option>
            <option value="comparison">담당자 비교</option>
            <option value="insights">인사이트 & 예측</option>
          </FormField>
          {viewMode === 'trend' && (
            <FormField variant="control" as="select" label="차트 타입:" value={chartType} onChange={(e) => setChartType(e.target.value)}>
              <option value="line">라인 차트</option>
              <option value="bar">바 차트</option>
            </FormField>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="analytics-loading-state">
          <div className="analytics-spinner"></div>
          <p>실적 데이터를 수집하고 있습니다. 잠시만 기다려 주세요...</p>
        </div>
      ) : !periodTickets || periodTickets.length === 0 ? (
        <div className="analytics-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3>분석할 데이터가 없습니다</h3>
          <p>상단의 조회 기간을 확인하신 후 &apos;조회&apos; 버튼을 클릭해 주세요.</p>
        </div>
      ) : (
        <>
          {/* 요약 메트릭 카드 */}
          <div className="analytics-summary-cards">
            <SummaryMetricCard
              label="전체 수집 티켓"
              value={`${summaryStats.total}건`}
              hint="기간 내 활동(updated) 티켓 전체"
              icon={(
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              )}
            />
            <SummaryMetricCard
              label="완료한 티켓"
              value={`${summaryStats.completed}건`}
              variant="success"
              hint={`차트 합계 ${chartCompletedTotal}건`}
              icon={(
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            />
            <SummaryMetricCard
              label="진행 중인 업무"
              value={`${summaryStats.inProgress}건`}
              variant="accent"
              icon={(
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
              )}
            />
            <SummaryMetricCard
              label="팀 전체 완료율"
              value={`${summaryStats.completionRate}%`}
              variant="warning"
              icon={(
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              )}
            />
          </div>

          {/* 다운로드 버튼 */}
          <div className="analytics-actions">
            <button onClick={handleDownloadMonthlyReport} className="btn btn-secondary btn-sm">
              📄 월별 리포트 다운로드
            </button>
            <button onClick={handleDownloadYearlyReport} className="btn btn-secondary btn-sm">
              📅 연간 리포트 다운로드
            </button>
            <button onClick={handleDownloadCSV} className="btn btn-primary btn-sm">
              📊 CSV 내보내기
            </button>
            <button onClick={() => handleCopyReport('monthly')} className="btn btn-secondary btn-sm">
              📋 월별 보고서 복사
            </button>
          </div>

          {/* 메인 컨텐츠 */}
          {viewMode === 'trend' && (
            <div className="analytics-content">
              <div className="chart-section card">
                <h4>{isDailyTrend ? '일별 완료 티켓 추이' : '월별 완료 티켓 추이'}</h4>
                <p className="chart-section-note">
                  완료(Done) 상태만 집계합니다. 전체 수집({summaryStats.total}건) = 완료 + 진행 중 + 대기.
                </p>
                <ResponsiveContainer width="100%" height={400}>
                  {chartType === 'line' ? (
                    <LineChart data={timeSeriesData as Record<string, unknown>[]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="period"
                        stroke="#888"
                        interval={isDailyTrend ? 'preserveStartEnd' : 0}
                        angle={isDailyTrend ? -35 : 0}
                        textAnchor={isDailyTrend ? 'end' : 'middle'}
                        height={isDailyTrend ? 56 : 30}
                      />
                      <YAxis stroke="#888" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      {analysis.summary.map((member, idx) => (
                        <Line
                          key={member.assignee}
                          type="monotone"
                          dataKey={member.assignee}
                          stroke={COLORS[idx % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={timeSeriesData as Record<string, unknown>[]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="period"
                        stroke="#888"
                        interval={isDailyTrend ? 'preserveStartEnd' : 0}
                        angle={isDailyTrend ? -35 : 0}
                        textAnchor={isDailyTrend ? 'end' : 'middle'}
                        height={isDailyTrend ? 56 : 30}
                      />
                      <YAxis stroke="#888" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      {analysis.summary.map((member, idx) => (
                        <Bar
                          key={member.assignee}
                          dataKey={member.assignee}
                          fill={COLORS[idx % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {viewMode === 'comparison' && (
            <div className="analytics-content">
              <div className="comparison-grid">
                {/* 완료 건수 비교 */}
                <div className="chart-section card">
                  <h4>완료 건수 비교</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analysis.summary} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#888" />
                      <YAxis dataKey="assignee" type="category" stroke="#888" width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Bar dataKey="completed" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 완료율 파이 차트 — Flexbox + responsive (Recharts PieChartInFlexbox) */}
                <div className="chart-section card">
                  <h4>담당자별 완료 비율</h4>
                  <p className="chart-section-note">
                    완료 건수 기준 비중 · 슬라이스 간격과 둥근 모서리 적용
                  </p>
                  {completionPieData.length === 0 ? (
                    <p className="chart-section-empty">완료 건수가 있는 담당자가 없습니다.</p>
                  ) : (
                    <div className="completion-pie-flex">
                      {/* PieChart margin — 좌우 52px 여백을 줘서 라벨이 SVG 밖으로 잘리지 않게 함
                          컨테이너 — maxWidth: 280px 제한을 풀고, 중앙 정렬 + 최대 380px
                          라벨 위치만 조정 — 표시 문구는 동일하고, 좌/우에 따라 textAnchor를 바꿔 긴 이름이 잘리지 않게 함 */}
                      <PieChart
                        responsive
                        className="completion-pie-flex__chart"
                        margin={{ top: 12, right: 52, bottom: 12, left: 52 }}
                      >
                        <Pie
                          data={completionPieData}
                          dataKey="completed"
                          nameKey="assignee"
                          cx="50%"
                          cy="50%"
                          outerRadius="80%"
                          innerRadius="60%"
                          stroke="none"
                          label={renderCompletionPieLabel}
                          labelLine={false}
                        >
                          {completionPieData.map((entry, index) => (
                            <Cell key={`cell-${entry.assignee}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                          formatter={(value, _name, item) => {
                            const payload = item.payload as { assignee?: string; completionRate?: number };
                            const count = typeof value === 'number' ? value : Number(value ?? 0);
                            return [
                              `${count}건 (완료율 ${payload.completionRate ?? 0}%)`,
                              payload.assignee ?? '',
                            ];
                          }}
                        />
                      </PieChart>
                      
                    </div>
                  )}
                </div>

                {/* 담당자별 티켓 상태 누적 비교 (Stacked Bar Chart) */}
                <div className="chart-section card chart-section--wide">
                  <h4>담당자별 티켓 상태 누적 비교</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analysis.summary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="assignee" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Bar dataKey="completed" name="완료 (Done)" fill="#10b981" stackId="a" />
                      <Bar dataKey="inProgress" name="진행 중 (In Progress)" fill="#3b82f6" stackId="a" />
                      <Bar dataKey="todo" name="대기 중 (To Do)" fill="#f59e0b" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 상세 테이블 */}
              <div className="performance-table card">
                <h4>상세 실적 순위</h4>
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>담당자</th>
                      <th>완료</th>
                      <th>진행중</th>
                      <th>대기</th>
                      <th>전체</th>
                      <th>완료율</th>
                      <th>평균완료시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.summary.map((member, idx) => {
                      const rank = idx + 1;
                      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                      return (
                        <tr key={member.assignee}>
                          <td className="table-rank-cell">{medal} {rank}</td>
                          <td><strong>{member.assignee}</strong></td>
                          <td>{member.completed}</td>
                          <td>{member.inProgress}</td>
                          <td>{member.todo}</td>
                          <td>{member.total}</td>
                          <td>
                            <div className="progress-bar-cell">
                              <div className="progress-bar-bg">
                                <div
                                  className="progress-bar-fill"
                                  style={{ '--progress': `${member.completionRate}%` } as CSSProperties}
                                ></div>
                              </div>
                              <span>{member.completionRate}%</span>
                            </div>
                          </td>
                          <td>{member.avgCompletionTime || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'insights' && (
            <div className="analytics-content">
              {/* 인사이트 카드 */}
              <div className="insights-section card">
                <h4>🎯 자동 생성 인사이트</h4>
                {excludedTicketKeys.size > 0 && (
                  <p className="insights-excluded-note">
                    ⚡ 현재 {excludedTicketKeys.size}건의 티켓이 제외되어 재계산된 결과입니다.
                  </p>
                )}
                <ul className="insights-list">
                  {insights.map((insight, idx) => (
                    <li key={idx} className="insight-item">{insight}</li>
                  ))}
                </ul>
              </div>

              {/* MVP 담당자 전체 티켓 체크리스트 */}
              {mvpMember && (
                <InsightsTicketSection
                  title={`🏆 MVP 후보: ${mvpMember} — 티켓 상세`}
                  badgeVariant="success"
                  includedCount={periodTickets.filter((t: Ticket) => t.assignee === mvpMember && !excludedTicketKeys.has(t.key)).length}
                  totalCount={periodTickets.filter((t: Ticket) => t.assignee === mvpMember).length}
                  tickets={periodTickets.filter((t: Ticket) => t.assignee === mvpMember)}
                  excludedTicketKeys={excludedTicketKeys}
                  checkboxVariant="success"
                  onToggleTicket={handleToggleTicket}
                />
              )}

              {wipMembers.filter(m => m !== mvpMember).map(member => {
                const memberTickets = periodTickets.filter((t: Ticket) => t.assignee === member);
                return (
                  <InsightsTicketSection
                    key={member}
                    title={`⚠️ 고 WIP 담당자: ${member} — 티켓 상세`}
                    badgeVariant="warning"
                    includedCount={memberTickets.filter((t: Ticket) => !excludedTicketKeys.has(t.key)).length}
                    totalCount={memberTickets.length}
                    tickets={memberTickets}
                    excludedTicketKeys={excludedTicketKeys}
                    checkboxVariant="warning"
                    onToggleTicket={handleToggleTicket}
                  />
                );
              })}

              {/* 예측 데이터 */}
              <div className="predictions-section card">
                <h4>🔮 다음 달 예상 실적</h4>
                <p className="prediction-note">* 최근 3개월 평균을 기반으로 한 예측입니다.</p>
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>담당자</th>
                      <th>예상 완료량</th>
                      <th>신뢰도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(predictions).map(assignee => {
                      const pred = (predictions as Record<string, { predicted: number; confidence: string }>)[assignee];
                      const confidenceText = pred.confidence === 'high' ? '높음' : pred.confidence === 'medium' ? '중간' : '낮음';
                      return (
                        <tr key={assignee}>
                          <td><strong>{assignee}</strong></td>
                          <td>약 {pred.predicted}건</td>
                          <td>
                            <span className={clsx('confidence-badge', `confidence-badge--${pred.confidence}`)}>
                              {confidenceText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 개선 제안 */}
              <div className="recommendations-section card">
                <h4>💡 개선 제안</h4>
                <div className="recommendation-cards">
                  <div className="recommendation-card">
                    <div className="recommendation-icon">🚀</div>
                    <h5>생산성 향상</h5>
                    <p>WIP(Work In Progress) 제한을 5개 이하로 유지하여 멀티태스킹을 줄이세요.</p>
                  </div>
                  <div className="recommendation-card">
                    <div className="recommendation-icon">⚡</div>
                    <h5>병목 제거</h5>
                    <p>진행 중인 티켓이 오래 머무는 경우 일일 스탠드업에서 블로커를 식별하세요.</p>
                  </div>
                  <div className="recommendation-card">
                    <div className="recommendation-icon">📈</div>
                    <h5>균형 배분</h5>
                    <p>티켓을 팀원 간 균등하게 배분하여 부하를 분산하세요.</p>
                  </div>
                  <div className="recommendation-card">
                    <div className="recommendation-icon">🎯</div>
                    <h5>목표 설정</h5>
                    <p>월별 개인 목표를 설정하고 주간 회고에서 진행 상황을 점검하세요.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

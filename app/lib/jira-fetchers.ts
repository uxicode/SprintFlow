import dayjs from 'dayjs';
import { JqlQueryBuilder, getVacationMembers } from '../utils/jira';
import { fetchJiraTickets } from '../utils/jiraApi';
import { generateMockTickets } from '../utils/mockTickets';
import { fetchCalendarEvents } from '../utils/calendarApi';
import { buildJql, buildNextWeekJql, buildScheduleJql, buildAnalyticsJql } from '../utils/jqlHelpers';
import { generateReports } from './generate-reports';
import type {
  AnalyticsBundle,
  AppConfig,
  DashboardBundle,
  ExchangeCalendarOAuthParams,
  FetchAnalyticsBundleParams,
  FetchDashboardBundleParams,
  FetchScheduleBundleParams,
  OAuthTokenResponse,
  ScheduleBundle,
} from '../types';

function getNextWeekRange(start: string, end: string): { nextStart: string; nextEnd: string } {
  return {
    nextStart: dayjs(start).add(7, 'day').format('YYYY-MM-DD'),
    nextEnd: dayjs(end).add(7, 'day').format('YYYY-MM-DD'),
  };
}

export async function fetchDashboardBundle({
  apiMode,
  credentials,
  filter,
  calendar,
  registeredMembers,
  onProgress,
}: FetchDashboardBundleParams): Promise<DashboardBundle> {
  const { projectKey, teamMembers, dateStart, dateEnd } = filter;
  const { nextStart, nextEnd } = getNextWeekRange(dateStart, dateEnd);
  const thisYear = dayjs().year();

  if (!apiMode) {
    const mockTickets = generateMockTickets(projectKey, teamMembers, dateStart, dateEnd);
    const mockNextTickets = generateMockTickets(projectKey, teamMembers, nextStart, nextEnd);
    const mockScheduleTickets = generateMockTickets(projectKey, teamMembers, `${thisYear}-01-01`, `${thisYear}-12-31`);
    const vacationMembers = ['이영희'];
    const reports = generateReports({
      currList: mockTickets,
      nextList: mockNextTickets,
      start: dateStart,
      end: dateEnd,
      proj: projectKey,
      rawEvents: vacationMembers,
      targetRegs: registeredMembers,
      jiraUrl: credentials.url,
      scheduleTickets: mockScheduleTickets,
    });

    return {
      tickets: mockTickets,
      nextTickets: mockNextTickets,
      calendarEvents: vacationMembers,
      calendarMeta: null,
      reports,
      statusText: `시뮬레이션 (이번 주 ${mockTickets.length}건 / 다음 주 ${mockNextTickets.length}건)`,
    };
  }

  const jql = buildJql(projectKey, teamMembers, dateStart, dateEnd);
  const nextJql = buildNextWeekJql(projectKey, teamMembers, dateStart, dateEnd);
  const scheduleJql = buildScheduleJql(projectKey, teamMembers);

  onProgress?.({ dot: 'success', text: '이번 주 데이터 로드 중...' });
  const tickets = await fetchJiraTickets(jql, credentials.url, credentials.email, credentials.token, onProgress);

  onProgress?.({ dot: 'success', text: '다음 주 계획 데이터 로드 중...' });
  const nextTickets = await fetchJiraTickets(nextJql, credentials.url, credentials.email, credentials.token, onProgress);

  onProgress?.({ dot: 'success', text: '올해 에픽 스케줄 데이터 로드 중...' });
  const scheduleTickets = await fetchJiraTickets(scheduleJql, credentials.url, credentials.email, credentials.token, onProgress);

  onProgress?.({ dot: 'success', text: '캘린더 연차 데이터 조회 중...' });
  let calendarEvents: DashboardBundle['calendarEvents'] = [];
  let calendarMeta: DashboardBundle['calendarMeta'] = null;
  if (calendar.calendarId && (calendar.accessToken || calendar.refreshToken)) {
    const result = await fetchCalendarEvents({
      calId: calendar.calendarId,
      start: dateStart,
      end: dateEnd,
      accessToken: calendar.accessToken,
      refreshToken: calendar.refreshToken,
      clientId: calendar.clientId,
      clientSecret: calendar.clientSecret,
    });
    if (result.error) {
      calendarMeta = {
        error: result.error,
        needReauth: result.needReauth,
      };
    } else {
      calendarEvents = result.items;
      if (result.newAccessToken) {
        calendarMeta = { newAccessToken: result.newAccessToken };
      }
    }
  }

  const vacationCount = getVacationMembers(calendarEvents, dateStart, dateEnd, registeredMembers).length;
  const reports = generateReports({
    currList: tickets,
    nextList: nextTickets,
    start: dateStart,
    end: dateEnd,
    proj: projectKey,
    rawEvents: calendarEvents,
    targetRegs: registeredMembers,
    jiraUrl: credentials.url,
    scheduleTickets,
  });

  return {
    tickets,
    nextTickets,
    calendarEvents,
    calendarMeta,
    reports,
    statusText: `Jira API 연동 완료 (이번 주 ${tickets.length}건 / 다음 주 ${nextTickets.length}건 / 연차 ${vacationCount}명)`,
  };
}

export async function fetchAnalyticsBundle({
  apiMode,
  credentials,
  filter,
}: FetchAnalyticsBundleParams): Promise<AnalyticsBundle> {
  const { analyticsProjectKey, analyticsTeamMembers, analyticsDateStart, analyticsDateEnd } = filter;
  const jql = buildAnalyticsJql(analyticsProjectKey, analyticsTeamMembers, analyticsDateStart, analyticsDateEnd);

  if (!apiMode) {
    return {
      tickets: generateMockTickets(analyticsProjectKey, analyticsTeamMembers, analyticsDateStart, analyticsDateEnd),
      jql,
    };
  }

  const tickets = await fetchJiraTickets(jql, credentials.url, credentials.email, credentials.token);
  return { tickets, jql };
}

export async function fetchScheduleBundle({
  apiMode,
  credentials,
  filter,
}: FetchScheduleBundleParams): Promise<ScheduleBundle> {
  const { projectKey, teamMembers } = filter;
  const jql = buildScheduleJql(projectKey, teamMembers);

  if (!apiMode) {
    const thisYear = dayjs().year();
    return {
      tickets: generateMockTickets(projectKey, teamMembers, `${thisYear}-01-01`, `${thisYear}-12-31`),
      jql,
    };
  }

  const tickets = await fetchJiraTickets(jql, credentials.url, credentials.email, credentials.token);
  return { tickets, jql };
}

export async function fetchAppConfig(): Promise<AppConfig> {
  const response = await fetch('/api/app-config');
  if (!response.ok) {
    throw new Error('앱 설정을 불러오지 못했습니다.');
  }
  return response.json() as Promise<AppConfig>;
}

export async function exchangeCalendarOAuthCode({
  code,
  clientId,
  clientSecret,
}: ExchangeCalendarOAuthParams): Promise<OAuthTokenResponse> {
  const response = await fetch('/api/calendar/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'exchange',
      code,
      clientId,
      clientSecret,
    }),
  });

  if (!response.ok) {
    const errData = await response.json() as { error?: string };
    throw new Error(errData.error || '토큰 교환 실패');
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

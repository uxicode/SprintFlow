import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { JqlQueryBuilder, DailyReportStrategy, ReportContext } from '../jira';
import { getCronConfig, validateCronConfig } from './config';
import { fetchJiraTicketsServer } from './jira';
import { fetchCalendarEventsServer } from './calendar';
import { publishConfluencePage } from './confluence';
import { sendSlackNotification } from './slack';
import type { CalendarEvent, DailyReportJobResult, ReportParams } from '../../types';

dayjs.extend(utc);
dayjs.extend(timezone);

function getWeekRange(timezoneName: string): { start: string; end: string } {
  const now = dayjs().tz(timezoneName);
  const monday = now.day() === 0 ? now.subtract(6, 'day') : now.day(1);
  const friday = now.day() === 0 ? now.subtract(2, 'day') : now.day(5);
  return {
    start: monday.format('YYYY-MM-DD'),
    end: friday.format('YYYY-MM-DD'),
  };
}

function generateDailyReportMarkdown(reportParams: ReportParams): string {
  const context = new ReportContext(new DailyReportStrategy());
  return context.generate(reportParams);
}

export async function runDailyReportJob(): Promise<DailyReportJobResult> {
  const config = getCronConfig();
  validateCronConfig(config);

  const { start, end } = getWeekRange(config.timezone);
  const nextStart = dayjs(start).add(7, 'day').format('YYYY-MM-DD');
  const nextEnd = dayjs(end).add(7, 'day').format('YYYY-MM-DD');
  const todayLabel = dayjs().tz(config.timezone).format('YYYY.MM.DD');

  const currentJql = new JqlQueryBuilder()
    .setProject(config.projectKey)
    .setAssignees(config.teamMembers)
    .setDateRange(start, end, 'updated')
    .build();

  const nextJql = new JqlQueryBuilder()
    .setProject(config.projectKey)
    .setAssignees(config.teamMembers)
    .setDateRange(nextStart, nextEnd, 'updated')
    .build();

  const jiraCredentials = {
    url: config.jiraUrl,
    email: config.jiraEmail,
    token: config.jiraToken,
  };

  console.log('[Cron] Jira 티켓 수집 시작...');
  const [currentTickets, nextTickets] = await Promise.all([
    fetchJiraTicketsServer(currentJql, jiraCredentials),
    fetchJiraTicketsServer(nextJql, jiraCredentials),
  ]);

  let calendarEvents: CalendarEvent[] = [];
  let calendarSkipped = true;
  if (config.calendarId && config.googleRefreshToken) {
    console.log('[Cron] 캘린더 연차 조회 시작...');
    const calResult = await fetchCalendarEventsServer({
      calendarId: config.calendarId,
      start,
      end,
      accessToken: config.googleAccessToken,
      refreshToken: config.googleRefreshToken,
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    });
    calendarEvents = calResult.items;
    calendarSkipped = calResult.skipped;
    if (calResult.newAccessToken) {
      console.warn('[Cron] Google access token이 갱신되었습니다. GOOGLE_ACCESS_TOKEN env를 업데이트하세요.');
    }
  }

  const dailyReportMd = generateDailyReportMarkdown({
    currList: currentTickets,
    nextList: nextTickets,
    start,
    end,
    proj: config.projectKey,
    rawEvents: calendarEvents,
    targetRegs: config.registeredMembers,
    jiraUrl: config.jiraUrl,
  });

  if (!dailyReportMd?.trim()) {
    throw new Error('생성된 일일 보고서 내용이 비어 있습니다.');
  }

  const reportTitle = `📅 [일일업무] ${todayLabel}`;
  console.log('[Cron] Confluence 등록 시작:', reportTitle);

  const published = await publishConfluencePage({
    jiraUrl: config.jiraUrl,
    email: config.jiraEmail,
    token: config.jiraToken,
    spaceKey: config.confluenceSpace,
    parentId: config.confluenceParentId,
    title: reportTitle,
    markdown: dailyReportMd,
  });

  let slackNotified = false;
  if (config.slackWebhookUrl) {
    console.log('[Cron] Slack 알림 전송 시작...');
    slackNotified = await sendSlackNotification({
      webhookUrl: config.slackWebhookUrl,
      reportTitle,
      confluenceUrl: published.url,
      stats: {
        currentTickets: currentTickets.length,
        nextTickets: nextTickets.length,
        calendarEvents: calendarEvents.length,
        dateRange: { start, end },
      },
    });
  }

  return {
    success: true,
    reportTitle,
    confluenceUrl: published.url,
    confluencePageId: published.pageId,
    slackNotified,
    stats: {
      currentTickets: currentTickets.length,
      nextTickets: nextTickets.length,
      calendarEvents: calendarEvents.length,
      calendarSkipped,
      dateRange: { start, end },
      timezone: config.timezone,
    },
  };
}

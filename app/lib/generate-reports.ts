import { DailyReportStrategy, ReportContext, WeeklyReportStrategy } from '../utils/jira';
import type { CalendarEvent, GeneratedReports, ReportParams } from '../types';

export function generateReports({
  currList,
  nextList,
  start,
  end,
  proj,
  rawEvents,
  targetRegs,
  jiraUrl,
  scheduleTickets,
}: ReportParams): GeneratedReports {
  const reportParams: ReportParams = {
    currList,
    nextList,
    start,
    end,
    proj,
    rawEvents,
    targetRegs,
    jiraUrl,
    scheduleTickets,
  };

  const dailyContext = new ReportContext(new DailyReportStrategy());
  const weeklyContext = new ReportContext(new WeeklyReportStrategy());

  return {
    dailyReportMd: dailyContext.generate(reportParams),
    weeklyReportMd: weeklyContext.generate(reportParams),
  };
}

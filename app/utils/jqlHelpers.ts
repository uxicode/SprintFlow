import dayjs from 'dayjs';
import { JqlQueryBuilder } from './jira';

export function buildJql(
  projectKey: string,
  teamMembers: string,
  dateStart: string,
  dateEnd: string,
): string {
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(dateStart, dateEnd, 'duedate')
    .build();
}

export function buildNextWeekJql(
  projectKey: string,
  teamMembers: string,
  dateStart: string,
  dateEnd: string,
): string {
  const todayStr = dayjs().format('YYYY-MM-DD');
  const start = dateStart || todayStr;
  const end = dateEnd || todayStr;
  const nextStartStr = dayjs(start).add(7, 'day').format('YYYY-MM-DD');
  const nextEndStr = dayjs(end).add(7, 'day').format('YYYY-MM-DD');

  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(nextStartStr, nextEndStr, 'duedate')
    .build();
}

export function buildScheduleJql(projectKey: string, teamMembers: string): string {
  const thisYear = dayjs().year();
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(`${thisYear}-01-01`, `${thisYear}-12-31`, 'created')
    .build();
}

/** 실적 분석: 선택 기간 내 활동(updated) 또는 마감(duedate) 티켓만 조회 */
export function buildAnalyticsJql(
  projectKey: string,
  teamMembers: string,
  dateStart: string,
  dateEnd: string,
): string {
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(teamMembers)
    .setDateRange(dateStart, dateEnd, 'updated')
    .build();
}

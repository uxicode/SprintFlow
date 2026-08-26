import dayjs from 'dayjs';
import { JqlQueryBuilder } from './jira';

/**
 * 등록된 팀원 명부를 조회 경계로 삼고, 필터에서 고른 teamMembers는 그 안에서만 범위를 좁힙니다.
 * 명부가 비어 있지 않은 한 명부 밖 인원은 어떤 경로로도 조회 대상에 포함되지 않습니다.
 */
export function resolveAssignees(teamMembers: string, registeredMembers: string[]): string[] {
  const roster = (registeredMembers ?? []).map(m => m.trim()).filter(Boolean);
  const selected = (teamMembers ?? '').split(',').map(m => m.trim()).filter(Boolean);

  if (roster.length === 0) return selected;
  if (selected.length === 0) return roster;

  const scoped = selected.filter(m => roster.includes(m));
  return scoped.length > 0 ? scoped : roster;
}

export function buildJql(
  projectKey: string,
  assignees: string[],
  dateStart: string,
  dateEnd: string,
): string {
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(assignees)
    .setDateRange(dateStart, dateEnd, 'duedate')
    .build();
}

export function buildNextWeekJql(
  projectKey: string,
  assignees: string[],
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
    .setAssignees(assignees)
    .setDateRange(nextStartStr, nextEndStr, 'duedate')
    .build();
}

export function buildScheduleJql(projectKey: string, assignees: string[]): string {
  const thisYear = dayjs().year();
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(assignees)
    .setDateRange(`${thisYear}-01-01`, `${thisYear}-12-31`, 'created')
    .build();
}

/** 실적 분석: 선택 기간 내 활동(updated) 또는 마감(duedate) 티켓만 조회 */
export function buildAnalyticsJql(
  projectKey: string,
  assignees: string[],
  dateStart: string,
  dateEnd: string,
): string {
  return new JqlQueryBuilder()
    .setProject(projectKey)
    .setAssignees(assignees)
    .setDateRange(dateStart, dateEnd, 'updated')
    .build();
}

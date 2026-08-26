import dayjs from 'dayjs';
import { getStatusCategory } from './jira';
import type { Ticket, WeeklyExcelPayload } from '../types';

const AREA_LABEL: Record<string, string> = {
  APP: '앱',
  관리자: '관리자',
  수집데이터: '수집서버',
};

function statusLabel(status: string): string {
  const category = getStatusCategory(status);
  if (category === 'Done') return '완료';
  if (category === 'In Progress') return '진행 중';
  return '대기 중';
}

function cleanTicketSummary(summary: string): string {
  return (summary || '')
    .replace(/^\s*\[[^\]]+\]\s*/, '')
    .replace(/\((?:BE|FE|MO)\)\s*/gi, '')
    .replace(/^\s*\[[^\]]+\]\s*/, '')
    .trim();
}

function parseEpicTitle(summary: string): { tag: string; rest: string } {
  const match = (summary || '').trim().match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { tag: '', rest: (summary || '').trim() };
  return { tag: match[1].trim(), rest: (match[2] || '').trim() };
}

function formatDateRangeLabel(start: string, end: string): string {
  const startLabel = `${dayjs(start).month() + 1}/${dayjs(start).date()}`;
  const endLabel = `${dayjs(end).month() + 1}/${dayjs(end).date()}`;
  return `${startLabel}~${endLabel}`;
}

function buildGroupedReportText(tickets: Ticket[]): string {
  const groups = new Map<string, Map<string, string[]>>();

  tickets.forEach((ticket) => {
    const epicTitle = ticket.epic?.summary || '기타 업무';
    const { tag, rest } = parseEpicTitle(epicTitle);
    const product = /솔라시도/.test(`${tag} ${rest}`) ? '솔라시도' : (tag || '개발');
    const area = AREA_LABEL[tag] || tag || '기타';
    const groupKey = `[${product}]  ${area}:`;
    const feature = rest
      .replace(/^솔라시도\s*(앱)?\s*>?\s*/i, '')
      .replace(/^솔라시도\s*/, '')
      .trim() || rest || epicTitle;
    const line = `- ${feature}: ${cleanTicketSummary(ticket.summary) || ticket.summary} (${statusLabel(ticket.status)})`;

    if (!groups.has(groupKey)) groups.set(groupKey, new Map());
    const featureMap = groups.get(groupKey)!;
    const lines = featureMap.get(feature) || [];
    lines.push(line);
    featureMap.set(feature, lines);
  });

  const blocks: string[] = [];
  groups.forEach((featureMap, groupKey) => {
    blocks.push(groupKey);
    featureMap.forEach((lines) => {
      lines.forEach((line) => blocks.push(line));
    });
  });

  return blocks.join('\n');
}

export function buildWeeklyExcelPayload(
  tickets: Ticket[],
  nextTickets: Ticket[],
  dateStart: string,
  dateEnd: string,
): WeeklyExcelPayload {
  return {
    dateStart,
    dateEnd,
    previousWeekText: buildGroupedReportText(tickets),
    nextWeekPlanText: buildGroupedReportText(nextTickets),
  };
}

export function formatWeekHeader(prefix: string, start: string, end: string, suffix: string): string {
  return `${prefix}(${formatDateRangeLabel(start, end)}) ${suffix}`;
}

import dayjs from 'dayjs';
import { getStatusCategory } from './jira';
import type { EpicScheduleItem, GanttData, Ticket } from '../types';

interface EpicAccumulator {
  key: string;
  summary: string;
  tickets: Ticket[];
}

export function buildEpicScheduleData(scheduleTickets: Ticket[]): EpicScheduleItem[] {
  const epicsMap: Record<string, EpicAccumulator> = {};

  scheduleTickets.forEach(t => {
    const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
    const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 업무)';

    if (!epicsMap[epicKey]) {
      epicsMap[epicKey] = {
        key: epicKey,
        summary: epicSummary,
        tickets: [],
      };
    }
    epicsMap[epicKey].tickets.push(t);
  });

  const epicsList = Object.values(epicsMap).map(epic => {
    const beTickets = epic.tickets.filter(t => (t.summary || '').includes('[BE]'));
    const feTickets = epic.tickets.filter(t => (t.summary || '').includes('[FE]'));
    const moTickets = epic.tickets.filter(t => (t.summary || '').includes('[MO]'));
    const otherTickets = epic.tickets.filter(t => {
      const sum = t.summary || '';
      return !sum.includes('[BE]') && !sum.includes('[FE]') && !sum.includes('[MO]');
    });

    const getProgress = (group: Ticket[]): number | null => {
      if (group.length === 0) return null;
      const doneCount = group.filter(t => getStatusCategory(t.status) === 'Done').length;
      return Math.round((doneCount / group.length) * 100);
    };

    const createdDates = epic.tickets.map(t => t.created).filter(Boolean);
    const epicStartDate = createdDates.length > 0 ? createdDates.sort()[0] : '';

    const dueDates = epic.tickets.map(t => t.duedate).filter(Boolean);
    const fallbackDates = epic.tickets.map(t => t.updated).filter(Boolean);
    const epicEndDate = dueDates.length > 0
      ? dueDates.sort().reverse()[0]
      : (fallbackDates.length > 0 ? fallbackDates.sort().reverse()[0] : '');

    return {
      ...epic,
      startDate: epicStartDate,
      endDate: epicEndDate,
      beProgress: getProgress(beTickets),
      feProgress: getProgress(feTickets),
      moProgress: getProgress(moTickets),
      beCount: beTickets.length,
      feCount: feTickets.length,
      moCount: moTickets.length,
      beDoneCount: beTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
      feDoneCount: feTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
      moDoneCount: moTickets.filter(t => getStatusCategory(t.status) === 'Done').length,
      categorizedTickets: {
        BE: beTickets,
        FE: feTickets,
        MO: moTickets,
        OTHER: otherTickets,
      },
    };
  });

  const getLatestUpdate = (epicTickets: Ticket[]): number => {
    if (!epicTickets || epicTickets.length === 0) return 0;
    const dates = epicTickets.map(t => dayjs(t.updated || 0).valueOf());
    return Math.max(...dates);
  };

  return epicsList.sort((a, b) => {
    if (a.key === 'NO_EPIC') return 1;
    if (b.key === 'NO_EPIC') return -1;
    const aLatest = getLatestUpdate(a.tickets);
    const bLatest = getLatestUpdate(b.tickets);
    if (bLatest !== aLatest) return bLatest - aLatest;
    return a.key.localeCompare(b.key);
  });
}

export function buildGanttData(epicScheduleData: EpicScheduleItem[]): GanttData {
  if (epicScheduleData.length === 0) {
    return { epics: [], globalStart: null, globalEnd: null, totalDays: 0, dateMarkers: [] };
  }

  const validEpics = epicScheduleData.filter(e => {
    if (!e.startDate || !e.endDate) return false;
    const summary = (e.summary || '').toLowerCase();
    const key = (e.key || '').toLowerCase();
    return !summary.includes('hotfix') && !summary.includes('핫픽스') && !key.includes('hotfix');
  });

  if (validEpics.length === 0) {
    return { epics: [], globalStart: null, globalEnd: null, totalDays: 0, dateMarkers: [] };
  }

  const startValues = validEpics.map(e => dayjs(e.startDate).valueOf());
  const endValues = validEpics.map(e => dayjs(e.endDate).valueOf());
  const minStart = dayjs(Math.min(...startValues)).subtract(2, 'day');
  const maxEnd = dayjs(Math.max(...endValues)).add(2, 'day');
  const totalDays = maxEnd.diff(minStart, 'day') + 1;

  const dateMarkers: string[] = [];
  const step = Math.max(1, Math.floor(totalDays / 4));
  for (let i = 0; i < 5; i++) {
    dateMarkers.push(minStart.add(i * step, 'day').format('MM.DD'));
  }

  return {
    epics: validEpics,
    globalStart: minStart,
    globalEnd: maxEnd,
    totalDays,
    dateMarkers,
  };
}

function formatEpicDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const formatted = dayjs(dateStr);
  return formatted.isValid() ? `${formatted.month() + 1}/${formatted.date()}` : null;
}

export function getEpicDueDateRange(item: EpicScheduleItem | undefined): string | null {
  if (!item || item.key === 'NO_EPIC') return null;
  const dueDates = item.tickets.map(t => t.duedate).filter((d): d is string => Boolean(d));
  if (dueDates.length === 0) return null;

  const sorted = [...dueDates].sort();
  const start = formatEpicDate(sorted[0]);
  const end = formatEpicDate(sorted[sorted.length - 1]);
  if (start && end) {
    return start === end ? start : `${start} ~${end}`;
  }
  return start || end;
}

export function formatGroupProgressBadge(
  label: string,
  progress: number | null,
  doneCount: number,
  totalCount: number,
): string | null {
  if (progress === null || totalCount === 0) return null;
  return `${progress}% (${doneCount}/${totalCount})`;
}

export function buildEpicSummaryTable(epicSchedules: EpicScheduleItem[]): string {
  if (!epicSchedules || epicSchedules.length === 0) return '';

  const targetEpics = epicSchedules.filter(item => item.key !== 'NO_EPIC' || epicSchedules.length === 1);
  if (targetEpics.length === 0) return '';

  const cleanCell = (str: string | null | undefined): string => {
    if (!str) return '-';
    return str.replace(/\|/g, '&#124;').replace(/\r?\n/g, ' ').trim();
  };

  let table = `### 📊 에픽별 진행 현황\n\n`;
  table += `| 에픽 | 마감일 | 백엔드 | 프론트 | 모바일 | 총 진행률 |\n`;
  table += `|---|---|---|---|---|---|\n`;

  targetEpics.forEach(item => {
    const rawTitle = item.summary || item.key;
    const epicTitle = cleanCell(rawTitle);
    const dateRange = cleanCell(getEpicDueDateRange(item));

    const beStr = cleanCell(formatGroupProgressBadge('BE', item.beProgress, item.beDoneCount, item.beCount));
    const feStr = cleanCell(formatGroupProgressBadge('FE', item.feProgress, item.feDoneCount, item.feCount));
    const moStr = cleanCell(formatGroupProgressBadge('MO', item.moProgress, item.moDoneCount, item.moCount));

    const totalCount = item.tickets.length;
    const totalDone = item.tickets.filter(t => getStatusCategory(t.status) === 'Done').length;
    const totalProgress = totalCount > 0 ? Math.round((totalDone / totalCount) * 100) : 0;
    const totalStr = cleanCell(totalCount > 0 ? `${totalProgress}% (${totalDone}/${totalCount})` : '-');

    table += `| **${epicTitle}** | ${dateRange} | ${beStr} | ${feStr} | ${moStr} | **${totalStr}** |\n`;
  });

  table += `\n`;
  return table;
}

export function formatEpicScheduleMeta(meta: EpicScheduleItem | undefined): string {
  if (!meta) return '';
  const dateRange = getEpicDueDateRange(meta);
  return dateRange ? `: ${dateRange}` : '';
}

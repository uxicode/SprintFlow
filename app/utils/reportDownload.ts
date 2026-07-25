import dayjs from 'dayjs';
import { getStatusCategory, getMemberVacationDates, getVacationMembers, applyWeeklyReportFilter } from './jira';
import { buildEpicScheduleData } from './schedule';
import type { CalendarEvent, BuildWeeklyDownloadParams, EpicGroup, EpicScheduleItem, Ticket } from '../types';

function formatEpicDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const formatted = dayjs(dateStr);
  return formatted.isValid() ? `${formatted.month() + 1}/${formatted.date()}` : null;
}

function formatEpicDateRange(startDate: string, endDate: string): string | null {
  const start = formatEpicDate(startDate);
  const end = formatEpicDate(endDate);
  if (start && end) return `${start} ~${end}`;
  return start || end;
}

export function formatGroupProgressBadge(
  label: 'BE' | 'FE' | 'MO',
  progress: number | null,
  doneCount: number,
  totalCount: number,
): string | null {
  if (progress === null || totalCount === 0) return null;
  return `${label}: ${progress}% (${doneCount}/${totalCount})`;
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

export function formatEpicHeaderTitle(epicSummary: string, meta: EpicScheduleItem | undefined): string {
  if (!meta) return epicSummary;
  const dateRange = getEpicDueDateRange(meta);
  return dateRange ? `${epicSummary}: ${dateRange}` : epicSummary;
}

export function buildEpicSummaryTable(
  epicSchedules: EpicScheduleItem[],
  weeklyReportMd?: string
): string {
  if (!epicSchedules || epicSchedules.length === 0) return '';

  const presentEpicKeys = new Set<string>();
  const presentEpicTitles = new Set<string>();

  if (weeklyReportMd) {
    const lines = weeklyReportMd.split('\n');
    lines.forEach(line => {
      if (line.startsWith('### ')) {
        let clean = line.replace(/^###\s*(?:🏷️\s*)?(?:에픽:\s*)?/, '').trim();
        const keyMatch = clean.match(/\(([A-Z0-9]+-[0-9]+)\)/);
        if (keyMatch) {
          presentEpicKeys.add(keyMatch[1]);
          clean = clean.replace(/\([A-Z0-9]+-[0-9]+\)/, '').trim();
        }
        const titleWithoutMeta = clean.split(/\s*(?:—|:)\s*/)[0].trim();
        if (titleWithoutMeta) {
          presentEpicTitles.add(titleWithoutMeta);
        }
      }
    });
  }

  const scheduledEpics = epicSchedules.filter(item => {
    if (weeklyReportMd && (presentEpicKeys.size > 0 || presentEpicTitles.size > 0)) {
      const isPresent = presentEpicKeys.has(item.key) || presentEpicTitles.has(item.summary);
      if (!isPresent) return false;
    }
    return Boolean(getEpicDueDateRange(item));
  });

  if (scheduledEpics.length === 0) return '';

  let table = `### 📊 에픽별 진행 현황\n\n`;
  table += `| 에픽 | 기한 | BE | FE | MO | Total |\n`;
  table += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  scheduledEpics.forEach(item => {
    const epicTitle = item.summary || item.key;
    const dateRange = getEpicDueDateRange(item) || '-';

    const beStr = formatGroupProgressBadge('BE', item.beProgress, item.beDoneCount, item.beCount) || '-';
    const feStr = formatGroupProgressBadge('FE', item.feProgress, item.feDoneCount, item.feCount) || '-';
    const moStr = formatGroupProgressBadge('MO', item.moProgress, item.moDoneCount, item.moCount) || '-';

    const totalCount = item.tickets.length;
    const totalDone = item.tickets.filter(t => getStatusCategory(t.status) === 'Done').length;
    const totalProgress = totalCount > 0 ? Math.round((totalDone / totalCount) * 100) : 0;
    const totalStr = totalCount > 0 ? `${totalProgress}% (${totalDone}/${totalCount})` : '-';

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

function groupTicketsByEpic(ticketList: Ticket[]): Record<string, EpicGroup> {
  const epicsMap: Record<string, EpicGroup> = {};
  ticketList.forEach(t => {
    const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
    const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 업무)';
    if (!epicsMap[epicKey]) {
      epicsMap[epicKey] = { key: epicKey, summary: epicSummary, tickets: [] };
    }
    epicsMap[epicKey].tickets.push(t);
  });
  return epicsMap;
}

function renderEpicSection(
  epicsMap: Record<string, EpicGroup>,
  epicScheduleByKey: Map<string, EpicScheduleItem>,
  includeStatus = false,
): string {
  let section = '';
  const sortedEpicKeys = Object.keys(epicsMap).sort((a, b) => {
    if (a === 'NO_EPIC') return 1;
    if (b === 'NO_EPIC') return -1;
    return a.localeCompare(b);
  });

  sortedEpicKeys.forEach(epicKey => {
    const epic = epicsMap[epicKey];
    const epicMeta = formatEpicScheduleMeta(epicScheduleByKey.get(epicKey));
    section += epicKey === 'NO_EPIC'
      ? `#### ${epic.summary}${epicMeta}\n`
      : `#### ${epic.summary}${epicMeta}\n`;

    epic.tickets.forEach(t => {
      let summary = (t.summary || '').trim();
      summary = summary.replace(/^\s*\([A-Za-z0-9가-힣\/\-]+\)\s*/, '').trim();
      summary = summary.replace(/\((?:BE|FE|MO)\)\s*/gi, '').trim();

      const updatedDate = t.updated ? dayjs(t.updated) : null;
      const dueDate = t.duedate ? dayjs(t.duedate) : dayjs();
      const targetDate = updatedDate && updatedDate.isValid() ? updatedDate : dueDate;
      const dateStr = `${targetDate.month() + 1}/${targetDate.date()}`;

      if (includeStatus) {
        const cat = getStatusCategory(t.status);
        const statusLabel = cat === 'Done' ? '완료' : cat === 'In Progress' ? '진행 중' : '대기 중';
        section += `* ${summary} (${statusLabel}- ${dateStr})\n`;
      } else {
        section += `* ${summary} (${dateStr})\n`;
      }
    });
    section += '\n';
  });

  return section;
}

export function cleanWeeklyDownloadMarkdown(markdown: string): string {
  if (!markdown) return '';

  let cleaned = markdown;

  // 1. 에픽 타이틀 정제: "### 🏷️ 에픽: [에픽명] (KEY-123)" 또는 "### [에픽명] — 7/3 ~8/11 | BE: ..." -> "#### [에픽명]: 7/3 ~8/11"
  cleaned = cleaned.replace(
    /^(?:###|####)\s*(?:🏷️\s*)?(?:에픽:\s*)?(.*?)\s*(?:\([A-Z0-9]+-[0-9]+\))?(?:\s*(?:—|:)\s*(\d{1,2}\/\d{1,2}\s*~\s*\d{1,2}\/\d{1,2}))?(?:\s*\|.*)?$/gm,
    (_match, summary, dateRange) => {
      let cleanSummary = summary.split(/\s*\|/)[0].trim();
      cleanSummary = cleanSummary.replace(/\s*—\s*$/, '').trim();
      if (dateRange) {
        return `#### ${cleanSummary}: ${dateRange}`;
      }
      return `#### ${cleanSummary}`;
    }
  );

  // 2. 에픽 날짜 정제: "26.06.09 ~ 26.07.25" 또는 "26.06.09 ~26.07.25" -> "6/9 ~7/25"
  cleaned = cleaned.replace(/(\d{2})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})\.(\d{2})/g, (_match, _y1, m1, d1, _y2, m2, d2) => {
    const startMD = `${parseInt(m1, 10)}/${parseInt(d1, 10)}`;
    const endMD = `${parseInt(m2, 10)}/${parseInt(d2, 10)}`;
    return `${startMD} ~${endMD}`;
  });

  // 3. 티켓 항목 라인 단위 정제
  const lines = cleaned.split('\n');
  const processedLines = lines.map(line => {
    if (!line.trim().startsWith('*') && !line.trim().startsWith('-')) {
      return line;
    }

    let lineContent = line;

    // 아이콘 제거 (* ✅ , * 🔄 , * ⏱️ 등)
    lineContent = lineContent.replace(/^(\s*[*|-]\s*)(?:✅|🔄|⏱️|⏱|🟢)\s*/, '$1');

    // 마크다운 링크 및 티켓키 제거
    lineContent = lineContent.replace(/\[(?:[A-Z0-9]+-[0-9]+:\s*)?(.*?)\]\([^)]*\)/g, '$1');

    // 남아있는 티켓키 제거
    lineContent = lineContent.replace(/\b[A-Z0-9]+-[0-9]+:\s*/g, '');

    // 파트 태그 제거: (BE), (FE), (MO)
    lineContent = lineContent.replace(/\((?:BE|FE|MO)\)\s*/gi, '');

    // 에픽 꼬리표 정보 제거
    lineContent = lineContent.replace(/ \*\(에픽:.*?\)\*/g, '');

    // 메타 데이터 포맷 정제: (`Done`, 기한: 07/21 > 갱신일:07/23, 담당자: 이혜진) -> (완료- 7/23)
    lineContent = lineContent.replace(/\(([^)]*?)\)$/, (match, inner) => {
      if (!/완료|진행|Done|In Progress|기한|갱신일|담당자/.test(inner)) {
        return match;
      }

      let statusStr = '완료';
      if (/In Progress|진행 중|진행/i.test(inner)) {
        statusStr = '진행 중';
      } else if (/To Do|대기 중|할일/i.test(inner)) {
        statusStr = '대기 중';
      } else if (/Done|완료/i.test(inner)) {
        statusStr = '완료';
      }

      let dateStr = '';
      const updateMatch = inner.match(/갱신일:\s*(\d{2})\.(\d{2})|갱신일:\s*(\d{1,2})\/(\d{1,2})/);
      const dueMatch = inner.match(/기한:\s*(\d{2})\.(\d{2})|기한:\s*(\d{1,2})\/(\d{1,2})/);
      const dateMatch = updateMatch || dueMatch;

      if (dateMatch) {
        const month = parseInt(dateMatch[1] || dateMatch[3], 10);
        const day = parseInt(dateMatch[2] || dateMatch[4], 10);
        dateStr = `${month}/${day}`;
      } else {
        const genericDate = inner.match(/(\d{1,2})\/(\d{1,2})/);
        if (genericDate) {
          dateStr = `${parseInt(genericDate[1], 10)}/${parseInt(genericDate[2], 10)}`;
        }
      }

      const formattedMeta = dateStr ? `${statusStr}- ${dateStr}` : statusStr;
      return `(${formattedMeta})`;
    });

    return lineContent;
  });

  return processedLines.join('\n');
}

export function buildWeeklyDownloadMarkdown({
  weeklyReportMd,
  scheduleTickets,
  tickets,
  searchKeyword,
}: BuildWeeklyDownloadParams): string {
  if (!weeklyReportMd) return '';

  const progressSourceTickets = scheduleTickets && scheduleTickets.length > 0
    ? scheduleTickets
    : tickets;

  let baseMd = weeklyReportMd;

  if (progressSourceTickets && progressSourceTickets.length > 0) {
    const epicSchedules = buildEpicScheduleData(progressSourceTickets);
    const epicScheduleByKey = new Map(
      epicSchedules.map((epic) => [epic.key, epic]),
    );

    const summaryTable = buildEpicSummaryTable(epicSchedules, baseMd);
    if (summaryTable) {
      if (baseMd.includes('## 📋 3. 에픽별 상세 업무 진행 현황')) {
        baseMd = baseMd.replace(
          '## 📋 3. 에픽별 상세 업무 진행 현황',
          `## 📋 3. 에픽별 상세 업무 진행 현황\n\n${summaryTable.trim()}`
        );
      } else {
        baseMd = `${summaryTable}\n${baseMd}`;
      }
    }

    // 에픽 진행률 메타 정보 보강 (타이틀: 기한만)
    baseMd = baseMd.replace(
      /(### (?:🏷️ )?(?:에픽:\s*)?(.*?)(?:\s*\(([A-Z0-9]+-[0-9]+)\))?)\n/g,
      (match, p1, epicSummary, epicKey) => {
        if (match.includes(' — ') || match.includes(': ') || match.includes('| BE:')) return match;
        const keyToUse = epicKey || (epicSummary ? epicSummary.trim() : '');
        const meta = formatEpicScheduleMeta(epicScheduleByKey.get(keyToUse));
        if (!meta) return match;
        return `${p1}${meta}\n`;
      },
    );
  }

  if (searchKeyword && searchKeyword.trim()) {
    baseMd = applyWeeklyReportFilter(baseMd, searchKeyword);
  }

  // 에픽 넘버, 티켓 넘버, 파트 태그, 지라 링크, 아이콘 정제 및 (완료- M/D) 포맷 적용
  return cleanWeeklyDownloadMarkdown(baseMd).trim() + '\n';
}


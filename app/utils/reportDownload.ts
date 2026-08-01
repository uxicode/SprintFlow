import dayjs from 'dayjs';
import { getStatusCategory, getMemberVacationDates, getVacationMembers, applyWeeklyReportFilter } from './jira';
import { buildEpicScheduleData, buildEpicSummaryTable, getEpicDueDateRange, formatGroupProgressBadge, formatEpicScheduleMeta } from './schedule';
import type { CalendarEvent, BuildWeeklyDownloadParams, EpicGroup, EpicScheduleItem, Ticket } from '../types';

export { buildEpicSummaryTable, formatEpicScheduleMeta };

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

  // 1. 에픽 타이틀 정제 (단, 마크다운 표 헤더/메트릭스 제목 등은 훼손 없이 원본 보존!)
  cleaned = cleaned.replace(
    /^(?:###|####)\s*(?:🏷️\s*)?(?:에픽:\s*)?(.*?)\s*(?:\([A-Z0-9]+-[0-9]+\))?(?:\s*(?:—|:)\s*(\d{1,2}\/\d{1,2}\s*~\s*\d{1,2}\/\d{1,2}))?(?:\s*\|.*)?$/gm,
    (_match, summary, dateRange) => {
      const trimmedSummary = (summary || '').trim();
      if (
        !trimmedSummary ||
        trimmedSummary.includes('📊') ||
        trimmedSummary.includes('📈') ||
        trimmedSummary.includes('에픽별 진행 현황') ||
        trimmedSummary.includes('진행 상태 메트릭스') ||
        trimmedSummary.includes('보고서 요약') ||
        trimmedSummary.includes('상세 업무 진행') ||
        trimmedSummary.includes('주요 계획')
      ) {
        return _match;
      }

      let cleanSummary = trimmedSummary.split(/\s*\|/)[0].trim();
      cleanSummary = cleanSummary.replace(/\s*—\s*$/, '').trim();
      if (dateRange) {
        return `#### ${cleanSummary}: ${dateRange}`;
      }
      return `#### ${cleanSummary}`;
    }
  );

  // 2. 에픽 날짜 정제
  cleaned = cleaned.replace(/(\d{2})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})\.(\d{2})/g, (_match, _y1, m1, d1, _y2, m2, d2) => {
    const startMD = `${parseInt(m1, 10)}/${parseInt(d1, 10)}`;
    const endMD = `${parseInt(m2, 10)}/${parseInt(d2, 10)}`;
    return `${startMD} ~${endMD}`;
  });

  // 3. 티켓 항목 라인 단위 정제 (표 '|' 라인은 100% 보존)
  const lines = cleaned.split('\n');
  const processedLines = lines.map(line => {
    if (line.trim().startsWith('|')) {
      return line;
    }

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

    // 메타 데이터 포맷 정제
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
      const dueMatch = inner.match(/기한:\s*(\d{2})\.(\d{2})|기한:\s*(\d{1,2})\/(\d{1,2})/);
      const dateMatch = dueMatch;

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

      return dateStr ? `(${statusStr}- ${dateStr})` : `(${statusStr})`;
    });

    return lineContent;
  });

  return processedLines.join('\n');
}

export function buildWeeklyDownloadMarkdown(params: BuildWeeklyDownloadParams): string {
  const {
    weeklyReportMd,
    tickets,
    nextTickets,
    scheduleTickets,
    vacationList,
    dateStart,
    dateEnd,
    registeredMembers,
    searchKeyword,
    epicSortOrder,
    tagFilters,
  } = params;

  let baseMd = weeklyReportMd;

  // 마크다운 표 생성 대상 티켓 선정 (누적 scheduleTickets가 있으면 최우선, 없으면 일반 tickets)
  const progressSourceTickets = (scheduleTickets && scheduleTickets.length > 0)
    ? scheduleTickets
    : tickets;

  // 만약 기존 마크다운에 "에픽별 진행 현황" 표가 없다면 보충
  if (progressSourceTickets && progressSourceTickets.length > 0 && !baseMd.includes('에픽별 진행 현황')) {
    const epicSchedules = buildEpicScheduleData(progressSourceTickets, epicSortOrder);
    const summaryTable = buildEpicSummaryTable(epicSchedules, epicSortOrder);
    if (summaryTable) {
      if (baseMd.includes('## 📋 3. 에픽별 상세 업무 진행 현황')) {
        baseMd = baseMd.replace(
          '## 📋 3. 에픽별 상세 업무 진행 현황',
          `${summaryTable.trim()}\n\n## 📋 3. 에픽별 상세 업무 진행 현황`
        );
      } else {
        baseMd = `${summaryTable}\n${baseMd}`;
      }
    }
  }

  if ((searchKeyword && searchKeyword.trim()) || tagFilters || (epicSortOrder && epicSortOrder !== 'latest')) {
    baseMd = applyWeeklyReportFilter(baseMd, searchKeyword || '', tagFilters, epicSortOrder);
  }

  // 에픽 넘버, 티켓 넘버, 파트 태그, 지라 링크, 아이콘 정제 및 (완료- M/D) 포맷 적용
  return cleanWeeklyDownloadMarkdown(baseMd).trim() + '\n';
}

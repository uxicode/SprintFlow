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
    section += `+ ${epic.summary}${epicMeta}\n`;

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

export class MarkdownCleanerBuilder {
  private content: string;

  constructor(content: string) {
    this.content = content || '';
  }

  // 1. 연속된 3개 이상의 개행(\n\n\n+)을 2개(\n\n)로 1차 압축
  compressNewlines(): this {
    this.content = this.content.replace(/\n{3,}/g, '\n\n');
    return this;
  }

  // 2. 에픽 타이틀 정제 (+ 접두사 부여 및 에픽 메타 정리)
  cleanEpicTitles(): this {
    this.content = this.content.replace(
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
          return `+ ${cleanSummary}: ${dateRange}`;
        }
        return `+ ${cleanSummary}`;
      }
    );
    return this;
  }

  // 3. 헤더 및 불릿 리스트 간격 밀착
  tightenSpacing(): this {
    this.content = this.content
      .replace(/^(#{1,6}\s+.*?)\n{2,}/gm, '$1\n')
      .replace(/^(\s*[*|-]\s+.*?)\n{2,}(?=\s*[*|-])/gm, '$1\n');
    return this;
  }

  // 4. 에픽 날짜 정제 (YY.MM.DD -> M/D)
  formatEpicDates(): this {
    this.content = this.content.replace(
      /(\d{2})\.(\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})\.(\d{2})/g,
      (_match, _y1, m1, d1, _y2, m2, d2) => `${parseInt(m1, 10)}/${parseInt(d1, 10)} ~${parseInt(m2, 10)}/${parseInt(d2, 10)}`
    );
    return this;
  }

  // 5. 티켓 항목 라인 단위 세부 정제 (순수 함수 파이프라인으로 0-객체 생성 최적화)
  cleanTicketLines(): this {
    const lines = this.content.split('\n');
    this.content = lines.map(cleanSingleTicketLine).join('\n');
    return this;
  }

  // 빌드 완료 및 최종 개행 조율 문자열 반환
  build(): string {
    return this.content.replace(/\n{3,}/g, '\n\n').trim();
  }
}

// ============================================================================
// 단일 티켓 행 정제용 순수 변환 함수 (Zero-Allocation Pure Utilities)
// ============================================================================

function isTicketLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('|')) {
    return false;
  }
  return trimmed.startsWith('*') || trimmed.startsWith('-');
}

function removeTicketStatusIcons(line: string): string {
  return line.replace(/^(\s*[*|-]\s*)(?:✅|🔄|⏱️|⏱|🟢)\s*/, '$1');
}

function removeTicketLinksAndKeys(line: string): string {
  return line
    .replace(/\[(?:[A-Z0-9]+-[0-9]+:\s*)?(.*?)\]\([^)]*\)/g, '$1')
    .replace(/\b[A-Z0-9]+-[0-9]+:\s*/g, '');
}

function removeTicketPartTags(line: string): string {
  return line.replace(/\((?:BE|FE|MO)\)\s*/gi, '');
}

function removeTicketEpicMeta(line: string): string {
  return line.replace(/ \*\(에픽:.*?\)\*/g, '');
}

function formatTicketStatusAndDate(line: string): string {
  return line.replace(/\(([^)]*?)\)$/, (match, inner) => {
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

    if (dueMatch) {
      const month = parseInt(dueMatch[1] || dueMatch[3], 10);
      const day = parseInt(dueMatch[2] || dueMatch[4], 10);
      dateStr = `${month}/${day}`;
    } else {
      const genericDate = inner.match(/(\d{1,2})\/(\d{1,2})/);
      if (genericDate) {
        dateStr = `${parseInt(genericDate[1], 10)}/${parseInt(genericDate[2], 10)}`;
      }
    }

    return dateStr ? `(${statusStr}- ${dateStr})` : `(${statusStr})`;
  });
}

function cleanSingleTicketLine(line: string): string {
  if (!isTicketLine(line)) {
    return line;
  }

  return formatTicketStatusAndDate(
    removeTicketEpicMeta(
      removeTicketPartTags(
        removeTicketLinksAndKeys(
          removeTicketStatusIcons(line)
        )
      )
    )
  );
}

export function cleanWeeklyDownloadMarkdown(markdown: string): string {
  if (!markdown) return '';
  return new MarkdownCleanerBuilder(markdown)
    .compressNewlines()
    .cleanEpicTitles()
    .tightenSpacing()
    .formatEpicDates()
    .cleanTicketLines()
    .build();
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

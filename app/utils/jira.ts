import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import type {
  CalendarDateField,
  CalendarEvent,
  ReportParams,
  StatusCategory,
  Ticket,
  TicketFormatOptions,
  TicketRenderGroupOptions,
  VacationParseResult,
  WeeklyReportTagFilters,
} from '../types';
import { buildEpicScheduleData, buildEpicSummaryTable } from './schedule';

// 티켓 제목 내 대괄호 [ ]를 ( )로 안전하게 변경하여 마크다운 링크 파서 깨짐 현상 예방
export const escapeBrackets = (text: string): string => {
  return (text || '').replace(/\[/g, '(').replace(/\]/g, ')');
};

// Jira 티켓의 상세 웹 브라우징 링크 생성
export const getTicketLink = (key: string, jiraUrl: string): string => {
  const baseDomain = jiraUrl && jiraUrl.trim() ? jiraUrl.trim().replace(/\/$/, '') : 'https://ikoobdoc.atlassian.net';
  return `${baseDomain}/browse/${key}`;
};

// 캘린더 날짜 필드(date 또는 dateTime)를 YYYY-MM-DD 로컬 시간 문자열로 변환
export const getLocalDateStr = (dateObj: CalendarDateField | null | undefined): string => {
  if (!dateObj) return '';
  if (dateObj.date) return dateObj.date; // YYYY-MM-DD
  if (dateObj.dateTime) {
    return dayjs(dateObj.dateTime).format('YYYY-MM-DD');
  }
  return '';
};

// Jira 티켓의 상태 카테고리를 Normalization 처리하는 유틸리티
export const getStatusCategory = (statusName: string): StatusCategory => {
  const status = (statusName || '').toLowerCase().trim();
  if (status.includes('done') || status.includes('resolved') || status.includes('완료') || status.includes('closed') || status.includes('성공')) {
    return 'Done';
  }
  if (status.includes('progress') || status.includes('진행') || status.includes('doing') || status.includes('개발') || status.includes('selected') || status.includes('working')) {
    return 'In Progress';
  }
  return 'To Do';
};

// 캘린더 이벤트 요약 내용에서 연차 유형과 신청 팀원 이름을 추출
export const parseVacationEvent = (summary: string): VacationParseResult => {
  if (!summary) return { isVacation: false, name: '', matchedWord: '' };

  const bracketMatch = summary.match(/^\[([^\]]+)\]\s*([가-힣a-zA-Z0-9\s]+)/);
  if (bracketMatch) {
    const type = bracketMatch[1];
    const keywords = ['연차', '휴가', '반차', '대체휴무', '건강검진', '반반차', '오후반반차', '오전반반차', '오전반차', '오후반차', '유연근무'];
    const isVacation = keywords.some(k => type.includes(k));
    if (isVacation) {
      return {
        isVacation: true,
        name: bracketMatch[2].trim(),
        matchedWord: type.trim()
      };
    }
  }

  const suffixMatch = summary.match(/^([가-힣a-zA-Z0-9\s]+?)\s*(연차|휴가|반차|대체휴무|건강검진|오후반반차|오전반반차|오전반차|오후반차|유연근무)/);
  if (suffixMatch) {
    return {
      isVacation: true,
      name: suffixMatch[1].trim(),
      matchedWord: suffixMatch[2].trim()
    };
  }

  return { isVacation: false, name: '', matchedWord: '' };
};

// 캘린더 이벤트의 일정과 대상 조회 범위가 중첩되는지 확인
export const isEventOverlapping = (
  evtStart: CalendarDateField | undefined,
  evtEnd: CalendarDateField | undefined,
  startRange: string,
  endRange: string,
): boolean => {
  const eventStartDate = getLocalDateStr(evtStart);
  const eventEndDate = getLocalDateStr(evtEnd);
  if (!eventStartDate) return false;

  const targetEnd = endRange || startRange;
  if (evtStart?.date) {
    return eventStartDate <= targetEnd && eventEndDate > startRange;
  }
  return eventStartDate <= targetEnd && eventEndDate >= startRange;
};

// 특정 팀원의 기간 내 모든 연차 이력을 문자열로 요약
export const getMemberVacationDates = (
  events: CalendarEvent[] | string[],
  member: string,
  startRange: string,
  endRange: string,
): string => {
  if (!Array.isArray(events)) return '';
  const vacationStrings: string[] = [];
  events.forEach(evt => {
    if (typeof evt === 'string') return;
    const summary = evt.summary || '';
    if (isEventOverlapping(evt.start, evt.end, startRange, endRange)) {
      const { isVacation, name, matchedWord } = parseVacationEvent(summary);
      if (isVacation && name === member) {
        const startVal = evt.start?.date || evt.start?.dateTime;
        const endVal = evt.end?.date || evt.end?.dateTime;
        const eventStartDate = startVal ? dayjs(startVal).format('YYYY.MM.DD') : '';
        let dateStr = '';
        if (evt.start?.date) {
          // 종일 이벤트의 경우 end.date는 다음날 0시로 지정되므로 하루를 뺍니다.
          const formattedEndDate = dayjs(evt.end?.date).subtract(1, 'day').format('YYYY.MM.DD');
          dateStr = eventStartDate === formattedEndDate ? eventStartDate : `${eventStartDate} ~ ${formattedEndDate}`;
        } else {
          const eventEndDate = endVal ? dayjs(endVal).format('YYYY.MM.DD') : '';
          dateStr = eventStartDate === eventEndDate ? eventStartDate : `${eventStartDate} ~ ${eventEndDate}`;
        }
        vacationStrings.push(`${matchedWord} (${dateStr})`);
      }
    }
  });
  return vacationStrings.join(', ');
};

// 캘린더 연차 대상 목록을 조회하는 유틸리티
export const getVacationMembers = (
  events: CalendarEvent[] | string[],
  startDate: string,
  endDate: string,
  registered: string[],
): string[] => {
  console.log('[Calendar] getVacationMembers 시작 - 대상 범위:', startDate, '~', endDate, '| 등록 팀원:', registered);
  if (!events || events.length === 0 || !startDate) {
    console.log('[Calendar] 이벤트 목록이 비어있거나 날짜가 유효하지 않습니다.');
    return [];
  }

  const vacations: string[] = [];
  events.forEach(evt => {
    if (typeof evt === 'string') return;
    if (isEventOverlapping(evt.start, evt.end, startDate, endDate)) {
      const { isVacation, name } = parseVacationEvent(evt.summary || '');
      if (isVacation && name) {
        if (registered.includes(name) && !vacations.includes(name)) {
          vacations.push(name);
          console.log(`[Calendar] 연차 매칭 성공: ${name} (${evt.summary})`);
        }
      }
    }
  });

  console.log('[Calendar] 최종 연차자 명단:', vacations);
  return vacations;
};

// JQL 쿼리 빌더 클래스
export class JqlQueryBuilder {
  project: string;
  assignees: string[];
  statuses: string[];
  dateField: string;
  startDate: string;
  endDate: string;
  orderByField: string;
  orderDirection: string;

  constructor() {
    this.project = 'PROJ';
    this.assignees = [];
    this.statuses = [];
    this.dateField = 'updated';
    this.startDate = '';
    this.endDate = '';
    this.orderByField = 'updated';
    this.orderDirection = 'DESC';
  }

  setProject(project: string): this {
    this.project = project ? project.trim() : 'PROJ';
    return this;
  }

  setAssignees(membersString: string): this {
    if (membersString) {
      this.assignees = membersString
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);
    }
    return this;
  }

  setDateRange(startDate: string, endDate: string, dateField = 'updated'): this {
    this.startDate = startDate;
    this.endDate = endDate;
    this.dateField = dateField;
    this.orderByField = dateField;
    return this;
  }

  build(): string {
    let jql = '';
    const projects = this.project
      ? this.project.split(',').map(p => p.trim()).filter(p => p.length > 0)
      : [];

    // 프로젝트가 2개 이상일 경우
    if (projects.length > 1) {
      const projQuery = projects.map(p => `"${p}"`).join(', ');
      jql = `project in (${projQuery})`;
    // 프로젝트가 1개일 경우
    } else if (projects.length === 1) {
      jql = `project = "${projects[0]}"`;
    // 프로젝트가 없을 경우
    } else {
      jql = 'project = "PROJ"';
    }

    // 담당자가 있을 경우
    if (this.assignees.length > 0) {
      const membersQuery = this.assignees.map(m => `"${m}"`).join(', ');
      jql += ` AND assignee in (${membersQuery})`;
    }
    // 상태가 있을 경우
    if (this.statuses.length > 0) {
      const statusesQuery = this.statuses.map(s => `"${s}"`).join(', ');
      jql += ` AND status in (${statusesQuery})`;
    }
    // 하위 작업(Sub-task) 제외
    jql += ' AND issuetype not in subTaskIssueTypes()';

    // 날짜 범위가 있을 경우
    if (this.startDate && this.endDate) {
      if (this.dateField === 'duedate') {
        jql += ` AND duedate >= "${this.startDate}" AND duedate <= "${this.endDate}"`;
      } else if (this.dateField === 'updated') {
        jql += ` AND updated >= "${this.startDate}" AND updated <= "${this.endDate} 23:59"`;
      } else {
        jql += ` AND ${this.dateField} >= "${this.startDate}" AND ${this.dateField} <= "${this.endDate}"`;
      }
    } else if (this.startDate) {
      jql += ` AND ${this.dateField} >= "${this.startDate}"`;
    } else if (this.endDate) {
      jql += ` AND ${this.dateField} <= "${this.endDate}"`;
    }
    jql += ` ORDER BY ${this.orderByField} ${this.orderDirection}`;
    return jql;
  }
}

// Strategy Pattern - 업무 보고서 생성 전략 클래스들
export class ReportStrategy {
  generate(_reportParams: ReportParams): string {
    throw new Error('generate method must be implemented');
  }
}

// 티켓 마크다운 공통 렌더러 (추상화 헬퍼)
export const TicketMarkdownRenderer = {
  // 개별 티켓 포맷팅
  format(
    ticket: Ticket,
    jiraUrl: string,
    {
      showStatus = false,
      showUpdate = false,
      showAssignee = false,
      showEpic = false,
      dateFormat = 'YYYY.MM.DD',
    }: TicketFormatOptions = {},
  ): string {
    const epicInfo = (showEpic && ticket.epic) ? ` *(에픽: ${ticket.epic.key}: ${escapeBrackets(ticket.epic.summary)})*` : '';
    const details = [];
    if (showStatus) details.push(`\`${ticket.status}\``);
    if (showUpdate) {
      const formatStr = dateFormat === 'MM/DD' ? 'MM/DD' : 'YYYY.MM.DD';
      const dueDate = ticket.duedate ? dayjs(ticket.duedate).format(formatStr) : dayjs().format(formatStr);
      details.push(`기한: ${dueDate}`);
    }
    if (showAssignee && ticket.assignee) {
      details.push(`담당자: ${ticket.assignee}`);
    }
    
    const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    return `[${ticket.key}: ${escapeBrackets(ticket.summary)}](${getTicketLink(ticket.key, jiraUrl)})${detailsStr}${epicInfo}`;
  },

  // 특정 상태(카테고리) 티켓 그룹 렌더링
  renderGroup(
    tickets: Ticket[],
    jiraUrl: string,
    {
      category,
      title,
      emptyMessage,
      symbol = '',
      bullet = '- ',
      showStatus = false,
      showUpdate = false,
      showAssignee = false,
      showEpic = false,
      dateFormat = 'YYYY.MM.DD',
    }: TicketRenderGroupOptions,
  ): string {
    const filtered = tickets.filter(t => getStatusCategory(t.status) === category);
    let md = `${title}\n`;
    if (filtered.length === 0) {
      md += `${bullet}${emptyMessage}\n`;
    } else {
      filtered.forEach(t => {
        const itemSymbol = symbol ? `${symbol} ` : '';
        const formatted = this.format(t, jiraUrl, { showStatus, showUpdate, showAssignee, showEpic, dateFormat });
        md += `${bullet}${itemSymbol}${formatted}\n`;
      });
    }
    return md;
  }
};

// 일일 업무 보고서 생성 전략
export class DailyReportStrategy extends ReportStrategy {
  generate(reportParams: ReportParams): string {
    const { currList, nextList, start, end, proj, rawEvents, targetRegs, jiraUrl } = reportParams;
    const todayStr = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
    const activeDailyVacations: string[] = Array.isArray(rawEvents)
      ? (rawEvents.length > 0 && typeof rawEvents[0] === 'string'
        ? rawEvents as string[]
        : getVacationMembers(rawEvents, todayStr, todayStr, targetRegs))
      : [];

    const displayStart = dayjs(start).format('YYYY.MM.DD');
    const displayEnd = dayjs(end).format('YYYY.MM.DD');

    let dailyMd = `# 📅 일일 업무 STAND-UP 보고서\n\n`;
    dailyMd += `> **보고 기간**: ${displayStart} ~ ${displayEnd}\n`;
    dailyMd += `> **생성 일시**: ${dayjs().tz('Asia/Seoul').format('YYYY.MM.DD HH:mm:ss')}\n\n`;

    // 진행 중 티켓은 오늘 갱신 여부와 무관하게 항상 노출(현재 작업 현황),
    // 그 외(완료 등)는 오늘 작업했거나 오늘 기한인 경우에만 노출
    const dailyTickets = currList.filter(t => {
      if (getStatusCategory(t.status) === 'In Progress') return true;
      return t.updated === todayStr || t.duedate === todayStr;
    });

    // 일일 담당자 목록 생성
    const members = [...new Set(dailyTickets.map(t => t.assignee))];
    // 휴가자 추가 
    const vacationOnlyMembers = activeDailyVacations.filter(v => !members.includes(v));
    // 전체 담당자 목록 생성
    const allDailyMembers = [...members, ...vacationOnlyMembers];

    if (allDailyMembers.length === 0) {
      dailyMd += `오늘 작업했거나 기한인 진행 중/완료 티켓이 없습니다.\n`;
    } else {
      // 담당자 별로 티켓 목록 생성
      allDailyMembers.forEach(member => {
        // 담당자 이름 표시
        dailyMd += `## 👤 담당자: ${member}\n\n`;

        if (activeDailyVacations.includes(member)) {
          const vacDates = Array.isArray(rawEvents) && (rawEvents.length === 0 || typeof rawEvents[0] !== 'string')
            ? getMemberVacationDates(rawEvents as CalendarEvent[], member, todayStr, todayStr)
            : '';
          const displayToday = dayjs(todayStr).format('YYYY.MM.DD');
          dailyMd += `- 🏝️ ${vacDates || `연차 (${displayToday})`}\n\n`;
          // 반차/반반차/유연근무 등 반일 근무는 티켓도 함께 노출, 종일 휴가는 여기서 종료
          const isPartialVacation = /반차|유연근무/.test(vacDates);
          if (!isPartialVacation) {
            dailyMd += `---\n\n`;
            return;
          }
        }

        // 담당자별 티켓 필터링
        const memberTickets = dailyTickets.filter(t => t.assignee === member);

        // 완료 목록 렌더링
        dailyMd += TicketMarkdownRenderer.renderGroup(memberTickets, jiraUrl, {
          category: 'Done',
          title: '### 🟢 오늘 완료한 업무 (Done)',
          emptyMessage: '완료된 업무가 없습니다.',
          bullet: '- ',
          showUpdate: true,
          showEpic: true,
        });
        dailyMd += `\n`;

        // 진행중 목록 렌더링
        dailyMd += TicketMarkdownRenderer.renderGroup(memberTickets, jiraUrl, {
          category: 'In Progress',
          title: '### 🔵 현재 진행 중인 업무 (In Progress)',
          emptyMessage: '진행 중인 업무가 없습니다.',
          bullet: '- ',
          showUpdate: true,
          showEpic: true,
        });
        dailyMd += `\n---\n\n`;
      });
    }
    return dailyMd;
  }
}

// 주간 업무 보고서 생성 전략
export class WeeklyReportStrategy extends ReportStrategy {
  generate(reportParams: ReportParams): string {
    const { currList, nextList, start, end, proj, rawEvents, targetRegs, jiraUrl, scheduleTickets } = reportParams;
    const activeWeeklyVacations: string[] = Array.isArray(rawEvents)
      ? (rawEvents.length > 0 && typeof rawEvents[0] === 'string'
        ? rawEvents as string[]
        : getVacationMembers(rawEvents, start, end, targetRegs))
      : [];

    // 기한(duedate)이 지정된 경우, 기한 날짜가 선택된 start ~ end 범위에 속하는 티켓만 엄격 선별
    const filteredCurrList = currList.filter(t => {
      if (!t.duedate) return true;
      const due = dayjs(t.duedate).format('YYYY-MM-DD');
      return due >= start && due <= end;
    });

    const total = filteredCurrList.length;
    const completedCount = filteredCurrList.filter(t => getStatusCategory(t.status) === 'Done').length;
    const progressingCount = filteredCurrList.filter(t => getStatusCategory(t.status) === 'In Progress').length;
    const todoCount = total - completedCount - progressingCount;

    const displayStart = dayjs(start).format('YYYY.MM.DD');
    const displayEnd = dayjs(end).format('YYYY.MM.DD');

    let weeklyMd = `# 📊 주간 프로젝트 업무 보고서\n\n`;
    weeklyMd += `## 🗓️ 1. 보고서 요약 개요\n\n`;
    weeklyMd += `* **작성 일자**: ${dayjs().tz('Asia/Seoul').format('YYYY.MM.DD')}\n`;
    weeklyMd += `* **대상 기간**: ${displayStart} ~ ${displayEnd}\n`;
    weeklyMd += `* **프로젝트 코드**: \`${proj}\`\n\n`;

    weeklyMd += `### 📈 2. 이번 주 진행 상태 메트릭스\n\n`;
    weeklyMd += `| 티켓 상태 | 건수 | 완료율 / 비율 |\n`;
    weeklyMd += `|---|---|---|\n`;
    weeklyMd += `| **완료 (Done/Resolved)** | ${completedCount}건 | ${total > 0 ? Math.round((completedCount / total) * 100) : 0}% |\n`;
    weeklyMd += `| **진행 중 (In Progress)** | ${progressingCount}건 | ${total > 0 ? Math.round((progressingCount / total) * 100) : 0}% |\n`;
    weeklyMd += `| **대기 중 (To Do)** | ${todoCount}건 | ${total > 0 ? Math.round((todoCount / total) * 100) : 0}% |\n`;
    weeklyMd += `| **합계 (Total)** | **${total}건** | **100%** |\n\n`;

    // 에픽별 진행 현황은 올해 전체 누적 데이터(scheduleTickets) 기준으로 측정
    const progressSourceTickets = (scheduleTickets && scheduleTickets.length > 0)
      ? scheduleTickets
      : filteredCurrList;

    const epicSchedules = buildEpicScheduleData(progressSourceTickets);
    const epicSummaryTable = buildEpicSummaryTable(epicSchedules);
    if (epicSummaryTable) {
      weeklyMd += `${epicSummaryTable.trim()}\n\n`;
    }

    weeklyMd += `## 📋 3. 에픽별 상세 업무 진행 현황\n\n`;

    // 에픽 단위로 그룹화
    const epicsMap: Record<string, { key: string; summary: string; tickets: Ticket[] }> = {};
    filteredCurrList.forEach(t => {
      const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
      const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 업무)';
      if (!epicsMap[epicKey]) {
        epicsMap[epicKey] = { key: epicKey, summary: epicSummary, tickets: [] };
      }
      epicsMap[epicKey].tickets.push(t);
    });

    const sortedEpicKeys = Object.keys(epicsMap).sort((a, b) => {
      if (a === 'NO_EPIC') return 1;
      if (b === 'NO_EPIC') return -1;
      return a.localeCompare(b);
    });

    if (sortedEpicKeys.length === 0) {
      weeklyMd += `* 조회 기간 내 상세 티켓 내역이 없습니다.\n\n`;
    } else {
      sortedEpicKeys.forEach(epicKey => {
        const epic = epicsMap[epicKey];
        // To Do 제거: Done 및 In Progress 티켓만 추출
        const activeTickets = epic.tickets.filter(t => {
          const cat = getStatusCategory(t.status);
          return cat === 'Done' || cat === 'In Progress';
        });

        if (activeTickets.length > 0) {
          weeklyMd += epicKey === 'NO_EPIC'
            ? `### 🏷️ ${epic.summary}\n`
            : `### 🏷️ 에픽: ${epic.summary} (${epic.key})\n`;

          activeTickets.forEach(t => {
            const cat = getStatusCategory(t.status);
            const symbol = cat === 'Done' ? '✅' : '🔄';
            const formatted = TicketMarkdownRenderer.format(t, jiraUrl, {
              showStatus: true,
              showUpdate: true,
              showAssignee: true,
              dateFormat: 'MM/DD',
            });
            weeklyMd += `* ${symbol} ${formatted}\n`;
          });
          weeklyMd += `\n`;
        }
      });
    }

    if (activeWeeklyVacations.length > 0) {
      weeklyMd += `### 🏝️ 휴가 및 연차 현황\n`;
      activeWeeklyVacations.forEach(member => {
        const vacDates = Array.isArray(rawEvents) && (rawEvents.length === 0 || typeof rawEvents[0] !== 'string')
          ? getMemberVacationDates(rawEvents as CalendarEvent[], member, start, end)
          : '';
        weeklyMd += `* ${member}: ${vacDates || '연차'}\n`;
      });
      weeklyMd += `\n`;
    }

    weeklyMd += `## 🚀 4. 다음 주 주요 계획 및 이슈 사항\n\n`;
    if (nextList.length === 0) {
      weeklyMd += `* **마일스톤 점검**: 다음 주 예정된 지라 티켓이 등록되어 있지 않거나 계획을 불러올 수 없습니다.\n`;
      weeklyMd += `* **장애 요인**: 예정된 주요 마일스톤에 지연 요소가 없는지 리스크 사전 점검.\n`;
    } else {
      const nextEpicsMap: Record<string, { key: string; summary: string; tickets: Ticket[] }> = {};
      nextList.forEach(t => {
        const epicKey = t.epic ? t.epic.key : 'NO_EPIC';
        const epicSummary = t.epic ? t.epic.summary : '에픽 없음 (기타 계획)';
        if (!nextEpicsMap[epicKey]) {
          nextEpicsMap[epicKey] = { key: epicKey, summary: epicSummary, tickets: [] };
        }
        nextEpicsMap[epicKey].tickets.push(t);
      });

      const nextEpicKeys = Object.keys(nextEpicsMap).sort((a, b) => {
        if (a === 'NO_EPIC') return 1;
        if (b === 'NO_EPIC') return -1;
        return a.localeCompare(b);
      });

      nextEpicKeys.forEach(epicKey => {
        const epic = nextEpicsMap[epicKey];
        weeklyMd += epicKey === 'NO_EPIC'
          ? `### 🏷️ ${epic.summary}\n`
          : `### 🏷️ 에픽: ${epic.summary} (${epic.key})\n`;

        epic.tickets.forEach(t => {
          const cat = getStatusCategory(t.status);
          const stateSymbol = cat === 'Done' ? '🟢 [완료예정]' : cat === 'In Progress' ? '🔄 [진행예정]' : '⏱️ [할일]';
          const dueDate = t.duedate ? dayjs(t.duedate).format('MM/DD') : dayjs().format('MM/DD');
          const assigneeStr = t.assignee ? `, 담당자: ${t.assignee}` : '';
          weeklyMd += `* ${stateSymbol} [${t.key}: ${escapeBrackets(t.summary)}](${getTicketLink(t.key, jiraUrl)}) (\`${t.status}\`, 기한: ${dueDate}${assigneeStr})\n`;
        });
        weeklyMd += `\n`;
      });
    }

    return weeklyMd;
  }
}

export function processEpicSearchGroup(sectionText: string, searchKeyword: string): string {
  if (!searchKeyword || !searchKeyword.trim()) return sectionText;

  const keywords = searchKeyword
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  if (keywords.length === 0) return sectionText;

  const lines = sectionText.split('\n');
  const headerLines: string[] = [];
  const epicBlocks: { rawHeader: string; title: string; meta: string; content: string[] }[] = [];

  let currentRawHeader = '';
  let currentTitle = '';
  let currentMeta = '';
  let currentContent: string[] = [];

  lines.forEach(line => {
    if (line.startsWith('### ')) {
      if (currentRawHeader) {
        epicBlocks.push({
          rawHeader: currentRawHeader,
          title: currentTitle,
          meta: currentMeta,
          content: [...currentContent],
        });
      }
      currentRawHeader = line;
      currentContent = [];

      let cleanHeader = line.replace(/^###\s*(?:🏷️\s*)?(?:에픽:\s*)?/, '').trim();
      cleanHeader = cleanHeader.replace(/\s*\([A-Z0-9]+-[0-9]+\)/g, '');

      const dashIdx = cleanHeader.indexOf('—');
      const colonIdx = cleanHeader.indexOf(':');
      let meta = '';
      let title = cleanHeader;

      if (dashIdx !== -1) {
        title = cleanHeader.slice(0, dashIdx).trim();
        meta = cleanHeader.slice(dashIdx).trim();
      } else if (colonIdx !== -1 && /BE:|FE:|MO:|\d+\/\d+/.test(cleanHeader)) {
        title = cleanHeader.slice(0, colonIdx).trim();
        meta = cleanHeader.slice(colonIdx).trim();
      }

      currentTitle = title;
      currentMeta = meta;
    } else if (currentRawHeader) {
      currentContent.push(line);
    } else {
      headerLines.push(line);
    }
  });

  if (currentRawHeader) {
    epicBlocks.push({
      rawHeader: currentRawHeader,
      title: currentTitle,
      meta: currentMeta,
      content: [...currentContent],
    });
  }

  const consumedEpicIndices = new Set<number>();
  let rebuilt = headerLines.join('\n').trimEnd() + '\n\n';
  let matchedCountTotal = 0;

  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    const matchedBlocksForKeyword: { block: typeof epicBlocks[0]; index: number }[] = [];

    epicBlocks.forEach((b, idx) => {
      if (consumedEpicIndices.has(idx)) return;
      const isMatched = b.title.toLowerCase().includes(lowerKeyword) || b.rawHeader.toLowerCase().includes(lowerKeyword);
      if (isMatched) {
        matchedBlocksForKeyword.push({ block: b, index: idx });
      }
    });

    if (matchedBlocksForKeyword.length > 0) {
      matchedCountTotal += matchedBlocksForKeyword.length;
      rebuilt += `### ${keyword}\n`;

      matchedBlocksForKeyword.forEach(({ block: b, index }) => {
        consumedEpicIndices.add(index);

        let subTitle = b.title;
        const subIdx = subTitle.toLowerCase().indexOf(lowerKeyword);
        if (subIdx !== -1) {
          subTitle = (subTitle.slice(0, subIdx) + subTitle.slice(subIdx + keyword.length)).trim();
        }
        subTitle = subTitle.replace(/^[:\s\-]+|[:\s\-]+$/g, '').trim();

        if (!subTitle) {
          subTitle = b.title;
        }

        let cleanMeta = b.meta;
        if (cleanMeta.startsWith('—')) {
          cleanMeta = cleanMeta.slice(1).trim();
        }
        cleanMeta = cleanMeta.replace(/^:\s*/, '').trim();

        const subHeaderMeta = cleanMeta ? `: ${cleanMeta}` : '';
        rebuilt += `#### ${subTitle}${subHeaderMeta}\n`;
        rebuilt += b.content.join('\n').trim() + '\n\n';
      });
    }
  });

  if (matchedCountTotal === 0) {
    return sectionText;
  }

  const remainingBlocks = epicBlocks.filter((_, idx) => !consumedEpicIndices.has(idx));
  if (remainingBlocks.length > 0) {
    rebuilt += `### 📁 기타 에픽 목록\n\n`;
    remainingBlocks.forEach(b => {
      rebuilt += `${b.rawHeader}\n${b.content.join('\n').trim()}\n\n`;
    });
  }

  return rebuilt;
}

interface CategoryInfo {
  categoryPrefix: string;
  subItem: string;
}

function parseCategoryInfo(text: string): CategoryInfo | null {
  if (!text || !text.includes('>')) return null;

  // Case 1: 마크다운 링크 형태 [대시보드 > 주요 운영 지표 > 검사 수행 현황](url) (완료)
  const linkMatch = text.match(/^\[(.*?)\]\((.*?)\)(.*)$/);
  if (linkMatch) {
    const anchorText = linkMatch[1];
    const url = linkMatch[2];
    const restSuffix = linkMatch[3];

    if (!anchorText.includes('>')) return null;

    const lastGtIdx = anchorText.lastIndexOf('>');
    const categoryPrefix = anchorText.substring(0, lastGtIdx).trim();
    const detailTitle = anchorText.substring(lastGtIdx + 1).trim();

    const subItem = `[${detailTitle}](${url})${restSuffix}`;
    return { categoryPrefix, subItem };
  }

  // Case 2: 일반 텍스트 형태 대시보드 > 주요 운영 지표 > 검사 수행 현황 영역 (완료)
  const lastGtIdx = text.lastIndexOf('>');
  if (lastGtIdx === -1) return null;

  const categoryPrefix = text.substring(0, lastGtIdx).trim();
  const subItem = text.substring(lastGtIdx + 1).trim();

  return { categoryPrefix, subItem };
}

function isSameCategoryAsEpic(categoryPrefix: string, epicTitle: string): boolean {
  if (!categoryPrefix || !epicTitle) return false;

  const normCategory = categoryPrefix.replace(/[\[\]]/g, '').trim().toLowerCase();
  const normEpic = epicTitle.replace(/^[#\s|>]+/, '').replace(/[\[\]]/g, '').trim().toLowerCase();

  if (normCategory === normEpic) return true;

  if (normEpic.includes('>')) {
    const lastEpicPart = normEpic.split('>').pop()?.trim().toLowerCase();
    if (lastEpicPart && lastEpicPart === normCategory) return true;
  }

  if (normEpic.endsWith(normCategory)) return true;

  return false;
}

function groupCategoryLines(lines: string[]): string {
  interface ParsedLine {
    originalIndex: number;
    line: string;
    bulletPrefix: string;
    categoryPrefix: string | null;
    subItem: string | null;
    groupKey: string | null;
    epicTitle: string;
  }

  let currentEpicTitle = '';

  const parsedLines: ParsedLine[] = lines.map((line, idx) => {
    const headerMatch = line.match(/^#+\s*(?:>\s*)?(.*)$/);
    if (headerMatch) {
      currentEpicTitle = headerMatch[1].trim();
    }

    const bulletMatch = line.match(/^(\s*[*|-]\s*(?:✅|🔄|⏱️|⏱|🟢)?\s*)(.*)$/);
    if (!bulletMatch) {
      return { originalIndex: idx, line, bulletPrefix: '', categoryPrefix: null, subItem: null, groupKey: null, epicTitle: currentEpicTitle };
    }

    const bulletPrefix = bulletMatch[1];
    const restText = bulletMatch[2];
    const categoryInfo = parseCategoryInfo(restText);

    if (!categoryInfo) {
      return { originalIndex: idx, line, bulletPrefix, categoryPrefix: null, subItem: null, groupKey: null, epicTitle: currentEpicTitle };
    }

    const groupKey = `${bulletPrefix.trim()}|||${categoryInfo.categoryPrefix.trim()}`;
    return {
      originalIndex: idx,
      line,
      bulletPrefix,
      categoryPrefix: categoryInfo.categoryPrefix,
      subItem: categoryInfo.subItem,
      groupKey,
      epicTitle: currentEpicTitle,
    };
  });

  const categoryGroups: Record<string, { bulletPrefix: string; categoryPrefix: string; epicTitle: string; firstIndex: number; subItems: string[] }> = {};

  parsedLines.forEach((item) => {
    if (item.groupKey && item.categoryPrefix && item.subItem) {
      if (!categoryGroups[item.groupKey]) {
        categoryGroups[item.groupKey] = {
          bulletPrefix: item.bulletPrefix,
          categoryPrefix: item.categoryPrefix,
          epicTitle: item.epicTitle,
          firstIndex: item.originalIndex,
          subItems: [item.subItem],
        };
      } else {
        categoryGroups[item.groupKey].subItems.push(item.subItem);
      }
    }
  });

  const processedKeys = new Set<string>();
  const result: string[] = [];

  parsedLines.forEach((item) => {
    if (!item.groupKey) {
      result.push(item.line);
      return;
    }

    const group = categoryGroups[item.groupKey];
    if (!group || group.subItems.length <= 1) {
      result.push(item.line);
      return;
    }

    if (!processedKeys.has(item.groupKey)) {
      processedKeys.add(item.groupKey);

      const isSameAsEpic = isSameCategoryAsEpic(group.categoryPrefix, group.epicTitle);
      if (isSameAsEpic) {
        result.push(`${group.bulletPrefix}${group.subItems.join(', ')}`);
      } else {
        result.push(`${group.bulletPrefix}${group.categoryPrefix}: ${group.subItems.join(', ')}`);
      }
    }
  });

  return result.join('\n');
}

export function applyWeeklyReportTagFilters(
  weeklyMd: string,
  tagFilters?: WeeklyReportTagFilters
): string {
  if (
    !tagFilters ||
    (!tagFilters.hideTicketNumber &&
      !tagFilters.hidePosition &&
      !tagFilters.hideDueDate &&
      !tagFilters.hideAssignee &&
      !tagFilters.groupCategory)
  ) {
    return weeklyMd;
  }

  const { hideTicketNumber, hidePosition, hideDueDate, hideAssignee, groupCategory } = tagFilters;
  const lines = weeklyMd.split('\n');

  // 1. 라인 단위 텍스트 요법(티켓넘버, 포지션, 기한, 담당자) 숨김 처리 (단, 표 '|' 라인은 100% 유지)
  const processedLines = lines.map((line) => {
    if (line.trim().startsWith('|')) {
      return line;
    }

    if (!line || (!line.includes('[') && !line.includes(':') && !line.includes('('))) {
      return line;
    }

    let result = line;

    // 1) 티켓 넘버 제거 (e.g. "DI26-625: ", "[DI26-625: ")
    if (hideTicketNumber) {
      result = result.replace(/(\[|\b)([A-Za-z0-9]+-\d+:\s*)/g, '$1');
    }

    // 2) 포지션 제거 (e.g. "(FE) ", "(BE) ", "(Design) ")
    if (hidePosition) {
      result = result.replace(/\((FE|BE|DE|Design|QA|DevOps|PM|PO|iOS|Android|Fullstack|Publishing|Markup|Frontend|Backend|[A-Z]{2,6})\)\s*/gi, '');
    }

    // 3) 기한 제거 (e.g. ", 기한: 08/04 > 갱신일:07/31" 또는 "기한: 08/04 > 갱신일:07/31, " 또는 "기한: 08/04")
    if (hideDueDate) {
      result = result.replace(/,\s*기한:\s*[^,)]+|기한:\s*[^,)]+\s*,?/g, '');
    }

    // 4) 담당자 제거 (e.g. ", 담당자: 박예린" 또는 "담당자: 박예린, " 또는 "담당자: 박예린")
    if (hideAssignee) {
      result = result.replace(/,\s*담당자:\s*[^,)]+|담당자:\s*[^,)]+\s*,?/g, '');
    }

    // 5) 괄호 및 쉼표 부작용 정리
    result = result.replace(/\(\s*,\s*/g, '(');
    result = result.replace(/,\s*\)/g, ')');
    result = result.replace(/,\s*,/g, ',');
    result = result.replace(/\(\s*\)/g, '');

    return result;
  });

  const processedText = processedLines.join('\n');

  if (!groupCategory) {
    return processedText;
  }

  // 2. 카테고리 중복 묶기 (오직 Section 3 [에픽별 상세 업무] 및 Section 4 [다음 주 주요 계획] 티켓에만 독점 적용)
  const sections = processedText.split(/(?=^## )/m);
  return sections
    .map((section) => {
      if (section.startsWith('## 📋 3.') || section.startsWith('## 🚀 4.')) {
        const secLines = section.split('\n');
        return groupCategoryLines(secLines);
      }
      return section;
    })
    .join('');
}

export function applyWeeklyReportFilter(
  weeklyMd: string,
  searchKeyword: string,
  tagFilters?: WeeklyReportTagFilters
): string {
  let result = weeklyMd;

  if (searchKeyword && searchKeyword.trim()) {
    const sections = result.split(/(?=^## )/m);
    result = sections
      .map(section => {
        if (!section.startsWith('## 📋 3.') && !section.startsWith('## 🚀 4.')) {
          return section;
        }
        return processEpicSearchGroup(section, searchKeyword);
      })
      .join('');
  }

  if (tagFilters) {
    result = applyWeeklyReportTagFilters(result, tagFilters);
  }

  return result;
}

export class ReportContext {
  strategy: ReportStrategy;

  constructor(strategy: ReportStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: ReportStrategy): void {
    this.strategy = strategy;
  }

  generate(reportParams: ReportParams): string {
    return this.strategy.generate(reportParams);
  }
}

import dayjs from 'dayjs';
import type {
  JiraSearchIssue,
  JiraSearchResponse,
  ProgressCallback,
  Ticket,
} from '../types';

export async function fetchJiraTickets(
  jql: string,
  modeUrl: string,
  modeEmail: string,
  modeToken: string,
  onProgress?: ProgressCallback,
): Promise<Ticket[]> {
  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (modeEmail && modeToken) {
    reqHeaders['Authorization'] = `Basic ${btoa(`${modeEmail}:${modeToken}`)}`;
  }

  let cleanUrl = (modeUrl || '').trim();
  try {
    if (cleanUrl.toLowerCase().startsWith('http')) {
      const urlObj = new URL(cleanUrl);
      cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
    }
  } catch (err: unknown) {
    console.warn('URL 호스트 파싱 실패, 원본 유지:', err);
  }

  let allIssues: JiraSearchIssue[] = [];
  const limit = 100;
  let pageCount = 0;
  const maxPages = 20;
  let nextPageToken: string | null = null;

  while (pageCount < maxPages) {
    const basePath = cleanUrl ? `${cleanUrl.replace(/\/$/, '')}/rest/api/3/search/jql` : '/rest/api/3/search/jql';
    let targetUrl = `${basePath}?jql=${encodeURIComponent(jql)}&fields=key,summary,status,assignee,updated,created,parent,duedate&maxResults=${limit}`;
    if (nextPageToken) {
      targetUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }
    const apiEndpoint = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

    console.log(`[Jira Fetch] GET /search/jql | page ${pageCount + 1}${nextPageToken ? ` | token: ${nextPageToken}` : ''}...`);
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: reqHeaders,
    });

    if (!response.ok) {
      throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Jira 서버가 JSON 대신 올바르지 않은 타입의 문서를 반환했습니다.');
    }

    const data = await response.json() as JiraSearchResponse;
    const pageIssues = data.issues || [];

    if (pageIssues.length === 0) break;

    allIssues = allIssues.concat(pageIssues);
    pageCount++;

    console.log(`[Jira API Fetch] page ${pageCount} | ${pageIssues.length}건 | 누적: ${allIssues.length}건 | nextPageToken: ${data.nextPageToken || '없음(마지막)'}`);
    onProgress?.({ dot: 'success', text: `티켓 수집 중... (${allIssues.length}건)` });

    if (!data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }

  if (pageCount >= maxPages) {
    console.warn(`[Jira API Fetch] 안전 한계(${maxPages}페이지)에 도달, 수집 종료.`);
  }
  console.log(`[Jira API Fetch] 수집 완료: 총 ${allIssues.length}건 (${pageCount}페이지)`);

  return allIssues.map(issue => ({
    key: issue.key || '',
    summary: issue.fields?.summary || '제목 없음',
    status: issue.fields?.status ? (issue.fields.status.name || 'To Do') : 'To Do',
    assignee: issue.fields?.assignee
      ? (issue.fields.assignee.displayName || issue.fields.assignee.name || '미지정')
      : '미지정',
    updated: issue.fields?.updated ? issue.fields.updated.substring(0, 10) : '',
    created: issue.fields?.created ? issue.fields.created.substring(0, 10) : '',
    duedate: issue.fields?.duedate ? issue.fields.duedate : dayjs().format('YYYY-MM-DD'),
    epic: issue.fields?.parent
      ? {
          key: issue.fields.parent.key || '',
          summary: issue.fields.parent.fields?.summary || '',
        }
      : null,
  }));
}

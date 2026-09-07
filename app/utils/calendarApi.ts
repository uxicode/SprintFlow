import type { CalendarApiErrorBody, CalendarFetchResult, FetchCalendarEventsParams } from '../types';

/**
 * 캘린더 이벤트 조회 함수
 */
export async function fetchCalendarEvents({
  calId,
  start,
  end,
  accessToken,
  refreshToken,
  clientId,
  clientSecret,
}: FetchCalendarEventsParams): Promise<CalendarFetchResult> {
  const timeMin = `${start}T00:00:00.000Z`;
  const timeMax = `${end}T23:59:59.000Z`;

  try {
    console.log('[Calendar OAuth] 이벤트 조회 중...');
    const response = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'events',
        accessToken: accessToken || undefined,
        refreshToken: refreshToken || undefined,
        clientId: clientId || undefined,
        clientSecret: clientSecret || undefined,
        calendarId: calId || undefined,
        timeMin,
        timeMax,
      }),
    });

    if (!response.ok) {
      let errData: CalendarApiErrorBody = {};
      try {
        errData = await response.json() as CalendarApiErrorBody;
      } catch {
        /* ignore */
      }
      const errMsg = errData.error || `Calendar API 오류 (HTTP ${response.status})`;
      return {
        items: [],
        error: errMsg,
        needReauth: !!errData.needReauth,
        newAccessToken: null,
      };
    }

    const data = await response.json() as CalendarApiErrorBody & {
      items?: import('../types').CalendarEvent[];
      newAccessToken?: string;
    };
    console.log(`[Calendar OAuth] ${(data.items || []).length}건 이벤트 로드 완료`);
    return {
      items: data.items || [],
      error: null,
      needReauth: false,
      newAccessToken: data.newAccessToken || null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('캘린더 OAuth 연차 로드 에러 (무시하고 계속 진행):', message);
    return { items: [], error: message, needReauth: false, newAccessToken: null };
  }
}

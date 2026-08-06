import { NextRequest, NextResponse } from 'next/server';

/**
 * Google Calendar 이벤트 조회 & 토큰 교환/갱신 API
 * 
 * POST /api/calendar/events
 * 
 * 동작 모드 (body.action):
 * 1. "exchange" — authorization code를 access_token + refresh_token으로 교환
 * 2. "refresh"  — refresh_token으로 access_token 갱신
 * 3. "events"   — access_token으로 Calendar 이벤트 조회
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleCalendarEventsResponse {
  items?: unknown[];
}

interface GoogleApiErrorBody {
  error?: {
    message?: string;
  };
}

interface HttpError extends Error {
  status?: number;
}

interface CalendarEventsRequestBody {
  action: string;
  code?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
}

/**
 * Authorization code → token 교환
 */
async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`토큰 교환 실패 (${response.status}): ${errText}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

/**
 * Refresh token → 새 access_token 발급
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`토큰 갱신 실패 (${response.status}): ${errText}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

/**
 * Google Calendar Events API 호출
 */
async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEventsResponse> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errText = await response.text();
    let googleErrorMsg = errText;
    try {
      const parsed = JSON.parse(errText) as GoogleApiErrorBody;
      if (parsed.error && parsed.error.message) {
        googleErrorMsg = parsed.error.message;
      }
    } catch (e) { /* not JSON */ }
    
    if (googleErrorMsg.includes('has not been used in project') || googleErrorMsg.includes('disabled')) {
      googleErrorMsg = `Google Calendar API가 활성화되지 않았습니다. Google Cloud Console(https://console.cloud.google.com)에서 Calendar API를 활성화해주세요. 상세 에러: ${googleErrorMsg}`;
    }
    
    const error = new Error(googleErrorMsg) as HttpError;
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<GoogleCalendarEventsResponse>;
}


export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CalendarEventsRequestBody;
    const { action } = body;

    // -------------------------------------------------------
    // 1. Authorization code → token 교환
    // -------------------------------------------------------
    if (action === 'exchange') {
      const code = body.code;
      const clientId = body.clientId || process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = body.clientSecret || process.env.GOOGLE_CLIENT_SECRET?.trim();
      if (!code || !clientId || !clientSecret) {
        return NextResponse.json(
          { error: 'code, clientId, clientSecret가 모두 필요합니다.' },
          { status: 400 }
        );
      }

      const redirectUri = `${new URL(request.url).origin}/api/calendar/callback`;
      try {
        const tokenData = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
        console.log('[Calendar Events API] 토큰 교환 성공');
        return NextResponse.json({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
        });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: (err as HttpError).status || 400 }
        );
      }
    }

    // -------------------------------------------------------
    // 2. Refresh token → 새 access_token 발급
    // -------------------------------------------------------
    if (action === 'refresh') {
      const refreshToken = body.refreshToken || process.env.GOOGLE_REFRESH_TOKEN?.trim();
      const clientId = body.clientId || process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = body.clientSecret || process.env.GOOGLE_CLIENT_SECRET?.trim();
      if (!refreshToken || !clientId || !clientSecret) {
        return NextResponse.json(
          { error: 'refreshToken, clientId, clientSecret가 모두 필요합니다.' },
          { status: 400 }
        );
      }

      try {
        const tokenData = await refreshAccessToken(refreshToken, clientId, clientSecret);
        console.log('[Calendar Events API] 토큰 갱신 성공');
        return NextResponse.json({
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
        });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: (err as HttpError).status || 400 }
        );
      }
    }

    // -------------------------------------------------------
    // 3. 캘린더 이벤트 조회
    // -------------------------------------------------------
    if (action === 'events') {
      const calendarId = body.calendarId || process.env.CALENDAR_ID?.trim();
      const accessToken = body.accessToken || process.env.GOOGLE_ACCESS_TOKEN?.trim();
      const refreshToken = body.refreshToken || process.env.GOOGLE_REFRESH_TOKEN?.trim();
      const clientId = body.clientId || process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = body.clientSecret || process.env.GOOGLE_CLIENT_SECRET?.trim();
      const { timeMin, timeMax } = body;

      if (!calendarId || !timeMin || !timeMax) {
        return NextResponse.json(
          { error: 'calendarId, timeMin, timeMax가 필요합니다.' },
          { status: 400 }
        );
      }

      let currentAccessToken = accessToken;

      // access_token이 없거나 만료되었을 때 자동 갱신 시도
      if (!currentAccessToken && refreshToken && clientId && clientSecret) {
        try {
          const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
          currentAccessToken = refreshed.access_token;
        } catch (refreshErr) {
          return NextResponse.json(
            { error: `토큰 갱신 실패: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`, needReauth: true },
            { status: (refreshErr as HttpError).status || 401 }
          );
        }
      }

      if (!currentAccessToken) {
        return NextResponse.json(
          { error: 'accessToken 또는 refreshToken이 필요합니다.', needReauth: true },
          { status: 401 }
        );
      }

      try {
        const data = await fetchCalendarEvents(currentAccessToken, calendarId, timeMin, timeMax);
        return NextResponse.json({
          items: data.items || [],
          newAccessToken: currentAccessToken !== accessToken ? currentAccessToken : null,
        });
      } catch (fetchErr) {
        const fetchMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        // 401인 경우 refresh 재시도
        if (((fetchErr as HttpError).status === 401 || fetchMessage.includes('401')) && refreshToken && clientId && clientSecret) {
          try {
            const refreshed = await refreshAccessToken(refreshToken, clientId, clientSecret);
            const retryData = await fetchCalendarEvents(refreshed.access_token, calendarId, timeMin, timeMax);
            return NextResponse.json({
              items: retryData.items || [],
              newAccessToken: refreshed.access_token,
            });
          } catch (retryErr) {
            return NextResponse.json(
              { error: `갱신 후 재시도 실패: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`, needReauth: true },
              { status: (retryErr as HttpError).status || 401 }
            );
          }
        }
        // 401이 아니면 그대로 에러를 던져서 외부 catch에서 처리하도록 함 (status 전파)
        throw fetchErr;
      }
    }

    return NextResponse.json(
      { error: `알 수 없는 action: ${action}. "exchange", "refresh", "events" 중 하나를 사용하세요.` },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Calendar Events API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: (error as HttpError).status || 500 }
    );
  }
}

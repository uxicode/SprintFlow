import { NextRequest, NextResponse } from 'next/server';

interface CalendarAuthRequestBody {
  clientId?: string;
  calendarId?: string;
}

/**
 * Google Calendar OAuth 2.0 인증 URL 생성 API
 * 
 * POST /api/calendar/auth
 * Body: { clientId, redirectUri? }
 * 
 * 클라이언트가 이 URL로 사용자를 리디렉트하면 Google 로그인 페이지가 표시됩니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CalendarAuthRequestBody;
    const clientId = body.clientId || process.env.GOOGLE_CLIENT_ID?.trim();
    const calendarId = body.calendarId || process.env.CALENDAR_ID?.trim();

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const redirectUri = `${new URL(request.url).origin}/api/calendar/callback`;

    // state 파라미터에 calendarId를 포함하여 콜백에서 복구
    const statePayload = JSON.stringify({ calendarId: calendarId || '' });
    const stateBase64 = Buffer.from(statePayload).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',       // refresh_token 발급을 위해
      prompt: 'consent',            // 매번 동의 화면을 표시하여 refresh_token 보장
      state: stateBase64,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ authUrl, redirectUri });
  } catch (error) {
    console.error('[Calendar Auth] Error:', error);
    return NextResponse.json(
      { error: `인증 URL 생성 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

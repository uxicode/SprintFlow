import type { AppConfig, LocalSettings, ResolvedSettings } from '../types';

/**
 * 서버 env 설정을 localStorage 설정보다 우선 적용합니다.
 * Jira 자격 증명이 env에 있으면 API 모드를 자동 활성화합니다.
 */
export function resolveAppSettings(
  local: LocalSettings,
  env: AppConfig | null | undefined,
): ResolvedSettings {
  const useEnvJira = env?.hasJiraCredentials;
  const useEnvCalendar = env?.hasCalendarCredentials;

  const url = (useEnvJira ? env.jiraUrl : local.url) || local.url || '';
  const email = (useEnvJira ? env.jiraEmail : local.email) || local.email || '';
  const token = (useEnvJira ? env.jiraToken : local.token) || local.token || '';
  const confluenceSpace =
    (useEnvJira ? env.confluenceSpace : local.confluenceSpace) || local.confluenceSpace || '';
  const confluenceParentId =
    (useEnvJira ? env.confluenceParentId : local.confluenceParentId) || local.confluenceParentId || '';

  // 배포 환경은 캘린더 값을 마스킹하므로, env가 있다고 판단되면 브라우저 저장값으로 덮지 않는다.
  // 실제 CALENDAR_ID/토큰은 /api/calendar/events가 서버 env로 채운다.
  const calendarId = useEnvCalendar ? (env?.calendarId || '') : (local.calendarId || '');
  const calendarClientId = useEnvCalendar ? (env?.googleClientId || '') : (local.calendarClientId || '');
  const calendarClientSecret = useEnvCalendar
    ? (env?.googleClientSecret || '')
    : (local.calendarClientSecret || '');
  const calendarRefreshToken = useEnvCalendar
    ? (env?.googleRefreshToken || '')
    : (local.calendarRefreshToken || '');
  const calendarAccessToken = useEnvCalendar
    ? (env?.googleAccessToken || '')
    : (local.calendarAccessToken || '');

  const hasJiraCredentials = !!useEnvJira || !!(url && email && token);
  const hasCalendarCredentials = !!useEnvCalendar || !!(
    calendarId &&
    calendarClientId &&
    calendarClientSecret &&
    (calendarAccessToken || calendarRefreshToken)
  );

  const projectKey = env?.projectKey || local.projectKey || 'DI26';
  const teamMembers = env?.teamMembers || local.teamMembers || '';
  const registeredMembers =
    env?.registeredMembers && env.registeredMembers.length > 0
      ? env.registeredMembers
      : local.registeredMembers || [];

  const apiMode = hasJiraCredentials && (useEnvJira || local.apiMode);

  return {
    url,
    email,
    token,
    confluenceSpace,
    confluenceParentId,
    calendarId,
    calendarClientId,
    calendarClientSecret,
    calendarAccessToken,
    calendarRefreshToken,
    projectKey,
    teamMembers,
    registeredMembers,
    apiMode,
    hasJiraCredentials,
    hasCalendarCredentials,
    fromEnv: !!(useEnvJira || useEnvCalendar),
  };
}

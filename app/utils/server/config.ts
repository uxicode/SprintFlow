import type { AppConfig, CronConfig } from '../../types';

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`필수 환경 변수 ${name}이(가) 설정되지 않았습니다.`);
  }
  return value.trim();
}

export function getAppConfig(): AppConfig {
  const isProd = process.env.NODE_ENV === 'production';

  const teamMembers = process.env.TEAM_MEMBERS?.trim() || '';
  const registeredMembers = parseList(process.env.REGISTERED_MEMBERS);
  const fallbackMembers = parseList(teamMembers);

  const jiraUrl = process.env.JIRA_URL?.trim() || '';
  const jiraEmail = process.env.JIRA_EMAIL?.trim() || '';
  const jiraToken = process.env.JIRA_API_TOKEN?.trim() || '';
  const calendarId = process.env.CALENDAR_ID?.trim() || '';
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim() || '';
  const googleAccessToken = process.env.GOOGLE_ACCESS_TOKEN?.trim() || '';

  const hasJiraCredentials = !!(jiraUrl && jiraEmail && jiraToken);
  const hasCalendarCredentials = !!(calendarId && googleClientId && googleClientSecret && googleRefreshToken);

  if (isProd) {
    // Vercel 웹 배포 (Production) 환경에서는 모든 환경 변수를 은닉/마스킹
    return {
      jiraUrl: '',
      jiraEmail: '',
      jiraToken: '',
      confluenceSpace: '',
      confluenceParentId: '',
      projectKey: process.env.PROJECT_KEY?.trim() || '',
      teamMembers: '',
      registeredMembers: [],
      calendarId: '',
      googleClientId: '',
      googleClientSecret: '',
      googleRefreshToken: '',
      googleAccessToken: '',
      hasJiraCredentials,
      hasCalendarCredentials,
    };
  }

  // 로컬 개발 (Development) 환경에서는 .env.local의 설정값을 그대로 연동 제공
  return {
    jiraUrl,
    jiraEmail,
    jiraToken,
    confluenceSpace: process.env.CONFLUENCE_SPACE?.trim() || '',
    confluenceParentId: process.env.CONFLUENCE_PARENT_ID?.trim() || '',
    projectKey: process.env.PROJECT_KEY?.trim() || '',
    teamMembers,
    registeredMembers: registeredMembers.length > 0 ? registeredMembers : fallbackMembers,
    calendarId,
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
    googleAccessToken,
    hasJiraCredentials,
    hasCalendarCredentials,
  };
}

export function getCronConfig(): CronConfig {
  const teamMembers = process.env.TEAM_MEMBERS?.trim() || '';
  const registeredMembers = parseList(process.env.REGISTERED_MEMBERS);
  const fallbackMembers = parseList(teamMembers);

  return {
    timezone: process.env.CRON_TIMEZONE?.trim() || 'Asia/Seoul',
    jiraUrl: requireEnv('JIRA_URL'),
    jiraEmail: requireEnv('JIRA_EMAIL'),
    jiraToken: requireEnv('JIRA_API_TOKEN'),
    confluenceSpace: requireEnv('CONFLUENCE_SPACE'),
    confluenceParentId: process.env.CONFLUENCE_PARENT_ID?.trim() || '',
    projectKey: process.env.PROJECT_KEY?.trim() || 'DI26',
    teamMembers,
    registeredMembers: registeredMembers.length > 0 ? registeredMembers : fallbackMembers,
    calendarId: process.env.CALENDAR_ID?.trim() || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
    googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN?.trim() || '',
    googleAccessToken: process.env.GOOGLE_ACCESS_TOKEN?.trim() || '',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL?.trim() || undefined,
  };
}

export function validateCronConfig(config: CronConfig): void {
  const missing: string[] = [];
  if (!config.jiraUrl) missing.push('JIRA_URL');
  if (!config.jiraEmail) missing.push('JIRA_EMAIL');
  if (!config.jiraToken) missing.push('JIRA_API_TOKEN');
  if (!config.confluenceSpace) missing.push('CONFLUENCE_SPACE');
  if (!config.teamMembers) missing.push('TEAM_MEMBERS');
  if (missing.length > 0) {
    throw new Error(`Cron 설정 누락: ${missing.join(', ')}`);
  }
}

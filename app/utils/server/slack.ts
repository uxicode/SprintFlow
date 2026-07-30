import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

function formatDateToKst(dateStr: string): string {
  if (!dateStr) return '';
  const d = dayjs(dateStr);
  if (!d.isValid()) return dateStr;
  return d.tz('Asia/Seoul').format('YYYY.MM.DD');
}

interface SlackNotificationParams {
  webhookUrl: string;
  reportTitle: string;
  confluenceUrl: string;
  stats: {
    currentTickets: number;
    nextTickets: number;
    calendarEvents: number;
    dateRange: { start: string; end: string };
  };
}

export async function sendSlackNotification({
  webhookUrl,
  reportTitle,
  confluenceUrl,
  stats,
}: SlackNotificationParams): Promise<boolean> {
  if (!webhookUrl) {
    return false;
  }

  const startDateFormatted = formatDateToKst(stats.dateRange.start);
  const endDateFormatted = formatDateToKst(stats.dateRange.end);

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📢 일일업무 보고서가 Confluence에 등록되었습니다',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*보고서 제목:*\n${reportTitle}`,
          },
          {
            type: 'mrkdwn',
            text: `*대상 기간:*\n${startDateFormatted} ~ ${endDateFormatted}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*이번주 티켓:*\n${stats.currentTickets}개`,
          },
          {
            type: 'mrkdwn',
            text: `*다음주 티켓:*\n${stats.nextTickets}개`,
          },
          // {
          //   type: 'mrkdwn',
          //   text: `*휴가/연차 일정:*\n${stats.calendarEvents}건`,
          // },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 Confluence 바로가기',
              emoji: true,
            },
            url: confluenceUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Slack] 알림 전송 실패:', response.status, response.statusText);
      return false;
    }

    console.log('[Slack] 일일업무 보고서 알림 전송 성공');
    return true;
  } catch (error) {
    console.error('[Slack] 알림 전송 에러:', error);
    return false;
  }
}

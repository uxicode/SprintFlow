'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { parseMarkdownToHtml } from '../utils/markdown';
import { buildWeeklyDownloadMarkdown } from '../utils/reportDownload';
import { applyWeeklyReportFilter } from '../utils/jira';
import { fetchScheduleBundle } from '../lib/jira-fetchers';
import { queryKeys } from '../lib/query-keys';
import { useDashboardData } from './use-dashboard-data';
import {
  useTypedFilterStore,
  useTypedReportStore,
  useTypedSettingsStore,
  useTypedUiStore,
} from './typed-stores';
import type { ActiveTab, EpicSortOrder, WeeklyReportTagFilters } from '../types';

interface ConfluencePublishRequestBody {
  type: string;
  title: string;
  space: { key: string };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  ancestors?: { id: string }[];
}

export function useReportActions() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const queryClient = useQueryClient();
  const activeTab = useTypedUiStore((s) => s.activeTab);
  const setActiveTab = useTypedUiStore((s) => s.setActiveTab);
  const dailyReportMd = useTypedReportStore((s) => s.dailyReportMd);
  const weeklyReportMd = useTypedReportStore((s) => s.weeklyReportMd);
  const vacationList = useTypedReportStore((s) => s.vacationList);
  const dateStart = useTypedFilterStore((s) => s.dateStart);
  const dateEnd = useTypedFilterStore((s) => s.dateEnd);
  const projectKey = useTypedFilterStore((s) => s.projectKey);
  const teamMembers = useTypedFilterStore((s) => s.teamMembers);
  const registeredMembers = useTypedSettingsStore((s) => s.registeredMembers);
  const url = useTypedSettingsStore((s) => s.url);
  const email = useTypedSettingsStore((s) => s.email);
  const token = useTypedSettingsStore((s) => s.token);
  const confluenceSpace = useTypedSettingsStore((s) => s.confluenceSpace);
  const confluenceParentId = useTypedSettingsStore((s) => s.confluenceParentId);
  const apiMode = useTypedSettingsStore((s) => s.apiMode);
  const { tickets, nextTickets } = useDashboardData();

  const handleTabChange = (tab: ActiveTab): void => {
    if (isDownloading) return;
    setActiveTab(tab);
  };

  const handleCopyReport = (
    searchKeyword?: string,
    tagFilters?: WeeklyReportTagFilters,
    epicSortOrder?: EpicSortOrder
  ): void => {
    if (isDownloading) return;
    let txt = '';
    if (activeTab === 'tab-daily') txt = dailyReportMd;
    else if (activeTab === 'tab-weekly') {
      txt = applyWeeklyReportFilter(weeklyReportMd, searchKeyword || '', tagFilters, epicSortOrder);
    } else {
      alert('복사할 마크다운 보고서 탭을 선택해 주세요.');
      return;
    }

    if (!txt) {
      alert('복사할 내용이 없습니다.');
      return;
    }

    navigator.clipboard.writeText(txt)
      .then(() => alert('마크다운 업무 보고서가 클립보드에 복사되었습니다.'))
      .catch(() => alert('클립보드 복사 중 에러가 발생했습니다.'));
  };

  const handleDownloadReport = async (
    searchKeyword?: string,
    tagFilters?: WeeklyReportTagFilters,
    epicSortOrder?: EpicSortOrder
  ): Promise<void> => {
    if (isDownloading) return;

    let txt = '';
    let name = '';
    if (activeTab === 'tab-daily') {
      txt = dailyReportMd;
      name = `Daily_Report_${dateStart}_to_${dateEnd}.md`;
    } else if (activeTab === 'tab-weekly') {
      setIsDownloading(true);
      try {
        let scheduleTickets: typeof tickets = [];
        try {
          const scheduleFilter = { projectKey, teamMembers };
          const scheduleBundle = await queryClient.fetchQuery({
            queryKey: queryKeys.schedule(scheduleFilter),
            queryFn: () => fetchScheduleBundle({
              apiMode,
              credentials: { url, email, token },
              filter: scheduleFilter,
            }),
            staleTime: 60_000,
          });
          scheduleTickets = scheduleBundle.tickets;
        } catch (err) {
          console.warn('일정 데이터 조회 실패, 주간 티켓 기준으로 진행률을 계산합니다.', err);
        }

        txt = buildWeeklyDownloadMarkdown({
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
        });
        name = `Weekly_Report_${dateStart}_to_${dateEnd}.md`;
      } finally {
        setIsDownloading(false);
      }
    } else {
      alert('다운로드할 보고서 탭을 선택해 주세요.');
      return;
    }

    if (!txt) {
      alert('다운로드할 내용이 없습니다.');
      return;
    }

    const blob = new Blob([txt], { type: 'text/markdown;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', name);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const handlePublishConfluence = async (
    searchKeyword?: string,
    tagFilters?: WeeklyReportTagFilters,
    epicSortOrder?: EpicSortOrder
  ): Promise<void> => {
    if (isDownloading) return;
    let reportText = '';
    let reportTitle = '';

    if (activeTab === 'tab-daily') {
      reportText = dailyReportMd;
      reportTitle = `📅 [일일업무] ${dayjs().format('YYYY.MM.DD')}`;
    } else if (activeTab === 'tab-weekly') {
      reportText = applyWeeklyReportFilter(weeklyReportMd, searchKeyword || '', tagFilters, epicSortOrder);
      reportTitle = `📊 [주간업무] ${dayjs(dateStart).format('YYYY.MM.DD')} ~ ${dayjs(dateEnd).format('YYYY.MM.DD')}`;
    } else {
      alert('컨플루언스에 등록할 보고서 탭(일일 혹은 주간)을 선택해 주세요.');
      return;
    }

    if (!reportText) {
      alert('등록할 보고서 내용이 없습니다. 먼저 티켓 가져오기를 수행해 주세요.');
      return;
    }

    if (!confluenceSpace.trim()) {
      alert('컨플루언스 등록을 위해 Space Key를 필터 설정창 옆 또는 설정 패널에 입력해 주세요.');
      return;
    }

    if (!apiMode) {
      setIsPublishing(true);
      setTimeout(() => {
        const fakeBase = url.trim() || 'https://ikoobdoc.atlassian.net';
        const fakeLink = `${fakeBase.replace(/\/$/, '')}/wiki/spaces/${confluenceSpace.toUpperCase()}/pages/${Math.floor(Math.random() * 90000000) + 10000000}`;
        alert(`[컨플루언스 등록 시뮬레이션 성공]\n\n등록 공간: ${confluenceSpace.toUpperCase()}\n문서 제목: ${reportTitle}\n\n등록된 임시 링크 (새 창에서 열기):\n${fakeLink}`);
        window.open(fakeLink, '_blank');
        setIsPublishing(false);
      }, 800);
      return;
    }

    setIsPublishing(true);
    const credential = btoa(`${email}:${token}`);
    let cleanUrl = url.trim();
    try {
      if (cleanUrl.toLowerCase().startsWith('http')) {
        const urlObj = new URL(cleanUrl);
        cleanUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
    } catch (err: unknown) {
      console.warn('Confluence Host 파싱 에러:', err);
    }

    const cleanedReportText = reportText.replace(/ \*\(에픽:.*?\)\*/g, '');
    const htmlContent = parseMarkdownToHtml(cleanedReportText);
    const targetUrl = `${cleanUrl.replace(/\/$/, '')}/wiki/rest/api/content`;
    const proxyEndpoint = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;

    const requestBody: ConfluencePublishRequestBody = {
      type: 'page',
      title: reportTitle,
      space: { key: confluenceSpace.toUpperCase() },
      body: {
        storage: {
          value: htmlContent,
          representation: 'storage',
        },
      },
    };

    if (confluenceParentId?.trim()) {
      requestBody.ancestors = [{ id: confluenceParentId.trim() }];
    }

    try {
      const response = await fetch(proxyEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credential}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Confluence API Error Response:', errText);
        throw new Error(`컨플루언스 서버 응답 에러 (코드: ${response.status})`);
      }

      const data = await response.json() as { _links?: { webui?: string } };
      const docLink = `${cleanUrl.replace(/\/$/, '')}/wiki${data._links?.webui || ''}`;
      alert(`[컨플루언스 등록 완료]\n\n문서가 성공적으로 발행되었습니다!\n\n확인 주소:\n${docLink}`);
      window.open(docLink, '_blank');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`[컨플루언스 등록 실패]\n\n오류: ${message}\n\nURL 설정이나 공간(Space) 권한이 올바른지 확인해 주세요.`);
    } finally {
      setIsPublishing(false);
    }
  };

  return {
    activeTab,
    handleTabChange,
    dailyReportMd,
    weeklyReportMd,
    tickets,
    parseMarkdownToHtml,
    handleCopyReport,
    handleDownloadReport,
    handlePublishConfluence,
    isPublishing,
    isDownloading,
  };
}

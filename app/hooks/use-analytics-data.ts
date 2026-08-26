'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsBundle } from '../lib/jira-fetchers';
import { queryKeys } from '../lib/query-keys';
import {
  getTypedFilterStore,
  useTypedFilterStore,
  useTypedSettingsStore,
  useTypedUiStore,
} from './typed-stores';
import type { Ticket } from '../types';

export function useAnalyticsData(): {
  analyticsTickets: Ticket[];
  isAnalyticsLoading: boolean;
  refetchAnalytics: (start?: string, end?: string) => ReturnType<ReturnType<typeof useQuery>['refetch']>;
} {
  const isConfigLoaded = useTypedUiStore((s) => s.isConfigLoaded);
  const isStatsJqlOpen = useTypedUiStore((s) => s.isStatsJqlOpen);
  const setConnectionStatus = useTypedUiStore((s) => s.setConnectionStatus);
  const apiMode = useTypedSettingsStore((s) => s.apiMode);
  const url = useTypedSettingsStore((s) => s.url);
  const email = useTypedSettingsStore((s) => s.email);
  const token = useTypedSettingsStore((s) => s.token);
  const analyticsProjectKey = useTypedFilterStore((s) => s.analyticsProjectKey);
  const analyticsTeamMembers = useTypedFilterStore((s) => s.analyticsTeamMembers);
  const analyticsDateStart = useTypedFilterStore((s) => s.analyticsDateStart);
  const analyticsDateEnd = useTypedFilterStore((s) => s.analyticsDateEnd);

  const filter = useMemo(() => ({
    analyticsProjectKey,
    analyticsTeamMembers,
    analyticsDateStart,
    analyticsDateEnd,
  }), [analyticsProjectKey, analyticsTeamMembers, analyticsDateStart, analyticsDateEnd]);

  const query = useQuery({
    queryKey: queryKeys.analytics(filter),
    queryFn: () => fetchAnalyticsBundle({
      apiMode,
      credentials: { url, email, token },
      filter,
    }),
    enabled: isConfigLoaded
      && isStatsJqlOpen
      && !!analyticsDateStart
      && !!analyticsDateEnd,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!query.data) return;
    setConnectionStatus({
      dot: 'success',
      text: `실적 분석 데이터 수집 완료 (${query.data.tickets.length}건, ${analyticsDateStart}~${analyticsDateEnd})`,
    });
  }, [query.data, analyticsDateStart, analyticsDateEnd, setConnectionStatus]);

  useEffect(() => {
    if (!query.error) return;
    console.error('실적 분석 지라 API 에러:', query.error);
    const message = query.error instanceof Error ? query.error.message : String(query.error);
    alert(`[실적 분석 지라 API 에러]\n\n오류 내용: ${message}`);
    setConnectionStatus({ dot: 'danger', text: `실적 분석 연동 실패 (${message})` });
  }, [query.error, setConnectionStatus]);

  const refetchAnalytics = (start?: string, end?: string) => {
    const filterStore = getTypedFilterStore();
    if (start) filterStore.setAnalyticsDateStart(start);
    if (end) filterStore.setAnalyticsDateEnd(end);
    return query.refetch();
  };

  return {
    analyticsTickets: query.data?.tickets ?? [],
    isAnalyticsLoading: query.isFetching,
    refetchAnalytics,
  };
}

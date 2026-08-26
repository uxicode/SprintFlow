'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchScheduleBundle } from '../lib/jira-fetchers';
import { queryKeys } from '../lib/query-keys';
import { buildEpicScheduleData, buildGanttData } from '../utils/schedule';
import {
  useTypedFilterStore,
  useTypedSettingsStore,
  useTypedUiStore,
} from './typed-stores';
import type { EpicSortOrder, GanttData } from '../types';

export function useScheduleData(sortOrder: EpicSortOrder = 'latest'): { ganttData: GanttData; isScheduleLoading: boolean } {
  const isConfigLoaded = useTypedUiStore((s) => s.isConfigLoaded);
  const activeTab = useTypedUiStore((s) => s.activeTab);
  const setConnectionStatus = useTypedUiStore((s) => s.setConnectionStatus);
  const apiMode = useTypedSettingsStore((s) => s.apiMode);
  const url = useTypedSettingsStore((s) => s.url);
  const email = useTypedSettingsStore((s) => s.email);
  const token = useTypedSettingsStore((s) => s.token);
  const projectKey = useTypedFilterStore((s) => s.projectKey);
  const teamMembers = useTypedFilterStore((s) => s.teamMembers);

  const filter = useMemo(() => ({ projectKey, teamMembers }), [projectKey, teamMembers]);

  const query = useQuery({
    queryKey: queryKeys.schedule(filter),
    queryFn: async () => {
      setConnectionStatus({ dot: 'success', text: '전체 일정 데이터 로드 중...' });
      const result = await fetchScheduleBundle({
        apiMode,
        credentials: { url, email, token },
        filter,
      });
      setConnectionStatus({
        dot: 'success',
        text: `전체 일정 데이터 수집 완료 (${result.tickets.length}건)`,
      });
      return result;
    },
    enabled: isConfigLoaded && activeTab === 'tab-schedule',
    staleTime: 60_000,
  });

  const ganttData = useMemo(() => {
    const scheduleTickets = query.data?.tickets ?? [];
    const epicScheduleData = buildEpicScheduleData(scheduleTickets, sortOrder);
    return buildGanttData(epicScheduleData);
  }, [query.data?.tickets, sortOrder]);

  return {
    ganttData,
    isScheduleLoading: query.isLoading,
  };
}

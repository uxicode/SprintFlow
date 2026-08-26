'use client';

import { useMemo } from 'react';
import { buildJql } from '../utils/jqlHelpers';
import { useDashboardData } from './use-dashboard-data';
import { useTypedFilterStore, useTypedUiStore } from './typed-stores';

export function useFilterActions() {
  const isFilterOpen = useTypedUiStore((s) => s.isFilterOpen);
  const setFilterOpen = useTypedUiStore((s) => s.setFilterOpen);
  const projectKey = useTypedFilterStore((s) => s.projectKey);
  const teamMembers = useTypedFilterStore((s) => s.teamMembers);
  const dateStart = useTypedFilterStore((s) => s.dateStart);
  const dateEnd = useTypedFilterStore((s) => s.dateEnd);
  const setProjectKey = useTypedFilterStore((s) => s.setProjectKey);
  const setTeamMembers = useTypedFilterStore((s) => s.setTeamMembers);
  const setDateStart = useTypedFilterStore((s) => s.setDateStart);
  const setDateEnd = useTypedFilterStore((s) => s.setDateEnd);
  const activeChipsList = useMemo(
    () => teamMembers.split(',').map((m: string) => m.trim()).filter(Boolean),
    [teamMembers],
  );
  const { isLoading, refetchDashboard } = useDashboardData();

  const getJql = (): string => buildJql(projectKey, teamMembers, dateStart, dateEnd);

  const handleFetchTickets = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    try {
      await refetchDashboard();
    } catch (err: unknown) {
      console.error('Jira API 연동 에러:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`[Jira API 연동 실패]\n\n오류 내용: ${message}\n\n입력하신 도메인, 이메일, 토큰 및 로컬 프록시가 작동 중인지 확인해 주세요.`);
    }
  };

  const handleCopyJql = (): void => {
    navigator.clipboard.writeText(getJql())
      .then(() => alert('JQL 쿼리가 클립보드에 복사되었습니다.'))
      .catch(() => alert('복사 실패'));
  };

  const handleToggleMemberChip = (member: string): void => {
    let list = teamMembers.split(',').map((m: string) => m.trim()).filter(Boolean);
    if (list.includes(member)) {
      list = list.filter((m: string) => m !== member);
    } else {
      list.push(member);
    }
    const finalVal = list.join(', ');
    setTeamMembers(finalVal);
    localStorage.setItem('workflow_filter_members', finalVal);
  };

  return {
    projectKey,
    setProjectKey,
    teamMembers,
    setTeamMembers,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    isFilterOpen,
    setFilterOpen,
    isLoading,
    activeChipsList,
    handleFetchTickets,
    handleToggleMemberChip,
    getJql,
    handleCopyJql,
  };
}

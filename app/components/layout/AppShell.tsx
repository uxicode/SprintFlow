'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import ChevronIcon from '../icons/ChevronIcon';
import AppSidebar from './AppSidebar';
import DashboardHeader from '../dashboard/DashboardHeader';
import FilterSection from '../dashboard/FilterSection';
import StatsSection from '../dashboard/StatsSection';
import ReportSection from '../dashboard/ReportSection';
import TodoCalendarPanel from '../todo/TodoCalendarPanel';
import DockBar from '../DockBar';
import LoginScreen from '../auth/LoginScreen';
import { useUiStore } from '../../stores/ui-store';

interface UiStoreSlice {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isTodoPanelOpen: boolean;
}

export default function AppShell() {
  const isSidebarOpen = useUiStore((s) => (s as UiStoreSlice).isSidebarOpen);
  const setSidebarOpen = useUiStore((s) => (s as UiStoreSlice).setSidebarOpen);
  const isTodoPanelOpen = useUiStore((s) => (s as UiStoreSlice).isTodoPanelOpen);

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setIsAuthenticated(!!data.authenticated);
    } catch (err) {
      console.error('인증 확인 오류:', err);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('로그아웃 오류:', err);
    } finally {
      setIsAuthenticated(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="hydration-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="login-loading-spinner" style={{ width: 32, height: 32, borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#00f2fe' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className={clsx('app-container', !isSidebarOpen && 'sidebar-collapsed')}>
      <button
        type="button"
        className="sidebar-reveal-btn"
        onClick={() => setSidebarOpen(true)}
        aria-label="사이드바 열기"
        title="사이드바 열기"
      >
        <ChevronIcon />
      </button>

      <AppSidebar onLogout={handleLogout} />

      <main className="main-content">
        <DockBar />
        <DashboardHeader />
        <FilterSection />
        <StatsSection />
        <ReportSection />
        {isTodoPanelOpen && <TodoCalendarPanel />}
      </main>
    </div>
  );
}

import ConnectionStatus from '../ConnectionStatus';
import { useUiStore } from '../../stores/ui-store';
import type { ConnectionStatus as ConnectionStatusType, DockState } from '../../types';

interface UiStoreSlice {
  connectionStatus: ConnectionStatusType;
  filterDock: DockState;
  statsDock: DockState;
  isTodoPanelOpen: boolean;
  toggleTodoPanel: () => void;
  dockAllSections: (position?: 'top' | 'left' | 'right') => void;
}

export default function DashboardHeader() {
  const connectionStatus = useUiStore((s) => (s as UiStoreSlice).connectionStatus);
  const filterDock = useUiStore((s) => (s as UiStoreSlice).filterDock);
  const statsDock = useUiStore((s) => (s as UiStoreSlice).statsDock);
  const isTodoPanelOpen = useUiStore((s) => (s as UiStoreSlice).isTodoPanelOpen);
  const toggleTodoPanel = useUiStore((s) => (s as UiStoreSlice).toggleTodoPanel);
  const dockAllSections = useUiStore((s) => (s as UiStoreSlice).dockAllSections);

  const isAllDocked = filterDock.isDocked && statsDock.isDocked;

  return (
    <header className="main-header">
      <div className="header-title">
        <h2>Dashboard</h2>
        <p>지라 티켓을 분석하고 간편하게 일일/주간 보고서를 생성하세요.</p>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className={`btn btn-sm ${isTodoPanelOpen ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleTodoPanel}
          title="Todo 및 일정 관리 패널을 보고서 옆에 6:4 나란히 표시합니다"
        >
          📝 Todo List {isTodoPanelOpen ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-fly-all"
          onClick={() => dockAllSections('top')}
          disabled={isAllDocked}
          title="필터 및 통계 섹션을 상단 보관함으로 숨깁니다"
        >
          🚀 한번에 날려버리기
        </button>
        <div className="quick-status">
          <ConnectionStatus dot={connectionStatus.dot} text={connectionStatus.text} />
        </div>
      </div>
    </header>
  );
}

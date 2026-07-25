import CollapsibleSection from '../CollapsibleSection';
import FormField from '../FormField';
import MemberChipList from '../MemberChipList';
import JqlPreview from '../JqlPreview';
import GenieDockWrapper from '../GenieDockWrapper';
import DateRangePicker from '../DateRangePicker';
import { useSettingsStore } from '../../stores/settings-store';
import { useFilterActions } from '../../hooks/use-filter-actions';

interface SettingsStoreSlice {
  registeredMembers: string[];
}

export default function FilterSection() {
  const registeredMembers = useSettingsStore((s) => (s as SettingsStoreSlice).registeredMembers);
  const {
    projectKey, setProjectKey,
    teamMembers, setTeamMembers,
    dateStart, setDateStart,
    dateEnd, setDateEnd,
    isFilterOpen, setFilterOpen,
    isLoading,
    activeChipsList,
    handleFetchTickets,
    handleToggleMemberChip,
    getJql,
    handleCopyJql,
  } = useFilterActions();

  return (
    <GenieDockWrapper sectionId="filter">
      <CollapsibleSection
        title="티켓 필터 조건 설정"
        isOpen={isFilterOpen}
        onToggle={() => setFilterOpen(!isFilterOpen)}
        sectionClassName="filter-section card"
        slideClassName="filter-slide-container"
        toggleClassName="btn-toggle-filter"
      >
        <form onSubmit={handleFetchTickets} className="filter-grid filter-grid--padded">
          <FormField
            variant="form"
            id="project-key"
            label="프로젝트 키"
            placeholder="예: PROJ, DEVEL"
            value={projectKey}
            onChange={(e) => {
              setProjectKey(e.target.value);
              localStorage.setItem('workflow_project_key', e.target.value.trim());
            }}
          />
          <FormField
            variant="form"
            id="team-members"
            label="대상 팀원 (이름/ID)"
            placeholder="쉼표(,)로 구분 (예: 김철수, 이영희)"
            value={teamMembers}
            groupClassName="team-input-group"
            onChange={(e) => {
              setTeamMembers(e.target.value);
              localStorage.setItem('workflow_filter_members', e.target.value);
            }}
          >
            <MemberChipList
              members={registeredMembers}
              activeMembers={activeChipsList}
              onToggle={handleToggleMemberChip}
            />
          </FormField>
          <DateRangePicker
            label="조회 기간 설정"
            dateStart={dateStart}
            dateEnd={dateEnd}
            onChange={(start, end) => {
              setDateStart(start);
              setDateEnd(end);
            }}
          />
          <div className="form-actions">
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isLoading ? '불러오는 중...' : '티켓 가져오기'}
            </button>
          </div>
        </form>
        <JqlPreview query={getJql()} onCopy={handleCopyJql} />
      </CollapsibleSection>
    </GenieDockWrapper>
  );
}

export interface EpicRef {
  key: string;
  summary: string;
}

export interface Ticket {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  updated: string;
  created: string;
  duedate: string;
  epic: EpicRef | null;
}

export type StatusCategory = 'Done' | 'In Progress' | 'To Do';

export interface CalendarDateField {
  date?: string;
  dateTime?: string;
}

export interface CalendarEvent {
  summary?: string;
  start?: CalendarDateField;
  end?: CalendarDateField;
}

export interface ConnectionStatus {
  dot: 'accent' | 'success' | 'danger';
  text: string;
}

export type CalendarAuthStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ActiveTab = 'tab-daily' | 'tab-weekly' | 'tab-raw' | 'tab-schedule';

export interface DashboardFilter {
  projectKey: string;
  teamMembers: string;
  dateStart: string;
  dateEnd: string;
}

export interface AnalyticsFilter {
  analyticsProjectKey: string;
  analyticsTeamMembers: string;
  analyticsDateStart: string;
  analyticsDateEnd: string;
}

export interface ScheduleFilter {
  projectKey: string;
  teamMembers: string;
}

export interface JiraCredentials {
  url: string;
  email: string;
  token: string;
}

export interface CalendarCredentials {
  calendarId: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
}

export interface LocalSettings {
  url: string;
  email: string;
  token: string;
  confluenceSpace: string;
  confluenceParentId: string;
  apiMode: boolean;
  calendarId: string;
  calendarClientId: string;
  calendarClientSecret: string;
  calendarAccessToken: string;
  calendarRefreshToken: string;
  projectKey: string;
  teamMembers: string;
  registeredMembers: string[];
}

export interface AppConfig {
  jiraUrl: string;
  jiraEmail: string;
  jiraToken: string;
  confluenceSpace: string;
  confluenceParentId: string;
  projectKey: string;
  teamMembers: string;
  registeredMembers: string[];
  calendarId: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  googleAccessToken: string;
  hasJiraCredentials: boolean;
  hasCalendarCredentials: boolean;
}

export interface ResolvedSettings {
  url: string;
  email: string;
  token: string;
  confluenceSpace: string;
  confluenceParentId: string;
  calendarId: string;
  calendarClientId: string;
  calendarClientSecret: string;
  calendarAccessToken: string;
  calendarRefreshToken: string;
  projectKey: string;
  teamMembers: string;
  registeredMembers: string[];
  apiMode: boolean;
  hasJiraCredentials: boolean;
  hasCalendarCredentials: boolean;
  fromEnv: boolean;
}

export interface GeneratedReports {
  dailyReportMd: string;
  weeklyReportMd: string;
}

export interface CalendarMeta {
  error?: string;
  needReauth?: boolean;
  newAccessToken?: string;
}

export interface DashboardBundle {
  tickets: Ticket[];
  nextTickets: Ticket[];
  calendarEvents: CalendarEvent[] | string[];
  calendarMeta: CalendarMeta | null;
  reports: GeneratedReports;
  statusText: string;
}

export interface AnalyticsBundle {
  tickets: Ticket[];
  jql: string;
}

export interface ScheduleBundle {
  tickets: Ticket[];
  jql: string;
}

export interface CategorizedTickets {
  BE: Ticket[];
  FE: Ticket[];
  MO: Ticket[];
  OTHER: Ticket[];
}

export interface EpicScheduleItem {
  key: string;
  summary: string;
  tickets: Ticket[];
  startDate: string;
  endDate: string;
  beProgress: number | null;
  feProgress: number | null;
  moProgress: number | null;
  beCount: number;
  feCount: number;
  moCount: number;
  beDoneCount: number;
  feDoneCount: number;
  moDoneCount: number;
  categorizedTickets: CategorizedTickets;
}

import type { Dayjs } from 'dayjs';

export interface GanttData {
  epics: EpicScheduleItem[];
  globalStart: Dayjs | null;
  globalEnd: Dayjs | null;
  totalDays: number;
  dateMarkers: string[];
}

export interface ProgressBadge {
  label: string;
  progress: number;
  doneCount: number;
  totalCount: number;
  variant: 'be' | 'fe' | 'mo' | 'other';
}

export interface VacationParseResult {
  isVacation: boolean;
  name: string;
  matchedWord: string;
}

export interface ReportParams {
  currList: Ticket[];
  nextList: Ticket[];
  start: string;
  end: string;
  proj: string;
  rawEvents: CalendarEvent[] | string[];
  targetRegs: string[];
  jiraUrl: string;
}

export interface CalendarFetchResult {
  items: CalendarEvent[];
  error: string | null;
  needReauth: boolean;
  newAccessToken: string | null;
}

export interface AssigneeMonthStats {
  assignee: string;
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  completionRate: number;
}

export interface AssigneeOverallStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  completionRate: number;
  avgCompletionTime: string | null;
}

export interface AssigneeSummaryRow extends AssigneeOverallStats {
  assignee: string;
}

export interface MonthlyPerformanceAnalysis {
  byMonth: Record<string, AssigneeMonthStats[]>;
  byAssignee: Record<string, AssigneeOverallStats>;
  summary: AssigneeSummaryRow[];
}

export interface TimeSeriesDataPoint {
  period: string;
  month: string;
  periodKey?: string;
  monthKey?: string;
  total: number;
  [key: string]: string | number | undefined;
}

export type TrendGranularity = 'day' | 'month';

export interface TrendTimeSeriesResult {
  granularity: TrendGranularity;
  data: TimeSeriesDataPoint[];
}

export type PredictionConfidence = 'high' | 'medium' | 'low';

export interface AssigneePrediction {
  predicted: number;
  confidence: PredictionConfidence;
}

export type AssigneePredictions = Record<string, AssigneePrediction>;

export type AnalyticsReportType = 'monthly' | 'yearly';

export interface EpicGroup {
  key: string;
  summary: string;
  tickets: Ticket[];
}

export interface FetchCalendarEventsParams {
  calId: string;
  start: string;
  end: string;
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

export interface CalendarApiErrorBody {
  error?: string;
  needReauth?: boolean;
}

export type ProgressCallback = (status: ConnectionStatus) => void;

export interface FetchDashboardBundleParams {
  apiMode: boolean;
  credentials: JiraCredentials;
  filter: DashboardFilter;
  calendar: CalendarCredentials;
  registeredMembers: string[];
  onProgress?: ProgressCallback;
}

export interface FetchAnalyticsBundleParams {
  apiMode: boolean;
  credentials: JiraCredentials;
  filter: AnalyticsFilter;
}

export interface FetchScheduleBundleParams {
  apiMode: boolean;
  credentials: JiraCredentials;
  filter: ScheduleFilter;
}

export interface ExchangeCalendarOAuthParams {
  code: string;
  clientId: string;
  clientSecret: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface PublishConfluenceParams {
  jiraUrl: string;
  email: string;
  token: string;
  spaceKey: string;
  parentId: string;
  title: string;
  markdown: string;
}

export interface PublishConfluenceResult {
  pageId: string;
  title: string;
  url: string;
}

export interface CronConfig {
  timezone: string;
  jiraUrl: string;
  jiraEmail: string;
  jiraToken: string;
  confluenceSpace: string;
  confluenceParentId: string;
  projectKey: string;
  teamMembers: string;
  registeredMembers: string[];
  calendarId: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  googleAccessToken: string;
  slackWebhookUrl?: string;
}

export interface ServerCalendarFetchParams {
  calendarId: string;
  start: string;
  end: string;
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

export interface ServerCalendarFetchResult {
  items: CalendarEvent[];
  skipped: boolean;
  error?: string;
  newAccessToken?: string | null;
}

export interface DailyReportJobResult {
  success: boolean;
  reportTitle: string;
  confluenceUrl: string;
  confluencePageId: string;
  slackNotified?: boolean;
  stats: {
    currentTickets: number;
    nextTickets: number;
    calendarEvents: number;
    calendarSkipped: boolean;
    dateRange: { start: string; end: string };
    timezone: string;
  };
}

export interface BuildWeeklyDownloadParams {
  weeklyReportMd: string;
  tickets: Ticket[];
  nextTickets: Ticket[];
  scheduleTickets?: Ticket[];
  vacationList: CalendarEvent[] | string[];
  dateStart: string;
  dateEnd: string;
  registeredMembers: string[];
  searchKeyword?: string;
}

export interface TicketFormatOptions {
  showStatus?: boolean;
  showUpdate?: boolean;
  showAssignee?: boolean;
  showEpic?: boolean;
  dateFormat?: 'MM/DD' | 'YYYY.MM.DD';
}

export interface TicketRenderGroupOptions {
  category: StatusCategory;
  title: string;
  emptyMessage: string;
  symbol?: string;
  bullet?: string;
  showStatus?: boolean;
  showUpdate?: boolean;
  showAssignee?: boolean;
  showEpic?: boolean;
  dateFormat?: 'MM/DD' | 'YYYY.MM.DD';
}

export interface JiraSearchIssueFields {
  summary?: string;
  status?: { name?: string };
  assignee?: { displayName?: string; name?: string };
  updated?: string;
  created?: string;
  duedate?: string;
  parent?: {
    key?: string;
    fields?: { summary?: string };
  };
}

export interface JiraSearchIssue {
  key?: string;
  fields?: JiraSearchIssueFields;
}

export interface JiraSearchResponse {
  issues?: JiraSearchIssue[];
  nextPageToken?: string;
}

export type DockDirection = 'top' | 'left' | 'right';

export interface DockState {
  isDocked: boolean;
  position: DockDirection | null;
  isAnimating: boolean;
}

export interface UiStoreSlice {
  mounted: boolean;
  isConfigLoaded: boolean;
  isSidebarOpen: boolean;
  isFilterOpen: boolean;
  isStatsJqlOpen: boolean;
  activeTab: ActiveTab;
  expandedEpics: Record<string, boolean>;
  connectionStatus: ConnectionStatus;
  filterDock: DockState;
  statsDock: DockState;
  setMounted: (mounted: boolean) => void;
  setConfigLoaded: (loaded: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setFilterOpen: (open: boolean) => void;
  setStatsJqlOpen: (open: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  toggleEpicCollapse: (epicKey: string) => void;
  setFilterDock: (dock: Partial<DockState>) => void;
  setStatsDock: (dock: Partial<DockState>) => void;
  undockSection: (section: 'filter' | 'stats') => void;
  dockAllSections: (position?: DockDirection) => void;
}

export interface SettingsStoreSlice {
  url: string;
  email: string;
  token: string;
  confluenceSpace: string;
  confluenceParentId: string;
  calendarId: string;
  calendarClientId: string;
  calendarClientSecret: string;
  calendarAccessToken: string;
  calendarRefreshToken: string;
  calendarAuthStatus: CalendarAuthStatus;
  calendarErrorMessage: string;
  apiMode: boolean;
  newMemberName: string;
  registeredMembers: string[];
  setUrl: (url: string) => void;
  setEmail: (email: string) => void;
  setToken: (token: string) => void;
  setConfluenceSpace: (space: string) => void;
  setConfluenceParentId: (id: string) => void;
  setCalendarId: (id: string) => void;
  setCalendarClientId: (id: string) => void;
  setCalendarClientSecret: (secret: string) => void;
  setCalendarAccessToken: (token: string) => void;
  setCalendarRefreshToken: (token: string) => void;
  setCalendarAuthStatus: (status: CalendarAuthStatus) => void;
  setCalendarErrorMessage: (message: string) => void;
  setApiMode: (enabled: boolean) => void;
  setNewMemberName: (name: string) => void;
  setRegisteredMembers: (members: string[]) => void;
  applyResolvedSettings: (resolved: ResolvedSettings) => void;
  getCredentials: () => JiraCredentials;
  getCalendarCredentials: () => CalendarCredentials;
  hasJiraCredentials: () => boolean;
}

export interface FilterStoreSlice {
  projectKey: string;
  teamMembers: string;
  dateStart: string;
  dateEnd: string;
  analyticsProjectKey: string;
  analyticsTeamMembers: string;
  analyticsDateStart: string;
  analyticsDateEnd: string;
  initDefaultDates: () => void;
  setProjectKey: (key: string) => void;
  setTeamMembers: (members: string) => void;
  setDateStart: (date: string) => void;
  setDateEnd: (date: string) => void;
  setAnalyticsProjectKey: (key: string) => void;
  setAnalyticsTeamMembers: (members: string) => void;
  setAnalyticsDateStart: (date: string) => void;
  setAnalyticsDateEnd: (date: string) => void;
  syncFromResolvedSettings: (settings: { projectKey: string; teamMembers: string }) => void;
  getDashboardFilter: () => DashboardFilter;
  getAnalyticsFilter: () => AnalyticsFilter;
  getScheduleFilter: () => ScheduleFilter;
  getActiveMemberChips: () => string[];
}

export interface ReportStoreSlice {
  dailyReportMd: string;
  weeklyReportMd: string;
  vacationList: CalendarEvent[] | string[];
  setReports: (reports: {
    dailyReportMd: string;
    weeklyReportMd: string;
    calendarEvents: CalendarEvent[] | string[];
  }) => void;
  resetReports: () => void;
}

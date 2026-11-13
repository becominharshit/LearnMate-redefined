import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  BookOpen,
  ListChecks,
  Target,
  Sparkles,
  ChevronDown,
  Search,
  BarChart3,
  LogIn,
  LogOut,
  GraduationCap,
  LayoutDashboard,
  Compass,
  Flame,
  Plus,
  Settings,
  UserRound,
  Sun,
  Moon,
  HelpCircle,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Calculator,
  Calendar,
  ShieldCheck,
  Menu,
  MoreHorizontal,
  BookMarked,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  StudyDocument,
  LearnMateNotification,
  StudentAcademicProfile,
  ThemeMode,
} from '../types/study';
import { EXAM_BLUEPRINTS } from '../utils/examSimulatorEngine';
import { getNextJeeCountdown } from '../utils/jeeCalendar';
import { CompactStudyUtilitiesWidget, type UtilityTab } from './CompactStudyUtilitiesWidget';
import type { AddMaterialMode } from './AddMaterialModal';

export type ActiveTab =
  | 'home'
  | 'dashboard'
  | 'study'
  | 'revision'
  | 'practice'
  | 'study-tools'
  | 'resources'
  | 'explore'
  | 'ai-tutor'
  | 'create'
  | 'pdf-workspace'
  | 'analytics';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasActiveDoc: boolean;
  activeDoc?: StudyDocument | null;
  onOpenAddMaterial?: (mode?: AddMaterialMode) => void;
  user?: User | null;
  isAuthReady?: boolean;
  isSyncing?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  documents?: StudyDocument[];
  onSelectDocumentFromSearch?: (doc: StudyDocument) => void;
  notifications?: LearnMateNotification[];
  onMarkNotificationsRead?: () => void;
  onOpenProfileModal?: () => void;
  studentProfile?: StudentAcademicProfile;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onOpenSearchModal?: () => void;
  onOpenAppGuideModal?: () => void;
  externalUtilityTab?: UtilityTab | null;
  onConsumeExternalUtilityTab?: () => void;
  onOpenVoiceTutor?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onPlotFormulaInStudyTools?: (expression: string, formulaTitle?: string) => void;
  onOpenStudyToolsWorkspace?: (
    subTab?: 'graph2d' | 'matrix' | 'surface3d' | 'geometry' | 'scientific'
  ) => void;
  onOpenMentorReportModal?: () => void;
  onOpenCommercialConsoleModal?: () => void;
}

type NavItem = {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DESKTOP_PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'revision', label: 'Revise', icon: ListChecks },
  { id: 'study-tools', label: 'Study Tools', icon: Calculator },
  { id: 'analytics', label: 'Progress', icon: BarChart3 },
];

const DESKTOP_SECONDARY_NAV: NavItem[] = [
  { id: 'resources', label: 'Resources', icon: Compass },
  { id: 'create', label: 'Creative Studio', icon: Sparkles },
];

const MOBILE_AND_TABLET_ALL_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'revision', label: 'Revise', icon: ListChecks },
  { id: 'study-tools', label: 'Tools', icon: Calculator },
  { id: 'analytics', label: 'Progress', icon: BarChart3 },
  { id: 'resources', label: 'Resources', icon: Compass },
  { id: 'create', label: 'Create', icon: Sparkles },
];

function isTabActive(item: ActiveTab, activeTab: ActiveTab): boolean {
  if (item === 'resources') {
    return activeTab === 'resources' || activeTab === 'explore';
  }
  if (item === 'create') {
    return activeTab === 'create';
  }
  return (
    activeTab === item ||
    (item === 'study' && (activeTab === 'pdf-workspace' || activeTab === 'ai-tutor')) ||
    (item === 'dashboard' && activeTab === 'home')
  );
}

const SECTION_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  home: { title: 'Dashboard', subtitle: 'Daily study overview & JEE preparation' },
  dashboard: { title: 'Dashboard', subtitle: 'Daily study overview & JEE preparation' },
  study: { title: 'Study Workbench', subtitle: 'Document reader, annotations & AI Tutor' },
  'ai-tutor': { title: 'Study Workbench', subtitle: 'Document reader, annotations & AI Tutor' },
  'pdf-workspace': { title: 'Study Workbench', subtitle: 'PDF Annotation Studio' },
  practice: { title: 'Practice Hub', subtitle: 'JEE Main, Advanced, BITSAT & VITEEE Practice & PYQ Catalog' },
  revision: { title: 'Revision Studio', subtitle: 'Handwritten notes, Formula Book & active recall' },
  'study-tools': { title: 'Study Tools Lab', subtitle: 'Desmos-grade 2D Graphing, Matrix, 3D Vector, Geometry & Scientific Suite' },
  analytics: { title: 'Progress & Mastery', subtitle: 'Accuracy trends & chapter mastery telemetry' },
  resources: { title: 'Official Resources', subtitle: 'NTA JEE syllabus & verified reference library' },
  explore: { title: 'Official Resources', subtitle: 'NTA JEE syllabus & verified reference library' },
  create: { title: 'Creative Studio', subtitle: 'Interactive visual diagrams & concept animations' },
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  activeDoc,
  onOpenAddMaterial,
  user,
  isAuthReady,
  isSyncing,
  onLogin,
  onLogout,
  documents = [],
  onSelectDocumentFromSearch,
  onOpenProfileModal,
  studentProfile,
  themeMode = 'light',
  onToggleTheme,
  onOpenSearchModal,
  onOpenAppGuideModal,
  externalUtilityTab,
  onConsumeExternalUtilityTab,
  onOpenVoiceTutor,
  sidebarCollapsed = false,
  onToggleSidebar,
  onPlotFormulaInStudyTools,
  onOpenStudyToolsWorkspace,
  onOpenMentorReportModal,
  onOpenCommercialConsoleModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [headerOverflowOpen, setHeaderOverflowOpen] = useState(false);
  const [localUtilityTab, setLocalUtilityTab] = useState<UtilityTab | null>(null);

  const isDark = themeMode === 'dark';
  const profileRef = useRef<HTMLDivElement>(null);
  const headerOverflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (headerOverflowRef.current && !headerOverflowRef.current.contains(e.target as Node)) {
        setHeaderOverflowOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setHeaderOverflowOpen(false);
        setMobileDrawerOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileDrawerOpen(false);
        setHeaderOverflowOpen(false);
        onOpenSearchModal?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenSearchModal]);

  const countdown = useMemo(
    () => getNextJeeCountdown(new Date(), studentProfile?.targetExam || 'jee_main'),
    [studentProfile?.targetExam]
  );

  const filteredDocs = searchQuery.trim()
    ? documents.filter(
        (d) =>
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.pages.some((p) => p.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const targetExamShort =
    studentProfile?.targetExam && EXAM_BLUEPRINTS[studentProfile.targetExam]
      ? EXAM_BLUEPRINTS[studentProfile.targetExam].shortName
      : 'JEE Main';
  const classLabel = studentProfile?.schoolClass || '';
  const targetExamLabel = `${targetExamShort}${
    studentProfile?.targetExamYear ? ` ${studentProfile.targetExamYear}` : ''
  }`;
  const profileSubtitle = classLabel ? `${classLabel} · ${targetExamLabel}` : targetExamLabel;
  const displayName = user?.displayName || studentProfile?.fullName || 'Student';
  const avatarInitial = displayName[0]?.toUpperCase() || 'S';

  const go = (tab: ActiveTab) => {
    onSelectTab(tab);
    setProfileOpen(false);
    setHeaderOverflowOpen(false);
    setMobileDrawerOpen(false);
  };

  const menuItemClass =
    'w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-soft flex items-center gap-3 cursor-pointer transition-colors';

  const activeMeta = SECTION_TITLES[activeTab] || SECTION_TITLES.dashboard;

  return (
    <>
      {/* =====================================================================
          LEFT COLLAPSIBLE DESKTOP SIDEBAR (lg and above)
         ===================================================================== */}
      <aside
        aria-label="Desktop Workspace Navigation"
        data-testid="desktop-left-sidebar"
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-white dark:bg-[#0B1020] border-r border-line transition-[width] duration-200 lm-no-print ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Top Brand + Collapse Button */}
        <div
          className={`h-16 px-4 border-b border-line flex items-center ${
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          } gap-2 shrink-0`}
        >
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            data-testid="navbar-brand-btn"
            className="flex items-center gap-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand rounded-xl min-w-0"
            aria-label="LearnMate home"
          >
            <span className="w-9 h-9 rounded-xl bg-brand text-white grid place-items-center shadow-xs shrink-0">
              <GraduationCap className="w-5 h-5" />
            </span>
            {!sidebarCollapsed && (
              <span className="flex items-center gap-2 truncate">
                <span className="font-display font-extrabold text-lg tracking-tight text-ink">
                  LearnMate
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-brand-soft text-brand text-[10px] font-bold tracking-wider">
                  JEE
                </span>
              </span>
            )}
          </button>

          {!sidebarCollapsed && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              data-testid="sidebar-collapse-toggle-btn"
              aria-label="Collapse sidebar"
              title="Collapse desktop sidebar"
              className="p-2 rounded-xl text-muted hover:text-ink hover:bg-soft transition-colors cursor-pointer shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Desktop Navigation Links */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          <nav aria-label="Main navigation" className="space-y-1.5">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                Workspaces
              </div>
            )}
            {DESKTOP_PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const active = isTabActive(item.id, activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  data-testid={`nav-tab-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3.5 py-2.5'
                  } rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-soft text-brand border border-brand/20'
                      : 'text-muted hover:text-ink hover:bg-soft'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Secondary Studio & Reference Links */}
          <div className="pt-4 border-t border-line space-y-1.5">
            {!sidebarCollapsed && (
              <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                Reference &amp; Studio
              </div>
            )}
            {DESKTOP_SECONDARY_NAV.map((item) => {
              const Icon = item.icon;
              const active = isTabActive(item.id, activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  data-testid={`nav-tab-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3.5 py-2.5'
                  } rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-soft text-brand border border-brand/20'
                      : 'text-muted hover:text-ink hover:bg-soft'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer: Active Exam Target & Expand Button when collapsed */}
        <div className="p-3 border-t border-line space-y-2">
          {!sidebarCollapsed && countdown && (
            <div className="px-3 py-2.5 rounded-xl bg-canvas border border-line flex items-center gap-2.5 text-xs">
              <Flame className="w-4 h-4 text-warning shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-ink truncate">{targetExamLabel}</div>
                <div className="text-[11px] text-muted truncate">
                  {countdown.inProgress
                    ? `${countdown.label} is live`
                    : `${countdown.daysLeft} days remaining`}
                </div>
              </div>
            </div>
          )}

          {sidebarCollapsed && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              data-testid="sidebar-expand-toggle-btn"
              aria-label="Expand sidebar"
              title="Expand desktop sidebar"
              className="w-full py-2.5 rounded-xl text-muted hover:text-ink hover:bg-soft flex items-center justify-center transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* =====================================================================
          CLEAN WIDESCREEN TOP HEADER BAR (5 Approved Utility Controls)
         ===================================================================== */}
      <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-[#0B1020]/95 backdrop-blur-xl border-b border-line lm-no-print">
        <div className="max-w-[1920px] w-full mx-auto px-3 sm:px-6 lg:px-6 xl:px-10 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left Context: Hamburger (<lg) + Mobile Brand + Desktop Section Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              data-testid="mobile-hamburger-btn"
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Mobile Brand */}
            <button
              type="button"
              onClick={() => onSelectTab('dashboard')}
              className="lg:hidden flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer"
              aria-label="LearnMate home"
            >
              <span className="w-8 h-8 rounded-xl bg-brand text-white grid place-items-center shadow-xs shrink-0">
                <GraduationCap className="w-4 h-4" />
              </span>
              <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-ink">
                LearnMate
              </span>
            </button>

            {/* Desktop Workspace Title & Active Document Context */}
            <div className="hidden lg:flex items-center gap-2.5 min-w-0 overflow-hidden">
              <span className="font-display text-base font-bold text-ink whitespace-nowrap shrink-0">
                {activeMeta.title}
              </span>
              {activeDoc ? (
                <>
                  <span className="text-line-strong shrink-0">/</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-canvas border border-line text-xs font-medium text-body truncate max-w-[160px] xl:max-w-[220px]">
                    <FileText className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span className="truncate">{activeDoc.title.replace(/\.pdf$/i, '')}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-line-strong shrink-0">·</span>
                  <span className="text-xs text-muted truncate">{activeMeta.subtitle}</span>
                </>
              )}
            </div>
          </div>

          {/* Right Global Utilities (Fits cleanly at 1280px+ with zero clipping) */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 1. + Add Material Button */}
            {onOpenAddMaterial && (
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                data-testid="navbar-add-material-btn"
                aria-label="Add Material"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 sm:px-3 xl:px-3.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Add Material</span>
              </button>
            )}

            {/* 2. AI Voice Tutor Button */}
            {onOpenVoiceTutor && (
              <button
                type="button"
                onClick={onOpenVoiceTutor}
                data-testid="navbar-voice-tutor-btn"
                className="inline-flex items-center gap-1.5 p-2 sm:px-3 xl:px-3.5 sm:py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                title="Open AI Voice Tutor"
              >
                <Mic className="w-4 h-4 text-brand shrink-0" />
                <span className="hidden sm:inline">Voice Tutor</span>
              </button>
            )}

            {/* 3. Global Search (inline >=xl / 1280px, in More menu <xl) */}
            {onOpenSearchModal && (
              <button
                type="button"
                onClick={onOpenSearchModal}
                data-testid="navbar-search-btn"
                aria-label="Search (Ctrl+K)"
                title="Search chapters, notes, PYQs, materials & tools (Ctrl+K)"
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-canvas hover:bg-soft text-muted hover:text-ink text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4 shrink-0" />
                <span>
                  Search<span className="hidden 2xl:inline"> (Ctrl+K)</span>
                </span>
              </button>
            )}

            {/* 4. Unified Formula Book Button (inline >=xl / 1280px; drawer remains mounted on all viewports) */}
            <CompactStudyUtilitiesWidget
              activeDocument={activeDoc}
              externalOpenTab={localUtilityTab ?? externalUtilityTab}
              onConsumeExternalOpen={() => {
                setLocalUtilityTab(null);
                onConsumeExternalUtilityTab?.();
              }}
              onPlotFormulaInStudyTools={onPlotFormulaInStudyTools}
              onOpenStudyToolsWorkspace={onOpenStudyToolsWorkspace}
              triggerClassName="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            />

            {/* <xl Overflow Menu for Search & Formula Book */}
            <div ref={headerOverflowRef} className="relative xl:hidden">
              <button
                type="button"
                onClick={() => setHeaderOverflowOpen((prev) => !prev)}
                data-testid="navbar-more-menu-btn"
                aria-label="More study utilities"
                className="inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-ink text-xs font-semibold cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4 text-muted" />
                <span className="hidden md:inline">More</span>
              </button>
              {headerOverflowOpen && (
                <div
                  data-testid="navbar-more-dropdown"
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#121A2E] border border-line shadow-xl py-1.5 z-50"
                >
                  {onOpenSearchModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderOverflowOpen(false);
                        onOpenSearchModal();
                      }}
                      className={menuItemClass}
                    >
                      <Search className="w-4 h-4 text-muted" />
                      <span>Search (Ctrl+K)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderOverflowOpen(false);
                      setLocalUtilityTab('formulas');
                    }}
                    className={menuItemClass}
                  >
                    <BookMarked className="w-4 h-4 text-brand" />
                    <span>Formula Book</span>
                  </button>
                </div>
              )}
            </div>

            {isAuthReady && !user && onLogin && (
              <button
                type="button"
                onClick={onLogin}
                data-testid="navbar-signin-direct-btn"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl lm-btn-accent text-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
            )}

            {/* 5. Profile Avatar Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                data-testid="navbar-profile-btn"
                aria-label="Open profile menu"
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full bg-white dark:bg-[#121A2E] hover:bg-soft border border-line transition-colors cursor-pointer"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
                    {avatarInitial}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              </button>

              {profileOpen && (
                <div
                  data-testid="profile-dropdown-menu"
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-24px)] bg-white dark:bg-[#121A2E] rounded-2xl shadow-xl border border-line py-1.5 z-50"
                >
                  <div className="px-4 py-3 border-b border-line">
                    <div className="text-sm font-bold text-ink truncate">{displayName}</div>
                    <div className="text-xs text-muted truncate">
                      {isSyncing ? 'Syncing your progress…' : profileSubtitle}
                    </div>
                  </div>

                  {countdown && (
                    <div className="px-4 py-2 border-b border-line flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-warning-soft/60">
                      <Flame className="w-3.5 h-3.5 text-warning shrink-0" />
                      <span>
                        {countdown.inProgress
                          ? `${countdown.label} is live`
                          : `${countdown.daysLeft} days until ${countdown.label}`}
                      </span>
                    </div>
                  )}

                  {documents.length > 0 && (
                    <div className="px-3 py-2 border-b border-line">
                      <label className="flex items-center gap-2 bg-soft rounded-xl px-3 py-2">
                        <Search className="w-4 h-4 text-muted shrink-0" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search your materials…"
                          className="bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none w-full"
                        />
                      </label>
                      {filteredDocs.length > 0 && (
                        <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-line bg-white dark:bg-[#0B1020] divide-y divide-line">
                          {filteredDocs.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => {
                                onSelectDocumentFromSearch?.(doc);
                                setProfileOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-soft truncate cursor-pointer"
                            >
                              {doc.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => go('analytics')}
                    className={`${menuItemClass} lg:hidden`}
                  >
                    <BarChart3 className="w-4 h-4 text-muted" />
                    Progress
                  </button>

                  <button
                    type="button"
                    onClick={() => go('study-tools')}
                    data-testid="open-study-tools-menu-btn"
                    className={menuItemClass}
                  >
                    <Calculator className="w-4 h-4 text-brand" />
                    Study Tools Lab (Desmos Suite)
                  </button>

                  {onOpenMentorReportModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMentorReportModal();
                        setProfileOpen(false);
                      }}
                      data-testid="open-mentor-report-menu-btn"
                      className={menuItemClass}
                    >
                      <Calendar className="w-4 h-4 text-brand" />
                      Weekly Mentor &amp; Parent Report
                    </button>
                  )}

                  {onOpenCommercialConsoleModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenCommercialConsoleModal();
                        setProfileOpen(false);
                      }}
                      data-testid="open-commercial-console-menu-btn"
                      className={menuItemClass}
                    >
                      <ShieldCheck className="w-4 h-4 text-brand" />
                      Plans, Quotas &amp; System Health
                    </button>
                  )}

                  {onOpenProfileModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfileModal();
                        setProfileOpen(false);
                      }}
                      data-testid="open-academic-profile-menu-btn"
                      className={menuItemClass}
                    >
                      <UserRound className="w-4 h-4 text-muted" />
                      Profile
                    </button>
                  )}

                  {onOpenProfileModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenProfileModal();
                        setProfileOpen(false);
                      }}
                      data-testid="open-settings-menu-btn"
                      className={menuItemClass}
                    >
                      <Settings className="w-4 h-4 text-muted" />
                      Settings
                    </button>
                  )}

                  {onOpenAppGuideModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAppGuideModal();
                        setProfileOpen(false);
                      }}
                      data-testid="open-app-guide-menu-btn"
                      className={menuItemClass}
                    >
                      <HelpCircle className="w-4 h-4 text-muted" />
                      App Guide
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => go('resources')}
                    data-testid="open-resources-menu-btn"
                    className={menuItemClass}
                  >
                    <Compass className="w-4 h-4 text-muted" />
                    Resources (Study)
                  </button>

                  <button
                    type="button"
                    onClick={() => go('create')}
                    data-testid="open-create-menu-btn"
                    className={menuItemClass}
                  >
                    <Sparkles className="w-4 h-4 text-muted" />
                    Create (Study)
                  </button>

                  {onToggleTheme && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleTheme();
                        setProfileOpen(false);
                      }}
                      data-testid="profile-theme-toggle-btn"
                      className={menuItemClass}
                    >
                      {isDark ? (
                        <>
                          <Sun className="w-4 h-4 text-amber-400" />
                          <span className="flex-1 text-left">Switch to Light mode</span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                            Night Owl On
                          </span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-indigo-600" />
                          <span className="flex-1 text-left">Night Owl mode</span>
                          <span className="px-2 py-0.5 rounded-md bg-soft text-muted text-[10px] font-bold">
                            Off
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {isAuthReady && (
                    <div className="border-t border-line mt-1 pt-1">
                      {user ? (
                        <button
                          type="button"
                          onClick={() => {
                            onLogout?.();
                            setProfileOpen(false);
                          }}
                          data-testid="profile-signout-btn"
                          className={`${menuItemClass} text-danger`}
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onLogin?.();
                            setProfileOpen(false);
                          }}
                          className={`${menuItemClass} font-semibold text-brand`}
                        >
                          <LogIn className="w-4 h-4" />
                          Sign in with Google
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Slide-Over Hamburger Drawer (<lg) */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex lm-no-print"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileDrawerOpen(false);
          }}
        >
          <aside
            data-testid="mobile-nav-drawer"
            aria-label="Mobile Navigation Drawer"
            className="w-72 max-w-[85vw] h-full bg-white dark:bg-[#0B1020] border-r border-line shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 h-16 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-brand text-white grid place-items-center">
                  <GraduationCap className="w-4 h-4" />
                </span>
                <span className="font-display font-extrabold text-base text-ink">LearnMate JEE</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-xl text-muted hover:text-ink hover:bg-soft cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-5">
              <nav className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Workspaces
                </div>
                {[...DESKTOP_PRIMARY_NAV, ...DESKTOP_SECONDARY_NAV].map((item) => {
                  const Icon = item.icon;
                  const active = isTabActive(item.id, activeTab);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer ${
                        active
                          ? 'bg-brand-soft text-brand border border-brand/20'
                          : 'text-ink hover:bg-soft'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-line space-y-1">
                <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Utilities
                </div>
                {onOpenSearchModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenSearchModal();
                    }}
                    className={menuItemClass}
                  >
                    <Search className="w-4 h-4 text-muted" />
                    <span>Search (Ctrl+K)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setLocalUtilityTab('formulas');
                  }}
                  className={menuItemClass}
                >
                  <BookMarked className="w-4 h-4 text-brand" />
                  <span>Formula Book</span>
                </button>
                {onOpenMentorReportModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenMentorReportModal();
                    }}
                    className={menuItemClass}
                  >
                    <Calendar className="w-4 h-4 text-brand" />
                    <span>Weekly Report</span>
                  </button>
                )}
                {onOpenCommercialConsoleModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenCommercialConsoleModal();
                    }}
                    className={menuItemClass}
                  >
                    <ShieldCheck className="w-4 h-4 text-brand" />
                    <span>Plans &amp; Quota</span>
                  </button>
                )}
                {onOpenProfileModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenProfileModal();
                    }}
                    className={menuItemClass}
                  >
                    <UserRound className="w-4 h-4 text-muted" />
                    <span>Profile &amp; Settings</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Non-collapsible Tablet & Android/Mobile navigation dock exposing all 8 destinations directly */}
      <nav
        aria-label="Mobile and tablet navigation"
        data-testid="mobile-tablet-bottom-nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0B1020]/95 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)] lm-no-print"
      >
        <div className="flex md:grid md:grid-cols-8 items-stretch overflow-x-auto md:overflow-visible no-scrollbar snap-x px-1 md:px-2">
          {MOBILE_AND_TABLET_ALL_NAV.map((item) => {
            const Icon = item.icon;
            const active = isTabActive(item.id, activeTab);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setMobileDrawerOpen(false);
                  onSelectTab(item.id);
                }}
                data-testid={`mobile-nav-tab-${item.id}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 min-w-[68px] md:min-w-0 shrink-0 min-h-[52px] px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer snap-start ${
                  active ? 'text-brand' : 'text-muted hover:text-ink'
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" aria-hidden="true" />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

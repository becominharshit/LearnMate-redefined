import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  BookOpen,
  ListChecks,
  Target,
  Sparkles,
  Bell,
  ChevronDown,
  Search,
  BarChart3,
  LogIn,
  LogOut,
  Clock,
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
} from 'lucide-react';
import { User } from 'firebase/auth';
import { StudyDocument, LearnMateNotification, StudentAcademicProfile, ThemeMode } from '../types/study';
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
}

type NavItem = {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DESKTOP_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'revision', label: 'Revise', icon: ListChecks },
  { id: 'analytics', label: 'Progress', icon: BarChart3 },
];

const MOBILE_PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'practice', label: 'Practice', icon: Target },
  { id: 'revision', label: 'Revise', icon: ListChecks },
];

function isTabActive(item: ActiveTab, activeTab: ActiveTab): boolean {
  return (
    activeTab === item ||
    (item === 'study' &&
      (activeTab === 'pdf-workspace' ||
        activeTab === 'ai-tutor' ||
        activeTab === 'resources' ||
        activeTab === 'explore' ||
        activeTab === 'create')) ||
    (item === 'dashboard' && activeTab === 'home')
  );
}

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
  notifications = [],
  onMarkNotificationsRead,
  onOpenProfileModal,
  studentProfile,
  themeMode = 'light',
  onToggleTheme,
  onOpenSearchModal,
  onOpenAppGuideModal,
  externalUtilityTab,
  onConsumeExternalUtilityTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isDark = themeMode === 'dark';

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
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

  const countdown = useMemo(() => getNextJeeCountdown(), []);
  const unreadCount = notifications.filter((n) => !n.read).length;

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
  };

  const menuItemClass =
    'w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-soft flex items-center gap-3 cursor-pointer transition-colors';

  const meActive = profileOpen || activeTab === 'analytics';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0B1020]/95 backdrop-blur-xl border-b border-line lm-no-print">
        <div className="max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 h-15 flex items-center gap-2">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            data-testid="navbar-brand-btn"
            className="flex items-center gap-2 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand rounded-xl"
            aria-label="LearnMate home"
          >
            <span className="w-8 h-8 rounded-xl bg-brand text-white grid place-items-center shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="font-display font-extrabold text-base tracking-tight text-ink">
                LearnMate
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-brand-soft text-brand text-[10px] font-bold tracking-wider">
                JEE
              </span>
            </span>
          </button>

          {/* Desktop 5 Primary Destinations: Home · Study · Practice · Revise · Progress */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1 ml-2">
            {DESKTOP_NAV.map((item) => {
              const Icon = item.icon;
              const active = isTabActive(item.id, activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  data-testid={`nav-tab-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-soft text-brand border border-brand/20'
                      : 'text-muted hover:text-ink hover:bg-soft'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Global Utilities: + Add Material · Search (Ctrl+K) · Study Tools · Focus 25:00 · Theme · Notifications · Help (?) · Profile */}
          <div className="ml-auto flex items-center gap-1.5">
            {onOpenAddMaterial && (
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                data-testid="navbar-add-material-btn"
                aria-label="Add Material"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Add<span className="hidden sm:inline"> Material</span>
                </span>
              </button>
            )}

            {/* Global Search (Ctrl+K) */}
            {onOpenSearchModal && (
              <button
                type="button"
                onClick={onOpenSearchModal}
                data-testid="navbar-search-btn"
                aria-label="Search (Ctrl+K)"
                title="Search chapters, notes, PYQs, materials & tools (Ctrl+K)"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-muted hover:text-ink text-xs font-medium transition-colors cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">Search (Ctrl+K)</span>
              </button>
            )}

            {/* Study Tools & Docked 25:00 Focus Timer */}
            <CompactStudyUtilitiesWidget
              activeDocument={activeDoc}
              externalOpenTab={externalUtilityTab}
              onConsumeExternalOpen={onConsumeExternalUtilityTab}
            />

            {/* Light / Night Owl Theme Toggle */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                data-testid="navbar-theme-toggle-btn"
                aria-label={isDark ? 'Switch to Light mode' : 'Switch to Night Owl mode'}
                title={isDark ? 'Switch to Light mode' : 'Switch to Night Owl mode'}
                className="w-8 h-8 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600" />
                )}
              </button>
            )}

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  if (!notifOpen && unreadCount > 0) onMarkNotificationsRead?.();
                }}
                aria-label="Notifications"
                data-testid="navbar-notifications-btn"
                className="relative w-8 h-8 rounded-xl hover:bg-soft border border-line bg-white dark:bg-[#121A2E] flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-24px)] bg-white dark:bg-[#121A2E] rounded-2xl shadow-xl border border-line overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-line">
                    <span className="font-display text-sm font-bold text-ink">Notifications</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-line">
                    {notifications.length > 0 ? (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.actionTab) onSelectTab(item.actionTab as ActiveTab);
                            setNotifOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-soft transition-colors flex items-start gap-3 cursor-pointer"
                        >
                          <span className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink">{item.title}</span>
                            <span className="block text-xs text-muted leading-snug mt-0.5">
                              {item.message}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-6 text-sm text-muted text-center">You&apos;re all caught up.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* App Guide / Help (?) Button */}
            {onOpenAppGuideModal && (
              <button
                type="button"
                onClick={onOpenAppGuideModal}
                data-testid="navbar-app-guide-btn"
                aria-label="Open App Guide"
                title="App Guide & Feature Directory"
                className="w-8 h-8 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

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

            {/* Profile Avatar Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                data-testid="navbar-profile-btn"
                aria-label="Open profile menu"
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-white dark:bg-[#121A2E] hover:bg-soft border border-line transition-colors cursor-pointer"
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
                <ChevronDown className="w-3 h-3 text-muted" />
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

                  <button
                    type="button"
                    onClick={() => go('analytics')}
                    className={`${menuItemClass} lg:hidden`}
                  >
                    <BarChart3 className="w-4 h-4 text-muted" />
                    Progress
                  </button>

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

      {/* Mobile bottom tab bar: Home · Study · Practice · Revise · Me */}
      <nav
        aria-label="Main navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0B1020]/95 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)] lm-no-print"
      >
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = !profileOpen && isTabActive(item.id, activeTab);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onSelectTab(item.id);
                }}
                data-testid={`mobile-nav-tab-${item.id}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  active ? 'text-brand' : 'text-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" aria-hidden="true" />
                )}
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            data-testid="mobile-nav-tab-me"
            aria-expanded={profileOpen}
            className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
              meActive ? 'text-brand' : 'text-muted'
            }`}
          >
            {meActive && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" aria-hidden="true" />
            )}
            <UserRound className="w-5 h-5" />
            Me
          </button>
        </div>
      </nav>
    </>
  );
};

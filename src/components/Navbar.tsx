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
} from 'lucide-react';
import { User } from 'firebase/auth';
import { StudyDocument, LearnMateNotification, StudentAcademicProfile, ThemeMode } from '../types/study';
import { EXAM_BLUEPRINTS } from '../utils/examSimulatorEngine';
import { getNextJeeCountdown } from '../utils/jeeCalendar';
import { CompactStudyUtilitiesWidget } from './CompactStudyUtilitiesWidget';
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
    (item === 'study' && (activeTab === 'pdf-workspace' || activeTab === 'ai-tutor')) ||
    (item === 'dashboard' && activeTab === 'home') ||
    (item === 'resources' && activeTab === 'explore')
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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

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

  const meActive =
    profileOpen ||
    activeTab === 'resources' ||
    activeTab === 'explore' ||
    activeTab === 'create' ||
    activeTab === 'analytics';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#0B1020]/90 backdrop-blur-xl border-b border-line lm-no-print">
        <div className="max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center gap-2 sm:gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            data-testid="navbar-brand-btn"
            className="flex items-center gap-2 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand rounded-xl"
            aria-label="LearnMate home"
          >
            <span className="w-9 h-9 rounded-xl bg-linear-to-br from-brand to-violet-500 text-white grid place-items-center shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="font-display font-extrabold text-lg tracking-tight text-ink">
                LearnMate
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-brand-soft text-brand text-[10px] font-bold tracking-wider">
                JEE
              </span>
            </span>
          </button>

          {/* Desktop navigation: Home · Study · Practice · Revise · Progress */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1 ml-3">
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
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink hover:bg-soft'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Persistent "+ Add material" button on every page */}
            {onOpenAddMaterial && (
              <button
                type="button"
                onClick={() => onOpenAddMaterial('pdf')}
                data-testid="navbar-add-material-btn"
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full lm-btn-accent text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add material</span>
              </button>
            )}

            {/* Exam countdown pill (xl screens) */}
            {countdown && (
              <div
                className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning-soft border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-800 dark:text-amber-300"
                title={`${countdown.label} starts ${countdown.startDate}`}
              >
                <Flame className="w-3.5 h-3.5 text-warning shrink-0" />
                <span className="whitespace-nowrap">
                  {countdown.inProgress
                    ? `${countdown.label} is on`
                    : `${countdown.daysLeft}d to ${countdown.label}`}
                </span>
              </div>
            )}

            {/* Light / Night Owl Mode Toggle */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                data-testid="navbar-theme-toggle-btn"
                aria-label={isDark ? 'Switch to Light mode' : 'Switch to Night Owl mode'}
                title={isDark ? 'Switch to Light mode' : 'Switch to Night Owl mode'}
                className="h-9 px-2.5 sm:px-3 rounded-full border border-line bg-white dark:bg-[#121A2E] hover:bg-soft flex items-center gap-1.5 text-muted hover:text-ink transition-colors cursor-pointer"
              >
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="hidden xl:inline text-xs font-semibold text-ink">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="hidden xl:inline text-xs font-semibold text-ink">Night Owl</span>
                  </>
                )}
              </button>
            )}

            <CompactStudyUtilitiesWidget activeDocument={activeDoc} />

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
                className="relative w-9 h-9 rounded-full hover:bg-soft border border-line bg-white dark:bg-[#121A2E] flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
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

            {isAuthReady && !user && onLogin && (
              <button
                type="button"
                onClick={onLogin}
                data-testid="navbar-signin-direct-btn"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full lm-btn-accent text-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
            )}

            {/* Profile menu: Profile · Settings · Resources · Create · Sign out */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                data-testid="navbar-profile-btn"
                aria-label="Open profile menu"
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white dark:bg-[#121A2E] hover:bg-soft border border-line transition-colors cursor-pointer"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
                    {avatarInitial}
                  </span>
                )}
                <span className="hidden md:inline text-xs font-semibold text-ink max-w-[140px] truncate">
                  {profileSubtitle}
                </span>
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
                    <div className="xl:hidden px-4 py-2 border-b border-line flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-warning-soft/60">
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

                  {/* Mobile quick link to Progress (since mobile bottom bar has 5 items: Home, Study, Practice, Revise, Me) */}
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

                  <button
                    type="button"
                    onClick={() => go('resources')}
                    data-testid="open-resources-menu-btn"
                    className={menuItemClass}
                  >
                    <Compass className="w-4 h-4 text-muted" />
                    Resources
                  </button>

                  <button
                    type="button"
                    onClick={() => go('create')}
                    data-testid="open-create-menu-btn"
                    className={menuItemClass}
                  >
                    <Sparkles className="w-4 h-4 text-muted" />
                    Create
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

          {/* 5th phone tab: Me */}
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

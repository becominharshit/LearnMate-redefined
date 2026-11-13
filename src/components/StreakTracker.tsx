import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, CheckCircle2, Calendar, Sparkles, TrendingUp } from 'lucide-react';
import {
  computeStudyActivityStreakSummary,
  getStudyActivityDatesFromLocalStorage,
  recordDailyStudyCheckIn,
  STUDY_ACTIVITY_CHECKIN_STORAGE_KEY,
} from '../utils/jeeSubjects';

export interface StreakTrackerProps {
  /** Optional supplemental activity dates from in-memory state */
  supplementalDates?: Date[];
  /** Optional callback fired when the student logs today's study check-in */
  onStreakUpdated?: (currentStreak: number) => void;
}

export const StreakTracker: React.FC<StreakTrackerProps> = ({
  supplementalDates = [],
  onStreakUpdated,
}) => {
  const [storageRevision, setStorageRevision] = useState(0);
  const [justCheckedIn, setJustCheckedIn] = useState(false);

  // Sync if localStorage changes in another tab or elsewhere in the app
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === STUDY_ACTIVITY_CHECKIN_STORAGE_KEY ||
        event.key.startsWith('learnmate_')
      ) {
        setStorageRevision((prev) => prev + 1);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const summary = useMemo(() => {
    void storageRevision;
    const fromStorage = getStudyActivityDatesFromLocalStorage();
    const combined = [...fromStorage, ...supplementalDates];
    return computeStudyActivityStreakSummary(combined, new Date(), 14);
  }, [supplementalDates, storageRevision]);

  const handleCheckInToday = useCallback(() => {
    recordDailyStudyCheckIn(new Date());
    setJustCheckedIn(true);
    setStorageRevision((prev) => prev + 1);
    const updatedDates = [
      ...getStudyActivityDatesFromLocalStorage(),
      ...supplementalDates,
    ];
    const nextSummary = computeStudyActivityStreakSummary(updatedDates, new Date(), 14);
    onStreakUpdated?.(nextSummary.currentStreak);
  }, [onStreakUpdated, supplementalDates]);

  const streakHeadline =
    summary.currentStreak === 0
      ? 'Start your JEE consistency streak today'
      : summary.currentStreak === 1
      ? '1 consecutive day of JEE prep'
      : `${summary.currentStreak} consecutive days of JEE prep`;

  return (
    <section
      data-testid="streak-tracker-card"
      aria-label="Study Streak Tracker"
      className="bg-white dark:bg-[#121A2E] rounded-2xl border border-line p-4 sm:p-5 shadow-xs transition-colors"
    >
      <div className="flex flex-col gap-3.5">
        {/* Left: Streak identity & metrics */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors ${
              summary.currentStreak > 0
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'bg-soft border-line text-muted'
            }`}
          >
            <Flame
              className={`w-6 h-6 ${
                summary.currentStreak > 0
                  ? 'text-amber-500 dark:text-amber-400 fill-amber-500/20'
                  : 'text-muted'
              }`}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                Streak Tracker
              </span>
              {summary.isTodayActive ? (
                <span
                  data-testid="streak-status-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                >
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  Today Logged
                </span>
              ) : summary.isStreakAtRiskToday ? (
                <span
                  data-testid="streak-status-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                >
                  Keep Streak Alive Today
                </span>
              ) : (
                <span
                  data-testid="streak-status-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-soft text-muted border border-line"
                >
                  Awaiting Today&apos;s Session
                </span>
              )}
            </div>

            <h2
              data-testid="streak-headline"
              className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-snug"
            >
              {streakHeadline}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                Best streak:{' '}
                <strong
                  data-testid="streak-longest-count"
                  className="font-bold text-ink tabular-nums"
                >
                  {summary.longestStreak} {summary.longestStreak === 1 ? 'day' : 'days'}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                Total active:{' '}
                <strong
                  data-testid="streak-total-days"
                  className="font-bold text-ink tabular-nums"
                >
                  {summary.totalActiveDays} {summary.totalActiveDays === 1 ? 'day' : 'days'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom action strip: Current streak counter + daily check-in button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-line">
          <div className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-soft border border-line shrink-0">
            <span
              data-testid="streak-current-count"
              className="text-2xl font-extrabold text-ink tabular-nums"
            >
              {summary.currentStreak}
            </span>
            <span className="text-xs font-semibold text-muted whitespace-nowrap">
              {summary.currentStreak === 1 ? 'day streak' : 'days streak'}
            </span>
          </div>

          {!summary.isTodayActive ? (
            <button
              type="button"
              data-testid="streak-checkin-btn"
              onClick={handleCheckInToday}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-brand hover:bg-brand-strong text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Log Today&apos;s Study
            </button>
          ) : (
            <div
              data-testid="streak-checkedin-pill"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {justCheckedIn ? 'Streak Updated!' : 'Active Today'}
            </div>
          )}
        </div>
      </div>

      {/* 14-Day Consecutive Activity Timeline */}
      <div className="mt-4 pt-3.5 border-t border-line">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-muted">
            Last 14 Days Activity (Stored locally on this device)
          </span>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              Current Streak
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-brand/75 inline-block" />
              Studied
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-soft border border-line inline-block" />
              Rest Day
            </span>
          </div>
        </div>

        <div
          data-testid="streak-days-grid"
          className="grid grid-cols-7 gap-1.5"
        >
          {summary.days.map((day) => {
            const cellStyle = day.inCurrentStreak
              ? 'bg-amber-500/18 dark:bg-amber-500/22 border-amber-500/50 text-amber-900 dark:text-amber-200'
              : day.isActive
              ? 'bg-brand-soft border-brand/40 text-brand dark:text-indigo-200'
              : 'bg-soft/70 dark:bg-[#1A2440]/70 border-line text-muted';

            return (
              <div
                key={day.dayKey}
                data-testid={`streak-day-${day.dayKey}`}
                data-active={day.isActive ? 'true' : 'false'}
                data-in-streak={day.inCurrentStreak ? 'true' : 'false'}
                title={`${day.shortWeekday}, ${day.monthShort} ${day.dayOfMonth}: ${
                  day.isActive
                    ? `${day.activityCount} study ${day.activityCount === 1 ? 'activity' : 'activities'}`
                    : 'No recorded activity'
                }`}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-all ${cellStyle} ${
                  day.isToday ? 'ring-2 ring-brand ring-offset-1 ring-offset-transparent' : ''
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-tight opacity-80">
                  {day.isToday ? 'Today' : day.shortWeekday}
                </span>
                <span className="text-xs font-extrabold tabular-nums mt-0.5">
                  {day.dayOfMonth}
                </span>
                <span
                  className={`mt-1 w-2 h-2 rounded-full ${
                    day.inCurrentStreak
                      ? 'bg-amber-500 dark:bg-amber-400'
                      : day.isActive
                      ? 'bg-brand'
                      : 'bg-line-strong/50'
                  }`}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/** Official JEE Main 2027 & Target Exam Windows. */
export const JEE_MAIN_EXAM_WINDOWS = [
  { id: 'jee-main-2027-s1', label: 'JEE Main Session 1', start: '2027-01-20', end: '2027-01-28' },
  { id: 'jee-main-2027-s2', label: 'JEE Main Session 2', start: '2027-04-02', end: '2027-04-07' },
] as const;

export const EXAM_CALENDAR_WINDOWS: Record<
  string,
  ReadonlyArray<{ id: string; label: string; start: string; end: string }>
> = {
  jee_main: JEE_MAIN_EXAM_WINDOWS,
  jee_advanced: [
    { id: 'jee-adv-2027', label: 'JEE Advanced 2027', start: '2027-05-23', end: '2027-05-23' },
  ],
  bitsat: [
    { id: 'bitsat-2027-s1', label: 'BITSAT Session 1', start: '2027-05-26', end: '2027-05-30' },
    { id: 'bitsat-2027-s2', label: 'BITSAT Session 2', start: '2027-06-23', end: '2027-06-27' },
  ],
  viteee: [
    { id: 'viteee-2027', label: 'VITEEE 2027 Window', start: '2027-04-20', end: '2027-04-30' },
  ],
};

/** Key JEE Main 2027 dates from the NTA Information Bulletin (24 Oct 2026). */
export const JEE_MAIN_2027_KEY_DATES = [
  { label: 'Session 1 registration closes', date: '2026-11-22', note: 'Late fee window until 26 Nov' },
  { label: 'Application correction window', date: '2026-11-27', note: '27 to 29 Nov' },
  { label: 'City intimation slip', date: '2026-12-30' },
  { label: 'Admit card download', date: '2027-01-13' },
  { label: 'Session 1 exams', date: '2027-01-20', note: '20 to 24 and 28 Jan' },
  { label: 'Session 2 exams', date: '2027-04-02', note: '2 to 7 Apr' },
] as const;

export interface JeeCountdown {
  label: string;
  startDate: string;
  daysLeft: number;
  inProgress: boolean;
}

function localDate(isoDay: string): Date {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Days until the next session of the selected exam track, counted on the student's local calendar. */
export function getNextJeeCountdown(
  now: Date = new Date(),
  targetExam: string = 'jee_main'
): JeeCountdown | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windows = EXAM_CALENDAR_WINDOWS[targetExam] || JEE_MAIN_EXAM_WINDOWS;
  for (const window of windows) {
    const start = localDate(window.start);
    const end = localDate(window.end);
    if (today <= end) {
      return {
        label: window.label,
        startDate: window.start,
        daysLeft: Math.max(0, Math.round((start.getTime() - today.getTime()) / 86_400_000)),
        inProgress: today >= start,
      };
    }
  }
  return null;
}

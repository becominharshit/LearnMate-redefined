import React, { useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  Share2,
  X,
  Check,
  Award,
  BookOpen,
  Target,
  Clock,
} from 'lucide-react';
import type {
  StudyDocument,
  QuizAttempt,
  StudentAcademicProfile,
} from '../types/study';
import { studyStorage } from '../services/storageService';
import { EXAM_BLUEPRINTS } from '../utils/examSimulatorEngine';

interface WeeklyMentorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
  studentProfile: StudentAcademicProfile;
  documents: StudyDocument[];
  attempts?: QuizAttempt[];
}

export const WeeklyMentorReportModal: React.FC<WeeklyMentorReportModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentProfile,
  documents = [],
  attempts,
}) => {
  const [shareCopied, setShareCopied] = useState(false);

  const safeAttempts = useMemo(
    () => (Array.isArray(attempts) ? attempts : studyStorage.getQuizAttempts() || []),
    [attempts, isOpen]
  );

  const reportMetrics = useMemo(() => {
    const focusSessions = studyStorage.getFocusSessions?.() || [];
    const totalMinutes = focusSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(1));
    const avgScorePct =
      safeAttempts.length > 0
        ? Math.round(
            safeAttempts.reduce(
              (acc, a) =>
                acc +
                (typeof (a as any).percentage === 'number'
                  ? (a as any).percentage
                  : Math.round((a.score / Math.max(1, a.totalQuestions)) * 100)),
              0
            ) / safeAttempts.length
          )
        : null;

    const weakTopicCounts = new Map<string, number>();
    const strongTopicCounts = new Map<string, number>();
    for (const att of safeAttempts) {
      for (const w of att.weakTopics || []) {
        weakTopicCounts.set(w, (weakTopicCounts.get(w) || 0) + 1);
      }
      for (const s of (att as any).strongTopics || []) {
        strongTopicCounts.set(s, (strongTopicCounts.get(s) || 0) + 1);
      }
    }

    const topWeak = Array.from(weakTopicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const topStrong = Array.from(strongTopicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const handwrittenCount =
      (studyStorage as any).getHandwrittenNotes?.()?.length ?? documents.length;
    const stickyNotesCount =
      studyStorage.getNotebookEntries?.()?.length ?? 0;

    return {
      totalHours,
      avgScorePct,
      topWeak,
      topStrong,
      handwrittenCount,
      stickyNotesCount,
    };
  }, [safeAttempts, documents.length]);

  if (!isOpen) return null;

  const displayStudentName =
    studentName || studentProfile?.fullName || 'Scholar';
  const examName =
    (studentProfile?.targetExam && EXAM_BLUEPRINTS[studentProfile.targetExam]?.shortName) ||
    'JEE Main';

  const handleShareMentorReport = async () => {
    try {
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: displayStudentName,
          kind: 'handwritten_note',
          title: `Weekly Mentor & Parent Progress Report — ${displayStudentName}`,
          subtitle: `${examName} ${studentProfile.targetExamYear || '2027'} Preparation Summary`,
          payload: {
            studentName: displayStudentName,
            examName,
            attemptsCount: safeAttempts.length,
            avgScorePct: reportMetrics.avgScorePct,
            documentsCount: documents.length,
            topWeak: reportMetrics.topWeak,
            topStrong: reportMetrics.topStrong,
          },
        }),
      });
      const data = await res.json();
      if (data.shareUrl && typeof window !== 'undefined') {
        await navigator.clipboard?.writeText(`${window.location.origin}${data.shareUrl}`).catch(() => {});
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3500);
      }
    } catch {
      // ignore offline
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-950/60 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="weekly-mentor-report-modal"
        aria-label="Weekly Mentor and Parent Progress Report"
        className="w-full max-w-4xl rounded-2xl bg-white dark:bg-[#111827] border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4 lm-no-print">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Weekly Mentor, Parent &amp; Teacher Progress Report
              </h2>
              <p className="text-xs text-muted">
                Private diagnostic summary · Ready to print, save as PDF, or share with your mentor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareMentorReport}
              data-testid="share-mentor-report-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
            >
              {shareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Report Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-brand" />
                  <span>Copy Mentor Share Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              data-testid="print-mentor-report-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Mentor Report"
              className="p-2 rounded-xl border border-line text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Report Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Student Academic Identity Banner */}
          <div className="p-5 rounded-2xl bg-canvas border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted">
                LearnMate Official Academic Telemetry · Strictly Private to Student &amp; Mentor
              </div>
              <h3 className="font-display text-xl font-bold text-ink">
                {displayStudentName} · {examName}{' '}
                {studentProfile.targetExamYear || '2027'} Track
              </h3>
              <div className="text-xs text-muted">
                Class: {studentProfile.schoolClass || 'Class 12 / Dropper'} · Preferred Language:{' '}
                {studentProfile.preferredLanguage || 'English'}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums text-xs text-muted">
              <div>Generated: {new Date().toLocaleDateString()}</div>
              <div>Privacy Mode: Individual Student Only</div>
            </div>
          </div>

          {/* 4-Column Quantitative KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#161F33] border border-line space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Target className="w-3.5 h-3.5 text-brand" />
                <span>Mock &amp; Quiz Accuracy</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-ink">
                {reportMetrics.avgScorePct !== null ? `${reportMetrics.avgScorePct}%` : '0%'}
              </div>
              <div className="text-[11px] text-muted tabular-nums">
                Across {safeAttempts.length} completed sets
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#161F33] border border-line space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                <span>Uploaded Materials</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-ink">
                {documents.length}
              </div>
              <div className="text-[11px] text-muted tabular-nums">
                {reportMetrics.handwrittenCount} Handwritten · {reportMetrics.stickyNotesCount} Sticky Notes
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#161F33] border border-line space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Logged Study Time</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-ink">
                {reportMetrics.totalHours}h
              </div>
              <div className="text-[11px] text-muted">Deep focus sessions</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#161F33] border border-line space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Target Daily Goal</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-ink">
                {Math.max(1, Math.round((studentProfile.dailyStudyMinutesGoal || 240) / 60))}h / day
              </div>
              <div className="text-[11px] text-muted">{examName} Target</div>
            </div>
          </div>

          {/* Strengths vs Priority Remediation Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-canvas border border-line space-y-3">
              <h4 className="font-display text-sm font-bold text-ink">
                Verified Strong Chapters &amp; Concepts
              </h4>
              {reportMetrics.topStrong.length === 0 ? (
                <p className="text-xs text-muted">
                  Complete your first chapter quiz or PYQ mock test to populate verified strong concepts.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs text-ink">
                  {reportMetrics.topStrong.map((topic) => (
                    <li key={topic} className="flex items-center justify-between">
                      <span>{topic}</span>
                      <span className="text-emerald-600 font-semibold">High Mastery</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 rounded-xl bg-canvas border border-line space-y-3">
              <h4 className="font-display text-sm font-bold text-ink">
                Priority Mentor Remediation Queue
              </h4>
              {reportMetrics.topWeak.length === 0 && (studentProfile.weakAreas?.length || 0) === 0 ? (
                <p className="text-xs text-muted">
                  No recurring weak topics flagged yet. Mistakes from Practice sets will appear here automatically.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs text-ink">
                  {[...reportMetrics.topWeak, ...(studentProfile.weakAreas || [])]
                    .slice(0, 5)
                    .map((topic, idx) => (
                      <li key={`${topic}-${idx}`} className="flex items-center justify-between">
                        <span>{topic}</span>
                        <span className="text-amber-600 font-semibold">Needs PYQ Drill</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

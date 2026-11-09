import React, { useMemo, useState } from 'react';
import {
  Atom,
  FlaskConical,
  Sigma,
  BookOpen,
  FileText,
  Zap,
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  JEE_SYLLABUS_CHAPTERS,
  SYLLABUS_VERSIONS,
  getSyllabusCoverageReport,
  buildStudyDocumentFromSyllabusChapter,
  type SyllabusChapterRecord,
  type ExamTrackId,
} from '../data/jeeSyllabusAndNotes';
import { filterPyqQuestions } from '../utils/pyqCorpusEngine';
import type { JeeSubject } from '../utils/jeeSubjects';
import type { StudyDocument } from '../types/study';
import { MathText } from './MathText';
import { awardLearningXp } from '../utils/rewardsEngine';

interface SyllabusAndNotesWorkspaceProps {
  initialMode: 'syllabus' | 'notes';
  onOpenChapterInWorkbench: (doc: StudyDocument) => void;
  onOpenChapterPractice: (chapterId: string) => void;
  onOpenChapterRevise: (doc: StudyDocument) => void;
  onOpenChapterCreate: (chapter: SyllabusChapterRecord) => void;
}

const SUBJECT_BADGE: Record<
  JeeSubject,
  { icon: React.ComponentType<{ className?: string }>; soft: string; text: string }
> = {
  Physics: { icon: Atom, soft: 'bg-physics-soft', text: 'text-physics' },
  Chemistry: { icon: FlaskConical, soft: 'bg-chemistry-soft', text: 'text-chemistry' },
  Mathematics: { icon: Sigma, soft: 'bg-maths-soft', text: 'text-maths' },
};

export const SyllabusAndNotesWorkspace: React.FC<SyllabusAndNotesWorkspaceProps> = ({
  initialMode,
  onOpenChapterInWorkbench,
  onOpenChapterPractice,
  onOpenChapterRevise,
  onOpenChapterCreate,
}) => {
  const [examTrack, setExamTrack] = useState<ExamTrackId>('jee_main');
  const [subjectFilter, setSubjectFilter] = useState<'All' | JeeSubject>('All');
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    JEE_SYLLABUS_CHAPTERS[0].id
  );
  const [noteFormat, setNoteFormat] = useState<'full' | 'quick'>('full');
  const [revealedCheckpoints, setRevealedCheckpoints] = useState<Record<string, boolean>>({});
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>({});

  const coverage = useMemo(() => getSyllabusCoverageReport(), []);
  const syllabusMeta = SYLLABUS_VERSIONS[examTrack];

  const filteredChapters = useMemo(
    () =>
      JEE_SYLLABUS_CHAPTERS.filter(
        (ch) =>
          ch.supportedExams.includes(examTrack) &&
          (subjectFilter === 'All' || ch.subject === subjectFilter)
      ),
    [examTrack, subjectFilter]
  );

  const activeChapter =
    filteredChapters.find((c) => c.id === selectedChapterId) ||
    filteredChapters[0] ||
    JEE_SYLLABUS_CHAPTERS[0];

  const relatedPyqs = useMemo(
    () => filterPyqQuestions({ chapterId: activeChapter.id }),
    [activeChapter.id]
  );

  const handleMarkChapterGoalCompleted = (chapter: SyllabusChapterRecord) => {
    setCompletedChapters((prev) => ({ ...prev, [chapter.id]: true }));
    awardLearningXp({
      eventId: `chapter-goal:${chapter.id}`,
      category: 'chapter_notes_completed',
      title: `Completed Chapter Notes Study: ${chapter.title}`,
      xpAwarded: 45,
    });
  };

  return (
    <div className="space-y-5" data-testid="syllabus-and-notes-workspace">
      {/* Top Bar: JEE Main vs Advanced Syllabus Provenance & Subject Filter */}
      <div className="lm-card-editorial p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-bold">
                {initialMode === 'syllabus' ? 'Official Syllabus Catalog' : 'Authoritative Chapter Notes'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success-soft text-success text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {coverage.publishedChapters}/{coverage.totalChapters} Chapters Published &amp; Reviewed
              </span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-ink">
              {syllabusMeta.versionLabel}
            </h2>
            <p className="text-xs text-muted">
              {syllabusMeta.statusNote} ·{' '}
              <a
                href={syllabusMeta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>{syllabusMeta.officialBody}</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              (Retrieved {syllabusMeta.retrievedAt})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Exam Switcher: JEE Main | JEE Advanced */}
            <div className="inline-flex rounded-xl border border-line bg-canvas p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setExamTrack('jee_main')}
                data-testid="syllabus-exam-main-btn"
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  examTrack === 'jee_main' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                JEE Main
              </button>
              <button
                type="button"
                onClick={() => setExamTrack('jee_advanced')}
                data-testid="syllabus-exam-advanced-btn"
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  examTrack === 'jee_advanced' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                JEE Advanced
              </button>
            </div>

            {/* Full Notes | Quick Notes Switcher */}
            <div className="inline-flex rounded-xl border border-line bg-canvas p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setNoteFormat('full')}
                data-testid="notes-format-full-btn"
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  noteFormat === 'full' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                Full Notes
              </button>
              <button
                type="button"
                onClick={() => setNoteFormat('quick')}
                data-testid="notes-format-quick-btn"
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  noteFormat === 'quick' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                Quick Notes
              </button>
            </div>
          </div>
        </div>

        {/* Subject filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line">
          {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setSubjectFilter(subj)}
              data-testid={`syllabus-subject-tab-${subj.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                subjectFilter === subj
                  ? 'bg-brand-soft text-brand border border-brand/25'
                  : 'bg-canvas text-muted hover:text-ink border border-line'
              }`}
            >
              {subj}
              {subj !== 'All' && ` (${coverage.bySubject[subj].published})`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Grid: Left Chapter Directory (4 cols) + Right Chapter Notes & PYQs (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Chapter Selector List */}
        <div className="lg:col-span-4 lm-card-editorial p-3.5 space-y-2 max-h-[75vh] overflow-y-auto">
          <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-muted">
            <span>Chapters ({filteredChapters.length})</span>
            <span>Status</span>
          </div>
          {filteredChapters.map((ch) => {
            const badge = SUBJECT_BADGE[ch.subject];
            const Icon = badge.icon;
            const active = ch.id === activeChapter.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChapterId(ch.id)}
                data-testid={`syllabus-chapter-item-${ch.id}`}
                className={`w-full p-3 rounded-xl border text-left transition-colors cursor-pointer space-y-1.5 ${
                  active
                    ? 'border-brand bg-brand-soft/40'
                    : 'border-line bg-canvas hover:bg-soft'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.soft} ${badge.text}`}
                  >
                    <Icon className="w-3 h-3" />
                    {ch.code} · {ch.classLevel}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                    {ch.editorialStatus}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-ink">{ch.title}</p>
                <p className="text-[11px] text-muted">
                  Weightage ({examTrack === 'jee_advanced' ? 'Adv' : 'Main'}):{' '}
                  <strong className="text-ink">{ch.weightageQuestionsApprox[examTrack]}</strong>
                </p>
              </button>
            );
          })}
        </div>

        {/* Right Active Chapter Full Notes / Quick Notes & Connected Actions */}
        <div
          className="lg:col-span-8 lm-card-editorial p-5 sm:p-6 space-y-6"
          data-testid="active-chapter-notes-panel"
        >
          {/* Chapter Header & Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-line">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-brand-soft text-brand text-xs font-bold">
                  {activeChapter.code} · {activeChapter.subject} ({activeChapter.classLevel})
                </span>
                <span className="text-xs text-muted">
                  {activeChapter.sourceProvenance.ncertMapping}
                </span>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-extrabold text-ink">
                {activeChapter.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {activeChapter.overview}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const doc = buildStudyDocumentFromSyllabusChapter(activeChapter, noteFormat);
                  onOpenChapterInWorkbench(doc);
                }}
                data-testid="open-chapter-in-workbench-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open in AI Tutor Workbench</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenChapterPractice(activeChapter.id)}
                data-testid="solve-chapter-pyqs-btn"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                <Target className="w-3.5 h-3.5 text-brand" />
                <span>Solve PYQs ({relatedPyqs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = buildStudyDocumentFromSyllabusChapter(activeChapter, 'full');
                  onOpenChapterRevise(doc);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-brand" />
                <span>Revise</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenChapterCreate(activeChapter)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                <span>Create Visual</span>
              </button>
            </div>
          </div>

          {noteFormat === 'full' ? (
            /* FULL NOTES VIEW: Definitions, Explanations, Derivations, Formulas, Worked Examples, Exceptions & Main/Adv Scope */
            <div className="space-y-6" data-testid="chapter-full-notes-content">
              {activeChapter.topics.map((topic, idx) => (
                <section
                  key={topic.id}
                  className="rounded-2xl border border-line bg-canvas p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-base sm:text-lg font-extrabold text-ink">
                      Topic {idx + 1}: {topic.title}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-bold">
                      JEE Main &amp; Advanced
                    </span>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm text-ink leading-relaxed">
                    <div>
                      <span className="font-bold text-brand block text-xs uppercase tracking-wider">
                        Definition &amp; Core Principle
                      </span>
                      <MathText text={topic.definition} />
                    </div>
                    <div>
                      <span className="font-bold text-ink block text-xs uppercase tracking-wider mt-2">
                        Conceptual Explanation
                      </span>
                      <MathText text={topic.explanation} />
                    </div>
                    <div className="p-3.5 rounded-xl bg-soft border border-line">
                      <span className="font-bold text-ink block text-xs uppercase tracking-wider mb-1">
                        Derivation &amp; Mathematical Proof
                      </span>
                      <MathText text={topic.derivation} />
                    </div>
                  </div>

                  {/* Key Formulas & Units Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                      Key Formulas &amp; SI Units
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {topic.keyFormulas.map((f) => (
                        <div
                          key={f.id}
                          className="p-3 rounded-xl border border-line bg-white dark:bg-[#121A2E] space-y-1"
                        >
                          <div className="text-xs font-bold text-brand">{f.name}</div>
                          <div className="text-xs sm:text-sm font-mono font-bold text-ink bg-soft px-2.5 py-1.5 rounded-lg">
                            {f.expression}
                          </div>
                          <div className="text-[11px] text-muted">
                            <strong>Conditions/Units:</strong> {f.unitsOrConditions}
                          </div>
                          <div className="text-[11px] text-muted">{f.variablesExplanation}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exceptions & Common Mistakes */}
                  <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-warning-soft/50 p-3.5 space-y-1.5 text-xs">
                    <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Exceptions &amp; Common JEE Mistakes</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-ink">
                      {topic.exceptionsAndCommonMistakes.map((mistake, mi) => (
                        <li key={mi}>{mistake}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Main vs Advanced Distinction */}
                  <div className="text-xs text-muted bg-soft px-3.5 py-2.5 rounded-xl border border-line">
                    <strong className="text-ink">JEE Main vs Advanced Scope:</strong>{' '}
                    {topic.mainVsAdvancedDistinction}
                  </div>
                </section>
              ))}

              {/* Worked Examples */}
              <section className="space-y-3">
                <h4 className="font-display text-base font-extrabold text-ink">
                  Solved JEE Worked Examples
                </h4>
                {activeChapter.workedExamples.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-2xl border border-line bg-canvas p-4 sm:p-5 space-y-3"
                  >
                    <div className="text-sm font-bold text-brand">{ex.title}</div>
                    <p className="text-xs sm:text-sm font-medium text-ink">{ex.problemStatement}</p>
                    <div className="space-y-1.5 pl-3 border-l-2 border-brand text-xs text-ink">
                      {ex.solutionSteps.map((step, si) => (
                        <p key={si}>
                          <strong>Step {si + 1}:</strong> {step}
                        </p>
                      ))}
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-success-soft text-success text-xs font-bold">
                      Final Answer: {ex.finalAnswer}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ) : (
            /* QUICK NOTES VIEW: Essential Formulas, Key Facts, Short Summaries, Common Traps, Revision Checkpoints */
            <div className="space-y-5" data-testid="chapter-quick-notes-content">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Essential Formulas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeChapter.quickNotes.essentialFormulas.map((ef, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-line bg-canvas space-y-1"
                    >
                      <div className="text-xs font-bold text-brand">{ef.label}</div>
                      <div className="text-xs font-mono font-bold text-ink bg-soft px-2.5 py-1.5 rounded-lg">
                        {ef.formula}
                      </div>
                      <div className="text-[11px] text-muted">{ef.condition}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-line bg-canvas p-4 space-y-2 text-xs">
                  <div className="font-bold text-ink">Key Facts &amp; Reactions</div>
                  <ul className="list-disc pl-4 space-y-1.5 text-muted">
                    {activeChapter.quickNotes.reactionsOrKeyFacts.map((fact, fi) => (
                      <li key={fi} className="text-ink">
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-warning-soft/40 p-4 space-y-2 text-xs">
                  <div className="font-bold text-amber-900 dark:text-amber-300">
                    High-Frequency Exam Traps
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5 text-ink">
                    {activeChapter.quickNotes.commonTraps.map((trap, ti) => (
                      <li key={ti}>{trap}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Interactive Revision Checkpoints */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Active Recall Revision Checkpoints
                </h4>
                {activeChapter.quickNotes.revisionCheckpoints.map((chk) => {
                  const revealed = Boolean(revealedCheckpoints[chk.id]);
                  return (
                    <div
                      key={chk.id}
                      data-testid={`revision-checkpoint-${chk.id}`}
                      className="rounded-xl border border-line bg-canvas p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs sm:text-sm font-bold text-ink">{chk.question}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedCheckpoints((prev) => ({
                              ...prev,
                              [chk.id]: !prev[chk.id],
                            }))
                          }
                          data-testid={`reveal-checkpoint-btn-${chk.id}`}
                          className="px-3 py-1.5 rounded-lg border border-brand/40 bg-brand-soft text-brand text-xs font-bold shrink-0 cursor-pointer"
                        >
                          {revealed ? 'Hide Answer' : 'Check Answer'}
                        </button>
                      </div>
                      {revealed && (
                        <div className="p-3 rounded-lg bg-success-soft text-success text-xs font-semibold">
                          ✓ {chk.expectedKeyPoint}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer: Mark Chapter Completed (+45 XP) & Provenance */}
          <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-muted">
              Provenance: {activeChapter.sourceProvenance.primaryReference} · Reviewed{' '}
              {activeChapter.lastReviewedAt}
            </span>

            <button
              type="button"
              onClick={() => handleMarkChapterGoalCompleted(activeChapter)}
              data-testid="mark-chapter-completed-btn"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                completedChapters[activeChapter.id]
                  ? 'bg-success-soft text-success border border-emerald-500/30'
                  : 'lm-btn-accent'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {completedChapters[activeChapter.id]
                  ? 'Chapter Goal Completed (+45 XP Earned)'
                  : 'Mark Chapter Studied (+45 XP)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

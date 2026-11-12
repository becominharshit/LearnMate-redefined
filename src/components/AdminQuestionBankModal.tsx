import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCheck2,
  FileWarning,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { MathText } from './MathText';
import {
  EXTERNAL_DATASET_SOURCE_REGISTRY,
  EXAM_PATTERN_SPECIFICATIONS,
  VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
  VERIFIED_SAMPLE_LEARNOPT_JSONL,
  approveSolutionByExpert,
  ensureInitialOpenSourcePyqSeed,
  generateAiDraftSolutionForQuestion,
  generateIdReferencedMockBlueprint,
  getAuditedDatasetSources,
  getIngestionCheckpoints,
  getIngestionReports,
  getSourceIdMappings,
  getStoredMockBlueprints,
  getStoredUnifiedQuestions,
  resolveQuestionsForMockBlueprint,
  runDatasetImportPipeline,
  saveStoredUnifiedQuestions,
  unifiedToPyqCorpusQuestion,
  type DatasetSourceId,
  type IdReferencedMockBlueprint,
  type IngestionImportReport,
  type UnifiedDifficulty,
  type UnifiedExamId,
  type UnifiedQuestionRecord,
  type UnifiedSubjectId,
} from '../ingestion';
import type { PyqCorpusQuestion } from '../utils/pyqCorpusEngine';

interface AdminQuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail?: string | null;
  onLaunchMockFromBlueprint?: (params: {
    title: string;
    examVariant: 'jee_main' | 'jee_advanced';
    questions: PyqCorpusQuestion[];
    durationMinutes: number;
  }) => void;
  onCorpusUpdated?: (questions: UnifiedQuestionRecord[]) => void;
}

type AdminTabId =
  | 'sources_provenance'
  | 'import_runner'
  | 'reports_duplicates'
  | 'solutions_queue'
  | 'coverage_mocks';

const SAMPLE_PAYLOAD_BY_SOURCE: Record<
  DatasetSourceId,
  { format: 'JSON' | 'JSONL' | 'CSV' | 'PDF'; content: string }
> = {
  jee_mocks_db: {
    format: 'JSON',
    content: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
  },
  learnopt: {
    format: 'JSONL',
    content: VERIFIED_SAMPLE_LEARNOPT_JSONL,
  },
  qpe: {
    format: 'PDF',
    content: [
      'Q1. [JEE_MAIN | 2025 | PHYSICS | ELECTROSTATICS]',
      'Two point charges $+4\\mu\\text{C}$ and $+1\\mu\\text{C}$ are separated by a distance of $3\\text{ m}$ in vacuum. At what distance from the $+4\\mu\\text{C}$ charge on the line joining them is the net electric field zero?',
      '(A) $1\\text{ m}$',
      '(B) $1.5\\text{ m}$',
      '(C) $2\\text{ m}$',
      '(D) $2.5\\text{ m}$',
      'Answer: C',
      'Solution: Null point lies at distance $x = \\frac{\\sqrt{q_1}}{\\sqrt{q_1} + \\sqrt{q_2}} d = \\frac{\\sqrt{4}}{\\sqrt{4} + \\sqrt{1}} \\times 3 = \\frac{2}{3} \\times 3 = 2\\text{ m}$ from $+4\\mu\\text{C}$.',
    ].join('\n'),
  },
  jee_main_pyq: {
    format: 'JSON',
    content: JSON.stringify(
      [
        {
          externalId: 'SCRAPED-API-001',
          exam: 'JEE_MAIN',
          year: 2024,
          subject: 'PHYSICS',
          questionText: 'Reverse-engineered API question with unverified license.',
          options: ['1', '2', '3', '4'],
          correctAnswer: ['A'],
        },
      ],
      null,
      2
    ),
  },
};

export const AdminQuestionBankModal: React.FC<AdminQuestionBankModalProps> = ({
  isOpen,
  onClose,
  adminEmail = 'harshitkumar7407@gmail.com',
  onLaunchMockFromBlueprint,
  onCorpusUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTabId>('sources_provenance');
  const [questions, setQuestions] = useState<UnifiedQuestionRecord[]>([]);
  const [reports, setReports] = useState<IngestionImportReport[]>([]);
  const [blueprints, setBlueprints] = useState<IdReferencedMockBlueprint[]>([]);
  const [idMapCount, setIdMapCount] = useState<number>(0);

  // Import Runner State
  const [selectedSource, setSelectedSource] = useState<DatasetSourceId>('jee_mocks_db');
  const [selectedFormat, setSelectedFormat] = useState<'JSON' | 'JSONL' | 'CSV' | 'PDF'>(
    'JSON'
  );
  const [rawInputContent, setRawInputContent] = useState<string>(
    VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON
  );
  const [isRunningImport, setIsRunningImport] = useState<boolean>(false);
  const [latestRunReport, setLatestRunReport] = useState<IngestionImportReport | null>(
    null
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Solutions Review Queue State
  const [solutionFilter, setSolutionFilter] = useState<
    'ALL' | 'PENDING' | 'AI_GENERATED' | 'VERIFIED' | 'OFFICIAL'
  >('ALL');
  const [editingSolutionText, setEditingSolutionText] = useState<Record<string, string>>(
    {}
  );
  const [generatingAiForId, setGeneratingAiForId] = useState<string | null>(null);

  // Mock Blueprint Generator State
  const [mockExam, setMockExam] = useState<UnifiedExamId>('JEE_MAIN');
  const [mockMode, setMockMode] =
    useState<IdReferencedMockBlueprint['generationMode']>('FULL_LENGTH');
  const [mockSubject, setMockSubject] = useState<UnifiedSubjectId | 'ALL'>('ALL');
  const [mockDifficulty, setMockDifficulty] = useState<UnifiedDifficulty | 'ALL'>('ALL');

  const refreshStateFromStorage = () => {
    const qs = getStoredUnifiedQuestions();
    setQuestions(qs);
    setReports(getIngestionReports());
    setBlueprints(getStoredMockBlueprints());
    setIdMapCount(Object.keys(getSourceIdMappings()).length);
    onCorpusUpdated?.(qs);
  };

  useEffect(() => {
    if (!isOpen) return;
    void ensureInitialOpenSourcePyqSeed().then(() => {
      refreshStateFromStorage();
    });
  }, [isOpen]);

  const handleSelectSourcePreset = (sourceId: DatasetSourceId) => {
    setSelectedSource(sourceId);
    const preset = SAMPLE_PAYLOAD_BY_SOURCE[sourceId];
    if (preset) {
      setSelectedFormat(preset.format);
      setRawInputContent(preset.content);
    }
  };

  const handleExecuteImport = async (dryRun: boolean, maxRecordsToProcess?: number) => {
    setIsRunningImport(true);
    setStatusBanner(null);
    try {
      const res = await runDatasetImportPipeline({
        sourceId: selectedSource,
        format: selectedFormat,
        rawContent: rawInputContent,
        dryRun,
        maxRecordsToProcess,
        persistToStorage: !dryRun,
      });
      setLatestRunReport(res.report);
      if (!dryRun) {
        refreshStateFromStorage();
      }
      if (res.report.checkpoint.status === 'REJECTED_BY_LICENSE') {
        setStatusBanner(
          `Blocked by Provenance Gatekeeper: ${
            res.report.failedRecords[0]?.issues[0]?.message || 'Unlicensed source.'
          }`
        );
      } else {
        setStatusBanner(
          `${dryRun ? 'Dry-Run Preview' : 'Live Import'} finished: ${
            res.report.importedApprovedCount
          } approved, ${res.report.importedPendingReviewCount} pending review, ${
            res.report.skippedExactDuplicateCount
          } exact duplicates skipped, ${res.report.failedValidationCount} failed validation.`
        );
      }
    } finally {
      setIsRunningImport(false);
    }
  };

  const handleResumeCheckpoint = async (jobId: string) => {
    const checkpoints = getIngestionCheckpoints();
    const cp = checkpoints[jobId];
    if (!cp) return;
    const preset = SAMPLE_PAYLOAD_BY_SOURCE[cp.sourceId];
    setIsRunningImport(true);
    try {
      const res = await runDatasetImportPipeline({
        sourceId: cp.sourceId,
        format: cp.format,
        rawContent: preset ? preset.content : rawInputContent,
        dryRun: false,
        jobId: cp.jobId,
        startIndex: Math.max(0, cp.lastProcessedIndex + 1),
        persistToStorage: true,
      });
      setLatestRunReport(res.report);
      refreshStateFromStorage();
      setStatusBanner(
        `Resumed job ${cp.jobId} from index ${cp.lastProcessedIndex + 1}: status is now ${
          res.report.checkpoint.status
        }.`
      );
    } finally {
      setIsRunningImport(false);
    }
  };

  const handleGenerateAiSolution = async (q: UnifiedQuestionRecord) => {
    setGeneratingAiForId(q.id);
    try {
      const updated = await generateAiDraftSolutionForQuestion(q, 'learnmate-ai-tutor');
      const nextList = questions.map((item) => (item.id === q.id ? updated : item));
      saveStoredUnifiedQuestions(nextList);
      setEditingSolutionText((prev) => ({ ...prev, [q.id]: updated.solution.text }));
      refreshStateFromStorage();
      setStatusBanner(
        `Generated AI draft solution for ${q.id}. Marked as AI_GENERATED (verified = false) pending expert review.`
      );
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingAiForId(null);
    }
  };

  const handleExpertApproveSolution = (q: UnifiedQuestionRecord) => {
    try {
      const customText = editingSolutionText[q.id] ?? q.solution.text;
      const updated = approveSolutionByExpert(q, {
        reviewerEmailOrUid: adminEmail || 'harshitkumar7407@gmail.com',
        editedText: customText,
        reviewNote: `Verified against official answer key (${q.correctAnswer.join(
          ', '
        )}) by ${adminEmail || 'Admin'}.`,
      });
      const nextList = questions.map((item) => (item.id === q.id ? updated : item));
      saveStoredUnifiedQuestions(nextList);
      refreshStateFromStorage();
      setStatusBanner(
        `Question ${q.id} solution promoted to VERIFIED (verified = true) and status set to APPROVED.`
      );
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateMockBlueprint = () => {
    const bp = generateIdReferencedMockBlueprint({
      exam: mockExam,
      generationMode: mockMode,
      subjects: mockSubject === 'ALL' ? undefined : [mockSubject],
      difficulties: mockDifficulty === 'ALL' ? undefined : [mockDifficulty],
      availableQuestions: questions,
      onlyApproved: false,
    });
    refreshStateFromStorage();
    setStatusBanner(
      `Created ID-Referenced Mock Blueprint "${bp.title}" referencing ${bp.questionIds.length} question IDs.`
    );
  };

  const auditedSources = useMemo(() => getAuditedDatasetSources(), []);

  const coverageStats = useMemo(() => {
    const byExam: Record<UnifiedExamId, number> = {
      JEE_MAIN: 0,
      JEE_ADVANCED: 0,
    };
    const bySubject: Record<string, number> = {};
    let approvedCount = 0;
    let pendingReviewCount = 0;

    for (const q of questions) {
      byExam[q.exam] = (byExam[q.exam] || 0) + 1;
      bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
      if (q.status === 'APPROVED') approvedCount += 1;
      else pendingReviewCount += 1;
    }

    return {
      total: questions.length,
      approvedCount,
      pendingReviewCount,
      byExam,
      bySubject,
    };
  }, [questions]);

  const filteredSolutionQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (solutionFilter === 'ALL') return true;
      return q.solution.type === solutionFilter;
    });
  }, [questions, solutionFilter]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="admin-question-bank-modal"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-6xl bg-white dark:bg-[#0F1629] border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-line bg-canvas flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-ink">
                  Question Bank Integration &amp; Provenance Engine
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
              <p className="text-xs text-muted">
                JEE Main · JEE Advanced — Open-Source PYQ Ingestion, License Gatekeeper &amp; Solution Verification
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-admin-question-bank-btn"
            className="w-8 h-8 rounded-xl border border-line bg-white dark:bg-[#161F38] hover:bg-soft flex items-center justify-center text-muted hover:text-ink cursor-pointer"
            aria-label="Close Admin Question Bank Console"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="px-5 py-2.5 bg-soft/60 border-b border-line grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
            <span className="text-muted block text-[10px]">Unified Corpus</span>
            <strong className="text-ink text-sm tabular-nums">{coverageStats.total} Qs</strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
            <span className="text-muted block text-[10px]">Approved</span>
            <strong className="text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
              {coverageStats.approvedCount}
            </strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
            <span className="text-muted block text-[10px]">Pending Review</span>
            <strong className="text-amber-600 dark:text-amber-400 text-sm tabular-nums">
              {coverageStats.pendingReviewCount}
            </strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
            <span className="text-muted block text-[10px]">JEE Main</span>
            <strong className="text-ink text-sm tabular-nums">
              {coverageStats.byExam.JEE_MAIN} Qs
            </strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
            <span className="text-muted block text-[10px]">JEE Advanced</span>
            <strong className="text-brand text-sm tabular-nums">
              {coverageStats.byExam.JEE_ADVANCED} Qs
            </strong>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
            <span className="text-muted block text-[10px]">ID Mappings</span>
            <strong className="text-ink text-sm tabular-nums">{idMapCount}</strong>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-2 border-b border-line flex items-center gap-1.5 overflow-x-auto bg-canvas">
          {(
            [
              { id: 'sources_provenance', label: '1. Dataset Sources & License Audit' },
              { id: 'import_runner', label: '2. Importer & Dry-Run Simulator' },
              { id: 'reports_duplicates', label: '3. Validation & Duplicate Logs' },
              { id: 'solutions_queue', label: '4. Solutions Verification Engine' },
              { id: 'coverage_mocks', label: '5. Coverage & ID-Referenced Mocks' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`admin-qb-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-brand text-brand bg-white dark:bg-[#0F1629]'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {statusBanner && (
          <div
            role="status"
            data-testid="admin-qb-status-banner"
            className="mx-5 mt-3 px-4 py-2.5 rounded-xl bg-brand-soft border border-brand/30 text-xs font-semibold text-ink flex items-center justify-between gap-2"
          >
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-muted hover:text-ink underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: DATASET SOURCES & LICENSE PROVENANCE AUDIT */}
          {activeTab === 'sources_provenance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-canvas border border-line space-y-1">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <span>Provenance &amp; Licensing Policy (Software License != Content License)</span>
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Every external repository is audited across four separate rights dimensions: (1) Question Stems, (2) Official Answer Keys, (3) Worked Solutions, and (4) Diagrams/Media. Sources with reverse-engineered commercial API dumps or unverified third-party explanations are blocked at ingestion time.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {auditedSources.map((src) => {
                  const isApproved =
                    src.clearanceStatus === 'APPROVED_FOR_IMPORT' ||
                    src.clearanceStatus ===
                      'APPROVED_METADATA_AND_PUBLIC_EXAM_STEMS_ONLY';
                  return (
                    <div
                      key={src.sourceId}
                      data-testid={`source-audit-card-${src.sourceId}`}
                      className="p-4 rounded-xl border border-line bg-white dark:bg-[#121A2E] space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-ink">
                              {src.displayName}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                src.clearanceStatus === 'APPROVED_FOR_IMPORT'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : src.clearanceStatus ===
                                    'APPROVED_METADATA_AND_PUBLIC_EXAM_STEMS_ONLY'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-red-500/15 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {src.clearanceStatus}
                            </span>
                          </div>
                          <div className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-3">
                            <span>
                              Repo:{' '}
                              <a
                                href={src.verifiedRepoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand underline inline-flex items-center gap-1"
                              >
                                {src.verifiedRepoUrl}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </span>
                            <span>Formats: {src.dataFormats.join(', ')}</span>
                            <span>License: {src.softwareLicense}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSourcePreset(src.sourceId);
                            setActiveTab('import_runner');
                          }}
                          data-testid={`open-importer-for-${src.sourceId}`}
                          className="px-3 py-1.5 rounded-lg border border-line bg-canvas hover:bg-soft text-xs font-bold text-ink cursor-pointer self-start sm:self-auto"
                        >
                          {isApproved ? 'Load in Importer →' : 'Test License Gatekeeper →'}
                        </button>
                      </div>

                      <p className="text-xs text-muted leading-relaxed">
                        {src.contentProvenanceSummary}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-canvas border border-line">
                          <span className="text-muted block">Question Stems</span>
                          <strong className="text-ink">{src.componentRights.questionStems}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-canvas border border-line">
                          <span className="text-muted block">Official Keys</span>
                          <strong className="text-ink">
                            {src.componentRights.officialAnswerKeys}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-canvas border border-line">
                          <span className="text-muted block">Worked Solutions</span>
                          <strong className="text-ink">
                            {src.componentRights.workedSolutions}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-canvas border border-line">
                          <span className="text-muted block">Diagrams / Media</span>
                          <strong className="text-ink">
                            {src.componentRights.diagramsAndMedia}
                          </strong>
                        </div>
                      </div>

                      <div className="text-xs font-medium text-ink bg-soft/60 px-3 py-2 rounded-lg">
                        <strong>Audit Decision:</strong> {src.rejectionOrRestrictionReason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORTER & DRY-RUN SIMULATOR */}
          {activeTab === 'import_runner' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">
                    Dataset Source
                  </label>
                  <select
                    aria-label="Select Dataset Source"
                    data-testid="importer-source-select"
                    value={selectedSource}
                    onChange={(e) =>
                      handleSelectSourcePreset(e.target.value as DatasetSourceId)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-xs font-bold text-ink"
                  >
                    {auditedSources.map((s) => (
                      <option key={s.sourceId} value={s.sourceId}>
                        {s.discoveryName} ({s.clearanceStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted mb-1">
                    Parser Format
                  </label>
                  <select
                    aria-label="Select Parser Format"
                    data-testid="importer-format-select"
                    value={selectedFormat}
                    onChange={(e) =>
                      setSelectedFormat(
                        e.target.value as 'JSON' | 'JSONL' | 'CSV' | 'PDF'
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-xs font-bold text-ink"
                  >
                    <option value="JSON">JSON (.json)</option>
                    <option value="JSONL">JSON Lines (.jsonl)</option>
                    <option value="CSV">CSV (.csv)</option>
                    <option value="PDF">PDF-Extracted Text (QPE)</option>
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    disabled={isRunningImport}
                    onClick={() => void handleExecuteImport(true)}
                    data-testid="run-dry-run-import-btn"
                    className="flex-1 py-2 px-3 rounded-xl border border-brand text-brand bg-brand-soft/50 hover:bg-brand-soft text-xs font-bold cursor-pointer"
                  >
                    Dry-Run Preview
                  </button>
                  <button
                    type="button"
                    disabled={isRunningImport}
                    onClick={() => void handleExecuteImport(false)}
                    data-testid="run-live-import-btn"
                    className="flex-1 py-2 px-3 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                  >
                    Live Batch Import
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-muted">
                    Raw Dataset Payload ({selectedFormat})
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleExecuteImport(false, 1)}
                    data-testid="run-partial-checkpoint-btn"
                    className="text-[11px] font-semibold text-brand underline cursor-pointer"
                  >
                    Simulate Partial Import (1 Record Checkpoint)
                  </button>
                </div>
                <textarea
                  value={rawInputContent}
                  onChange={(e) => setRawInputContent(e.target.value)}
                  rows={9}
                  className="w-full p-3 rounded-xl border border-line bg-canvas font-mono text-xs text-ink"
                />
              </div>

              {latestRunReport && (
                <div
                  data-testid="latest-import-report-card"
                  className="p-4 rounded-xl border border-line bg-canvas space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-sm text-ink">
                      {latestRunReport.dryRun ? 'Dry-Run Report' : 'Live Import Report'} —{' '}
                      {latestRunReport.jobId}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-xs font-bold">
                      Checkpoint: {latestRunReport.checkpoint.status} (Index{' '}
                      {latestRunReport.checkpoint.lastProcessedIndex} /{' '}
                      {Math.max(0, latestRunReport.checkpoint.totalRecords - 1)})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
                      <span className="text-muted block">Inspected</span>
                      <strong className="text-ink text-sm">
                        {latestRunReport.totalInspected}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
                      <span className="text-muted block">Approved</span>
                      <strong className="text-emerald-600 text-sm">
                        {latestRunReport.importedApprovedCount}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
                      <span className="text-muted block">Pending Review</span>
                      <strong className="text-amber-600 text-sm">
                        {latestRunReport.importedPendingReviewCount}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
                      <span className="text-muted block">Incremental Upd</span>
                      <strong className="text-blue-600 text-sm">
                        {latestRunReport.updatedIncrementalCount}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
                      <span className="text-muted block">Exact Dup Skipped</span>
                      <strong className="text-ink text-sm">
                        {latestRunReport.skippedExactDuplicateCount}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#121A2E] border border-line">
                      <span className="text-muted block">Failed Validation</span>
                      <strong className="text-danger text-sm">
                        {latestRunReport.failedValidationCount}
                      </strong>
                    </div>
                  </div>

                  {latestRunReport.checkpoint.status === 'PAUSED_INTERRUPTED' &&
                    !latestRunReport.dryRun && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                        <span>
                          Job paused at index {latestRunReport.checkpoint.lastProcessedIndex}.
                          Ready to resume remaining records idempotently.
                        </span>
                        <button
                          type="button"
                          data-testid="resume-interrupted-job-btn"
                          onClick={() =>
                            void handleResumeCheckpoint(latestRunReport.jobId)
                          }
                          className="px-3 py-1.5 rounded-lg bg-brand text-white font-bold cursor-pointer"
                        >
                          Resume Import →
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VALIDATION & DUPLICATE LOGS */}
          {activeTab === 'reports_duplicates' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-ink">
                Import History, Failed Validation Records &amp; Duplicate Candidates ({reports.length} jobs)
              </h3>
              {reports.length === 0 ? (
                <div className="p-6 rounded-xl border border-line bg-canvas text-xs text-muted text-center">
                  No import jobs recorded yet. Run a Dry-Run or Live Import in Tab 2.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep) => (
                    <div
                      key={rep.jobId}
                      className="p-4 rounded-xl border border-line bg-white dark:bg-[#121A2E] space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-ink">
                          {rep.jobId} · Source: {rep.sourceId}
                        </span>
                        <span className="text-muted">
                          Approved: {rep.importedApprovedCount} · Updated:{' '}
                          {rep.updatedIncrementalCount} · Dup Skipped:{' '}
                          {rep.skippedExactDuplicateCount} · Failed:{' '}
                          {rep.failedValidationCount}
                        </span>
                      </div>

                      {rep.failedRecords.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/25 space-y-1">
                          <div className="font-bold text-danger">
                            Failed / Rejected Records ({rep.failedRecords.length}):
                          </div>
                          {rep.failedRecords.map((fr, idx) => (
                            <div key={idx} className="text-[11px] text-ink">
                              <strong>{fr.externalId}:</strong>{' '}
                              {fr.issues.map((i) => `[${i.code}] ${i.message}`).join(' | ')}
                            </div>
                          ))}
                        </div>
                      )}

                      {rep.duplicateMatches.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-1">
                          <div className="font-bold text-amber-700 dark:text-amber-300">
                            Duplicate / Near-Duplicate Matches ({rep.duplicateMatches.length}):
                          </div>
                          {rep.duplicateMatches.map((dm, idx) => (
                            <div key={idx} className="text-[11px] text-ink">
                              <strong>{dm.matchType}</strong> (Similarity:{' '}
                              {Math.round(dm.similarityScore * 100)}%) —{' '}
                              {dm.incomingQuestionId} vs {dm.existingQuestionId} [
                              {dm.resolutionStatus}]
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SOLUTIONS VERIFICATION ENGINE */}
          {activeTab === 'solutions_queue' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    Solutions Lifecycle &amp; Expert Verification Queue
                  </h3>
                  <p className="text-xs text-muted">
                    OFFICIAL and VERIFIED solutions are protected against AI overwrite. AI_GENERATED solutions remain unverified until approved by an expert.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'OFFICIAL', 'VERIFIED', 'AI_GENERATED', 'PENDING'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSolutionFilter(st)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                          solutionFilter === st
                            ? 'bg-brand text-white border-brand'
                            : 'bg-canvas text-muted border-line'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {filteredSolutionQuestions.map((q) => {
                  const currentDraft = editingSolutionText[q.id] ?? q.solution.text;
                  return (
                    <div
                      key={q.id}
                      data-testid={`solution-queue-card-${q.id}`}
                      className="p-4 rounded-xl border border-line bg-white dark:bg-[#121A2E] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-brand-soft text-brand text-xs font-bold">
                            {q.exam} · {q.year}
                          </span>
                          <span className="text-xs font-bold text-ink">
                            {q.subject} · {q.chapter}
                          </span>
                          <span className="text-xs text-muted">
                            Key: <strong>{q.correctAnswer.join(', ')}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              q.solution.type === 'OFFICIAL'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : q.solution.type === 'VERIFIED'
                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                : q.solution.type === 'AI_GENERATED'
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            Solution: {q.solution.type} (
                            {q.solution.verified ? 'Verified' : 'Unverified'})
                          </span>
                          <span className="px-2 py-0.5 rounded bg-soft text-ink text-[11px] font-semibold">
                            Status: {q.status}
                          </span>
                        </div>
                      </div>

                      <MathText
                        text={q.question.text}
                        className="text-xs sm:text-sm text-ink leading-relaxed"
                      />

                      <div className="space-y-2">
                        <textarea
                          value={currentDraft}
                          onChange={(e) =>
                            setEditingSolutionText((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder="Enter or edit step-by-step worked solution..."
                          rows={3}
                          className="w-full p-2.5 rounded-xl border border-line bg-canvas text-xs text-ink"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-muted">
                            Source: {q.metadata.source} ({q.metadata.license}) · Revisions:{' '}
                            {q.solution.revisionHistory?.length ?? 1}
                          </div>

                          <div className="flex items-center gap-2">
                            {(q.solution.type === 'PENDING' ||
                              q.solution.type === 'AI_GENERATED') && (
                              <button
                                type="button"
                                disabled={generatingAiForId === q.id}
                                onClick={() => void handleGenerateAiSolution(q)}
                                data-testid={`generate-ai-sol-btn-${q.id}`}
                                className="px-3 py-1.5 rounded-lg border border-brand text-brand bg-brand-soft/40 hover:bg-brand-soft text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>
                                  {generatingAiForId === q.id
                                    ? 'Drafting...'
                                    : 'Draft AI Solution'}
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleExpertApproveSolution(q)}
                              data-testid={`expert-approve-sol-btn-${q.id}`}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Expert Verify &amp; Approve</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: COVERAGE & ID-REFERENCED MOCK BLUEPRINTS */}
          {activeTab === 'coverage_mocks' && (
            <div className="space-y-5">
              {/* Exam Pattern Specifications */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-ink">
                  Supported Exam Patterns &amp; Marking Schemes (Historical &amp; Current)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.values(EXAM_PATTERN_SPECIFICATIONS).map((pat) => (
                    <div
                      key={pat.patternId}
                      className="p-3.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-ink">{pat.title}</span>
                        <span className="px-2 py-0.5 rounded bg-brand-soft text-brand text-[10px] font-bold">
                          {pat.exam}
                        </span>
                      </div>
                      <div className="text-muted">{pat.markingSchemeSummary}</div>
                      <div className="text-[11px] text-muted">
                        Subjects: {pat.subjects.join(', ')} · Duration: {pat.durationMinutes}{' '}
                        min · Max Marks: {pat.maxMarks}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ID-Referenced Mock Blueprint Generator */}
              <div className="p-4 rounded-xl border border-line bg-canvas space-y-3">
                <h3 className="text-sm font-bold text-ink">
                  Generate ID-Referenced Mock Test Blueprint
                </h3>
                <p className="text-xs text-muted">
                  Generates a mock test blueprint storing only <code>questionIds: string[]</code> references (never duplicating question documents).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select
                    aria-label="Mock Exam Track"
                    data-testid="mock-bp-exam-select"
                    value={mockExam}
                    onChange={(e) => setMockExam(e.target.value as UnifiedExamId)}
                    className="px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] text-xs font-bold text-ink"
                  >
                    <option value="JEE_MAIN">JEE Main</option>
                    <option value="JEE_ADVANCED">JEE Advanced</option>
                  </select>

                  <select
                    aria-label="Mock Generation Mode"
                    data-testid="mock-bp-mode-select"
                    value={mockMode}
                    onChange={(e) =>
                      setMockMode(
                        e.target.value as IdReferencedMockBlueprint['generationMode']
                      )
                    }
                    className="px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] text-xs font-bold text-ink"
                  >
                    <option value="FULL_LENGTH">Full-Length Test</option>
                    <option value="SUBJECT_WISE">Subject-Wise Test</option>
                    <option value="CHAPTER_WISE">Chapter-Wise Test</option>
                    <option value="TOPIC_WISE">Topic-Wise Test</option>
                    <option value="DIFFICULTY_BASED">Difficulty-Based Test</option>
                    <option value="CUSTOM_FILTER">Custom Filtered Mock</option>
                  </select>

                  <select
                    aria-label="Mock Subject Filter"
                    value={mockSubject}
                    onChange={(e) =>
                      setMockSubject(e.target.value as UnifiedSubjectId | 'ALL')
                    }
                    className="px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] text-xs font-bold text-ink"
                  >
                    <option value="ALL">All Subjects</option>
                    <option value="PHYSICS">Physics</option>
                    <option value="CHEMISTRY">Chemistry</option>
                    <option value="MATHEMATICS">Mathematics</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleCreateMockBlueprint}
                    data-testid="create-mock-blueprint-btn"
                    className="py-2 px-4 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                  >
                    Create Mock Blueprint
                  </button>
                </div>

                {blueprints.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {blueprints.map((bp) => (
                      <div
                        key={bp.id}
                        data-testid={`mock-blueprint-row-${bp.id}`}
                        className="p-3 rounded-xl border border-line bg-white dark:bg-[#121A2E] flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-ink">{bp.title}</div>
                          <div className="text-[11px] text-muted">
                            Pattern: {bp.patternId} · Question IDs Referenced:{' '}
                            {bp.questionIds.length} ({bp.questionIds.join(', ')})
                          </div>
                        </div>

                        {onLaunchMockFromBlueprint && bp.questionIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const resolved = resolveQuestionsForMockBlueprint(
                                bp,
                                questions
                              );
                              const mapped = resolved.map((q, idx) =>
                                unifiedToPyqCorpusQuestion(q, idx + 1)
                              );
                              onLaunchMockFromBlueprint({
                                title: bp.title,
                                examVariant:
                                  bp.exam === 'JEE_ADVANCED'
                                    ? 'jee_advanced'
                                    : 'jee_main',
                                questions: mapped,
                                durationMinutes: bp.durationMinutes,
                              });
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-brand text-white font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>Launch in CBT</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

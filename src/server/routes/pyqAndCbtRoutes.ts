import { Router } from 'express';
import {
  OFFICIAL_PYQ_PAPERS,
  OFFICIAL_PYQ_QUESTIONS,
  filterPyqQuestions,
  scorePyqQuestionResponse,
  assembleFull75QuestionNtaMock,
  predictShiftPercentileAndAir,
  type PyqCorpusQuestion,
} from '../../utils/pyqCorpusEngine.ts';
import { validateQuestionRecord } from '../../ingestion/validators/index.ts';
import type { UnifiedQuestionRecord } from '../../ingestion/types.ts';
import { BITSAT_AND_VITEEE_PYQ_QUESTIONS } from '../../utils/commercialScaleEngine.ts';

export function createPyqAndCbtRouter(): Router {
  const router = Router();

  // GET /api/pyq/questions — Paginated PYQ query endpoint (JEE Main, JEE Advanced, BITSAT, VITEEE)
  router.get('/questions', (req, res) => {
    try {
      const exam = (req.query.exam as 'jee_main' | 'jee_advanced' | 'bitsat' | 'viteee' | 'all') || 'all';
      const subject = (req.query.subject as 'Physics' | 'Chemistry' | 'Mathematics' | 'All') || 'All';
      const year = req.query.year && req.query.year !== 'All' ? Number(req.query.year) : 'All';
      const chapterId = (req.query.chapterId as string) || 'All';
      const difficulty = (req.query.difficulty as string) || 'All';
      const format = (req.query.format as string) || 'All';
      const searchQuery = (req.query.q as string) || '';
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

      let matched: Array<PyqCorpusQuestion | (typeof BITSAT_AND_VITEEE_PYQ_QUESTIONS)[number]> =
        exam === 'bitsat' || exam === 'viteee'
          ? []
          : filterPyqQuestions({
              exam: exam === 'all' ? 'all' : exam,
              subject,
              year,
              chapterId,
              difficulty,
              searchQuery,
            });

      if (exam === 'bitsat' || exam === 'viteee' || exam === 'all') {
        const extra = BITSAT_AND_VITEEE_PYQ_QUESTIONS.filter((q) => {
          if (exam !== 'all' && q.exam !== exam) return false;
          if (subject !== 'All' && q.subject !== subject) return false;
          if (year !== 'All' && q.year !== year) return false;
          if (chapterId !== 'All' && q.chapterId !== chapterId) return false;
          if (searchQuery.trim()) {
            const sq = searchQuery.toLowerCase();
            if (
              !q.prompt.toLowerCase().includes(sq) &&
              !q.chapterName.toLowerCase().includes(sq) &&
              !q.conceptTested.toLowerCase().includes(sq)
            ) {
              return false;
            }
          }
          return true;
        });
        matched = [...matched, ...extra];
      }

      if (format && format !== 'All') {
        matched = matched.filter((q) => q.format === format || q.questionType === format);
      }

      const total = matched.length;
      const start = (page - 1) * limit;
      const items = matched.slice(start, start + limit);

      res.json({
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        items,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to query PYQ corpus.',
      });
    }
  });

  // POST /api/pyq/assemble-shift — Dynamic 75-Question NTA Mock Shift Assembler
  router.post('/assemble-shift', (req, res) => {
    try {
      const {
        paperId = 'paper-jee-main-2025-jan-s1',
        sectionBRuleMode = 'compulsory_2026',
      } = (req.body || {}) as {
        paperId?: string;
        sectionBRuleMode?: 'compulsory_2026' | 'archival_2024';
      };

      const assembled = assembleFull75QuestionNtaMock(paperId, {
        sectionBRuleMode,
      });

      res.json(assembled);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to assemble 75-question shift paper.',
      });
    }
  });

  // POST /api/cbt/grade — Server-verified CBT grading + Shift Percentile & AIR Predictor
  router.post('/grade', (req, res) => {
    try {
      const {
        paperId,
        shiftDifficulty = 'Moderate',
        responses = [],
      } = (req.body || {}) as {
        paperId?: string;
        shiftDifficulty?: 'Tough' | 'Moderate' | 'Easy';
        responses?: Array<{
          questionId: string;
          selectedOptionIndices?: number[];
          numericalValue?: number | string | null;
          matrixMapping?: Record<string, string>;
          timeSpentSeconds?: number;
        }>;
      };

      const questionMap = new Map<string, PyqCorpusQuestion>();
      for (const q of OFFICIAL_PYQ_QUESTIONS) {
        questionMap.set(q.id, q);
      }

      let totalMarks = 0;
      let maxMarks = 0;
      const outcomes = [];

      for (const r of responses) {
        const q = questionMap.get(r.questionId);
        if (!q) continue;
        const outcome = scorePyqQuestionResponse(q, {
          selectedOptionIndices: r.selectedOptionIndices,
          numericalValue: r.numericalValue,
          matrixMapping: r.matrixMapping,
        });
        totalMarks += outcome.marksAwarded;
        maxMarks += outcome.maxMarks;
        outcomes.push({
          ...outcome,
          subject: q.subject,
          chapterId: q.chapterId,
          chapterName: q.chapterName,
          timeSpentSeconds: r.timeSpentSeconds ?? 0,
        });
      }

      const normalizedOutOf300 =
        maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 300) : totalMarks;
      const prediction = predictShiftPercentileAndAir(normalizedOutOf300, shiftDifficulty);

      res.json({
        paperId: paperId || 'custom-cbt',
        totalMarks,
        maxMarks,
        normalizedOutOf300,
        prediction,
        outcomes,
        gradedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to grade CBT submission.',
      });
    }
  });

  // POST /api/pyq/ingest-validate — Bulk ingestion validation endpoint
  router.post('/ingest-validate', (req, res) => {
    try {
      const { questions = [] } = (req.body || {}) as {
        questions?: UnifiedQuestionRecord[];
      };

      if (!Array.isArray(questions)) {
        res.status(400).json({ error: 'questions must be an array of UnifiedQuestionRecord.' });
        return;
      }

      const results = questions.slice(0, 500).map((q) => ({
        id: q.id,
        validation: validateQuestionRecord(q),
      }));

      const validCount = results.filter((r) => r.validation.isValid).length;
      res.json({
        totalInspected: results.length,
        validCount,
        invalidCount: results.length - validCount,
        papersAvailable: OFFICIAL_PYQ_PAPERS.length,
        results,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to validate PYQ batch.',
      });
    }
  });

  return router;
}

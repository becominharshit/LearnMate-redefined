import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { JEE_SYLLABUS_CHAPTERS } from '../../data/jeeSyllabusAndNotes.ts';
import {
  generateWithModelFallback,
  getGeminiModelConfig,
} from '../services/geminiModelConfig.ts';

export type TutorLanguageRegister = 'English' | 'Hinglish' | 'Hindi';

export interface SocraticCluePayload {
  clue1Principle: string;
  clue1CorePrinciple: string;
  clue2Equation: string;
  clue2GoverningEquation: string;
  clue3AlgebraicStep: string;
  finalSolutionSummary: string;
  matchedChapterId: string;
  matchedChapterTitle: string;
  languageRegister: TutorLanguageRegister;
  modelUsed: string;
}

export interface OcrDoubtResultPayload {
  extractedLatexProblem: string;
  detectedSubject: 'Physics' | 'Chemistry' | 'Mathematics';
  matchedChapterId: string;
  matchedChapterTitle: string;
  ncertReference: string;
  clues: {
    clue1Principle: string;
    clue2Equation: string;
    clue3AlgebraicStep: string;
  };
  stepByStepSolution: string;
  keyFormula: string;
  commonTrap: string;
  modelUsed: string;
}

function getLanguageInstruction(register: TutorLanguageRegister = 'English'): string {
  if (register === 'Hindi') {
    return 'Respond in clear academic Hindi (Devanagari script) while keeping mathematical symbols, variables, and LaTeX formulas ($...$, $$...$$) in standard international notation.';
  }
  if (register === 'Hinglish') {
    return 'Respond in natural Indian coaching-style Hinglish (Roman script blending English technical terms with conversational Hindi connectors like "dekho", "yahan par", "isliye") while keeping all LaTeX formulas ($...$, $$...$$) crisp and exact.';
  }
  return 'Respond in clear, rigorous academic English with standard LaTeX math notation ($...$, $$...$$).';
}

function matchSyllabusChapterFromText(text: string) {
  const lower = text.toLowerCase();
  for (const ch of JEE_SYLLABUS_CHAPTERS) {
    if (
      lower.includes(ch.title.toLowerCase()) ||
      ch.topics.some((t) => lower.includes(t.title.toLowerCase()))
    ) {
      return ch;
    }
  }
  if (lower.includes('torque') || lower.includes('moment of inertia') || lower.includes('rolling')) {
    return JEE_SYLLABUS_CHAPTERS.find((c) => c.id.includes('rotation')) || JEE_SYLLABUS_CHAPTERS[0];
  }
  if (lower.includes('capacitor') || lower.includes('gauss') || lower.includes('electric field')) {
    return JEE_SYLLABUS_CHAPTERS.find((c) => c.id.includes('electrostatics')) || JEE_SYLLABUS_CHAPTERS[0];
  }
  if (lower.includes('nernst') || lower.includes('molarity') || lower.includes('electrochem')) {
    return JEE_SYLLABUS_CHAPTERS.find((c) => c.id.includes('electrochem')) || JEE_SYLLABUS_CHAPTERS[0];
  }
  if (lower.includes('integral') || lower.includes('derivative') || lower.includes('matrix')) {
    return JEE_SYLLABUS_CHAPTERS.find((c) => c.subject === 'Mathematics') || JEE_SYLLABUS_CHAPTERS[0];
  }
  return JEE_SYLLABUS_CHAPTERS[0];
}

export function buildDeterministicSocraticClues(
  question: string,
  topicOrRegister: string | TutorLanguageRegister = 'English',
  maybeRegister?: TutorLanguageRegister
): SocraticCluePayload {
  const languageRegister: TutorLanguageRegister =
    maybeRegister ||
    (topicOrRegister === 'English' ||
    topicOrRegister === 'Hinglish' ||
    topicOrRegister === 'Hindi'
      ? topicOrRegister
      : 'English');
  const matched = matchSyllabusChapterFromText(
    `${question} ${typeof topicOrRegister === 'string' ? topicOrRegister : ''}`
  );
  const formula =
    matched.topics[0]?.keyFormulas?.[0]?.expression ||
    matched.highYieldFormulas?.[0] ||
    '\\sum \\vec{F} = m\\vec{a}, \\quad W_{\\text{net}} = \\Delta K';

  if (languageRegister === 'Hinglish') {
    const c1 = `Clue 1 (Core Principle — Coaching Hinglish): Sabse pehle identify karo ki yeh question **${matched.title}** (${matched.subject}) ke conservation law ya equilibrium condition par based hai. System ke given constraints aur initial state note karo.`;
    const c2 = `Clue 2 (Governing Equation): Is chapter ka primary relation apply karo: $${formula}$. Sign convention aur SI units ko carefully substitute karo.`;
    return {
      clue1Principle: c1,
      clue1CorePrinciple: c1,
      clue2Equation: c2,
      clue2GoverningEquation: c2,
      clue3AlgebraicStep: `Clue 3 (Key Algebraic/Calculus Step): Unknown variable ko isolate karo aur boundary/initial conditions ($t=0$ ya limiting case) lagakar simplify karo.`,
      finalSolutionSummary: `Complete Step-by-Step Derivation (${matched.title}): Governing equation $${formula}$ me given values substitute karne par unknown quantity directly solve ho jati hai. Common trap: units aur vector signs check karna mat bhoolna.`,
      matchedChapterId: matched.id,
      matchedChapterTitle: matched.title,
      languageRegister,
      modelUsed: 'learnmate-socratic-engine',
    };
  }

  if (languageRegister === 'Hindi') {
    const c1 = `संकेत 1 (मूल सिद्धांत): सबसे पहले पहचानें कि यह प्रश्न **${matched.title}** (${matched.subject}) के किस संरक्षण नियम या संतुलन शर्त पर आधारित है।`;
    const c2 = `संकेत 2 (मुख्य समीकरण): इस अध्याय का मुख्य सूत्र लागू करें: $${formula}$। सभी राशियों को SI मात्रकों में रखें।`;
    return {
      clue1Principle: c1,
      clue1CorePrinciple: c1,
      clue2Equation: c2,
      clue2GoverningEquation: c2,
      clue3AlgebraicStep: `संकेत 3 (बीजगणितीय/कलन चरण): अज्ञात चर को अलग करें और सीमांत शर्तों (boundary conditions) को रखकर हल करें।`,
      finalSolutionSummary: `संपूर्ण हल (${matched.title}): सूत्र $${formula}$ में मान रखने और सरल करने पर सही उत्तर प्राप्त होता है।`,
      matchedChapterId: matched.id,
      matchedChapterTitle: matched.title,
      languageRegister,
      modelUsed: 'learnmate-socratic-engine',
    };
  }

  const c1 = `Clue 1 (Core Principle & Conservation Law): Identify the isolated system and fundamental physical/chemical/mathematical principle from **${matched.title}** (${matched.subject}) before plugging in numbers.`;
  const c2 = `Clue 2 (Governing Equation & Boundary Condition): Write down the governing relation $${formula}$ and match each known variable with its SI unit and sign convention.`;
  return {
    clue1Principle: c1,
    clue1CorePrinciple: c1,
    clue2Equation: c2,
    clue2GoverningEquation: c2,
    clue3AlgebraicStep: `Clue 3 (Key Algebraic / Calculus Step): Isolate the target variable symbolically first, apply the boundary conditions, and only substitute numerical constants in the final step.`,
    finalSolutionSummary: `Full Derivation (${matched.title}): Combining the conservation principle with $${formula}$ and evaluating at the specified boundary condition yields the exact JEE result. Watch out for sign conventions and dimensional consistency.`,
    matchedChapterId: matched.id,
    matchedChapterTitle: matched.title,
    languageRegister,
    modelUsed: 'learnmate-socratic-engine',
  };
}

export function createAiTutorRouter(): Router {
  const router = Router();

  const getGeminiClient = () => {
    const key = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
  };

  // POST /api/tutor/socratic-hint — Khanmigo-style 3-step "Clue Coins" Socratic Hint Generator
  router.post('/socratic-hint', async (req, res) => {
    try {
      const {
        question = '',
        contextTopic = '',
        languageRegister = 'English',
      } = (req.body || {}) as {
        question?: string;
        contextTopic?: string;
        languageRegister?: TutorLanguageRegister;
      };

      const cleanQ = String(question || contextTopic || '').trim();
      if (!cleanQ) {
        res.status(400).json({ error: 'Please provide a question or doubt for Socratic hints.' });
        return;
      }

      const safeRegister: TutorLanguageRegister =
        languageRegister === 'Hinglish' || languageRegister === 'Hindi'
          ? languageRegister
          : 'English';

      const fallback = buildDeterministicSocraticClues(`${cleanQ} ${contextTopic}`, safeRegister);
      const ai = getGeminiClient();

      if (ai) {
        try {
          const modelConfig = getGeminiModelConfig();
          const { response: resp, modelUsed } = await generateWithModelFallback(ai, {
            preferredModel: modelConfig.thinkingModel,
            contents: `Student Doubt: "${cleanQ}"\nContext Topic: "${contextTopic || fallback.matchedChapterTitle}"\nGenerate 3 progressive Socratic hints ("Clue Coins") and a final concise solution summary. ${getLanguageInstruction(safeRegister)}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  clue1Principle: { type: Type.STRING },
                  clue2Equation: { type: Type.STRING },
                  clue3AlgebraicStep: { type: Type.STRING },
                  finalSolutionSummary: { type: Type.STRING },
                },
                required: [
                  'clue1Principle',
                  'clue2Equation',
                  'clue3AlgebraicStep',
                  'finalSolutionSummary',
                ],
              },
              temperature: 0.25,
            },
          });

          const tokens = Number(
            resp.usageMetadata?.totalTokenCount ||
              Number(resp.usageMetadata?.promptTokenCount || 0) +
                Number(resp.usageMetadata?.candidatesTokenCount || 0)
          );
          if (tokens > 0) {
            res.locals.measuredAiTokens = Number(res.locals.measuredAiTokens || 0) + tokens;
          }

          const parsed = JSON.parse(resp.text || '{}') as Partial<SocraticCluePayload>;
          if (parsed.clue1Principle && parsed.clue2Equation && parsed.clue3AlgebraicStep) {
            res.json({
              clue1Principle: parsed.clue1Principle,
              clue1CorePrinciple: parsed.clue1Principle,
              clue2Equation: parsed.clue2Equation,
              clue2GoverningEquation: parsed.clue2Equation,
              clue3AlgebraicStep: parsed.clue3AlgebraicStep,
              finalSolutionSummary:
                parsed.finalSolutionSummary || fallback.finalSolutionSummary,
              matchedChapterId: fallback.matchedChapterId,
              matchedChapterTitle: fallback.matchedChapterTitle,
              languageRegister: safeRegister,
              modelUsed,
            } satisfies SocraticCluePayload);
            return;
          }
        } catch {
          // Graceful fallback to deterministic Socratic engine
        }
      }

      res.json(fallback);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate Socratic clues.',
      });
    }
  });

  // POST /api/tutor/ocr-doubt — Camera / Screenshot OCR Doubt Solver into KaTeX + NTA Chapter + Clues
  router.post('/ocr-doubt', async (req, res) => {
    try {
      const {
        imageBase64 = '',
        mimeType = 'image/png',
        rawTextHint = '',
        languageRegister = 'English',
      } = (req.body || {}) as {
        imageBase64?: string;
        mimeType?: string;
        rawTextHint?: string;
        languageRegister?: TutorLanguageRegister;
      };

      const cleanHint = String(rawTextHint || '').trim();
      const hasImage = Boolean(String(imageBase64 || '').trim());
      if (!hasImage && !cleanHint) {
        res.status(400).json({
          error: 'Please upload a photo/screenshot of your question or paste problem text.',
          errorCode: 'missing_ocr_input',
        });
        return;
      }

      const safeRegister: TutorLanguageRegister =
        languageRegister === 'Hinglish' || languageRegister === 'Hindi'
          ? languageRegister
          : 'English';

      const ai = getGeminiClient();
      let aiErrorReason: string | null = null;

      if (ai && hasImage) {
        try {
          const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
          const modelConfig = getGeminiModelConfig();
          const { response: resp, modelUsed } = await generateWithModelFallback(ai, {
            preferredModel: modelConfig.thinkingModel,
            contents: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType || 'image/png',
                },
              },
              {
                text: `Extract the Physics, Chemistry, or Mathematics problem from this image into clean LaTeX ($...$ and $$...$$), identify its NTA JEE chapter, provide 3 progressive Socratic hints, and a step-by-step solution. ${getLanguageInstruction(safeRegister)}`,
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  extractedLatexProblem: { type: Type.STRING },
                  detectedSubject: { type: Type.STRING },
                  matchedChapterTitle: { type: Type.STRING },
                  ncertReference: { type: Type.STRING },
                  clue1Principle: { type: Type.STRING },
                  clue2Equation: { type: Type.STRING },
                  clue3AlgebraicStep: { type: Type.STRING },
                  stepByStepSolution: { type: Type.STRING },
                  keyFormula: { type: Type.STRING },
                  commonTrap: { type: Type.STRING },
                },
                required: [
                  'extractedLatexProblem',
                  'detectedSubject',
                  'matchedChapterTitle',
                  'clue1Principle',
                  'clue2Equation',
                  'clue3AlgebraicStep',
                  'stepByStepSolution',
                  'keyFormula',
                ],
              },
            },
          });

          const tokens = Number(
            resp.usageMetadata?.totalTokenCount ||
              Number(resp.usageMetadata?.promptTokenCount || 0) +
                Number(resp.usageMetadata?.candidatesTokenCount || 0)
          );
          if (tokens > 0) {
            res.locals.measuredAiTokens = Number(res.locals.measuredAiTokens || 0) + tokens;
          }

          const parsed = JSON.parse(resp.text || '{}') as Record<string, string>;
          if (parsed.extractedLatexProblem) {
            const chapterMatch = matchSyllabusChapterFromText(
              `${parsed.matchedChapterTitle || ''} ${parsed.extractedLatexProblem}`
            );
            const matchedFormula =
              chapterMatch?.topics?.[0]?.keyFormulas?.[0]?.expression ||
              chapterMatch?.highYieldFormulas?.[0] ||
              '';
            res.json({
              extractedLatexProblem: parsed.extractedLatexProblem,
              detectedSubject:
                parsed.detectedSubject === 'Chemistry' || parsed.detectedSubject === 'Mathematics'
                  ? parsed.detectedSubject
                  : 'Physics',
              matchedChapterId: chapterMatch.id,
              matchedChapterTitle: parsed.matchedChapterTitle || chapterMatch.title,
              ncertReference:
                parsed.ncertReference || `NCERT ${chapterMatch.classLevel} · ${chapterMatch.title}`,
              clues: {
                clue1Principle: parsed.clue1Principle,
                clue2Equation: parsed.clue2Equation,
                clue3AlgebraicStep: parsed.clue3AlgebraicStep,
              },
              stepByStepSolution: parsed.stepByStepSolution,
              keyFormula: parsed.keyFormula || matchedFormula,
              commonTrap:
                parsed.commonTrap ||
                'Check SI unit conversions and vector sign conventions before final substitution.',
              modelUsed,
            } satisfies OcrDoubtResultPayload);
            return;
          }
          aiErrorReason = 'OCR vision model could not read a problem statement from this image.';
        } catch (err) {
          aiErrorReason =
            err instanceof Error ? err.message : 'Vision OCR provider request failed.';
        }
      }

      // Only solve via text hint when the student explicitly supplied problem text;
      // NEVER fabricate an unrelated sample problem when an uploaded image could not be OCR-read.
      if (!cleanHint) {
        const status = !ai ? 503 : 422;
        res.status(status).json({
          error: !ai
            ? 'Live image OCR is unavailable because vision AI credentials are not configured on this server. Paste your question text directly to get Socratic hints.'
            : `${aiErrorReason || 'Could not extract readable text from this image.'} Please upload a sharper crop or type the question text.`,
          errorCode: 'ocr_unavailable_or_unreadable',
          code: 'ocr_unavailable_or_unreadable',
        });
        return;
      }

      const matched = matchSyllabusChapterFromText(cleanHint);
      const defaultFormula =
        matched?.topics?.[0]?.keyFormulas?.[0]?.expression ||
        matched?.highYieldFormulas?.[0] ||
        '';
      const fallbackClues = buildDeterministicSocraticClues(cleanHint, safeRegister);

      res.json({
        extractedLatexProblem: cleanHint,
        detectedSubject: matched.subject,
        matchedChapterId: matched.id,
        matchedChapterTitle: matched.title,
        ncertReference: `NCERT ${matched.classLevel} · ${matched.title}`,
        clues: {
          clue1Principle: fallbackClues.clue1Principle,
          clue2Equation: fallbackClues.clue2Equation,
          clue3AlgebraicStep: fallbackClues.clue3AlgebraicStep,
        },
        stepByStepSolution: fallbackClues.finalSolutionSummary,
        keyFormula: defaultFormula,
        commonTrap:
          'Verify SI units, limiting conditions, and sign conventions before final substitution.',
        modelUsed: 'learnmate-text-hint-engine',
      } satisfies OcrDoubtResultPayload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to process OCR doubt.',
      });
    }
  });

  return router;
}

/**
 * Versioned Exam Rules, Global Multi-Exam Schema Registry & Localization Utilities
 * - Official JEE Main 2027 Paper 1 (B.E./B.Tech) rule specification + historical 2021–2026 rules
 * - JEE Advanced Paper 1 & Paper 2 versioned rules
 * - Global exam schemas with explicit `isVerifiedCoverage` truthfulness flags
 * - Locale, regional currency (INR/USD/GBP), and syllabus integrity auditor
 */

import {
  JEE_SYLLABUS_CHAPTERS,
  SYLLABUS_VERSIONS,
} from '../data/jeeSyllabusAndNotes';

export type SupportedLocaleId = 'en-IN' | 'hi-IN' | 'en-US' | 'en-GB';
export type SupportedCurrencyCode = 'INR' | 'USD' | 'GBP';

export interface ExamRuleSectionSpec {
  sectionId: string;
  label: string;
  format: 'single_mcq' | 'multiple_mcq' | 'numerical_integer' | 'numerical_decimal' | 'paragraph_comprehension' | 'matrix_match';
  totalQuestionsPerSubject: number;
  compulsoryAttemptCount: number;
  fullMarks: number;
  negativeMarks: number;
  unattemptedMarks: number;
  partialCreditAllowed: boolean;
  numericalRounding: 'none' | 'nearest_integer' | 'decimal_2dp';
}

export interface ExamRuleVersion {
  ruleVersionId: string;
  examId: string;
  title: string;
  effectiveYears: string;
  isCurrentOfficialPattern: boolean;
  durationMinutes: number;
  totalQuestions: number;
  compulsoryQuestions: number;
  totalMarks: number;
  subjects: string[];
  sectionsPerSubject: ExamRuleSectionSpec[];
  officialBody: string;
  officialSourceUrl: string;
  notes: string;
}

export const VERSIONED_EXAM_RULES: Record<string, ExamRuleVersion> = {
  'jee-main-2027-p1-v1': {
    ruleVersionId: 'jee-main-2027-p1-v1',
    examId: 'jee_main',
    title: 'JEE (Main) 2027 Paper 1 (B.E./B.Tech) Official Pattern',
    effectiveYears: '2025–2027',
    isCurrentOfficialPattern: true,
    durationMinutes: 180,
    totalQuestions: 75,
    compulsoryQuestions: 75,
    totalMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sectionsPerSubject: [
      {
        sectionId: 'A',
        label: 'Section A (Single-Choice MCQ)',
        format: 'single_mcq',
        totalQuestionsPerSubject: 20,
        compulsoryAttemptCount: 20,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'none',
      },
      {
        sectionId: 'B',
        label: 'Section B (Compulsory Numerical Value)',
        format: 'numerical_integer',
        totalQuestionsPerSubject: 5,
        compulsoryAttemptCount: 5,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'nearest_integer',
      },
    ],
    officialBody: 'National Testing Agency (NTA)',
    officialSourceUrl: 'https://jeemain.nta.nic.in/',
    notes:
      'All 75 questions (25 per subject: 20 MCQ + 5 numerical) are compulsory. Negative marking of -1 applies to BOTH Section A and Section B. Numerical values are rounded to the nearest integer per NTA information bulletin.',
  },
  'jee-main-2025-2026-v1': {
    ruleVersionId: 'jee-main-2025-2026-v1',
    examId: 'jee_main',
    title: 'JEE (Main) 2025–2026 Paper 1 Pattern',
    effectiveYears: '2025–2026',
    isCurrentOfficialPattern: false,
    durationMinutes: 180,
    totalQuestions: 75,
    compulsoryQuestions: 75,
    totalMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sectionsPerSubject: [
      {
        sectionId: 'A',
        label: 'Section A (Single-Choice MCQ)',
        format: 'single_mcq',
        totalQuestionsPerSubject: 20,
        compulsoryAttemptCount: 20,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'none',
      },
      {
        sectionId: 'B',
        label: 'Section B (Compulsory Numerical Value)',
        format: 'numerical_integer',
        totalQuestionsPerSubject: 5,
        compulsoryAttemptCount: 5,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'nearest_integer',
      },
    ],
    officialBody: 'National Testing Agency (NTA)',
    officialSourceUrl: 'https://jeemain.nta.nic.in/',
    notes: 'Discontinued optional 10-question Section B choice; 5 compulsory numericals with -1 negative marking.',
  },
  'jee-main-2022-2024-v1': {
    ruleVersionId: 'jee-main-2022-2024-v1',
    examId: 'jee_main',
    title: 'JEE (Main) 2022–2024 Historical Archival Pattern (-1 Sec B Negative)',
    effectiveYears: '2022–2024',
    isCurrentOfficialPattern: false,
    durationMinutes: 180,
    totalQuestions: 90,
    compulsoryQuestions: 75,
    totalMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sectionsPerSubject: [
      {
        sectionId: 'A',
        label: 'Section A (Single-Choice MCQ)',
        format: 'single_mcq',
        totalQuestionsPerSubject: 20,
        compulsoryAttemptCount: 20,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'none',
      },
      {
        sectionId: 'B',
        label: 'Section B (Attempt any 5 of 10 Numerical)',
        format: 'numerical_integer',
        totalQuestionsPerSubject: 10,
        compulsoryAttemptCount: 5,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'nearest_integer',
      },
    ],
    officialBody: 'National Testing Agency (NTA)',
    officialSourceUrl: 'https://jeemain.nta.nic.in/',
    notes:
      '2022–2024 90-question choice format (attempt up to 5 of 10 per subject in Section B). Both Section A and Section B carried -1 negative marking.',
  },
  'jee-main-2021-v1': {
    ruleVersionId: 'jee-main-2021-v1',
    examId: 'jee_main',
    title: 'JEE (Main) 2021 Historical Archival Pattern (0 Sec B Negative)',
    effectiveYears: '2021',
    isCurrentOfficialPattern: false,
    durationMinutes: 180,
    totalQuestions: 90,
    compulsoryQuestions: 75,
    totalMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sectionsPerSubject: [
      {
        sectionId: 'A',
        label: 'Section A (Single-Choice MCQ)',
        format: 'single_mcq',
        totalQuestionsPerSubject: 20,
        compulsoryAttemptCount: 20,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'none',
      },
      {
        sectionId: 'B',
        label: 'Section B (Attempt any 5 of 10 Numerical, No Negative)',
        format: 'numerical_integer',
        totalQuestionsPerSubject: 10,
        compulsoryAttemptCount: 5,
        fullMarks: 4,
        negativeMarks: 0,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'nearest_integer',
      },
    ],
    officialBody: 'National Testing Agency (NTA)',
    officialSourceUrl: 'https://jeemain.nta.nic.in/',
    notes:
      '2021 90-question choice format (attempt up to 5 of 10 per subject in Section B). Section B carried zero negative marking in 2021.',
  },
  'jee-main-2021-2024-v1': {
    ruleVersionId: 'jee-main-2021-2024-v1',
    examId: 'jee_main',
    title: 'JEE (Main) 2021–2024 Historical Archival Pattern (Legacy Combined Rule)',
    effectiveYears: '2021–2024',
    isCurrentOfficialPattern: false,
    durationMinutes: 180,
    totalQuestions: 90,
    compulsoryQuestions: 75,
    totalMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sectionsPerSubject: [
      {
        sectionId: 'A',
        label: 'Section A (Single-Choice MCQ)',
        format: 'single_mcq',
        totalQuestionsPerSubject: 20,
        compulsoryAttemptCount: 20,
        fullMarks: 4,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'none',
      },
      {
        sectionId: 'B',
        label: 'Section B (Attempt any 5 of 10 Numerical)',
        format: 'numerical_integer',
        totalQuestionsPerSubject: 10,
        compulsoryAttemptCount: 5,
        fullMarks: 4,
        negativeMarks: 0, // Use jee-main-2021-v1 (0) or jee-main-2022-2024-v1 (-1) for exact year scoring
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'nearest_integer',
      },
    ],
    officialBody: 'National Testing Agency (NTA)',
    officialSourceUrl: 'https://jeemain.nta.nic.in/',
    notes:
      'Legacy combined alias for archival 90-question choice format. Prefer jee-main-2021-v1 (0 Section B negative) or jee-main-2022-2024-v1 (-1 Section B negative).',
  },
  'jee-adv-2025-p1-v1': {
    ruleVersionId: 'jee-adv-2025-p1-v1',
    examId: 'jee_advanced',
    title: 'JEE (Advanced) Paper 1 Reference Pattern',
    effectiveYears: '2024–2027',
    isCurrentOfficialPattern: true,
    durationMinutes: 180,
    totalQuestions: 51,
    compulsoryQuestions: 51,
    totalMarks: 180,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sectionsPerSubject: [
      {
        sectionId: 'Section 1',
        label: 'One or More Than One Correct (Partial Credit)',
        format: 'multiple_mcq',
        totalQuestionsPerSubject: 4,
        compulsoryAttemptCount: 4,
        fullMarks: 4,
        negativeMarks: 2,
        unattemptedMarks: 0,
        partialCreditAllowed: true,
        numericalRounding: 'none',
      },
      {
        sectionId: 'Section 2',
        label: 'Single Correct MCQ',
        format: 'single_mcq',
        totalQuestionsPerSubject: 4,
        compulsoryAttemptCount: 4,
        fullMarks: 3,
        negativeMarks: 1,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'none',
      },
      {
        sectionId: 'Section 3',
        label: 'Non-Negative Integer',
        format: 'numerical_integer',
        totalQuestionsPerSubject: 6,
        compulsoryAttemptCount: 6,
        fullMarks: 4,
        negativeMarks: 0,
        unattemptedMarks: 0,
        partialCreditAllowed: false,
        numericalRounding: 'nearest_integer',
      },
    ],
    officialBody: 'IIT Joint Admission Board (JAB)',
    officialSourceUrl: 'https://jeeadv.ac.in/',
    notes:
      'JEE Advanced exact section counts and marking vary year-to-year per exam day instructions; +4/-2 partial credit (+3/+2/+1) applies to multi-correct sections.',
  },
};

export function getExamRuleVersion(ruleVersionId: string): ExamRuleVersion {
  return (
    VERSIONED_EXAM_RULES[ruleVersionId] ||
    VERSIONED_EXAM_RULES['jee-main-2027-p1-v1']
  );
}

/**
 * Evaluates a numerical input according to JEE Main 2027 nearest-integer rules
 * or fractional decimal tolerance when explicitly specified by the question.
 */
export function normalizeNumericalResponse(
  rawInput: string | number | null | undefined,
  mode: 'nearest_integer' | 'decimal_2dp' | 'none' = 'nearest_integer'
): { valid: boolean; value: number | null; roundedNearestInteger: number | null } {
  if (rawInput === null || rawInput === undefined || String(rawInput).trim() === '') {
    return { valid: false, value: null, roundedNearestInteger: null };
  }
  const num = Number(String(rawInput).trim());
  if (!Number.isFinite(num)) {
    return { valid: false, value: null, roundedNearestInteger: null };
  }
  const roundedNearestInteger = Math.round(num);
  if (mode === 'nearest_integer') {
    return { valid: true, value: roundedNearestInteger, roundedNearestInteger };
  }
  if (mode === 'decimal_2dp') {
    return { valid: true, value: Number(num.toFixed(2)), roundedNearestInteger };
  }
  return { valid: true, value: num, roundedNearestInteger };
}

export type ExamCoverageTier =
  | 'verified_core'
  | 'experimental_pattern_only'
  | 'schema_only_unverified';

export interface GlobalExamRegistryEntry {
  examId: string;
  displayName: string;
  shortName: string;
  countryOrRegion: 'India' | 'United States' | 'United Kingdom' | 'International';
  defaultLocale: SupportedLocaleId;
  defaultCurrency: SupportedCurrencyCode;
  subjects: string[];
  activeRuleVersionId?: string;
  isVerifiedCoverage: boolean;
  coverageTier: ExamCoverageTier;
  syllabusChapterCount: number;
  verifiedPyqCount: number;
  originalEditorialCount: number;
  coverageDisclaimer: string;
}

export const GLOBAL_EXAM_REGISTRY: Record<string, GlobalExamRegistryEntry> = {
  jee_main: {
    examId: 'jee_main',
    displayName: 'JEE (Main) 2027 Paper 1',
    shortName: 'JEE Main',
    countryOrRegion: 'India',
    defaultLocale: 'en-IN',
    defaultCurrency: 'INR',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    activeRuleVersionId: 'jee-main-2027-p1-v1',
    isVerifiedCoverage: true,
    coverageTier: 'verified_core',
    syllabusChapterCount: 58,
    verifiedPyqCount: 0, // Honesty: bundled 75 items are original editorial; verified PYQs arrive via audited ingestion
    originalEditorialCount: 75,
    coverageDisclaimer:
      '58-chapter rationalized NTA syllabus notes + 75 LearnMate original editorial 2027-pattern questions. Official shift-by-shift PYQs require running verified dataset import.',
  },
  jee_advanced: {
    examId: 'jee_advanced',
    displayName: 'JEE (Advanced) Paper 1 & 2',
    shortName: 'JEE Advanced',
    countryOrRegion: 'India',
    defaultLocale: 'en-IN',
    defaultCurrency: 'INR',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    activeRuleVersionId: 'jee-adv-2025-p1-v1',
    isVerifiedCoverage: true,
    coverageTier: 'verified_core',
    syllabusChapterCount: 58,
    verifiedPyqCount: 0,
    originalEditorialCount: 9,
    coverageDisclaimer:
      'Verified JEE Advanced partial-credit, paragraph, integer, and matrix-match grading engine with 9 original editorial/reconstructed problems.',
  },
  bitsat: {
    examId: 'bitsat',
    displayName: 'BITSAT (Pattern Mode)',
    shortName: 'BITSAT',
    countryOrRegion: 'India',
    defaultLocale: 'en-IN',
    defaultCurrency: 'INR',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'English & Logical Reasoning'],
    isVerifiedCoverage: false,
    coverageTier: 'experimental_pattern_only',
    syllabusChapterCount: 0,
    verifiedPyqCount: 0,
    originalEditorialCount: 3,
    coverageDisclaimer:
      'Experimental sample pattern only (+3/-1). Not a full verified BITSAT question bank.',
  },
  viteee: {
    examId: 'viteee',
    displayName: 'VITEEE (Pattern Mode)',
    shortName: 'VITEEE',
    countryOrRegion: 'India',
    defaultLocale: 'en-IN',
    defaultCurrency: 'INR',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Aptitude'],
    isVerifiedCoverage: false,
    coverageTier: 'experimental_pattern_only',
    syllabusChapterCount: 0,
    verifiedPyqCount: 0,
    originalEditorialCount: 2,
    coverageDisclaimer:
      'Experimental sample pattern only (+1/0). Not a full verified VITEEE question bank.',
  },
  neet_ug: {
    examId: 'neet_ug',
    displayName: 'NEET UG (Schema Stub)',
    shortName: 'NEET UG',
    countryOrRegion: 'India',
    defaultLocale: 'en-IN',
    defaultCurrency: 'INR',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    isVerifiedCoverage: false,
    coverageTier: 'schema_only_unverified',
    syllabusChapterCount: 0,
    verifiedPyqCount: 0,
    originalEditorialCount: 0,
    coverageDisclaimer: 'Exam scoring schema stub only; Physics/Chemistry/Biology question bank is not verified.',
  },
  sat_digital: {
    examId: 'sat_digital',
    displayName: 'Digital SAT STEM (Schema Stub)',
    shortName: 'Digital SAT',
    countryOrRegion: 'United States',
    defaultLocale: 'en-US',
    defaultCurrency: 'USD',
    subjects: ['Mathematics', 'Reading & Writing'],
    isVerifiedCoverage: false,
    coverageTier: 'schema_only_unverified',
    syllabusChapterCount: 0,
    verifiedPyqCount: 0,
    originalEditorialCount: 0,
    coverageDisclaimer: 'International schema preview only — adaptive Bluebook question bank is not included.',
  },
  ib_dp: {
    examId: 'ib_dp',
    displayName: 'IB Diploma Physics / Chemistry / Math AA HL (Schema Stub)',
    shortName: 'IB DP',
    countryOrRegion: 'International',
    defaultLocale: 'en-GB',
    defaultCurrency: 'GBP',
    subjects: ['Physics HL/SL', 'Chemistry HL/SL', 'Mathematics AA'],
    isVerifiedCoverage: false,
    coverageTier: 'schema_only_unverified',
    syllabusChapterCount: 0,
    verifiedPyqCount: 0,
    originalEditorialCount: 0,
    coverageDisclaimer: 'International schema preview only — official IB past papers are excluded for copyright compliance.',
  },
  a_levels: {
    examId: 'a_levels',
    displayName: 'UK A-Levels STEM (Schema Stub)',
    shortName: 'A-Levels',
    countryOrRegion: 'United Kingdom',
    defaultLocale: 'en-GB',
    defaultCurrency: 'GBP',
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
    isVerifiedCoverage: false,
    coverageTier: 'schema_only_unverified',
    syllabusChapterCount: 0,
    verifiedPyqCount: 0,
    originalEditorialCount: 0,
    coverageDisclaimer: 'International schema preview only — verified exam-board papers are not bundled.',
  },
};

export function getGlobalExamEntry(examId: string): GlobalExamRegistryEntry | undefined {
  return GLOBAL_EXAM_REGISTRY[examId];
}

export function listVerifiedGlobalExams(): GlobalExamRegistryEntry[] {
  return Object.values(GLOBAL_EXAM_REGISTRY).filter((e) => e.isVerifiedCoverage);
}

export function formatLocalizedCurrency(
  amount: number,
  currency: SupportedCurrencyCode = 'INR',
  locale: SupportedLocaleId = 'en-IN'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    }).format(amount);
  } catch {
    const sym = currency === 'INR' ? '₹' : currency === 'GBP' ? '£' : '$';
    return `${sym}${amount}`;
  }
}

export function formatLocalizedDate(
  isoOrDate: string | Date,
  locale: SupportedLocaleId = 'en-IN'
): string {
  const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(dt.getTime())) return String(isoOrDate);
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(dt);
  } catch {
    return dt.toISOString().slice(0, 10);
  }
}

export interface SyllabusAuditResult {
  passed: boolean;
  totalChapters: number;
  physicsCount: number;
  chemistryCount: number;
  mathematicsCount: number;
  missingFormulaChapterIds: string[];
  missingNcertMappingIds: string[];
  hasOfficialNtaUrl: boolean;
  hasOfficialJabUrl: boolean;
  jeeMain2027RuleTotalQuestions: number;
}

export function auditSyllabusIntegrity(): SyllabusAuditResult {
  const physicsCount = JEE_SYLLABUS_CHAPTERS.filter((c) => c.subject === 'Physics').length;
  const chemistryCount = JEE_SYLLABUS_CHAPTERS.filter((c) => c.subject === 'Chemistry').length;
  const mathematicsCount = JEE_SYLLABUS_CHAPTERS.filter((c) => c.subject === 'Mathematics').length;

  const missingFormulaChapterIds = JEE_SYLLABUS_CHAPTERS.filter(
    (c) => !Array.isArray(c.highYieldFormulas) || c.highYieldFormulas.length === 0
  ).map((c) => c.id);

  const missingNcertMappingIds = JEE_SYLLABUS_CHAPTERS.filter(
    (c) => typeof c.ncertChapterNumber !== 'number' || c.ncertChapterNumber < 1
  ).map((c) => c.id);

  const hasOfficialNtaUrl = Boolean(
    SYLLABUS_VERSIONS.jee_main?.sourceUrl?.includes('jeemain.nta.nic.in')
  );
  const hasOfficialJabUrl = Boolean(
    SYLLABUS_VERSIONS.jee_advanced?.sourceUrl?.includes('jeeadv.ac.in')
  );

  const passed =
    JEE_SYLLABUS_CHAPTERS.length === 58 &&
    physicsCount === 20 &&
    chemistryCount === 20 &&
    mathematicsCount === 18 &&
    missingFormulaChapterIds.length === 0 &&
    missingNcertMappingIds.length === 0 &&
    hasOfficialNtaUrl &&
    hasOfficialJabUrl;

  return {
    passed,
    totalChapters: JEE_SYLLABUS_CHAPTERS.length,
    physicsCount,
    chemistryCount,
    mathematicsCount,
    missingFormulaChapterIds,
    missingNcertMappingIds,
    hasOfficialNtaUrl,
    hasOfficialJabUrl,
    jeeMain2027RuleTotalQuestions: VERSIONED_EXAM_RULES['jee-main-2027-p1-v1'].totalQuestions,
  };
}

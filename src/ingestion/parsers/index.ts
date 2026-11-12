/**
 * Multi-Format & Source-Specific Dataset Parsers
 * Supports JSON, JSONL, RFC-4180 CSV, and PDF-Extracted Text (QPE format),
 * as well as source-specific adapters for JEE Mocks DB, JEE Main PYQ, LearnOpt, and QPE.
 */

import type { DatasetSourceId } from '../types';

export interface RawExternalQuestionPayload {
  externalId?: string;
  id?: string;
  question_id?: string;
  exam?: string;
  exam_name?: string;
  year?: number | string;
  session?: string;
  shift?: number | string;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
  type?: string;
  questionText?: string;
  question?:
    | string
    | {
        text?: string;
        images?: string[];
        equations?: string[];
        tables?: Array<{ headers: string[]; rows: string[][]; caption?: string }>;
        assertionText?: string;
        reasonText?: string;
      };
  assertionText?: string;
  reasonText?: string;
  images?: string[];
  equations?: string[];
  tables?: Array<{ headers: string[]; rows: string[][]; caption?: string }>;
  options?: Array<{ id?: string; text?: string; image?: string } | string>;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string[] | string | number;
  answer?: string[] | string | number;
  numericalTolerance?: number | string;
  officialSolution?: string;
  solutionText?: string;
  solution?:
    | string
    | {
        text?: string;
        type?: string;
        verified?: boolean;
        keyFormula?: string;
        commonTrap?: string;
      };
  solutionType?: string;
  keyFormula?: string;
  commonTrap?: string;
  skillTag?: string;
  license?: string;
  source?: string;
  sourceUrl?: string;
  provenanceVerified?: boolean | string;
  status?: string;
}

/**
 * 1. JSON Dataset Parser
 * Handles both top-level JSON arrays and `{ questions: [...] }` / `{ data: [...] }` envelopes.
 */
export function parseJsonDataset(rawJson: string): RawExternalQuestionPayload[] {
  const trimmed = rawJson.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return parsed as RawExternalQuestionPayload[];
  }
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) return parsed.questions as RawExternalQuestionPayload[];
    if (Array.isArray(parsed.data)) return parsed.data as RawExternalQuestionPayload[];
    if (Array.isArray(parsed.items)) return parsed.items as RawExternalQuestionPayload[];
    return [parsed as RawExternalQuestionPayload];
  }
  throw new Error('Unsupported JSON root structure: expected array or object containing questions.');
}

/**
 * 2. JSONL (JSON Lines) Dataset Parser
 * Parses newline-delimited JSON objects, ignoring blank lines and `#` comments.
 */
export function parseJsonlDataset(rawJsonl: string): RawExternalQuestionPayload[] {
  const lines = rawJsonl.split(/\r?\n/);
  const records: RawExternalQuestionPayload[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object') {
        records.push(obj as RawExternalQuestionPayload);
      }
    } catch (err) {
      throw new Error(
        `Invalid JSONL at line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return records;
}

/**
 * 3. RFC-4180 Compliant CSV Dataset Parser
 * Correctly handles quoted fields containing commas, LaTeX expressions, and escaped quotes `""`.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsvDataset(rawCsv: string): RawExternalQuestionPayload[] {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const records: RawExternalQuestionPayload[] = [];

  for (let r = 1; r < lines.length; r++) {
    const values = parseCsvLine(lines[r]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] ?? '';
    });

    const payload: RawExternalQuestionPayload = {
      externalId: rowObj.externalId || rowObj.id || `csv-row-${r}`,
      exam: rowObj.exam || rowObj.exam_name,
      year: rowObj.year ? Number(rowObj.year) : undefined,
      session: rowObj.session,
      shift: rowObj.shift,
      subject: rowObj.subject,
      chapter: rowObj.chapter,
      topic: rowObj.topic,
      difficulty: rowObj.difficulty,
      questionType: rowObj.questionType || rowObj.type,
      questionText: rowObj.questionText || rowObj.question,
      optionA: rowObj.optionA || rowObj.option_a,
      optionB: rowObj.optionB || rowObj.option_b,
      optionC: rowObj.optionC || rowObj.option_c,
      optionD: rowObj.optionD || rowObj.option_d,
      correctAnswer: rowObj.correctAnswer
        ? rowObj.correctAnswer
            .split(/[;|,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      solutionText: rowObj.solutionText || rowObj.solution,
      solutionType: rowObj.solutionType,
      keyFormula: rowObj.keyFormula,
      commonTrap: rowObj.commonTrap,
      license: rowObj.license,
      sourceUrl: rowObj.sourceUrl,
      provenanceVerified:
        rowObj.provenanceVerified === 'true' || rowObj.provenanceVerified === '1',
    };
    records.push(payload);
  }

  return records;
}

/**
 * 4. PDF-Extracted Text Parser (QPE / Question Paper Extractor format)
 * Parses structured text blocks extracted from official NTA/IIT question paper PDFs:
 * Example block:
 * Q1. [JEE_MAIN | 2025 | PHYSICS | KINEMATICS]
 * A particle moves with uniform acceleration...
 * (A) 10 m/s
 * (B) 20 m/s
 * (C) 30 m/s
 * (D) 40 m/s
 * Answer: B
 * Solution: Using v = u + at...
 */
export function parsePdfExtractedDataset(
  rawText: string,
  defaults: {
    exam?: string;
    year?: number;
    session?: string;
    shift?: number;
    subject?: string;
    license?: string;
    sourceUrl?: string;
    provenanceVerified?: boolean;
  } = {}
): RawExternalQuestionPayload[] {
  const blocks = rawText
    .split(/(?=^Q\d+[.:]\s)/m)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, idx) => {
    const headerMatch = block.match(
      /^Q(\d+)[.:]\s*(?:\[([^\]]+)\])?\s*([\s\S]*?)(?=\n\([A-D]\)|\nAnswer:|$)/i
    );
    const qNum = headerMatch ? headerMatch[1] : String(idx + 1);
    const bracketMeta = headerMatch?.[2] || '';
    const stemText = (headerMatch?.[3] || block).trim();

    const metaParts = bracketMeta.split('|').map((p) => p.trim());
    const exam = metaParts[0] || defaults.exam || 'JEE_MAIN';
    const year = Number(metaParts[1]) || defaults.year || 2025;
    const subject = metaParts[2] || defaults.subject || 'PHYSICS';
    const chapter = metaParts[3] || 'GENERAL';

    const optAMatch = block.match(/\n\(A\)\s*([^\n]+)/);
    const optBMatch = block.match(/\n\(B\)\s*([^\n]+)/);
    const optCMatch = block.match(/\n\(C\)\s*([^\n]+)/);
    const optDMatch = block.match(/\n\(D\)\s*([^\n]+)/);

    const ansMatch = block.match(/\nAnswer:\s*([^\n]+)/i);
    const solMatch = block.match(/\nSolution:\s*([\s\S]+)$/i);

    const hasOptions = Boolean(optAMatch && optBMatch && optCMatch && optDMatch);
    const rawAns = ansMatch ? ansMatch[1].trim() : '';

    return {
      externalId: `QPE-${exam}-${year}-Q${qNum}`,
      exam,
      year,
      session: defaults.session || 'JANUARY',
      shift: defaults.shift ?? 1,
      subject,
      chapter,
      topic: chapter,
      difficulty: 'MEDIUM',
      questionType: hasOptions ? 'MCQ_SINGLE' : 'NUMERICAL',
      questionText: stemText,
      optionA: optAMatch?.[1]?.trim(),
      optionB: optBMatch?.[1]?.trim(),
      optionC: optCMatch?.[1]?.trim(),
      optionD: optDMatch?.[1]?.trim(),
      correctAnswer: rawAns
        ? rawAns
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      solutionText: solMatch?.[1]?.trim() || '',
      solutionType: solMatch ? 'OFFICIAL' : 'PENDING',
      license: defaults.license || 'Public NTA/IIT Exam Record',
      sourceUrl: defaults.sourceUrl || 'https://github.com/SuperSat001/Question-Extractor',
      provenanceVerified: defaults.provenanceVerified ?? true,
    };
  });
}

/**
 * Dispatcher by source and format
 */
export function parseRawDatasetByFormat(
  content: string,
  format: 'JSON' | 'JSONL' | 'CSV' | 'PDF',
  sourceId: DatasetSourceId
): RawExternalQuestionPayload[] {
  let records: RawExternalQuestionPayload[];
  switch (format) {
    case 'JSON':
      records = parseJsonDataset(content);
      break;
    case 'JSONL':
      records = parseJsonlDataset(content);
      break;
    case 'CSV':
      records = parseCsvDataset(content);
      break;
    case 'PDF':
      records = parsePdfExtractedDataset(content);
      break;
    default:
      throw new Error(`Unsupported dataset format: ${String(format)}`);
  }

  return records.map((rec) => ({
    ...rec,
    source: rec.source || sourceId,
  }));
}

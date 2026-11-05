import type { StudyDocument, StudyPage, StudyTopic } from '../types/study';

export type SampleLanguage = 'en' | 'hi';

export interface LocalizedText {
  en: string;
  hi: string;
}

export interface SampleConcept {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  formula: string;
  page: number;
}

export interface SampleMcq {
  id: string;
  kind: 'mcq';
  topic: string;
  prompt: LocalizedText;
  options: LocalizedText[];
  correctIndex: number;
  explanation: LocalizedText;
  page: number;
}

export interface SampleNumerical {
  id: string;
  kind: 'numerical';
  topic: string;
  prompt: LocalizedText;
  answer: string;
  /** Other accepted typed answers, compared after removing spaces. */
  accepted: string[];
  explanation: LocalizedText;
  page: number;
}

export type SampleQuestion = SampleMcq | SampleNumerical;

/** Picks the English or Hinglish version of a piece of sample text. */
export function sampleText(text: LocalizedText, language: SampleLanguage): string {
  return language === 'hi' ? text.hi : text.en;
}

function normalizeSampleAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/%/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

function evaluateSampleAnswer(value: string): number | null {
  const parts = value.split('/');
  if (parts.length === 2) {
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
    return null;
  }
  const direct = Number(value);
  return Number.isFinite(direct) ? direct : null;
}

/**
 * Checks a typed numerical answer. Fractions such as 1/6 and decimals such as 0.167 are
 * accepted, and small rounding differences (0.166 → 0.167) are treated as correct.
 */
export function isSampleNumericalAnswer(question: SampleNumerical, typed: string): boolean {
  const normalized = normalizeSampleAnswer(typed);
  if (!normalized) return false;

  const accepted = [question.answer, ...question.accepted].map(normalizeSampleAnswer);
  if (accepted.includes(normalized)) return true;

  const typedValue = evaluateSampleAnswer(normalized);
  if (typedValue === null) return false;
  return accepted.some((candidate) => {
    const expected = evaluateSampleAnswer(candidate);
    return expected !== null && Math.abs(expected - typedValue) <= 0.002;
  });
}

export interface SampleFlashcard {
  id: string;
  front: LocalizedText;
  back: LocalizedText;
}

export const SAMPLE_CHAPTER_ID = 'doc-jee-sample-probability';
export const SAMPLE_CHAPTER_TITLE = 'Probability: Conditional Probability & Bayes’ Theorem';
export const SAMPLE_CHAPTER_SUBJECT = 'Mathematics · Class 12 · JEE Main';

export const SAMPLE_CONCEPTS: SampleConcept[] = [
  {
    id: 'conditional',
    title: { en: 'Conditional probability', hi: 'Conditional probability' },
    body: {
      en: 'It answers one question: if B has already happened, how likely is A? The sample space shrinks from every possible outcome to just B, so we divide by P(B).',
      hi: 'Ye ek hi sawaal ka jawab deta hai: agar B already ho chuka hai, to A hone ke chances kitne hain? Sample space sab outcomes se sikud kar sirf B ban jaata hai, isliye P(B) se divide karte hain.',
    },
    formula: 'P(A | B) = P(A ∩ B) / P(B),  P(B) > 0',
    page: 1,
  },
  {
    id: 'total-probability',
    title: { en: 'Law of total probability', hi: 'Law of total probability' },
    body: {
      en: 'If A₁, A₂, … form a partition, exactly one of them must happen. Split the chance of B across those cases, weighted by how likely each case is.',
      hi: 'Agar A₁, A₂, … ek partition banate hain, to inme se exactly ek hi hoga. B ke chances ko un cases mein tod do, har case ke probability ke hisaab se.',
    },
    formula: 'P(B) = Σ P(B | Aᵢ) · P(Aᵢ)',
    page: 2,
  },
  {
    id: 'bayes',
    title: { en: 'Bayes’ theorem', hi: 'Bayes’ theorem' },
    body: {
      en: 'Bayes flips a conditional probability: it turns P(B | A) into P(A | B). In a test or a two-bag problem, it updates the prior chance after seeing the evidence.',
      hi: 'Bayes conditional probability ko ulta karta hai: P(B | A) se P(A | B) nikalta hai. Test ya two-bag problem mein evidence dekhne ke baad prior chance update hota hai.',
    },
    formula: 'P(A | B) = P(B | A) · P(A) / P(B)',
    page: 3,
  },
  {
    id: 'independence',
    title: { en: 'Independence is not “mutually exclusive”', hi: 'Independent aur mutually exclusive alag hain' },
    body: {
      en: 'Independent events do not affect each other. Mutually exclusive events cannot happen together. Two non-zero mutually exclusive events are never independent.',
      hi: 'Independent events ek dusre ko affect nahi karte. Mutually exclusive events saath nahi ho sakte. Do non-zero mutually exclusive events kabhi independent nahi ho sakte.',
    },
    formula: 'P(A ∩ B) = P(A) · P(B)  ⟺  independent',
    page: 4,
  },
];

export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    id: 'bag-bayes',
    kind: 'mcq',
    topic: 'Bayes’ theorem',
    prompt: {
      en: 'Bag A has 3 red and 2 blue balls. Bag B has 1 red and 4 blue balls. A fair coin picks a bag, then one ball is drawn and it is red. What is P(Bag A | red)?',
      hi: 'Bag A mein 3 red aur 2 blue balls hain. Bag B mein 1 red aur 4 blue balls hain. Ek fair coin se bag chuna jaata hai, phir ek ball nikalti hai jo red hai. P(Bag A | red) kya hai?',
    },
    options: [
      { en: '1/2', hi: '1/2' },
      { en: '3/4', hi: '3/4' },
      { en: '2/5', hi: '2/5' },
      { en: '1/4', hi: '1/4' },
    ],
    correctIndex: 1,
    explanation: {
      en: 'P(A) = P(B) = 1/2, P(red | A) = 3/5 and P(red | B) = 1/5. Total P(red) = (1/2)(3/5) + (1/2)(1/5) = 2/5. So P(A | red) = (3/10) ÷ (2/5) = 3/4.',
      hi: 'P(A) = P(B) = 1/2, P(red | A) = 3/5 aur P(red | B) = 1/5. Total P(red) = (1/2)(3/5) + (1/2)(1/5) = 2/5. Isliye P(A | red) = (3/10) ÷ (2/5) = 3/4.',
    },
    page: 3,
  },
  {
    id: 'conditional-number',
    kind: 'numerical',
    topic: 'Conditional probability',
    prompt: {
      en: 'If P(A) = 0.5, P(B) = 0.4 and P(A ∩ B) = 0.2, find P(A | B). Type a decimal or a fraction.',
      hi: 'Agar P(A) = 0.5, P(B) = 0.4 aur P(A ∩ B) = 0.2 hai, to P(A | B) nikalo. Decimal ya fraction mein likho.',
    },
    answer: '0.5',
    accepted: ['0.5', '1/2', '.5'],
    explanation: {
      en: 'P(A | B) = P(A ∩ B) / P(B) = 0.2 / 0.4 = 0.5.',
      hi: 'P(A | B) = P(A ∩ B) / P(B) = 0.2 / 0.4 = 0.5.',
    },
    page: 1,
  },
  {
    id: 'independence-union',
    kind: 'mcq',
    topic: 'Independent events',
    prompt: {
      en: 'A and B are independent with P(A) = 1/2 and P(B) = 1/3. Find P(A ∪ B).',
      hi: 'A aur B independent hain, P(A) = 1/2 aur P(B) = 1/3. P(A ∪ B) nikalo.',
    },
    options: [
      { en: '5/6', hi: '5/6' },
      { en: '2/3', hi: '2/3' },
      { en: '1/6', hi: '1/6' },
      { en: '1/3', hi: '1/3' },
    ],
    correctIndex: 1,
    explanation: {
      en: 'Independence gives P(A ∩ B) = (1/2)(1/3) = 1/6. Then P(A ∪ B) = 1/2 + 1/3 − 1/6 = 2/3.',
      hi: 'Independence se P(A ∩ B) = (1/2)(1/3) = 1/6. Phir P(A ∪ B) = 1/2 + 1/3 − 1/6 = 2/3.',
    },
    page: 4,
  },
  {
    id: 'disease-test',
    kind: 'numerical',
    topic: 'Bayes’ theorem',
    prompt: {
      en: 'A disease affects 1% of people. A test is 99% sensitive and has a 5% false-positive rate. A person tests positive. Find P(disease | positive) as a fraction or decimal to 3 places.',
      hi: 'Ek disease 1% logon ko hoti hai. Test 99% sensitive hai aur false-positive rate 5% hai. Ek person ka test positive aata hai. P(disease | positive) fraction ya 3 decimal places tak nikalo.',
    },
    answer: '1/6',
    accepted: ['1/6', '0.167', '0.1667', '16.7%', '0.166'],
    explanation: {
      en: 'P(D | +) = (0.01 × 0.99) / (0.01 × 0.99 + 0.99 × 0.05) = 0.0099 / 0.0594 = 1/6 ≈ 0.167. Most positives still come from healthy people when the disease is rare.',
      hi: 'P(D | +) = (0.01 × 0.99) / (0.01 × 0.99 + 0.99 × 0.05) = 0.0099 / 0.0594 = 1/6 ≈ 0.167. Disease rare ho to zyada positive reports healthy logon ki bhi aati hain.',
    },
    page: 3,
  },
];

export const SAMPLE_FLASHCARDS: SampleFlashcard[] = [
  {
    id: 'flash-conditional',
    front: { en: 'Conditional probability P(A | B)', hi: 'Conditional probability P(A | B)' },
    back: {
      en: 'P(A ∩ B) / P(B), provided P(B) > 0. It restricts the sample space to B.',
      hi: 'P(A ∩ B) / P(B), agar P(B) > 0. Isme sample space B tak restrict ho jaata hai.',
    },
  },
  {
    id: 'flash-bayes',
    front: { en: 'Bayes’ theorem', hi: 'Bayes’ theorem' },
    back: {
      en: 'P(A | B) = P(B | A) P(A) / P(B). Use the law of total probability for P(B).',
      hi: 'P(A | B) = P(B | A) P(A) / P(B). P(B) ke liye law of total probability use karo.',
    },
  },
  {
    id: 'flash-independence',
    front: { en: 'Independence test', hi: 'Independence test' },
    back: {
      en: 'A and B are independent exactly when P(A ∩ B) = P(A) P(B).',
      hi: 'A aur B independent tab hain jab P(A ∩ B) = P(A) P(B) ho.',
    },
  },
  {
    id: 'flash-total',
    front: { en: 'Law of total probability', hi: 'Law of total probability' },
    back: {
      en: 'For a partition A₁, A₂, …, P(B) = Σ P(B | Aᵢ) P(Aᵢ).',
      hi: 'Partition A₁, A₂, … ke liye P(B) = Σ P(B | Aᵢ) P(Aᵢ).',
    },
  },
  {
    id: 'flash-trap',
    front: { en: 'Mutually exclusive vs independent', hi: 'Mutually exclusive vs independent' },
    back: {
      en: 'Mutually exclusive means P(A ∩ B) = 0. Independent means P(A ∩ B) = P(A) P(B). For non-zero probabilities, they cannot both be true.',
      hi: 'Mutually exclusive ka matlab P(A ∩ B) = 0. Independent ka matlab P(A ∩ B) = P(A) P(B). Non-zero probabilities ke saath dono ek saath sach nahi ho sakte.',
    },
  },
  {
    id: 'flash-multiplication',
    front: { en: 'Multiplication rule', hi: 'Multiplication rule' },
    back: {
      en: 'P(A ∩ B) = P(A | B) P(B) = P(B | A) P(A).',
      hi: 'P(A ∩ B) = P(A | B) P(B) = P(B | A) P(A).',
    },
  },
];

const SAMPLE_PAGES: StudyPage[] = [
  {
    pageNumber: 1,
    title: 'Conditional Probability and the Multiplication Rule',
    content: `1. Conditional probability
For two events A and B with P(B) > 0:
  P(A | B) = P(A ∩ B) / P(B)

Intuition: once we know B happened, the sample space shrinks from Ω to B. Only the part of A that lies inside B can still happen.

2. Multiplication rule
Rearranging the definition:
  P(A ∩ B) = P(A | B) · P(B) = P(B | A) · P(A)

3. Worked example
P(A) = 0.5, P(B) = 0.4 and P(A ∩ B) = 0.2.
  P(A | B) = 0.2 / 0.4 = 0.5
  P(B | A) = 0.2 / 0.5 = 0.4

JEE tip: conditional probability is not symmetric. P(A | B) and P(B | A) are usually different.`,
  },
  {
    pageNumber: 2,
    title: 'Law of Total Probability',
    content: `1. Partition of the sample space
Events A₁, A₂, …, Aₙ form a partition when:
  • they are pairwise disjoint: Aᵢ ∩ Aⱼ = ∅ for i ≠ j
  • their union is the whole sample space: A₁ ∪ A₂ ∪ … ∪ Aₙ = Ω

Exactly one Aᵢ must happen.

2. Law of total probability
For any event B:
  P(B) = P(B | A₁)P(A₁) + P(B | A₂)P(A₂) + … + P(B | Aₙ)P(Aₙ)

For a two-part partition {A, Aᶜ}:
  P(B) = P(B | A)P(A) + P(B | Aᶜ)P(Aᶜ)

3. Worked example
A factory has two machines. Machine 1 makes 60% of items with 2% defects; machine 2 makes 40% with 5% defects. The defect rate for a random item is:
  P(defective) = 0.02 × 0.60 + 0.05 × 0.40 = 0.012 + 0.020 = 0.032 (3.2%).

JEE tip: the weights P(Aᵢ) must add to 1.`,
  },
  {
    pageNumber: 3,
    title: 'Bayes’ Theorem and Diagnostic Tests',
    content: `1. Bayes’ theorem
If A₁, A₂, …, Aₙ form a partition and P(B) > 0:
  P(Aᵢ | B) = P(B | Aᵢ) P(Aᵢ) / P(B)

For two events:
  P(A | B) = P(B | A) P(A) / [P(B | A)P(A) + P(B | Aᶜ)P(Aᶜ)]

Terminology:
  • P(Aᵢ): prior probability
  • P(B | Aᵢ): likelihood
  • P(Aᵢ | B): posterior probability
  • P(B): normalising evidence

2. Two-bag example
Bag A has 3 red and 2 blue balls; Bag B has 1 red and 4 blue balls. A fair coin picks a bag, then a red ball is drawn.
  P(A) = 1/2, P(red | A) = 3/5, P(red | B) = 1/5
  P(red) = (1/2)(3/5) + (1/2)(1/5) = 2/5
  P(A | red) = (3/10) / (2/5) = 3/4

3. Base-rate example
A disease affects 1% of people. The test is 99% sensitive and has a 5% false-positive rate.
  P(disease | positive) = (0.01 × 0.99) / (0.01 × 0.99 + 0.99 × 0.05)
                        = 0.0099 / 0.0594 = 1/6 ≈ 0.167
Most positive tests can still come from healthy people when the disease is rare.

JEE tip: write the prior, likelihood and evidence separately before substituting.`,
  },
  {
    pageNumber: 4,
    title: 'Independence and Exam Traps',
    content: `1. Independent events
A and B are independent exactly when:
  P(A ∩ B) = P(A) · P(B)
Equivalently, P(A | B) = P(A) when P(B) > 0.

2. Mutually exclusive events
A and B are mutually exclusive when:
  P(A ∩ B) = 0
They cannot happen together.

3. The most common trap
Mutually exclusive and independent are not the same. If P(A) > 0 and P(B) > 0 and A, B are mutually exclusive, then:
  P(A | B) = 0, while P(A) > 0
so they are not independent.

4. Union of independent events
For independent A and B:
  P(A ∪ B) = P(A) + P(B) − P(A)P(B)

Worked example: P(A) = 1/2, P(B) = 1/3, independent.
  P(A ∩ B) = 1/6
  P(A ∪ B) = 1/2 + 1/3 − 1/6 = 2/3

5. Exam checklist
  • Conditional probability divides by the condition's probability.
  • Bayes needs the total probability in the denominator.
  • Check whether events are independent before multiplying.
  • For a numerical answer, sanity-check that a probability lies between 0 and 1.`,
  },
];

const SAMPLE_TOPICS: StudyTopic[] = [
  {
    id: 'sample-conditional',
    name: 'Conditional Probability',
    summary: 'P(A | B) and the multiplication rule, with a worked numerical example.',
    keyConcepts: ['P(A | B) = P(A ∩ B) / P(B)', 'Multiplication rule', 'Conditional probability is not symmetric'],
    sourcePages: [1],
  },
  {
    id: 'sample-total',
    name: 'Law of Total Probability',
    summary: 'Splitting the probability of an event across a partition of the sample space.',
    keyConcepts: ['Partition', 'P(B) = Σ P(B | Aᵢ)P(Aᵢ)', 'Weighted average of cases'],
    sourcePages: [2],
  },
  {
    id: 'sample-bayes',
    name: 'Bayes’ Theorem',
    summary: 'Updating a prior probability after evidence, including two-bag and diagnostic-test examples.',
    keyConcepts: ['Prior and posterior', 'Likelihood', 'Base-rate fallacy', 'Two-bag problem'],
    sourcePages: [3],
  },
  {
    id: 'sample-independence',
    name: 'Independence and Exam Traps',
    summary: 'Independent vs mutually exclusive events, union of independent events and a final checklist.',
    keyConcepts: ['P(A ∩ B) = P(A)P(B)', 'Mutually exclusive', 'P(A ∪ B) formula', 'Exam checklist'],
    sourcePages: [4],
  },
];

/** The fixed sample chapter as a normal study document, ready to add to an account. */
export function buildSampleChapterDocument(): StudyDocument {
  const now = new Date().toISOString();
  return {
    id: SAMPLE_CHAPTER_ID,
    title: `${SAMPLE_CHAPTER_TITLE}.pdf`,
    sourceType: 'text',
    pageCount: SAMPLE_PAGES.length,
    pages: SAMPLE_PAGES.map((page) => ({ ...page })),
    createdAt: now,
    lastStudiedAt: now,
    topics: SAMPLE_TOPICS.map((topic) => ({
      ...topic,
      keyConcepts: [...topic.keyConcepts],
      sourcePages: [...topic.sourcePages],
    })),
    overview:
      'A fixed LearnMate sample chapter on conditional probability, the law of total probability, Bayes’ theorem and independence, with JEE-style practice. Written by us; no AI is used.',
  };
}

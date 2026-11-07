import React, { useState } from 'react';
import {
  CheckCircle2,
  Lightbulb,
  PenLine,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import {
  isSampleNumericalAnswer,
  sampleText,
  type SampleFlashcard,
  type SampleLanguage,
  type SampleQuestion,
} from '../data/sampleChapter';

export const LanguageToggle: React.FC<{
  value: SampleLanguage;
  onChange: (language: SampleLanguage) => void;
  label?: string;
}> = ({ value, onChange, label = 'Language' }) => (
  <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1">
    <span className="sr-only">{label}</span>
    {(
      [
        { id: 'en' as const, label: 'English' },
        { id: 'hi' as const, label: 'Hinglish' },
      ]
    ).map((option) => (
      <button
        key={option.id}
        type="button"
        onClick={() => onChange(option.id)}
        aria-pressed={value === option.id}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
          value === option.id
            ? 'bg-brand text-white shadow-xs'
            : 'text-muted hover:text-ink hover:bg-soft'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

interface SampleQuestionCardProps {
  question: SampleQuestion;
  language: SampleLanguage;
  compact?: boolean;
}

/** A self-contained JEE-style question for the public sample. No AI, no account needed. */
export const SampleQuestionCard: React.FC<SampleQuestionCardProps> = ({
  question,
  language,
  compact = false,
}) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);

  const isMcq = question.kind === 'mcq';
  const isCorrect =
    checked &&
    (isMcq
      ? selected === question.correctIndex
      : isSampleNumericalAnswer(question, typed));

  const reset = () => {
    setSelected(null);
    setTyped('');
    setChecked(false);
  };

  return (
    <article className={`lm-card-editorial ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
            isMcq ? 'bg-brand-soft text-brand' : 'bg-success-soft text-success'
          }`}
        >
          {isMcq ? 'MCQ · +4 / −1' : 'Numerical · +4 / −1'}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-soft text-muted text-[10px] font-semibold">
          {question.topic}
        </span>
        <span className="text-[10px] text-muted ml-auto">Page {question.page}</span>
      </div>

      <p className="font-medium text-ink leading-relaxed text-sm sm:text-base">
        {sampleText(question.prompt, language)}
      </p>

      {isMcq ? (
        <div className="grid gap-2">
          {question.options.map((option, index) => {
            const chosen = selected === index;
            const correctOption = checked && index === question.correctIndex;
            const wrongOption = checked && chosen && index !== question.correctIndex;
            return (
              <button
                key={`${question.id}-option-${index}`}
                type="button"
                onClick={() => {
                  if (checked) return;
                  setSelected(index);
                  setChecked(true);
                }}
                disabled={checked}
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  correctOption
                    ? 'border-success bg-success-soft text-ink'
                    : wrongOption
                      ? 'border-danger bg-danger-soft text-ink'
                      : chosen
                        ? 'border-brand bg-brand-soft text-ink'
                        : 'border-line bg-white text-body hover:border-brand-200 hover:bg-brand-soft/40 cursor-pointer'
                } disabled:cursor-default`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    correctOption
                      ? 'bg-success text-white'
                      : wrongOption
                        ? 'bg-danger text-white'
                        : 'bg-soft text-muted'
                  }`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{sampleText(option, language)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!typed.trim()) return;
            setChecked(true);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              setChecked(false);
            }}
            inputMode="text"
            aria-label="Your numerical answer"
            placeholder="Type a decimal or fraction, e.g. 0.5 or 1/2"
            className="flex-1 h-10 rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!typed.trim()}
            className="h-10 px-4 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            Check answer
          </button>
        </form>
      )}

      {checked && (
        <div
          aria-live="polite"
          className={`rounded-xl border p-3.5 text-sm ${
            isCorrect
              ? 'border-success/30 bg-success-soft text-ink'
              : 'border-danger/30 bg-danger-soft text-ink'
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            {isCorrect ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-danger shrink-0" />
            )}
            {isCorrect ? 'Correct.' : 'Not quite.'}
            {question.kind === 'numerical' && !isCorrect && (
              <span className="font-normal text-muted">
                Correct answer: {question.answer}
              </span>
            )}
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-body leading-relaxed">
            <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span>{sampleText(question.explanation, language)}</span>
          </p>
        </div>
      )}

      {checked && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}

      {!checked && !isMcq && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <PenLine className="w-3.5 h-3.5" />
          In JEE Main a wrong numerical answer also costs 1 mark, so skip it if you are guessing.
        </p>
      )}
    </article>
  );
};

/** Flip card with a prompt on the front and the answer on the back. */
export const SampleFlashcardCard: React.FC<{
  card: SampleFlashcard;
  language: SampleLanguage;
}> = ({ card, language }) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      aria-pressed={flipped}
      className={`min-h-36 w-full rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
        flipped
          ? 'border-brand-200 bg-brand-soft'
          : 'border-line bg-white hover:border-brand-200 hover:bg-canvas'
      }`}
    >
      <span className="lm-kicker text-[10px]">{flipped ? 'Answer' : 'Flashcard'}</span>
      <span className="mt-2 block text-sm font-semibold text-ink leading-relaxed">
        {sampleText(flipped ? card.back : card.front, language)}
      </span>
      <span className="mt-3 block text-[11px] font-medium text-muted">
        {flipped ? 'Tap to hide the answer' : 'Tap to reveal the answer'}
      </span>
    </button>
  );
};

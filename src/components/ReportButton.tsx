import React, { useEffect, useRef, useState } from 'react';
import { Check, Flag, Loader2 } from 'lucide-react';
import { studyStorage, type AiReportKind, type AiReportReason } from '../services/storageService';

const REASONS: Array<{ id: AiReportReason; label: string }> = [
  { id: 'wrong', label: 'Wrong answer' },
  { id: 'unclear', label: 'Hard to understand' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'other', label: 'Something else' },
];

interface ReportButtonProps {
  kind: AiReportKind;
  /** The AI-written text being reported. */
  excerpt: string;
  documentId?: string;
  className?: string;
}

/** Lets a student flag an AI answer; the report is saved privately for the LearnMate team. */
export const ReportButton: React.FC<ReportButtonProps> = ({ kind, excerpt, documentId, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AiReportReason>('wrong');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const send = async () => {
    setState('sending');
    setError(null);
    try {
      await studyStorage.submitAiReport({ kind, reason, note, excerpt, documentId });
      setState('sent');
      window.setTimeout(() => setOpen(false), 1400);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Could not send the report. Please try again.');
    }
  };

  if (state === 'sent' && !open) {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold text-success ${className}`}>
        <Check className="w-3.5 h-3.5" />
        Reported. Thank you
      </span>
    );
  }

  return (
    <div ref={panelRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Report a problem with this AI answer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-danger cursor-pointer"
      >
        <Flag className="w-3.5 h-3.5" />
        Report
      </button>

      {open && (
        <div className="absolute z-30 right-0 bottom-full mb-2 w-64 rounded-xl border border-line bg-white shadow-xl p-3 space-y-2.5 text-left">
          {state === 'sent' ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="w-4 h-4" />
              Thanks, we'll review this.
            </p>
          ) : (
            <>
              <p className="text-xs font-bold text-ink">What's wrong with this answer?</p>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold cursor-pointer ${
                      reason === r.id
                        ? 'bg-brand-soft border-brand text-brand'
                        : 'border-line text-body hover:border-brand/40'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Optional: what should it say?"
                className="w-full px-2.5 py-2 rounded-lg border border-line bg-canvas text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand resize-none"
              />
              {error && <p className="text-[11px] text-danger">{error}</p>}
              <button
                type="button"
                onClick={send}
                disabled={state === 'sending'}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg lm-btn-accent text-xs cursor-pointer"
              >
                {state === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send report
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

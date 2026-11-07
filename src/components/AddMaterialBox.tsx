import React, { useRef, useState } from 'react';
import {
  Camera,
  ClipboardPaste,
  FileText,
  Loader2,
  Upload,
  Youtube,
} from 'lucide-react';
import type { AddMaterialMode } from './AddMaterialModal';

interface AddMaterialBoxProps {
  isProcessing?: boolean;
  onDropFile: (file: File) => void;
  onOpenMode: (mode: AddMaterialMode) => void;
}

const CHOICES: Array<{
  mode: AddMaterialMode;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    mode: 'pdf',
    label: 'PDF',
    detail: 'Drop or pick a chapter PDF',
    icon: FileText,
  },
  {
    mode: 'photo',
    label: 'Photo of notes',
    detail: 'Handwritten or coaching page',
    icon: Camera,
  },
  {
    mode: 'youtube',
    label: 'YouTube link',
    detail: 'Player + pasted transcript',
    icon: Youtube,
  },
  {
    mode: 'paste',
    label: 'Paste text',
    detail: 'Formulas or chapter notes',
    icon: ClipboardPaste,
  },
];

export const AddMaterialBox: React.FC<AddMaterialBoxProps> = ({
  isProcessing = false,
  onDropFile,
  onOpenMode,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onDropFile(file);
    }
  };

  return (
    <section
      aria-label="Add study material"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      data-testid="home-add-material-box"
      className={`lm-card-editorial p-4 sm:p-5 transition-colors ${
        isDragOver ? 'border-brand bg-brand-soft/40' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onDropFile(file);
          e.target.value = '';
        }}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Dropzone prompt */}
        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="flex items-center gap-3.5 rounded-xl border border-dashed border-line bg-canvas hover:border-brand-200 px-4 py-3 cursor-pointer transition-colors flex-1 min-w-0"
        >
          <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink truncate">
              {isProcessing
                ? 'Adding your study material…'
                : 'Add study material — drop a PDF or photo here'}
            </p>
            <p className="text-xs text-muted truncate">
              Or pick one of the four ways below to start studying.
            </p>
          </div>
        </div>

        {/* Right: 4 choices */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {CHOICES.map((choice) => {
            const Icon = choice.icon;
            return (
              <button
                key={choice.mode}
                type="button"
                disabled={isProcessing}
                onClick={() => onOpenMode(choice.mode)}
                data-testid={`home-add-${choice.mode}-btn`}
                className="flex items-center gap-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:border-brand-200 hover:bg-brand-soft/30 px-3 py-2.5 text-left transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="w-7 h-7 rounded-lg bg-soft text-brand flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-ink truncate">{choice.label}</span>
                  <span className="hidden xl:block text-[10px] text-muted truncate">
                    {choice.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

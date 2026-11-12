import React, { useEffect, useState } from 'react';
import { WifiOff, Download, Loader2, CheckCircle2, X } from 'lucide-react';
import type { BackgroundJobRecord } from '../utils/commercialScaleEngine';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    triggerInstall,
  };
}

interface PwaOfflineAndJobsBarProps {
  activeJobs?: BackgroundJobRecord[];
  onDismissJob?: (jobId: string) => void;
}

export const PwaOfflineAndJobsBar: React.FC<PwaOfflineAndJobsBarProps> = ({
  activeJobs = [],
  onDismissJob,
}) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const { canInstall, triggerInstall } = usePWAInstallPrompt();

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline && !canInstall && activeJobs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm lm-no-print">
      {/* Offline PWA Banner */}
      {!isOnline && (
        <div
          role="status"
          data-testid="pwa-offline-banner"
          className="px-4 py-2.5 rounded-xl bg-amber-600 text-white shadow-lg flex items-center gap-2.5 text-xs font-semibold"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline Mode — Saved Notes, Formula Book &amp; PYQs remain available</span>
        </div>
      )}

      {/* In-App Install Prompt when browser fires beforeinstallprompt */}
      {canInstall && (
        <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#121A2E] border border-line shadow-lg flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-ink">Install LearnMate Desktop / Offline App</span>
          <button
            type="button"
            onClick={triggerInstall}
            data-testid="pwa-install-app-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white font-bold cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        </div>
      )}

      {/* Background Job Progress Tracker Toasts */}
      {activeJobs.slice(0, 2).map((job) => (
        <div
          key={job.jobId}
          data-testid={`background-job-toast-${job.jobId}`}
          className="p-3.5 rounded-xl bg-white dark:bg-[#121A2E] border border-line shadow-xl space-y-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-ink truncate">
              {job.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
              )}
              <span className="truncate">{job.title}</span>
            </div>
            {onDismissJob && (
              <button
                type="button"
                onClick={() => onDismissJob(job.jobId)}
                aria-label="Dismiss background job toast"
                className="text-muted hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="truncate">{job.stepLabel}</span>
            <span className="font-mono tabular-nums font-bold text-ink">{job.progressPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-soft overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${job.progressPct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

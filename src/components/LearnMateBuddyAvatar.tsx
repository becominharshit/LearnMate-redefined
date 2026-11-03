import React, { useEffect, useState } from 'react';

export type BuddyAvatarState =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'thinking'
  | 'speaking';

export type MouthShape = 'closed' | 'slightly_open' | 'open' | 'wide';

interface LearnMateBuddyAvatarProps {
  state: BuddyAvatarState;
  /** Real-time normalized output audio energy (0.0 to 1.0) from Web Audio AnalyserNode */
  outputEnergy: number;
  inputEnergy?: number;
}

export function resolveMouthShape(
  state: BuddyAvatarState,
  outputEnergy: number,
  reducedMotion: boolean
): MouthShape {
  if (state !== 'speaking' || outputEnergy <= 0.02) {
    return 'closed';
  }
  if (reducedMotion) {
    return 'slightly_open';
  }
  if (outputEnergy > 0.48) {
    return 'wide';
  }
  if (outputEnergy > 0.22) {
    return 'open';
  }
  return 'slightly_open';
}

export const LearnMateBuddyAvatar: React.FC<LearnMateBuddyAvatarProps> = ({
  state,
  outputEnergy,
  inputEnergy = 0,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Natural periodic eye blink when not reduced-motion
  useEffect(() => {
    if (reducedMotion) {
      setIsBlinking(false);
      return;
    }
    let timeoutId: number;
    const intervalId = window.setInterval(() => {
      setIsBlinking(true);
      timeoutId = window.setTimeout(() => setIsBlinking(false), 150);
    }, 3600);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [reducedMotion]);

  const mouthShape = resolveMouthShape(state, outputEnergy, reducedMotion);

  // Subtle eye gaze offsets based on state
  const pupilOffsetX = state === 'thinking' ? 2.5 : 0;
  const pupilOffsetY = state === 'thinking' ? -3 : state === 'listening' ? 0.5 : 0;

  const stateBadgeConfig: Record<
    BuddyAvatarState,
    { label: string; dotColor: string; ringColor: string }
  > = {
    idle: {
      label: 'Idle · Ready',
      dotColor: '#64748B',
      ringColor: 'rgba(66, 133, 244, 0.22)',
    },
    requesting_permission: {
      label: 'Requesting Mic Permission',
      dotColor: '#FBBC05',
      ringColor: 'rgba(251, 188, 5, 0.35)',
    },
    listening: {
      label: 'Listening to You',
      dotColor: '#4285F4',
      ringColor: 'rgba(66, 133, 244, 0.45)',
    },
    thinking: {
      label: 'Thinking...',
      dotColor: '#FBBC05',
      ringColor: 'rgba(251, 188, 5, 0.45)',
    },
    speaking: {
      label: 'LearnMate Buddy Speaking',
      dotColor: '#34A853',
      ringColor: 'rgba(52, 168, 83, 0.5)',
    },
  };

  const currentBadge = stateBadgeConfig[state];
  const activeGlowScale =
    reducedMotion
      ? 1
      : state === 'speaking'
      ? 1 + Math.min(0.12, outputEnergy * 0.2)
      : state === 'listening'
      ? 1 + Math.min(0.08, inputEnergy * 0.16)
      : 1;

  return (
    <div
      className="flex flex-col items-center justify-center select-none"
      data-testid="learnmate-buddy-avatar"
      data-avatar-state={state}
      data-mouth-shape={mouthShape}
    >
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Soft Google 4-color ambient halo */}
        <div
          className="absolute inset-2 rounded-full transition-transform duration-100 pointer-events-none"
          style={{
            transform: `scale(${activeGlowScale})`,
            background:
              'conic-gradient(from 45deg, rgba(66,133,244,0.22), rgba(234,67,53,0.18), rgba(251,188,5,0.20), rgba(52,168,83,0.22), rgba(66,133,244,0.22))',
            filter: 'blur(10px)',
          }}
        />

        {/* Core 2D SVG Character: LearnMate Buddy */}
        <svg
          width="136"
          height="136"
          viewBox="0 0 140 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={`LearnMate Buddy Avatar (${currentBadge.label})`}
          className="relative z-10 drop-shadow-xs"
        >
          <defs>
            <linearGradient id="buddyRingGrad" x1="16" y1="16" x2="124" y2="124" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="35%" stopColor="#EA4335" />
              <stop offset="70%" stopColor="#FBBC05" />
              <stop offset="100%" stopColor="#34A853" />
            </linearGradient>
            <linearGradient id="buddyFaceGrad" x1="30" y1="24" x2="110" y2="118" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F1F5F9" />
            </linearGradient>
          </defs>

          {/* Outer Google-accented ring */}
          <circle
            cx="70"
            cy="74"
            r="50"
            stroke="url(#buddyRingGrad)"
            strokeWidth={state === 'speaking' || state === 'listening' ? '3.5' : '2.5'}
            strokeOpacity="0.85"
          />

          {/* Top Mortarboard / Academic Antenna Accent */}
          <g
            style={{
              transformOrigin: '70px 24px',
              transform:
                !reducedMotion && state === 'thinking' ? 'rotate(-5deg)' : 'rotate(0deg)',
              transition: 'transform 250ms ease',
            }}
          >
            <line x1="70" y1="16" x2="70" y2="25" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
            <polygon points="70,8 84,14 70,20 56,14" fill="#4285F4" />
            <circle
              cx="84"
              cy="16"
              r="2.5"
              fill={state === 'thinking' ? '#FBBC05' : '#34A853'}
            />
          </g>

          {/* Left & Right Earphone Pods (Google Blue & Green accents) */}
          <rect
            x="13"
            y="60"
            width="9"
            height="26"
            rx="4.5"
            fill={state === 'listening' ? '#4285F4' : '#94A3B8'}
          />
          <rect
            x="118"
            y="60"
            width="9"
            height="26"
            rx="4.5"
            fill={state === 'speaking' ? '#34A853' : '#94A3B8'}
          />

          {/* Rounded Friendly Face */}
          <circle
            cx="70"
            cy="74"
            r="46"
            fill="url(#buddyFaceGrad)"
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />

          {/* Subtle Warm Cheek Accents */}
          <ellipse cx="43" cy="83" rx="6.5" ry="3.5" fill="#EA4335" fillOpacity="0.16" />
          <ellipse cx="97" cy="83" rx="6.5" ry="3.5" fill="#EA4335" fillOpacity="0.16" />

          {/* Expressive Eyebrows */}
          <path
            d={
              state === 'thinking'
                ? 'M44 54 Q52 49 58 53'
                : state === 'listening' || state === 'speaking'
                ? 'M44 53 Q51 49 58 53'
                : 'M44 55 Q51 52 58 55'
            }
            stroke="#334155"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d={
              state === 'thinking'
                ? 'M82 51 Q89 46 96 51'
                : state === 'listening' || state === 'speaking'
                ? 'M82 53 Q89 49 96 53'
                : 'M82 55 Q89 52 96 55'
            }
            stroke="#334155"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Eyes (Blink or attentive pupils) */}
          {isBlinking ? (
            <>
              <path d="M44 67 Q51 70 58 67" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M82 67 Q89 70 96 67" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
            </>
          ) : (
            <>
              <g>
                <circle cx="51" cy="67" r="6.2" fill="#1E293B" />
                <circle
                  cx={51 + pupilOffsetX}
                  cy={67 + pupilOffsetY}
                  r="2.3"
                  fill="#FFFFFF"
                />
              </g>
              <g>
                <circle cx="89" cy="67" r="6.2" fill="#1E293B" />
                <circle
                  cx={89 + pupilOffsetX}
                  cy={67 + pupilOffsetY}
                  r="2.3"
                  fill="#FFFFFF"
                />
              </g>
            </>
          )}

          {/* Mouth — Synchronized to real output audio energy */}
          {mouthShape === 'closed' && (
            <path
              d={
                state === 'thinking'
                  ? 'M63 92 Q70 91 76 93'
                  : 'M59 90 Q70 97 81 90'
              }
              stroke="#1E293B"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {mouthShape === 'slightly_open' && (
            <ellipse
              cx="70"
              cy="92"
              rx="8.5"
              ry="4.2"
              fill="#1E293B"
            />
          )}

          {mouthShape === 'open' && (
            <g>
              <ellipse cx="70" cy="92.5" rx="10.5" ry="6.8" fill="#1E293B" />
              <path d="M63 95 Q70 92 77 95" fill="#EA4335" fillOpacity="0.85" />
            </g>
          )}

          {mouthShape === 'wide' && (
            <g>
              <rect x="58" y="84" width="24" height="16" rx="8" fill="#1E293B" />
              <ellipse cx="70" cy="96" rx="7.5" ry="3.5" fill="#EA4335" fillOpacity="0.9" />
            </g>
          )}

          {/* State-Specific Visual Indicators */}
          {/* 1. Listening Mic Soundwave Arcs */}
          {state === 'listening' && (
            <g opacity="0.85">
              <path
                d="M7 66 Q3 73 7 80"
                stroke="#4285F4"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M133 66 Q137 73 133 80"
                stroke="#4285F4"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* 2. Thinking Dots (ONLY shown while waiting for model response) */}
          {state === 'thinking' && (
            <g data-testid="buddy-thinking-dots">
              <circle cx="106" cy="34" r="3.2" fill="#FBBC05" />
              <circle cx="115" cy="26" r="4.2" fill="#4285F4" />
              <circle cx="125" cy="18" r="5" fill="#34A853" />
            </g>
          )}
        </svg>
      </div>

      {/* Compact State Pill */}
      <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200/90 shadow-2xs text-[11px] font-semibold text-ink">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: currentBadge.dotColor }}
        />
        <span>{currentBadge.label}</span>
      </div>
    </div>
  );
};

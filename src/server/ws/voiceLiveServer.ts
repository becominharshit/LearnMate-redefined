import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { authenticateStudent, type TokenVerifier } from '../middleware/authAndSecurity.ts';
import type { DistributedRateLimiterAndTokenBudget } from '../middleware/rateLimiterAndQuotas.ts';

export interface VoiceLivePageInput {
  pageNumber: number;
  title: string;
  content: string;
}

export interface VoiceLiveServerDeps {
  verifyStudentIdToken: TokenVerifier;
  rateLimiter: DistributedRateLimiterAndTokenBudget;
  getGenAIClient: () => GoogleGenAI | null;
  getAnthropicApiKey: () => string | null;
  anthropicPreferred: () => boolean;
}

/**
 * Authenticated WebSocket Gemini Live Voice Tutoring Server (`/api/live`)
 * Features:
 * - 30s heartbeat ping/pong liveness detection
 * - 25-minute maximum session timeout cleanup
 * - Per-student token & quota metering
 * - Multi-language register support (`English` | `Hinglish` | `Hindi`)
 */
export function attachVoiceLiveWebSocketServer(
  httpServer: http.Server,
  deps: VoiceLiveServerDeps
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const HEARTBEAT_INTERVAL_MS = 30_000;
  const MAX_SESSION_DURATION_MS = 25 * 60 * 1000;

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/api/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      // Ignore non-live upgrade requests
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let liveSession: any = null;
    let sessionPages: VoiceLivePageInput[] = [];
    let sessionTitle = 'Study Material';
    let sessionWeakTopics: string[] = [];
    let preferredLanguage: 'English' | 'Hinglish' | 'Hindi' = 'English';
    let studentUid: string | null = null;
    let isAlive = true;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('pong', () => {
      isAlive = true;
    });

    const heartbeatTimer = setInterval(() => {
      if (clientWs.readyState !== WebSocket.OPEN) return;
      if (!isAlive) {
        clientWs.terminate();
        return;
      }
      isAlive = false;
      try {
        clientWs.ping();
        safeSend({ type: 'heartbeat', ts: Date.now() });
      } catch {
        // ignore
      }
    }, HEARTBEAT_INTERVAL_MS);

    const sessionTimeoutTimer = setTimeout(() => {
      safeSend({
        type: 'status',
        state: 'session_timeout',
        message: 'Voice session reached the 25-minute limit. Reconnect anytime to continue.',
      });
      clientWs.close(4000, 'Session timeout');
    }, MAX_SESSION_DURATION_MS);

    const authDeadline = setTimeout(() => {
      if (!studentUid) {
        clientWs.close(4401, 'Sign-in required');
      }
    }, 15_000);

    clientWs.on('close', () => {
      clearInterval(heartbeatTimer);
      clearTimeout(sessionTimeoutTimer);
      clearTimeout(authDeadline);
      if (liveSession && typeof liveSession.close === 'function') {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
      liveSession = null;
    });

    clientWs.on('message', async (rawBuffer) => {
      try {
        const msg = JSON.parse(rawBuffer.toString()) as {
          type: string;
          title?: string;
          pages?: VoiceLivePageInput[];
          weakTopics?: string[];
          preferredLanguage?: 'English' | 'Hinglish' | 'Hindi';
          data?: string;
          question?: string;
          idToken?: string;
        };

        if (msg.type === 'ping') {
          isAlive = true;
          safeSend({ type: 'pong', ts: Date.now() });
          return;
        }

        if (!studentUid) {
          const token = msg.idToken || null;
          let auth =
            msg.type === 'setup'
              ? await authenticateStudent(deps.verifyStudentIdToken, token)
              : null;
          if ((!auth || !auth.ok) && process.env.NODE_ENV !== 'production' && !token) {
            auth = {
              ok: true,
              student: {
                uid: 'dev-student-local',
                email: 'student@learnmate.local',
                emailVerified: true,
                signInProvider: 'developer',
              },
            };
          }
          if (!auth || !auth.ok) {
            safeSend({
              type: 'error',
              code: auth && !auth.ok ? auth.code : 'auth_required',
              message: auth && !auth.ok ? auth.message : 'Please sign in to use the voice tutor.',
            });
            clientWs.close(4401, 'Sign-in required');
            return;
          }
          studentUid = auth.student.uid;
        }

        if (msg.type === 'setup') {
          sessionTitle = msg.title || 'Study Material';
          sessionPages = Array.isArray(msg.pages) ? msg.pages : [];
          sessionWeakTopics = Array.isArray(msg.weakTopics) ? msg.weakTopics : [];
          if (
            msg.preferredLanguage === 'Hinglish' ||
            msg.preferredLanguage === 'Hindi' ||
            msg.preferredLanguage === 'English'
          ) {
            preferredLanguage = msg.preferredLanguage;
          }

          const ai = deps.getGenAIClient();
          if (!ai) {
            safeSend({
              type: 'status',
              state: 'fallback_ready',
              message: deps.getAnthropicApiKey()
                ? 'Voice mode: speak or type your question. AI answers and your browser reads the answer aloud.'
                : 'Live voice AI is running in grounded note-reader mode.',
            });
            return;
          }

          const condensedMaterial = sessionPages
            .slice(0, 6)
            .map((p) => `Page ${p.pageNumber} (${p.title}): ${p.content.slice(0, 650)}`)
            .join('\n\n');

          const langNote =
            preferredLanguage === 'Hinglish'
              ? 'Speak in natural Indian coaching Hinglish (mixing English technical terms with Hindi explanations).'
              : preferredLanguage === 'Hindi'
              ? 'Speak in clear Hindi while keeping Physics/Chemistry/Math technical terms understandable.'
              : 'Speak in clear, warm academic English.';

          const systemInstruction = `You are LearnMate's real-time Voice Study Tutor helping a JEE student understand "${sessionTitle}".
${langNote}
${sessionWeakTopics.length > 0 ? `Student weak topics to reinforce gently: ${sessionWeakTopics.join(', ')}.` : ''}
Study Material Reference:
${condensedMaterial}

Rules for Voice Tutoring:
- Speak naturally, warmly, and concisely (2 to 4 sentences per turn).
- Reference specific page numbers verbally whenever answering from the material.
- Encourage the student and ask a short check-for-understanding question when appropriate.`;

          try {
            const connectPromise = ai.live.connect({
              model: 'gemini-3.8-live',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                  },
                },
                outputAudioTranscription: {},
                inputAudioTranscription: {},
                systemInstruction: {
                  parts: [{ text: systemInstruction }],
                },
              },
              callbacks: {
                onopen: () => {
                  safeSend({
                    type: 'status',
                    state: 'connected',
                    model: 'gemini-3.8-live',
                    languageRegister: preferredLanguage,
                  });
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onmessage: (serverMsg: any) => {
                  const sc = serverMsg?.serverContent;
                  const parts = sc?.modelTurn?.parts || [];
                  for (const part of parts) {
                    if (part?.inlineData?.data) {
                      safeSend({
                        type: 'audio',
                        data: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                      });
                    }
                    if (part?.text) {
                      safeSend({
                        type: 'transcript',
                        role: 'assistant',
                        text: part.text,
                      });
                    }
                  }
                  if (sc?.outputTranscription?.text) {
                    safeSend({
                      type: 'output_transcription',
                      text: sc.outputTranscription.text,
                      finished: Boolean(sc.outputTranscription.finished),
                    });
                  }
                  if (sc?.inputTranscription?.text) {
                    safeSend({
                      type: 'input_transcription',
                      text: sc.inputTranscription.text,
                      finished: Boolean(sc.inputTranscription.finished),
                    });
                  }
                  if (sc?.interrupted) {
                    safeSend({ type: 'interrupted' });
                  }
                  if (sc?.turnComplete) {
                    if (studentUid) {
                      deps.rateLimiter.recordTokensUsed(studentUid, 320);
                    }
                    safeSend({ type: 'turn_complete' });
                  }
                },
                onerror: (err: unknown) => {
                  safeSend({
                    type: 'status',
                    state: 'fallback_ready',
                    message:
                      err instanceof Error
                        ? err.message
                        : 'Live voice stream ended; switching to grounded voice answers.',
                  });
                },
                onclose: () => {
                  liveSession = null;
                },
              },
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('LIVE_CONNECT_TIMEOUT')), 4500)
            );
            liveSession = await Promise.race([connectPromise, timeoutPromise]);
          } catch (err) {
            liveSession = null;
            safeSend({
              type: 'status',
              state: 'fallback_ready',
              message:
                err instanceof Error
                  ? err.message
                  : 'Live audio stream unavailable; using grounded voice mode.',
            });
          }
          return;
        }

        if (msg.type === 'audio' && msg.data && liveSession) {
          try {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch {
            // ignore transient frame error
          }
          return;
        }

        if (msg.type === 'voice_question' && msg.question) {
          const qText = msg.question.trim().slice(0, 2000);
          if (!qText) return;

          const allowance = deps.rateLimiter
            .getStudentUsageLimiter()
            .consume(studentUid, 'tutor');
          if (!allowance.allowed) {
            safeSend({
              type: 'voice_response',
              text: allowance.message || 'Please wait a moment and try again.',
              citations: [],
              sourceType: 'general',
            });
            return;
          }
          deps.rateLimiter.recordTokensUsed(studentUid, 350);

          if (liveSession && typeof liveSession.sendClientContent === 'function') {
            try {
              liveSession.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: qText }] }],
                turnComplete: true,
              });
              return;
            } catch {
              // fall through
            }
          }

          const ai = deps.getGenAIClient();
          if (ai) {
            try {
              const material = sessionPages
                .slice(0, 8)
                .map((p) => `Page ${p.pageNumber} (${p.title}): ${p.content.slice(0, 800)}`)
                .join('\n\n');
              const resp = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: qText,
                config: {
                  systemInstruction: `You are LearnMate's friendly voice tutor for JEE Main & Advanced (Physics, Chemistry, Mathematics), helping with "${sessionTitle}" in ${preferredLanguage}. Answer in 2 to 4 short spoken sentences without Markdown or LaTeX symbols. Reference notes: ${material || 'None'}`,
                  temperature: 0.3,
                },
              });
              const spokenText = (resp.text || '')
                .replace(/[*#_`$\\]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              if (spokenText) {
                safeSend({
                  type: 'voice_response',
                  text: spokenText,
                  citations: [],
                  sourceType: 'general',
                });
                return;
              }
            } catch {
              // fall through to excerpt fallback
            }
          }

          const firstPage = sessionPages[0];
          const fallbackSpoken = firstPage
            ? `From Page ${firstPage.pageNumber} (${firstPage.title}): ${firstPage.content
                .replace(/[*#_`$\\]/g, '')
                .slice(0, 280)}`
            : `For ${sessionTitle}, start by writing the conservation law or governing formula and checking SI units.`;

          safeSend({
            type: 'voice_response',
            text: fallbackSpoken,
            citations: firstPage
              ? [{ pageNumber: firstPage.pageNumber, section: firstPage.title, quote: '' }]
              : [],
            sourceType: firstPage ? 'material' : 'general',
          });
        }
      } catch {
        // ignore malformed message
      }
    });
  });

  return wss;
}

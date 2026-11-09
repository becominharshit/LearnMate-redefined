import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { StudyView, StudySubMode } from './components/StudyView';
import { QuickReviseView, QuickReviseSubTab } from './components/QuickReviseView';
import { PracticeWorkspaceView } from './components/PracticeWorkspaceView';
import { PdfWorkspaceView } from './components/PdfWorkspaceView';
import { ResourcesView } from './components/ResourcesView';
import { CreativeStudioView } from './components/CreativeStudioView';
import { StudentDashboardView } from './components/StudentDashboardView';
import { StudentProfileModal } from './components/StudentProfileModal';
import { ProgressView } from './components/ProgressView';
import { VoiceTutorModal } from './components/VoiceTutorModal';
import { AddMaterialModal, AddMaterialMode } from './components/AddMaterialModal';
import { DynamicCompanion } from './components/DynamicCompanion';
import { AuthScreen } from './components/AuthScreen';
import { VerifyEmailScreen, FirebaseSetupScreen } from './components/AccountGateScreens';
import { SafetyStatementPage } from './components/SafetyStatementPage';
import { LandingPage } from './components/LandingPage';
import { SampleChapterPage } from './components/SampleChapterPage';
import { FirstRunSetupModal, type FirstRunAnswers } from './components/FirstRunSetupModal';
import { LegalPage } from './components/LegalPage';
import { buildSampleChapterDocument, SAMPLE_CHAPTER_ID } from './data/sampleChapter';
import {
  StudyDocument,
  LearnMateNotification,
  StudentAcademicProfile,
  ThemeMode,
} from './types/study';
import { studyStorage } from './services/storageService';
import { applyThemeToDom, listenToSystemThemeChanges } from './utils/theme';
import { extractPagesFromPdf } from './utils/pdfExtractor';
import { aiStudyClient } from './services/aiClient';
import { splitTextIntoPages } from './utils/quizGrading';
import {
  stopAllGlobalAudioAndSpeech,
  type ContextualCreateTransferPayload,
} from './utils/phase6Engine';
import {
  auth,
  firebaseConfigured,
  needsEmailVerification,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  User,
} from './firebase';

const VALID_TABS: ActiveTab[] = [
  'dashboard',
  'study',
  'revision',
  'practice',
  'analytics',
  'resources',
  'create',
  'pdf-workspace',
  'explore',
  'ai-tutor',
  'home',
];

type PublicRoute =
  | 'landing'
  | 'signin'
  | 'signup'
  | 'sample'
  | 'privacy'
  | 'terms'
  | 'contact'
  | 'safety';

const PENDING_SAMPLE_KEY = 'learnmate_pending_sample_v1';

function parsePublicRouteFromHash(): PublicRoute | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (
    raw === 'landing' ||
    raw === 'signin' ||
    raw === 'signup' ||
    raw === 'sample' ||
    raw === 'privacy' ||
    raw === 'terms' ||
    raw === 'contact' ||
    raw === 'safety'
  ) {
    return raw;
  }
  return null;
}

function readPendingSampleIntent(): boolean {
  try {
    return sessionStorage.getItem(PENDING_SAMPLE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePendingSampleIntent(value: boolean): void {
  try {
    if (value) {
      sessionStorage.setItem(PENDING_SAMPLE_KEY, 'true');
    } else {
      sessionStorage.removeItem(PENDING_SAMPLE_KEY);
    }
  } catch {
    // ignore restricted storage
  }
}

function normalizeTab(tab: string): ActiveTab {
  if (tab === 'home') return 'dashboard';
  if (tab === 'learn' || tab === 'ai-tutor') return 'study';
  if (tab === 'explore') return 'resources';
  if (tab === 'saved') return 'analytics';
  if (VALID_TABS.includes(tab as ActiveTab)) {
    return tab as ActiveTab;
  }
  return 'dashboard';
}

function parseTabFromHash(): ActiveTab {
  if (typeof window === 'undefined') return 'dashboard';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  return normalizeTab(raw);
}

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => parseTabFromHash());
  const [studyInitialMode, setStudyInitialMode] = useState<StudySubMode>('explain');
  const [reviseInitialSubTab, setReviseInitialSubTab] =
    useState<QuickReviseSubTab>('flashcards');
  const [pendingDoubtQuestion, setPendingDoubtQuestion] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<StudyDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Universal Add Material Modal state (Phase 3 Item 1)
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [addMaterialMode, setAddMaterialMode] = useState<AddMaterialMode>('pdf');
  const [addMaterialPreselectedFile, setAddMaterialPreselectedFile] =
    useState<File | null>(null);

  // Student Personalization Profile state
  const [studentProfile, setStudentProfile] = useState<StudentAcademicProfile>(() =>
    studyStorage.getStudentProfile()
  );
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Modals & Phase 6 Contextual Create Transfer State
  const [voiceTutorOpen, setVoiceTutorOpen] = useState(false);
  const [contextualCreateTransfer, setContextualCreateTransfer] =
    useState<ContextualCreateTransferPayload | null>(null);

  // Night Owl Theme State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => studyStorage.getThemeMode());

  useEffect(() => {
    applyThemeToDom(themeMode);
  }, [themeMode]);

  useEffect(() => {
    return listenToSystemThemeChanges(themeMode, () => {
      setThemeMode(studyStorage.getThemeMode());
    });
  }, [themeMode]);

  const handleToggleTheme = () => {
    const nextMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
    studyStorage.saveThemeMode(nextMode);
    applyThemeToDom(nextMode);
  };

  // Notifications
  const [notifications, setNotifications] = useState<LearnMateNotification[]>([]);

  // Firebase Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [accountSynced, setAccountSynced] = useState(false);
  const [verificationTick, setVerificationCheck] = useState(0);

  // Public pages (landing, sample, legal) and the first-run setup flow.
  const [publicRoute, setPublicRoute] = useState<PublicRoute | null>(() =>
    parsePublicRouteFromHash()
  );
  const [pendingSampleAdd, setPendingSampleAdd] = useState(() => readPendingSampleIntent());
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const publicBackTargetRef = useRef<PublicRoute | null>(null);

  const effectiveDoc = activeDoc || documents[0] || studyStorage.getDocuments()[0];
  const sampleIsAdded = documents.some((document) => document.id === SAMPLE_CHAPTER_ID);

  const openAddMaterialModal = (
    mode: AddMaterialMode = 'pdf',
    preselectedFile: File | null = null
  ) => {
    setErrorMessage(null);
    setAddMaterialMode(mode);
    setAddMaterialPreselectedFile(preselectedFile);
    setAddMaterialOpen(true);
  };

  const reloadLocalState = () => {
    const refreshedDocs = studyStorage.getDocuments();
    setDocuments(refreshedDocs);
    const activeId = studyStorage.getActiveDocumentId();
    setActiveDoc(
      (prev) =>
        refreshedDocs.find((d) => d.id === (prev?.id ?? activeId)) || refreshedDocs[0] || null
    );
    setNotifications(studyStorage.getNotifications());
    setStudentProfile(studyStorage.getStudentProfile());
  };

  const syncAccount = async (currentUser: User) => {
    setIsSyncing(true);
    setAccountSynced(false);
    try {
      await studyStorage.syncWithCloudUser(currentUser);
      reloadLocalState();
    } catch (err) {
      console.error('Error syncing with Firestore:', err);
    } finally {
      setIsSyncing(false);
      setAccountSynced(true);
    }
  };

  const goPublic = (route: PublicRoute, rememberPrevious = true) => {
    if (rememberPrevious && publicRoute && publicRoute !== route) {
      publicBackTargetRef.current = publicRoute;
    } else if (!publicRoute) {
      publicBackTargetRef.current = null;
    }
    setPublicRoute(route);
    if (typeof window !== 'undefined') {
      const targetHash = `#${route}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToApp = (tab: ActiveTab) => {
    const normalized = normalizeTab(tab);
    stopAllGlobalAudioAndSpeech('workspace_tab_navigation');
    setPublicRoute(null);
    publicBackTargetRef.current = null;
    setActiveTab(normalized);
    if (typeof window !== 'undefined') {
      const targetHash = `#${normalized}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const closePublicPage = () => {
    const target = publicBackTargetRef.current;
    publicBackTargetRef.current = null;
    if (target) {
      setPublicRoute(target);
      window.history.pushState(null, '', `#${target}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (user && !needsEmailVerification(user)) {
      goToApp(activeTab);
      return;
    }
    goPublic('landing', false);
  };

  const handleSelectTab = (tab: ActiveTab) => {
    if (tab === 'home') {
      openAddMaterialModal('pdf');
      return;
    }
    goToApp(tab);
  };

  useEffect(() => {
    const onHashChange = () => {
      const route = parsePublicRouteFromHash();
      setPublicRoute(route);
      if (!route) {
        setActiveTab(parseTabFromHash());
      }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  const isAutostartTestMode =
    typeof window !== 'undefined' &&
    !import.meta.env.PROD &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  useEffect(() => {
    if (!isAuthReady || user || publicRoute || isAutostartTestMode) return;
    setPublicRoute('landing');
    if (typeof window !== 'undefined' && window.location.hash !== '#landing') {
      window.history.replaceState(null, '', '#landing');
      window.scrollTo({ top: 0 });
    }
  }, [isAuthReady, user, publicRoute, isAutostartTestMode]);

  useEffect(() => {
    if (isAutostartTestMode) {
      let docs = studyStorage.getDocuments();
      if (docs.length === 0) {
        const sample = buildSampleChapterDocument();
        studyStorage.saveDocument(sample);
        studyStorage.setActiveDocumentId(sample.id);
        docs = studyStorage.getDocuments();
      }
      const existingProfile = studyStorage.getStudentProfile();
      if (!existingProfile.setupCompleted || existingProfile.ageBand !== '16_17') {
        const updatedProfile = studyStorage.saveStudentProfile({
          ...existingProfile,
          fullName: existingProfile.fullName || 'Aarav Sharma',
          schoolClass: 'Class 12',
          ageBand: '16_17',
          setupCompleted: true,
        });
        setStudentProfile(updatedProfile);
      } else {
        setStudentProfile(existingProfile);
      }
      setDocuments(docs);
      const activeId = studyStorage.getActiveDocumentId();
      setActiveDoc(docs.find((d) => d.id === activeId) || docs[0] || null);
      setNotifications(studyStorage.getNotifications());
      setUser({
        uid: 'dev-student-local',
        email: 'student@learnmate.local',
        emailVerified: true,
        displayName: 'Aarav Sharma',
        providerData: [],
      } as unknown as User);
      setAccountSynced(true);
      setIsAuthReady(true);
      return;
    }

    const docs = studyStorage.getDocuments();
    setDocuments(docs);
    const activeId = studyStorage.getActiveDocumentId();
    const initialDoc = docs.find((d) => d.id === activeId) || docs[0] || null;
    setActiveDoc(initialDoc);
    setNotifications(studyStorage.getNotifications());
    setStudentProfile(studyStorage.getStudentProfile());

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setIsAuthReady(true);
        if (!needsEmailVerification(currentUser)) {
          await syncAccount(currentUser);
        }
      } else {
        await studyStorage.syncWithCloudUser(null);
        reloadLocalState();
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [isAutostartTestMode]);

  const handleSetupComplete = (answers: FirstRunAnswers) => {
    const updated: StudentAcademicProfile = {
      ...studentProfile,
      fullName: answers.fullName,
      schoolClass: answers.schoolClass,
      educationStage: answers.schoolClass === 'Dropper' ? 'self_learner' : 'school',
      targetExam: 'jee_main',
      targetExamYear: '2027',
      examSession: answers.examSession,
      preferredLanguage: answers.preferredLanguage,
      ageBand: answers.ageBand,
      setupCompleted: true,
    };
    const saved = studyStorage.saveStudentProfile(updated);
    setStudentProfile(saved);
    setSetupOpen(false);
  };

  const addSampleToAccount = () => {
    const sample = buildSampleChapterDocument();
    studyStorage.saveDocument(sample);
    studyStorage.setActiveDocumentId(sample.id);
    setDocuments(studyStorage.getDocuments());
    setActiveDoc(sample);
    setNotifications(studyStorage.getNotifications());
    setStudyInitialMode('explain');
    writePendingSampleIntent(false);
    setPendingSampleAdd(false);
    setPublicRoute(null);
    publicBackTargetRef.current = null;
    setActiveTab('study');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#study');
      window.scrollTo({ top: 0 });
    }
  };

  const handleAddSample = () => {
    if (user && !needsEmailVerification(user)) {
      addSampleToAccount();
      return;
    }
    writePendingSampleIntent(true);
    setPendingSampleAdd(true);
    goPublic(user ? 'signin' : 'signup');
  };

  const openSampleInLibrary = () => {
    const sample =
      documents.find((document) => document.id === SAMPLE_CHAPTER_ID) ||
      studyStorage.getDocumentById(SAMPLE_CHAPTER_ID);
    if (sample) {
      handleSelectDocument(sample, 'explain');
    } else {
      addSampleToAccount();
    }
  };

  useEffect(() => {
    if (!isAuthReady || !user || needsEmailVerification(user)) return;
    if (pendingSampleAdd) {
      addSampleToAccount();
      return;
    }
    if (publicRoute === 'signin' || publicRoute === 'signup') {
      setPublicRoute(null);
      publicBackTargetRef.current = null;
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '#dashboard');
        window.scrollTo({ top: 0 });
      }
    }
  }, [isAuthReady, user, verificationTick, pendingSampleAdd, publicRoute]);

  useEffect(() => {
    if (!isAuthReady || !user || needsEmailVerification(user) || !accountSynced) {
      if (!user || needsEmailVerification(user)) setSetupOpen(false);
      return;
    }
    if (studentProfile.setupCompleted) {
      setSetupOpen(false);
      return;
    }
    if (!setupDismissed) {
      setSetupOpen(true);
    }
  }, [
    isAuthReady,
    user,
    verificationTick,
    accountSynced,
    studentProfile.setupCompleted,
    setupDismissed,
  ]);

  const refreshDocumentsState = () => {
    const refreshed = studyStorage.getDocuments();
    setDocuments(refreshed);
    if (activeDoc) {
      const updatedActive =
        refreshed.find((d) => d.id === activeDoc.id) || refreshed[0] || null;
      setActiveDoc(updatedActive);
    } else if (refreshed.length > 0) {
      setActiveDoc(refreshed[0]);
    }
  };

  const handleUploadPdf = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const extracted = await extractPagesFromPdf(file, async (pageImageDataUrl, pageNum) => {
        try {
          const res = await aiStudyClient.scanNotes({
            imageDataUrl: pageImageDataUrl,
            title: `${file.name.replace(/\.pdf$/i, '')} — Page ${pageNum}`,
          });
          return {
            title: res.title,
            content: res.cleanContent,
          };
        } catch {
          return null;
        }
      });
      if (extracted.pages.length === 0) {
        throw new Error(
          'Could not extract readable text from this PDF. Please try another PDF or use Photo of notes.'
        );
      }

      const analysis = await aiStudyClient
        .analyzeDocument(file.name, extracted.pages)
        .catch(() => ({
          overview: `Uploaded study material (${extracted.pageCount} pages).`,
          topics: [],
        }));

      const newDoc: StudyDocument = {
        id: `doc-${Date.now()}`,
        title: file.name,
        sourceType: 'pdf',
        fileSize: file.size,
        pageCount: extracted.pageCount,
        pages: extracted.pages,
        pdfDataUrl: extracted.pdfDataUrl,
        createdAt: new Date().toISOString(),
        lastStudiedAt: new Date().toISOString(),
        topics: analysis.topics || [],
        overview: analysis.overview || `Uploaded PDF (${extracted.pageCount} pages).`,
      };

      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);

      const updatedDocs = studyStorage.getDocuments();
      setDocuments(updatedDocs);
      setActiveDoc(newDoc);
      setAddMaterialOpen(false);
      setAddMaterialPreselectedFile(null);
      setStudyInitialMode('explain');
      goToApp('study');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process PDF file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadPhotoNotes = async (imageDataUrl: string, title: string) => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const ocrRes = await aiStudyClient.scanNotes({
        imageDataUrl,
        title,
      });

      const cleanText = (ocrRes.cleanContent || '').trim();
      if (!cleanText) {
        throw new Error(
          'No readable text was found in this image. Please try a clearer photo or paste text.'
        );
      }

      const pages = splitTextIntoPages(cleanText);
      const docTitle = ocrRes.title || title || 'Scanned Notes';
      const analysis = await aiStudyClient
        .analyzeDocument(docTitle, pages)
        .catch(() => ({
          overview: ocrRes.summary || cleanText.slice(0, 220),
          topics: [],
        }));

      const fallbackTopics = (ocrRes.keyConcepts || []).slice(0, 4).map((concept, idx) => ({
        id: `topic-${Date.now()}-${idx + 1}`,
        name: concept,
        summary: `Key concept extracted from handwritten notes: ${concept}`,
        keyConcepts: [concept],
        sourcePages: [1],
      }));

      const newDoc: StudyDocument = {
        id: `doc-${Date.now()}`,
        title: docTitle,
        sourceType: 'scanned_notes',
        scannedImageDataUrl: imageDataUrl,
        pageCount: pages.length,
        pages,
        createdAt: new Date().toISOString(),
        lastStudiedAt: new Date().toISOString(),
        topics: analysis.topics && analysis.topics.length > 0 ? analysis.topics : fallbackTopics,
        overview: analysis.overview || ocrRes.summary || cleanText.slice(0, 220),
      };

      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);

      const updatedDocs = studyStorage.getDocuments();
      setDocuments(updatedDocs);
      setActiveDoc(newDoc);
      setAddMaterialOpen(false);
      setAddMaterialPreselectedFile(null);
      setStudyInitialMode('explain');
      goToApp('study');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not scan these notes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitTextNotes = async (
    title: string,
    rawText: string,
    sourceType: StudyDocument['sourceType'] = 'text',
    youtubeUrl?: string
  ) => {
    setErrorMessage(null);

    const cleaned = rawText.trim();
    if (cleaned.length < 25) {
      setErrorMessage(
        'Please enter at least a paragraph of study notes so LearnMate can analyze it.'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const pages = splitTextIntoPages(cleaned);
      const analysis = await aiStudyClient.analyzeDocument(title, pages).catch(() => ({
        overview: cleaned.slice(0, 220),
        topics: [],
      }));

      const newDoc: StudyDocument = {
        id: `doc-${Date.now()}`,
        title: title.endsWith('.pdf') ? title : `${title}.pdf`,
        sourceType,
        youtubeUrl,
        pageCount: pages.length,
        pages,
        createdAt: new Date().toISOString(),
        lastStudiedAt: new Date().toISOString(),
        topics: analysis.topics || [],
        overview: analysis.overview || cleaned.slice(0, 220),
      };

      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);

      const updatedDocs = studyStorage.getDocuments();
      setDocuments(updatedDocs);
      setActiveDoc(newDoc);
      setAddMaterialOpen(false);
      setStudyInitialMode('explain');
      goToApp('study');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to analyze study notes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitYouTubeUrl = async (
    url: string,
    transcript?: string,
    title?: string
  ) => {
    setErrorMessage(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a valid YouTube lecture URL.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await aiStudyClient.analyzeYouTubeVideo(
        trimmed,
        transcript,
        title
      );
      const newDoc: StudyDocument = {
        id: `doc-${Date.now()}`,
        title: result.title,
        sourceType: 'youtube',
        youtubeUrl: result.youtubeUrl,
        videoId: result.videoId,
        pageCount: result.pages.length,
        pages: result.pages,
        createdAt: new Date().toISOString(),
        lastStudiedAt: new Date().toISOString(),
        topics: result.topics || [],
        overview: result.overview,
      };
      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);
      setDocuments(studyStorage.getDocuments());
      setActiveDoc(newDoc);
      setAddMaterialOpen(false);
      setStudyInitialMode('explain');
      goToApp('study');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to import YouTube lecture.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectDocument = (
    doc: StudyDocument,
    targetMode: StudySubMode = 'explain'
  ) => {
    const updated: StudyDocument = {
      ...doc,
      lastStudiedAt: new Date().toISOString(),
    };
    studyStorage.saveDocument(updated);
    studyStorage.setActiveDocumentId(updated.id);
    setDocuments(studyStorage.getDocuments());
    setActiveDoc(updated);
    setStudyInitialMode(targetMode);
    goToApp('study');
  };

  const handleAskDoubtFromHome = (question: string) => {
    if (!effectiveDoc) {
      const sample = buildSampleChapterDocument();
      studyStorage.saveDocument(sample);
      studyStorage.setActiveDocumentId(sample.id);
      setDocuments(studyStorage.getDocuments());
      setActiveDoc(sample);
    }
    setPendingDoubtQuestion(question);
    setStudyInitialMode('explain');
    goToApp('study');
  };

  const handleDeleteDocument = (docId: string) => {
    studyStorage.deleteDocument(docId);
    const remaining = studyStorage.getDocuments();
    setDocuments(remaining);
    if (activeDoc?.id === docId) {
      setActiveDoc(remaining[0] || null);
    }
  };

  const handleMarkNotificationsRead = () => {
    studyStorage.markAllNotificationsRead();
    setNotifications(studyStorage.getNotifications());
  };

  // Public pages and account gates
  const landingElement = (
    <LandingPage
      isSignedIn={Boolean(user && !needsEmailVerification(user))}
      onSignIn={() => goPublic('signin')}
      onSignUp={() => goPublic('signup')}
      onOpenSample={() => goPublic('sample')}
      onOpenDashboard={() => goToApp('dashboard')}
      onOpenSafety={() => goPublic('safety')}
      onOpenLegal={(page) => goPublic(page)}
    />
  );

  if (publicRoute === 'safety') {
    return <SafetyStatementPage onBack={closePublicPage} />;
  }
  if (publicRoute === 'privacy' || publicRoute === 'terms' || publicRoute === 'contact') {
    return (
      <LegalPage
        page={publicRoute}
        onBack={closePublicPage}
        onOpenSafety={() => goPublic('safety')}
        onOpenPage={(page) => goPublic(page)}
      />
    );
  }
  if (publicRoute === 'sample') {
    return (
      <SampleChapterPage
        isSignedIn={Boolean(user && !needsEmailVerification(user))}
        sampleAdded={sampleIsAdded}
        onBack={closePublicPage}
        onAddToAccount={handleAddSample}
        onOpenInLibrary={openSampleInLibrary}
        onSignUp={() => goPublic('signup')}
        onOpenSafety={() => goPublic('safety')}
        onOpenLegal={(page) => goPublic(page)}
      />
    );
  }
  if (publicRoute === 'landing') {
    return landingElement;
  }

  if (!firebaseConfigured && !isAutostartTestMode) {
    if (publicRoute === 'signin' || publicRoute === 'signup') {
      return <FirebaseSetupScreen />;
    }
    return landingElement;
  }
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-sm text-muted">
        Loading your account…
      </div>
    );
  }
  if (!user) {
    if (publicRoute === 'signin' || publicRoute === 'signup') {
      return (
        <AuthScreen
          key={publicRoute}
          initialMode={publicRoute}
          onBack={() => goPublic('landing')}
          onOpenSafety={() => goPublic('safety')}
          onOpenLegal={(page) => goPublic(page)}
          notice={
            pendingSampleAdd
              ? 'Sign in to add the free sample chapter to your account. After email verification, it will appear automatically.'
              : null
          }
        />
      );
    }
    return landingElement;
  }
  if (needsEmailVerification(user)) {
    return (
      <VerifyEmailScreen
        user={user}
        onVerified={() => {
          setVerificationCheck((n) => n + 1);
          void syncAccount(user);
        }}
      />
    );
  }
  if (publicRoute === 'signin' || publicRoute === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-sm text-muted">
        Opening your dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink pb-20 lg:pb-0 overflow-x-hidden">
      <DynamicCompanion activeDoc={effectiveDoc} />
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        hasActiveDoc={!!activeDoc}
        activeDoc={activeDoc}
        onOpenAddMaterial={(mode = 'pdf') => openAddMaterialModal(mode)}
        user={user}
        isAuthReady={isAuthReady}
        isSyncing={isSyncing}
        onLogin={() => {
          signInWithGoogle().catch((err) => {
            console.warn('Google sign-in did not complete:', err);
          });
        }}
        onLogout={() => {
          signOutUser().catch((err) => {
            console.warn('Sign-out failed:', err);
          });
        }}
        documents={documents}
        onSelectDocumentFromSearch={(doc) => handleSelectDocument(doc, 'explain')}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        studentProfile={studentProfile}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Container */}
      <main className="flex-1 min-w-0">
        {(activeTab === 'dashboard' || activeTab === 'home') && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <StudentDashboardView
              studentName={
                user?.displayName
                  ? user.displayName.split(' ')[0]
                  : studentProfile.fullName
              }
              documents={documents}
              activeDoc={activeDoc}
              onSelectDoc={(doc, mode = 'explain') => handleSelectDocument(doc, mode)}
              onDeleteDoc={handleDeleteDocument}
              onNavigateTab={handleSelectTab}
              onOpenAddMaterial={(mode, file) => openAddMaterialModal(mode, file || null)}
              onAskDoubt={handleAskDoubtFromHome}
              studentProfile={studentProfile}
              isProfileSyncing={isSyncing}
              onOpenProfileModal={() => {
                setSetupDismissed(false);
                setSetupOpen(true);
              }}
            />
          </div>
        )}

        {(activeTab === 'study' || activeTab === 'ai-tutor') && effectiveDoc && (
          <StudyView
            documents={documents}
            activeDocument={effectiveDoc}
            onSelectDocument={(doc) => {
              studyStorage.setActiveDocumentId(doc.id);
              setActiveDoc(doc);
            }}
            initialSubMode={studyInitialMode}
            initialQuestion={pendingDoubtQuestion}
            onConsumeInitialQuestion={() => setPendingDoubtQuestion(null)}
            onAttemptSaved={refreshDocumentsState}
            onNavigateProgress={() => goToApp('analytics')}
            onOpenRevise={(sub = 'flashcards') => {
              setReviseInitialSubTab(sub);
              goToApp('revision');
            }}
            onOpenPdfWorkspace={() => goToApp('pdf-workspace')}
            onOpenUploadModal={() => openAddMaterialModal('pdf')}
            onOpenContextualCreate={(payload) => {
              setContextualCreateTransfer(payload);
              goToApp('create');
            }}
            isCloudSynced={!!user}
          />
        )}

        {(activeTab === 'study' || activeTab === 'ai-tutor') && !effectiveDoc && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <h2 className="font-serif-editorial text-3xl font-bold text-ink">
              No Study Material Added Yet
            </h2>
            <p className="text-sm text-muted">
              Add a PDF, photo of notes, YouTube lecture transcript, or pasted text to start studying with the AI Tutor.
            </p>
            <button
              type="button"
              onClick={() => openAddMaterialModal('pdf')}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              + Add Study Material
            </button>
          </div>
        )}

        {activeTab === 'revision' && effectiveDoc && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <QuickReviseView
              activeDocument={effectiveDoc}
              initialSubTab={reviseInitialSubTab}
              onNavigateToCitation={() => {
                setStudyInitialMode('explain');
                goToApp('study');
              }}
              onAskTutorAboutConcept={(prompt) => {
                setPendingDoubtQuestion(prompt);
                setStudyInitialMode('explain');
                goToApp('study');
              }}
              onOpenPractice={() => goToApp('practice')}
            />
          </div>
        )}

        {activeTab === 'revision' && !effectiveDoc && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <h2 className="font-serif-editorial text-3xl font-bold text-ink">
              Add a Material to Revise
            </h2>
            <p className="text-sm text-muted">
              Upload your notes or textbook chapter to generate flashcards, mind maps, summary sheets, and formula cards.
            </p>
            <button
              type="button"
              onClick={() => openAddMaterialModal('pdf')}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              + Add Study Material
            </button>
          </div>
        )}

        {activeTab === 'practice' && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <PracticeWorkspaceView
              documents={documents}
              activeDoc={activeDoc}
              onSelectDoc={(doc) => setActiveDoc(doc)}
              onOpenStudyQuiz={() => {
                if (activeDoc || documents[0]) {
                  if (!activeDoc && documents[0]) setActiveDoc(documents[0]);
                  setStudyInitialMode('quiz');
                  goToApp('study');
                }
              }}
              studentProfile={studentProfile}
              onOpenProfileModal={() => setProfileModalOpen(true)}
            />
          </div>
        )}

        {(activeTab === 'resources' || activeTab === 'explore') && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ResourcesView
              onImportReferenceNotes={(title, content) => {
                void handleSubmitTextNotes(title, content, 'text');
              }}
            />
          </div>
        )}

        {activeTab === 'create' && effectiveDoc && (
          <CreativeStudioView
            documents={documents}
            activeDocument={effectiveDoc}
            onSelectDocument={(docId) => {
              const found = documents.find((d) => d.id === docId);
              if (found) setActiveDoc(found);
            }}
            themeMode={themeMode}
            onNavigateToPage={(_pageNum) => {
              setStudyInitialMode('explain');
              goToApp('study');
            }}
            onNavigateTab={(tab) => {
              if (tab === 'practice') {
                goToApp('practice');
              } else if (tab === 'revision') {
                setReviseInitialSubTab('flashcards');
                goToApp('revision');
              } else if (tab === 'study') {
                setStudyInitialMode('explain');
                goToApp('study');
              }
            }}
            contextualTransfer={contextualCreateTransfer}
            onReturnToTutor={() => {
              setContextualCreateTransfer(null);
              setStudyInitialMode('explain');
              goToApp('study');
            }}
          />
        )}

        {activeTab === 'create' && !effectiveDoc && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <h2 className="font-serif-editorial text-3xl font-bold text-ink">
              Add Study Material First
            </h2>
            <p className="text-sm text-muted">
              The visual diagram studio works on your study materials. Add a PDF, photo of notes, or text to begin.
            </p>
            <button
              type="button"
              onClick={() => openAddMaterialModal('pdf')}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              + Add Study Material
            </button>
          </div>
        )}

        {activeTab === 'pdf-workspace' && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <PdfWorkspaceView
              documents={documents}
              activeDoc={activeDoc}
              onSelectDoc={(doc) => setActiveDoc(doc)}
              onUploadClick={() => openAddMaterialModal('pdf')}
              onDeleteDoc={handleDeleteDocument}
              onDocumentsChanged={refreshDocumentsState}
              onOpenStudySpace={() => {
                setStudyInitialMode('explain');
                goToApp('study');
              }}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ProgressView
              documents={documents}
              attempts={studyStorage.getQuizAttempts()}
              onStartQuizForDocument={(doc, mode) => {
                handleSelectDocument(doc, mode);
              }}
              onResetProgress={() => {
                studyStorage.clearAllProgress();
                refreshDocumentsState();
              }}
            />
          </div>
        )}
      </main>

      {/* Universal Add Study Material Modal (+ Add material on every page) */}
      <AddMaterialModal
        isOpen={addMaterialOpen}
        initialMode={addMaterialMode}
        initialFile={addMaterialPreselectedFile}
        isProcessing={isProcessing}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage(null)}
        onClose={() => {
          if (!isProcessing) {
            setAddMaterialOpen(false);
            setAddMaterialPreselectedFile(null);
          }
        }}
        onUploadPdf={handleUploadPdf}
        onUploadPhotoNotes={handleUploadPhotoNotes}
        onSubmitYouTube={handleSubmitYouTubeUrl}
        onSubmitTextNotes={(title, text) => handleSubmitTextNotes(title, text, 'text')}
      />

      {/* First-run setup: four questions, shown once */}
      <FirstRunSetupModal
        isOpen={setupOpen}
        initialName={user?.displayName || studentProfile.fullName || ''}
        profile={studentProfile}
        onComplete={handleSetupComplete}
        onDismiss={() => {
          setSetupOpen(false);
          setSetupDismissed(true);
        }}
        onOpenFullProfile={() => {
          setSetupOpen(false);
          setSetupDismissed(true);
          setProfileModalOpen(true);
        }}
      />

      {/* Personalized Student Academic Profile Modal */}
      <StudentProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onProfileSaved={(updated) => {
          setStudentProfile(updated);
          if (updated.setupCompleted) setSetupOpen(false);
        }}
      />

      {/* Live Voice AI Tutor Modal */}
      {effectiveDoc && (
        <VoiceTutorModal
          isOpen={voiceTutorOpen}
          onClose={() => setVoiceTutorOpen(false)}
          activeDocument={effectiveDoc}
          weakTopics={studentProfile.weakAreas}
        />
      )}
    </div>
  );
}

export default App;

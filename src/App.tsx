import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { StudyView, StudySubMode } from './components/StudyView';
import { QuickReviseView } from './components/QuickReviseView';
import { PracticeWorkspaceView } from './components/PracticeWorkspaceView';
import { PdfWorkspaceView } from './components/PdfWorkspaceView';
import { ExploreWorkspaceView, ExploreSubTab } from './components/ExploreWorkspaceView';
import { CreativeStudioView } from './components/CreativeStudioView';
import { StudentDashboardView } from './components/StudentDashboardView';
import { StudentProfileModal } from './components/StudentProfileModal';
import { ProgressView } from './components/ProgressView';
import { VoiceTutorModal } from './components/VoiceTutorModal';
import { NotebookAndScannerModal } from './components/NotebookAndScannerModal';
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
  StudentAcademicProfile
} from './types/study';
import { studyStorage } from './services/storageService';
import { extractPagesFromPdf } from './utils/pdfExtractor';
import { aiStudyClient } from './services/aiClient';
import { splitTextIntoPages } from './utils/quizGrading';
import {
  auth,
  firebaseConfigured,
  needsEmailVerification,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  User
} from './firebase';

const VALID_TABS: ActiveTab[] = [
  'dashboard',
  'study',
  'revision',
  'practice',
  'explore',
  'ai-tutor',
  'create',
  'home',
  'pdf-workspace',
  'analytics'
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

function parseTabFromHash(): ActiveTab {
  if (typeof window === 'undefined') return 'dashboard';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (raw === 'learn') return 'study';
  if (raw === 'saved') return 'analytics';
  if (VALID_TABS.includes(raw as ActiveTab)) {
    return raw as ActiveTab;
  }
  return 'dashboard';
}

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => parseTabFromHash());
  const [studyInitialMode, setStudyInitialMode] = useState<StudySubMode>('explain');
  const [exploreSubTab, setExploreSubTab] = useState<ExploreSubTab>('news');
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<StudyDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Student Personalization Profile state
  const [studentProfile, setStudentProfile] = useState<StudentAcademicProfile>(() =>
    studyStorage.getStudentProfile()
  );
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Modals
  const [voiceTutorOpen, setVoiceTutorOpen] = useState(false);
  const [notebookModalOpen, setNotebookModalOpen] = useState(false);
  const [notebookInitialTab, setNotebookInitialTab] = useState<
    'scan' | 'voice' | 'notebook' | 'planner'
  >('scan');

  // Notifications
  const [notifications, setNotifications] = useState<LearnMateNotification[]>([]);

  // Firebase Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // The cloud profile must load before first-run setup decides whether to open.
  const [accountSynced, setAccountSynced] = useState(false);
  // Forces a re-render after the student verifies their email (reload() mutates the same User).
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

  /** Loads the signed-in student's private data from their cloud area. */
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
    setPublicRoute(null);
    publicBackTargetRef.current = null;
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const targetHash = `#${tab}`;
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

  // A signed-out visitor always sees the public landing page, even if an old tab hash
  // points at a private tab or the session was just signed out.
  useEffect(() => {
    if (!isAuthReady || user || publicRoute) return;
    setPublicRoute('landing');
    if (typeof window !== 'undefined' && window.location.hash !== '#landing') {
      window.history.replaceState(null, '', '#landing');
      window.scrollTo({ top: 0 });
    }
  }, [isAuthReady, user, publicRoute]);

  useEffect(() => {
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
        // Email accounts sync only after verification (the database refuses them until then).
        if (!needsEmailVerification(currentUser)) {
          await syncAccount(currentUser);
        }
      } else {
        // Signed out (or no session): wipe the previous account's private data from this browser
        // before the UI is allowed to render anything.
        await studyStorage.syncWithCloudUser(null);
        reloadLocalState();
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

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

  // Finish the sample intent after sign-in or email verification, then leave the auth screen.
  useEffect(() => {
    if (!isAuthReady || !user || needsEmailVerification(user)) return;
    if (pendingSampleAdd) {
      addSampleToAccount();
      return;
    }
    if (publicRoute === 'signin' || publicRoute === 'signup') {
      // Replace the auth screen in history so the browser Back button does not bounce
      // between "Opening your dashboard…" and the dashboard.
      setPublicRoute(null);
      publicBackTargetRef.current = null;
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '#dashboard');
        window.scrollTo({ top: 0 });
      }
    }
  }, [isAuthReady, user, verificationTick, pendingSampleAdd, publicRoute]);

  // Open first-run setup only after the cloud profile has loaded, so returning students are not
  // asked the same four questions again on a new device.
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
      const extracted = await extractPagesFromPdf(file);
      if (extracted.pages.length === 0) {
        throw new Error(
          'Could not extract readable text from this PDF. Please try another PDF or use Paste Notes.'
        );
      }

      const analysis = await aiStudyClient
        .analyzeDocument(file.name, extracted.pages)
        .catch(() => ({
          overview: `Uploaded study material (${extracted.pageCount} pages).`,
          topics: []
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
        overview: analysis.overview || `Uploaded PDF (${extracted.pageCount} pages).`
      };

      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);

      const updatedDocs = studyStorage.getDocuments();
      setDocuments(updatedDocs);
      setActiveDoc(newDoc);
      setStudyInitialMode('explain');
      handleSelectTab('study');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process PDF file.');
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
        topics: []
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
        overview: analysis.overview || cleaned.slice(0, 220)
      };

      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);

      const updatedDocs = studyStorage.getDocuments();
      setDocuments(updatedDocs);
      setActiveDoc(newDoc);
      setStudyInitialMode('explain');
      handleSelectTab('study');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to analyze study notes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitYouTubeUrl = async (url: string) => {
    setErrorMessage(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a valid YouTube lecture URL or topic.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await aiStudyClient.analyzeYouTubeVideo(trimmed);
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
        overview: result.overview
      };
      studyStorage.saveDocument(newDoc);
      studyStorage.setActiveDocumentId(newDoc.id);
      setDocuments(studyStorage.getDocuments());
      setActiveDoc(newDoc);
      setStudyInitialMode('explain');
      handleSelectTab('study');
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
      lastStudiedAt: new Date().toISOString()
    };
    studyStorage.saveDocument(updated);
    studyStorage.setActiveDocumentId(updated.id);
    setDocuments(studyStorage.getDocuments());
    setActiveDoc(updated);
    setStudyInitialMode(targetMode);
    handleSelectTab('study');
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

  // Public pages and account gates: nothing private renders until a verified student is signed in.
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

  if (!firebaseConfigured) {
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
    <div className="min-h-screen flex flex-col bg-canvas text-ink pb-20 lg:pb-0">
      <DynamicCompanion activeDoc={effectiveDoc} />
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        hasActiveDoc={!!activeDoc}
        activeDoc={activeDoc}
        onOpenNotebookModal={() => {
          setNotebookInitialTab('scan');
          setNotebookModalOpen(true);
        }}
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
      />

      {/* Main Content Container */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <HomeView
            documents={documents}
            onUploadPdf={handleUploadPdf}
            onSubmitTextNotes={(title, text) => handleSubmitTextNotes(title, text, 'text')}
            onSubmitYouTubeUrl={handleSubmitYouTubeUrl}
            onSelectDocument={handleSelectDocument}
            onNavigateTab={handleSelectTab}
            onOpenVoiceTutor={() => setVoiceTutorOpen(true)}
            onOpenNotebookModal={(tab = 'scan') => {
              setNotebookInitialTab(tab);
              setNotebookModalOpen(true);
            }}
            isProcessing={isProcessing}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        )}

        {activeTab === 'dashboard' && (
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
              onNavigateTab={handleSelectTab}
              studentProfile={studentProfile}
              isProfileSyncing={isSyncing}
              onOpenProfileModal={() => {
                setSetupDismissed(false);
                setSetupOpen(true);
              }}
            />
          </div>
        )}

        {(activeTab === 'study' || activeTab === 'ai-tutor') && activeDoc && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <StudyView
              documents={documents}
              activeDocument={effectiveDoc}
              onSelectDocument={(doc) => {
                studyStorage.setActiveDocumentId(doc.id);
                setActiveDoc(doc);
              }}
              initialSubMode={activeTab === 'ai-tutor' ? 'explain' : studyInitialMode}
              presentationMode={activeTab === 'ai-tutor' ? 'ai-tutor' : 'study-space'}
              onAttemptSaved={refreshDocumentsState}
              onNavigateProgress={() => handleSelectTab('analytics')}
              onOpenPdfWorkspace={() => handleSelectTab('pdf-workspace')}
              onOpenUploadModal={() => handleSelectTab('home')}
              isCloudSynced={!!user}
            />
          </div>
        )}

        {(activeTab === 'study' || activeTab === 'ai-tutor') && !activeDoc && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <h2 className="font-serif-editorial text-3xl font-bold text-ink">
              No Study Document Selected
            </h2>
            <p className="text-sm text-muted">
              Upload a PDF or select one of your materials to start studying.
            </p>
            <button
              onClick={() => handleSelectTab('home')}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              Upload Study Material
            </button>
          </div>
        )}

        {activeTab === 'revision' && activeDoc && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <QuickReviseView
              activeDocument={effectiveDoc}
              onNavigateToCitation={(pageNumber) => {
                setStudyInitialMode('explain');
                handleSelectTab('study');
              }}
              onAskTutorAboutConcept={() => {
                handleSelectTab('ai-tutor');
              }}
            />
          </div>
        )}

        {activeTab === 'revision' && !activeDoc && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <h2 className="font-serif-editorial text-3xl font-bold text-ink">
              Select a Material to Revise
            </h2>
            <button
              onClick={() => handleSelectTab('home')}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              Upload Material
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
                  handleSelectTab('study');
                }
              }}
              studentProfile={studentProfile}
              onOpenProfileModal={() => setProfileModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ExploreWorkspaceView
              activeSubTab={exploreSubTab}
              onSelectSubTab={setExploreSubTab}
              activeDoc={activeDoc}
              onImportAsStudyMaterial={(title, content, sourceType) => {
                handleSubmitTextNotes(
                  title,
                  content,
                  sourceType === 'youtube' ? 'youtube' : 'text'
                );
              }}
            />
          </div>
        )}

        {activeTab === 'create' && effectiveDoc && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <CreativeStudioView
              documents={documents}
              activeDocument={effectiveDoc}
              onSelectDocument={(docId) => {
                const found = documents.find((d) => d.id === docId);
                if (found) setActiveDoc(found);
              }}
              onOpenNotebookModal={(mode) => {
                setNotebookInitialTab(mode);
                setNotebookModalOpen(true);
              }}
              onGenerateFlashcardsFromNotes={() => {
                handleSelectTab('revision');
              }}
            />
          </div>
        )}

        {activeTab === 'create' && !effectiveDoc && (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <h2 className="font-serif-editorial text-3xl font-bold text-ink">
              Add Study Material First
            </h2>
            <p className="text-sm text-muted">
              The creative tools work on one of your study materials. Upload a PDF or paste notes to begin.
            </p>
            <button
              onClick={() => handleSelectTab('home')}
              className="px-5 py-2.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
            >
              Upload Study Material
            </button>
          </div>
        )}

        {activeTab === 'pdf-workspace' && (
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <PdfWorkspaceView
              documents={documents}
              activeDoc={activeDoc}
              onSelectDoc={(doc) => setActiveDoc(doc)}
              onUploadClick={() => handleSelectTab('home')}
              onDeleteDoc={handleDeleteDocument}
              onDocumentsChanged={refreshDocumentsState}
              onOpenStudySpace={() => {
                setStudyInitialMode('explain');
                handleSelectTab('study');
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
      {activeDoc && (
        <VoiceTutorModal
          isOpen={voiceTutorOpen}
          onClose={() => setVoiceTutorOpen(false)}
          activeDocument={activeDoc}
          weakTopics={studentProfile.weakAreas}
        />
      )}

      {/* Smart Notebook, OCR Scanner & Voice Recorder Modal */}
      <NotebookAndScannerModal
        isOpen={notebookModalOpen}
        initialMode={notebookInitialTab}
        onClose={() => setNotebookModalOpen(false)}
        onImportAsStudyDocument={(doc) => {
          studyStorage.saveDocument(doc);
          studyStorage.setActiveDocumentId(doc.id);
          setDocuments(studyStorage.getDocuments());
          setActiveDoc(doc);
          setStudyInitialMode('explain');
          handleSelectTab('study');
        }}
      />
    </div>
  );
}

export default App;

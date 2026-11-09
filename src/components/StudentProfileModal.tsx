import React, { useState, useEffect } from 'react';
import {
  X,
  GraduationCap,
  Target,
  CheckCircle2,
  School,
  Building2,
  Globe,
  Clock,
  BookOpen,
  Download,
  FileDown,
  Trash2,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  StudentAcademicProfile,
  EducationStage,
  ExamTypeId
} from '../types/study';
import { studyStorage } from '../services/storageService';
import { generateStudentDataExportPdfBytes, triggerPdfDownload } from '../utils/pdfGenerator';
import { apiFetch } from '../services/apiFetch';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSaved: (profile: StudentAcademicProfile) => void;
}

const EXAM_OPTIONS: { id: ExamTypeId; label: string; badge: string }[] = [
  { id: 'jee_main', label: 'JEE Main', badge: 'Engineering UG' },
  { id: 'jee_advanced', label: 'JEE Advanced', badge: 'IIT Entrance' },
  { id: 'neet_ug', label: 'NEET UG', badge: 'Medical UG' },
  { id: 'cuet', label: 'CUET UG / PG', badge: 'Central Universities' },
  { id: 'board_exams', label: 'Board Exams (CBSE / ICSE / State)', badge: 'Class 10 & 12' },
  { id: 'university_exams', label: 'University / College Semester Exams', badge: 'B.Tech / B.Sc / MBBS / BA' },
  { id: 'general_practice', label: 'General Practice & Concept Mastery', badge: 'Self-Paced' }
];

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileSaved
}) => {
  const [profile, setProfile] = useState<StudentAcademicProfile>(() =>
    studyStorage.getStudentProfile()
  );
  const [subjectsInput, setSubjectsInput] = useState<string>('');
  const [weakAreasInput, setWeakAreasInput] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [dataControlStatus, setDataControlStatus] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = studyStorage.getStudentProfile();
      setProfile(current);
      setSubjectsInput(current.subjectsStudied.join(', '));
      setWeakAreasInput(current.weakAreas.join(', '));
      setSavedNotice(false);
      setDataControlStatus(null);
      setConfirmDeleteOpen(false);
    }
  }, [isOpen]);

  const handleExportJsonArchive = () => {
    const archive = studyStorage.exportStudentDataArchive();
    const jsonString = JSON.stringify(archive, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (profile.fullName || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `LearnMate_Student_Data_Export_${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDataControlStatus(
      `Exported complete JSON archive (${archive.documents.length} documents, ${archive.quizAttempts.length} quiz attempts, ${archive.handwrittenNotes.length} handwritten notebooks).`
    );
  };

  const handleExportPdfSummary = async () => {
    const archive = studyStorage.exportStudentDataArchive();
    const pdfBytes = await generateStudentDataExportPdfBytes({
      exportedAt: archive.exportedAt,
      studentProfile: {
        fullName: archive.studentProfile.fullName,
        schoolClass: archive.studentProfile.schoolClass,
        targetExam: archive.studentProfile.targetExam,
        preferredLanguage: archive.studentProfile.preferredLanguage,
        weakAreas: archive.studentProfile.weakAreas,
      },
      documents: archive.documents.map((d) => ({
        id: d.id,
        title: d.title,
        sourceType: d.sourceType,
        pageCount: d.pageCount,
      })),
      quizAttempts: archive.quizAttempts.map((q) => ({
        documentTitle: q.documentTitle,
        mode: q.mode,
        score: q.score,
        totalQuestions: q.totalQuestions,
        percentage: q.percentage,
        completedAt: q.completedAt,
      })),
      handwrittenNotesCount: archive.handwrittenNotes.length,
      creativeAssetsCount: archive.creativeAssets.length,
    });
    const safeName = (profile.fullName || 'student').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerPdfDownload(pdfBytes, `LearnMate_Student_Summary_${safeName}.pdf`);
    setDataControlStatus('Exported printable PDF Academic Data Summary.');
  };

  const handleConfirmAccountAndDataDeletion = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await apiFetch('/api/account/delete', { method: 'DELETE' }).catch(() => {});
      const result = await studyStorage.deleteStudentAccountAndData();
      setDataControlStatus(
        `Deleted ${result.deletedLocalKeysCount} local records, ${result.deletedIndexedDbRecordsCount} IndexedDB files, and ${result.deletedCloudDocumentsCount} cloud records.`
      );
      setConfirmDeleteOpen(false);
      onClose();
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (!isOpen) return null;

  const isSchoolStage =
    profile.educationStage === 'school' || profile.educationStage === 'self_learner';

  const handleStageChange = (stage: EducationStage) => {
    setProfile((prev) => ({
      ...prev,
      educationStage: stage,
      targetExam:
        stage === 'college' && prev.targetExam === 'board_exams'
          ? 'university_exams'
          : stage === 'school' && prev.targetExam === 'university_exams'
          ? 'board_exams'
          : prev.targetExam
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSubjects = subjectsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedWeakAreas = weakAreasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: StudentAcademicProfile = {
      ...profile,
      subjectsStudied: parsedSubjects,
      weakAreas: parsedWeakAreas,
      updatedAt: new Date().toISOString()
    };

    const saved = studyStorage.saveStudentProfile(updated);
    setProfile(saved);
    setSavedNotice(true);
    onProfileSaved(saved);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <div
      data-testid="student-profile-modal"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#121A2E] text-ink rounded-2xl border border-line shadow-2xl max-w-3xl w-full overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-canvas border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="lm-kicker">ACADEMIC PROFILE</div>
              <h2 className="font-serif-editorial text-xl font-bold text-ink">
                Student Identity &amp; Exam Goals
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-soft flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-full-name" className="block text-xs font-semibold text-ink mb-1.5">
                Full Name
              </label>
              <input
                id="student-full-name"
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                data-testid="profile-fullname-input"
                placeholder="e.g. Aarav Sharma"
                className="w-full h-10 px-3.5 rounded-lg border border-line text-xs font-medium text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="student-education-stage" className="block text-xs font-semibold text-ink mb-1.5">
                Current Education Stage
              </label>
              <select
                id="student-education-stage"
                value={profile.educationStage}
                onChange={(e) => handleStageChange(e.target.value as EducationStage)}
                data-testid="profile-stage-select"
                className="w-full h-10 px-3.5 rounded-lg border border-line text-xs font-semibold text-ink bg-white dark:bg-[#0B1020] focus:outline-none focus:border-brand"
              >
                <option value="school">School Student (Class 9-12)</option>
                <option value="college">Undergraduate / College Student</option>
                <option value="self_learner">Self-Learner / Competitive Aspirant</option>
              </select>
            </div>
          </div>

          {/* Conditional Academic Fields: School vs College */}
          {isSchoolStage ? (
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <School className="w-4 h-4 text-brand" />
                <span>School / Dropper Details (Class 9–12)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="profile-school-class" className="block text-xs font-medium text-muted mb-1">
                    Class / Grade
                  </label>
                  <select
                    id="profile-school-class"
                    value={profile.schoolClass}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        schoolClass: e.target.value as StudentAcademicProfile['schoolClass']
                      })
                    }
                    data-testid="profile-school-class-select"
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  >
                    <option value="">Not set</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Dropper">Dropper</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="profile-stream" className="block text-xs font-medium text-muted mb-1">
                    Academic Stream
                  </label>
                  <select
                    id="profile-stream"
                    value={profile.stream}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        stream: e.target.value as StudentAcademicProfile['stream']
                      })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  >
                    <option value="">Not set</option>
                    <option value="PCM">Science (PCM)</option>
                    <option value="PCB">Science (PCB)</option>
                    <option value="PCMB">Science (PCMB)</option>
                    <option value="Commerce">Commerce</option>
                    <option value="Arts / Humanities">Arts / Humanities</option>
                    <option value="Foundation">Foundation (Class 9/10)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="profile-board" className="block text-xs font-medium text-muted mb-1">
                    School Board
                  </label>
                  <select
                    id="profile-board"
                    value={profile.schoolBoard}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        schoolBoard: e.target.value as StudentAcademicProfile['schoolBoard']
                      })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  >
                    <option value="">Not set</option>
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE / ISC">ICSE / ISC</option>
                    <option value="State Board">State Board</option>
                    <option value="IB / Cambridge">IB / Cambridge</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="profile-acad-year" className="block text-xs font-medium text-muted mb-1">
                    Academic Year
                  </label>
                  <input
                    id="profile-acad-year"
                    type="text"
                    value={profile.academicYear}
                    onChange={(e) => setProfile({ ...profile, academicYear: e.target.value })}
                    placeholder="2026-2027"
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="profile-school-name" className="block text-xs font-medium text-muted mb-1">
                  School Name (Optional)
                </label>
                <input
                  id="profile-school-name"
                  type="text"
                  value={profile.schoolName}
                  onChange={(e) => setProfile({ ...profile, schoolName: e.target.value })}
                  placeholder="e.g. Delhi Public School / Kendriya Vidyalaya"
                  className="w-full h-9 px-3 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs text-ink"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Building2 className="w-4 h-4 text-brand" />
                <span>Undergraduate / University Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="profile-college-year" className="block text-xs font-medium text-muted mb-1">
                    Year of Study
                  </label>
                  <select
                    id="profile-college-year"
                    value={profile.collegeYear}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        collegeYear: e.target.value as StudentAcademicProfile['collegeYear']
                      })
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  >
                    <option value="">Not set</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="profile-degree-course" className="block text-xs font-medium text-muted mb-1">
                    Degree Program
                  </label>
                  <input
                    id="profile-degree-course"
                    type="text"
                    value={profile.degreeCourse}
                    onChange={(e) => setProfile({ ...profile, degreeCourse: e.target.value })}
                    placeholder="e.g. B.Tech Computer Science, B.Sc, MBBS"
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  />
                </div>
                <div>
                  <label htmlFor="profile-university-name" className="block text-xs font-medium text-muted mb-1">
                    College / University
                  </label>
                  <input
                    id="profile-university-name"
                    type="text"
                    value={profile.universityName}
                    onChange={(e) => setProfile({ ...profile, universityName: e.target.value })}
                    placeholder="e.g. IIT / NIT / Delhi University"
                    className="w-full h-9 px-2.5 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Target Examination & Learning Goals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <Target className="w-4 h-4 text-brand" />
              <span>Target Examination &amp; Preparation Focus</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="profile-target-exam" className="block text-xs font-medium text-muted mb-1">
                  Target Examination (Calibrates Practice Simulator)
                </label>
                <select
                  id="profile-target-exam"
                  value={profile.targetExam}
                  onChange={(e) =>
                    setProfile({ ...profile, targetExam: e.target.value as ExamTypeId })
                  }
                  data-testid="profile-target-exam-select"
                  className="w-full h-10 px-3 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-bold text-ink"
                >
                  {EXAM_OPTIONS.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.label} ({exam.badge})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="profile-target-year" className="block text-xs font-medium text-muted mb-1">
                  Target Exam Year
                </label>
                <input
                  id="profile-target-year"
                  type="text"
                  value={profile.targetExamYear}
                  onChange={(e) => setProfile({ ...profile, targetExamYear: e.target.value })}
                  placeholder="2027"
                  className="w-full h-10 px-3 rounded-lg border border-line text-xs font-bold text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-exam-session" className="block text-xs font-medium text-muted mb-1">
                  JEE Main 2027 Session
                </label>
                <select
                  id="profile-exam-session"
                  value={profile.examSession}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      examSession: e.target.value as StudentAcademicProfile['examSession']
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                >
                  <option value="jee_main_2027_session_1">
                    Session 1 (20–28 Jan 2027)
                  </option>
                  <option value="jee_main_2027_session_2">
                    Session 2 (2–7 Apr 2027)
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="profile-age-band" className="block text-xs font-medium text-muted mb-1">
                  Age Band
                </label>
                <select
                  id="profile-age-band"
                  value={profile.ageBand}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      ageBand: e.target.value as StudentAcademicProfile['ageBand']
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                >
                  <option value="">Not set</option>
                  <option value="under_16">Under 16</option>
                  <option value="16_17">16–17</option>
                  <option value="18_plus">18 or older</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              The age band helps apply the right AI safeguards. Under-18 accounts never get image
              or video generation. School, board and goal fields are optional.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-subjects" className="block text-xs font-medium text-muted mb-1">
                  Subjects Studied (comma-separated)
                </label>
                <input
                  id="profile-subjects"
                  type="text"
                  value={subjectsInput}
                  onChange={(e) => setSubjectsInput(e.target.value)}
                  placeholder="Physics, Mathematics, Chemistry"
                  className="w-full h-10 px-3 rounded-lg border border-line text-xs text-ink"
                />
              </div>

              <div>
                <label htmlFor="profile-weak-areas" className="block text-xs font-medium text-muted mb-1">
                  Weak Topics to Target (comma-separated)
                </label>
                <input
                  id="profile-weak-areas"
                  type="text"
                  value={weakAreasInput}
                  onChange={(e) => setWeakAreasInput(e.target.value)}
                  placeholder="Conditional Probability, Bayes Theorem, Integration"
                  className="w-full h-10 px-3 rounded-lg border border-line text-xs text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-language" className="block text-xs font-medium text-muted mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted" />
                  Preferred Study Language
                </label>
                <select
                  id="profile-language"
                  value={profile.preferredLanguage}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferredLanguage: e.target.value as StudentAcademicProfile['preferredLanguage']
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-line bg-white dark:bg-[#0B1020] text-xs font-semibold text-ink"
                >
                  <option value="English">English</option>
                  <option value="Hindi + English (Hinglish)">Hindi + English (Hinglish)</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Bengali">Bengali</option>
                </select>
              </div>

              <div>
                <label htmlFor="profile-daily-goal" className="block text-xs font-medium text-muted mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted" />
                  Daily Study Goal (Minutes)
                </label>
                <input
                  id="profile-daily-goal"
                  type="number"
                  min={15}
                  max={600}
                  value={profile.dailyStudyMinutesGoal}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      dailyStudyMinutesGoal: Number(e.target.value) || 90
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-line text-xs font-semibold text-ink"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-goal-statement" className="block text-xs font-medium text-muted mb-1">
                Semester or Exam Goal Note
              </label>
              <textarea
                id="profile-goal-statement"
                rows={2}
                value={profile.personalGoalStatement}
                onChange={(e) =>
                  setProfile({ ...profile, personalGoalStatement: e.target.value })
                }
                placeholder="Target score, rank goal, or conceptual milestones for this term..."
                className="w-full p-3 rounded-lg border border-line text-xs text-ink focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Phase 6 Section 10: Student Data Control & Privacy (Export & Account Deletion) */}
          <div
            data-testid="student-data-control-section"
            className="p-4 rounded-xl bg-canvas border border-line space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <BookOpen className="w-4 h-4 text-brand" />
                <span>Student Data Control &amp; Privacy (DPDP Compliant)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-soft text-brand">
                Self-Serve Export &amp; Deletion
              </span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Download your complete academic history (profile, uploaded documents, revision sheets, handwritten notes, quiz attempts, and Mistake DNA) or permanently delete your account and all stored data.
            </p>

            {dataControlStatus && (
              <div
                data-testid="data-control-status-banner"
                className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold"
              >
                {dataControlStatus}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="export-student-json-btn"
                onClick={handleExportJsonArchive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B1020] border border-line hover:border-brand text-xs font-semibold text-ink cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-brand" />
                <span>Export My Data (JSON)</span>
              </button>

              <button
                type="button"
                data-testid="export-student-pdf-btn"
                onClick={() => void handleExportPdfSummary()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B1020] border border-line hover:border-brand text-xs font-semibold text-ink cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-brand" />
                <span>Export Summary (PDF)</span>
              </button>

              <button
                type="button"
                data-testid="delete-student-account-btn"
                onClick={() => setConfirmDeleteOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-red-700 cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account &amp; Data</span>
              </button>
            </div>

            {confirmDeleteOpen && (
              <div
                data-testid="confirm-delete-account-panel"
                className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2.5 text-xs text-red-950"
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Confirm Permanent Account &amp; Data Deletion</p>
                    <p className="text-[11px] text-red-800 mt-0.5">
                      This will permanently erase your study materials, IndexedDB PDFs, handwritten notes, quiz history, Mistake DNA, cloud sync records, and sign-in account.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Keep My Account
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-account-btn"
                    disabled={isDeletingAccount}
                    onClick={() => void handleConfirmAccountAndDataDeletion()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Yes, Permanently Delete Everything</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {savedNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile saved. Your dashboard and practice will follow these settings.</span>
            </div>
          )}

          <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-line text-xs font-semibold text-muted hover:bg-soft cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="profile-save-btn"
              className="h-10 px-5 rounded-lg lm-btn-accent text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Academic Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

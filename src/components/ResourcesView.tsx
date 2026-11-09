import React, { useState } from 'react';
import {
  Atom,
  BookOpen,
  ExternalLink,
  FlaskConical,
  Plus,
  ShieldCheck,
  Sigma,
  FileText,
  Scale,
  Info,
  Calendar,
  Check,
} from 'lucide-react';
import { JEE_MAIN_2027_KEY_DATES } from '../utils/jeeCalendar';
import { SYLLABUS_VERSIONS, type ExamTrackId } from '../data/jeeSyllabusAndNotes';

interface ResourcesViewProps {
  onImportReferenceNotes?: (title: string, content: string) => void;
  onOpenSyllabus?: (exam: ExamTrackId) => void;
}

interface OfficialPortal {
  id: string;
  name: string;
  organization: string;
  badge: string;
  description: string;
  url: string;
  verifiedAt: string;
}

const OFFICIAL_PORTALS: OfficialPortal[] = [
  {
    id: 'sathee',
    name: 'SATHEE (IIT Kanpur)',
    organization: 'IIT Kanpur · Ministry of Education',
    badge: 'FREE LECTURES & TESTS',
    description: 'JEE preparation portal with concept videos, NCERT exemplars, and chapter tests.',
    url: 'https://sathee.iitk.ac.in/',
    verifiedAt: '2026-11-01',
  },
  {
    id: 'nta-abhyas',
    name: 'National Test Abhyas',
    organization: 'National Testing Agency (NTA)',
    badge: 'OFFICIAL MOCK TESTS',
    description: 'Official NTA practice papers and CBT interface simulations for Physics, Chemistry, and Maths.',
    url: 'https://nta.in/Abhyas',
    verifiedAt: '2026-11-01',
  },
  {
    id: 'jee-main-portal',
    name: 'JEE Main Official Portal',
    organization: 'National Testing Agency (NTA)',
    badge: 'BULLETIN & SYLLABUS',
    description: 'Official information bulletin, rationalized syllabus PDF, and application notices.',
    url: 'https://jeemain.nta.nic.in/',
    verifiedAt: '2026-11-01',
  },
  {
    id: 'jee-adv-portal',
    name: 'JEE Advanced Official Portal',
    organization: 'IIT Joint Admission Board (JAB)',
    badge: 'OFFICIAL PAST PAPERS',
    description: 'Official JEE (Advanced) Paper 1 & Paper 2 archives, syllabus PDF, and information brochure.',
    url: 'https://jeeadv.ac.in/',
    verifiedAt: '2026-11-01',
  },
  {
    id: 'ncert-textbooks',
    name: 'NCERT e-Textbooks',
    organization: 'NCERT',
    badge: 'OFFICIAL TEXTBOOKS',
    description: 'Free chapter-wise PDFs for Class 11 and Class 12 Physics, Chemistry, and Mathematics.',
    url: 'https://ncert.nic.in/textbook.php',
    verifiedAt: '2026-11-01',
  },
];

interface HighYieldStarterSheet {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapterId: string;
  title: string;
  summary: string;
  content: string;
}

const HIGH_YIELD_REFERENCE_SHEETS: HighYieldStarterSheet[] = [
  {
    id: 'ref-physics-mechanics',
    subject: 'Physics',
    chapterId: 'ch-phys-work-energy-rotation',
    title: 'Rotational Motion & Gravitation',
    summary:
      'Moment of inertia standard results, parallel & perpendicular axis theorems, pure rolling on an incline, and orbital/escape speeds.',
    content: `--- Page 1 ---
Rotational Kinematics & Moment of Inertia
• Angular equations for constant angular acceleration α:
  ω = ω₀ + αt
  θ = ω₀t + ½αt²
  ω² = ω₀² + 2αθ
• Moment of Inertia (I = ∑ mᵢ rᵢ²):
  - Thin ring about central axis perpendicular to plane: I = MR²
  - Uniform disc about central perpendicular axis: I = ½MR²
  - Solid sphere about diameter: I = (2/5)MR²
  - Hollow thin sphere about diameter: I = (2/3)MR²
  - Thin uniform rod of length L about centre perpendicular to length: I = (1/12)ML²
• Theorems of Moment of Inertia:
  - Parallel Axis Theorem: I = I_cm + Md²
  - Perpendicular Axis Theorem (planar lamina): I_z = I_x + I_y

--- Page 2 ---
Torque, Angular Momentum, Rolling & Gravitation
• Torque and Angular Momentum:
  τ = r × F = dL/dt
  For fixed-axis rotation: τ = Iα and L = Iω
  Conservation of angular momentum: If net external torque τ_ext = 0, then I₁ω₁ = I₂ω₂.
• Pure Rolling without Slipping (on stationary surface):
  v_cm = Rω, a_cm = Rα
  Total kinetic energy: K = ½mv_cm² (1 + k²/R²), where I_cm = mk².
  Acceleration down rough incline of angle θ: a = g sin θ / (1 + k²/R²).
• Gravitation Key Relations:
  Gravitational potential energy: U = -GMm / r
  Orbital speed (circular orbit at radius r): v_o = √(GM / r)
  Escape speed from surface of radius R: v_e = √(2GM / R) = √2 · v_o`,
  },
  {
    id: 'ref-chemistry-thermo',
    subject: 'Chemistry',
    chapterId: 'ch-chem-thermo-equilibrium',
    title: 'Thermodynamics & Equilibrium',
    summary:
      'First law sign conventions (IUPAC), enthalpy, isothermal reversible work, Gibbs free energy, and Van’t Hoff equation.',
    content: `--- Page 1 ---
First Law of Thermodynamics & Work Done (IUPAC Convention)
• First Law: ΔU = q + w (work done ON the system is positive).
• Enthalpy definition: H = U + PV; for ideal gas reactions at constant T:
  ΔH = ΔU + Δn_g RT, where Δn_g = (moles of gaseous products) − (moles of gaseous reactants).
• Work in Ideal Gas Processes:
  - Irreversible expansion against constant external pressure P_ext: w = −P_ext (V₂ − V₁)
  - Reversible isothermal process (constant T): w = −2.303 nRT log₁₀(V₂ / V₁) = −2.303 nRT log₁₀(P₁ / P₂)
  - Adiabatic process (q = 0): ΔU = w = nC_v,m (T₂ − T₁) and PV^γ = constant, where γ = C_p / C_v.

--- Page 2 ---
Spontaneity, Gibbs Energy & Chemical Equilibrium
• Entropy change for isothermal reversible transfer: ΔS = q_rev / T
• Gibbs Free Energy: ΔG = ΔH − TΔS (at constant T and P)
  - ΔG < 0: spontaneous process
  - ΔG = 0: system at equilibrium
• Relation with Equilibrium Constant K:
  ΔG = ΔG° + RT ln Q
  At equilibrium (ΔG = 0, Q = K): ΔG° = −RT ln K = −2.303 RT log₁₀ K
• Relation between K_p and K_c:
  K_p = K_c (RT)^(Δn_g)
• Van’t Hoff Equation (temperature dependence of K):
  log₁₀(K₂ / K₁) = (ΔH° / 2.303 R) · [(T₂ − T₁) / (T₁ T₂)]`,
  },
  {
    id: 'ref-maths-calculus',
    subject: 'Mathematics',
    chapterId: 'ch-math-integral-calculus-ode',
    title: 'Integration & Differential Equations',
    summary:
      'King’s property, symmetric interval rules, Leibniz rule, Newton-Leibniz formula, and linear first-order ODE integrating factor.',
    content: `--- Page 1 ---
Definite Integration Key Properties & Leibniz Rule
• Fundamental Properties (King's Rule & Symmetry):
  1. ∫_a^b f(x) dx = ∫_a^b f(a + b − x) dx
  2. ∫_0^a f(x) dx = ∫_0^a f(a − x) dx
  3. ∫_(-a)^a f(x) dx = 0 if f(−x) = −f(x) (odd function), and 2 ∫_0^a f(x) dx if f(−x) = f(x) (even function).
  4. ∫_0^(2a) f(x) dx = ∫_0^a [f(x) + f(2a − x)] dx
• Leibniz Rule (Differentiation under the Integral Sign):
  d/dx [ ∫_{g(x)}^{h(x)} f(t) dt ] = f(h(x)) · h'(x) − f(g(x)) · g'(x)

--- Page 2 ---
First-Order Differential Equations & Area Under Curves
• Variable Separable Form:
  dy/dx = f(x)g(y)  ⇒  ∫ dy / g(y) = ∫ f(x) dx + C
• Homogeneous First-Order ODE:
  dy/dx = F(y/x); substitute y = vx so dy/dx = v + x(dv/dx).
• First-Order Linear Differential Equation:
  Standard form: dy/dx + P(x)y = Q(x)
  Integrating Factor (I.F.): I.F. = e^(∫ P(x) dx)
  General solution: y · (I.F.) = ∫ Q(x) · (I.F.) dx + C`,
  },
];

const SUBJECT_BADGE: Record<
  'Physics' | 'Chemistry' | 'Mathematics',
  { icon: React.ComponentType<{ className?: string }>; className: string; label: string }
> = {
  Physics: { icon: Atom, className: 'bg-physics-soft text-physics', label: 'Physics' },
  Chemistry: { icon: FlaskConical, className: 'bg-chemistry-soft text-chemistry', label: 'Chemistry' },
  Mathematics: { icon: Sigma, className: 'bg-maths-soft text-maths', label: 'Maths' },
};

type ExamGuideSection = 'pattern' | 'marking' | 'rules' | 'schedule';

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  onImportReferenceNotes,
  onOpenSyllabus,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'portals' | 'guide' | 'sheets'>('all');
  const [guideExam, setGuideExam] = useState<ExamTrackId>('jee_main');
  const [guideDetailSection, setGuideDetailSection] = useState<ExamGuideSection>('pattern');
  const [importedIds, setImportedIds] = useState<Record<string, boolean>>({});

  const syllabusMeta = SYLLABUS_VERSIONS[guideExam];

  return (
    <div className="space-y-6" data-testid="resources-view">
      {/* Header & Section Tabs matching Image 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Resources
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Official portals, verified JEE Main &amp; Advanced exam guides, and chapter quick sheets
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-line bg-white dark:bg-[#121A2E] p-1">
          {(
            [
              { id: 'all', label: 'Official Portals' },
              { id: 'guide', label: 'Exam Guide' },
              { id: 'sheets', label: 'Quick Sheets' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              data-testid={`resources-tab-${tab.id}`}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === tab.id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 2-Column Grid: Official Portals (left) + Exam Guide (right) matching Image 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Official Portals */}
        {(activeTab === 'all' || activeTab === 'portals') && (
          <section
            aria-labelledby="official-portals-heading"
            className="lg:col-span-7 lm-card-editorial p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="official-portals-heading" className="font-display text-lg font-extrabold text-ink">
                Official Portals
              </h2>
              {onOpenSyllabus && (
                <button
                  type="button"
                  onClick={() => onOpenSyllabus(guideExam)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand/30 bg-brand-soft text-brand text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Syllabus</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-line rounded-xl border border-line bg-canvas overflow-hidden">
              {OFFICIAL_PORTALS.map((portal) => (
                <a
                  key={portal.id}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`resource-portal-${portal.id}`}
                  className="px-4 py-3.5 hover:bg-soft transition-colors flex items-center justify-between gap-4 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-ink group-hover:text-brand">
                        {portal.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-brand-soft text-brand text-[10px] font-bold">
                        {portal.badge}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{portal.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted group-hover:text-brand shrink-0" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Right: Exam Guide (Main | Advanced toggle + Pattern / Marking / Exam Rules / Schedule) */}
        {(activeTab === 'all' || activeTab === 'guide') && (
          <section
            aria-labelledby="exam-guide-heading"
            data-testid="resources-exam-guide-card"
            className={`${
              activeTab === 'guide' ? 'lg:col-span-12' : 'lg:col-span-5'
            } lm-card-editorial p-5 space-y-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="exam-guide-heading" className="font-display text-lg font-extrabold text-ink">
                Exam Guide
              </h2>

              <div className="inline-flex rounded-xl border border-line bg-canvas p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setGuideExam('jee_main')}
                  data-testid="exam-guide-toggle-main"
                  className={`px-3 py-1 rounded-lg cursor-pointer ${
                    guideExam === 'jee_main' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Main
                </button>
                <button
                  type="button"
                  onClick={() => setGuideExam('jee_advanced')}
                  data-testid="exam-guide-toggle-advanced"
                  className={`px-3 py-1 rounded-lg cursor-pointer ${
                    guideExam === 'jee_advanced' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Advanced
                </button>
              </div>
            </div>

            {/* 4 Separately Discoverable Buttons: Pattern | Marking | Exam Rules | Schedule */}
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: 'pattern', label: 'Pattern', icon: FileText },
                  { id: 'marking', label: 'Marking', icon: Scale },
                  { id: 'rules', label: 'Exam Rules', icon: Info },
                  { id: 'schedule', label: 'Schedule', icon: Calendar },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = guideDetailSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGuideDetailSection(item.id)}
                    data-testid={`exam-guide-btn-${item.id}`}
                    className={`px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-brand bg-brand-soft/60 text-brand'
                        : 'border-line bg-canvas hover:bg-soft text-ink'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-brand" />
                      {item.label}
                    </span>
                    <span>→</span>
                  </button>
                );
              })}
            </div>

            {/* Detail Box for Selected Exam Guide Section */}
            <div
              data-testid="exam-guide-detail-box"
              className="rounded-xl border border-line bg-canvas p-4 space-y-2 text-xs"
            >
              {guideDetailSection === 'pattern' &&
                (guideExam === 'jee_main' ? (
                  <>
                    <div className="font-bold text-ink flex items-center justify-between">
                      <span>JEE (Main) Paper 1 (B.E./B.Tech) Pattern</span>
                      <span className="text-brand">300 Marks · 180 Min</span>
                    </div>
                    <p className="text-muted leading-relaxed">
                      • 3 Subjects: Physics, Chemistry, and Mathematics (25 questions per subject = 75 total questions).
                      <br />• Section A: 20 Single-Choice MCQs per subject.
                      <br />• Section B: 5 Numerical Value questions per subject.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-ink flex items-center justify-between">
                      <span>JEE (Advanced) Paper 1 &amp; Paper 2 Structure</span>
                      <span className="text-brand">2 Compulsory Papers · 3 Hours Each</span>
                    </div>
                    <p className="text-muted leading-relaxed">
                      • Conducted in two mandatory 3-hour sessions: Paper 1 (09:00–12:00 IST) and Paper 2 (14:30–17:30 IST).
                      <br />• Question formats include One-or-More-Than-One Correct MCQs, Single-Choice MCQs, Non-Negative Integers, and Paragraph/Matching sets.
                    </p>
                  </>
                ))}

              {guideDetailSection === 'marking' &&
                (guideExam === 'jee_main' ? (
                  <>
                    <div className="font-bold text-ink">JEE (Main) Official Marking Scheme</div>
                    <p className="text-muted leading-relaxed">
                      • Correct Answer: <strong>+4 marks</strong>
                      <br />• Incorrect Answer (MCQ or Numerical): <strong>−1 mark</strong>
                      <br />• Unattempted / Marked for Review without saving: <strong>0 marks</strong>
                      <br />• Dropped Question: <strong>+4 marks</strong> awarded to all candidates.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-ink">JEE (Advanced) Partial-Credit &amp; Section Marking</div>
                    <p className="text-muted leading-relaxed">
                      • Multi-Correct Section: <strong>+4</strong> if all correct options chosen; <strong>+3 / +2 / +1</strong> partial marks if no wrong option is chosen; <strong>−2</strong> if any wrong option is chosen.
                      <br />• Single-Choice MCQ: <strong>+3</strong> for correct, <strong>−1</strong> for wrong.
                      <br />• Non-Negative Integer: <strong>+4</strong> for correct, <strong>0</strong> for wrong.
                    </p>
                  </>
                ))}

              {guideDetailSection === 'rules' && (
                <>
                  <div className="font-bold text-ink">
                    {guideExam === 'jee_main' ? 'NTA CBT Examination Rules' : 'IIT JAB Examination Rules'}
                  </div>
                  <p className="text-muted leading-relaxed">
                    • In NTA CBT, questions marked &quot;Answered &amp; Marked for Review&quot; ARE evaluated for marks upon submission.
                    <br />• Electronic calculators, smartwatches, and external communication tools are strictly prohibited inside the exam hall.
                  </p>
                </>
              )}

              {guideDetailSection === 'schedule' && (
                <div className="space-y-1.5">
                  <div className="font-bold text-ink">
                    {guideExam === 'jee_main'
                      ? 'JEE (Main) 2027 Session Windows'
                      : 'JEE (Advanced) Annual Window'}
                  </div>
                  {guideExam === 'jee_main' ? (
                    <div className="space-y-1">
                      {JEE_MAIN_2027_KEY_DATES.slice(0, 4).map((d) => (
                        <div key={d.label} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted">{d.label}</span>
                          <span className="font-mono font-bold text-ink">{d.date}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted leading-relaxed">
                      Held annually in late May following JEE (Main) Session 2 results for the top 2,50,000 eligible candidates across categories.
                    </p>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-line flex items-center justify-between text-[10px] text-muted">
                <span>
                  Source: {syllabusMeta.officialBody} ({syllabusMeta.versionLabel})
                </span>
                <span>Verified {syllabusMeta.retrievedAt}</span>
              </div>
            </div>

            <a
              href={syllabusMeta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl border border-brand/40 bg-brand-soft/40 hover:bg-brand-soft text-brand text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Official {syllabusMeta.examDisplayName} Portal &amp; Bulletin</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>
        )}
      </div>

      {/* Bottom: Quick Sheets with "+ Add to Materials" matching Image 4 */}
      {(activeTab === 'all' || activeTab === 'sheets') && (
        <section aria-labelledby="quick-sheets-heading" className="lm-card-editorial p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 id="quick-sheets-heading" className="font-display text-lg font-extrabold text-ink">
                Quick Sheets
              </h2>
              <p className="text-xs text-muted">
                Add verified formula &amp; derivation sheets directly to your personal study materials
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HIGH_YIELD_REFERENCE_SHEETS.map((sheet) => {
              const badge = SUBJECT_BADGE[sheet.subject];
              const Icon = badge.icon;
              const isAdded = Boolean(importedIds[sheet.id]);

              return (
                <div
                  key={sheet.id}
                  data-testid={`starter-sheet-${sheet.id}`}
                  className="rounded-2xl border border-line bg-canvas p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badge.className}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {badge.label}
                    </span>
                    <h3 className="font-display text-base font-bold text-ink">{sheet.title}</h3>
                    <p className="text-xs text-muted leading-relaxed">{sheet.summary}</p>
                  </div>

                  {onImportReferenceNotes && (
                    <button
                      type="button"
                      onClick={() => {
                        setImportedIds((prev) => ({ ...prev, [sheet.id]: true }));
                        onImportReferenceNotes(sheet.title, sheet.content);
                      }}
                      data-testid={`import-sheet-btn-${sheet.id}`}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        isAdded
                          ? 'border-emerald-500/40 bg-success-soft text-success'
                          : 'border-brand/40 bg-white dark:bg-[#121A2E] hover:bg-brand-soft text-brand'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added to Materials</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Materials</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

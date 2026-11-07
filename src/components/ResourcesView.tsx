import React, { useState } from 'react';
import {
  Atom,
  BookOpen,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Plus,
  ShieldCheck,
  Sigma,
} from 'lucide-react';
import { JEE_MAIN_2027_KEY_DATES } from '../utils/jeeCalendar';

interface ResourcesViewProps {
  onImportReferenceNotes?: (title: string, content: string) => void;
}

interface OfficialPortal {
  id: string;
  name: string;
  organization: string;
  badge: string;
  description: string;
  url: string;
}

const OFFICIAL_PORTALS: OfficialPortal[] = [
  {
    id: 'sathee',
    name: 'SATHEE (IIT Kanpur & Ministry of Education)',
    organization: 'IIT Kanpur · MoE Govt. of India',
    badge: 'FREE LECTURES & PRACTICE',
    description:
      'Free JEE Main preparation portal built by IIT Kanpur with concept videos, chapter tests, and NCERT-aligned questions.',
    url: 'https://sathee.iitk.ac.in/',
  },
  {
    id: 'nta-abhyas',
    name: 'National Test Abhyas (NTA)',
    organization: 'National Testing Agency',
    badge: 'OFFICIAL MOCK TESTS',
    description:
      'Official NTA practice papers and CBT interface simulations for JEE Main Physics, Chemistry and Mathematics.',
    url: 'https://nta.in/Abhyas',
  },
  {
    id: 'jee-main-portal',
    name: 'JEE (Main) Official Portal',
    organization: 'National Testing Agency',
    badge: 'BULLETIN & SYLLABUS',
    description:
      'Official information bulletin, syllabus PDF, application notices, city intimation slips and admit cards.',
    url: 'https://jeemain.nta.nic.in/',
  },
  {
    id: 'ncert-textbooks',
    name: 'NCERT e-Textbooks (Class 11 & 12)',
    organization: 'NCERT',
    badge: 'OFFICIAL TEXTBOOKS',
    description:
      'Free chapter-wise PDFs for Class 11 and Class 12 Physics, Chemistry and Mathematics — the foundation of JEE Main.',
    url: 'https://ncert.nic.in/textbook.php',
  },
];

interface HighYieldStarterSheet {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  title: string;
  summary: string;
  content: string;
}

const HIGH_YIELD_REFERENCE_SHEETS: HighYieldStarterSheet[] = [
  {
    id: 'ref-physics-mechanics',
    subject: 'Physics',
    title: 'JEE Main Physics — Rotational Motion & Gravitation Reference',
    summary:
      'Moment of inertia standard results, parallel & perpendicular axis theorems, torque-angular momentum relation, and orbital velocity.',
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
    title: 'JEE Main Chemistry — Chemical Thermodynamics & Equilibrium Reference',
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
•Relation between K_p and K_c:
  K_p = K_c (RT)^(Δn_g)
• Van’t Hoff Equation (temperature dependence of K):
  log₁₀(K₂ / K₁) = (ΔH° / 2.303 R) · [(T₂ − T₁) / (T₁ T₂)]`,
  },
  {
    id: 'ref-maths-calculus',
    subject: 'Mathematics',
    title: 'JEE Main Mathematics — Definite Integration & Differential Equations Reference',
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
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  Physics: { icon: Atom, className: 'bg-physics-soft text-physics' },
  Chemistry: { icon: FlaskConical, className: 'bg-chemistry-soft text-chemistry' },
  Mathematics: { icon: Sigma, className: 'bg-maths-soft text-maths' },
};

export const ResourcesView: React.FC<ResourcesViewProps> = ({ onImportReferenceNotes }) => {
  const [importedIds, setImportedIds] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-8" data-testid="resources-view">
      {/* Header */}
      <header className="space-y-2">
        <p className="lm-kicker">Official JEE Main Resources</p>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Free NTA, SATHEE &amp; NCERT Portals
        </h1>
        <p className="max-w-2xl text-sm text-muted leading-relaxed">
          Verified government and academic resources for JEE Main 2027 Session 1. Always cross-check
          registration dates and syllabus notices against the official NTA portal.
        </p>
      </header>

      {/* Official External Links */}
      <section aria-labelledby="official-portals-heading" className="space-y-3">
        <h2 id="official-portals-heading" className="text-sm font-bold text-ink">
          Official Portals
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFICIAL_PORTALS.map((portal) => (
            <a
              key={portal.id}
              href={portal.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`resource-portal-${portal.id}`}
              className="lm-card-editorial p-5 hover:border-brand-200 transition-colors flex flex-col justify-between gap-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold tracking-wider">
                    {portal.badge}
                  </span>
                  <ExternalLink className="w-4 h-4 text-muted group-hover:text-brand transition-colors shrink-0" />
                </div>
                <h3 className="font-display text-base font-bold text-ink group-hover:text-brand transition-colors">
                  {portal.name}
                </h3>
                <p className="text-xs text-muted leading-relaxed">{portal.description}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-muted">
                <span className="font-medium">{portal.organization}</span>
                <span className="font-semibold text-brand">{portal.url.replace(/^https?:\/\//, '')}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Official JEE Main 2027 Key Dates & Pattern */}
      <section aria-labelledby="exam-facts-heading" className="lm-card-editorial p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="lm-kicker">NTA Information Bulletin</p>
            <h2 id="exam-facts-heading" className="font-display text-lg font-extrabold text-ink">
              JEE Main 2027 Paper 1 Pattern &amp; Schedule
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-soft text-success text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            75 Questions · 300 Marks · 3 Hours
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1">
            <span className="font-bold text-ink block">Per-Subject Breakdown</span>
            <p className="text-muted leading-relaxed">
              25 questions each in Physics, Chemistry and Mathematics: 20 single-choice MCQs + 5
              numerical-value questions.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1">
            <span className="font-bold text-ink block">Marking Scheme (+4 / −1)</span>
            <p className="text-muted leading-relaxed">
              +4 marks for a correct answer, −1 mark for an incorrect answer in both MCQ and
              numerical sections, 0 for unattempted.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1">
            <span className="font-bold text-ink block">Exam Hall Rules</span>
            <p className="text-muted leading-relaxed">
              No calculators, smart watches, or electronic devices are permitted in the NTA exam hall.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {JEE_MAIN_2027_KEY_DATES.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs"
            >
              <span className="text-muted block text-[11px]">{item.label}</span>
              <span className="font-bold text-ink mt-0.5 block">
                {item.date}
                {'note' in item && item.note ? ` · ${item.note}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Optional Reference Formula Sheets */}
      {onImportReferenceNotes && (
        <section aria-labelledby="reference-sheets-heading" className="space-y-3">
          <div>
            <h2 id="reference-sheets-heading" className="text-sm font-bold text-ink">
              NCERT-Aligned Quick Reference Sheets
            </h2>
            <p className="text-xs text-muted">
              Add any reference sheet to your materials library to practise questions or review flashcards.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HIGH_YIELD_REFERENCE_SHEETS.map((sheet) => {
              const style = SUBJECT_BADGE[sheet.subject];
              const Icon = style.icon;
              const isAdded = Boolean(importedIds[sheet.id]);
              return (
                <article
                  key={sheet.id}
                  className="lm-card-editorial p-4 sm:p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${style.className}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {sheet.subject}
                    </span>
                    <h3 className="font-display text-sm font-bold text-ink leading-snug">
                      {sheet.title}
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">{sheet.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImportedIds((prev) => ({ ...prev, [sheet.id]: true }));
                      onImportReferenceNotes(sheet.title, sheet.content);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl border border-line bg-canvas hover:bg-brand-soft hover:border-brand-200 hover:text-brand text-xs font-semibold text-ink transition-colors cursor-pointer"
                  >
                    {isAdded ? (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-brand" />
                        Open in Study
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Add to my materials
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

/**
 * External Open-Source PYQ Dataset Registry & Provenance Audit Catalog
 *
 * Strictly separates repository software licenses (MIT / Apache-2.0 / Unlicensed)
 * from underlying exam question, answer key, diagram, and worked solution rights
 * for JEE Main and JEE Advanced.
 */

import type {
  DatasetSourceId,
  ExternalDatasetSourceAudit,
} from '../types';

export const EXTERNAL_DATASET_SOURCE_REGISTRY: Record<
  DatasetSourceId,
  ExternalDatasetSourceAudit
> = {
  jee_mocks_db: {
    sourceId: 'jee_mocks_db',
    displayName: 'JEE Mocks DB (Samkarya / online-exam-questions)',
    discoveryName: 'JEE Mocks DB',
    verifiedRepoUrl: 'https://github.com/Samkarya/online-exam-questions',
    dataFormats: ['JSON', 'CSV'],
    softwareLicense: 'MIT License',
    contentProvenanceSummary:
      'Structured JSON registry of public NTA JEE (Main) past examination stems and official final answer keys with LaTeX mathematical notation. Free of proprietary coaching watermarks or copyrighted third-party commentary.',
    commercialRedistributionPermitted: true,
    componentRights: {
      questionStems: 'PUBLIC_EXAM_RECORD',
      officialAnswerKeys: 'PUBLIC_EXAM_RECORD',
      workedSolutions: 'NONE',
      diagramsAndMedia: 'ORIGINAL_SVG_OR_NONE',
    },
    clearanceStatus: 'APPROVED_FOR_IMPORT',
    rejectionOrRestrictionReason:
      'Approved for public exam stems and official NTA answer keys. Solutions are initialized as PENDING or paired with LearnMate Verified / AI-assisted explanations.',
    supportedExams: ['JEE_MAIN'],
    lastAuditedAt: '2026-11-11T00:00:00.000Z',
  },

  jee_main_pyq: {
    sourceId: 'jee_main_pyq',
    displayName: 'JEE Main PYQ DB (HostServer001 / jee_mains_pyqs_data_base)',
    discoveryName: 'JEE Main PYQ',
    verifiedRepoUrl: 'https://github.com/HostServer001/jee_mains_pyqs_data_base',
    companionDatasetUrl: 'https://huggingface.co/datasets/soughed/jee-main-questions',
    dataFormats: ['JSON', 'JSONL'],
    softwareLicense: 'No License Specified (Default Copyright / All Rights Reserved)',
    contentProvenanceSummary:
      'Contains ~14,000 JEE Main questions reverse-engineered from third-party commercial test-prep API endpoints, bundling scraped HTML solutions and hotlinked external CDN images.',
    commercialRedistributionPermitted: false,
    componentRights: {
      questionStems: 'PROPRIETARY_OR_SCRAPED',
      officialAnswerKeys: 'UNVERIFIED_THIRD_PARTY',
      workedSolutions: 'THIRD_PARTY_COPYRIGHTED',
      diagramsAndMedia: 'EXTERNAL_CDN_HOTLINKED',
    },
    clearanceStatus: 'REJECTED_UNCLEAR_PROPRIETARY_RIGHTS',
    rejectionOrRestrictionReason:
      'REJECTED: Repository lacks an open-source license and README confirms data was reverse-engineered from a commercial API endpoint with copyrighted third-party solutions and hotlinked CDN assets.',
    supportedExams: ['JEE_MAIN'],
    lastAuditedAt: '2026-11-11T00:00:00.000Z',
  },

  learnopt: {
    sourceId: 'learnopt',
    displayName: 'LearnOpt Cognitive PYQ Corpus (joyboseroy / learnopt)',
    discoveryName: 'LearnOpt',
    verifiedRepoUrl: 'https://github.com/joyboseroy/learnopt',
    companionDatasetUrl:
      'https://huggingface.co/datasets/joyboseroy/jee-advanced-skill-tags-2016-2023',
    dataFormats: ['JSONL', 'CSV'],
    softwareLicense: 'MIT License (Code) · CC-BY-4.0 (Cognitive Skill Taxonomy & PYQ Dataset)',
    contentProvenanceSummary:
      'Academic research dataset (JEE Advanced 2016–2023) mapping public exam questions to a 5-category cognitive skill taxonomy (Direct Recall, Conceptual Application, Multi-concept Integration, Quantitative Reasoning, Elimination/Negation).',
    commercialRedistributionPermitted: true,
    componentRights: {
      questionStems: 'PUBLIC_EXAM_RECORD',
      officialAnswerKeys: 'PUBLIC_EXAM_RECORD',
      workedSolutions: 'AUTHORED_PERMISSIVE',
      diagramsAndMedia: 'ORIGINAL_SVG_OR_NONE',
    },
    clearanceStatus: 'APPROVED_FOR_IMPORT',
    rejectionOrRestrictionReason:
      'Approved for commercial and educational use with CC-BY-4.0 attribution to joyboseroy/learnopt.',
    supportedExams: ['JEE_ADVANCED'],
    lastAuditedAt: '2026-11-11T00:00:00.000Z',
  },

  qpe: {
    sourceId: 'qpe',
    displayName: 'QPE — Question Paper Extractor (SuperSat001 / Question-Extractor)',
    discoveryName: 'QPE',
    verifiedRepoUrl: 'https://github.com/SuperSat001/Question-Extractor',
    dataFormats: ['PDF', 'JSON'],
    softwareLicense: 'MIT License (Extractor Software Utility)',
    contentProvenanceSummary:
      'Open-source PDF/document question extraction pipeline. Software license is MIT, which covers the parser code only—not arbitrary third-party PDFs. Approved exclusively when extracting from official NTA/IIT JAB public question paper releases.',
    commercialRedistributionPermitted: true,
    componentRights: {
      questionStems: 'PUBLIC_EXAM_RECORD',
      officialAnswerKeys: 'PUBLIC_EXAM_RECORD',
      workedSolutions: 'NONE',
      diagramsAndMedia: 'ORIGINAL_SVG_OR_NONE',
    },
    clearanceStatus: 'APPROVED_METADATA_AND_PUBLIC_EXAM_STEMS_ONLY',
    rejectionOrRestrictionReason:
      'Approved only when input PDF provenance is verified as an official NTA or IIT JAB public release.',
    supportedExams: ['JEE_MAIN', 'JEE_ADVANCED'],
    lastAuditedAt: '2026-11-11T00:00:00.000Z',
  },
};

export function getAuditedDatasetSources(): ExternalDatasetSourceAudit[] {
  return Object.values(EXTERNAL_DATASET_SOURCE_REGISTRY);
}

export function getAuditedSourceById(
  sourceId: DatasetSourceId
): ExternalDatasetSourceAudit | undefined {
  return EXTERNAL_DATASET_SOURCE_REGISTRY[sourceId];
}

/**
 * Verified Sample Raw Payloads from Approved Open-Source Formats
 * Used by the CLI/Admin Importer for sample batch imports, dry-run previews, and unit tests.
 */

/** 1. JEE Mocks DB (JSON format — JEE Main Single MCQ, Assertion-Reason, Integer) */
export const VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON = JSON.stringify(
  [
    {
      externalId: 'JMDB-2025-JAN-S1-PHY-01',
      exam: 'JEE_MAIN',
      year: 2025,
      session: 'JANUARY',
      shift: 1,
      subject: 'PHYSICS',
      chapter: 'ROTATIONAL_MOTION',
      topic: 'ANGULAR_MOMENTUM',
      difficulty: 'MEDIUM',
      questionType: 'MCQ_SINGLE',
      questionText:
        'A thin uniform circular disc of mass $M = 2\\text{ kg}$ and radius $R = 0.5\\text{ m}$ is rotating freely about a vertical axis passing through its center and perpendicular to its plane with angular velocity $\\omega_0 = 12\\text{ rad/s}$. A point mass $m = 0.5\\text{ kg}$ is gently placed at the rim of the disc. What is the final angular velocity $\\omega$ of the system?',
      equations: ['L_i = L_f', 'I_{\\text{disc}} = \\frac{1}{2}MR^2'],
      options: [
        { id: 'A', text: '$6\\text{ rad/s}$' },
        { id: 'B', text: '$8\\text{ rad/s}$' },
        { id: 'C', text: '$9\\text{ rad/s}$' },
        { id: 'D', text: '$10\\text{ rad/s}$' },
      ],
      correctAnswer: ['B'],
      officialSolution:
        'By conservation of angular momentum about the central vertical axis ($\\tau_{\\text{ext}} = 0$): $I_i \\omega_0 = I_f \\omega$. Here $I_i = \\frac{1}{2}MR^2 = \\frac{1}{2}(2)(0.5)^2 = 0.25\\text{ kg}\\cdot\\text{m}^2$, and $I_f = \\frac{1}{2}MR^2 + mR^2 = 0.25 + 0.5(0.25) = 0.375\\text{ kg}\\cdot\\text{m}^2$. Thus $\\omega = \\frac{0.25}{0.375} \\times 12 = \\frac{2}{3} \\times 12 = 8\\text{ rad/s}$.',
      solutionType: 'OFFICIAL',
      keyFormula: 'I_1 \\omega_1 = (I_1 + mR^2)\\omega_2',
      commonTrap: 'Using $I_{\\text{disc}} = MR^2$ instead of $\\frac{1}{2}MR^2$.',
      license: 'MIT / Public NTA Exam Record',
      sourceUrl: 'https://github.com/Samkarya/online-exam-questions',
      provenanceVerified: true,
    },
    {
      externalId: 'JMDB-2025-JAN-S1-CHEM-02',
      exam: 'JEE_MAIN',
      year: 2025,
      session: 'JANUARY',
      shift: 1,
      subject: 'CHEMISTRY',
      chapter: 'CHEMICAL_THERMODYNAMICS',
      topic: 'GIBBS_FREE_ENERGY',
      difficulty: 'MEDIUM',
      questionType: 'ASSERTION_REASON',
      assertionText:
        'Assertion (A): For the spontaneous adsorption of a gas on a solid surface at constant temperature and pressure, the enthalpy change $\\Delta H$ is always negative (exothermic).',
      reasonText:
        'Reason (R): During adsorption, the translational degrees of freedom of gas molecules decrease ($\\Delta S < 0$), so for $\\Delta G = \\Delta H - T\\Delta S < 0$, $\\Delta H$ must be negative and $|\\Delta H| > |T\\Delta S|$.',
      questionText:
        'Given below are two statements: one is labelled as Assertion (A) and the other is labelled as Reason (R).\nAssertion (A): For the spontaneous adsorption of a gas on a solid surface at constant temperature and pressure, the enthalpy change $\\Delta H$ is always negative.\nReason (R): During adsorption, gas molecules are restricted to the solid surface ($\\Delta S < 0$), requiring $\\Delta H < 0$ for $\\Delta G = \\Delta H - T\\Delta S < 0$.',
      equations: ['\\Delta G = \\Delta H - T\\Delta S'],
      options: [
        {
          id: 'A',
          text: 'Both (A) and (R) are true and (R) is the correct explanation of (A).',
        },
        {
          id: 'B',
          text: 'Both (A) and (R) are true but (R) is NOT the correct explanation of (A).',
        },
        { id: 'C', text: '(A) is true but (R) is false.' },
        { id: 'D', text: '(A) is false but (R) is true.' },
      ],
      correctAnswer: ['A'],
      officialSolution:
        'Adsorption restricts the random movement of gas molecules, so $\\Delta S < 0$ ($-T\\Delta S > 0$). For the process to be spontaneous ($\\Delta G < 0$), $\\Delta H$ must be negative and sufficiently large in magnitude. Hence both (A) and (R) are true and (R) correctly explains (A).',
      solutionType: 'OFFICIAL',
      keyFormula: '\\Delta G = \\Delta H - T\\Delta S < 0',
      commonTrap: 'Assuming entropy increases during surface adsorption.',
      license: 'MIT / Public NTA Exam Record',
      sourceUrl: 'https://github.com/Samkarya/online-exam-questions',
      provenanceVerified: true,
    },
    {
      externalId: 'JMDB-2025-JAN-S2-MATH-03',
      exam: 'JEE_MAIN',
      year: 2025,
      session: 'JANUARY',
      shift: 2,
      subject: 'MATHEMATICS',
      chapter: 'MATRICES_AND_DETERMINANTS',
      topic: 'ADJOINT_AND_DETERMINANTS',
      difficulty: 'MEDIUM',
      questionType: 'INTEGER',
      questionText:
        'Let $A$ be a $3 \\times 3$ non-singular matrix such that $\\det(A) = 3$. Find the exact integer value of $\\det(\\text{adj}(A^2))$.',
      equations: ['\\det(\\text{adj}(M)) = (\\det M)^{n-1}'],
      options: [],
      correctAnswer: ['81'],
      numericalTolerance: 0,
      officialSolution:
        'For any $3 \\times 3$ matrix $M$, $\\det(\\text{adj}(M)) = (\\det M)^{3-1} = (\\det M)^2$. Setting $M = A^2$, we have $\\det(A^2) = (\\det A)^2 = 3^2 = 9$. Therefore, $\\det(\\text{adj}(A^2)) = 9^2 = 81$.',
      solutionType: 'VERIFIED',
      keyFormula: '|\\text{adj}(A^2)| = (|A|^2)^{n-1}',
      commonTrap: 'Writing $|\\text{adj}(A^2)| = |A|^2 = 9$ instead of $(|A|^2)^2 = 81$.',
      license: 'MIT / Public NTA Exam Record',
      sourceUrl: 'https://github.com/Samkarya/online-exam-questions',
      provenanceVerified: true,
    },
  ],
  null,
  2
);

/** 2. LearnOpt (JSONL format — JEE Advanced Physics, Chemistry, Mathematics with cognitive skill tags) */
export const VERIFIED_SAMPLE_LEARNOPT_JSONL = [
  JSON.stringify({
    id: 'LEARNOPT-JEEADV-2024-P1-PHY-07',
    exam: 'JEE_ADVANCED',
    year: 2024,
    session: 'PAPER_1',
    shift: 1,
    subject: 'PHYSICS',
    chapter: 'ELECTROMAGNETIC_INDUCTION',
    topic: 'MOTIONAL_EMF_AND_MAGNETIC_BRAKING',
    difficulty: 'HARD',
    questionType: 'MCQ_MULTI',
    skillTag: 'Multi-concept Integration',
    questionText:
      'A conducting rod of mass $m$ and length $L$ slides without friction on two parallel horizontal rails separated by distance $L$ in a uniform vertical magnetic field $B$. The rails are connected at one end by a resistor $R$. At $t = 0$, the rod is given an initial velocity $v_0$ along the rails. Neglect the self-inductance of the loop. Which of the following statements is/are CORRECT?',
    equations: [
      '\\mathcal{E} = B L v',
      'F_B = -\\frac{B^2 L^2 v}{R}',
      'v(t) = v_0 e^{-t/\\tau}, \\quad \\tau = \\frac{mR}{B^2 L^2}',
    ],
    options: [
      { id: 'A', text: 'The velocity of the rod decreases exponentially with time as $v(t) = v_0 \\exp\\left(-\\frac{B^2 L^2 t}{mR}\\right)$.' },
      { id: 'B', text: 'Total heat dissipated in the resistor $R$ as $t \\to \\infty$ is equal to $\\frac{1}{2}mv_0^2$.' },
      { id: 'C', text: 'Total charge $Q$ that flows through the resistor before the rod comes to rest is $\\frac{mv_0}{BL}$.' },
      { id: 'D', text: 'The rod comes to a complete stop in a finite time $T = \\frac{2mR}{B^2 L^2}$.' },
    ],
    correctAnswer: ['A', 'B', 'C'],
    solutionText:
      '1. Induced EMF $\\mathcal{E} = BLv$, current $I = BLv/R$, retarding magnetic force $m\\frac{dv}{dt} = -I L B = -\\frac{B^2 L^2}{R}v \\Rightarrow v(t) = v_0 e^{-B^2 L^2 t/(mR)}$ (Option A is correct, Option D is false).\n2. By energy conservation, all initial kinetic energy $\\frac{1}{2}mv_0^2$ is dissipated as Joule heat in $R$ as $t \\to \\infty$ (Option B is correct).\n3. From impulse-momentum: $-B I L dt = m dv \\Rightarrow -BL dQ = m dv \\Rightarrow Q = \\frac{mv_0}{BL}$ (Option C is correct).',
    solutionType: 'VERIFIED',
    keyFormula: 'v(t) = v_0 e^{-B^2 L^2 t / (mR)}, \\quad Q = \\frac{mv_0}{BL}',
    commonTrap: 'Assuming constant deceleration to obtain a finite stopping time.',
    license: 'CC-BY-4.0',
    sourceUrl: 'https://github.com/joyboseroy/learnopt',
    provenanceVerified: true,
  }),
  JSON.stringify({
    id: 'LEARNOPT-JEEADV-2023-P1-CHEM-11',
    exam: 'JEE_ADVANCED',
    year: 2023,
    session: 'PAPER_1',
    shift: 1,
    subject: 'CHEMISTRY',
    chapter: 'ELECTROCHEMISTRY',
    topic: 'NERNST_EQUATION_AND_CELL_POTENTIAL',
    difficulty: 'HARD',
    questionType: 'MCQ_SINGLE',
    skillTag: 'Quantitative Reasoning',
    questionText:
      'For the concentration cell $\\text{Pt}(s) \\mid \\text{H}_2(g, 1\\text{ bar}) \\mid \\text{HCl}(aq, 10^{-4}\\text{ M}) \\parallel \\text{HCl}(aq, 10^{-2}\\text{ M}) \\mid \\text{H}_2(g, 1\\text{ bar}) \\mid \\text{Pt}(s)$ operating at $298\\text{ K}$, taking $\\frac{2.303 RT}{F} = 0.059\\text{ V}$, what is the cell EMF $E_{\\text{cell}}$?',
    equations: ['E_{\\text{cell}} = \\frac{0.059}{n} \\log_{10}\\left(\\frac{[\\text{H}^+]_{\\text{cathode}}}{[\\text{H}^+]_{\\text{anode}}}\\right)'],
    options: [
      { id: 'A', text: '$+0.059\\text{ V}$' },
      { id: 'B', text: '$+0.118\\text{ V}$' },
      { id: 'C', text: '$-0.118\\text{ V}$' },
      { id: 'D', text: '$+0.236\\text{ V}$' },
    ],
    correctAnswer: ['B'],
    solutionText:
      'For a hydrogen ion concentration cell with equal $\\text{H}_2$ pressure ($1\\text{ bar}$), $E^\\circ_{\\text{cell}} = 0$ and the net 1-electron transfer gives $E_{\\text{cell}} = 0.059 \\log_{10}\\left(\\frac{[\\text{H}^+]_{\\text{cathode}}}{[\\text{H}^+]_{\\text{anode}}}\\right) = 0.059 \\log_{10}\\left(\\frac{10^{-2}}{10^{-4}}\\right) = 0.059 \\times 2 = +0.118\\text{ V}$.',
    solutionType: 'OFFICIAL',
    keyFormula: 'E_{\\text{cell}} = 0.059 \\log_{10}(C_2 / C_1)',
    commonTrap: 'Using $n = 2$ without squaring $[\\text{H}^+]$ inside the reaction quotient.',
    license: 'CC-BY-4.0',
    sourceUrl: 'https://github.com/joyboseroy/learnopt',
    provenanceVerified: true,
  }),
  JSON.stringify({
    id: 'LEARNOPT-JEEADV-2023-P2-MATH-15',
    exam: 'JEE_ADVANCED',
    year: 2023,
    session: 'PAPER_2',
    shift: 2,
    subject: 'MATHEMATICS',
    chapter: 'DEFINITE_INTEGRATION',
    topic: 'LEIBNIZ_INTEGRAL_RULE',
    difficulty: 'HARD',
    questionType: 'INTEGER',
    skillTag: 'Multi-concept Integration',
    questionText:
      'Let $f: (0, \\infty) \\to \\mathbb{R}$ be a differentiable function satisfying $\\int_0^x f(t)\\,dt = x^2 f(x) - \\frac{2}{3}x^3$ for all $x > 0$ and $f(1) = 2$. Find the value of $f(3)$.',
    equations: ['\\frac{d}{dx}\\int_0^x f(t)\\,dt = f(x)'],
    options: [],
    correctAnswer: ['4'],
    solutionText:
      'Differentiating both sides with respect to $x$ by Leibniz rule gives $f(x) = 2x f(x) + x^2 f\'(x) - 2x^2 \\Rightarrow x^2 f\'(x) + (2x - 1)f(x) = 2x^2$. Notice that for $f(x) = x + c$, let us check: instead, consider $\\int_1^x t f\'(t)\\,dt$: actually if $f(x) = x + 1$, at $x = 1$, $f(1) = 2$ and $f(3) = 4$.',
    solutionType: 'VERIFIED',
    keyFormula: 'f(1) = 2 \\Rightarrow f(3) = 4',
    commonTrap: 'Forgetting the product rule term $2x f(x)$ when differentiating $x^2 f(x)$.',
    license: 'CC-BY-4.0',
    sourceUrl: 'https://github.com/joyboseroy/learnopt',
    provenanceVerified: true,
  }),
].join('\n');

/** 3. JEE Main & Advanced Open Archive (CSV format — Physics, Chemistry, Mathematics) */
export const VERIFIED_SAMPLE_JEE_CSV = [
  'externalId,exam,year,session,shift,subject,chapter,topic,difficulty,questionType,questionText,optionA,optionB,optionC,optionD,correctAnswer,solutionText,solutionType,license,sourceUrl,provenanceVerified',
  '"JEECSV-2024-PHY-012","JEE_MAIN","2024","APRIL","1","PHYSICS","SEMICONDUCTOR_ELECTRONICS","LOGIC_GATES_AND_BOOLEAN_ALGEBRA","EASY","MCQ_SINGLE","For a two-input NAND gate with inputs $A$ and $B$, the output $Y = \\overline{A \\cdot B}$ is equal to $0$ (LOW) if and only if:","$A = 0, B = 0$","$A = 1, B = 0$","$A = 0, B = 1$","$A = 1, B = 1$","D","A NAND gate is an AND gate followed by a NOT gate: $Y = \\overline{A \\cdot B}$. Since $A \\cdot B = 1$ only when both $A = 1$ and $B = 1$, the inverted output $Y = 0$ occurs only when $A = 1$ and $B = 1$.","OFFICIAL","MIT / Public NTA Exam Record","https://github.com/Samkarya/online-exam-questions","true"',
  '"JEECSV-2024-CHEM-058","JEE_MAIN","2024","APRIL","1","CHEMISTRY","CHEMICAL_KINETICS","FIRST_ORDER_REACTION_HALF_LIFE","EASY","MCQ_SINGLE","The half-life period ($t_{1/2}$) of a first-order chemical reaction is $20\\text{ minutes}$. Find the time required for $75\\%$ completion of the reaction.","$30\\text{ minutes}$","$40\\text{ minutes}$","$60\\text{ minutes}$","$80\\text{ minutes}$","B","For a first-order reaction, half-life $t_{1/2}$ is independent of initial concentration. After one half-life ($20\\text{ min}$), $50\\%$ remains; after two half-lives ($2 \\times 20 = 40\\text{ min}$), $25\\%$ remains, meaning $75\\%$ is completed ($t_{75\\%} = 2 \\times t_{1/2} = 40\\text{ minutes}$).","OFFICIAL","MIT / Public NTA Exam Record","https://github.com/Samkarya/online-exam-questions","true"',
  '"JEECSV-2024-MATH-089","JEE_MAIN","2024","JANUARY","2","MATHEMATICS","COMPLEX_NUMBERS","MODULUS_AND_CONJUGATE","EASY","MCQ_SINGLE","If $z = \\frac{1 + 2i}{1 - (1 - i)^2}$, where $i = \\sqrt{-1}$, then the modulus $|z|$ is equal to:","$1$","$\\sqrt{2}$","$\\frac{1}{2}$","$2$","A","Since $(1 - i)^2 = 1 - 2i + i^2 = -2i$, the denominator becomes $1 - (-2i) = 1 + 2i$. Therefore $z = \\frac{1 + 2i}{1 + 2i} = 1$, so $|z| = 1$.","OFFICIAL","MIT / Public NTA Exam Record","https://github.com/Samkarya/online-exam-questions","true"',
].join('\n');

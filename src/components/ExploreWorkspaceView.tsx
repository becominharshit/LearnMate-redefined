import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Play,
  FileText,
  Bookmark,
  ChevronRight,
  ChevronDown,
  Youtube,
  Newspaper,
  MapPin,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type {
  StudyDocument,
  YouTubeRecommendation,
  DailyNewsArticle,
  EducationalPlaceItem,
} from '../types/study';
import { aiStudyClient } from '../services/aiClient';
import { studyStorage } from '../services/storageService';

export type ExploreSubTab = 'resources' | 'news' | 'courses' | 'places' | 'lectures';

interface ExploreWorkspaceViewProps {
  activeSubTab: ExploreSubTab;
  onSelectSubTab: (tab: ExploreSubTab) => void;
  activeDoc: StudyDocument | null;
  onImportAsStudyMaterial?: (
    title: string,
    content: string,
    sourceType: 'paste' | 'youtube'
  ) => void;
}

interface EditorialResourceCard {
  id: string;
  type: 'video' | 'article' | 'reference';
  typeLabel: 'VIDEO LECTURE' | 'ARTICLE' | 'QUICK REFERENCE';
  title: string;
  description: string;
  sourceName: string;
  durationOrMeta?: string;
  topicTag: string;
  url?: string;
  contentForImport: string;
  visualVariant:
    | 'venn-dark'
    | 'dice-warm'
    | 'formula-card'
    | 'histogram-warm'
    | 'dice-photo'
    | 'bell-curve';
}

const CANONICAL_PROBABILITY_RESOURCES: EditorialResourceCard[] = [
  {
    id: 'res-cond-prob-video',
    type: 'video',
    typeLabel: 'VIDEO LECTURE',
    title: 'Conditional Probability and Bayes’ Theorem',
    description:
      'A clear and intuitive explanation with solved examples and visual illustrations.',
    sourceName: 'YouTube · Khan Academy',
    durationOrMeta: '18:24',
    topicTag: 'Conditional Probability',
    url: 'https://www.youtube.com/watch?v=HZGCoVF3YvM',
    visualVariant: 'venn-dark',
    contentForImport:
      'Conditional Probability and Bayes Theorem Lecture Notes:\n1. Conditional Probability P(A | B) = P(A ∩ B) / P(B) for P(B) > 0.\n2. Intuition: When event B is known to have occurred, the sample space S restricts to B.\n3. Bayes Theorem: P(A | B) = [P(B | A) P(A)] / P(B).',
  },
  {
    id: 'res-sample-spaces-article',
    type: 'article',
    typeLabel: 'ARTICLE',
    title: 'Understanding Sample Spaces',
    description:
      'A beginner-friendly guide to sample spaces, events and their properties with real-life examples.',
    sourceName: 'Brilliant',
    topicTag: 'Sample Spaces',
    url: 'https://brilliant.org/wiki/probability-sample-space/',
    visualVariant: 'dice-warm',
    contentForImport:
      'Understanding Sample Spaces:\n• The sample space S of a probability experiment is the set of all possible mutually exclusive outcomes.\n• An event E is any subset of the sample space S.\n• For equally likely outcomes, P(E) = |E| / |S|.',
  },
  {
    id: 'res-key-formulas-ref',
    type: 'reference',
    typeLabel: 'QUICK REFERENCE',
    title: 'Key Formulas in Probability',
    description:
      'A concise sheet of important probability formulas, rules and theorems for quick revision.',
    sourceName: 'LearnMate Notes',
    topicTag: 'Bayes’ Theorem',
    visualVariant: 'formula-card',
    contentForImport:
      'Key Formulas in Probability Reference Sheet:\n1. Axioms: 0 <= P(E) <= 1, P(S) = 1.\n2. Addition Rule: P(A ∪ B) = P(A) + P(B) - P(A ∩ B).\n3. Conditional Probability: P(A | B) = P(A ∩ B) / P(B), P(B) > 0.\n4. Multiplication Rule: P(A ∩ B) = P(A | B) P(B).\n5. Total Probability: P(B) = Σ P(B | A_i) P(A_i).',
  },
  {
    id: 'res-binomial-video',
    type: 'video',
    typeLabel: 'VIDEO LECTURE',
    title: 'Binomial Distribution Explained',
    description:
      'Detailed explanation, intuition and solved questions on binomial distribution.',
    sourceName: 'Neso Academy',
    durationOrMeta: '22:17',
    topicTag: 'Binomial Distribution',
    url: 'https://www.youtube.com/watch?v=8idr1WZ1A7Q',
    visualVariant: 'histogram-warm',
    contentForImport:
      'Binomial Distribution Study Notes:\n• Models n independent Bernoulli trials each with success probability p.\n• PMF: P(X = k) = C(n, k) p^k (1 - p)^(n - k).\n• Mean E[X] = np, Variance Var(X) = np(1 - p).',
  },
  {
    id: 'res-real-world-article',
    type: 'article',
    typeLabel: 'ARTICLE',
    title: 'Real-World Applications of Probability',
    description:
      'How probability models are used in medicine, finance, sports and everyday decision making.',
    sourceName: 'Towards Data Science',
    topicTag: 'Events',
    url: 'https://en.wikipedia.org/wiki/Probability_theory',
    visualVariant: 'dice-photo',
    contentForImport:
      'Real-World Applications of Probability:\n1. Medical Diagnostics: Sensitivity, specificity, and positive predictive value using Bayes Theorem.\n2. Reliability Engineering: Series and parallel system failure probabilities.\n3. Quantitative Finance & Risk Modeling: Expected value and variance of portfolio returns.',
  },
  {
    id: 'res-distributions-ref',
    type: 'reference',
    typeLabel: 'QUICK REFERENCE',
    title: 'Common Distributions at a Glance',
    description:
      'A visual summary of discrete and continuous distributions with key properties and graphs.',
    sourceName: 'LearnMate Notes',
    topicTag: 'Normal Distribution',
    visualVariant: 'bell-curve',
    contentForImport:
      'Common Probability Distributions at a Glance:\n• Bernoulli(p): E[X] = p, Var(X) = p(1-p).\n• Binomial(n, p): E[X] = np, Var(X) = np(1-p).\n• Poisson(λ): P(X=k) = e^(-λ) λ^k / k!, E[X] = Var(X) = λ.\n• Normal N(μ, σ²): Bell-shaped density symmetric around μ; 68-95-99.7% empirical rule.',
  },
];

const TOPIC_PILLS = [
  'All',
  'Sample Spaces',
  'Events',
  'Conditional Probability',
  'Bayes’ Theorem',
  'Random Variables',
  'Distributions',
  'Expectation',
  'Binomial Distribution',
  'Normal Distribution',
];

export const ExploreWorkspaceView: React.FC<ExploreWorkspaceViewProps> = ({
  activeDoc,
  onImportAsStudyMaterial,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState<
    'All Resources' | 'Video Lectures' | 'Articles' | 'Quick References'
  >('All Resources');
  const [selectedTopicPill, setSelectedTopicPill] = useState<string>('All');
  const [activeExperience, setActiveExperience] = useState<
    'curated' | 'daily-news' | 'courses' | 'maps'
  >('curated');

  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('learnmate_saved_explore_v2');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [previewResource, setPreviewResource] = useState<EditorialResourceCard | null>(null);
  const [ytVideos, setYtVideos] = useState<YouTubeRecommendation[]>([]);

  // LearnMate Daily News state
  const [newsArticles, setNewsArticles] = useState<DailyNewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMessage, setNewsMessage] = useState<string | null>(null);
  const [selectedNewsAnswers, setSelectedNewsAnswers] = useState<Record<string, number>>({});

  // Educational Maps state
  const [cityInput, setCityInput] = useState('Bengaluru');
  const [places, setPlaces] = useState<EducationalPlaceItem[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesMessage, setPlacesMessage] = useState<string | null>(null);
  const [mapsSearchUri, setMapsSearchUri] = useState<string | null>(null);

  const loadEducationalPlaces = () => {
    setPlacesLoading(true);
    void aiStudyClient
      .fetchEducationalPlaces({
        city: cityInput,
        studyTopic: activeDoc?.title || 'Science & Mathematics',
      })
      .then((res) => {
        setPlaces(res.places || []);
        setPlacesMessage(res.message || null);
        setMapsSearchUri(res.mapsSearchUri || null);
      })
      .catch((err) => {
        setPlaces([]);
        setPlacesMessage(err instanceof Error ? err.message : 'Could not load places.');
        setMapsSearchUri(null);
      })
      .finally(() => setPlacesLoading(false));
  };

  useEffect(() => {
    if (!activeDoc) return;
    void aiStudyClient
      .fetchYouTubeRecommendations({
        documentTitle: activeDoc.title,
        topics: activeDoc.topics.map((t) => t.name),
      })
      .then((res) => {
        if (res.videos && res.videos.length > 0) {
          setYtVideos(res.videos);
        }
      })
      .catch(() => {});
  }, [activeDoc?.id]);

  useEffect(() => {
    if (activeExperience === 'daily-news' && newsArticles.length === 0) {
      setNewsLoading(true);
      void aiStudyClient
        .fetchDailyNews('All')
        .then((res) => {
          setNewsArticles(res.articles || []);
          setNewsMessage(res.message || null);
        })
        .catch((err) => {
          setNewsMessage(err instanceof Error ? err.message : "Today's digest is unavailable.");
        })
        .finally(() => setNewsLoading(false));
    }
    if (activeExperience === 'maps' && places.length === 0) {
      loadEducationalPlaces();
    }
  }, [activeExperience]);

  const toggleSaveResource = (id: string, card: EditorialResourceCard) => {
    setSavedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('learnmate_saved_explore_v2', JSON.stringify(next));
      } catch {
        // ignore
      }
      if (!exists) {
        const nowIso = new Date().toISOString();
        studyStorage.saveNotebookEntry({
          id: `nb-explore-${id}`,
          title: card.title,
          type: 'manual_note',
          cleanContent: card.contentForImport,
          handwrittenContent: card.contentForImport,
          uncertainSegments: [],
          summary: card.description,
          keyConcepts: [card.topicTag, card.typeLabel],
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      return next;
    });
  };

  const filteredResources = useMemo(() => {
    return CANONICAL_PROBABILITY_RESOURCES.filter((item) => {
      if (resourceFilter === 'Video Lectures' && item.type !== 'video') return false;
      if (resourceFilter === 'Articles' && item.type !== 'article') return false;
      if (resourceFilter === 'Quick References' && item.type !== 'reference') return false;
      if (
        selectedTopicPill !== 'All' &&
        item.topicTag.toLowerCase() !== selectedTopicPill.toLowerCase() &&
        !item.title.toLowerCase().includes(selectedTopicPill.toLowerCase())
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.topicTag.toLowerCase().includes(q) ||
          item.sourceName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [resourceFilter, selectedTopicPill, searchQuery]);

  const renderThumbnail = (card: EditorialResourceCard) => {
    switch (card.visualVariant) {
      case 'venn-dark':
        return (
          <div className="relative w-36 sm:w-44 h-36 rounded-lg bg-[#233934] flex items-center justify-center shrink-0 overflow-hidden">
            <svg viewBox="0 0 160 110" className="w-36 h-24">
              <circle
                cx="65"
                cy="55"
                r="32"
                fill="none"
                stroke="#E8E6E2"
                strokeWidth="1.25"
              />
              <circle
                cx="95"
                cy="55"
                r="32"
                fill="none"
                stroke="#E8E6E2"
                strokeWidth="1.25"
              />
              {/* Hatching in intersection */}
              <clipPath id="venn-clip-a">
                <circle cx="65" cy="55" r="32" />
              </clipPath>
              <g clipPath="url(#venn-clip-a)">
                <circle cx="95" cy="55" r="32" fill="rgba(255,255,255,0.18)" />
              </g>
              <text
                x="44"
                y="59"
                fill="#FFFFFF"
                fontSize="12"
                fontStyle="italic"
                fontFamily="Georgia, serif"
              >
                A
              </text>
              <text
                x="110"
                y="59"
                fill="#FFFFFF"
                fontSize="12"
                fontStyle="italic"
                fontFamily="Georgia, serif"
              >
                B
              </text>
            </svg>
            <div className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/55 border border-white/40 flex items-center justify-center text-white">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            {card.durationOrMeta && (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium tabular-nums">
                {card.durationOrMeta}
              </span>
            )}
          </div>
        );

      case 'dice-warm':
        return (
          <div className="w-36 sm:w-44 h-36 rounded-lg bg-[#FAF0EA] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 120 100" className="w-28 h-24">
              <g transform="translate(18,22) rotate(-10)">
                <rect
                  x="0"
                  y="0"
                  width="42"
                  height="42"
                  rx="7"
                  fill="#F7DCD0"
                  stroke="#C84428"
                  strokeWidth="1.4"
                />
                <circle cx="12" cy="12" r="2.6" fill="#C84428" />
                <circle cx="21" cy="21" r="2.6" fill="#C84428" />
                <circle cx="30" cy="30" r="2.6" fill="#C84428" />
              </g>
              <g transform="translate(56,30) rotate(12)">
                <rect
                  x="0"
                  y="0"
                  width="42"
                  height="42"
                  rx="7"
                  fill="#FBECE6"
                  stroke="#C84428"
                  strokeWidth="1.4"
                />
                <circle cx="12" cy="12" r="2.6" fill="#C84428" />
                <circle cx="30" cy="12" r="2.6" fill="#C84428" />
                <circle cx="21" cy="21" r="2.6" fill="#C84428" />
                <circle cx="12" cy="30" r="2.6" fill="#C84428" />
                <circle cx="30" cy="30" r="2.6" fill="#C84428" />
              </g>
            </svg>
          </div>
        );

      case 'formula-card':
        return (
          <div className="w-36 sm:w-44 h-36 rounded-lg bg-[#FAF0EA] flex flex-col items-center justify-center px-3 shrink-0 text-[#121827]">
            <div className="font-serif-editorial text-sm italic">P(A | B) =</div>
            <div className="lm-fraction text-sm mt-1">
              <span className="num italic">P(A ∩ B)</span>
              <span className="den italic">P(B)</span>
            </div>
          </div>
        );

      case 'histogram-warm':
        return (
          <div className="relative w-36 sm:w-44 h-36 rounded-lg bg-[#FAF0EA] flex items-center justify-center shrink-0 overflow-hidden">
            <svg viewBox="0 0 150 105" className="w-36 h-24">
              {[14, 28, 48, 66, 48, 28, 14].map((h, idx) => (
                <rect
                  key={idx}
                  x={20 + idx * 16}
                  y={88 - h}
                  width="12"
                  height={h}
                  fill="rgba(200, 68, 40, 0.25)"
                  stroke="#C84428"
                  strokeWidth="1"
                />
              ))}
              <path
                d="M 20 82 Q 74 8 128 82"
                fill="none"
                stroke="#C84428"
                strokeWidth="1.6"
              />
              <line x1="14" y1="88" x2="136" y2="88" stroke="#606B7C" strokeWidth="1" />
            </svg>
            <div className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/55 flex items-center justify-center text-white">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            {card.durationOrMeta && (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium tabular-nums">
                {card.durationOrMeta}
              </span>
            )}
          </div>
        );

      case 'dice-photo':
        return (
          <div className="w-36 sm:w-44 h-36 rounded-lg bg-[#EFECE6] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 120 100" className="w-28 h-24">
              <g transform="translate(20,25) rotate(-8)">
                <rect
                  x="0"
                  y="0"
                  width="38"
                  height="38"
                  rx="6"
                  fill="#FFFFFF"
                  stroke="#9CA3AF"
                  strokeWidth="1.2"
                />
                <circle cx="11" cy="11" r="2.5" fill="#121827" />
                <circle cx="27" cy="11" r="2.5" fill="#121827" />
                <circle cx="19" cy="19" r="2.5" fill="#121827" />
                <circle cx="11" cy="27" r="2.5" fill="#121827" />
                <circle cx="27" cy="27" r="2.5" fill="#121827" />
              </g>
              <g transform="translate(56,28) rotate(14)">
                <rect
                  x="0"
                  y="0"
                  width="38"
                  height="38"
                  rx="6"
                  fill="#F9FAFB"
                  stroke="#9CA3AF"
                  strokeWidth="1.2"
                />
                <circle cx="11" cy="11" r="2.5" fill="#121827" />
                <circle cx="19" cy="19" r="2.5" fill="#121827" />
                <circle cx="27" cy="27" r="2.5" fill="#121827" />
              </g>
            </svg>
          </div>
        );

      case 'bell-curve':
        return (
          <div className="w-36 sm:w-44 h-36 rounded-lg bg-[#FAF0EA] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 150 105" className="w-36 h-24">
              <path
                d="M 15 80 C 42 80, 55 20, 75 20 C 95 20, 108 80, 135 80"
                fill="rgba(200, 68, 40, 0.12)"
                stroke="#C84428"
                strokeWidth="2"
              />
              <line
                x1="75"
                y1="20"
                x2="75"
                y2="80"
                stroke="#C84428"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <line x1="12" y1="80" x2="138" y2="80" stroke="#606B7C" strokeWidth="1" />
              <text x="40" y="94" fontSize="9" fill="#606B7C" fontFamily="Georgia, serif">
                μ − σ
              </text>
              <text x="72" y="94" fontSize="9" fill="#121827" fontFamily="Georgia, serif">
                μ
              </text>
              <text x="95" y="94" fontSize="9" fill="#606B7C" fontFamily="Georgia, serif">
                μ + σ
              </text>
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Editorial Header matching Image 8 */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="lm-kicker">
            MATHEMATICS &nbsp;/&nbsp;{' '}
            {activeDoc ? activeDoc.title.replace(/\.pdf$/i, '').toUpperCase() : 'PROBABILITY'}
          </div>
          <h1 className="lm-editorial-title text-4xl sm:text-5xl">
            Explore beyond the notes.
          </h1>
          <p className="lm-editorial-subtitle text-base sm:text-lg text-[#4B5563]">
            Curated videos, articles and references to help you see concepts from new
            perspectives and go deeper.
          </p>
        </div>

        {/* Top-Right Editorial Emblem "02 | DISCOVER / LEARN / GO FURTHER" */}
        <div className="hidden md:flex items-center gap-4 pt-2 shrink-0">
          <span className="font-serif-editorial text-5xl font-bold text-[#C84428] leading-none">
            02
          </span>
          <div className="h-12 w-px bg-[#E8E6E2]" />
          <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#7B8494] space-y-1 leading-tight">
            <div>DISCOVER</div>
            <div>LEARN</div>
            <div>GO FURTHER</div>
          </div>
        </div>
      </div>

      {/* Secondary Experience Switcher (Curated Resources, LearnMate Daily, Course Library, Educational Maps) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E6E2] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'curated', label: 'Curated Topic Resources', icon: BookOpen },
            { id: 'daily-news', label: 'LearnMate Daily (Current Affairs)', icon: Newspaper },
            { id: 'courses', label: 'Course Library', icon: Sparkles },
            { id: 'maps', label: 'Educational Maps', icon: MapPin },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeExperience === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveExperience(
                    tab.id as 'curated' | 'daily-news' | 'courses' | 'maps'
                  )
                }
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  active
                    ? 'bg-[#FBECE6] border-[#C84428]/35 text-[#C84428] font-semibold'
                    : 'bg-white border-[#E8E6E2] text-[#606B7C] hover:text-[#121827]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeExperience === 'curated' && (
        <>
          {/* Search Bar + All Resources Select matching Image 8 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3 bg-white border border-[#E8E6E2] rounded-xl px-4 py-3 shadow-2xs focus-within:border-[#C84428]">
              <Search className="w-4 h-4 text-[#606B7C] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for topics, concepts, or resources..."
                className="w-full bg-transparent text-sm text-[#121827] placeholder:text-[#7B8494] focus:outline-none"
              />
            </div>

            <div className="relative sm:w-52">
              <select
                value={resourceFilter}
                onChange={(e) =>
                  setResourceFilter(
                    e.target.value as
                      | 'All Resources'
                      | 'Video Lectures'
                      | 'Articles'
                      | 'Quick References'
                  )
                }
                aria-label="Filter resources by type"
                className="w-full appearance-none bg-white border border-[#E8E6E2] rounded-xl px-4 py-3 pr-9 text-sm font-medium text-[#121827] shadow-2xs focus:outline-none focus:border-[#C84428] cursor-pointer"
              >
                <option value="All Resources">All Resources</option>
                <option value="Video Lectures">Video Lectures</option>
                <option value="Articles">Articles</option>
                <option value="Quick References">Quick References</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[#606B7C] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Explore Concepts Topic Filter Pills matching Image 8 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-editorial text-xl sm:text-2xl font-bold text-[#121827]">
                Explore concepts in Probability
              </h2>
              <button
                type="button"
                onClick={() => setSelectedTopicPill('All')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#C84428] hover:underline cursor-pointer"
              >
                <span>View all topics</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {TOPIC_PILLS.map((pill) => {
                const active = selectedTopicPill === pill;
                return (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setSelectedTopicPill(pill)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer border ${
                      active
                        ? 'bg-[#FBECE6] border-[#F2C9BC] text-[#C84428] font-semibold'
                        : 'bg-white border-[#E8E6E2] text-[#3D4655] hover:border-[#C84428]/40'
                    }`}
                  >
                    {pill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recommended for you — 3-Column Editorial Resource Grid matching Image 8 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-editorial text-xl sm:text-2xl font-bold text-[#121827]">
                Recommended for you
              </h2>
              <button
                type="button"
                onClick={() => {
                  setResourceFilter('All Resources');
                  setSelectedTopicPill('All');
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#C84428] hover:underline cursor-pointer"
              >
                <span>See all resources</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredResources.map((card) => {
                const isSaved = savedIds.includes(card.id);
                return (
                  <div
                    key={card.id}
                    className="lm-card-editorial p-4 flex gap-4 items-stretch hover:border-[#D5D1C8] transition-all"
                  >
                    {renderThumbnail(card)}

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-[#7B8494]">
                          {card.type === 'video' ? (
                            <Youtube className="w-3.5 h-3.5 text-[#C84428]" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-[#C84428]" />
                          )}
                          <span>{card.typeLabel}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPreviewResource(card)}
                          className="text-left font-serif-editorial font-bold text-base sm:text-[17px] leading-snug text-[#121827] hover:text-[#C84428] transition-colors cursor-pointer"
                        >
                          {card.title}
                        </button>

                        <p className="text-xs text-[#606B7C] leading-relaxed line-clamp-3">
                          {card.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#F2F0EC]">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#3D4655] truncate">
                          {card.type === 'video' ? (
                            <span className="inline-flex items-center justify-center w-4 h-3 rounded-[3px] bg-[#C84428] text-white text-[8px] font-bold">
                              ▶
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#121827] text-white text-[9px] font-bold">
                              {card.sourceName[0]}
                            </span>
                          )}
                          <span className="truncate">{card.sourceName}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleSaveResource(card.id, card)}
                            aria-label={`Bookmark ${card.title}`}
                            title={isSaved ? 'Saved to Notebook' : 'Bookmark Resource'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSaved
                                ? 'text-[#C84428] bg-[#FBECE6]'
                                : 'text-[#606B7C] hover:text-[#121827] hover:bg-[#F7F5F0]'
                            }`}
                          >
                            <Bookmark
                              className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Grounded YouTube Recommendations from Active Document */}
          {ytVideos.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="font-serif-editorial text-lg font-bold text-[#121827]">
                Verified Video Matches for {activeDoc?.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ytVideos.slice(0, 3).map((vid) => (
                  <a
                    key={vid.videoId}
                    href={vid.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lm-card-editorial p-3.5 flex items-start gap-3 hover:border-[#C84428]/50 transition-colors"
                  >
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      className="w-28 h-20 rounded-lg object-cover shrink-0 bg-[#F7F5F0]"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-serif-editorial font-bold text-[#121827] line-clamp-2">
                        {vid.title}
                      </div>
                      <div className="text-[11px] text-[#606B7C] truncate">
                        {vid.channelTitle}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C84428]">
                        <span>Watch on YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Secondary Experience 1: LearnMate Daily (Current Affairs Newspaper & Quiz) */}
      {activeExperience === 'daily-news' && (
        <div className="space-y-5">
          <div className="lm-card-editorial p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E6E2] pb-4">
              <div>
                <div className="lm-kicker">LEARNMATE DAILY EDITION</div>
                <h2 className="font-serif-editorial text-2xl font-bold text-[#121827]">
                  Exam-Relevant Science, Economy &amp; Global Current Affairs
                </h2>
              </div>
              <span className="text-xs text-[#606B7C]">
                Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {newsLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#606B7C]">
                <Loader2 className="w-4 h-4 animate-spin text-[#C84428]" />
                <span>Loading today&apos;s digest...</span>
              </div>
            ) : newsArticles.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#606B7C]">
                {newsMessage || "Today's digest is unavailable right now. Please try again later."}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {newsArticles.map((art) => {
                  const chosen = selectedNewsAnswers[art.id];
                  return (
                    <div
                      key={art.id}
                      className="rounded-xl border border-[#E8E6E2] bg-[#FCFBF9] p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#C84428]">
                        <span>{art.category.toUpperCase()}</span>
                        <span className="text-[#606B7C]">{art.sourceName}</span>
                      </div>
                      <h3 className="font-serif-editorial text-lg font-bold text-[#121827]">
                        {art.headline}
                      </h3>
                      <p className="text-xs text-[#3D4655] leading-relaxed">{art.summary}</p>
                      {art.quizQuestion && (
                        <div className="p-3 rounded-lg bg-white border border-[#E8E6E2] text-xs space-y-2">
                          <div className="font-semibold text-[#121827]">
                            Quick Check: {art.quizQuestion.question}
                          </div>
                          <div className="space-y-1.5">
                            {art.quizQuestion.options.map((opt, idx) => {
                              const isSelected = chosen === idx;
                              const isCorrect = art.quizQuestion?.correctIndex === idx;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedNewsAnswers((p) => ({ ...p, [art.id]: idx }))
                                  }
                                  className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                    chosen !== undefined
                                      ? isCorrect
                                        ? 'bg-[#E2F5EA] border-[#2E7D52] text-[#121827] font-semibold'
                                        : isSelected
                                        ? 'bg-[#FBECE6] border-[#C84428] text-[#C84428]'
                                        : 'bg-white border-[#E8E6E2] text-[#606B7C]'
                                      : 'bg-white hover:bg-[#FCFBF9] border-[#E8E6E2] text-[#121827]'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {chosen !== undefined && (
                            <div className="text-[11px] text-[#2E7D52] pt-1">
                              {art.quizQuestion.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Secondary Experience 2: Course Library */}
      {activeExperience === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: 'Class 12 Mathematics: Probability & Random Variables',
              level: 'Class 12 / JEE Main & Advanced',
              chapters: 4,
              summary:
                'Complete structured notes covering Sample Spaces, Conditional Probability, Bayes’ Theorem, and Binomial/Normal Distributions.',
              content:
                'Chapter 1: Sample Spaces and Events\nThe sample space S is the set of all possible outcomes.\n\n--- Page 2 ---\nChapter 2: Conditional Probability\nP(A | B) = P(A ∩ B) / P(B), P(B) > 0.\n\n--- Page 3 ---\nChapter 3: Bayes Theorem & Total Probability\nP(A_i | B) = P(B | A_i)P(A_i) / Σ P(B | A_j)P(A_j).',
            },
            {
              title: 'Classical Mechanics & Electromagnetic Induction',
              level: 'Class 12 Physics / NEET & JEE',
              chapters: 5,
              summary:
                'Kinematics, projectile motion trajectories, Faraday’s law of induction, Lenz’s law, and RL/RC transient circuits.',
              content:
                'Page 1: Projectile Motion Kinematics\nHorizontal range R = (v0^2 sin(2θ)) / g. Maximum height H = (v0 sin θ)^2 / (2g).\n\n--- Page 2 ---\nPage 2: Faraday Law & Lenz Law\nInduced EMF ε = -dΦ_B / dt.',
            },
            {
              title: 'Data Structures, Graph Algorithms & Dynamic Programming',
              level: 'College CS / GATE CS',
              chapters: 6,
              summary:
                'Recurrence relations, Master Theorem, Dijkstra shortest paths, and memoization vs. tabulation patterns.',
              content:
                'Page 1: Graph Traversal & Shortest Paths\nBFS runs in O(V + E). Dijkstra algorithm finds shortest paths from a source with non-negative edge weights.\n\n--- Page 2 ---\nPage 2: Dynamic Programming\nOptimal substructure and overlapping subproblems.',
            },
          ].map((course, idx) => (
            <div key={idx} className="lm-card-editorial p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="lm-kicker">{course.level}</div>
                <h3 className="font-serif-editorial text-xl font-bold text-[#121827]">
                  {course.title}
                </h3>
                <p className="text-xs text-[#606B7C] leading-relaxed">{course.summary}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onImportAsStudyMaterial?.(course.title, course.content, 'paste')
                }
                className="w-full py-2.5 px-4 rounded-lg lm-btn-accent text-xs cursor-pointer"
              >
                Open Course in Study Space →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Secondary Experience 3: Educational Maps */}
      {activeExperience === 'maps' && (
        <div className="lm-card-editorial p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="lm-kicker">EDUCATIONAL MAPS</div>
              <h2 className="font-serif-editorial text-2xl font-bold text-[#121827]">
                Science Centers, Reference Libraries &amp; Museums Near You
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Enter city..."
                className="px-3 py-1.5 rounded-lg border border-[#E8E6E2] bg-[#FCFBF9] text-xs text-[#121827]"
              />
              <button
                type="button"
                onClick={loadEducationalPlaces}
                className="px-3.5 py-1.5 rounded-lg lm-btn-accent text-xs cursor-pointer"
              >
                Find Places
              </button>
            </div>
          </div>

          {placesLoading ? (
            <div className="py-10 text-center text-xs text-[#606B7C]">Searching...</div>
          ) : places.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-[#606B7C]">
                {placesMessage || 'No places found.'}
              </p>
              {mapsSearchUri && (
                <a
                  href={mapsSearchUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex px-3.5 py-1.5 rounded-lg lm-btn-accent text-xs"
                >
                  Search Google Maps for {cityInput.trim() || 'your city'}
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {places.map((pl) => (
                <div
                  key={pl.id}
                  className="rounded-xl border border-[#E8E6E2] bg-[#FCFBF9] p-4 space-y-2"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#C84428]">
                    {pl.category}
                  </div>
                  <h3 className="font-serif-editorial text-base font-bold text-[#121827]">
                    {pl.name}
                  </h3>
                  <p className="text-xs text-[#606B7C]">{pl.description}</p>
                  <p className="text-[11px] text-[#3D4655] font-medium">
                    Study Link: {pl.studyConnection}
                  </p>
                  <a
                    href={pl.mapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C84428] hover:underline pt-1"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resource Preview & Study Import Modal */}
      {previewResource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#121827]/30 backdrop-blur-[2px] p-4"
          onClick={() => setPreviewResource(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-[#E8E6E2] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="lm-kicker">{previewResource.typeLabel}</div>
                <h3 className="font-serif-editorial text-2xl font-bold text-[#121827]">
                  {previewResource.title}
                </h3>
                <div className="text-xs text-[#606B7C] mt-0.5">
                  Source: {previewResource.sourceName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewResource(null)}
                className="text-xs font-semibold text-[#606B7C] hover:text-[#121827] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#FCFBF9] border border-[#E8E6E2] text-xs text-[#121827] whitespace-pre-line leading-relaxed font-serif-editorial">
              {previewResource.contentForImport}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              {previewResource.url && (
                <a
                  href={previewResource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E8E6E2] bg-white hover:bg-[#FCFBF9] text-xs font-semibold text-[#121827]"
                >
                  <span>Open Original Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {onImportAsStudyMaterial && (
                <button
                  type="button"
                  onClick={() => {
                    onImportAsStudyMaterial(
                      previewResource.title,
                      previewResource.contentForImport,
                      previewResource.type === 'video' ? 'youtube' : 'paste'
                    );
                    setPreviewResource(null);
                  }}
                  className="px-4 py-2 rounded-lg lm-btn-accent text-xs cursor-pointer"
                >
                  Open in Study Space →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { GraduationCap, BookOpen } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';

interface Props {
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onSubscribeRequest: () => void;
}

const GRADE_LEVELS = [
  {
    id: 'all',
    label: 'All Levels',
    subtitle: '',
    grades: [] as { id: string; label: string }[],
  },
  {
    id: 'junior',
    label: 'CBC Primary',
    subtitle: 'PP1 – Grade 6',
    grades: [
      { id: 'pp1', label: 'PP1' },
      { id: 'pp2', label: 'PP2' },
      { id: 'g1',  label: 'Grade 1' },
      { id: 'g2',  label: 'Grade 2' },
      { id: 'g3',  label: 'Grade 3' },
      { id: 'g4',  label: 'Grade 4' },
      { id: 'g5',  label: 'Grade 5' },
      { id: 'g6',  label: 'Grade 6' },
    ],
  },
  {
    id: 'secondary',
    label: 'Secondary',
    subtitle: 'Form 1 – 4',
    grades: [
      { id: 'f1', label: 'Form 1' },
      { id: 'f2', label: 'Form 2' },
      { id: 'f3', label: 'Form 3' },
      { id: 'f4', label: 'Form 4 / KCSE' },
    ],
  },
];

const PRIMARY_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Science & Tech',
  'Social Studies', 'CRE', 'Creative Arts', 'Physical Education',
];

const SECONDARY_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry',
  'Physics', 'History & Government', 'Geography', 'CRE',
  'Business Studies', 'Computer Studies', 'Agriculture',
];

const videoMatchesGrade = (v: Video, gradeLabel: string): boolean => {
  const kw = gradeLabel.toLowerCase().split(' / ')[0]; // "form 4" from "form 4 / kcse"
  const text = `${v.title} ${(v.tags || []).join(' ')} ${v.description || ''}`.toLowerCase();
  if (gradeLabel.toLowerCase().includes('kcse') && text.includes('kcse')) return true;
  return text.includes(kw);
};

const videoMatchesSubject = (v: Video, subject: string): boolean => {
  const s = subject.toLowerCase();
  const text = `${v.title} ${(v.tags || []).join(' ')} ${v.description || ''}`.toLowerCase();
  const aliases: Record<string, string[]> = {
    'mathematics':          ['math', 'hesabu', 'algebra', 'geometry'],
    'english':              ['english', 'composition', 'comprehension'],
    'kiswahili':            ['kiswahili', 'swahili', 'inshaallah'],
    'science & tech':       ['science', 'teknolojia', 'biology', 'physics', 'chem'],
    'biology':              ['biol', 'anatomy', 'ecology'],
    'chemistry':            ['chem', 'periodic', 'titration'],
    'physics':              ['physics', 'mechanics', 'electricity', 'magnetism'],
    'social studies':       ['social', 'hss', 'civics'],
    'history & government': ['history', 'historia', 'government', 'serikali'],
    'geography':            ['geograph', 'jiografia', 'map', 'climate'],
    'cre':                  ['cre', 'christian', 'religion', 'bible', 'dini'],
    'business studies':     ['business', 'biashara', 'accounting', 'commerce'],
    'computer studies':     ['computer', 'computing', 'ict', 'programming'],
    'agriculture':          ['agri', 'kilimo', 'farming', 'crop'],
    'creative arts':        ['art', 'music', 'drama', 'creative'],
    'physical education':   ['pe ', ' pe', 'sport', 'physical education', 'michezo'],
  };
  const terms = aliases[s] || [s];
  return terms.some(t => text.includes(t));
};

const CBCStudyMode: React.FC<Props> = ({ videos, watchLaterIds, onToggleWatchLater, onSubscribeRequest }) => {
  const [activeLevel, setActiveLevel]     = useState('all');
  const [activeGrade, setActiveGrade]     = useState('');
  const [activeSubject, setActiveSubject] = useState('');

  const levelDef = GRADE_LEVELS.find(l => l.id === activeLevel)!;
  const subjects = activeLevel === 'secondary' ? SECONDARY_SUBJECTS : PRIMARY_SUBJECTS;

  const filteredVideos = useMemo(() => {
    let result = videos;
    if (activeGrade)   result = result.filter(v => videoMatchesGrade(v, activeGrade));
    if (activeSubject) result = result.filter(v => videoMatchesSubject(v, activeSubject));
    return result;
  }, [videos, activeGrade, activeSubject]);

  const clearFilters = () => { setActiveGrade(''); setActiveSubject(''); };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/20 flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">CBC Study Mode</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Filter by grade & subject · {videos.length} videos available
          </p>
        </div>
      </div>

      {/* Level tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {GRADE_LEVELS.map(level => (
          <button
            key={level.id}
            onClick={() => { setActiveLevel(level.id); clearFilters(); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeLevel === level.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {level.label}
            {level.subtitle && (
              <span className="hidden md:inline text-xs font-normal opacity-70 ml-1.5">
                ({level.subtitle})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grade pills */}
      {activeLevel !== 'all' && levelDef.grades.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {levelDef.grades.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGrade(activeGrade === g.label ? '' : g.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeGrade === g.label
                  ? 'bg-blue-500 text-white border-blue-500 shadow shadow-blue-900/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-blue-500/50 hover:text-blue-300'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* Subject pills */}
      <div className="flex gap-2 flex-wrap mb-6 pb-5 border-b border-zinc-800/60">
        {subjects.map(s => (
          <button
            key={s}
            onClick={() => setActiveSubject(activeSubject === s ? '' : s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              activeSubject === s
                ? 'bg-emerald-600 text-white border-emerald-600 shadow shadow-emerald-900/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-emerald-500/50 hover:text-emerald-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Active filter summary */}
      {(activeGrade || activeSubject) && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-zinc-500 text-xs">Showing</span>
          {activeGrade   && <span className="text-xs font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">{activeGrade}</span>}
          {activeSubject && <span className="text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">{activeSubject}</span>}
          <span className="text-zinc-600 text-xs">· {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}</span>
          <button onClick={clearFilters} className="text-zinc-600 hover:text-zinc-400 text-xs underline ml-1">
            Clear
          </button>
        </div>
      )}

      {/* Results */}
      {filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <BookOpen className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No videos match these filters</p>
          <p className="text-zinc-600 text-xs mt-1">Try a different grade or subject</p>
          <button onClick={clearFilters} className="mt-4 text-blue-400 text-xs hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredVideos.map(video => (
            <div id={`video-${video.id}`} key={video.id}>
              <VideoCard
                video={video}
                isWatchLater={watchLaterIds.includes(video.id)}
                onToggleWatchLater={onToggleWatchLater}
                isSubscribed={true}
                onSubscribeRequest={onSubscribeRequest}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CBCStudyMode;


import React from 'react';
import { SlidersHorizontal, Eye, Clock, Sparkles, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DurationFilter = '' | 'short' | 'medium' | 'long';
export type SearchSort     = 'relevant' | 'views' | 'newest';

export interface SearchFilters {
  duration: DurationFilter;
  sort: SearchSort;
  category: string;
}

interface Props {
  searchQuery: string;
  resultCount: number;
  totalCount: number;
  categories: string[];
  filters: SearchFilters;
  onChange: (f: Partial<SearchFilters>) => void;
  onReset: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATION_CHIPS: { value: DurationFilter; label: string }[] = [
  { value: '',       label: 'Any length' },
  { value: 'short',  label: 'Short · <5m' },
  { value: 'medium', label: 'Medium · 5-20m' },
  { value: 'long',   label: 'Long · >20m' },
];

const SORT_CHIPS: { value: SearchSort; label: string; icon: React.ReactNode }[] = [
  { value: 'relevant', label: 'Best match', icon: <Sparkles size={10} /> },
  { value: 'views',    label: 'Most viewed', icon: <Eye size={10} /> },
  { value: 'newest',   label: 'Newest first', icon: <Clock size={10} /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

const SearchFilterBar: React.FC<Props> = ({
  searchQuery, resultCount, totalCount, categories, filters, onChange, onReset,
}) => {
  const hasActiveFilter = filters.duration !== '' || filters.sort !== 'relevant' || filters.category !== '';

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Result header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-zinc-500" />
          <span className="text-zinc-400 text-xs">
            <span className="text-white font-black">{resultCount}</span>
            {resultCount !== totalCount && (
              <span className="text-zinc-600"> of {totalCount}</span>
            )}
            {' '}result{resultCount !== 1 ? 's' : ''} for{' '}
            <span className="text-red-400 font-bold">"{searchQuery}"</span>
          </span>
        </div>
        {hasActiveFilter && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
          >
            <X size={10} /> Reset filters
          </button>
        )}
      </div>

      {/* Filter chips — wrap on mobile */}
      <div className="flex flex-wrap gap-2">
        {/* Duration */}
        {DURATION_CHIPS.map(chip => (
          <button
            key={chip.value}
            onClick={() => onChange({ duration: chip.value })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
              filters.duration === chip.value
                ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
            }`}
          >
            {chip.label}
          </button>
        ))}

        {/* Vertical divider */}
        <div className="w-px bg-zinc-800 self-stretch hidden sm:block" />

        {/* Sort */}
        {SORT_CHIPS.map(chip => (
          <button
            key={chip.value}
            onClick={() => onChange({ sort: chip.value })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
              filters.sort === chip.value
                ? 'bg-white border-white text-black shadow'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
            }`}
          >
            {chip.icon} {chip.label}
          </button>
        ))}

        {/* Category chips — only show top 5 to avoid clutter */}
        {categories.slice(0, 5).map(cat => (
          <button
            key={cat}
            onClick={() => onChange({ category: filters.category === cat ? '' : cat })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
              filters.category === cat
                ? 'bg-zinc-200 border-zinc-200 text-zinc-900 shadow'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchFilterBar;

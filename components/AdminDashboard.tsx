import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Edit2, Save, X, Loader2, RefreshCcw, Film, Image, Play,
  ChevronDown, ChevronUp, BarChart2, Eye, EyeOff, Tag, User, UploadCloud, ShieldAlert
} from 'lucide-react';
import { fetchBunnyVideos, bunnyVideoToVideo, BunnyVideoItem, getThumbnailUrl, uploadCustomThumbnail, updateVideoMetadata, setVideoMuted } from '../services/bunnyService';
import UploadSection from './UploadSection';
import AnalyticsDashboard from './AnalyticsDashboard';
import { NavItem, Video } from '../types';
import { normalizeContentRating, ratingDescription, type ContentRating } from '../lib/contentRating';
import { CONTENT_RATING_ENFORCED } from '../constants';

interface AdminDashboardProps {
  onUploadComplete?: (video: Video) => void;
  creatorName?: string;
  currentNavItems?: NavItem[];
  onAddCategory?: (name: string, iconName: string) => void;
  onRemoveCategory?: (id: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Movies',
  'Series',
  'Micro Dramas',
  'Shorts',
  'Farmers',
  'Education',
  'Faith',
  'Diaspora',
  'Kids',
  'Live',
  'Trending',
];

const GENRES = [
  'Drama', 'Comedy', 'Documentary', 'Thriller', 'Action', 'Romance',
  'Horror', 'Sci-Fi', 'Animation', 'Reality', 'News', 'Sports', 'Music',
  'Education', 'Lifestyle', 'Farming', 'Religion', 'Kids', 'Swahili',
];

const EMPTY_FORM = {
  title: '',
  seriesTitle: '',
  seriesId: '',
  seriesSynopsis: '',
  seasonSynopsis: '',
  episodeSynopsis: '',
  seriesFormat: 'standard',
  season: '',
  episode: '',
  introEndSeconds: '',
  outroStartSeconds: '',
  category: '',
  genre: '',
  author: '',
  description: '',
  thumbnailUrl: '',
  trailerUrl: '',
  productionYear: '',
  contentRating: 'UNRATED' as ContentRating,
  classificationNumber: '',
  tags: '',
};

type EditForm = typeof EMPTY_FORM;
const EDIT_DRAFTS_STORAGE_KEY = 'tube_content_overrides';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getMeta = (tags: BunnyVideoItem['metaTags'], prop: string) =>
  tags?.find(t => t.property.toLowerCase() === prop.toLowerCase())?.value || '';

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-zinc-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const EditModal = ({
  item,
  form,
  setForm,
  saving,
  existingSeries,
  seriesDetails,
  existingAuthors,
  onSave,
  onClose,
}: {
  item: BunnyVideoItem;
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  saving: boolean;
  existingSeries: string[];
  seriesDetails: Record<string, { seriesId: string; seriesSynopsis: string }>;
  existingAuthors: string[];
  onSave: () => void;
  onClose: () => void;
}) => {
  const [thumbError, setThumbError] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const thumbSrc = form.thumbnailUrl || getThumbnailUrl(item.guid, item.thumbnailFileName);

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingThumb(true);
    try {
      const newFileName = await uploadCustomThumbnail(item.guid, file);
      if (newFileName !== null) {
        // Build cache-busted URL using the exact filename Bunny assigned
        const host = import.meta.env.VITE_BUNNY_PULL_ZONE?.replace(/\/$/, '') || '';
        const cacheBustedUrl = `https://${host}/${item.guid}/${newFileName}?t=${Date.now()}`;
        setForm(f => ({ ...f, thumbnailUrl: cacheBustedUrl }));
        setThumbError(false);
      } else {
        alert('Failed to upload thumbnail. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Upload error.');
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const field = (
    label: string,
    key: keyof EditForm,
    opts?: { type?: string; placeholder?: string; as?: 'textarea' | 'select' | 'input'; options?: string[]; list?: string }
  ) => {
    const { type = 'text', placeholder = '', as = 'input', options = [], list } = opts || {};
    const value = form[key] as string;
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      const existing = key === 'seriesTitle' ? seriesDetails[`${form.category}:${value.trim().toLowerCase()}`] : undefined;
      setForm(f => ({ ...f, ...(existing || {}), [key]: value }));
    };
    const cls = 'w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors';

    return (
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{label}</label>
        {as === 'textarea' ? (
          <textarea rows={3} value={value} onChange={onChange} placeholder={placeholder} className={cls} />
        ) : as === 'select' ? (
          <select value={value} onChange={onChange} className={cls}>
            <option value="">— Select —</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} list={list} value={value} onChange={onChange} placeholder={placeholder} className={cls} />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - Removed onClick to prevent accidental closure */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600/20 rounded-xl flex items-center justify-center">
              <Edit2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Content</h2>
              <p className="text-zinc-500 text-xs">{item.guid.slice(0, 16)}...</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Thumbnail Preview */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2 font-medium">Thumbnail Preview</label>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
              {!thumbError ? (
                <img src={thumbSrc} alt="thumbnail" className="w-full h-full object-cover" onError={() => setThumbError(true)} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image className="w-10 h-10 text-zinc-600" />
                </div>
              )}
              {isUploadingThumb && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                  <p className="text-white text-xs font-medium">Uploading...</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 flex gap-2">
                <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg border border-white/10">
                  {item.length ? `${Math.floor(item.length / 60)}:${String(Math.floor(item.length % 60)).padStart(2, '0')}` : '--:--'}
                </span>
                <span className="bg-black/60 text-zinc-300 text-xs px-2 py-1 rounded-lg border border-white/10">
                  {item.views?.toLocaleString() ?? 0} views
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnail & Trailer URLs */}
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                {field('Custom Thumbnail URL', 'thumbnailUrl', { placeholder: 'https://... (leave blank to use CDN default)' })}
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbUpload}
                  disabled={isUploadingThumb}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  title="Upload Image to Bunny"
                />
                <button
                  type="button"
                  disabled={isUploadingThumb}
                  className="h-10 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-zinc-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                >
                  <UploadCloud size={16} />
                  Upload
                </button>
              </div>
            </div>
            {field('Trailer URL', 'trailerUrl', { placeholder: 'https://... (optional YouTube/CDN trailer link)' })}
          </div>

          {/* Core Metadata */}
          <div className="grid grid-cols-1 gap-4">
            {field('Title', 'title', { placeholder: 'Video title (e.g., "The Awakening")' })}
            {field('Description', 'description', { as: 'textarea', placeholder: 'Short description of the content...' })}
          </div>

          {/* Series Info */}
          {(form.category === 'Series' || form.category === 'Micro Dramas') && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
              <div className="col-span-3 pb-1 border-b border-red-500/10">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Series Organization</p>
              </div>
              <div className="col-span-3">
                {field('Main series synopsis', 'seriesSynopsis', { as: 'textarea', placeholder: 'The overall story premise, characters and stakes. Avoid episode spoilers.' })}
                {field('Season summary', 'seasonSynopsis', { as: 'textarea', placeholder: 'What is this season about? Keep later-season twists out.' })}
                {field('Episode synopsis', 'episodeSynopsis', { as: 'textarea', placeholder: 'What happens in this episode? Keep the cliffhanger a surprise.' })}
                <p className="mt-2 text-xs text-zinc-400">{form.category === 'Micro Dramas' ? 'Micro Dramas use portrait playback and their own catalogue shelf.' : 'Series use landscape artwork and a season-first episode page.'} Episode numbers must be unique within a season.</p>
              </div>
              <div className="col-span-3 md:col-span-1">
                {field('Series Name', 'seriesTitle', { placeholder: 'e.g. Nairobi Noir', list: 'existing-series-names' })}
                <datalist id="existing-series-names">
                  {existingSeries.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div className="col-span-1 md:col-span-1">
                {field('Season', 'season', { type: 'number', placeholder: '1' })}
              </div>
              <div className="col-span-1 md:col-span-1">
                {field('Episode', 'episode', { type: 'number', placeholder: '1' })}
              </div>
              <div className="col-span-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {field('Intro ends at (seconds)', 'introEndSeconds', { type: 'number', placeholder: 'Optional, e.g. 45' })}
                {field('Outro starts at (seconds)', 'outroStartSeconds', { type: 'number', placeholder: 'Optional, e.g. 1260' })}
                <p className="text-xs text-zinc-400 md:col-span-2">Set exact cue points for this episode. Skip buttons appear only when these times are saved.</p>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="grid grid-cols-1 gap-4">
            {field('Category', 'category', { as: 'select', options: CATEGORIES })}
          </div>

          {/* Genre Multi-select */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2 font-medium">Genres (Select multiple)</label>
            <div className="flex flex-wrap gap-2 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
              {GENRES.map(g => {
                const selectedGenres = (form.genre || '').split(',').map(s => s.trim()).filter(Boolean);
                const isSelected = selectedGenres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      let newGenres = [...selectedGenres];
                      if (isSelected) {
                        newGenres = newGenres.filter(x => x !== g);
                      } else {
                        newGenres.push(g);
                      }
                      setForm(f => ({ ...f, genre: newGenres.join(',') }));
                    }}
                    className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-red-600 border-red-500 text-white font-medium shadow-sm'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Author + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              {field('Author / Creator', 'author', { placeholder: 'Channel name', list: 'existing-authors-list' })}
              <datalist id="existing-authors-list">
                {existingAuthors.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
            {field('Production Year', 'productionYear', { type: 'number', placeholder: new Date().getFullYear().toString() })}
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2">
            <div>
              {field('KFCB content rating', 'contentRating', { as: 'select', options: ['GE', 'PG', '16', '18', 'UNRATED'] })}
              <p className={`mt-1.5 text-xs ${form.contentRating === 'UNRATED' || form.contentRating === '18' ? 'text-amber-400' : 'text-zinc-500'}`}>
                {ratingDescription(form.contentRating)}{form.contentRating === '18' ? ' - hidden from the public catalogue.' : form.contentRating === 'UNRATED' ? (CONTENT_RATING_ENFORCED ? ' - hidden from the public catalogue.' : ' - visible during the test phase only.') : ''}
              </p>
            </div>
            {field('Classification number', 'classificationNumber', { placeholder: 'Optional KFCB certificate number' })}
          </div>

          {/* Tags */}
          {field('Tags', 'tags', { placeholder: 'farming, maize, kenya (comma-separated)' })}

        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-t border-zinc-800 sticky bottom-0 bg-zinc-950">
          <p className="text-xs text-zinc-500">Draft saved automatically on this device</p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors">
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white text-sm font-bold flex items-center gap-2 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onUploadComplete,
  creatorName,
  currentNavItems,
  onAddCategory,
  onRemoveCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'upload' | 'analytics'>('content');
  const [items, setItems] = useState<BunnyVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'title'>('date');
  const [filterRating, setFilterRating] = useState<'All' | ContentRating>('All');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editingItem, setEditingItem] = useState<BunnyVideoItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [visibilitySavingIds, setVisibilitySavingIds] = useState<Set<string>>(new Set());

  // Load overrides from localStorage
  const getOverrides = useCallback((): Record<string, Partial<EditForm>> => {
    try { return JSON.parse(localStorage.getItem(EDIT_DRAFTS_STORAGE_KEY) || '{}'); } catch { return {}; }
  }, []);

  const persistEditDraft = useCallback((videoId: string, draft: EditForm) => {
    const drafts = getOverrides();
    drafts[videoId] = draft;
    localStorage.setItem(EDIT_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  }, [getOverrides]);

  const clearEditDraft = useCallback((videoId: string) => {
    const drafts = getOverrides();
    if (!drafts[videoId]) return;
    delete drafts[videoId];
    localStorage.setItem(EDIT_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  }, [getOverrides]);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try { setItems(await fetchBunnyVideos(true)); }
    catch { setLoadError('Unable to load the admin library. Check your sign-in and try again.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!editingItem) return;
    persistEditDraft(editingItem.guid, editForm);
  }, [editForm, editingItem, persistEditDraft]);

  const startEdit = (item: BunnyVideoItem) => {
    const mapped = bunnyVideoToVideo(item);
    const overrides = getOverrides();
    const saved = overrides[item.guid] || {};
    setEditForm({
      title: saved.title ?? item.title,
      seriesTitle: saved.seriesTitle ?? getMeta(item.metaTags, 'seriesTitle'),
      seriesId: saved.seriesId ?? mapped.seriesId ?? '',
      seriesSynopsis: saved.seriesSynopsis ?? mapped.seriesSynopsis ?? '',
      seasonSynopsis: saved.seasonSynopsis ?? mapped.seasonSynopsis ?? '',
      episodeSynopsis: saved.episodeSynopsis ?? mapped.episodeSynopsis ?? mapped.description ?? '',
      seriesFormat: saved.seriesFormat ?? mapped.seriesFormat ?? 'standard',
      season: saved.season ?? getMeta(item.metaTags, 'season'),
      episode: saved.episode ?? getMeta(item.metaTags, 'episode'),
      introEndSeconds: saved.introEndSeconds ?? getMeta(item.metaTags, 'introEndSeconds'),
      outroStartSeconds: saved.outroStartSeconds ?? getMeta(item.metaTags, 'outroStartSeconds'),
      category: saved.category ?? mapped.category,
      genre: saved.genre ?? getMeta(item.metaTags, 'genre'),
      author: saved.author ?? mapped.author,
      description: saved.description ?? getMeta(item.metaTags, 'description'),
      thumbnailUrl: saved.thumbnailUrl ?? getMeta(item.metaTags, 'thumbnailUrl'),
      trailerUrl: saved.trailerUrl ?? getMeta(item.metaTags, 'trailerUrl'),
      productionYear: saved.productionYear ?? getMeta(item.metaTags, 'productionYear'),
      contentRating: normalizeContentRating(saved.contentRating ?? mapped.contentRating),
      classificationNumber: saved.classificationNumber ?? getMeta(item.metaTags, 'classificationNumber'),
      tags: saved.tags ?? getMeta(item.metaTags, 'tags'),
    });
    setEditingItem(item);
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    const episodic = ['Series', 'Micro Dramas'].includes(editForm.category);
    if (episodic && (!editForm.seriesTitle.trim() || ![editForm.season, editForm.episode].every(value => /^[1-9]\d*$/.test(value)))) {
      alert('Enter a series name and positive whole numbers for season and episode.');
      return;
    }
    const intro = editForm.introEndSeconds.trim();
    const outro = editForm.outroStartSeconds.trim();
    if (episodic && ([intro, outro].some(value => value && !/^[1-9]\d*$/.test(value)) || (intro && outro && Number(intro) >= Number(outro)) || [intro, outro].some(value => value && editingItem.length > 0 && Number(value) >= editingItem.length))) {
      alert('Use positive whole-second cue points within the video. The intro must end before the outro starts.');
      return;
    }
    const nameKey = editForm.seriesTitle.trim().toLowerCase();
    const siblings = episodic ? items.filter(item => item.guid !== editingItem.guid && bunnyVideoToVideo(item).category === editForm.category && (
      (editForm.seriesId && getMeta(item.metaTags, 'seriesId') === editForm.seriesId) ||
      (!getMeta(item.metaTags, 'seriesId') || !editForm.seriesId) && getMeta(item.metaTags, 'seriesTitle').trim().toLowerCase() === nameKey
    )) : [];
    if (siblings.some(item => Number(getMeta(item.metaTags, 'season') || 1) === Number(editForm.season) && Number(getMeta(item.metaTags, 'episode')) === Number(editForm.episode))) {
      alert('That season already has this episode number. Choose a unique episode number.');
      return;
    }
    const seriesId = episodic ? editForm.seriesId || siblings.map(item => getMeta(item.metaTags, 'seriesId')).find(Boolean) || crypto.randomUUID() : '';
    const normalizedForm = {
      ...editForm, seriesId,
      seriesTitle: episodic ? editForm.seriesTitle.trim() : '',
      seriesSynopsis: episodic ? editForm.seriesSynopsis : '',
      seasonSynopsis: episodic ? editForm.seasonSynopsis : '',
      episodeSynopsis: episodic ? editForm.episodeSynopsis : '',
      season: episodic ? editForm.season : '', episode: episodic ? editForm.episode : '',
      introEndSeconds: episodic ? intro : '', outroStartSeconds: episodic ? outro : '',
      seriesFormat: editForm.category === 'Micro Dramas' ? 'micro-drama' : 'standard',
    };
    setEditForm(normalizedForm);
    persistEditDraft(editingItem.guid, normalizedForm);
    setSaving(true);
    
    try {
      // 1. Prepare the updated metadata
      // Strip out old values for the keys we are about to update, then append our new values
      const keysToUpdate = ['category', 'author', 'genre', 'description', 'thumbnailurl', 'trailerurl', 'productionyear', 'contentrating', 'classificationnumber', 'ispremium', 'tags', 'season', 'episode', 'seriestitle', 'seriesid', 'seriessynopsis', 'seasonsynopsis', 'episodesynopsis', 'seriesformat', 'introendseconds', 'outrostartseconds'];
      const filteredMetaTags = (editingItem.metaTags || []).filter(
        t => !keysToUpdate.includes(t.property.toLowerCase())
      );
      
      const newMetaTags = [
        ...filteredMetaTags,
        ...Object.entries(normalizedForm).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => ({ property: k, value: String(v) }))
      ];

      // 2. Save to Bunny CDN via Supabase Proxy
      const updatePayload = {
        title: editForm.title,
        metaTags: newMetaTags
      };
      
      const result = await updateVideoMetadata(editingItem.guid, updatePayload);
      
      if (result) {
        // Bunny metadata has no multi-video transaction. Keep the draft until
        // every shared-series update succeeds, so a partial save can be retried.
        const shared = { seriesId, seriesTitle: normalizedForm.seriesTitle, seriesSynopsis: normalizedForm.seriesSynopsis, seriesFormat: normalizedForm.seriesFormat, category: normalizedForm.category };
        for (const sibling of siblings) {
          const sameSeason = Number(getMeta(sibling.metaTags, 'season') || 1) === Number(normalizedForm.season);
          const siblingShared = sameSeason && normalizedForm.seasonSynopsis.trim() ? { ...shared, seasonSynopsis: normalizedForm.seasonSynopsis } : shared;
          const metaTags = [
            ...(sibling.metaTags || []).filter(tag => !Object.keys(siblingShared).some(key => key.toLowerCase() === tag.property.toLowerCase())),
            ...Object.entries(siblingShared).map(([property, value]) => ({ property, value })),
          ];
          if (!(await updateVideoMetadata(sibling.guid, { metaTags }))) {
            throw new Error('The episode saved, but some series details did not. Your draft is retained; retry Save Changes to finish.');
          }
          setItems(previous => previous.map(item => item.guid === sibling.guid ? { ...item, metaTags } : item));
        }
        // 3. Update the item in our local state to reflect the change immediately
        const updatedItem = { ...editingItem, title: editForm.title, metaTags: newMetaTags };
        setItems(prev => prev.map(item => item.guid === editingItem.guid ? updatedItem : item));
        
        // The server now has the latest values, so this video's local draft is no longer needed.
        clearEditDraft(editingItem.guid);

        setSavedIds(prev => new Set(prev).add(editingItem.guid));
        setEditingItem(null);
        window.dispatchEvent(new Event('tube-catalogue-change'));
      } else {
        alert('Failed to save changes to the server. Your draft is saved on this device so you can retry.');
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message + ' Your draft is saved on this device so you can retry.' : 'An error occurred while saving. Your draft is saved on this device so you can retry.');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (item: BunnyVideoItem) => {
    if (visibilitySavingIds.has(item.guid)) return;
    const isHidden = getMeta(item.metaTags, 'muted') === 'true';
    setVisibilitySavingIds((current) => new Set(current).add(item.guid));

    try {
      const saved = await setVideoMuted(item.guid, !isHidden);
      if (!saved) {
        alert('Failed to update visibility. Please try again.');
        return;
      }

      const metaTags = (item.metaTags || []).filter(
        (tag) => tag.property.toLowerCase() !== 'muted',
      );
      if (!isHidden) metaTags.push({ property: 'muted', value: 'true' });
      setItems((current) => current.map((video) => (
        video.guid === item.guid ? { ...video, metaTags } : video
      )));
    } finally {
      setVisibilitySavingIds((current) => {
        const next = new Set(current);
        next.delete(item.guid);
        return next;
      });
    }
  };

  // Merge overrides into display items
  const overrides = getOverrides();
  const enriched = items.map(item => {
    const o = overrides[item.guid];
    if (!o) return item;
    return {
      ...item,
      title: o.title || item.title,
      metaTags: [
        ...(item.metaTags || []).filter(t => !['category','author','genre','description','thumbnailUrl','trailerUrl','productionYear','isPremium','tags'].includes(t.property.toLowerCase())),
        ...(Object.entries(o).map(([k, v]) => ({ property: k, value: String(v) }))),
      ],
    } as BunnyVideoItem;
  });

  // Filter + sort
  const filtered = enriched
    .filter(v => {
      const mapped = bunnyVideoToVideo(v);
      if (filterRating !== 'All' && mapped.contentRating !== filterRating) return false;
      if (filterCat !== 'All' && mapped.category !== filterCat && filterCat !== mapped.category) {
        return false;
      }
      if (!search) return true;
      const term = search.toLowerCase();
      const matchTitle = (mapped.title || '').toLowerCase().includes(term);
      const matchSeries = (mapped.seriesTitle || '').toLowerCase().includes(term);
      const matchAuthor = (mapped.author || '').toLowerCase().includes(term);
      const matchCategory = (mapped.category || '').toLowerCase().includes(term);
      return matchTitle || matchSeries || matchAuthor || matchCategory;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'views') cmp = (a.views ?? 0) - (b.views ?? 0);
      else if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
      else cmp = new Date(a.dateUploaded || 0).getTime() - new Date(b.dateUploaded || 0).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null;

  // Stats
  const totalViews = items.reduce((s, v) => s + (v.views ?? 0), 0);
  const unratedCount = enriched.filter(v => bunnyVideoToVideo(v).contentRating === 'UNRATED').length;
  const catBreakdown: Record<string, number> = {};
  enriched.forEach(v => {
    const cat = bunnyVideoToVideo(v).category;
    catBreakdown[cat] = (catBreakdown[cat] || 0) + 1;
  });

  return (
    <div className="p-6 md:p-10 min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage content, view analytics, and upload new videos</p>
        </div>
        
        <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'content' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Film size={16} /> Content
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'upload' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <UploadCloud size={16} /> Upload
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'analytics' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <BarChart2 size={16} /> Analytics
          </button>
        </div>
      </div>

      {activeTab === 'upload' && (
        <div className="animate-in fade-in duration-500">
          <UploadSection onUploadComplete={onUploadComplete!} creatorName={creatorName!} />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="animate-in fade-in duration-500">
          <AnalyticsDashboard 
            currentNavItems={currentNavItems} 
            onAddCategory={onAddCategory} 
            onRemoveCategory={onRemoveCategory} 
            videos={items}
          />
        </div>
      )}

      {activeTab === 'content' && (
        <div className="animate-in fade-in duration-500">
          {loadError && <div role="alert" className="mb-5 rounded-lg border border-red-700 bg-red-950 p-4 text-sm text-red-200">{loadError} <button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Content Library</h2>
              <p className="text-zinc-400 text-xs mt-1">
                {items.length} videos · {Object.keys(overrides).length} with local edits
              </p>
            </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Library
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Videos" value={items.length} icon={Film} color="bg-red-600/80" />
        <StatCard label="Total Views" value={totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews} icon={Eye} color="bg-blue-600/80" />
        <StatCard label="Originals" value={(catBreakdown['Originals'] || 0)} icon={Play} color="bg-purple-600/80" />
        <StatCard label="Categories" value={Object.keys(catBreakdown).length} icon={Tag} color="bg-green-600/80" />
        <StatCard label="Needs Rating" value={unratedCount} icon={ShieldAlert} color="bg-amber-600/80" />
      </div>

      {/* Category breakdown bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Category Breakdown</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? 'All' : cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterCat === cat
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {cat} <span className="opacity-60 ml-1">{cnt}</span>
            </button>
          ))}
          {filterCat !== 'All' && (
            <button onClick={() => setFilterCat('All')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-zinc-600 text-zinc-500 hover:text-zinc-300 transition-colors">
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          aria-label="Filter by content rating"
          value={filterRating}
          onChange={e => setFilterRating(e.target.value as 'All' | ContentRating)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-red-500 focus:outline-none"
        >
          <option value="All">All ratings</option>
          <option value="UNRATED">Needs rating</option>
          <option value="GE">GE</option>
          <option value="PG">PG</option>
          <option value="16">16</option>
          <option value="18">18</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          <span className="text-zinc-400 text-sm">Loading {items.length > 0 ? `${items.length}+` : ''} videos...</span>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">
                  <button onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Video <SortIcon col="title" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Category / Genre</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">
                  <button onClick={() => toggleSort('views')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Views <SortIcon col="views" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium hidden xl:table-cell">
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-white transition-colors">
                    Uploaded <SortIcon col="date" />
                  </button>
                </th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const mapped = bunnyVideoToVideo(item);
                const o = overrides[item.guid];
                const isSaved = savedIds.has(item.guid);
                const genre = o?.genre || getMeta(item.metaTags, 'genre');
                const isHidden = getMeta(item.metaTags, 'muted') === 'true';
                const visibilitySaving = visibilitySavingIds.has(item.guid);
                return (
                  <tr key={item.guid} className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group ${isHidden ? 'opacity-60' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                          <img 
                            src={o?.thumbnailUrl || getThumbnailUrl(item.guid, item.thumbnailFileName)} 
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform bg-zinc-800" 
                            onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                            <Play className="w-4 h-4 text-white" />
                          </div>
                          {/* Duration badge */}
                          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded">
                            {item.length ? `${Math.floor(item.length / 60)}:${String(Math.floor(item.length % 60)).padStart(2, '0')}` : '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white line-clamp-1 text-sm">{o?.title || item.title || 'Untitled'}</p>
                          <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                            <User size={10} /> {o?.author || mapped.author}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${mapped.contentRating === 'UNRATED' ? 'bg-amber-600/20 text-amber-400 border-amber-600/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                              {mapped.contentRating}
                            </span>
                            {isHidden && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-600">HIDDEN</span>}
                            {isSaved && <span className="text-[9px] bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded border border-green-600/30">EDITED</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border w-fit font-medium ${
                          mapped.category === 'Originals' || mapped.category.startsWith('Originals')
                            ? 'bg-red-600/20 text-red-300 border-red-600/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}>
                          {o?.category || mapped.category}
                        </span>
                        {genre && <span className="text-[10px] text-zinc-500">{genre}</span>}
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-zinc-400 text-xs">
                      {(item.views ?? 0).toLocaleString()}
                    </td>
                    <td className="p-4 hidden xl:table-cell text-zinc-500 text-xs">
                      {item.dateUploaded ? new Date(item.dateUploaded).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleVisibility(item)}
                        disabled={visibilitySaving}
                        aria-label={isHidden ? `Show ${mapped.title} in the public catalogue` : `Hide ${mapped.title} from the public catalogue`}
                        title={isHidden ? 'Show on customer site' : 'Hide from customer site'}
                        className={`mr-2 inline-flex items-center justify-center rounded-lg border p-2 transition-all disabled:cursor-wait disabled:opacity-50 ${
                          isHidden
                            ? 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-green-500/60 hover:text-green-400'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-amber-500/60 hover:text-amber-400'
                        }`}
                      >
                        {visibilitySaving ? <Loader2 size={13} className="animate-spin" /> : isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-red-600/20 hover:border-red-600/50 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 transition-all"
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-zinc-500">
              <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No videos match your search.</p>
            </div>
          )}
          <div className="px-4 py-3 border-t border-zinc-800 text-zinc-500 text-xs">
            Showing {filtered.length} of {items.length} videos
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          form={editForm}
          setForm={setEditForm}
          saving={saving}
          existingSeries={(Array.from(new Set(enriched.map(v => getMeta(v.metaTags, 'seriesTitle')).filter(Boolean))) as string[]).sort()}
          seriesDetails={Object.fromEntries(items.filter(item => getMeta(item.metaTags, 'seriesTitle')).map(item => [`${bunnyVideoToVideo(item).category}:${getMeta(item.metaTags, 'seriesTitle').trim().toLowerCase()}`, { seriesId: getMeta(item.metaTags, 'seriesId'), seriesSynopsis: getMeta(item.metaTags, 'seriesSynopsis') }]))}
          existingAuthors={(Array.from(new Set(enriched.map(v => getMeta(v.metaTags, 'author') || getMeta(v.metaTags, 'creator') || 'Tube Creator').filter(Boolean))) as string[]).sort()}
          onSave={saveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

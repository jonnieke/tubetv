
import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileVideo, CheckCircle2, Wand2, Loader2, ImageIcon, ImagePlus, Scissors, Play, Pause, RefreshCw, Repeat, Film, AlertTriangle, X, ListVideo, Trash2, ChevronRight, Clock, AlertCircle, Timer, Tag, Mic, Radio } from 'lucide-react';
import { generateVideoMetadata, generateThumbnail } from '../services/geminiService';
import { createVideoEntry, uploadVideoFile, getStreamUrl, getThumbnailUrl, updateVideoMetadata, getVideoStatus, uploadCustomThumbnail } from '../services/bunnyService';
import { Video } from '../types';
import type { ContentRating } from '../lib/contentRating';

interface UploadMetadata {
  title: string;
  description: string;
  category: string;
  contentRating: ContentRating;
  seriesTitle: string;
  seriesSynopsis: string;
  seasonSynopsis: string;
  episodeSynopsis: string;
  season: string;
  episode: string;
  introEndSeconds: string;
  outroStartSeconds: string;
}

interface UploadItem {
  id: string; // Internal queue ID
  videoId?: string; // Bunny.net Video ID
  file: File;
  previewUrl: string;
  metadata: UploadMetadata;
  thumbnail: string | null;
  thumbnailFile?: File;
  thumbnailPrompt: string;
  status: 'idle' | 'pending' | 'uploading' | 'encoding' | 'completed' | 'error';
  progress: number;
  stageInfo?: string;
  timeRemaining?: number; // Estimated seconds remaining
  duration: number;
  trim: { start: number; end: number };
}

interface UploadSectionProps {
    onUploadComplete?: (video: Video) => void;
    creatorName?: string;
}

const CATEGORIES = [
    'Originals',
    'Movies',
    'Series',
    'Micro Dramas',
    'Shorts',
    'School Flix',
    'Documentary', 
    'Education', 
    'Farmers', 
    'Faith', 
    'Kids', 
    'Diaspora', 
    'Live', 
    'Live Recording',
    'Podcast',
    'Music', 
    'News', 
    'Technology', 
    'Lifestyle',
    'Trending'
];

const UploadSection: React.FC<UploadSectionProps> = ({ onUploadComplete, creatorName = 'Creator' }) => {
  const [uploadKind, setUploadKind] = useState('Originals');
  // Queue State
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  
  // Editor State (derived from active item, but we use local refs for playback)
  const [showTrimTool, setShowTrimTool] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | null>(null);
  
  // AI Generation States
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  const sliderRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Helper to get the currently active item
  const activeItem = queue.find(item => item.id === activeId);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      queue.forEach(item => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  // Handle Trim Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!activeDrag || !sliderRef.current || !activeItem) return;
        
        const rect = sliderRef.current.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = offsetX / rect.width;
        const newTime = percentage * activeItem.duration;

        const currentTrim = activeItem.trim;

        if (activeDrag === 'start') {
            const maxStart = currentTrim.end - 1; // Min 1 sec gap
            const finalStart = Math.min(Math.max(0, newTime), maxStart);
            updateQueueItem(activeItem.id, { trim: { ...currentTrim, start: finalStart } });
            
            // Preview
            if (videoRef.current) {
                videoRef.current.currentTime = finalStart;
                setCurrentTime(finalStart);
                videoRef.current.pause();
                setIsPlaying(false);
            }
        } else {
            const minEnd = currentTrim.start + 1;
            const finalEnd = Math.max(minEnd, Math.min(newTime, activeItem.duration));
            updateQueueItem(activeItem.id, { trim: { ...currentTrim, end: finalEnd } });

            // Preview
            if (videoRef.current) {
                videoRef.current.currentTime = finalEnd;
                setCurrentTime(finalEnd);
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const handleMouseUp = () => {
        setActiveDrag(null);
    };

    if (activeDrag) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, activeItem]);

  const updateQueueItem = (id: string, updates: Partial<UploadItem>) => {
      setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const processFiles = (files: FileList | File[]) => {
      const newItems: UploadItem[] = Array.from(files).map(file => ({
          id: Math.random().toString(36).substring(7),
          file,
          previewUrl: URL.createObjectURL(file),
          metadata: { title: file.name.split('.')[0], description: '', category: uploadKind, contentRating: 'UNRATED', seriesTitle: '', seriesSynopsis: '', seasonSynopsis: '', episodeSynopsis: '', season: '1', episode: '', introEndSeconds: '', outroStartSeconds: '' },
          thumbnail: null,
          thumbnailPrompt: file.name.split('.')[0],
          status: 'idle',
          progress: 0,
          duration: 0,
          trim: { start: 0, end: 0 } // Duration set on load
      }));

      setQueue(prev => [...prev, ...newItems]);
      
      // If no active item, select the first new one
      if (!activeId && newItems.length > 0) {
          setActiveId(newItems[0].id);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processFiles(e.dataTransfer.files);
      }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const vidDuration = e.currentTarget.duration;
      if (activeItem && activeItem.duration === 0) {
          // Auto detect shorts
          const isShort = vidDuration < 180;
          updateQueueItem(activeItem.id, { 
              duration: vidDuration,
              trim: { start: 0, end: vidDuration },
              metadata: { ...activeItem.metadata, category: isShort && activeItem.metadata.category === 'Originals' ? 'Shorts' : activeItem.metadata.category }
          });
      }
  };

  const handleTimeUpdate = () => {
      if (videoRef.current && activeItem) {
          const now = videoRef.current.currentTime;
          setCurrentTime(now);

          // Loop playback within trim region
          if (activeItem.trim.end > 0 && now >= activeItem.trim.end) {
              videoRef.current.currentTime = activeItem.trim.start;
              if (!videoRef.current.paused) {
                  videoRef.current.play();
              }
          }
      }
  };

  const formatTime = (seconds: number) => {
      if (!seconds && seconds !== 0) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const togglePlayback = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (videoRef.current && activeItem) {
          if (isPlaying) {
              videoRef.current.pause();
          } else {
              // If we are outside the trim region, jump to start
              if (videoRef.current.currentTime >= activeItem.trim.end - 0.1 || videoRef.current.currentTime < activeItem.trim.start) {
                  videoRef.current.currentTime = activeItem.trim.start;
              }
              videoRef.current.play();
          }
          setIsPlaying(!isPlaying);
      }
  };

  const previewTrim = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (videoRef.current && activeItem) {
          videoRef.current.currentTime = activeItem.trim.start;
          videoRef.current.play();
          setIsPlaying(true);
      }
  };

  const handleGenerateMetadata = async () => {
    if (!activeItem) return;
    setIsGeneratingMetadata(true);
    const result = await generateVideoMetadata(activeItem.file.name, activeItem.file.size);
    updateQueueItem(activeItem.id, { 
        metadata: { ...activeItem.metadata, title: result.title || activeItem.file.name, description: result.description || '' },
        thumbnailPrompt: result.title || activeItem.thumbnailPrompt
    });
    setIsGeneratingMetadata(false);
  };

  const handleGenerateThumbnail = async () => {
    if (!activeItem || !activeItem.thumbnailPrompt) return;
    setIsGeneratingThumbnail(true);
    const result = await generateThumbnail(activeItem.thumbnailPrompt);
    if (result) {
        const blob = await (await fetch(result)).blob();
        updateQueueItem(activeItem.id, { thumbnail: result, thumbnailFile: new File([blob], 'generated-thumbnail.png', {type: blob.type || 'image/png'}) });
    }
    setIsGeneratingThumbnail(false);
  };

  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && activeItem) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          updateQueueItem(activeItem.id, { thumbnail: url, thumbnailFile: file });
      }
  };

  const startUploadQueue = async () => {
      if (isQueueProcessing) return;
      setIsQueueProcessing(true);
      await processQueueLoop();
      setIsQueueProcessing(false);
  };

  const processQueueLoop = async () => {
      let targetId: string | null = null;
      let targetItem: UploadItem | undefined;
      
      setQueue(prev => {
          const next = prev.find(i => i.status === 'idle' || i.status === 'pending');
          targetId = next ? next.id : null;
          targetItem = next;
          if (targetId) {
              return prev.map(i => i.id === targetId ? { ...i, status: 'pending' } : i);
          }
          return prev;
      });

      await new Promise(r => setTimeout(r, 0));

      if (!targetId || !targetItem) return;

      await uploadSingleItem(targetItem);
      await processQueueLoop();
  };

  const uploadSingleItem = async (item: UploadItem) => {
      if (item.metadata.contentRating === 'UNRATED') {
          updateQueueItem(item.id, { status: 'error', stageInfo: 'Choose a KFCB content rating before publishing.' });
          return;
      }
      const metadata = item.metadata;
      const episodic = metadata.category === 'Series' || metadata.category === 'Micro Dramas';
      if (episodic && (!metadata.seriesTitle.trim() || !metadata.seriesSynopsis.trim() || !metadata.seasonSynopsis.trim() || !metadata.episodeSynopsis.trim() || !/^[1-9]\d*$/.test(metadata.season) || !/^[1-9]\d*$/.test(metadata.episode))) {
          updateQueueItem(item.id, { status: 'error', stageInfo: 'Add series, season and episode synopses plus positive season/episode numbers.' });
          return;
      }
      const intro = metadata.introEndSeconds.trim();
      const outro = metadata.outroStartSeconds.trim();
      if (episodic && ([intro, outro].some(value => value && !/^[1-9]\d*$/.test(value)) || (intro && outro && Number(intro) >= Number(outro)) || [intro, outro].some(value => value && item.duration > 0 && Number(value) >= item.duration))) {
          updateQueueItem(item.id, { status: 'error', stageInfo: 'Intro/outro cue points must be positive seconds inside the episode.' });
          return;
      }
      updateQueueItem(item.id, { status: 'uploading', progress: 0, stageInfo: 'Initializing...' });

      try {
        // 1. Create Video Entry
        updateQueueItem(item.id, { stageInfo: 'Creating Entry...' });
        const videoEntry = await createVideoEntry(item.metadata.title || item.file.name);
        
        if (!videoEntry || !videoEntry.guid) {
            throw new Error("Failed to create video entry");
        }
        
        const videoId = videoEntry.guid;
        updateQueueItem(item.id, { videoId, stageInfo: 'Uploading File...' });

        // Store publication metadata before transfer. The public endpoint only
        // returns finished encodes, so a partially uploaded title stays hidden.
        const metaTags = [
          { property: 'description', value: item.metadata.description.trim() },
          { property: 'category', value: item.metadata.category || 'New Releases' },
          { property: 'contentRating', value: item.metadata.contentRating },
          { property: 'author', value: creatorName },
          { property: 'published', value: 'processing' },
          ...(episodic ? [
            { property: 'seriesTitle', value: metadata.seriesTitle.trim() },
            { property: 'seriesSynopsis', value: metadata.seriesSynopsis.trim() },
            { property: 'seasonSynopsis', value: metadata.seasonSynopsis.trim() },
            { property: 'episodeSynopsis', value: metadata.episodeSynopsis.trim() },
            { property: 'season', value: metadata.season },
            { property: 'episode', value: metadata.episode },
            { property: 'seriesFormat', value: metadata.category === 'Micro Dramas' ? 'micro-drama' : 'standard' },
            ...(intro ? [{ property: 'introEndSeconds', value: intro }] : []),
            ...(outro ? [{ property: 'outroStartSeconds', value: outro }] : []),
          ] : []),
        ];
        const saved = await updateVideoMetadata(videoId, {
          title: item.metadata.title || item.file.name,
          metaTags,
        });
        if (!saved) throw new Error('Could not save publication metadata. Review the draft in Admin.');

        // 2. Upload File (Bunny.net)
        const startTime = Date.now();
        await uploadVideoFile(item.file, videoId, (progress) => {
            // Update UI with real progress
            const elapsedTime = (Date.now() - startTime) / 1000; // seconds
            const uploadSpeed = progress / elapsedTime; // percent per second
            const remainingPercent = 100 - progress;
            const timeRemaining = uploadSpeed > 0 ? Math.ceil(remainingPercent / uploadSpeed) : 0;

            updateQueueItem(item.id, { progress, timeRemaining });
        });

        if (item.thumbnailFile) {
          const imageName = await uploadCustomThumbnail(videoId, item.thumbnailFile);
          if (!imageName) console.warn('Custom thumbnail upload failed; Bunny will use its generated thumbnail.');
        }

        updateQueueItem(item.id, {
          status: 'encoding', progress: 100, timeRemaining: 0,
          stageInfo: 'Encoding on Bunny. It will appear when ready.',
          thumbnail: getThumbnailUrl(videoId),
        });
        void (async () => {
          for (let attempt = 0; attempt < 180; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            const encoding = await getVideoStatus(videoId);
            if (encoding.status === 3) {
              updateQueueItem(item.id, { status: 'error', stageInfo: 'Bunny encoding failed. Review the video in Admin.' });
              return;
            }
            if (encoding.status !== 4) continue;
            updateQueueItem(item.id, { status: 'completed', stageInfo: 'Ready in the catalogue.' });
            window.dispatchEvent(new Event('tube-catalogue-change'));
            if (onUploadComplete) {
              onUploadComplete({
                id: videoId, title: item.metadata.title || item.file.name,
                description: item.metadata.description, thumbnail: getThumbnailUrl(videoId),
                url: getStreamUrl(videoId), duration: formatTime(item.duration), views: 0,
                isPremium: false, author: creatorName,
                category: item.metadata.category || 'New Releases',
                ...(episodic ? { seriesTitle: metadata.seriesTitle.trim(), seriesSynopsis: metadata.seriesSynopsis.trim(), seasonSynopsis: metadata.seasonSynopsis.trim(), episodeSynopsis: metadata.episodeSynopsis.trim(), season: Number(metadata.season), episode: Number(metadata.episode), seriesFormat: metadata.category === 'Micro Dramas' ? 'micro-drama' as const : 'standard' as const, introEndSeconds: intro ? Number(intro) : undefined, outroStartSeconds: outro ? Number(outro) : undefined } : {}),
                tags: [item.metadata.category || 'New'],
                contentRating: item.metadata.contentRating,
              });
            }
            return;
          }
          updateQueueItem(item.id, { stageInfo: 'Still encoding. Check this title in Admin later.' });
        })();

      } catch (error) {
        console.error("Upload Failed", error);
        updateQueueItem(item.id, { 
            status: 'error', 
            stageInfo: 'Upload Failed. Check console.', 
            progress: 0 
        });
      }
  };

  const removeItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setQueue(prev => prev.filter(i => i.id !== id));
      if (activeId === id) {
          setActiveId(null);
          setShowTrimTool(false);
      }
  };

  // derived state for overall queue status
  const pendingCount = queue.filter(i => i.status === 'idle' || i.status === 'pending').length;
  const isAllDone = queue.length > 0 && queue.every(i => i.status === 'completed');

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-zinc-950">
      {/* LEFT COLUMN: EDITOR / DROP ZONE */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-12 relative">
        <h1 className="text-3xl font-bold text-white mb-8">Upload Content</h1>
        <fieldset className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <legend className="px-2 text-sm font-semibold text-zinc-200">Choose an ingest path</legend>
          <div className="flex flex-wrap gap-2">
            {[['Originals', 'Film & other'], ['Series', 'Series · landscape'], ['Micro Dramas', 'Micro Dramas · portrait']].map(([value, label]) => <button key={value} type="button" aria-pressed={uploadKind === value} onClick={() => setUploadKind(value)} className={`rounded-full border px-4 py-2 text-sm ${uploadKind === value ? 'border-red-500 bg-red-950/40 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>{label}</button>)}
          </div>
          <p className="mt-3 text-xs text-zinc-400">New files use this path. Each queued episode keeps its own metadata so you can upload several at once.</p>
        </fieldset>

        {queue.length === 0 ? (
             <div 
                className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all duration-300 relative overflow-hidden
                    ${isDragging 
                        ? 'border-red-500 bg-red-500/10 scale-105' 
                        : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input 
                    type="file" 
                    accept="video/*,audio/*" 
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div className="flex flex-col items-center pointer-events-none">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors ${isDragging ? 'bg-red-500/20' : 'bg-zinc-800'}`}>
                        <UploadCloud className={`w-10 h-10 transition-colors ${isDragging ? 'text-red-500' : 'text-zinc-400'}`} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {isDragging ? 'Drop files here' : 'Drag and drop video or audio files'}
                    </h3>
                    <p className="text-zinc-400">Upload multiple videos or podcasts at once</p>
                    <div className={`mt-8 px-6 py-2 rounded-lg font-medium transition-colors ${isDragging ? 'bg-red-600' : 'bg-blue-600'} text-white`}>
                        Select Files
                    </div>
                </div>
            </div>
        ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* Add More Button Area */}
                <div 
                    className="border-2 border-dashed border-zinc-800 rounded-xl p-4 flex items-center justify-center gap-4 hover:bg-zinc-900 hover:border-zinc-600 transition-colors relative cursor-pointer"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                     <input 
                        type="file" 
                        accept="video/*,audio/*" 
                        multiple
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <UploadCloud className="text-zinc-500" />
                    <span className="text-zinc-400 font-medium">Drag & Drop to add more videos</span>
                </div>

                {/* EDITOR PANEL (If an item is selected) */}
                {activeItem ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                Editing: <span className="text-red-500 truncate max-w-[300px]">{activeItem.file.name}</span>
                            </h2>
                            {activeItem.status === 'uploading' && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded animate-pulse">
                                    Upload in progress...
                                </span>
                            )}
                        </div>

                        {/* Player / Preview */}
                        <div className="w-full bg-black rounded-xl overflow-hidden mb-6 shadow-2xl border border-zinc-700 relative group aspect-video">
                            <video 
                                ref={videoRef}
                                key={activeItem.id} // Force re-render on switch
                                src={activeItem.previewUrl} 
                                className="w-full h-full object-contain bg-black" 
                                onLoadedMetadata={handleLoadedMetadata}
                                onTimeUpdate={handleTimeUpdate}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onClick={togglePlayback}
                            />
                            
                            {/* Generated Thumbnail Overlay */}
                            {activeItem.thumbnail && (
                                <div className="absolute inset-0 z-10 bg-black">
                                    <img src={activeItem.thumbnail} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">Thumbnail Preview</div>
                                    <button 
                                        onClick={() => updateQueueItem(activeItem.id, { thumbnail: null })}
                                        className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md hover:bg-black/80 flex items-center gap-2 border border-zinc-700"
                                    >
                                        <RefreshCw size={12} /> Edit / Regenerate
                                    </button>
                                </div>
                            )}

                             {/* Playback Controls & Overlay */}
                            {!activeItem.thumbnail && (
                                <div className="absolute inset-0">
                                    {!isPlaying && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30 shadow-xl group-hover:scale-110 transition-transform">
                                                <Play className="w-8 h-8 text-white ml-1" fill="white" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="flex items-center gap-3">
                                            <button onClick={togglePlayback} className="text-white hover:text-red-500 transition-colors p-1">
                                                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                            </button>
                                            <span className="text-xs text-zinc-300 font-mono font-medium">
                                                {formatTime(currentTime)} / {formatTime(activeItem.duration)}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => setShowTrimTool(!showTrimTool)}
                                            className={`p-2 rounded-full transition-all ${showTrimTool ? 'bg-red-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                            title="Trim Video"
                                            disabled={activeItem.status === 'uploading' || activeItem.status === 'completed'}
                                        >
                                            <Scissors size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                         {/* Trim Tool */}
                        {showTrimTool && activeItem.duration > 0 && (
                            <div className="bg-zinc-800/50 p-4 rounded-xl mb-6 border border-zinc-700">
                                <div className="flex justify-between items-center text-xs text-zinc-400 mb-2 font-mono">
                                    <span>Start: {formatTime(activeItem.trim.start)}</span>
                                     <button onClick={previewTrim} className="flex items-center gap-1 text-red-400 hover:text-red-300">
                                        <Repeat size={12} /> Preview Trim
                                    </button>
                                    <span>End: {formatTime(activeItem.trim.end)}</span>
                                </div>
                                <div className="relative h-10 bg-zinc-700 rounded-md cursor-pointer select-none overflow-hidden" ref={sliderRef}>
                                    <div className="absolute top-0 bottom-0 left-0 bg-black/60 z-10" style={{ width: `${(activeItem.trim.start / activeItem.duration) * 100}%` }} />
                                    <div className="absolute top-0 bottom-0 right-0 bg-black/60 z-10" style={{ width: `${100 - (activeItem.trim.end / activeItem.duration) * 100}%` }} />
                                    <div className="absolute top-0 bottom-0 bg-red-500/10 border-t-2 border-b-2 border-red-500 z-0" style={{ left: `${(activeItem.trim.start / activeItem.duration) * 100}%`, right: `${100 - (activeItem.trim.end / activeItem.duration) * 100}%` }} />
                                    <div 
                                        className="absolute top-0 bottom-0 w-6 bg-white rounded-l cursor-ew-resize flex items-center justify-center z-20"
                                        style={{ left: `${(activeItem.trim.start / activeItem.duration) * 100}%`, transform: 'translateX(-50%)' }}
                                        onMouseDown={(e) => { e.stopPropagation(); setActiveDrag('start'); }}
                                    >
                                        <div className="w-1 h-5 bg-zinc-400 rounded-full" />
                                    </div>
                                    <div 
                                        className="absolute top-0 bottom-0 w-6 bg-white rounded-r cursor-ew-resize flex items-center justify-center z-20"
                                        style={{ left: `${(activeItem.trim.end / activeItem.duration) * 100}%`, transform: 'translateX(-50%)' }}
                                        onMouseDown={(e) => { e.stopPropagation(); setActiveDrag('end'); }}
                                    >
                                        <div className="w-1 h-5 bg-zinc-400 rounded-full" />
                                    </div>
                                </div>
                                <div className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Note: Trimming will be applied during transcoding on the server.
                                </div>
                            </div>
                        )}

                        {/* Metadata Inputs */}
                        <div className="space-y-4">
                             <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-white">Video Details</h3>
                            </div>
                            
                            <button 
                                onClick={handleGenerateMetadata}
                                disabled={isGeneratingMetadata || (activeItem.status !== 'idle' && activeItem.status !== 'pending')}
                                className="w-full flex items-center justify-center gap-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/50 text-purple-300 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {isGeneratingMetadata ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Generating Metadata...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span>Auto-generate Title & Description</span>
                                    </>
                                )}
                            </button>

                            <input 
                                type="text" 
                                value={activeItem.metadata.title}
                                onChange={(e) => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, title: e.target.value } })}
                                placeholder="Title"
                                disabled={activeItem.status === 'completed'}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeItem.metadata.category === 'Micro Dramas' && <aside className="md:col-span-2 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-zinc-300"><strong className="block text-white">Micro Drama ingest</strong><p className="mt-2">Use portrait (9:16) video and episode-specific artwork. Complete the story and episode fields below before uploading.</p></aside>}
                                {activeItem.metadata.category === 'Series' && <aside className="md:col-span-2 rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 text-sm text-zinc-300"><strong className="block text-white">Series ingest</strong><p className="mt-2">Use landscape (16:9) video and artwork. Give every episode a unique number within its season and the same series title.</p></aside>}
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1 ml-1">Category</label>
                                    <div className="relative">
                                        <select
                                            value={activeItem.metadata.category}
                                            onChange={(e) => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, category: e.target.value } })}
                                            disabled={activeItem.status === 'completed'}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 appearance-none"
                                        >
                                            {CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none text-zinc-400">
                                            <Tag size={16} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1 ml-1">KFCB content rating</label>
                                    <select
                                        required
                                        value={activeItem.metadata.contentRating}
                                        onChange={(e) => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, contentRating: e.target.value as ContentRating } })}
                                        disabled={activeItem.status === 'completed'}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
                                    >
                                        <option value="UNRATED">Select a rating</option>
                                        <option value="GE">GE - General Exhibition</option>
                                        <option value="PG">PG - Parental Guidance</option>
                                        <option value="16">16 - Not suitable under 16</option>
                                        <option value="18">18 - Adults only</option>
                                    </select>
                                </div>
                            </div>

                            {(activeItem.metadata.category === 'Series' || activeItem.metadata.category === 'Micro Dramas') && (
                              <fieldset className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
                                <legend className="px-2 text-sm font-semibold text-white">{activeItem.metadata.category === 'Series' ? 'Series episode details' : 'Micro Drama episode details'}</legend>
                                <div className="grid gap-4 md:grid-cols-3">
                                  <label className="md:col-span-3 text-xs text-zinc-300">Series title
                                    <input required value={activeItem.metadata.seriesTitle} onChange={e => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, seriesTitle: e.target.value } })} disabled={activeItem.status === 'completed'} placeholder="The name shared by every episode" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white" />
                                  </label>
                                  <label className="text-xs text-zinc-300">Season
                                    <input required type="number" min="1" step="1" value={activeItem.metadata.season} onChange={e => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, season: e.target.value } })} disabled={activeItem.status === 'completed'} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white" />
                                  </label>
                                  <label className="text-xs text-zinc-300">Episode
                                    <input required type="number" min="1" step="1" value={activeItem.metadata.episode} onChange={e => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, episode: e.target.value } })} disabled={activeItem.status === 'completed'} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white" />
                                  </label>
                                </div>
                                {([['seriesSynopsis', 'Series synopsis', 'The overall premise, without later-season spoilers'], ['seasonSynopsis', 'Season summary', 'What this season is about'], ['episodeSynopsis', 'Episode synopsis', 'A brief, spoiler-conscious episode description']] as const).map(([key, label, placeholder]) => <label key={key} className="block text-xs text-zinc-300">{label}
                                  <textarea required rows={2} value={activeItem.metadata[key]} onChange={e => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, [key]: e.target.value } })} disabled={activeItem.status === 'completed'} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white" />
                                </label>)}
                                <div className="grid gap-4 md:grid-cols-2">
                                  {([['introEndSeconds', 'Intro ends at · seconds'], ['outroStartSeconds', 'Outro starts at · seconds']] as const).map(([key, label]) => <label key={key} className="text-xs text-zinc-300">{label}
                                    <input type="number" min="1" step="1" value={activeItem.metadata[key]} onChange={e => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, [key]: e.target.value } })} disabled={activeItem.status === 'completed'} placeholder="Optional" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white" />
                                  </label>)}
                                </div>
                                <p className="text-xs text-zinc-400">Cue points are optional. Verify them against the final encoded episode before publishing.</p>
                              </fieldset>
                            )}

                            <textarea 
                                rows={3}
                                value={activeItem.metadata.description}
                                onChange={(e) => updateQueueItem(activeItem.id, { metadata: { ...activeItem.metadata, description: e.target.value } })}
                                placeholder="Description"
                                disabled={activeItem.status === 'completed'}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                            />
                            
                            {/* Thumbnail */}
                             <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                                 <label className="block text-xs text-zinc-400 mb-2 ml-1">Thumbnail</label>
                                 <div className="flex gap-2 flex-wrap">
                                     <input 
                                        type="text" 
                                        value={activeItem.thumbnailPrompt}
                                        onChange={(e) => updateQueueItem(activeItem.id, { thumbnailPrompt: e.target.value })}
                                        placeholder="Prompt for thumbnail generation..."
                                        className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white"
                                     />
                                     <button 
                                        onClick={handleGenerateThumbnail}
                                        disabled={isGeneratingThumbnail || !activeItem.thumbnailPrompt || activeItem.status !== 'idle' && activeItem.status !== 'pending'}
                                        className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded disabled:opacity-50 flex items-center gap-2 text-sm"
                                        title="Generate with AI"
                                     >
                                         {isGeneratingThumbnail ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                         <span className="hidden sm:inline">AI Generate</span>
                                     </button>

                                     {/* Custom Upload */}
                                     <button 
                                        onClick={() => thumbnailInputRef.current?.click()}
                                        className="bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded flex items-center gap-2 text-sm"
                                        title="Upload Custom Image"
                                     >
                                         <ImagePlus size={16} />
                                         <span className="hidden sm:inline">Upload</span>
                                     </button>
                                     <input 
                                        type="file" 
                                        ref={thumbnailInputRef}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleCustomThumbnailUpload}
                                     />
                                 </div>
                             </div>
                        </div>

                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-zinc-500 border border-zinc-800 rounded-2xl bg-zinc-900/20">
                        <ListVideo size={48} className="mb-4 opacity-50" />
                        <p>Select a video from the queue to edit details</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* RIGHT COLUMN: QUEUE LIST */}
      <div className="w-full lg:w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col h-[40vh] lg:h-screen shadow-2xl z-10">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
              <h2 className="text-white font-bold flex items-center justify-between">
                  <span>Upload Queue</span>
                  <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{queue.length} Videos</span>
              </h2>
              {queue.length > 0 && !isAllDone && (
                  <button 
                    onClick={startUploadQueue}
                    disabled={isQueueProcessing || pendingCount === 0}
                    className="w-full mt-4 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                      {isQueueProcessing ? (
                          <>
                            <Loader2 className="animate-spin" /> Processing Queue...
                          </>
                      ) : (
                          <>
                            <UploadCloud size={18} /> Start All Uploads
                          </>
                      )}
                  </button>
              )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {queue.length === 0 && (
                  <div className="text-center py-10 text-zinc-600">
                      <p className="text-sm">Queue is empty.</p>
                      <p className="text-xs mt-1">Add videos to start.</p>
                  </div>
              )}

              {queue.map((item) => {
                  const isActive = activeId === item.id;
                  const isUploading = item.status === 'uploading';
                  const isDone = item.status === 'completed';
                  const isError = item.status === 'error';

                  return (
                      <div 
                        key={item.id}
                        onClick={() => setActiveId(item.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden group
                            ${isActive ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'}
                        `}
                      >
                          {/* Progress bar background for active upload */}
                          {isUploading && (
                              <div 
                                className="absolute bottom-0 left-0 h-1 bg-red-600 transition-all duration-300" 
                                style={{ width: `${item.progress}%` }}
                              />
                          )}

                          <div className="flex gap-3">
                              {/* Thumbnail */}
                              <div className="w-16 h-16 bg-black rounded overflow-hidden flex-shrink-0 relative self-center">
                                  {item.thumbnail ? (
                                      <img src={item.thumbnail} className="w-full h-full object-cover" />
                                  ) : (
                                      <video src={item.previewUrl} className="w-full h-full object-cover opacity-50" />
                                  )}
                                  
                                  {/* Status Icon Overlay */}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      {isDone && <CheckCircle2 size={24} className="text-green-500" />}
                                      {isError && <AlertCircle size={24} className="text-red-500" />}
                                      {isUploading && (
                                          <div className="text-xs font-bold text-white bg-black/50 px-1 rounded">
                                              {Math.round(item.progress)}%
                                          </div>
                                      )}
                                      {!isDone && !isUploading && !isError && item.status === 'pending' && (
                                          <Clock size={20} className="text-orange-400" />
                                      )}
                                  </div>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <h4 className={`text-sm font-medium truncate mb-1 ${isDone ? 'text-green-500' : 'text-white'}`}>
                                      {item.metadata.title || item.file.name}
                                  </h4>
                                  
                                  {/* Detailed Status Text */}
                                  <div className="text-xs text-zinc-500 space-y-0.5">
                                      <div className="flex items-center justify-between">
                                          <span className="flex items-center gap-1">
                                            {isUploading ? item.stageInfo : 
                                             item.status === 'encoding' ? item.stageInfo :
                                             isDone ? 'Ready' :
                                             isError ? 'Failed' : 
                                             item.status === 'pending' ? 'Waiting...' : 
                                             item.metadata.category}
                                          </span>
                                      </div>
                                      
                                      {isUploading && item.timeRemaining !== undefined && (
                                          <div className="flex items-center gap-1 text-zinc-400">
                                              <Timer size={10} />
                                              <span>{item.timeRemaining}s remaining</span>
                                          </div>
                                      )}
                                      {isError && <button type="button" onClick={event => { event.stopPropagation(); updateQueueItem(item.id, { status: 'idle', stageInfo: undefined }); }} className="mt-2 rounded border border-red-700 px-2 py-1 text-red-300 hover:bg-red-950">Retry after editing details</button>}
                                  </div>
                              </div>

                              {/* Remove Action */}
                              {!isUploading && !isDone && (
                                  <button 
                                    onClick={(e) => removeItem(item.id, e)}
                                    className="text-zinc-600 hover:text-red-500 transition-colors p-1 self-start"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              )}
                          </div>
                      </div>
                  )
              })}
          </div>
      </div>
    </div>
  );
};

export default UploadSection;

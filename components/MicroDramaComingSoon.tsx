import React from 'react';
import { ArrowRight, Smartphone } from 'lucide-react';

export default function MicroDramaComingSoon({ compact = false, onExplore, onMovies, onSeries }: { compact?: boolean; onExplore?: () => void; onMovies?: () => void; onSeries?: () => void }) {
  return <section className={`micro-launch ${compact ? 'micro-launch-compact' : ''}`} aria-label="Micro Dramas coming soon">
    <div className="micro-launch-copy"><p className="cinema-eyebrow">MICRO DRAMAS <span>COMING SOON</span></p>
      <h2>Small episodes.<br /><em>Big stories.</em></h2>
      <p>{compact ? 'A new chapter for TubeTV. Vertical, episodic storytelling made for the moments in between. Our first micro dramas are on the way.' : 'Vertical episodes made for the moments in between. Our first stories are on the way.'}</p>
      {onExplore ? <button className="cinema-secondary" onClick={onExplore}>What are Micro Dramas? <ArrowRight size={15} /></button> : <><p className="micro-launch-note">No episodes have launched yet. Explore Movies or Series now.</p>{(onMovies || onSeries) && <div className="micro-launch-alternatives">{onMovies && <button onClick={onMovies}>Explore Movies <ArrowRight size={14} /></button>}{onSeries && <button onClick={onSeries}>Explore Series <ArrowRight size={14} /></button>}</div>}</>}
    </div>
    <div className="micro-launch-art" aria-hidden="true"><div className="micro-frame micro-frame-back" /><div className="micro-frame"><Smartphone size={32} strokeWidth={1} /><span>SHORTER.<br />BOLDER.<br /><em>CLOSER.</em></span><small>THE NEXT CHAPTER</small></div></div>
  </section>;
}

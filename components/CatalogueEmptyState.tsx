import React from 'react';
import { ArrowRight, Search } from 'lucide-react';

export default function CatalogueEmptyState({ search, subcategory, onClearSearch, onShowAll, onBrowse }: {
  search: string; subcategory: string; onClearSearch: () => void; onShowAll: () => void; onBrowse: () => void;
}) {
  const searching = Boolean(search.trim());
  const filtered = !searching && subcategory !== 'All';
  return <section className="catalogue-empty" aria-label="No catalogue results">
    <Search size={24} strokeWidth={1.4} aria-hidden="true" />
    <p className="cinema-card-kicker">{searching ? 'NO MATCHES' : filtered ? 'MORE TO DISCOVER' : 'NEW STORIES AHEAD'}</p>
    <h2>{searching ? 'A different story awaits.' : filtered ? `No ${subcategory} titles here yet.` : 'This collection is growing.'}</h2>
    <p>{searching ? 'Try a title, creator or broader keyword.' : filtered ? 'See everything in this section, or explore another part of TubeTV.' : 'Explore the rest of TubeTV while new titles are added.'}</p>
    <div className="catalogue-empty-actions">
      {searching ? <button className="cinema-primary" onClick={onClearSearch}>Clear search <ArrowRight size={15} /></button> : filtered ? <button className="cinema-primary" onClick={onShowAll}>Show all titles <ArrowRight size={15} /></button> : null}
      <button className="cinema-secondary" onClick={onBrowse}>Explore TubeTV</button>
    </div>
  </section>;
}

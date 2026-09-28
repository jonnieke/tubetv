import React, { useEffect, useState } from 'react';

/** Keep artwork geometry stable if the catalogue's image host is unavailable. */
export default function CatalogueArtwork({ src, className, priority = false }: { src: string; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed || !src) return <div aria-hidden="true" className={`cinema-artwork-fallback ${className || ''}`} />;
  return <img src={src} alt="" className={className} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailed(true)} />;
}

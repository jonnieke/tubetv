import React, { useEffect, useRef, useState } from 'react';

/** Keep artwork geometry stable and load lazily with async decoding and shimmer placeholder. */
export default function CatalogueArtwork({ src, className, priority = false }: { src: string; className?: string; priority?: boolean }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    const el = imgRef.current;
    setLoaded(Boolean(el && el.complete && el.naturalWidth > 0));
  }, [src]);

  if (failed || !src) return <div aria-hidden="true" className={`cinema-artwork-fallback ${className || ''}`} />;

  const shimmerClass = !loaded && !priority ? 'cinema-artwork-loading' : '';
  const combinedClass = [shimmerClass, className].filter(Boolean).join(' ');

  return (
    <img
      ref={imgRef}
      src={src}
      alt=""
      className={combinedClass || undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

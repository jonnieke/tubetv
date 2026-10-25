import React, { useEffect, useState } from 'react';

/** Keep artwork geometry stable and render images asynchronously without main-thread jank. */
export default function CatalogueArtwork({
  src,
  className,
  priority = false,
  alt = '',
}: {
  src: string;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (failed || !src) return <div aria-hidden="true" className={`cinema-artwork-fallback ${className || ''}`} />;

  return (
    <img
      src={src}
      alt={alt}
      className={`${className || ''} ${loaded ? 'opacity-100' : 'opacity-90'} transition-opacity duration-200`}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

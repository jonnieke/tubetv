import React, { useRef, useState, useEffect } from 'react';

/**
 * Defers rendering its children until the placeholder enters the viewport.
 * Carousels below the fold are not rendered (or fetched) until the user
 * scrolls close — saves CPU, layout work, and image requests on first load.
 *
 * Usage:
 *   <LazySection>
 *     <VideoCarousel ... />
 *   </LazySection>
 */
interface Props {
  children: React.ReactNode;
  /** How many px before the viewport edge to start rendering. Default 300. */
  rootMargin?: string;
  /** Minimum height placeholder while the section hasn't entered view. */
  placeholderHeight?: string;
}

const LazySection: React.FC<Props> = ({
  children,
  rootMargin = '300px',
  placeholderHeight = '200px',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // only need to trigger once
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={!visible ? { minHeight: placeholderHeight } : undefined}>
      {visible ? children : null}
    </div>
  );
};

export default LazySection;

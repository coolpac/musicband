import { memo, useEffect, useRef, useState } from 'react';
import './OptimizedImage.css';

export interface OptimizedImageProps {
  /** Fallback original URL */
  src: string;
  srcSet?: { webp?: string; avif?: string };
  alt: string;
  width?: number;
  height?: number;
  /** default '100vw' */
  sizes?: string;
  /** default 'lazy' */
  loading?: 'lazy' | 'eager';
  className?: string;
  objectFit?: 'cover' | 'contain';
}

const LAZY_ROOT_MARGIN = '200px';

function OptimizedImageComponent({
  src,
  srcSet,
  alt,
  width,
  height,
  sizes = '100vw',
  loading = 'lazy',
  className = '',
  objectFit,
}: OptimizedImageProps) {
  const [isInView, setIsInView] = useState(loading === 'eager');
  const [isLoaded, setIsLoaded] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (loading === 'eager') {
      setIsInView(true);
      return;
    }
    const el = wrapperRef.current;
    if (!el) return;

    const supportsNativeLazy = 'loading' in HTMLImageElement.prototype;
    if (supportsNativeLazy) {
      setIsInView(true);
      return;
    }

    ioRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsInView(true);
        });
      },
      { rootMargin: LAZY_ROOT_MARGIN }
    );
    ioRef.current.observe(el);

    return () => {
      ioRef.current?.disconnect();
      ioRef.current = null;
    };
  }, [loading]);

  const webp = srcSet?.webp;
  const avif = srcSet?.avif;
  const showPlaceholder = !isLoaded && isInView;
  const wrapperClass = [
    'optimized-image',
    className,
    !isLoaded && isInView ? 'optimized-image--loading' : '',
    isLoaded ? 'optimized-image--loaded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const imgStyle = objectFit ? { objectFit } : undefined;

  return (
    <span ref={wrapperRef} className={wrapperClass}>
      {showPlaceholder && <span className="optimized-image__placeholder" aria-hidden />}
      {isInView ? (
        <picture>
          {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
          {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
          <img
            src={src}
            alt={alt}
            loading={loading}
            width={width}
            height={height}
            sizes={sizes}
            style={imgStyle}
            onLoad={() => setIsLoaded(true)}
            decoding="async"
          />
        </picture>
      ) : (
        <span style={{ display: 'block', minHeight: height ? `${height}px` : 1, minWidth: width ? `${width}px` : 1 }} aria-hidden />
      )}
    </span>
  );
}

export const OptimizedImage = memo(OptimizedImageComponent);

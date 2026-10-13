import { Link } from '../../router/Router';
import wordmarkUrl from '../../assets/header/logo-wordmark.svg';
import './Logo.css';

interface LogoProps {
  className?: string;
  /**
   * `wordmark` — the exported «ВГУЛ» glyph set, white, as in the header bar (Figma 393:1210).
   * `lockup` — red rounded square with «В» plus the typeset wordmark, as in the footer (Figma 345:1454).
   */
  variant?: 'lockup' | 'wordmark';
}

/**
 * The brand mark. Figma uses two treatments: the header carries the custom-glyph wordmark
 * (an exported SVG, never redrawn), the footer carries the live-text lock-up.
 * The wordmark is the trademark itself, so it is a constant, not admin-editable copy.
 */
export function Logo({ className, variant = 'lockup' }: LogoProps) {
  const cls = ['site-logo', variant === 'wordmark' ? 'site-logo--wordmark' : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <Link to="/" className={cls} aria-label="ВГУЛ — на главную">
      {variant === 'wordmark' ? (
        <img className="site-logo__img" src={wordmarkUrl} width={103} height={27} alt="" decoding="async" />
      ) : (
        <>
          <span className="site-logo__mark" aria-hidden="true">
            В
          </span>
          <span className="site-logo__word">ВГУЛ</span>
        </>
      )}
    </Link>
  );
}

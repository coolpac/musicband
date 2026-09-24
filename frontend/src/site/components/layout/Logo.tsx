import { Link } from '../../router/Router';
import './Logo.css';

interface LogoProps {
  className?: string;
}

/**
 * The brand lock-up: a red rounded square carrying «В» plus the «ВГУЛ» wordmark
 * (Figma 345:1454 / 355:2415). Both glyph sets are live text in Unbounded — the design
 * contains no exported logo asset, and the spec forbids redrawing one by hand.
 * The wordmark is the trademark itself, so it is a constant, not admin-editable copy.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Link to="/" className={className ? `site-logo ${className}` : 'site-logo'} aria-label="ВГУЛ — на главную">
      <span className="site-logo__mark" aria-hidden="true">
        В
      </span>
      <span className="site-logo__word">ВГУЛ</span>
    </Link>
  );
}

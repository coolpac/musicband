import { Link } from '../../router/Router';
import wordmarkUrl from '../../assets/header/logo-wordmark.svg';
import './Logo.css';

interface LogoProps {
  className?: string;
}

/**
 * The brand mark: the band's own «ВГУЛ» glyph set (exported SVG, never redrawn), white, as in the
 * Figma header bar (393:1210). The footer uses the same mark — the owner replaced the red-square
 * «В» lock-up drawn there with the real logo. It is the trademark itself, so it is a constant,
 * not admin-editable copy.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Link to="/" className={['site-logo', className ?? ''].filter(Boolean).join(' ')} aria-label="ВГУЛ — на главную">
      <img className="site-logo__img" src={wordmarkUrl} width={103} height={27} alt="" decoding="async" />
    </Link>
  );
}

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from '../../router/Router';
import './Button.css';

type Variant = 'primary' | 'outline' | 'light' | 'ghost';
type Size = 'sm' | 'md' | 'lg';
type Shape = 'pill' | 'rounded';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** `pill` everywhere; `rounded` (20px) only for full-width buttons inside form cards, as in Figma. */
  shape?: Shape;
  block?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

type AsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { to?: undefined; href?: undefined };
type AsLink = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> & { to: string; href?: undefined };
type AsAnchor = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string; to?: undefined };

export type ButtonProps = AsButton | AsLink | AsAnchor;

function classes({ variant = 'primary', size = 'md', shape = 'pill', block, loading }: CommonProps, extra?: string): string {
  return [
    'site-btn',
    `site-btn--${variant}`,
    `site-btn--${size}`,
    `site-btn--${shape}`,
    block ? 'site-btn--block' : '',
    loading ? 'is-loading' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * One button for the whole site. Renders <Link> (`to`), <a> (`href`, external/download) or <button>.
 * Navigation is always a real link — never a <button onClick={navigate}> — so it is crawlable
 * and works with middle-click and without JS.
 */
export function Button(props: ButtonProps) {
  const { variant, size, shape, block, loading, iconLeft, iconRight, children, className, ...rest } = props as CommonProps & {
    className?: string;
    to?: string;
    href?: string;
  };
  const cls = classes({ variant, size, shape, block, loading, children }, className);
  const content = (
    <>
      {iconLeft ? <span className="site-btn__icon" aria-hidden="true">{iconLeft}</span> : null}
      <span className="site-btn__label">{children}</span>
      {iconRight ? <span className="site-btn__icon" aria-hidden="true">{iconRight}</span> : null}
      {loading ? <span className="site-btn__spinner" aria-hidden="true" /> : null}
    </>
  );

  if (typeof rest.to === 'string') {
    const { to, ...linkRest } = rest as AsLink;
    return (
      <Link to={to} className={cls} {...linkRest}>
        {content}
      </Link>
    );
  }
  if (typeof rest.href === 'string') {
    const anchorRest = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    const external = /^https?:/i.test(anchorRest.href ?? '');
    return (
      <a className={cls} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...anchorRest}>
        {content}
      </a>
    );
  }
  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={cls} aria-busy={loading || undefined} {...buttonRest} disabled={buttonRest.disabled || loading}>
      {content}
    </button>
  );
}

import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

type Variant = 'up' | 'fade' | 'scale' | 'left' | 'right';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: Variant;
  /** Position in a group: each step delays the entrance by --stagger (70ms). Keep ≤ 6. */
  index?: number;
  children?: ReactNode;
}

/**
 * Marks an element for scroll-reveal. Renders identical markup on server and client
 * (no hydration mismatch); visibility is driven entirely by CSS + motion/reveal.ts.
 *
 * DO NOT wrap the hero image or anything else that is the LCP element: an element held at
 * opacity:0 until JS boots delays Largest Contentful Paint. Use CSS keyframes there instead.
 */
export function Reveal({ as: Tag = 'div', variant = 'up', index = 0, style, children, ...rest }: RevealProps) {
  const merged = index ? ({ ...style, '--reveal-index': index } as CSSProperties) : style;
  return (
    <Tag data-reveal={variant} style={merged} {...rest}>
      {children}
    </Tag>
  );
}

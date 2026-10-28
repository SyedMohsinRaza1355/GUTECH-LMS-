// GU TECH logo (Ghazali University School of Technology), served from /public.
// tone="white" is for crimson / dark backgrounds, tone="crimson" for white backgrounds.
import React from 'react';
import { cn } from '../../lib/utils.js';

const SIZES = { lockup: [591, 189], wordmark: [590, 127], mark: [213, 127] } as const;

export const Logo: React.FC<{
  variant?: keyof typeof SIZES;
  tone?: 'white' | 'crimson';
  className?: string;
  alt?: string;
  decorative?: boolean;
}> = ({ variant = 'wordmark', tone = 'crimson', className, alt = 'GU TECH - Ghazali University School of Technology', decorative = false }) => {
  const [width, height] = SIZES[variant];
  return (
    <img
      src={`/logo-${variant}-${tone}.png`}
      width={width}
      height={height}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn('select-none object-contain', className)}
    />
  );
};

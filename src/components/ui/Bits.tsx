import React from 'react';

/* Playful flat-bold SVG "toy" objects used as decorative stickers across the site. */

interface BitProps {
  className?: string;
}

export const ControllerBit: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 64 44" className={className} aria-hidden="true">
    <rect x="2" y="6" width="60" height="32" rx="16" fill="#6C4CF1" />
    <rect x="2" y="6" width="60" height="32" rx="16" fill="none" stroke="#26202B" strokeWidth="2.5" />
    <rect x="12" y="17" width="14" height="5" rx="2.5" fill="#FFFCF6" />
    <rect x="16.5" y="12.5" width="5" height="14" rx="2.5" fill="#FFFCF6" />
    <circle cx="45" cy="16" r="4" fill="#FF5A3C" />
    <circle cx="52" cy="23" r="4" fill="#FFC53D" />
    <circle cx="38" cy="23" r="4" fill="#A8D92C" />
    <circle cx="45" cy="30" r="4" fill="#2FB9DD" />
  </svg>
);

export const CartridgeBit: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 44 52" className={className} aria-hidden="true">
    <rect x="3" y="3" width="38" height="46" rx="6" fill="#FF5A3C" />
    <rect x="3" y="3" width="38" height="46" rx="6" fill="none" stroke="#26202B" strokeWidth="2.5" />
    <rect x="9" y="10" width="26" height="18" rx="3" fill="#FFFCF6" />
    <circle cx="22" cy="19" r="5" fill="#FFC53D" />
    <rect x="12" y="34" width="20" height="4" rx="2" fill="#26202B" opacity="0.35" />
    <rect x="12" y="41" width="14" height="4" rx="2" fill="#26202B" opacity="0.35" />
  </svg>
);

export const CoinBit: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="#FFC53D" />
    <circle cx="20" cy="20" r="17" fill="none" stroke="#26202B" strokeWidth="2.5" />
    <circle cx="20" cy="20" r="10.5" fill="none" stroke="#26202B" strokeWidth="2" opacity="0.5" />
    <path d="M20 13.5l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" fill="#26202B" />
  </svg>
);

export const DiceBit: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <rect x="3" y="3" width="34" height="34" rx="8" fill="#FFFCF6" />
    <rect x="3" y="3" width="34" height="34" rx="8" fill="none" stroke="#26202B" strokeWidth="2.5" />
    <circle cx="13" cy="13" r="3.4" fill="#6C4CF1" />
    <circle cx="27" cy="13" r="3.4" fill="#6C4CF1" />
    <circle cx="20" cy="20" r="3.4" fill="#FF5A3C" />
    <circle cx="13" cy="27" r="3.4" fill="#6C4CF1" />
    <circle cx="27" cy="27" r="3.4" fill="#6C4CF1" />
  </svg>
);

export const TrophyBit: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 40 44" className={className} aria-hidden="true">
    <path d="M10 4h20v10a10 10 0 01-20 0V4z" fill="#FFC53D" stroke="#26202B" strokeWidth="2.5" />
    <path d="M10 7H5a6 6 0 006 8M30 7h5a6 6 0 01-6 8" fill="none" stroke="#26202B" strokeWidth="2.5" />
    <rect x="17" y="23" width="6" height="8" fill="#FFC53D" stroke="#26202B" strokeWidth="2.5" />
    <rect x="11" y="31" width="18" height="6" rx="3" fill="#6C4CF1" stroke="#26202B" strokeWidth="2.5" />
    <path d="M20 8l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z" fill="#26202B" />
  </svg>
);

export const JoystickBit: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 40 48" className={className} aria-hidden="true">
    <rect x="6" y="30" width="28" height="14" rx="7" fill="#2FB9DD" stroke="#26202B" strokeWidth="2.5" />
    <rect x="17.5" y="14" width="5" height="18" rx="2.5" fill="#26202B" />
    <circle cx="20" cy="11" r="8" fill="#FF5A3C" stroke="#26202B" strokeWidth="2.5" />
    <circle cx="17" cy="8.5" r="2.4" fill="#FFFCF6" opacity="0.85" />
  </svg>
);

export const StarSticker: React.FC<BitProps> = ({ className = '' }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <path
      d="M20 2l4.6 9.9 10.9 1.3-8 7.5 2.1 10.8L20 26.2l-9.6 5.3 2.1-10.8-8-7.5 10.9-1.3z"
      fill="#FFC53D"
      stroke="#26202B"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const HeartBit: React.FC<BitProps & { filled?: boolean }> = ({ className = '', filled = true }) => (
  <svg viewBox="0 0 40 36" className={className} aria-hidden="true">
    <path
      d="M20 33S3 22.5 3 12.2C3 6.6 7.4 2.5 12.6 2.5c3.1 0 5.9 1.5 7.4 4 1.5-2.5 4.3-4 7.4-4C32.6 2.5 37 6.6 37 12.2 37 22.5 20 33 20 33z"
      fill={filled ? '#FF5A3C' : 'none'}
      stroke="#26202B"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

export const Squiggle: React.FC<BitProps & { color?: string }> = ({ className = '', color = '#FF5A3C' }) => (
  <svg viewBox="0 0 220 14" className={className} preserveAspectRatio="none" aria-hidden="true">
    <path
      d="M3 10c18-8 30 6 48-2s30 6 48-2 30 6 48-2 30 6 48-2 22 4 22 4"
      fill="none"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
    />
  </svg>
);

/* A small cluster of floating toy objects for section corners */
export const FloatingBits: React.FC<{ variant?: 'a' | 'b' | 'c'; className?: string }> = ({
  variant = 'a',
  className = ''
}) => {
  if (variant === 'b') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <CoinBit className="w-10 animate-float" />
        <DiceBit className="w-9 mt-6 ml-10 animate-float-slow" />
      </div>
    );
  }
  if (variant === 'c') {
    return (
      <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
        <TrophyBit className="w-10 animate-bob" />
        <CartridgeBit className="w-9 mt-4 -ml-6 animate-float-slow" />
      </div>
    );
  }
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <ControllerBit className="w-14 animate-float" />
      <StarSticker className="w-8 mt-3 ml-8 animate-wiggle" />
    </div>
  );
};

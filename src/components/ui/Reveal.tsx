import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}

/** Scroll-reveal wrapper: fast, smooth, purposeful. */
export const Reveal: React.FC<RevealProps> = ({ children, delay = 0, y = 26, className = '', once = true }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

interface StickerProps {
  children: React.ReactNode;
  className?: string;
  rotate?: number;
}

/** A playful hard-shadow sticker/badge. */
export const Sticker: React.FC<StickerProps> = ({ children, className = '', rotate = -2 }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sticker-sm ${className}`}
    style={{ transform: `rotate(${rotate}deg)` }}
  >
    {children}
  </span>
);

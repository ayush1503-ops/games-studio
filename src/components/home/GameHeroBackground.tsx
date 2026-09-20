import React from 'react';

interface GameHeroBackgroundProps {
  className?: string;
}

export const GameHeroBackground: React.FC<GameHeroBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {/* Dark tech grid */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      
      {/* Scanlines overlay */}
      <div className="absolute inset-0 scanlines opacity-40 mix-blend-overlay" />
      
      {/* Subtle vignette/gradient to blend with content */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090a0d] via-transparent to-[#090a0d]/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090a0d] via-transparent to-[#090a0d]/80" />
      
      {/* Game aesthetic glowing accents */}
      <div className="absolute top-0 right-[20%] w-[600px] h-[600px] bg-[#ff5722]/15 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-[10%] w-[500px] h-[500px] bg-[#22d3ee]/10 blur-[150px] rounded-full" />
    </div>
  );
};

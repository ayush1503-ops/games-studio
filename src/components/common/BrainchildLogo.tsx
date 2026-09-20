import React from 'react';

interface BrainchildLogoProps {
  variant?: 'full' | 'navbar' | 'compact' | 'hero' | 'footer';
  className?: string;
  showAstronaut?: boolean;
  animated?: boolean;
}

export const BrainchildLogo: React.FC<BrainchildLogoProps> = ({
  variant = 'full',
  className = '',
  showAstronaut = true,
  animated = true,
}) => {
  // Height & scale configuration based on variant
  const getScaleClass = () => {
    switch (variant) {
      case 'navbar':
        return 'h-9 sm:h-10';
      case 'compact':
        return 'h-8';
      case 'hero':
        return 'h-24 sm:h-32 md:h-40';
      case 'footer':
        return 'h-16 sm:h-20';
      case 'full':
      default:
        return 'h-16 sm:h-20 md:h-24';
    }
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none group cursor-pointer ${className}`}>
      <svg
        viewBox="0 0 540 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-auto ${getScaleClass()} transition-transform duration-300 ${
          animated ? 'group-hover:scale-105' : ''
        }`}
      >
        <defs>
          {/* Orange Gradient for Text */}
          <linearGradient id="bcOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="50%" stopColor="#F15A24" />
            <stop offset="100%" stopColor="#E03E11" />
          </linearGradient>

          {/* Visor Blue Gradient */}
          <linearGradient id="astroVisorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="40%" stopColor="#2563EB" />
            <stop offset="80%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>

          {/* Helmet Glass Shine */}
          <linearGradient id="visorGlassShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Backpack Gold Gradient */}
          <linearGradient id="backpackGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Suit Shade Gradient */}
          <linearGradient id="suitShade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="85%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Drop Shadows */}
          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#F15A24" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* --- TEXT PORTION --- */}
        <g id="logo-text" filter="url(#logoGlow)">
          {/* Main Title: BRAINCHILD */}
          <text
            x="10"
            y="72"
            fill="url(#bcOrangeGrad)"
            fontFamily="System-UI, -apple-[#12141e], sans-serif"
            fontWeight="900"
            fontSize="54"
            letterSpacing="2.5"
          >
            BRAINCHILD
          </text>

          {/* Subtitle: — GAMES — */}
          <g id="games-subtitle">
            {/* Left Horizontal Line */}
            <line
              x1="12"
              y1="114"
              x2="78"
              y2="114"
              stroke="#F15A24"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* GAMES Word */}
            <text
              x="102"
              y="126"
              fill="url(#bcOrangeGrad)"
              fontFamily="System-UI, -apple-system, sans-serif"
              fontWeight="900"
              fontSize="34"
              letterSpacing="6"
            >
              GAMES
            </text>

            {/* Right Horizontal Line */}
            <line
              x1="284"
              y1="114"
              x2="350"
              y2="114"
              stroke="#F15A24"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* --- ASTRONAUT MASCOT PORTION --- */}
        {showAstronaut && (
          <g id="astronaut-mascot" className={animated ? 'animate-float-slow' : ''}>
            <g transform="translate(370, 10) rotate(-12)">
              {/* Gold Life Support Backpack */}
              <rect
                x="15"
                y="50"
                width="35"
                height="65"
                rx="14"
                fill="url(#backpackGold)"
                stroke="#B45309"
                strokeWidth="3"
              />
              <rect x="20" y="62" width="10" height="24" rx="4" fill="#92400E" />

              {/* Legs */}
              {/* Left Leg */}
              <path
                d="M48 100 L40 135 L56 142 L65 105 Z"
                fill="url(#suitShade)"
                stroke="#94A3B8"
                strokeWidth="3"
              />
              {/* Left Boot */}
              <path
                d="M38 132 C35 145 42 152 58 150 L64 140 Z"
                fill="#1E293B"
                stroke="#0F172A"
                strokeWidth="2.5"
              />

              {/* Right Leg (Tilted float) */}
              <path
                d="M62 98 L82 128 L96 118 L76 92 Z"
                fill="url(#suitShade)"
                stroke="#94A3B8"
                strokeWidth="3"
              />
              {/* Right Boot */}
              <path
                d="M80 126 C90 138 102 134 105 120 L94 116 Z"
                fill="#1E293B"
                stroke="#0F172A"
                strokeWidth="2.5"
              />

              {/* Suit Body */}
              <path
                d="M42 55 C42 42 85 42 85 55 L80 102 C80 106 48 106 45 102 Z"
                fill="url(#suitShade)"
                stroke="#CBD5E1"
                strokeWidth="3"
              />

              {/* Suit Red/Orange Accent Lines */}
              <path d="M48 66 L78 66" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />
              <path d="M49 84 L77 84" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" />

              {/* Chest Control Unit Badge */}
              <circle cx="63" cy="75" r="5" fill="#1E293B" />
              <circle cx="63" cy="75" r="2.5" fill="#F15A24" />

              {/* Left Arm (Raised Floating) */}
              <path
                d="M44 56 C28 62 20 78 28 88 L36 82 C32 75 38 65 48 62 Z"
                fill="url(#suitShade)"
                stroke="#94A3B8"
                strokeWidth="3"
              />
              {/* Left Glove */}
              <circle cx="25" cy="88" r="7" fill="#1E293B" />

              {/* Right Arm (Waving forward) */}
              <path
                d="M82 56 C98 62 108 72 102 85 L94 80 C98 72 92 64 80 62 Z"
                fill="url(#suitShade)"
                stroke="#94A3B8"
                strokeWidth="3"
              />
              {/* Right Glove */}
              <circle cx="104" cy="85" r="7" fill="#1E293B" />

              {/* Astronaut Helmet (Big round helmet) */}
              <circle
                cx="63"
                cy="38"
                r="30"
                fill="url(#suitShade)"
                stroke="#CBD5E1"
                strokeWidth="4"
              />

              {/* Blue Reflective Glass Visor */}
              <ellipse cx="66" cy="38" rx="21" ry="17" fill="url(#astroVisorGrad)" />
              <ellipse
                cx="66"
                cy="38"
                rx="21"
                ry="17"
                stroke="#1E3A8A"
                strokeWidth="2.5"
              />

              {/* Helmet Visor Shine Highlights */}
              <path
                d="M52 28 C56 24 72 24 78 28 C74 27 60 27 52 28 Z"
                fill="url(#visorGlassShine)"
              />
              <circle cx="56" cy="32" r="3" fill="#FFFFFF" opacity="0.85" />
              <circle cx="52" cy="36" r="1.5" fill="#FFFFFF" opacity="0.6" />

              {/* Helmet Audio / Earmuff Caps */}
              <rect x="31" y="32" width="6" height="12" rx="3" fill="#1E293B" />
              <rect x="89" y="32" width="6" height="12" rx="3" fill="#1E293B" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

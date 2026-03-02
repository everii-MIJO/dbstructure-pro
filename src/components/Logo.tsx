import React from 'react';

export const Logo = () => {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative w-8 h-8 flex items-center justify-center">
        {/* Abstract geometric shape representing structure/database */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent">
          <path 
            d="M16 2L4 8V24L16 30L28 24V8L16 2Z" 
            className="fill-accent/10 stroke-accent" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M4 8L16 14L28 8" 
            className="stroke-accent" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M16 14V30" 
            className="stroke-accent" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M16 20L28 14" 
            className="stroke-accent/50" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
           <path 
            d="M4 14L16 20" 
            className="stroke-accent/50" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <h1 className="text-lg font-bold tracking-tight text-[var(--text)] font-display whitespace-nowrap">
          DBStructure <span className="italic font-normal">Pro</span>
        </h1>
      </div>
    </div>
  );
};

import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 32 }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" rx="24" fill="currentColor" fillOpacity="0.1" />
      <path 
        d="M35 25V75H50C63.8071 75 75 63.8071 75 50C75 36.1929 63.8071 25 50 25H35ZM45 35H50C58.2843 35 65 41.7157 65 50C65 58.2843 58.2843 65 50 65H45V35Z" 
        fill="currentColor" 
      />
    </svg>
  );
}

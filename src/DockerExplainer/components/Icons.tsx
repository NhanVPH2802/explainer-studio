import React from "react";

type IconProps = {
  size?: number;
  className?: string;
};

const Svg = ({
  size = 40,
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const RocketIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M14 4c3-2 5-2 6-2 0 1 0 3-2 6l-5 5-4-4 5-5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M9 9 5 10l-2 3 5 1M13 13l-1 5-3 2-1-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="6" r="1.5" fill="currentColor" />
    <path
      d="M7 17c-2 0-3 1-3 3 2 0 3-1 3-3Z"
      fill="currentColor"
    />
  </Svg>
);

export const HeartIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
      fill="currentColor"
    />
  </Svg>
);

export const BellIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M10 21h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

export const MicIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect
      x="8"
      y="3"
      width="8"
      height="12"
      rx="4"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

export const BoltIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
      fill="currentColor"
    />
  </Svg>
);

export const ServerIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect
      x="3"
      y="4"
      width="18"
      height="6"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="3"
      y="14"
      width="18"
      height="6"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="7" cy="7" r="1" fill="currentColor" />
    <circle cx="7" cy="17" r="1" fill="currentColor" />
  </Svg>
);

export const CloudIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M17.5 19H6a4 4 0 0 1-.5-8A6.5 6.5 0 0 1 18 9a5 5 0 0 1-.5 10Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Svg>
);


export const PackageIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 7 12 3l8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M4 7v10l8 4 8-4V7M12 11v10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></Svg>
);
export const FileIcon = (props: IconProps) => (
  <Svg {...props}><path d="M6 2h8l4 4v16H6V2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2v5h5M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></Svg>
);
export const BookIcon = (props: IconProps) => (
  <Svg {...props}><path d="M4 4h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H4V4ZM20 4h-6a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h5V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></Svg>
);
export const GearIcon = (props: IconProps) => (
  <Svg {...props}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></Svg>
);
export const AlertIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 3 2.5 20h19L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 9v5M12 17.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></Svg>
);
export const LaptopIcon = (props: IconProps) => (
  <Svg {...props}><rect x="4" y="4" width="16" height="11" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M2 19h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></Svg>
);
export const DiskIcon = (props: IconProps) => (
  <Svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 3v6h10V3M8 21v-7h8v7" stroke="currentColor" strokeWidth="2"/></Svg>
);
export const TrophyIcon = (props: IconProps) => (
  <Svg {...props}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="2"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></Svg>
);
export const ArrowDownIcon = (props: IconProps) => (
  <Svg {...props}><path d="M12 4v15M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg>
);
export const BurstIcon = (props: IconProps) => (
  <Svg {...props}><path d="m12 2 2 6 6-2-4 5 6 3-7 1 1 7-4-6-4 6 1-7-7-1 6-3-4-5 6 2 2-6Z" fill="currentColor"/></Svg>
);

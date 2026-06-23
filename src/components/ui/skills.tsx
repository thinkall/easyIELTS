import type { ReactNode } from "react";

export interface SkillMeta {
  name: string;
  href: string;
  target: string;
  blurb: string;
  icon: ReactNode;
  accent: string;
}

const iconProps = {
  className: "h-6 w-6",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const SKILLS: SkillMeta[] = [
  {
    name: "Listening",
    href: "/listening",
    target: "Band 7 ≈ 30–31 / 40",
    blurb: "Real multi-voice recordings, auto-scored.",
    accent: "text-sky-600 bg-sky-50 dark:bg-sky-950",
    icon: (
      <svg {...iconProps}>
        <path d="M3 12a9 9 0 0 1 18 0" />
        <path d="M3 12v3a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2Z" />
        <path d="M21 12v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z" />
        <path d="M18 17v1a3 3 0 0 1-3 3h-3" />
      </svg>
    ),
  },
  {
    name: "Reading",
    href: "/reading",
    target: "Band 7 ≈ 34–35 / 40 (GT)",
    blurb: "GT passages and questions, instant band.",
    accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950",
    icon: (
      <svg {...iconProps}>
        <path d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5" />
        <path d="M12 6.5C13.5 5.5 16 5 20 5v13c-4 0-6.5.5-8 1.5" />
        <path d="M12 6.5v13" />
      </svg>
    ),
  },
  {
    name: "Writing",
    href: "/writing",
    target: "AI-scored on 4 criteria",
    blurb: "Task 1 + Task 2 with detailed feedback.",
    accent: "text-amber-600 bg-amber-50 dark:bg-amber-950",
    icon: (
      <svg {...iconProps}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    name: "Speaking",
    href: "/speaking",
    target: "Live AI examiner",
    blurb: "Talk to an examiner; scored from your audio.",
    accent: "text-rose-600 bg-rose-50 dark:bg-rose-950",
    icon: (
      <svg {...iconProps}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    ),
  },
];

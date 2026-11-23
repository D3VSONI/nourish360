import type { PatientType } from '@workspace/api-client-react';

/** Small flat SVG illustrations for the home role cards. Decorative only. */
export function RoleArt({ role, className }: { role: PatientType; className?: string }) {
  const common = { viewBox: '0 0 96 96', className, 'aria-hidden': true as const, fill: 'none' };
  if (role === 'CHILD')
    return (
      <svg {...common}>
        <circle cx="48" cy="48" r="44" fill="hsl(172 40% 88%)" />
        <circle cx="48" cy="40" r="17" fill="hsl(28 60% 72%)" stroke="hsl(175 80% 16%)" strokeWidth="3" />
        <path d="M34 34c4-10 22-12 28 0" stroke="hsl(175 80% 16%)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="42" cy="41" r="2.2" fill="hsl(175 80% 16%)" /><circle cx="54" cy="41" r="2.2" fill="hsl(175 80% 16%)" />
        <path d="M43 48c3 3 7 3 10 0" stroke="hsl(175 80% 16%)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M26 82c2-14 11-22 22-22s20 8 22 22" fill="hsl(175 77% 26%)" stroke="hsl(175 80% 16%)" strokeWidth="3" />
      </svg>
    );
  if (role === 'PREGNANT_LADY')
    return (
      <svg {...common}>
        <circle cx="48" cy="48" r="44" fill="hsl(38 92% 88%)" />
        <circle cx="44" cy="26" r="11" fill="hsl(28 55% 62%)" stroke="hsl(26 70% 22%)" strokeWidth="3" />
        <path d="M34 22c2-8 18-10 22 2" stroke="hsl(26 70% 22%)" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 40h14c10 4 16 14 14 24-1 8-7 12-14 12h-2l-2 12H34l2-14c-4-6-4-24 0-34z" fill="hsl(32 95% 44%)" stroke="hsl(26 70% 22%)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M54 58c3-1 5 1 5 4" stroke="hsl(40 90% 92%)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="48" cy="48" r="44" fill="hsl(142 50% 88%)" />
      <circle cx="40" cy="26" r="11" fill="hsl(28 55% 62%)" stroke="hsl(142 70% 18%)" strokeWidth="3" />
      <path d="M22 84c0-22 8-40 18-40s16 8 18 18" fill="hsl(142 76% 36%)" stroke="hsl(142 70% 18%)" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="60" cy="62" rx="14" ry="10" fill="hsl(210 40% 98%)" stroke="hsl(142 70% 18%)" strokeWidth="3" />
      <circle cx="70" cy="56" r="7" fill="hsl(28 60% 74%)" stroke="hsl(142 70% 18%)" strokeWidth="3" />
    </svg>
  );
}

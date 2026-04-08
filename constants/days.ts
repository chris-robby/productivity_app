// Shared day-of-week constants — import from here instead of re-defining per file.

export const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

// Short labels used in chip UIs (Mon–Sun order for display)
export const DAYS: { label: string; value: number }[] = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Returns a human-readable day summary, e.g. "Mon, Wed, Fri" or "Every day". */
export function formatDays(days: number[]): string {
  if (ALL_DAYS.every((d) => days.includes(d))) return 'Every day';
  return days
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => DAY_LABELS[d])
    .join(', ');
}

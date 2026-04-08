// Dimension constants — button sizes, badge sizes, border radii.
// Use these to keep sizing consistent across screens.

export const Radius = {
  xs:   4,
  sm:   6,
  md:   8,
  lg:   12,
  xl:   14,
  xxl:  16,
  pill: 20,
  full: 9999,
} as const;

export const IconButton = {
  sm:  { width: 28, height: 28, borderRadius: 14 },
  md:  { width: 32, height: 32, borderRadius: 8  },
  lg:  { width: 36, height: 36, borderRadius: 18 },
} as const;

export const Badge = {
  sm: { width: 20, height: 20, borderRadius: 10 },
  md: { width: 26, height: 26, borderRadius: 13 },
  lg: { width: 28, height: 28, borderRadius: 14 },
} as const;

export const Checkbox = {
  size:         24,
  borderRadius: 6,
} as const;

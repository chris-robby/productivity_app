// Typography scale — use these instead of raw numbers for fontSize/fontWeight.

export const FontSize = {
  // Labels & captions
  xxs:  10,
  xs:   11,
  sm:   12,
  // Body
  caption: 13,
  base:    14,
  md:      15,
  body:    16,
  // Subheadings
  lg:  17,
  xl:  18,
  xxl: 20,
  // Headings
  h3:      22,
  h2:      24,
  h1:      28,
  display: 36,
  // Special
  stat: 48,
} as const;

export const FontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semiBold: '600' as const,
  bold:     '700' as const,
  extraBold:'800' as const,
} as const;

// Reusable text style presets
export const TextStyle = {
  label:    { fontSize: FontSize.xs,   fontWeight: FontWeight.bold,     letterSpacing: 1.2 },
  caption:  { fontSize: FontSize.caption, fontWeight: FontWeight.regular },
  body:     { fontSize: FontSize.body, fontWeight: FontWeight.regular },
  bodyMed:  { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  subTitle: { fontSize: FontSize.md,   fontWeight: FontWeight.semiBold },
  heading:  { fontSize: FontSize.h1,   fontWeight: FontWeight.bold },
} as const;

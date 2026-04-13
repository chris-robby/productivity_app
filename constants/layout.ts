/** Shared layout tokens — import these instead of hardcoding values */

/** Horizontal padding applied to all screen content */
export const SCREEN_H_PAD = 20;

/** Border-radius scale used across the app */
export const RADIUS = {
  sm:    6,   // chips, day selectors, small action buttons
  input: 10,  // text inputs
  btn:   12,  // primary CTA buttons
  card:  12,  // content cards
  lg:    16,  // elevated / feature cards
  xl:    20,  // modal sheets (top corners)
  sheet: 24,  // bottom sheets
} as const;

// Re-exports from templates/ folder — keeps the import path stable for edge functions.
// Add new categories in templates/index.ts, not here.
export { detectCategory, getTemplate } from "./templates/index.ts";
export type { GoalCategory } from "./templates/index.ts";

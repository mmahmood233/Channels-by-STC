import { clsx, type ClassValue } from "clsx";

/**
 * Merge Tailwind CSS class names with conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

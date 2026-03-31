import { CURRENCY_SYMBOL } from "@/constants";

/**
 * Format a number as currency (Bahraini Dinar)
 */
export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString("en-BH", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-BH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string with time
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-BH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-BH");
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

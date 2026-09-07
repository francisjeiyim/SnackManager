type ClassValue = string | number | false | null | undefined;

/** Tiny classnames joiner (no dedupe — keep class lists tidy at the call site). */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

import type { Locale } from "@snackmanager/shared";

const intlLocale = (l: string): string => (l === "ja" ? "ja-JP" : "en-US");

export function yen(amount: number, locale: Locale | string = "ja"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** `h:mm:ss` (or `m:ss` under an hour) from a millisecond span. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** "1 set + 2 half-sets" / 「1セット+2ハーフ」 — empty when nothing is billed. */
export function setLabel(sets: number, halfSets: number, locale: string = "ja"): string {
  if (!sets && !halfSets) return locale === "ja" ? "—" : "—";
  if (locale === "ja") {
    return `${sets}セット${halfSets ? `+${halfSets}ハーフ` : ""}`;
  }
  const s = `${sets} set${sets > 1 ? "s" : ""}`;
  return halfSets ? `${s} + ${halfSets} half-set${halfSets > 1 ? "s" : ""}` : s;
}

export function dateTime(iso: string, locale: string = "ja"): string {
  return new Date(iso).toLocaleString(intlLocale(locale), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

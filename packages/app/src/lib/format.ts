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

/**
 * "1 set + 1 prolong. set + 2 prolong. demi-set" / 「1セット+1セット延長+2ハーフ延長」
 * — a dash when nothing is billed. `extSets` / `extHalves` are the counts of
 * validated full-set / half-set extension blocks.
 */
export function setLabel(
  sets: number,
  extSets: number,
  extHalves: number,
  locale: string = "ja",
): string {
  if (!sets && !extSets && !extHalves) return "—";
  if (locale === "ja") {
    return [
      sets ? `${sets}セット` : "",
      extSets ? `${extSets}セット延長` : "",
      extHalves ? `${extHalves}ハーフ延長` : "",
    ]
      .filter(Boolean)
      .join("+");
  }
  return [
    sets ? `${sets} set${sets > 1 ? "s" : ""}` : "",
    extSets ? `${extSets} prolong. set${extSets > 1 ? "s" : ""}` : "",
    extHalves ? `${extHalves} prolong. demi-set${extHalves > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" + ");
}

export function dateTime(iso: string, locale: string = "ja"): string {
  return new Date(iso).toLocaleString(intlLocale(locale), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

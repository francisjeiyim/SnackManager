import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "@snackmanager/shared";
import ja from "./ja.json";
import en from "./en.json";

const KEY = "sm.locale";

export function storedLocale(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "ja" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "ja";
}

export function setLocale(locale: Locale): void {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

void i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: storedLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = storedLocale();

export default i18n;

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import el from "./locales/el.json";

const STORAGE_KEY = "app.language";
const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
const initialLng = saved === "el" ? "el" : "en";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, el: { translation: el } },
  lng: initialLng,
  fallbackLng: "en",
  returnNull: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

function logI18nDiagnostics() {
  if (typeof window === "undefined") return;

  const activeLng = i18n.resolvedLanguage ?? i18n.language;
  const fallbackLng = Array.isArray(i18n.options.fallbackLng)
    ? i18n.options.fallbackLng[0]
    : typeof i18n.options.fallbackLng === "string"
      ? i18n.options.fallbackLng
      : "en";

  const activeHasBundle = i18n.hasResourceBundle(activeLng, "translation");
  const fallbackHasBundle = i18n.hasResourceBundle(fallbackLng, "translation");
  const sample = i18n.t("shell.hub");

  if (sample === "shell.hub") {
    console.error("[i18n] Missing translations at runtime", {
      activeLng,
      fallbackLng,
      activeHasBundle,
      fallbackHasBundle,
      sampleKey: "shell.hub",
    });
    return;
  }

  if (import.meta.env.DEV) {
    console.info("[i18n] Loaded translations", {
      activeLng,
      fallbackLng,
      activeHasBundle,
      fallbackHasBundle,
      sample,
    });
  }
}

i18n.on("initialized", logI18nDiagnostics);
i18n.on("languageChanged", logI18nDiagnostics);

i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lng === "el" ? "el" : "en");
  }
});

export default i18n;

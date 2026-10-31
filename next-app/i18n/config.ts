import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";
import arCommon from "./locales/ar/common.json";
import enScreens from "./locales/en/screens.json";
import esScreens from "./locales/es/screens.json";
import arScreens from "./locales/ar/screens.json";
import { applyDocumentLanguage } from "@/lib/applyDocumentLanguage";

const storedLang = (() => {
  if (typeof window === "undefined") return undefined;
  try {
    return localStorage.getItem("app.lang") || undefined;
  } catch {
    return undefined;
  }
})();

void i18n.use(initReactI18next).init({
  lng: storedLang ?? "en",
  fallbackLng: "en",
  resources: {
    en: {
      common: enCommon,
      screens: enScreens,
    },
    es: {
      common: esCommon,
      screens: esScreens,
    },
    ar: {
      common: arCommon,
      screens: arScreens,
    },
  },
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => applyDocumentLanguage(lng));
applyDocumentLanguage(i18n.language);

export default i18n;

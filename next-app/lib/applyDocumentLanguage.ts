const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

export function applyDocumentLanguage(lng: string | undefined) {
  if (typeof document === "undefined") return;
  const code = (lng || "en").split("-")[0]?.toLowerCase() || "en";
  const dir = RTL_LANGS.has(code) ? "rtl" : "ltr";
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
}

import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { AppProviders } from "./providers";
import "../styles/index.css";
import "../styles/mobile-viewport.css";

/** System stacks — next/font/google is fetched at Docker build time and flakes on Desktop DNS. */
const fontVars = "font-[family-name:var(--font-inter)]";

export const metadata: Metadata = {
  title: "Xnet Pro Radius",
  description: "Xnet Pro — RADIUS & ISP Network Operations Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVars} h-full antialiased`}>
        <Script src="/env.js" strategy="beforeInteractive" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
  var root = document.documentElement;
  if (localStorage.getItem("theme") === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
} catch (_) {}`}
        </Script>
        <Suspense fallback={null}>
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  );
}

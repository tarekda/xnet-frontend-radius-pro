import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { AppProviders } from "./providers";
import "../styles/index.css";
import "../styles/mobile-viewport.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <body className={`${inter.className} h-full antialiased`}>
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

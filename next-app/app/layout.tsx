import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Xnet Pro Radius",
  description: "Xnet Radius Server",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
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

import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
const appVersion = String(pkg.version || "0.0.0");
const buildTime = new Date().toISOString();
const gitSha =
  String(
    process.env.GITHUB_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.COMMIT_SHA ||
      ""
  );

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config, { webpack: webpackInstance }) => {
    config.plugins.push(
      new webpackInstance.DefinePlugin({
        __APP_VERSION__: JSON.stringify(appVersion),
        __APP_BUILD_TIME__: JSON.stringify(buildTime),
        __APP_GIT_SHA__: JSON.stringify(gitSha),
      })
    );
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // HSTS is a no-op over plain HTTP; effective once served via HTTPS.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Baseline CSP — tighten further once inline styles/scripts are audited.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "connect-src 'self' https: wss: ws:",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  /**
   * When `NEXT_PUBLIC_API_URL` is same-origin (e.g. /api), proxied API forwards to the backend.
   * Backend for `/api` rewrites (not the Next port). Example: `API_PROXY_TARGET=http://127.0.0.1:3000 npm run dev` while Next serves on 5173.
   */
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "http://127.0.0.1:3000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;

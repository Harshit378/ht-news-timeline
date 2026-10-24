import type { NextConfig } from "next";

// ADR-001 Path A: a fully static export that Capacitor wraps for iOS/Android.
// No server features (API routes, middleware, dynamic segments without
// generateStaticParams) — dynamic views use query params (e.g. /story/?q=).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

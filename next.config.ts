import type { NextConfig } from "next";

const IMMUTABLE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  // blode.co proxies /moon to this deployment, so every route and asset has to
  // live under that prefix. Change it and the site keeps working on the zone
  // origin while 404ing under the real URL.
  basePath: "/moon",

  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    // Runs the React Compiler inside Turbopack instead of Babel.
    turbopackRustReactCompiler: true,
  },

  headers() {
    // Textures are content-stable and were being revalidated on every
    // navigation. Next fingerprints and caches /_next/static itself.
    return Promise.resolve([
      {
        source: "/textures/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        // Not immutable: these two can be re-cut in place without a new URL.
        source: "/:path(opengraph-image.jpg|avatar-sm.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ]);
  },
};

export default nextConfig;

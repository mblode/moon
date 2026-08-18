import type { NextConfig } from "next";

const IMMUTABLE = "public, max-age=31536000, immutable";

const isDev = process.env.NODE_ENV === "development";

// blode.co deliberately excludes zone paths from its own headers, because two
// CSP headers on one response are intersected by the browser rather than
// overridden. So this zone owns its response headers.
//
// Every origin this page touches is first-party: fonts are next/font/local,
// the textures are in public/, and there is no analytics of any kind here.
// So the policy needs no allowlist beyond 'self'.
//
// - 'unsafe-inline' scripts: Next's hydration bootstrap and the JSON-LD block
//   are inline; a nonce would need middleware on an otherwise static page.
// - 'unsafe-eval' in dev only: Turbopack's HMR runtime evals module code.
// - WebGL needs nothing extra: three.js compiles shaders through the GL
//   context, not through eval, and useTexture loads from public/textures.
//
// HSTS is deliberately absent: the blode.co edge already sends it, and setting
// includeSubDomains/preload from a zone would apply to every blode.co
// subdomain irreversibly.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

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

  redirects() {
    // The vanity host stays attached to this Vercel project, so the 301 onto
    // the canonical blode.co zone path has to happen here. Nothing in
    // blode-co's own config can do it: a request to moon.blode.co never
    // reaches that app.
    //
    // This was the largest canonicalisation gap in the fleet. Search Console
    // has moon.blode.co/ on 215 impressions over three months, the second
    // most-surfaced URL on the whole domain, all of it splitting signal away
    // from blode.co/moon rather than adding to it.
    //
    // Paths that already include the basePath are matched first. A bare
    // `/:path*` captures `moon/x` and sends it to `/moon/moon/x`, a 404 that
    // Search Console reports as a Redirect error.
    //
    // No loop on the live zone: blode.co/moon proxies to moon.zone.blode.co,
    // whose host does not match these rules.
    const vanityHost = [{ type: "host" as const, value: "moon.blode.co" }];
    return Promise.resolve([
      {
        basePath: false,
        destination: "https://blode.co/moon",
        has: vanityHost,
        permanent: true,
        source: "/moon",
      },
      {
        basePath: false,
        destination: "https://blode.co/moon/:path*",
        has: vanityHost,
        permanent: true,
        source: "/moon/:path*",
      },
      {
        basePath: false,
        destination: "https://blode.co/moon",
        has: vanityHost,
        permanent: true,
        source: "/",
      },
      {
        basePath: false,
        destination: "https://blode.co/moon/:path*",
        has: vanityHost,
        permanent: true,
        source: "/:path*",
      },
    ]);
  },

  headers() {
    // Textures are content-stable and were being revalidated on every
    // navigation. Next fingerprints and caches /_next/static itself.
    //
    // Every matching rule applies in array order and a later one wins per
    // header key, so the catch-all comes first and per-route overrides after.
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/textures/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        // Not immutable: can be re-cut in place without a new URL.
        source: "/avatar-sm.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        // Generated house card: fetched by other origins, so opt out of the
        // same-origin CORP the catch-all sets if one is added later. Short
        // cache so a redesign can land without waiting a year.
        source: "/opengraph-image",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ]);
  },
};

export default nextConfig;

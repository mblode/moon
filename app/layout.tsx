import { Agentation } from "agentation";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Glide 2.0.0 — https://github.com/mblode/glide. One variable file per style
// covers the whole weight axis, so each declares 100-950 rather than a face per
// weight.
const glide = localFont({
  src: [
    { path: "./fonts/glide-variable.woff2", style: "normal" },
    { path: "./fonts/glide-variable-italic.woff2", style: "italic" },
  ],
  variable: "--font-glide",
  weight: "100 950",
  display: "swap",
});

const glideMono = localFont({
  src: "./fonts/glide-mono.woff2",
  variable: "--font-glide-mono",
  weight: "400",
  display: "swap",
});

const SITE_URL = "https://blode.co/moon";
// Sentence case, and led by the phrase people actually search ("moon phase
// tonight") rather than the product category. The old description ran to 164
// characters, past the point Google truncates it.
const TITLE = "Moon phase tonight: a 3D simulator for your location";
const DESCRIPTION =
  "See tonight’s moon phase, illumination and orientation in 3D for your exact location, then scrub fifteen days forward or back. Free, no sign-up.";
const SOCIAL_DESCRIPTION =
  "The moon as it looks right now, from where you are standing. The phase isn’t animated, it’s computed from real orbital positions.";

export const metadata: Metadata = {
  // The zone URL, not the bare origin (Rule 11). Only correct because the card
  // is a generated `opengraph-image.tsx` route: Next does not prefix those with
  // `basePath`, so `metadataBase` supplies the prefix exactly once. Against the
  // static JPG this replaced, the two would have stacked into `/moon/moon/…`.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: "Matthew Blode", url: "https://blode.co" }],
  creator: "Matthew Blode",
  // Absolute: a relative `/moon` would stack on zone `metadataBase`.
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  openGraph: {
    type: "website",
    siteName: "Matthew Blode",
    locale: "en_US",
    url: SITE_URL,
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    // No `images` here: `app/opengraph-image.tsx` is the card. Next reuses it
    // for `twitter:image` too when there is no `twitter-image` file.
  },
  twitter: {
    card: "summary_large_image",
    site: "@mattblode",
    creator: "@mattblode",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
  },
  // Paths without `/moon`: `metadataBase` already carries the zone, and Next
  // joins rather than replaces, so spelling the prefix here would double it.
  // File conventions also pick up favicon.ico / icon0.svg / icon1.png /
  // apple-icon.png from `app/`; this keeps the link tags explicit.
  icons: {
    icon: [
      { url: "/icon0.svg", type: "image/svg+xml" },
      { url: "/icon1.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    title: "Moon",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#05060a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${glide.variable} ${glideMono.variable} dark h-full antialiased`}
      lang="en"
    >
      <body className="flex min-h-full flex-col">
        {children}
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}

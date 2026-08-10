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
const TITLE = "3D Moon Phase Simulator: Tonight’s Phase Where You Are";
const DESCRIPTION =
  "An interactive 3D moon phase simulator. See tonight’s phase, illumination and orientation for your exact latitude and longitude, then scrub fifteen days either way.";
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
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
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

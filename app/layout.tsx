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

const TITLE = "3D Moon Phase Simulator: Tonight’s Phase Where You Are";
const DESCRIPTION =
  "An interactive 3D moon phase simulator. See tonight’s phase, illumination and orientation for your exact latitude and longitude, then scrub fifteen days either way.";
const SOCIAL_DESCRIPTION =
  "The moon as it looks right now, from where you are standing. The phase isn’t animated, it’s computed from real orbital positions.";

export const metadata: Metadata = {
  /*
   * The bare origin, NOT the zone URL, despite zone-conventions.md Rule 11.
   * Next 16 already prefixes `basePath` onto the relative `canonical` below, so
   * the zone URL would resolve it to blode.co/moon/moon. Every image URL here
   * is absolute and unaffected either way. Verified against build output.
   */
  metadataBase: new URL("https://blode.co"),
  title: TITLE,
  description: DESCRIPTION,
  authors: [{ name: "Matthew Blode", url: "https://blode.co" }],
  creator: "Matthew Blode",
  alternates: { canonical: "/moon" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  openGraph: {
    type: "website",
    siteName: "Matthew Blode",
    locale: "en_US",
    url: "https://blode.co/moon",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    images: [
      {
        url: "https://blode.co/moon/opengraph-image.jpg",
        type: "image/jpeg",
        width: 1200,
        height: 630,
        alt: "A 3D-rendered moon on a black background, lit from one side, with craters raking across the shadow line.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@mattblode",
    creator: "@mattblode",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
    images: ["https://blode.co/moon/opengraph-image.jpg"],
  },
  // Under the basePath: these are this app's own marks, not blode.co's.
  icons: {
    icon: "/moon/icon.svg",
    apple: "/moon/apple-icon.png",
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

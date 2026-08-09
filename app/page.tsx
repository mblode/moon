import Image from "next/image";

import { MoonApp } from "@/components/moon-app";
import { ZoneBreadcrumb } from "@/components/zone-breadcrumb";
import avatar from "@/public/avatar-sm.png";

const HEADING =
  "mt-8 mb-2 text-balance font-semibold text-[1.3125rem]/[1.3] tracking-[-0.011em]";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "@id": "https://blode.co/moon/#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Matthew Blode",
          item: "https://blode.co",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Projects",
          item: "https://blode.co/projects",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Moon Phase Simulator",
          item: "https://blode.co/moon",
        },
      ],
    },
    {
      "@type": "WebApplication",
      "@id": "https://blode.co/moon/#app",
      name: "3D Moon Phase Simulator",
      url: "https://blode.co/moon",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript and WebGL",
      inLanguage: "en",
      isAccessibleForFree: true,
      isFamilyFriendly: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description:
        "An interactive 3D model of the Moon that computes tonight's phase, illumination and orientation for your latitude and longitude, with a thirty day time-travel slider.",
      featureList: [
        "Real-time lunar phase from your latitude and longitude",
        "Hemisphere-correct crescent orientation",
        "Time travel across thirty days",
        "NASA Lunar Reconnaissance Orbiter surface maps",
        "Physically lit, tidally locked sphere",
      ],
      screenshot: "https://blode.co/moon/opengraph-image.jpg",
      author: { "@id": "https://blode.co/#person" },
      creator: { "@id": "https://blode.co/#person" },
      publisher: { "@id": "https://blode.co/#organization" },
      isPartOf: { "@id": "https://blode.co/#website" },
      citation: [
        {
          "@type": "CreativeWork",
          name: "NASA Lunar Reconnaissance Orbiter",
          url: "https://lunar.gsfc.nasa.gov/",
        },
        {
          "@type": "SoftwareSourceCode",
          name: "astronomy-engine",
          url: "https://github.com/cosinekitty/astronomy",
        },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      {/* Static object literal, no user input. See oxlint.config.ts. */}
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        type="application/ld+json"
      />

      {/* Off-screen because the visualisation is the title treatment. It is
          real content either way, and without it the page has no h1. */}
      <h1 className="sr-only">
        3D moon phase simulator: tonight’s phase from where you are
      </h1>

      <MoonApp />

      <main className="full-bleed-bg relative z-3 mx-auto max-w-[62ch] px-gutter py-8 text-[1.0625rem]/[1.65]">
        {/* `product` has to be the exact string in the BreadcrumbList above:
            Google reads a mismatch between the visible trail and the markup as
            an error. */}
        <ZoneBreadcrumb product="Moon Phase Simulator" />

        <p className="mt-6 mb-6 text-pretty text-[1.4375rem]/[1.35] tracking-[-0.011em]">
          The moon as it looks right now, from where you are standing.
        </p>

        <p className="mb-4 text-pretty">
          The sphere never turns. It holds still the way the real moon keeps one
          face to us, and only the sunlight moves around it. Which way the
          crescent leans depends on your latitude, so the view from Melbourne is
          not the view from London.
        </p>

        <h2 className={HEADING}>How the phase is calculated</h2>
        <p className="mb-4 text-pretty">
          Every view starts as a calculation, not a keyframe. The positions of
          the sun and moon are worked out for your latitude, longitude and the
          current minute, and a single light is placed from those numbers.
          Change the time and the shadow line moves because the geometry moved.
        </p>

        <h2 className={HEADING}>
          Why the moon looks upside down in the southern hemisphere
        </h2>
        <p className="mb-4 text-pretty">
          Southern observers look at the moon from the other side of the earth’s
          axis, so the lit edge appears rotated by roughly half a turn. A
          crescent that opens to the right in London opens to the left in
          Melbourne. That rotation is computed here from your own position,
          which is why picking a different city visibly tips the moon over.
        </p>

        <h2 className={HEADING}>The moon doesn’t rotate to make a phase</h2>
        <p className="mb-4 text-pretty">
          It is tidally locked, keeping one face toward earth. Nothing here
          spins to produce a phase; only the light moves, which is how phases
          actually happen. It also means the shadow line falls across real
          craters instead of across a texture that has been turned into
          position.
        </p>

        <h2 className={HEADING}>Where the surface comes from</h2>
        <p className="mb-4 text-pretty">
          Colour, relief and roughness maps from NASA’s{" "}
          <a
            className="underline underline-offset-[3px]"
            href="https://lunar.gsfc.nasa.gov/"
          >
            Lunar Reconnaissance Orbiter
          </a>
          . Drag anywhere to move through time.
        </p>
      </main>

      <footer className="full-bleed-bg relative z-3 flex flex-wrap items-center justify-center gap-1 px-gutter pb-[calc(2rem+env(safe-area-inset-bottom))] text-muted-foreground text-sm">
        Crafted by
        <a
          className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:text-foreground"
          href="https://blode.co"
          rel="author"
        >
          {/* alt is empty on purpose: the name is right there in text, so a
              described avatar makes screen readers say it twice. */}
          {/* Imported rather than referenced by path. A bare "/avatar-sm.png"
              hands the optimizer an un-prefixed url while basePath puts the file
              under /moon, so it 400s; a static import emits a basePath-aware
              asset URL instead. */}
          <Image
            alt=""
            className="rounded-full"
            height={20}
            src={avatar}
            width={20}
          />
          Matthew Blode
        </a>
        {/* The edge back to the hub. Same origin behind a rewrite, so same tab
            and no rel: this zone was otherwise a dead end. See
            blode-co/apps/web/.claude/knowledge/zone-conventions.md. */}
        <span aria-hidden="true">·</span>
        <a
          className="rounded-full px-2 py-1 transition-colors hover:text-foreground"
          href="https://blode.co/projects"
        >
          All projects
        </a>
      </footer>
    </>
  );
}

# AGENTS.md — moon

Real-time 3D lunar visualisation at <https://blode.co/moon>. Next.js 16 App
Router, React 19, Tailwind v4 with Blode UI, Three.js via `@react-three/fiber`
and `drei`, orbital maths from `astronomy-engine`. No backend and no test
runner, but `npm run verify` cross-checks the orbital maths against independent
astronomy.

## Commands

```bash
npm run dev           # next dev, localhost:3000/moon
npm run build         # next build (runs tsc)
npm run start         # serve the production build
npm run lint          # ultracite check  (oxlint + oxfmt, not Biome)
npm run format        # ultracite fix
npm run check-types   # tsc --noEmit
npm run verify        # cross-check solveMoon against closed-form astronomy
```

`next build` runs the project-local `tsc` CLI, so a type error fails the build.
Diagnostics are raw `tsc` output with no Next code frames.

## Layout

```
app/layout.tsx              Glide via next/font/local, all metadata, Agentation
app/page.tsx                server component: h1, prose, footer, JSON-LD
app/globals.css             Tailwind v4 theme + the few non-utility rules
app/fonts/                  Glide woff2, referenced by next/font/local
components/moon-app.tsx     "use client": state, console, readouts
components/moon-scene.tsx   "use client": the r3f scene
components/ui/              Blode UI (shadcn registry) button, select, spinner
lib/astro.ts                all orbital maths -> MoonSolution
lib/location.ts             where the viewer is, and the city picker
scripts/verify-astro.mjs    the checks behind `npm run verify`
public/textures/            NASA LRO albedo, normal, roughness (WebP)
```

There is no `src/`, per the scaffold convention; `@/*` resolves from the repo
root. The prose lives in `app/page.tsx` as a server component, so unlike the
old Vite build it is server-rendered rather than hand-written into a static
`index.html`.

## It ships as a blode.co zone

`next.config.ts` sets `basePath: "/moon"`; blode.co proxies `/moon` to this
deployment. Change it and every asset 404s under the real URL. Note this means
the dev server serves the app at `localhost:3000/moon`, not at `/`.

Asset paths in **JSX** are basePath-rewritten by `next/image` and `next/font`,
but a raw string handed to a loader is not: the texture URLs in
`components/moon-app.tsx` include the `/moon` prefix by hand because
`TextureLoader` never sees Next's rewriting.

`vercel.json` also pins `"framework": "nextjs"`. That is load-bearing, not
decoration: the Vercel project was created for the Vite build and its dashboard
preset is still `Vite`, which would run the build and then look for Vite's
output. The field overrides the preset from inside the repo. Verify a config
change with `vercel build`, which produces `.vercel/output` exactly as the real
deploy would.

`vercel.json` redirects the retired `moon.blode.co` onto `blode.co/moon`. There is
deliberately no rule for the zone origin itself — blode.co proxies to it, so a
redirect there would loop.

## Conventions

- **The phase is computed, never animated.** `src/lib/astro.ts` derives the sun
  direction and the mesh orientation from real Sun/Moon geometry for a given date
  and observer. Do not replace any of it with a keyframed, mean-cycle or
  texture-swapped approximation; being actually correct for the viewer's time and
  place is the whole point of the page. An earlier version synthesised the light
  direction from a mean 29.53-day cycle and was wrong by up to 0.17 of the lit
  disk, while the label beside it came from the real ephemeris.
- **Run `npm run verify` after touching `astro.ts`.** It checks the lit fraction
  against `Illumination()`, and the on-screen bright-limb angle against a
  closed-form Meeus chi and q implemented independently inside the script, so a
  sign error cannot pass by agreeing with itself.
- **The scene frame is zenith-up, not north-up.** +Y is the observer's zenith,
  which is what makes a crescent lean differently from Melbourne than from
  London. A north-up frame would look stable but would flatten that difference
  and kill the page's whole claim.
- **The time slider steps in whole days on purpose.** The zenith-up frame rolls
  once per day as the earth turns, so scrubbing by hours tumbles the disk through
  roughly 30 rotations end to end. At a fixed time of day only the slow drift is
  left, about 45 degrees across the range.
- **The moon is tidally locked in the scene.** The mesh holds still and the light
  direction moves around it, which is how phases work physically. Rotating the
  moon instead would look similar and be wrong.
- **Southern-hemisphere orientation is real behaviour, not a detail.** It falls
  out of the zenith-up frame above, so a crescent leans the right way below the
  equator. Anything touching phase naming or orientation needs checking at a
  southern latitude, not just the default; `npm run verify` asserts the London to
  Melbourne flip is between 150 and 180 degrees.
- **Location comes from the timezone, not from a geocoder.** There is no
  Nominatim call any more: `Intl` gives a city name with no permission prompt and
  no third-party request, and geolocation is only requested once the visitor asks
  for it. A timezone cannot give latitude, which is what flips the crescent, so
  the city picker is the recovery path and has to stay.
- **The `<h1>` lives in `index.html`, outside `#root`.** React clears that
  container on mount, so a heading inside it would not survive hydration. It is
  off-screen because the visualisation is the title treatment.
- **`TEXTURE_FIX` in `moon-scene.tsx` is calibrated, not guessed.** It encodes
  which selenographic longitude sits at u=0 for this specific map product. If the
  maps are ever replaced, recalibrate it from the image rather than by eye.
- Textures are ~1.9 MB of WebP. Adding more, or dropping in an uncompressed map,
  is the most likely way to regress load time on this page. The three files in
  `public/textures/` are `moon_albedo.webp` (LRO surface albedo),
  `moon_normal.webp` (normal map), and `moon_roughness.webp` (roughness), each
  2048x1024.
- **There is deliberately no displacement map.** Relief comes from the normal map.
  The only LOLA raster to hand was a colour hillshade, which has a fixed sun angle
  baked into it and is not a height field.
- **Testing in a background tab shows a black canvas.** Chrome suspends
  `requestAnimationFrame` in hidden tabs, so WebGL never draws while the DOM keeps
  updating. Foreground the window before concluding the scene is broken.
- **Cache Components bans clock reads during render.** `Date.now()`, `new Date()`
  and `Math.random()` are hard build errors in server *and* client components,
  which is why `MoonApp` starts with `nowMs = null` and fills it in an effect,
  and why `solveMoon` has no `new Date()` fallback. The timezone guess is
  deferred the same way, since a server-side read would not match the client.
- **The scene is `dynamic(..., { ssr: false })`.** r3f has no SSR path and WebGL
  has nothing to draw on the server.

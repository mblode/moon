# AGENTS.md — moon

Real-time 3D lunar visualisation at <https://blode.co/moon>. Vite + React 19,
Three.js via `@react-three/fiber` and `drei`, orbital maths from
`astronomy-engine`. Five source files; there is no backend and no test runner,
but `npm run verify` cross-checks the orbital maths against independent astronomy.

## Commands

```bash
npm run dev           # vite, localhost:5173
npm run build         # tsc -b && vite build  -> dist/moon
npm run preview       # serve the built output
npm run lint          # ultracite check  (oxlint + oxfmt, not Biome)
npm run format        # ultracite fix
npm run check-types   # tsc --noEmit
npm run verify        # cross-check solveMoon against closed-form astronomy
```

`build` typechecks before bundling (`tsc -b`), so a type error fails the build
here — unlike the Next projects in this account, which skip it.

## Layout

```
index.html                  Vite entry. Also holds the sr-only <h1> and analytics.
src/main.tsx                mounts <App /> into #root
src/app.tsx                 UI, controls, readouts
src/components/moon-scene.tsx  the r3f scene: mesh, lighting, orbit controls
src/lib/astro.ts            all orbital maths -> MoonSolution
src/lib/location.ts         where the viewer is, and the city picker
src/styles.css              the only stylesheet, linked from index.html
scripts/verify-astro.mjs    the checks behind `npm run verify`
public/textures/            NASA LRO albedo, normal, roughness (WebP)
```

`index.html` also holds the sr-only `<h1>`, the prose, the footer and the
JSON-LD. It is the only markup crawlers see, so user-facing copy belongs there
rather than in a component.

## It ships as a blode.co zone

`vite.config.ts` sets `base: "/moon/"` and `build.outDir: "dist/moon"`; blode.co
proxies `/moon` to this deployment. Change either and every asset 404s under the
real URL while `npm run dev` keeps working, so it will not show up locally.

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
  is the most likely way to regress load time on this page.
- **Testing in a background tab shows a black canvas.** Chrome suspends
  `requestAnimationFrame` in hidden tabs, so WebGL never draws while the DOM keeps
  updating. Foreground the window before concluding the scene is broken.

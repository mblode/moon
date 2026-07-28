# AGENTS.md — moon

Real-time 3D lunar visualisation at <https://blode.co/moon>. Vite + React 19,
Three.js via `@react-three/fiber` and `drei`, orbital maths from
`astronomy-engine`. Four source files; there is no backend and no test runner.

## Commands

```bash
npm run dev           # vite, localhost:5173
npm run build         # tsc -b && vite build  -> dist/moon
npm run preview       # serve the built output
npm run lint          # ultracite check  (oxlint + oxfmt, not Biome)
npm run format        # ultracite fix
npm run check-types   # tsc --noEmit
```

`build` typechecks before bundling (`tsc -b`), so a type error fails the build
here — unlike the Next projects in this account, which skip it.

## Layout

```
index.html                  Vite entry. Also holds the sr-only <h1> and analytics.
src/main.tsx                mounts <App /> into #root
src/app.tsx                 UI, controls, geolocation
src/components/moon-scene.tsx  the r3f scene: mesh, lighting, orbit controls
src/lib/astro.ts            all orbital maths -> MoonSolution
public/textures/            NASA LRO albedo, normal, roughness, displacement
```

## It ships as a blode.co zone

`vite.config.ts` sets `base: "/moon/"` and `build.outDir: "dist/moon"`; blode.co
proxies `/moon` to this deployment. Change either and every asset 404s under the
real URL while `npm run dev` keeps working, so it will not show up locally.

`vercel.json` redirects the retired `moon.blode.co` onto `blode.co/moon`. There is
deliberately no rule for the zone origin itself — blode.co proxies to it, so a
redirect there would loop.

## Conventions

- **The phase is computed, never animated.** `src/lib/astro.ts` derives the sun
  direction, illumination fraction, phase angle, libration and rotation axis from
  `astronomy-engine` for a given date and observer. Do not replace any of it with
  a keyframed or texture-swapped approximation; being actually correct for the
  viewer's time and place is the whole point of the page.
- **The moon is tidally locked in the scene.** The mesh holds still and the light
  direction moves around it, which is how phases work physically. Rotating the
  moon instead would look similar and be wrong.
- **Southern-hemisphere orientation is real behaviour, not a detail.** The app
  geolocates and reverse-geocodes through Nominatim so a crescent leans the right
  way below the equator. Anything touching phase naming or orientation needs
  checking at a southern latitude, not just the default.
- **The `<h1>` lives in `index.html`, outside `#root`.** React clears that
  container on mount, so a heading inside it would not survive hydration. It is
  off-screen because the visualisation is the title treatment.
- Textures are ~15 MB. Adding more, or dropping in an uncompressed map, is the
  most likely way to regress load time on this page.

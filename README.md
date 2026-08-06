# Moon Phases

Real-time 3D lunar visualization with physics-accurate phase rendering, NASA LRO surface textures, and time-travel controls.

## Features

- **Accurate moon phases:** Calculates phase, illumination fraction, and sun direction using `astronomy-engine` and real orbital mechanics — not a pre-baked animation.
- **Tidally locked rendering:** The moon stays fixed as the Sun's direction rotates around it, matching how phases actually work.
- **NASA LRO textures:** Albedo, normal, and roughness maps sourced from the Lunar Reconnaissance Orbiter for a realistic surface.
- **Time travel:** Scrub ±15 days a day at a time to watch the lunar cycle play out.
- **Location-aware:** The scene frame is built on your zenith, so the crescent leans the right way for your latitude. Melbourne is not London.
- **Verified, not just vibes:** `npm run verify` cross-checks the maths against `Illumination()` and a closed-form Meeus solution implemented independently.

## Getting Started

```bash
git clone https://github.com/mblode/moon.git
cd moon
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Your city is guessed from the browser timezone, so nothing is requested on load. Pick "Use my location" for your exact latitude, or choose a city from the list.

## Tech Stack

- [React](https://react.dev/) — UI framework
- [Vite](https://vitejs.dev/) — build tool and dev server
- [Three.js](https://threejs.org/) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — 3D rendering
- [@react-three/drei](https://github.com/pmndrs/drei) — orbit controls and helpers
- [astronomy-engine](https://github.com/cosinekitty/astronomy) — precise lunar and solar position calculations
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Ultracite](https://github.com/haydenbleasel/ultracite) (oxlint + oxfmt) — linting and formatting

## Textures

NASA Lunar Reconnaissance Orbiter (LRO) textures live in `public/textures/`, as 2048x1024 WebP:

| File | Source |
|------|--------|
| `moon_albedo.webp` | LRO surface albedo |
| `moon_normal.webp` | Surface normal map |
| `moon_roughness.webp` | Surface roughness |

Relief comes from the normal map. There is deliberately no displacement map: the
only LOLA raster to hand was a colour hillshade, which has a fixed sun angle
already baked into it and is not a height field.

## Development

```bash
npm run dev          # Start dev server on port 5173
npm run build        # Type-check and build for production
npm run preview      # Preview the production build locally
npm run lint         # Check for lint and format issues
npm run format       # Auto-fix lint and format issues
npm run check-types  # TypeScript type check only
npm run verify       # Cross-check the orbital maths
```

---

Crafted by [<img src="https://blode.co/avatar-circle.png" width="20" align="top" />](https://blode.co) [Matthew Blode](https://blode.co)

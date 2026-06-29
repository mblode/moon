# Moon Phases

Real-time 3D lunar visualization with physics-accurate phase rendering, NASA LRO surface textures, and time-travel controls.

## Features

- **Accurate moon phases:** Calculates phase, illumination fraction, and sun direction using `astronomy-engine` and real orbital mechanics — not a pre-baked animation.
- **Tidally locked rendering:** The moon stays fixed as the Sun's direction rotates around it, matching how phases actually work.
- **NASA LRO textures:** Albedo, normal, roughness, and displacement maps sourced from the Lunar Reconnaissance Orbiter for a realistic surface.
- **Time travel:** Scrub ±30 days in 2-hour increments to watch the lunar cycle play out.
- **Location-aware:** Requests geolocation and reverse-geocodes via Nominatim to show phase names correctly for the Southern Hemisphere (flipped crescent orientation).
- **Interactive 3D:** Orbit, zoom, and inspect the surface with `@react-three/drei` orbit controls.

## Getting Started

```bash
git clone https://github.com/mblode/moon.git
cd moon
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The app requests browser geolocation on load. Deny or allow — it defaults to Melbourne, Victoria if denied.

## Tech Stack

- [React](https://react.dev/) — UI framework
- [Vite](https://vitejs.dev/) — build tool and dev server
- [Three.js](https://threejs.org/) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — 3D rendering
- [@react-three/drei](https://github.com/pmndrs/drei) — orbit controls and helpers
- [astronomy-engine](https://github.com/cosinekitty/astronomy) — precise lunar and solar position calculations
- [Zustand](https://zustand-demo.pmnd.rs/) — global state
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Biome](https://biomejs.dev/) + [Ultracite](https://github.com/haydenbleasel/ultracite) — linting and formatting

## Textures

NASA Lunar Reconnaissance Orbiter (LRO) textures are required in `public/textures/`:

| File | Source |
|------|--------|
| `moon_anorthositic_crust_albedo.jpg` | LRO surface albedo |
| `moon_anorthositic_crust_normal.jpg` | Surface normal map |
| `moon_anorthositic_crust_roughness.jpg` | Surface roughness |
| `moon_lro_lola_dem_colorhillshade.jpg` | LOLA elevation / displacement |

Additional texture variants (gravity anomalies, slope data, mantle cross-sections) are available in `public/textures/` but not used by default.

## Development

```bash
npm run dev          # Start dev server on port 5173
npm run build        # Type-check and build for production
npm run preview      # Preview the production build locally
npm run lint         # Check for lint and format issues
npm run lint:fix     # Auto-fix lint and format issues
npm run check-types  # TypeScript type check only
```

---

Crafted by [<img src="https://matthewblode.com/avatar-circle.png" width="20" align="top" />](https://matthewblode.com) [Matthew Blode](https://matthewblode.com)

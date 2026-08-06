/**
 * Cross-checks src/lib/astro.ts against independently-derived astronomy.
 *
 * Run with `npm run verify`. Node strips the TypeScript natively, so this
 * imports the real production module rather than a copy of it. Every check
 * below compares solveMoon against a *different* source of truth — closed-form
 * Meeus, or astronomy-engine functions solveMoon does not itself call — so a
 * sign error cannot pass by agreeing with itself.
 */
import {
  Body,
  Illumination,
  Libration,
  MakeTime,
  Observer,
  SearchMoonPhase,
  SiderealTime,
  Equator,
} from "astronomy-engine";

import { geocentricSubEarth, solveMoon } from "../src/lib/astro.ts";

const DEG = Math.PI / 180;
const HOURS = Math.PI / 12;

const SITES = [
  ["London", 51.5074, -0.1278],
  ["Melbourne", -37.8136, 144.9631],
  ["Reykjavik", 64.1466, -21.9426],
  ["Quito", -0.1807, -78.4678],
  ["Tokyo", 35.6762, 139.6503],
  ["Cape Town", -33.9249, 18.4241],
];

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) {
    failures += 1;
  }
  console.log(
    `${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`
  );
};

/** Signed difference between two angles in degrees, in [-180, 180). */
const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/** Meeus 48.5: position angle of the bright limb, measured east of north. */
function meeusChi(time, obs) {
  const m = Equator(Body.Moon, time, obs, true, true);
  const s = Equator(Body.Sun, time, obs, true, true);
  const a0 = m.ra * HOURS;
  const d0 = m.dec * DEG;
  const a1 = s.ra * HOURS;
  const d1 = s.dec * DEG;
  return (
    Math.atan2(
      Math.cos(d1) * Math.sin(a1 - a0),
      Math.sin(d1) * Math.cos(d0) -
        Math.cos(d1) * Math.sin(d0) * Math.cos(a1 - a0)
    ) / DEG
  );
}

/** Meeus 14.1: parallactic angle. */
function meeusQ(time, obs, lat, lon) {
  const m = Equator(Body.Moon, time, obs, true, true);
  const lst = (((SiderealTime(time) + lon / 15) % 24) + 24) % 24;
  const H = (lst - m.ra) * HOURS;
  const d0 = m.dec * DEG;
  return (
    Math.atan2(
      Math.sin(H),
      Math.tan(lat * DEG) * Math.cos(d0) - Math.sin(d0) * Math.cos(H)
    ) / DEG
  );
}

console.log(
  "\n1. Lit fraction vs Illumination() — 6h steps through 2026, 6 sites"
);
{
  let worst = 0;
  let worstAt = "";
  let n = 0;
  const end = Date.UTC(2027, 0, 1);
  for (let ms = Date.UTC(2026, 0, 1); ms < end; ms += 6 * 3600 * 1000) {
    const date = new Date(ms);
    const ref = Illumination(Body.Moon, MakeTime(date)).phase_fraction;
    for (const [site, lat, lon] of SITES) {
      const err = Math.abs(solveMoon({ date, lat, lon }).illumFraction - ref);
      n += 1;
      if (err > worst) {
        worst = err;
        worstAt = `${date.toISOString().slice(0, 16)} ${site}`;
      }
    }
  }
  // Tolerance covers genuine topocentric parallax: Illumination() is geocentric,
  // ours is from where the observer is standing. Ours is the more correct.
  check(
    `max error ${worst.toFixed(4)} over ${n} samples`,
    worst < 0.01,
    `worst at ${worstAt}`
  );
}

console.log("\n2. Bright limb angle vs independent Meeus chi - q");
{
  let worst = 0;
  let worstAt = "";
  for (let day = 0; day < 60; day += 1) {
    const date = new Date(Date.UTC(2026, 5, 1) + day * 13 * 3600 * 1000);
    const time = MakeTime(date);
    for (const [site, lat, lon] of SITES) {
      const obs = new Observer(lat, lon, 0);
      const sol = solveMoon({ date, lat, lon });
      // The identity: screen limb angle = -(chi - q), exactly.
      const resid = Math.abs(
        angDiff(
          sol.limbScreenAngleRad / DEG +
            (meeusChi(time, obs) - meeusQ(time, obs, lat, lon)),
          0
        )
      );
      if (resid > worst) {
        worst = resid;
        worstAt = `${date.toISOString().slice(0, 16)} ${site}`;
      }
    }
  }
  check(
    `max residual ${worst.toFixed(5)} deg`,
    worst < 0.01,
    `worst at ${worstAt}`
  );
}

console.log(
  "\n3. Sub-Earth point faces the camera, with diurnal libration present"
);
{
  let worstOffset = 0;
  let minOffset = Infinity;
  for (let day = 0; day < 40; day += 1) {
    const date = new Date(Date.UTC(2026, 2, 1) + day * 19 * 3600 * 1000);
    for (const [, lat, lon] of SITES) {
      const { bodyAxes } = solveMoon({ date, lat, lon });
      // Observer direction in scene coords is exactly +Z by construction, so
      // the sub-Earth selenographic latitude is asin(z.z) and longitude
      // atan2(y.z, x.z). Its offset from (0,0) is the libration.
      const off = Math.hypot(
        Math.asin(Math.max(-1, Math.min(1, bodyAxes.z[2]))) / DEG,
        Math.atan2(bodyAxes.y[2], bodyAxes.x[2]) / DEG
      );
      worstOffset = Math.max(worstOffset, off);
      minOffset = Math.min(minOffset, off);
    }
  }
  check(
    `libration offset stays within 12 deg (max ${worstOffset.toFixed(2)})`,
    worstOffset < 12
  );
  check(
    `libration is never identically zero (min ${minOffset.toFixed(3)} deg)`,
    minOffset > 0.001,
    "a zero would mean parallax/libration is not modelled"
  );
}

console.log(
  "\n4. Body frame vs Libration() — geocentric, so tolerance is tight"
);
{
  let worstLat = 0;
  let worstLon = 0;
  for (let day = 0; day < 60; day += 1) {
    const date = new Date(Date.UTC(2026, 0, 1) + day * 6 * 86_400_000);
    const ref = Libration(MakeTime(date));
    const got = geocentricSubEarth(date);
    worstLat = Math.max(worstLat, Math.abs(got.lat - ref.elat));
    worstLon = Math.max(worstLon, Math.abs(angDiff(got.lon, ref.elon)));
  }
  check(
    `sub-Earth latitude within 0.05 deg (max ${worstLat.toFixed(4)})`,
    worstLat < 0.05
  );
  check(
    `sub-Earth longitude within 0.05 deg (max ${worstLon.toFixed(4)})`,
    worstLon < 0.05
  );
}

console.log("\n5. Hemisphere flip — the claim the page makes");
{
  const date = SearchMoonPhase(
    45,
    MakeTime(new Date(Date.UTC(2026, 2, 1))),
    40
  ).date;
  const north = solveMoon({ date, lat: 51.5074, lon: -0.1278 });
  const south = solveMoon({ date, lat: -37.8136, lon: 144.9631 });
  const flip = Math.abs(
    angDiff(north.limbScreenAngleRad / DEG, south.limbScreenAngleRad / DEG)
  );
  check(
    `London vs Melbourne limb angle differs by ${flip.toFixed(1)} deg`,
    flip > 150 && flip <= 180,
    `${date.toISOString().slice(0, 16)}, lit ${north.illumFraction.toFixed(3)}`
  );
}

console.log("\n6. The phase name always matches the picture");
{
  const BRACKETS = {
    "New Moon": [0, 0.06],
    "Waxing Crescent": [0, 0.5],
    "First Quarter": [0.44, 0.56],
    "Waxing Gibbous": [0.5, 1],
    "Full Moon": [0.94, 1],
    "Waning Gibbous": [0.5, 1],
    "Last Quarter": [0.44, 0.56],
    "Waning Crescent": [0, 0.5],
  };
  let bad = 0;
  let example = "";
  const end = Date.UTC(2027, 0, 1);
  for (let ms = Date.UTC(2026, 0, 1); ms < end; ms += 3 * 3600 * 1000) {
    const date = new Date(ms);
    const sol = solveMoon({ date, lat: -37.8136, lon: 144.9631 });
    const [lo, hi] = BRACKETS[sol.phaseName];
    if (sol.illumFraction < lo - 0.02 || sol.illumFraction > hi + 0.02) {
      bad += 1;
      example ||= `${date.toISOString().slice(0, 16)} "${sol.phaseName}" at ${sol.illumFraction.toFixed(3)} lit`;
    }
  }
  check(
    `${bad} disagreements in a year of 3-hourly samples`,
    bad === 0,
    example
  );
}

console.log("\n7. Continuity — no branch cuts across a synodic month");
{
  // The scene frame is tied to the observer's zenith, so it legitimately
  // rotates fast when the moon transits near overhead — the same keyhole an
  // alt-az mount has. A flat "never moves more than X per step" bound would
  // therefore fail on correct output. What actually separates smooth-but-fast
  // motion from an atan2 branch cut is scaling: halve the timestep and smooth
  // motion halves with it, while a discontinuity does not shrink at all.
  const angleBetween = (a, b) =>
    Math.acos(
      Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    ) / DEG;

  const sweep = (stepMs, pick) => {
    let worst = 0;
    let at = "";
    let prev = null;
    for (
      let ms = Date.UTC(2026, 6, 1);
      ms < Date.UTC(2026, 7, 1);
      ms += stepMs
    ) {
      const date = new Date(ms);
      const s = solveMoon({ date, lat: -37.8136, lon: 144.9631 });
      if (prev) {
        const a = angleBetween(pick(s), pick(prev));
        if (a > worst) {
          worst = a;
          at = date.toISOString().slice(0, 16);
        }
      }
      prev = s;
    }
    return { worst, at };
  };

  for (const [label, pick] of [
    ["sun direction", (s) => s.sunDir],
    ["lunar pole", (s) => s.bodyAxes.z],
  ]) {
    const coarse = sweep(10 * 60 * 1000, pick);
    const fine = sweep(5 * 60 * 1000, pick);
    const ratio = coarse.worst / fine.worst;
    check(
      `${label} scales with timestep (${coarse.worst.toFixed(3)} deg at 10min, ${fine.worst.toFixed(3)} at 5min, ratio ${ratio.toFixed(2)})`,
      ratio > 1.8 && ratio < 2.2,
      `worst at ${coarse.at}`
    );
  }
}

console.log("\n8. Known 2026 phase events");
{
  const EXPECT = [
    [0, "New Moon", 0],
    [90, "First Quarter", 0.5],
    [180, "Full Moon", 1],
    [270, "Last Quarter", 0.5],
  ];
  for (const [lon, name, lit] of EXPECT) {
    const date = SearchMoonPhase(
      lon,
      MakeTime(new Date(Date.UTC(2026, 5, 1))),
      40
    ).date;
    const sol = solveMoon({ date, lat: 51.5074, lon: -0.1278 });
    check(
      `${date.toISOString().slice(0, 16)} -> "${sol.phaseName}", ${(sol.illumFraction * 100).toFixed(1)}% lit`,
      sol.phaseName === name && Math.abs(sol.illumFraction - lit) < 0.01,
      `expected "${name}" near ${(lit * 100).toFixed(0)}%`
    );
  }
}

console.log(
  failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`
);
// Any throw from solveMoon crashes the run, which is check 9: no exceptions.
process.exit(failures === 0 ? 0 : 1);

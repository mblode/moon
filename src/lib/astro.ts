import {
  Body,
  Equator,
  GeoVector,
  Horizon,
  MakeTime,
  MoonPhase,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  RotationAxis,
  SiderealTime,
  Vector,
} from "astronomy-engine";

export interface Inputs {
  date: Date;
  lat: number;
  lon: number;
  elev?: number;
}

type Vec3 = [number, number, number];

/**
 * Everything the renderer needs, already expressed in scene coordinates.
 *
 * The scene frame is the observer's view: +X is screen right, +Y is the
 * observer's zenith, +Z points back at the camera. Screen-up being the *zenith*
 * rather than celestial north is what makes a crescent lean differently from
 * Melbourne than from London — the equatorial bright-limb angle is nearly the
 * same at both sites, and the whole ~180 degree flip lives in the fact that a
 * southern observer's zenith points the other way relative to the pole.
 */
export interface MoonSolution {
  /** Moon -> Sun unit vector. Place the directional light along this. */
  sunDir: Vec3;

  /** Lunar body frame: x at selenographic (0N, 0E), y at (0N, 90E), z lunar north. */
  bodyAxes: { x: Vec3; y: Vec3; z: Vec3 };

  /** Lit fraction of the visible disk, 0..1. Derived from sunDir, so the number
      beside the moon can never disagree with the moon. */
  illumFraction: number;

  distanceKm: number;
  altitudeDeg: number;
  azimuthDeg: number;

  /** Bright limb angle on screen, radians clockwise from vertical. */
  limbScreenAngleRad: number;

  /** Sun-Moon ecliptic elongation: 0 new, 90 first quarter, 180 full, 270 last. */
  elongationDeg: number;
  isWaxing: boolean;
  phaseName: string;
}

const DEG = Math.PI / 180;
const HOURS = Math.PI / 12;
const AU_KM = 149_597_870.7;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 =>
  scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Right ascension (hours) + declination (degrees) -> unit vector. */
function eq2vec(raHours: number, decDeg: number): Vec3 {
  const ra = raHours * HOURS;
  const dec = decDeg * DEG;
  const cosDec = Math.cos(dec);
  return [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
}

/** Rotate a vector between astronomy-engine reference frames. */
function rotate(rotation: ReturnType<typeof Rotation_EQJ_EQD>, v: Vec3): Vec3 {
  const out = RotateVector(rotation, new Vector(v[0], v[1], v[2], MakeTime(0)));
  return [out.x, out.y, out.z];
}

/**
 * Phase names key off the true ecliptic elongation rather than the lit
 * fraction. Lit fraction changes too slowly near the quarters to bracket them:
 * the old `abs(fraction - 0.5) < 0.05` test called a ~3 day span "First
 * Quarter". Six degrees is a little under half a day either side.
 */
function nameOf(elongationDeg: number): string {
  // Signed angular distance to the target, in [-180, 180).
  const near = (target: number) =>
    Math.abs(((((elongationDeg - target) % 360) + 540) % 360) - 180) < 6;

  if (near(0)) {
    return "New Moon";
  }
  if (near(90)) {
    return "First Quarter";
  }
  if (near(180)) {
    return "Full Moon";
  }
  if (near(270)) {
    return "Last Quarter";
  }
  if (elongationDeg < 90) {
    return "Waxing Crescent";
  }
  if (elongationDeg < 180) {
    return "Waxing Gibbous";
  }
  if (elongationDeg < 270) {
    return "Waning Gibbous";
  }
  return "Waning Crescent";
}

export function solveMoon(i: Inputs): MoonSolution {
  const date = i.date && !Number.isNaN(i.date.getTime()) ? i.date : new Date();
  const time = MakeTime(date);
  const obs = new Observer(i.lat, i.lon, i.elev ?? 0);

  // Both bodies in the same frame — topocentric, of date, aberration corrected.
  // Mixing geocentric J2000 with topocentric of-date is what left the previous
  // bright-limb angle with a residual error.
  const moon = Equator(Body.Moon, time, obs, true, true);
  const sun = Equator(Body.Sun, time, obs, true, true);

  const uM = eq2vec(moon.ra, moon.dec); // observer -> Moon
  const sunDirEq = normalize(
    sub(scale(eq2vec(sun.ra, sun.dec), sun.dist), scale(uM, moon.dist))
  ); // Moon -> Sun

  // The observer's zenith sits at RA = local sidereal time, Dec = latitude.
  const lst = (((SiderealTime(time) + i.lon / 15) % 24) + 24) % 24;
  const zenith = eq2vec(lst, i.lat);

  // Scene basis. Note `cross(uM, up)` and not the reverse: with north as up, a
  // moon on the celestial equator must put *west* on screen right, because you
  // are looking at the sky rather than down at a map.
  const forward = scale(uM, -1);
  let up = sub(zenith, scale(uM, dot(zenith, uM)));
  if (Math.hypot(up[0], up[1], up[2]) < 1e-6) {
    // Moon at the zenith: there is genuinely no "up". Fall back to north.
    const north: Vec3 = [0, 0, 1];
    up = sub(north, scale(uM, dot(north, uM)));
  }
  up = normalize(up);
  const right = normalize(cross(uM, up));
  const toScene = (v: Vec3): Vec3 => [
    dot(v, right),
    dot(v, up),
    dot(v, forward),
  ];

  const sunDir = toScene(sunDirEq);

  // Lunar body frame from the IAU rotation model, which already contains both
  // optical and diurnal libration — no separate Libration() call needed.
  const axis = RotationAxis(Body.Moon, time);
  const poleEqj: Vec3 = [axis.north.x, axis.north.y, axis.north.z];
  const node = normalize(cross([0, 0, 1], poleEqj));
  const spin = axis.spin * DEG;
  const primeEqj = normalize(
    sub(
      scale(node, Math.cos(spin)),
      scale(cross(poleEqj, node), -Math.sin(spin))
    )
  );

  const eqjToEqd = Rotation_EQJ_EQD(time);
  const poleScene = toScene(rotate(eqjToEqd, poleEqj));
  const primeScene = toScene(rotate(eqjToEqd, primeEqj));

  const elongationDeg = MoonPhase(time);
  const horizon = Horizon(time, obs, moon.ra, moon.dec, "normal");

  return {
    sunDir,
    bodyAxes: {
      x: primeScene,
      y: cross(poleScene, primeScene),
      z: poleScene,
    },
    // Rotation preserves angles, so the phase angle is just sunDir's component
    // along the view direction. Lit fraction of a sphere is (1 + cos phase) / 2.
    illumFraction: (1 + sunDir[2]) / 2,
    distanceKm: moon.dist * AU_KM,
    altitudeDeg: horizon.altitude,
    azimuthDeg: horizon.azimuth,
    limbScreenAngleRad: Math.atan2(sunDir[0], sunDir[1]),
    elongationDeg,
    isWaxing: elongationDeg < 180,
    phaseName: nameOf(elongationDeg),
  };
}

/**
 * Geocentric sub-Earth point, in selenographic degrees. Only used by the
 * verification script, which needs a geocentric figure to compare against
 * astronomy-engine's own Libration() — solveMoon's body frame is topocentric,
 * so it legitimately differs from that by up to a degree of diurnal libration.
 */
export function geocentricSubEarth(date: Date): { lat: number; lon: number } {
  const time = MakeTime(date);
  const axis = RotationAxis(Body.Moon, time);
  const pole: Vec3 = [axis.north.x, axis.north.y, axis.north.z];
  const node = normalize(cross([0, 0, 1], pole));
  const spin = axis.spin * DEG;
  const prime = normalize(
    sub(scale(node, Math.cos(spin)), scale(cross(pole, node), -Math.sin(spin)))
  );
  const g = GeoVector(Body.Moon, time, true);
  const toEarth = normalize([-g.x, -g.y, -g.z]);
  return {
    lat: Math.asin(dot(toEarth, pole)) / DEG,
    lon:
      Math.atan2(dot(toEarth, cross(pole, prime)), dot(toEarth, prime)) / DEG,
  };
}

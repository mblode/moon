import * as AE from "astronomy-engine";

export type Inputs = {
  date: Date;
  lat: number;
  lon: number;
  elev?: number;
};

export type MoonSolution = {
  sunDir: [number, number, number]; // unit vector from Moon toward Sun (scene light direction)
  illumFraction: number; // 0..1
  phaseAngleDeg: number; // Sun-Moon-Earth angle
  distanceKm: number;
  parallacticAngleRad: number; // rotation around view axis for apparent orientation
  ra: number;
  dec: number;
  phaseName: string; // Human-readable phase name
  phaseEmoji: string; // Emoji representation
};

/**
 * Unit vector helper
 */
function norm([x, y, z]: [number, number, number]): [number, number, number] {
  const m = Math.hypot(x, y, z) || 1;
  return [x / m, y / m, z / m];
}

/**
 * Normalize hours to [0, 24) range
 */
function normalizeHours(hours: number): number {
  return ((hours % 24) + 24) % 24;
}

/**
 * Convert AE vector (km) to tuple
 */
function vec(v: AE.Vector): [number, number, number] {
  return [v.x, v.y, v.z];
}

/**
 * Determine moon phase name and emoji based on illumination fraction and phase angle
 * Uses astronomically correct phase determination based on Earth-Moon-Sun geometry
 */
function getMoonPhase(
  illumFraction: number,
  phaseAngleDeg: number,
  time: AE.AstroTime,
): { name: string; emoji: string } {
  // ASTRONOMICALLY CORRECT phase determination using lunar longitude
  // From first principles: Moon phases depend on Moon's position relative to Sun as seen from Earth

  // Get lunar longitude (Moon's position in its orbit around Earth)
  // This is the only reliable way to determine waxing vs waning
  const moonGeo = AE.GeoVector(AE.Body.Moon, time, false); // Geocentric position
  const sunGeo = AE.GeoVector(AE.Body.Sun, time, false); // Geocentric position

  // Calculate elongation angle: angular separation between Moon and Sun as seen from Earth
  // dot(moonGeo, sunGeo) = |moonGeo| * |sunGeo| * cos(elongation)
  const moonMag = Math.sqrt(
    moonGeo.x * moonGeo.x + moonGeo.y * moonGeo.y + moonGeo.z * moonGeo.z,
  );
  const sunMag = Math.sqrt(
    sunGeo.x * sunGeo.x + sunGeo.y * sunGeo.y + sunGeo.z * sunGeo.z,
  );
  const dotProduct =
    moonGeo.x * sunGeo.x + moonGeo.y * sunGeo.y + moonGeo.z * sunGeo.z;
  const elongationRad = Math.acos(
    Math.max(-1, Math.min(1, dotProduct / (moonMag * sunMag))),
  );
  const elongationDeg = elongationRad * (180 / Math.PI);

  // To determine which side of the Sun the Moon is on, we need the cross product
  // cross(sunGeo, moonGeo) gives us the direction of the Moon relative to Sun
  const crossZ = sunGeo.x * moonGeo.y - sunGeo.y * moonGeo.x; // Z component of cross product

  // FUNDAMENTAL ASTRONOMICAL PRINCIPLE:
  // Waxing: Moon is ahead of Sun in orbital motion (elongation 0° to 180°)
  // Waning: Moon is behind Sun in orbital motion (elongation 180° to 360°)
  const isWaxing = crossZ > 0; // Positive cross product = Moon ahead of Sun = Waxing

  // Exact phase boundaries
  if (illumFraction < 0.01) {
    return { name: "New Moon", emoji: "🌑" };
  }

  if (illumFraction > 0.99) {
    return { name: "Full Moon", emoji: "🌕" };
  }

  // Quarter moon detection: First Quarter ~90° elongation, Last Quarter ~270° elongation
  if (Math.abs(illumFraction - 0.5) < 0.05) {
    // Additional verification using elongation angle
    if (isWaxing && elongationDeg > 75 && elongationDeg < 105) {
      return { name: "First Quarter", emoji: "🌓" };
    } else if (!isWaxing && elongationDeg > 75 && elongationDeg < 105) {
      return { name: "Last Quarter", emoji: "🌗" };
    }
    // Fallback to illumination-based determination
    return isWaxing
      ? { name: "First Quarter", emoji: "🌓" }
      : { name: "Last Quarter", emoji: "🌗" };
  }

  // Crescent phases (< 50% illumination)
  if (illumFraction < 0.5) {
    return isWaxing
      ? { name: "Waxing Crescent", emoji: "🌒" }
      : { name: "Waning Crescent", emoji: "🌘" };
  }

  // Gibbous phases (> 50% illumination)
  return isWaxing
    ? { name: "Waxing Gibbous", emoji: "🌔" }
    : { name: "Waning Gibbous", emoji: "🌖" };
}

/**
 * Get location name from coordinates using reverse geocoding
 */
export async function getLocationName(
  lat: number,
  lon: number,
): Promise<string> {
  try {
    // Using OpenStreetMap Nominatim API for reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
    );
    const data = await response.json();

    if (data.address) {
      const { city, town, village, county, state, country } = data.address;
      const place = city || town || village || county;
      const region = state || country;

      if (place && region) {
        return `${place}, ${region}`;
      } else if (place) {
        return place;
      } else if (region) {
        return region;
      }
    }

    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  } catch (error) {
    console.warn("Geocoding failed:", error);
    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  }
}

/**
 * Compute Moon visual parameters for an observer and time.
 * Scene convention:
 *  - Place the Moon at the origin.
 *  - DirectionalLight position = sunDir (from Moon → Sun).
 *  - Rotate the rendered Moon around camera forward axis by -parallacticAngle for correct N/S orientation.
 */
export function solveMoon(i: Inputs): MoonSolution {
  const elev = i.elev ?? 0;
  const obs = new AE.Observer(i.lat, i.lon, elev);
  const time = AE.MakeTime(i.date);

  // DIRECT APPROACH: Calculate Moon age and use for lighting
  // Based on orbital mechanics like moontool.c
  
  const illum = AE.Illumination(AE.Body.Moon, time);
  const illumFraction = illum.phase_fraction;
  const phaseAngleDeg = illum.phase_angle;
  
  // Get Moon position for observer calculations  
  const moonEquatorial = AE.Equator(AE.Body.Moon, time, obs, true, true);
  
  // Use phase angle as Moon age (position in cycle)
  // 0° = New Moon, 90° = First Quarter, 180° = Full Moon, 270° = Last Quarter
  const moonAgeRad = phaseAngleDeg * (Math.PI / 180);
  
  // Direct lighting based on Moon age:
  // New Moon (0°): Sun direction = [0, 0, 1] (from behind Moon toward camera)
  // First Quarter (90°): Sun direction = [1, 0, 0] (from right side)
  // Full Moon (180°): Sun direction = [0, 0, -1] (from camera toward Moon)
  // Last Quarter (270°): Sun direction = [-1, 0, 0] (from left side)
  const sunDir: [number, number, number] = [
    Math.sin(moonAgeRad),   // X: 0 (new) -> 1 (first quarter) -> 0 (full) -> -1 (last quarter)
    0,                      // Y: keep simple for now
    Math.cos(moonAgeRad)    // Z: 1 (new) -> 0 (quarters) -> -1 (full)
  ];

  // Moon equatorial coordinates already calculated above

  // Moon distance from observer
  const distanceKm = moonEquatorial.dist * 149597870.7; // Convert AU to km

  // Illumination/phase already calculated above

  // Use the Moon equatorial coordinates for phases and parallactic angle
  const ra = moonEquatorial.ra;
  const dec = moonEquatorial.dec;

  // Local sidereal time & hour angle calculation
  // This is critical for accurate parallactic angle computation
  const gst = AE.SiderealTime(time); // Greenwich sidereal time in hours
  const lst = normalizeHours(gst + i.lon / 15.0); // Local sidereal time = GST + longitude/15
  const H = normalizeHours(lst - ra) * (Math.PI / 12.0); // hour angle in radians

  // Parallactic angle calculation using standard astronomical formula
  // This determines the rotation of the Moon's field relative to the zenith
  // Formula from astronomical references (Meeus, Astronomical Algorithms):
  // tan(q) = sin(H) / (tan(φ)cos(δ) - sin(δ)cos(H))
  // where H = hour angle, φ = latitude, δ = declination
  const phi = i.lat * (Math.PI / 180); // latitude in radians
  const decRad = dec * (Math.PI / 180); // declination in radians

  const sinH = Math.sin(H);
  const cosH = Math.cos(H);
  const tanPhi = Math.tan(phi);
  const cosDec = Math.cos(decRad);
  const sinDec = Math.sin(decRad);

  // CORRECTED parallactic angle formula with proper astronomical sign convention
  // Positive q means north pole of Moon tilted toward east
  const denominator = tanPhi * cosDec - sinDec * cosH;
  const q = Math.atan2(sinH, denominator); // radians

  // Determine waxing vs waning from phase angle (consistent with lighting)
  // Phase angle 0° to 180°: Waxing (illumination increasing)
  // Phase angle 180° to 360°: Waning (illumination decreasing)
  const isWaxing = phaseAngleDeg <= 180;
  
  // Determine phase name based on illumination fraction and waxing/waning
  let phaseName: string;
  let phaseEmoji: string;
  
  if (illumFraction < 0.01) {
    phaseName = 'New Moon';
    phaseEmoji = '🌑';
  } else if (illumFraction > 0.99) {
    phaseName = 'Full Moon';
    phaseEmoji = '🌕';
  } else if (Math.abs(illumFraction - 0.5) < 0.05) {
    // Quarter moons
    if (isWaxing) {
      phaseName = 'First Quarter';
      phaseEmoji = '🌓';
    } else {
      phaseName = 'Last Quarter';
      phaseEmoji = '🌗';
    }
  } else if (illumFraction < 0.5) {
    // Crescent phases
    if (isWaxing) {
      phaseName = 'Waxing Crescent';
      phaseEmoji = '🌒';
    } else {
      phaseName = 'Waning Crescent';
      phaseEmoji = '🌘';
    }
  } else {
    // Gibbous phases
    if (isWaxing) {
      phaseName = 'Waxing Gibbous';
      phaseEmoji = '🌔';
    } else {
      phaseName = 'Waning Gibbous';
      phaseEmoji = '🌖';
    }
  }
  
  const phase = { name: phaseName, emoji: phaseEmoji };

  return {
    sunDir,
    illumFraction,
    phaseAngleDeg,
    distanceKm,
    parallacticAngleRad: q,
    ra,
    dec,
    phaseName: phase.name,
    phaseEmoji: phase.emoji,
  };
}

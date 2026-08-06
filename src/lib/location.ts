export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** Times are shown where you are viewing from, so picking London shows
      London's clock rather than yours. Undefined means use the browser's. */
  tz?: string;
}

/**
 * Somewhere to fall back to, and the list offered when geolocation is refused
 * or unavailable. Spread across both hemispheres on purpose: latitude is what
 * flips the crescent, so the picker is the recovery path for the one thing a
 * timezone cannot tell us.
 */
export const PLACES: Place[] = [
  {
    name: "Melbourne",
    lat: -37.8136,
    lon: 144.9631,
    tz: "Australia/Melbourne",
  },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" },
  { name: "Auckland", lat: -36.8485, lon: 174.7633, tz: "Pacific/Auckland" },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241, tz: "Africa/Johannesburg" },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333, tz: "America/Sao_Paulo" },
  { name: "Singapore", lat: 1.3521, lon: 103.8198, tz: "Asia/Singapore" },
  { name: "London", lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
  { name: "New York", lat: 40.7128, lon: -74.006, tz: "America/New_York" },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
  { name: "Reykjavík", lat: 64.1466, lon: -21.9426, tz: "Atlantic/Reykjavik" },
];

/**
 * Best guess at where the visitor is without asking them anything.
 *
 * The timezone gives a city name for free — no permission prompt, no network,
 * and it still works when location is denied. It is only a label, though: if
 * the zone is not one we have coordinates for we keep the name but fall back to
 * Melbourne's coordinates, and the UI has to stay honest that the picture is
 * not yet local.
 */
export function guessPlace(): { place: Place; exact: boolean } {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const city = zone.split("/").pop()?.replaceAll("_", " ") ?? "";
  const known = PLACES.find((p) => p.name === city);
  if (known) {
    return { place: known, exact: true };
  }
  return {
    place: city ? { ...PLACES[0], name: city, tz: zone } : PLACES[0],
    exact: false,
  };
}

/** Resolve the browser's geolocation. Rejects rather than hanging. */
export function locate(): Promise<{ lat: number; lon: number }> {
  // oxlint-disable-next-line promise/avoid-new -- geolocation is callback-based
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 }
    );
  });
}

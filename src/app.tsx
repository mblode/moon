import { MakeTime, SearchMoonPhase } from "astronomy-engine";
import { useCallback, useEffect, useMemo, useState } from "react";

import MoonScene from "./components/moon-scene";
import { solveMoon } from "./lib/astro";
import { guessPlace, locate, PLACES, type Place } from "./lib/location";

const HOUR_MS = 3_600_000;
const SCRUB_HOURS = 360; // 15 days either way; a synodic month is 29.5

const TEXTURES = {
  color: `${import.meta.env.BASE_URL}textures/moon_albedo.webp`,
  normal: `${import.meta.env.BASE_URL}textures/moon_normal.webp`,
  roughness: `${import.meta.env.BASE_URL}textures/moon_roughness.webp`,
};

// Formatted in the timezone of the place you are viewing from, so the clock is
// the one you would be reading if you were standing there. That removes the
// need to print an offset like GMT+10 next to a London view.
const dateTimeIn = (tz?: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
const shortDate = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];
const compassOf = (az: number) =>
  COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/** Never show "100% lit" beside "Waxing Gibbous". */
function litLabel(fraction: number, phaseName: string): string {
  if (phaseName === "Full Moon") {
    return "100% lit";
  }
  if (phaseName === "New Moon") {
    return "0% lit";
  }
  return `${Math.min(99, Math.max(1, Math.round(fraction * 100)))}% lit`;
}

function relativeLabel(hours: number): string {
  if (hours === 0) {
    return "now";
  }
  const days = Math.floor(Math.abs(hours) / 24);
  const rest = Math.abs(hours) % 24;
  const parts = [
    days ? `${days} day${days === 1 ? "" : "s"}` : "",
    rest ? `${rest} hour${rest === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return `${parts.join(" ")} ${hours < 0 ? "ago" : "from now"}`;
}

export default function App() {
  const [origin, setOrigin] = useState(guessPlace);
  const { place, exact } = origin;
  const [offsetHours, setOffsetHours] = useState(0);
  const [ready, setReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // "Now" has to keep moving, or the page silently drifts from the sky.
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setNowMs(Date.now());
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000));
    return () => clearTimeout(timer);
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const { lat, lon } = await locate();
      setOrigin({ place: { name: "Your location", lat, lon }, exact: true });
    } catch {
      // Denied or unavailable. The city picker is already the way out, so
      // there is nothing to announce.
    }
  }, []);

  // Only ask silently if the user has already granted it; otherwise wait for
  // them to choose "Use my location" rather than firing a prompt on first paint.
  useEffect(() => {
    (async () => {
      try {
        const status = await navigator.permissions?.query({
          name: "geolocation",
        });
        if (status?.state === "granted") {
          await requestLocation();
        }
      } catch {
        // Permissions API unsupported; the picker still works.
      }
    })();
  }, [requestLocation]);

  const date = useMemo(
    () => new Date(nowMs + offsetHours * HOUR_MS),
    [nowMs, offsetHours]
  );

  const sol = useMemo(
    () => solveMoon({ date, lat: place.lat, lon: place.lon }),
    [date, place.lat, place.lon]
  );

  // Two searches a minute, not one per drag frame. Searching from 15 days back
  // keeps the hit inside the slider's range.
  const events = useMemo(() => {
    const from = MakeTime(new Date(nowMs - SCRUB_HOURS * HOUR_MS));
    const at = (lon: number) => SearchMoonPhase(lon, from, 40)?.date;
    return { full: at(180), next: at(0) };
  }, [nowMs]);

  const jumpTo = (target?: Date) => {
    if (target) {
      setOffsetHours(
        Math.max(
          -SCRUB_HOURS,
          Math.min(
            SCRUB_HOURS,
            Math.round((target.getTime() - nowMs) / HOUR_MS)
          )
        )
      );
    }
  };

  useEffect(() => setReady(true), []);

  const lit = litLabel(sol.illumFraction, sol.phaseName);
  const dateTime = dateTimeIn(place.tz);
  // Answers "can I see it, and where do I look" without a bare number to decode.
  const whereToLook =
    sol.altitudeDeg <= 0
      ? "below the horizon"
      : `${compassOf(sol.azimuthDeg)}, ${Math.round(sol.altitudeDeg)}° up`;

  return (
    <div className="page">
      <header className="bar">
        <a
          className="ghlink"
          href="https://github.com/mblode/moon"
          rel="noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" height="18" viewBox="0 0 16 16" width="18">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
              fill="currentColor"
            />
          </svg>
          <span className="sr-only">Source on GitHub</span>
        </a>
      </header>

      <div
        aria-label={`The moon, ${sol.phaseName.toLowerCase()}, ${lit}, seen from ${place.name}`}
        className="stage"
        data-ready={ready || undefined}
        role="img"
      >
        <MoonScene sol={sol} textures={TEXTURES} />
      </div>

      <div className="console">
        <p className="readout readout--lead">
          {sol.phaseName} <span className="dot">·</span> {lit}
        </p>
        <p className="readout">
          {dateTime.format(date)} <span className="dot">·</span>{" "}
          {number.format(sol.distanceKm)} km away
        </p>
        {/* Only the phase name is announced. React mutates this text node just
            four times per full sweep, so it self-throttles; putting the live
            numbers in here would queue an announcement per drag event. */}
        <output className="sr-only">{sol.phaseName}</output>

        <div className="scrub">
          <label className="sr-only" htmlFor="time">
            Time
          </label>
          <input
            aria-valuetext={`${dateTime.format(date)}, ${relativeLabel(offsetHours)}`}
            // Or a reload restores the previous thumb position and silently
            // drops you off "now".
            autoComplete="off"
            className="scrub__range"
            id="time"
            max={SCRUB_HOURS}
            min={-SCRUB_HOURS}
            onChange={(e) => setOffsetHours(Number(e.target.value))}
            // Whole days. The scene frame is zenith-up, so the disk rolls once
            // per day as the earth turns — real, but scrubbing by hours walks
            // straight through it and the moon tumbles (up to 54 degrees per
            // hourly step near transit, ~30 full turns end to end). Holding the
            // time of day constant leaves only the slow drift, about 45 degrees
            // across the whole range, and the phase becomes the visible change.
            // The chips still set exact event times; a controlled value is free
            // to sit off-step.
            step={24}
            type="range"
            value={offsetHours}
          />
          <div aria-hidden="true" className="scrub__ticks">
            <span>−15 days</span>
            <span>now</span>
            <span>+15 days</span>
          </div>
        </div>

        <div className="chips">
          <button
            disabled={offsetHours === 0}
            onClick={() => setOffsetHours(0)}
            type="button"
          >
            Now
          </button>
          {events.full && (
            <button onClick={() => jumpTo(events.full)} type="button">
              Full moon {shortDate.format(events.full)}
            </button>
          )}
          {events.next && (
            <button onClick={() => jumpTo(events.next)} type="button">
              New moon {shortDate.format(events.next)}
            </button>
          )}
        </div>

        <p className="where">
          <label className="where__label" htmlFor="place">
            View from
          </label>
          <select
            id="place"
            onChange={(e) => {
              if (e.target.value === "__locate") {
                requestLocation();
                return;
              }
              const found = PLACES.find(
                (p: Place) => p.name === e.target.value
              );
              if (found) {
                setOrigin({ place: found, exact: true });
              }
            }}
            value={PLACES.some((p) => p.name === place.name) ? place.name : ""}
          >
            {!exact && <option value="">{place.name} (approx)</option>}
            {place.name === "Your location" && (
              <option value="">Your location</option>
            )}
            <option value="__locate">Use my location</option>
            {PLACES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="where__detail">
            <span className="dot">·</span> {whereToLook}
          </span>
        </p>
      </div>
    </div>
  );
}

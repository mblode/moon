"use client";

import { ArrowLeftIcon, ArrowRightIcon, GithubIcon } from "blode-icons-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { solveMoon } from "@/lib/astro";
import { guessPlace, locate, PLACES, type Place } from "@/lib/location";
import { cn } from "@/lib/utils";

// WebGL has nothing to render on the server, and r3f has no SSR path.
const MoonScene = dynamic(() => import("@/components/moon-scene"), {
  ssr: false,
});

const HOUR_MS = 3_600_000;
const SCRUB_HOURS = 360; // 15 days either way; a synodic month is 29.5

const TEXTURES = {
  color: "/moon/textures/moon_albedo.webp",
  normal: "/moon/textures/moon_normal.webp",
  roughness: "/moon/textures/moon_roughness.webp",
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

export function MoonApp() {
  // Cache Components makes Date.now() during render a hard build error, and a
  // timezone read on the server would not match the client anyway. Both resolve
  // after hydration; Melbourne is the deterministic default until then.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [origin, setOrigin] = useState<{ place: Place; exact: boolean }>({
    place: PLACES[0],
    exact: false,
  });
  const { place } = origin;
  const [offsetHours, setOffsetHours] = useState(0);

  useEffect(() => {
    setOrigin(guessPlace());
    // "Now" has to keep moving, or the page silently drifts from the sky.
    let timer: number;
    const tick = () => {
      setNowMs(Date.now());
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    tick();
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
    () => new Date((nowMs ?? 0) + offsetHours * HOUR_MS),
    [nowMs, offsetHours]
  );

  const sol = useMemo(
    () => solveMoon({ date, lat: place.lat, lon: place.lon }),
    [date, place.lat, place.lon]
  );

  const ready = nowMs !== null;
  const atNow = offsetHours === 0;
  const lit = litLabel(sol.illumFraction, sol.phaseName);
  const dateTime = dateTimeIn(place.tz);
  // Answers "can I see it, and where do I look" without a bare number to decode.
  const whereToLook =
    sol.altitudeDeg <= 0
      ? "below the horizon"
      : `${compassOf(sol.azimuthDeg)}, ${Math.round(sol.altitudeDeg)}° up`;

  return (
    <div className="grid min-h-dvh grid-rows-[48px_1fr_auto] md:block">
      <header className="scrim-top z-2 flex items-center justify-end px-4 md:fixed md:inset-x-0 md:top-0">
        <a
          className="inline-flex items-center rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
          href="https://github.com/mblode/moon"
          rel="noreferrer"
          target="_blank"
        >
          <GithubIcon aria-hidden="true" className="size-5" />
          <span className="sr-only">Source on GitHub</span>
        </a>
      </header>

      <div
        aria-label={`The moon, ${sol.phaseName.toLowerCase()}, ${lit}, seen from ${place.name}`}
        className={`relative min-h-0 transition-opacity duration-700 md:fixed md:inset-0 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        role="img"
      >
        {ready && <MoonScene sol={sol} textures={TEXTURES} />}
      </div>

      <div className="scrim-bottom z-2 grid justify-items-center gap-3 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center md:fixed md:inset-x-0 md:bottom-0 md:pb-6">
        <p className="m-0 text-[1.375rem] tabular-nums tracking-[-0.011em]">
          {sol.phaseName} <span className="px-[0.15em] opacity-40">·</span>{" "}
          {lit}
        </p>
        <p className="m-0 text-muted-foreground text-sm tabular-nums">
          {ready ? dateTime.format(date) : " "}{" "}
          <span className="px-[0.15em] opacity-40">·</span>{" "}
          {number.format(sol.distanceKm)} km away
        </p>
        {/* Only the phase name is announced. React mutates this text node just
            four times per full sweep, so it self-throttles; putting the live
            numbers in here would queue an announcement per drag event. */}
        <output className="sr-only">{sol.phaseName}</output>

        <div className="w-full max-w-[640px]">
          <label className="sr-only" htmlFor="time">
            Time
          </label>
          <input
            aria-valuetext={`${ready ? dateTime.format(date) : ""}, ${relativeLabel(offsetHours)}`}
            // Or a reload restores the previous thumb position and silently
            // drops you off "now".
            autoComplete="off"
            className="scrub-range"
            id="time"
            max={SCRUB_HOURS}
            min={-SCRUB_HOURS}
            onChange={(e) => setOffsetHours(Number(e.target.value))}
            // Whole days. The scene frame is zenith-up, so the disk rolls once
            // per day as the earth turns; scrubbing by hours walks straight
            // through it and the moon tumbles (up to 54 degrees per hourly step
            // near transit, ~30 full turns end to end). Holding the time of day
            // constant leaves only the slow drift, about 45 degrees across the
            // whole range. The chips still set exact event times; a controlled
            // value is free to sit off-step.
            step={24}
            type="range"
            value={offsetHours}
          />
          <div
            aria-hidden="true"
            className="-mt-2 flex justify-between text-[0.6875rem] text-muted-foreground"
          >
            <span>−15 days</span>
            <span>now</span>
            <span>+15 days</span>
          </div>
        </div>

        {/* One way back, pointing the way you would travel to get there: left
            if you are ahead of now, right if you are behind it. Kept mounted
            and hidden at zero so the console does not resize under the moon. */}
        <Button
          aria-hidden={atNow}
          className={cn(atNow && "invisible")}
          disabled={atNow}
          onClick={() => setOffsetHours(0)}
          size="sm"
          variant="ghost"
        >
          {offsetHours > 0 ? (
            <ArrowLeftIcon data-icon="inline-start" />
          ) : (
            <ArrowRightIcon data-icon="inline-start" />
          )}
          Now
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground text-sm">
          <span id="place-label">View from</span>
          <Select
            onValueChange={(value: string) => {
              if (value === "__locate") {
                requestLocation();
                return;
              }
              const found = PLACES.find((p: Place) => p.name === value);
              if (found) {
                setOrigin({ place: found, exact: true });
              }
            }}
            value={PLACES.some((p) => p.name === place.name) ? place.name : ""}
          >
            <SelectTrigger
              aria-labelledby="place-label"
              className="w-40"
              size="sm"
            >
              <SelectValue placeholder={place.name} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__locate">Use my location</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Cities</SelectLabel>
                {PLACES.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="px-[0.15em] opacity-40">·</span>
          <span className="tabular-nums">{whereToLook}</span>
        </div>
      </div>
    </div>
  );
}

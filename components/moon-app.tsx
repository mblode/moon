"use client";

import { ArrowLeftIcon, ArrowRightIcon, GithubIcon } from "blode-icons-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  dayForScroll,
  scrollForDay,
  type ScrubberHandle,
  TimeScrubber,
  TRACK_STYLE,
} from "@/components/time-scrubber";
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

const DAY_MS = 86_400_000;
/** How long after the last scroll event the sky is considered to have settled. */
const SETTLE_MS = 140;

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
  const [offsetDays, setOffsetDays] = useState(0);

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
    () => new Date((nowMs ?? 0) + offsetDays * DAY_MS),
    [nowMs, offsetDays]
  );

  const sol = useMemo(
    () => solveMoon({ date, lat: place.lat, lon: place.lon }),
    [date, place.lat, place.lon]
  );

  /*
   * The sky is the scrub surface now that the moon no longer rotates, and it is
   * a real scroll container on the ruler's own track rather than a hand-written
   * drag. That is what makes the two the same gesture: the browser supplies the
   * momentum and the rubber-band at the ends, and we mirror whatever position
   * it reaches onto the ruler, so the ruler glides under the needle instead of
   * stepping a day at a time.
   */
  const scrubber = useRef<ScrubberHandle>(null);
  const sky = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const streaming = useRef(false);
  // Set while we position the sky ourselves, so the scroll that causes is not
  // read back as the user scrubbing.
  const settingSky = useRef(false);

  const alignSky = useCallback((days: number) => {
    const el = sky.current;
    if (!el) {
      return;
    }
    settingSky.current = true;
    el.scrollLeft = scrollForDay(days);
    requestAnimationFrame(() => {
      settingSky.current = false;
    });
  }, []);

  // Centre on mount, and follow the ruler and the back-to-now button. Skipped
  // while the sky is the one driving, or we would fight the finger.
  useEffect(() => {
    if (!streaming.current) {
      alignSky(offsetDays);
    }
  }, [offsetDays, alignSky]);

  useEffect(() => () => clearTimeout(settle.current), []);

  const onSkyScroll = () => {
    const el = sky.current;
    if (!el || settingSky.current) {
      return;
    }
    if (!streaming.current) {
      streaming.current = true;
      scrubber.current?.beginDrag();
    }
    scrubber.current?.moveTo(el.scrollLeft);
    const day = dayForScroll(el.scrollLeft);
    if (day !== offsetDays) {
      setOffsetDays(day);
    }
    // Momentum keeps firing scroll events, so the gesture is over only once
    // they stop. Then both surfaces settle onto the same whole day.
    clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      streaming.current = false;
      scrubber.current?.endDrag();
      alignSky(dayForScroll(el.scrollLeft));
    }, SETTLE_MS);
  };

  // A mouse cannot drag a scroll container, so it still needs a drag. Touch is
  // left to the browser, whose momentum beats anything we would write.
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    on: boolean;
  } | null>(null);

  const onSkyPointerDown = (e: React.PointerEvent) => {
    const el = sky.current;
    if (!el || e.pointerType === "touch") {
      return;
    }
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      on: false,
    };
  };

  const onSkyPointerMove = (e: React.PointerEvent) => {
    const el = sky.current;
    const d = drag.current;
    if (!(el && d)) {
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.on) {
      // Only claim the gesture once it is clearly sideways, so a vertical drag
      // still scrolls the page through to the prose.
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) {
        return;
      }
      d.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = d.left - dx;
  };

  const onSkyPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.on) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    drag.current = null;
  };

  const ready = nowMs !== null;
  const atNow = offsetDays === 0;
  const lit = litLabel(sol.illumFraction, sol.phaseName);
  const dateTime = dateTimeIn(place.tz);
  // Answers "can I see it, and where do I look" without a bare number to decode.
  const whereToLook =
    sol.altitudeDeg <= 0
      ? "below the horizon"
      : `${compassOf(sol.azimuthDeg)}, ${Math.round(sol.altitudeDeg)}° up`;

  return (
    // grid-cols-1 rather than the implicit auto column: an auto track is
    // minmax(auto, max-content) and never clamps to the container, so the
    // console's 640px cap became the page's width and overflowed every phone.
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_1fr_auto] overlay:block">
      <header className="scrim-top z-2 flex min-h-12 items-center justify-end px-gutter pt-[env(safe-area-inset-top)] overlay:fixed overlay:inset-x-0 overlay:top-0">
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
        className={cn(
          "relative min-h-0 select-none transition-opacity duration-700 overlay:fixed overlay:inset-0",
          ready ? "opacity-100" : "opacity-0"
        )}
        role="img"
      >
        {/* Absolute so the canvas contributes no intrinsic height. three bakes
            a pixel height onto the <canvas>, and a 1fr row falls back to its
            content's max-content whenever the grid's own height is indefinite,
            so an in-flow canvas pins the row at whatever height it was last
            given and never shrinks again after a rotation. */}
        <div className="absolute inset-0">
          {ready && <MoonScene sol={sol} textures={TEXTURES} />}
        </div>

        {/* Sits over the canvas, which has nothing to click. touch-pan-x with
            touch-pan-y lets the browser axis-lock, so a sideways swipe scrubs
            and a vertical one still scrolls the page through to the prose.
            The ruler carries the accessible control, so this is hidden. */}
        <div
          aria-hidden="true"
          className="no-scrollbar absolute inset-0 cursor-grab touch-pan-x touch-pan-y overflow-x-auto overflow-y-hidden overscroll-x-contain active:cursor-grabbing"
          onPointerCancel={onSkyPointerUp}
          onPointerDown={onSkyPointerDown}
          onPointerMove={onSkyPointerMove}
          onPointerUp={onSkyPointerUp}
          onScroll={onSkyScroll}
          ref={sky}
        >
          <div className="h-full" style={TRACK_STYLE} />
        </div>
      </div>

      <div className="scrim-bottom z-2 grid grid-cols-1 justify-items-center gap-3 px-gutter pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center overlay:fixed overlay:inset-x-0 overlay:bottom-0 overlay:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Exactly the button's own width, so the readout clears it instead of
            being overlapped on a small phone. The button is absolutely
            positioned against the padding box, so this does not move it, and
            the icon's own inset supplies the visual gap. */}
        <div className="relative w-full max-w-[640px] px-9">
          <p className="m-0 text-[1.375rem] tabular-nums tracking-[-0.011em]">
            {sol.phaseName} <span className="px-[0.15em] opacity-40">·</span>{" "}
            {lit}
          </p>
          <p className="m-0 text-muted-foreground text-sm tabular-nums">
            {ready ? dateTime.format(date) : " "}{" "}
            <span className="px-[0.15em] opacity-40">·</span>{" "}
            {number.format(sol.distanceKm)} km away
          </p>

          {/* Beside the readout rather than under the ruler, pointing the
              way you would travel to get back. Kept mounted at zero so the
              console does not resize under the moon. */}
          <Button
            aria-label="Back to now"
            className={cn(
              "-translate-y-1/2 absolute top-1/2 rounded-full",
              // On the side it takes you toward.
              offsetDays > 0 ? "left-0" : "right-0",
              atNow && "invisible"
            )}
            disabled={atNow}
            onClick={() => setOffsetDays(0)}
            size="icon-sm"
            variant="outline"
          >
            {offsetDays > 0 ? <ArrowLeftIcon /> : <ArrowRightIcon />}
          </Button>
        </div>
        {/* Only the phase name is announced. React mutates this text node just
            four times per full sweep, so it self-throttles; putting the live
            numbers in here would queue an announcement per drag event. */}
        <output className="sr-only">{sol.phaseName}</output>

        <TimeScrubber
          baseMs={nowMs}
          handleRef={scrubber}
          key="scrubber"
          offsetDays={offsetDays}
          onOffsetChange={setOffsetDays}
        />

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

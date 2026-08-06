"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/**
 * A ruler you scrub sideways, in the manner of the iOS Weather moon view.
 *
 * Ticks are one day apart on purpose. The scene frame is zenith-up, so the disk
 * rolls once per day as the earth turns; sub-day ticks walk straight through
 * that roll and the moon tumbles (up to 54 degrees per hourly step near
 * transit). Holding the time of day constant leaves only the slow drift.
 *
 * "Infinite" here is two years either way. That is far past the point anyone
 * will drag to, and a real scroll range keeps native momentum on touch without
 * the usual recentring trick.
 */
export const DAY_PX = 56;
const RANGE_DAYS = 730;
const TOTAL_DAYS = RANGE_DAYS * 2 + 1;

/**
 * Both scrub surfaces run on an identically sized track, which is what lets one
 * mirror the other's scrollLeft verbatim. The leading margin is a percentage of
 * each scroller's own width, and it cancels out of the mapping below, so the
 * two stay interchangeable even though the sky is the full viewport and the
 * ruler is at most 640px.
 */
export const TRACK_STYLE = {
  width: TOTAL_DAYS * DAY_PX,
  marginInline: "calc(50% - 1px)",
} as const;

/** Scroll position that centres a day under the needle, and its inverse. */
export const scrollForDay = (day: number) => (day + RANGE_DAYS) * DAY_PX;
export const dayForScroll = (scrollLeft: number) =>
  Math.round(scrollLeft / DAY_PX) - RANGE_DAYS;

/** Lets the sky drive the ruler as if the ruler were being dragged directly. */
export interface ScrubberHandle {
  /** Suspend snapping; the caller is about to stream positions in. */
  beginDrag: () => void;
  moveTo: (scrollLeft: number) => void;
  /** Restore snapping and settle onto the nearest whole day. */
  endDrag: () => void;
}

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayNum = new Intl.DateTimeFormat(undefined, { day: "numeric" });

interface Props {
  offsetDays: number;
  onOffsetChange: (days: number) => void;
  baseMs: number | null;
  handleRef?: React.Ref<ScrubberHandle>;
}

export function TimeScrubber({
  offsetDays,
  onOffsetChange,
  baseMs,
  handleRef,
}: Props) {
  const track = useRef<HTMLDivElement>(null);
  // True while the sky is streaming positions in. The follow effect below has
  // to stand down, or it fights the mirror a frame at a time.
  const externalDrag = useRef(false);
  const frame = useRef(0);
  // Suppresses the scroll handler while we are the ones moving the scroller.
  const settingRef = useRef(false);
  const readyRef = useRef(false);
  const [labelRange, setLabelRange] = useState({ from: -20, to: 20 });

  const anim = useRef(0);
  const animating = useRef(false);
  // Set by the keyboard handler: stepping a day should never animate.
  const instantNext = useRef(false);

  /**
   * scroll-behavior: smooth gives no control over duration, and a two year
   * jump under it takes an age. Driving scrollLeft on rAF lets the flight be
   * capped, and lets the date keep updating on the way, so the moon animates
   * back through its phases rather than cutting.
   */
  const scrollToDay = useCallback((days: number, animate: boolean) => {
    const el = track.current;
    if (!el) {
      return;
    }
    cancelAnimationFrame(anim.current);
    animating.current = false;

    const to = scrollForDay(days);
    const from = el.scrollLeft;
    const distance = Math.abs(to - from);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!animate || reduced || distance < 2) {
      settingRef.current = true;
      el.scrollLeft = to;
      requestAnimationFrame(() => {
        settingRef.current = false;
      });
      return;
    }

    // Grows with distance, but capped so the far end still feels brisk.
    const duration = Math.min(700, Math.max(280, Math.sqrt(distance) * 10));
    const started = performance.now();
    animating.current = true;

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // easeOutQuart: leaves quickly, settles softly.
      el.scrollLeft = from + (to - from) * (1 - (1 - t) ** 4);
      if (t < 1) {
        anim.current = requestAnimationFrame(step);
      } else {
        animating.current = false;
      }
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(anim.current);
    animating.current = false;
  }, []);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // The sky is the same gesture on a bigger surface: it hands us the scroll
  // position its own scroller reached, momentum and rubber-band included, and
  // we ride it rather than re-deriving a day and stepping.
  useImperativeHandle(
    handleRef,
    () => ({
      beginDrag() {
        const el = track.current;
        if (!el) {
          return;
        }
        stopAnimation();
        externalDrag.current = true;
        el.dataset.dragging = "true";
      },
      moveTo(scrollLeft: number) {
        const el = track.current;
        if (el) {
          el.scrollLeft = scrollLeft;
        }
      },
      endDrag() {
        const el = track.current;
        if (!el) {
          return;
        }
        externalDrag.current = false;
        delete el.dataset.dragging;
        scrollToDay(dayForScroll(el.scrollLeft), true);
      },
    }),
    [scrollToDay, stopAnimation]
  );

  // Centre on mount. Instant: the resting position is 40,000px in, and
  // animating there would fire scroll events all the way and drag the date
  // along with it.
  useEffect(() => {
    const el = track.current;
    if (!el) {
      return;
    }
    el.scrollLeft = scrollForDay(offsetDays);
    readyRef.current = true;
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  }, []);

  // Follow changes that came from outside, i.e. the back-to-now button.
  useEffect(() => {
    const el = track.current;
    if (
      !(el && readyRef.current) ||
      animating.current ||
      externalDrag.current
    ) {
      return;
    }
    const current = dayForScroll(el.scrollLeft);
    if (current === offsetDays) {
      return;
    }
    // A drag on the stage arrives a day at a time and has to land instantly or
    // the ruler lags the hand; so does a keypress. Everything else glides.
    const instant = instantNext.current || Math.abs(current - offsetDays) <= 2;
    instantNext.current = false;
    scrollToDay(offsetDays, !instant);
  }, [offsetDays, scrollToDay]);

  const onScroll = () => {
    const el = track.current;
    if (!(el && readyRef.current)) {
      return;
    }
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const centre = el.scrollLeft / DAY_PX;
      const day = Math.round(centre) - RANGE_DAYS;
      setLabelRange({
        from: Math.round(centre) - RANGE_DAYS - 20,
        to: Math.round(centre) - RANGE_DAYS + 20,
      });
      if (!settingRef.current && day !== offsetDays) {
        onOffsetChange(day);
      }
    });
  };

  // Drag to scrub. Touch is left to the browser, whose momentum beats anything
  // we would write; this is for pointers, which otherwise have no way to move a
  // horizontal scroller at all.
  const drag = useRef<{ x: number; left: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = track.current;
    if (!el || e.pointerType === "touch") {
      return;
    }
    stopAnimation();
    drag.current = { x: e.clientX, left: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
    el.dataset.dragging = "true";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = track.current;
    if (!(el && drag.current)) {
      return;
    }
    el.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };

  const endDrag = (e: React.PointerEvent) => {
    const el = track.current;
    if (!(el && drag.current)) {
      return;
    }
    drag.current = null;
    delete el.dataset.dragging;
    el.releasePointerCapture?.(e.pointerId);
    // Settle onto the day the needle is nearest.
    scrollToDay(dayForScroll(el.scrollLeft), true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowUp: 1,
      PageDown: -7,
      PageUp: 7,
    };
    if (e.key === "Home") {
      e.preventDefault();
      onOffsetChange(0);
      return;
    }
    const delta = step[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      instantNext.current = true;
      onOffsetChange(offsetDays + delta);
    }
  };

  // React attaches wheel passively, so preventDefault needs a native listener.
  useEffect(() => {
    const el = track.current;
    if (!el) {
      return;
    }
    let settle: number;
    const onWheel = (e: WheelEvent) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) {
        return;
      }
      e.preventDefault();
      stopAnimation();
      el.scrollLeft += delta;
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        scrollToDay(dayForScroll(el.scrollLeft), true);
      }, 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", stopAnimation, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", stopAnimation);
      clearTimeout(settle);
    };
  }, [scrollToDay, stopAnimation]);

  const labels = [];
  for (let d = labelRange.from; d <= labelRange.to; d += 1) {
    if (d < -RANGE_DAYS || d > RANGE_DAYS) {
      continue;
    }
    const date = baseMs === null ? null : new Date(baseMs + d * 86_400_000);
    labels.push(
      <div
        className="-translate-x-1/2 absolute top-0 flex flex-col items-center"
        key={d}
        style={{ left: (d + RANGE_DAYS) * DAY_PX }}
      >
        <span className="h-3 w-px bg-foreground/40" />
        <span className="mt-1 whitespace-nowrap text-[0.6875rem] text-muted-foreground">
          {date === null || d === 0
            ? "Now"
            : `${weekday.format(date)} ${dayNum.format(date)}`}
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[640px]">
      {/* The needle. Fixed at the centre; the ruler moves under it. */}
      <div
        aria-hidden="true"
        className="-translate-x-1/2 pointer-events-none absolute top-0 left-1/2 z-1 flex flex-col items-center"
      >
        <span className="h-4 w-0.5 rounded-full bg-foreground" />
      </div>

      <div
        aria-label="Time"
        aria-valuemax={RANGE_DAYS}
        aria-valuemin={-RANGE_DAYS}
        aria-valuenow={offsetDays}
        aria-valuetext={
          baseMs === null
            ? "Now"
            : new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(baseMs + offsetDays * 86_400_000))
        }
        className="scrubber h-11 w-full cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing"
        onKeyDown={onKeyDown}
        onPointerCancel={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onScroll={onScroll}
        ref={track}
        role="slider"
        tabIndex={0}
      >
        {/* Half the viewport of padding either side so day zero can sit dead
            centre at each end of the range. */}
        <div className="scrubber__ticks relative h-11" style={TRACK_STYLE}>
          {labels}
        </div>
      </div>
    </div>
  );
}

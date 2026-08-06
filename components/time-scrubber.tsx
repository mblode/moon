"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
const DAY_PX = 56;
const RANGE_DAYS = 730;
const TOTAL_DAYS = RANGE_DAYS * 2 + 1;

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayNum = new Intl.DateTimeFormat(undefined, { day: "numeric" });

interface Props {
  offsetDays: number;
  onOffsetChange: (days: number) => void;
  baseMs: number | null;
}

export function TimeScrubber({ offsetDays, onOffsetChange, baseMs }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  // Suppresses the scroll handler while we are the ones moving the scroller.
  const settingRef = useRef(false);
  const readyRef = useRef(false);
  const [labelRange, setLabelRange] = useState({ from: -20, to: 20 });

  const scrollToDay = useCallback((days: number, smooth: boolean) => {
    const el = track.current;
    if (!el) {
      return;
    }
    settingRef.current = true;
    el.scrollTo({
      left: (days + RANGE_DAYS) * DAY_PX,
      behavior: smooth ? "smooth" : "auto",
    });
    // "smooth" keeps firing scroll events well past this call.
    setTimeout(
      () => {
        settingRef.current = false;
      },
      smooth ? 500 : 60
    );
  }, []);

  // Centre on mount. Instant: the resting position is 40,000px in, and
  // animating there would fire scroll events all the way and drag the date
  // along with it.
  useEffect(() => {
    const el = track.current;
    if (!el) {
      return;
    }
    el.scrollLeft = (offsetDays + RANGE_DAYS) * DAY_PX;
    readyRef.current = true;
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  }, []);

  // Follow changes that came from outside, i.e. the back-to-now button.
  useEffect(() => {
    const el = track.current;
    if (!(el && readyRef.current)) {
      return;
    }
    const current = Math.round(el.scrollLeft / DAY_PX) - RANGE_DAYS;
    if (current === offsetDays) {
      return;
    }
    // Gliding is pleasant across a week and absurd across a year.
    scrollToDay(offsetDays, Math.abs(current - offsetDays) <= 30);
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
    scrollToDay(Math.round(el.scrollLeft / DAY_PX) - RANGE_DAYS, true);
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
      el.scrollLeft += delta;
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        scrollToDay(Math.round(el.scrollLeft / DAY_PX) - RANGE_DAYS, true);
      }, 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(settle);
    };
  }, [scrollToDay]);

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
            ? "now"
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
            ? "now"
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
        <div
          className="scrubber__ticks relative h-11"
          style={{
            width: TOTAL_DAYS * DAY_PX,
            marginInline: "calc(50% - 1px)",
          }}
        >
          {labels}
        </div>
      </div>
    </div>
  );
}

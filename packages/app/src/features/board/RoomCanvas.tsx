import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { cn } from "../../lib/cn";
import { duration } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { currentSetWindow } from "../../lib/setAlerts";
import type { RoomWithSeats } from "../../data/repository";

const OVERTIME_MIN = 120;
const GRID = 10;

type SeatState = "free" | "occupied" | "overtime" | "near" | "alert";

const stateStyles: Record<SeatState, { box: string; dot: string }> = {
  free: {
    box: "border-dashed border-stone-300 bg-stone-50/80 text-stone-400",
    dot: "bg-stone-300",
  },
  occupied: {
    box: "border-emerald-500 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  overtime: {
    box: "border-amber-500 bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
  },
  near: {
    box: "border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-400 ring-offset-1",
    dot: "bg-amber-500",
  },
  alert: {
    box: "border-rose-500 bg-rose-100 text-rose-900 ring-4 ring-rose-500 ring-offset-1",
    dot: "bg-rose-500",
  },
};

const consumedHalfSets = (mins: number, setMinutes: number, grace: number): number => {
  if (mins <= grace || mins <= setMinutes) return 0;
  return Math.ceil((mins - setMinutes) / (setMinutes / 2));
};

interface Props {
  room: RoomWithSeats;
  guestsBySeat: Map<string, Guest[]>;
  /** Available width for the plan; the canvas scales to fit it. */
  containerWidth: number;
  /** Length of one set, in minutes (drives the alert boundaries). */
  setMinutes: number;
  /** Below this many minutes nothing is billed (no pending extension yet). */
  graceMinutes: number;
  /** Minutes before a boundary the pre-alert marker shows (0 = off). */
  leadMinutes: number;
  onSeatClick: (seatId: string, ticketId: string | null) => void;
  /** When true, seats are draggable and clicks don't open tickets. */
  arrangeMode?: boolean;
  arrangeDraft?: Map<string, { x: number; y: number }>;
  onSeatMove?: (seatId: string, x: number, y: number) => void;
}

export function RoomCanvas({
  room,
  guestsBySeat,
  containerWidth,
  setMinutes,
  graceMinutes,
  leadMinutes,
  onSeatClick,
  arrangeMode = false,
  arrangeDraft,
  onSeatMove,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const now = useNow(1000);
  const scale = containerWidth
    ? Math.max(0.2, Math.min(1.4, containerWidth / room.width))
    : Math.min(1, 880 / room.width);

  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const seatPos = (seat: RoomWithSeats["seats"][number]): { x: number; y: number } => {
    const d = arrangeDraft?.get(seat.id);
    return {
      x: d?.x ?? seat.tempX ?? seat.x,
      y: d?.y ?? seat.tempY ?? seat.y,
    };
  };

  const beginDrag = (e: ReactPointerEvent, seat: RoomWithSeats["seats"][number]): void => {
    if (!arrangeMode) return;
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = seatPos(seat);
    drag.current = { id: seat.id, startX: e.clientX, startY: e.clientY, baseX: p.x, baseY: p.y };
  };

  const moveDrag = (e: ReactPointerEvent): void => {
    const d = drag.current;
    if (!d || !onSeatMove) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const snap = (n: number): number => Math.round(n / GRID) * GRID;
    onSeatMove(
      d.id,
      Math.max(0, Math.min(room.width - 40, snap(d.baseX + dx))),
      Math.max(0, Math.min(room.height - 40, snap(d.baseY + dy))),
    );
  };

  const endDrag = (): void => {
    drag.current = null;
  };

  return (
    <div
      className="relative rounded-xl border border-stone-200"
      style={{
        width: room.width * scale,
        height: room.height * scale,
        background: room.background ?? "#ffffff",
        touchAction: arrangeMode ? "none" : undefined,
      }}
      onPointerMove={arrangeMode ? moveDrag : undefined}
      onPointerUp={arrangeMode ? endDrag : undefined}
      onPointerCancel={arrangeMode ? endDrag : undefined}
    >
      {room.seats.map((seat) => {
        const guests = guestsBySeat.get(seat.id) ?? [];
        const occupied = guests.length > 0;
        const primary =
          occupied &&
          guests.reduce((a, b) => (Date.parse(a.arrivalAt) <= Date.parse(b.arrivalAt) ? a : b));
        const earliest = primary ? Date.parse(primary.arrivalAt) : 0;
        const mins = occupied ? elapsedMs(new Date(earliest), now) / 60_000 : 0;
        const overtime = mins >= OVERTIME_MIN;
        const win = occupied ? currentSetWindow(mins, setMinutes) : null;
        const pending =
          primary && primary.validatedHalfSets != null
            ? Math.max(
                0,
                consumedHalfSets(mins, setMinutes, graceMinutes) - primary.validatedHalfSets,
              )
            : 0;
        const atBoundary = pending > 0;
        const nearBoundary =
          !!win && leadMinutes > 0 && !atBoundary && win.nextAt - mins <= leadMinutes;
        const state: SeatState = !occupied
          ? "free"
          : atBoundary
            ? "alert"
            : nearBoundary
              ? "near"
              : overtime
                ? "overtime"
                : "occupied";
        const style = stateStyles[state];
        const ticketId = guests[0]?.ticketId ?? null;
        const assignment = guests.find((g) => g.assignment)?.assignment ?? null;
        const names = guests.map((g) => g.displayName?.trim()).filter(Boolean) as string[];
        const guestLabel =
          names.length === 0
            ? null
            : names.length === 1
              ? names[0]
              : `${names[0]} +${guests.length - 1}`;

        const pos = seatPos(seat);
        const left = pos.x * scale;
        const top = pos.y * scale;
        const width = seat.w * scale;
        const chipW = Math.max(width, 120);
        const chipCount = (assignment ? 1 : 0) + (guestLabel ? 1 : 0);
        const chipsTop = Math.max(0, top - chipCount * 17 - 2);

        return (
          <div key={seat.id}>
            {chipCount > 0 && !arrangeMode ? (
              <div
                className="pointer-events-none absolute z-10 flex flex-col gap-0.5"
                style={{ left, top: chipsTop, width: chipW }}
              >
                {assignment ? (
                  <span
                    className="flex items-center gap-1 self-start truncate rounded-md bg-stone-800/90 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white shadow-sm"
                    style={{ maxWidth: chipW }}
                    title={`${assignment.staffName} · ${duration(
                      elapsedMs(new Date(assignment.assignedAt), now),
                    )}`}
                  >
                    <span aria-hidden>👤</span>
                    <span className="truncate">{assignment.staffName}</span>
                    <span className="tabular-nums opacity-80">
                      {duration(elapsedMs(new Date(assignment.assignedAt), now))}
                    </span>
                  </span>
                ) : null}
                {guestLabel ? (
                  <span
                    className="self-start max-w-full truncate rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-stone-700 shadow-sm ring-1 ring-stone-300"
                    style={{ maxWidth: chipW }}
                    title={guestLabel}
                  >
                    {guestLabel}
                  </span>
                ) : null}
              </div>
            ) : null}

            <button
              onPointerDown={(e) => beginDrag(e, seat)}
              onClick={() => {
                if (!arrangeMode) onSeatClick(seat.id, ticketId);
              }}
              title={seat.label}
              className={cn(
                "absolute flex flex-col items-center justify-center gap-0.5 border-[3px] text-sm font-bold shadow-sm transition-colors",
                seat.shape === "ROUND" ? "rounded-full" : "rounded-xl",
                !seat.isActive && "opacity-30",
                arrangeMode && "cursor-move ring-2 ring-sky-400",
                style.box,
              )}
              style={{
                left,
                top,
                width,
                height: seat.h * scale,
                transform: seat.rotationDeg ? `rotate(${seat.rotationDeg}deg)` : undefined,
                touchAction: arrangeMode ? "none" : undefined,
              }}
            >
              <span
                className={cn(
                  "absolute right-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                  style.dot,
                )}
              />
              {pending > 0 ? (
                <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  ⚠{pending}
                </span>
              ) : null}
              <span className="px-1 leading-tight">{seat.label}</span>
              {occupied ? (
                <>
                  {guests.length > 1 ? (
                    <span className="rounded-full bg-white/80 px-1 text-[10px] font-semibold">
                      ×{guests.length}
                    </span>
                  ) : null}
                  <span className="text-xs font-bold tabular-nums">
                    {duration(elapsedMs(new Date(earliest), now))}
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-medium">{t("board.free")}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

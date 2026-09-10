import { useTranslation } from "react-i18next";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { cn } from "../../lib/cn";
import { duration } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { currentSetWindow } from "../../lib/setAlerts";
import type { RoomWithSeats } from "../../data/repository";

const OVERTIME_MIN = 120;

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

interface Props {
  room: RoomWithSeats;
  guestsBySeat: Map<string, Guest[]>;
  /** Available width for the plan; the canvas scales to fit it. */
  containerWidth: number;
  /** Length of one set, in minutes (drives the alert boundaries). */
  setMinutes: number;
  /** Minutes before a boundary the pre-alert marker shows (0 = off). */
  leadMinutes: number;
  onSeatClick: (seatId: string, ticketId: string | null) => void;
}

export function RoomCanvas({
  room,
  guestsBySeat,
  containerWidth,
  setMinutes,
  leadMinutes,
  onSeatClick,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const now = useNow(1000);
  const scale = containerWidth
    ? Math.max(0.2, Math.min(1.4, containerWidth / room.width))
    : Math.min(1, 880 / room.width);

  return (
    <div
      className="relative rounded-xl border border-stone-200"
      style={{
        width: room.width * scale,
        height: room.height * scale,
        background: room.background ?? "#ffffff",
      }}
    >
      {room.seats.map((seat) => {
        const guests = guestsBySeat.get(seat.id) ?? [];
        const occupied = guests.length > 0;
        const earliest = occupied ? Math.min(...guests.map((g) => Date.parse(g.arrivalAt))) : 0;
        const mins = occupied ? elapsedMs(new Date(earliest), now) / 60_000 : 0;
        const overtime = mins >= OVERTIME_MIN;
        const win = occupied ? currentSetWindow(mins, setMinutes) : null;
        // just crossed a set / half-set boundary — strong, brief marker
        const atBoundary = !!win && win.lastIndex >= 0 && mins - win.lastAt < 2;
        // inside the configurable lead window before the next boundary
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
        const left = seat.x * scale;
        const width = seat.w * scale;
        const chipW = Math.max(width, 120);
        // stacked chips sit just above the seat: staff band (top), guest name (below)
        const chipCount = (assignment ? 1 : 0) + (guestLabel ? 1 : 0);
        const chipsTop = Math.max(0, seat.y * scale - chipCount * 17 - 2);

        return (
          <div key={seat.id}>
            {chipCount > 0 ? (
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
              onClick={() => onSeatClick(seat.id, ticketId)}
              title={seat.label}
              className={cn(
                "absolute flex flex-col items-center justify-center gap-0.5 border-[3px] text-sm font-bold shadow-sm transition-colors",
                seat.shape === "ROUND" ? "rounded-full" : "rounded-xl",
                !seat.isActive && "opacity-30",
                style.box,
              )}
              style={{
                left,
                top: seat.y * scale,
                width,
                height: seat.h * scale,
                transform: seat.rotationDeg ? `rotate(${seat.rotationDeg}deg)` : undefined,
              }}
            >
              <span
                className={cn(
                  "absolute right-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                  style.dot,
                )}
              />
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

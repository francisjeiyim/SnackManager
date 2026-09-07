import { useTranslation } from "react-i18next";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { cn } from "../../lib/cn";
import { duration } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import type { RoomWithSeats } from "../../data/repository";

const OVERTIME_MIN = 120;

interface Props {
  room: RoomWithSeats;
  guestsBySeat: Map<string, Guest[]>;
  /** Alert interval in minutes (0 = off). */
  alertIntervalMinutes: number;
  /** Blink lead time before each interval boundary (0 = off). */
  alertLeadMinutes: number;
  onSeatClick: (seatId: string, ticketId: string | null) => void;
}

export function RoomCanvas({
  room,
  guestsBySeat,
  alertIntervalMinutes,
  alertLeadMinutes,
  onSeatClick,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const now = useNow(1000);
  const scale = Math.min(1, 880 / room.width);

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
        const nearAlert =
          occupied &&
          alertIntervalMinutes > 0 &&
          alertLeadMinutes > 0 &&
          mins >= alertIntervalMinutes - alertLeadMinutes &&
          mins % alertIntervalMinutes >= alertIntervalMinutes - alertLeadMinutes;
        const ticketId = guests[0]?.ticketId ?? null;

        return (
          <button
            key={seat.id}
            onClick={() => onSeatClick(seat.id, ticketId)}
            title={seat.label}
            className={cn(
              "absolute flex flex-col items-center justify-center gap-0.5 border-2 text-sm font-bold shadow-sm transition-colors",
              seat.shape === "ROUND" ? "rounded-full" : "rounded-xl",
              !seat.isActive && "opacity-30",
              !occupied && "border-stone-300 bg-stone-50 text-stone-400 hover:bg-stone-100",
              occupied && !overtime && "border-emerald-500 bg-emerald-50 text-emerald-700",
              occupied && overtime && "border-amber-500 bg-amber-50 text-amber-700",
              nearAlert && "sm-blink ring-2 ring-rose-400 ring-offset-1",
            )}
            style={{
              left: seat.x * scale,
              top: seat.y * scale,
              width: seat.w * scale,
              height: seat.h * scale,
              transform: seat.rotationDeg ? `rotate(${seat.rotationDeg}deg)` : undefined,
            }}
          >
            <span>{seat.label}</span>
            {occupied ? (
              <>
                {guests.length > 1 ? (
                  <span className="rounded-full bg-white/70 px-1 text-[10px] font-semibold">
                    ×{guests.length}
                  </span>
                ) : null}
                <span className="text-[11px] font-medium tabular-nums opacity-80">
                  {duration(elapsedMs(new Date(earliest), now))}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-normal opacity-60">{t("board.free")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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
  onSeatClick: (seatId: string, ticketId: string | null) => void;
}

export function RoomCanvas({ room, guestsBySeat, onSeatClick }: Props): JSX.Element {
  const { t } = useTranslation();
  const now = useNow(1000);
  const scale = Math.min(1, 880 / room.width);

  return (
    <div
      className="relative rounded-xl border border-slate-200 bg-white"
      style={{ width: room.width * scale, height: room.height * scale }}
    >
      {room.seats.map((seat) => {
        const guests = guestsBySeat.get(seat.id) ?? [];
        const occupied = guests.length > 0;
        const earliest = occupied ? Math.min(...guests.map((g) => Date.parse(g.arrivalAt))) : 0;
        const mins = occupied ? elapsedMs(new Date(earliest), now) / 60_000 : 0;
        const overtime = mins >= OVERTIME_MIN;
        const ticketId = guests[0]?.ticketId ?? null;

        return (
          <button
            key={seat.id}
            onClick={() => onSeatClick(seat.id, ticketId)}
            title={seat.label}
            className={cn(
              "absolute flex flex-col items-center justify-center gap-0.5 border-2 text-xs font-semibold transition-colors",
              seat.shape === "ROUND" ? "rounded-full" : "rounded-lg",
              !seat.isActive && "opacity-30",
              !occupied && "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100",
              occupied && !overtime && "border-emerald-500 bg-emerald-50 text-emerald-700",
              occupied && overtime && "border-amber-500 bg-amber-50 text-amber-700",
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
                <span className="text-[10px] opacity-70">×{guests.length}</span>
                <span className="text-[10px] tabular-nums opacity-80">
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

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "../../lib/cn";
import type { SeatDraft } from "./types";

const GRID = 10;
const MIN_SIZE = 40;

interface Props {
  width: number;
  height: number;
  background: string | null;
  scale: number;
  seats: SeatDraft[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<SeatDraft>) => void;
}

type Mode = "move" | "resize" | "rotate";

interface DragState {
  id: string;
  mode: Mode;
  startClientX: number;
  startClientY: number;
  start: Pick<SeatDraft, "x" | "y" | "w" | "h" | "rotationDeg">;
  centerX: number;
  centerY: number;
}

const snap = (n: number): number => Math.round(n / GRID) * GRID;

export function EditableCanvas({
  width,
  height,
  background,
  scale,
  seats,
  selectedId,
  onSelect,
  onChange,
}: Props): JSX.Element {
  const drag = useRef<DragState | null>(null);

  const begin = (e: ReactPointerEvent, seat: SeatDraft, mode: Mode): void => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events / unsupported — fine */
    }
    const rect = (e.currentTarget.closest("[data-seat]") as Element).getBoundingClientRect();
    drag.current = {
      id: seat.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      start: { x: seat.x, y: seat.y, w: seat.w, h: seat.h, rotationDeg: seat.rotationDeg },
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
    onSelect(seat.id);
  };

  const move = (e: ReactPointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / scale;
    const dy = (e.clientY - d.startClientY) / scale;

    if (d.mode === "move") {
      onChange(d.id, {
        x: Math.max(0, Math.min(width - d.start.w, snap(d.start.x + dx))),
        y: Math.max(0, Math.min(height - d.start.h, snap(d.start.y + dy))),
      });
    } else if (d.mode === "resize") {
      onChange(d.id, {
        w: Math.max(MIN_SIZE, Math.min(width - d.start.x, snap(d.start.w + dx))),
        h: Math.max(MIN_SIZE, Math.min(height - d.start.y, snap(d.start.h + dy))),
      });
    } else {
      const angle = (Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX) * 180) / Math.PI + 90;
      onChange(d.id, { rotationDeg: Math.round(angle / 5) * 5 });
    }
  };

  const end = (e: ReactPointerEvent): void => {
    if (drag.current) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      drag.current = null;
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-300"
      style={{ width: width * scale, height: height * scale, background: background ?? "#fff" }}
      onPointerDown={() => onSelect(null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {seats.map((seat) => {
        const selected = seat.id === selectedId;
        return (
          <div
            key={seat.id}
            data-seat={seat.id}
            className={cn(
              "absolute flex items-center justify-center border-2 text-xs font-semibold select-none",
              seat.shape === "ROUND" ? "rounded-full" : "rounded-lg",
              seat.kind === "DYNAMIC"
                ? "border-dashed border-sky-500 bg-sky-50 text-sky-700"
                : "border-slate-400 bg-white text-slate-600",
              selected && "ring-2 ring-slate-900 ring-offset-2",
              !seat.isActive && "opacity-40",
            )}
            style={{
              left: seat.x * scale,
              top: seat.y * scale,
              width: seat.w * scale,
              height: seat.h * scale,
              transform: seat.rotationDeg ? `rotate(${seat.rotationDeg}deg)` : undefined,
              cursor: "move",
            }}
            onPointerDown={(e) => begin(e, seat, "move")}
          >
            {seat.label}
            {selected ? (
              <>
                <span
                  className="absolute -top-7 left-1/2 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-slate-900 bg-white"
                  onPointerDown={(e) => begin(e, seat, "rotate")}
                  title="rotate"
                />
                <span
                  className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border-2 border-slate-900 bg-white"
                  onPointerDown={(e) => begin(e, seat, "resize")}
                  title="resize"
                />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Seat } from "@snackmanager/shared";
import { Button, Input, Modal } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useSeatIn } from "../../data/queries";
import type { RoomWithSeats } from "../../data/repository";

/** Natural order: "2" before "10", digits before text. */
function byLabel(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isInteger(na) && Number.isInteger(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

interface Props {
  room: RoomWithSeats;
  occupiedSeatIds: Set<string>;
  initialSeatId?: string | null;
  onClose: () => void;
}

export function SeatInDialog({
  room,
  occupiedSeatIds,
  initialSeatId,
  onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const seatIn = useSeatIn();
  const freeSeats = useMemo(
    () =>
      room.seats
        .filter((s) => s.isActive && !occupiedSeatIds.has(s.id))
        .sort((a, b) => byLabel(a.label, b.label)),
    [room.seats, occupiedSeatIds],
  );
  const [selected, setSelected] = useState<string[]>(
    initialSeatId && !occupiedSeatIds.has(initialSeatId) ? [initialSeatId] : [],
  );
  const [names, setNames] = useState<Record<string, string>>({});
  const [separate, setSeparate] = useState(false);

  const toggle = (id: string): void =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const confirm = (): void => {
    seatIn.mutate(
      {
        roomId: room.id,
        separateTickets: separate,
        guests: selected.map((seatId) => ({
          seatId,
          displayName: names[seatId]?.trim() || null,
        })),
      },
      { onSuccess: onClose },
    );
  };

  const seatLabel = (s: Seat): string => s.label;

  return (
    <Modal
      open
      onClose={onClose}
      title={t("seatIn.title")}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="success"
            disabled={selected.length === 0 || seatIn.isPending}
            onClick={confirm}
          >
            {t("seatIn.confirm")} ({selected.length})
          </Button>
        </>
      }
    >
      <p className="text-sm text-stone-500">
        {t("seatIn.pickSeats", { n: selected.length, total: freeSeats.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {freeSeats.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium",
              selected.includes(s.id)
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50",
            )}
          >
            {seatLabel(s)}
          </button>
        ))}
        {freeSeats.length === 0 ? <span className="text-sm text-stone-400">—</span> : null}
      </div>

      {selected.length > 0 ? (
        <div className="space-y-2">
          <span className="text-xs font-medium text-stone-500">{t("seatIn.names")}</span>
          {[...selected]
            .map((id) => room.seats.find((s) => s.id === id))
            .filter((s): s is (typeof room.seats)[number] => s != null)
            .sort((a, b) => byLabel(a.label, b.label))
            .map((seat, i) => (
              <div key={seat.id} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-semibold text-stone-500">
                  {seat.label}
                </span>
                <Input
                  placeholder={`${t("seatIn.guest")} ${i + 1}`}
                  value={names[seat.id] ?? ""}
                  onChange={(e) =>
                    setNames((n) => ({ ...n, [seat.id]: e.target.value }))
                  }
                />
              </div>
            ))}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
        {t("seatIn.separateTickets")}
      </label>

      {seatIn.isError ? (
        <p className="text-sm text-rose-600">{(seatIn.error as Error).message}</p>
      ) : null}
    </Modal>
  );
}

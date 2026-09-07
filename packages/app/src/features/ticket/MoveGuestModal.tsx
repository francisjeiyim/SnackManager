import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Guest } from "@snackmanager/shared";
import { Button, Modal, Spinner } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useActiveGuests, useMoveGuest, useRooms } from "../../data/queries";

interface Props {
  guest: Guest;
  onClose: () => void;
}

export function MoveGuestModal({ guest, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const roomsQ = useRooms();
  const guestsQ = useActiveGuests();
  const move = useMoveGuest();

  const room = roomsQ.data?.find((r) => r.id === guest.roomId) ?? roomsQ.data?.[0];

  const occupantBySeat = useMemo(() => {
    const map = new Map<string, Guest>();
    for (const g of guestsQ.data ?? []) {
      if (g.id !== guest.id) map.set(g.seatId, g);
    }
    return map;
  }, [guestsQ.data, guest.id]);

  const pick = (seatId: string): void => {
    if (seatId === guest.seatId) return;
    move.mutate({ guestId: guest.id, toSeatId: seatId }, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title={t("moveGuest.title")} wide>
      {roomsQ.isLoading || !room ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-2">
          {room.seats
            .filter((s) => s.isActive)
            .map((s) => {
              const occ = occupantBySeat.get(s.id);
              const isCurrent = s.id === guest.seatId;
              return (
                <button
                  key={s.id}
                  disabled={isCurrent || move.isPending}
                  onClick={() => pick(s.id)}
                  className={cn(
                    "min-w-[64px] rounded-lg border px-3 py-2 text-sm",
                    isCurrent && "border-slate-900 bg-slate-100 text-slate-500",
                    !isCurrent &&
                      occ &&
                      "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100",
                    !isCurrent &&
                      !occ &&
                      "border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                  )}
                >
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-[11px] font-normal opacity-80">
                    {isCurrent
                      ? t("moveGuest.current")
                      : occ
                        ? t("moveGuest.swapWith", { name: occ.displayName ?? occ.seatLabel ?? "?" })
                        : t("moveGuest.free")}
                  </div>
                </button>
              );
            })}
        </div>
      )}
      {move.isError ? (
        <p className="text-sm text-rose-600">{(move.error as Error).message}</p>
      ) : null}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

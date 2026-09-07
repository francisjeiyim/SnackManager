import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Guest } from "@snackmanager/shared";
import { Button, Card, Spinner } from "../../components/ui";
import { cn } from "../../lib/cn";
import { usePermissions } from "../../lib/permissions";
import { useRepository } from "../../data/RepositoryContext";
import { useActiveGuests, useRooms, useSettings } from "../../data/queries";
import { RoomCanvas } from "./RoomCanvas";
import { SeatInDialog } from "./SeatInDialog";
import { TicketPanel } from "../ticket/TicketPanel";

export function BoardPage(): JSX.Element {
  const { t } = useTranslation();
  const repo = useRepository();
  const { canServe } = usePermissions();
  const roomsQ = useRooms();
  const guestsQ = useActiveGuests();
  const settingsQ = useSettings();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [seatInSeatId, setSeatInSeatId] = useState<string | null | undefined>(undefined);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);

  useEffect(() => {
    repo.setServiceRooms?.(rooms.map((r) => r.id));
  }, [repo, rooms]);

  useEffect(() => {
    if (!activeRoomId && rooms[0]) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  const room = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];

  const guestsBySeat = useMemo(() => {
    const map = new Map<string, Guest[]>();
    for (const g of guestsQ.data ?? []) {
      const list = map.get(g.seatId) ?? [];
      list.push(g);
      map.set(g.seatId, list);
    }
    return map;
  }, [guestsQ.data]);

  const occupiedSeatIds = useMemo(() => new Set(guestsBySeat.keys()), [guestsBySeat]);

  if (roomsQ.isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  if (rooms.length === 0) {
    return <Card className="p-6 text-sm text-slate-500">{t("board.noRooms")}</Card>;
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRoomId(r.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  r.id === room?.id
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                {r.name}
              </button>
            ))}
          </div>
          {canServe ? (
            <Button size="sm" className="ml-auto" onClick={() => setSeatInSeatId(null)}>
              {t("board.seatIn")}
            </Button>
          ) : null}
        </div>

        {room ? (
          <div className="overflow-auto">
            <RoomCanvas
              room={room}
              guestsBySeat={guestsBySeat}
              hourWarningMinutes={settingsQ.data?.hourWarningMinutes ?? 0}
              onSeatClick={(seatId, tId) => {
                if (tId) setTicketId(tId);
                else if (canServe) setSeatInSeatId(seatId);
              }}
            />
          </div>
        ) : null}
      </div>

      {ticketId ? (
        <div className="w-[360px] shrink-0">
          <TicketPanel ticketId={ticketId} onClose={() => setTicketId(null)} />
        </div>
      ) : null}

      {seatInSeatId !== undefined && room ? (
        <SeatInDialog
          room={room}
          occupiedSeatIds={occupiedSeatIds}
          initialSeatId={seatInSeatId}
          onClose={() => setSeatInSeatId(undefined)}
        />
      ) : null}
    </div>
  );
}

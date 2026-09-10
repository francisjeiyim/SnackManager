import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Guest } from "@snackmanager/shared";
import { elapsedMs } from "@snackmanager/shared";
import { Button, Card, EmptyState, SegmentedControl, Skeleton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { duration, yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useNow } from "../../lib/useNow";
import { useElementWidth } from "../../lib/useElementWidth";
import { usePermissions } from "../../lib/permissions";
import { audioReady, playChime, unlockAudio } from "../../lib/chime";
import { useRepository } from "../../data/RepositoryContext";
import {
  useActiveGuests,
  useArrangeMutations,
  useLiveTickets,
  useRooms,
  useSettings,
  useUnpaidTickets,
} from "../../data/queries";
import { RoomCanvas } from "./RoomCanvas";
import { SeatInDialog } from "./SeatInDialog";
import { SeatQuickMenu } from "./SeatQuickMenu";
import { useSetAlerts } from "./useSetAlerts";
import { TicketPanel } from "../ticket/TicketPanel";

export function BoardPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const now = useNow(5000);
  const repo = useRepository();
  const { canServe } = usePermissions();
  const roomsQ = useRooms();
  const guestsQ = useActiveGuests();
  const settingsQ = useSettings();
  const liveQ = useLiveTickets();
  const unpaidQ = useUnpaidTickets();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [seatInSeatId, setSeatInSeatId] = useState<string | null | undefined>(undefined);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [quickSeatId, setQuickSeatId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [canvasRef, canvasWidth] = useElementWidth<HTMLDivElement>();
  const [arrangeMode, setArrangeMode] = useState(false);
  const [arrangeDraft, setArrangeDraft] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [, bumpSound] = useState(0); // re-render to re-check audioReady()
  const arrange = useArrangeMutations();

  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);

  useEffect(() => {
    repo.setServiceRooms?.(rooms.map((r) => r.id));
  }, [repo, rooms]);

  useEffect(() => {
    if (!activeRoomId && rooms[0]) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  // Fullscreen / immersive Floor
  useEffect(() => {
    document.body.classList.toggle("sm-immersive", immersive);
    return () => document.body.classList.remove("sm-immersive");
  }, [immersive]);
  useEffect(() => {
    const onFs = (): void => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleImmersive = (): void => {
    const next = !immersive;
    setImmersive(next);
    try {
      if (next) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    } catch {
      /* iOS Safari has no element fullscreen — the CSS immersive mode still applies */
    }
  };

  const room = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];
  const guests = useMemo(() => guestsQ.data ?? [], [guestsQ.data]);

  const guestsBySeat = useMemo(() => {
    const map = new Map<string, Guest[]>();
    for (const g of guests) {
      const list = map.get(g.seatId) ?? [];
      list.push(g);
      map.set(g.seatId, list);
    }
    return map;
  }, [guests]);

  const occupiedSeatIds = useMemo(() => new Set(guestsBySeat.keys()), [guestsBySeat]);

  // Free seats whose most-recent ticket was closed without being paid.
  const unpaidBySeat = useMemo(() => {
    const map = new Map<string, { ticketId: string; number: number; balanceYen: number }>();
    for (const tk of unpaidQ.data ?? []) {
      const balanceYen = tk.totalYen - tk.paidYen;
      if (balanceYen <= 0) continue;
      for (const g of tk.guests) {
        if (guestsBySeat.has(g.seatId) || map.has(g.seatId)) continue;
        map.set(g.seatId, { ticketId: tk.id, number: tk.number, balanceYen });
      }
    }
    return map;
  }, [unpaidQ.data, guestsBySeat]);

  useSetAlerts(guestsBySeat, useNow(2000), {
    setMinutes: settingsQ.data?.setMinutes ?? 90,
    graceMinutes: settingsQ.data?.graceMinutes ?? 0,
    leadMinutes: settingsQ.data?.hourWarningMinutes ?? 0,
    repeatSeconds: settingsQ.data?.soundRepeatSeconds ?? 0,
    enabled: settingsQ.data?.soundAlertsEnabled ?? true,
  });

  const summary = useMemo(() => {
    const longestMs = guests.reduce(
      (max, g) => Math.max(max, elapsedMs(new Date(g.arrivalAt), now)),
      0,
    );
    const runningYen = (liveQ.data ?? [])
      .filter((tk) => tk.status === "OPEN")
      .reduce((a, tk) => a + tk.live.totalYen, 0);
    return { seatsInUse: guestsBySeat.size, guests: guests.length, longestMs, runningYen };
  }, [guests, guestsBySeat, liveQ.data, now]);

  if (roomsQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }
  if (rooms.length === 0) {
    return (
      <Card>
        <EmptyState icon="▢" title={t("board.noRooms")} hint={t("board.noRoomsHint")} />
      </Card>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        {immersive ? (
          <Button
            size="sm"
            variant="secondary"
            className="fixed right-3 top-3 z-40"
            onClick={toggleImmersive}
          >
            ⤢ {t("board.exitFullscreen")}
          </Button>
        ) : null}

        {/* the Floor comes first, right under the menu bar */}
        {room ? (
          <div ref={canvasRef} className="overflow-x-auto pb-2">
            <RoomCanvas
              room={room}
              guestsBySeat={guestsBySeat}
              containerWidth={canvasWidth}
              setMinutes={settingsQ.data?.setMinutes ?? 90}
              graceMinutes={settingsQ.data?.graceMinutes ?? 0}
              leadMinutes={settingsQ.data?.hourWarningMinutes ?? 0}
              unpaidBySeat={unpaidBySeat}
              arrangeMode={arrangeMode}
              arrangeDraft={arrangeDraft}
              onSeatMove={(seatId, x, y) =>
                setArrangeDraft((m) => new Map(m).set(seatId, { x, y }))
              }
              onSeatClick={(seatId, tId) => {
                if (guestsBySeat.has(seatId) || unpaidBySeat.has(seatId)) setQuickSeatId(seatId);
                else if (tId) setTicketId(tId);
                else if (canServe) setSeatInSeatId(seatId);
              }}
            />
          </div>
        ) : null}

        {/* summary bar — now below the Floor */}
        {!immersive ? (
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5 text-sm">
            <Stat label={t("board.seatsInUse")} value={String(summary.seatsInUse)} />
            <Stat label={t("board.guestsCount")} value={String(summary.guests)} />
            <Stat label={t("board.running")} value={yen(summary.runningYen, locale)} />
            <Stat
              label={t("board.longest")}
              value={summary.longestMs ? duration(summary.longestMs) : "—"}
            />
          </Card>
        ) : null}

        <div className={cn("flex flex-wrap items-center gap-2", immersive && "hidden")}>
          {rooms.length > 1 ? (
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                value={room?.id ?? ""}
                onChange={setActiveRoomId}
                options={rooms.map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
          ) : (
            <span className="text-sm font-semibold text-stone-700">{room?.name}</span>
          )}

          {(settingsQ.data?.soundAlertsEnabled ?? true) && !audioReady() ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void unlockAudio().then(() => {
                  playChime("hard");
                  bumpSound((n) => n + 1);
                });
              }}
            >
              🔔 {t("board.enableSound")}
            </Button>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {arrangeMode ? (
              <>
                <span className="text-xs text-stone-400">{t("board.arrangeHint")}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (window.confirm(t("board.resetArrangementConfirm")) && room)
                      arrange.reset.mutate(room.id, {
                        onSuccess: () => {
                          setArrangeDraft(new Map());
                          setArrangeMode(false);
                        },
                      });
                  }}
                >
                  {t("board.resetArrangement")}
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  disabled={arrangeDraft.size === 0 || arrange.arrange.isPending}
                  onClick={() => {
                    if (!room) return;
                    arrange.arrange.mutate(
                      {
                        roomId: room.id,
                        seats: [...arrangeDraft.entries()].map(([id, p]) => ({ id, ...p })),
                      },
                      {
                        onSuccess: () => {
                          setArrangeDraft(new Map());
                          setArrangeMode(false);
                        },
                      },
                    );
                  }}
                >
                  {t("board.saveArrangement")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setArrangeDraft(new Map());
                    setArrangeMode(false);
                  }}
                >
                  {t("board.exitArrange")}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={toggleImmersive}>
                  ⛶ {t("board.fullscreen")}
                </Button>
                {canServe ? (
                  <Button size="sm" variant="ghost" onClick={() => setArrangeMode(true)}>
                    {t("board.rearrange")}
                  </Button>
                ) : null}
                {canServe ? (
                  <Button size="sm" onClick={() => setSeatInSeatId(null)}>
                    + {t("board.seatIn")}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* legend */}
        <div className={cn("flex flex-wrap gap-3 text-xs text-stone-500", immersive && "hidden")}>
          <LegendDot className="border-dashed border-stone-300 bg-stone-50" label={t("board.free")} />
          <LegendDot className="border-emerald-500 bg-emerald-50" label={t("board.occupied")} />
          <LegendDot className="border-amber-500 bg-amber-100" label={t("board.nearBoundary")} />
          <LegendDot className="border-rose-500 bg-rose-100" label={t("board.atBoundary")} />
          <LegendDot className="border-sky-500 bg-sky-100" label={t("board.unpaidSeat")} />
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-white px-1 text-[10px] font-semibold ring-1 ring-stone-300">
              ×N
            </span>
            {t("board.multi")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>👤</span>
            {t("staff.title")}
          </span>
        </div>
      </div>

      {ticketId ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-stone-900/30 lg:hidden"
            onClick={() => setTicketId(null)}
          />
          <aside
            className={cn(
              "z-40 shrink-0 bg-transparent",
              "fixed inset-y-0 right-0 w-full max-w-md animate-sheet-up p-2 lg:static lg:w-[380px] lg:animate-none lg:p-0",
            )}
          >
            <TicketPanel ticketId={ticketId} onClose={() => setTicketId(null)} />
          </aside>
        </>
      ) : null}

      {seatInSeatId !== undefined && room ? (
        <SeatInDialog
          room={room}
          occupiedSeatIds={occupiedSeatIds}
          initialSeatId={seatInSeatId}
          onClose={() => setSeatInSeatId(undefined)}
        />
      ) : null}

      {quickSeatId && settingsQ.data ? (
        <SeatQuickMenu
          seatLabel={
            room?.seats.find((s) => s.id === quickSeatId)?.label ?? t("board.title")
          }
          guests={guestsBySeat.get(quickSeatId) ?? []}
          unpaidTicketId={unpaidBySeat.get(quickSeatId)?.ticketId ?? null}
          settings={settingsQ.data}
          onClose={() => setQuickSeatId(null)}
          onOpenTicket={(id) => {
            setQuickSeatId(null);
            setTicketId(id);
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="flex flex-col">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </span>
      <span className="text-base font-bold tabular-nums text-stone-800">{value}</span>
    </span>
  );
}

function LegendDot({ className, label }: { className: string; label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-md border-[3px]", className)} />
      {label}
    </span>
  );
}

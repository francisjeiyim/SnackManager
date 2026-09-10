import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeatKind } from "@snackmanager/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  SegmentedControl,
  Skeleton,
} from "../../components/ui";
import { useElementWidth } from "../../lib/useElementWidth";
import { useRooms, useLayoutMutations } from "../../data/queries";
import { EditableCanvas } from "./EditableCanvas";
import { SeatProperties } from "./SeatProperties";
import { RoomSettingsModal } from "./RoomSettingsModal";
import type { SeatDraft } from "./types";

export function LayoutEditorPage(): JSX.Element {
  const { t } = useTranslation();
  const roomsQ = useRooms();
  const m = useLayoutMutations();
  const [canvasRef, canvasWidth] = useElementWidth<HTMLDivElement>();

  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SeatDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoomSettings, setShowRoomSettings] = useState(false);

  const room = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];

  useEffect(() => {
    if (!activeRoomId && rooms[0]) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  useEffect(() => {
    if (room && !dirty) setDrafts(room.seats.map((s) => ({ ...s })));
  }, [room, dirty]);

  if (roomsQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  const scale = room && canvasWidth ? Math.min(1, canvasWidth / room.width) : 1;
  const selected = drafts.find((s) => s.id === selectedId) ?? null;

  const patchSeat = (id: string, patch: Partial<SeatDraft>): void => {
    setDrafts((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const addSeat = async (kind: SeatKind): Promise<void> => {
    if (!room) return;
    // Smallest unused positive integer as the label — never collides with an
    // existing seat (deleted seats free up their number).
    const used = new Set(
      drafts.map((s) => parseInt(s.label, 10)).filter((v) => Number.isInteger(v)),
    );
    let n = 1;
    while (used.has(n)) n++;
    try {
      const created = await m.createSeat.mutateAsync({
        roomId: room.id,
        label: String(n),
        x: 40 + (drafts.length % 6) * 16,
        y: 40 + (drafts.length % 6) * 16,
        w: 100,
        h: 100,
        rotationDeg: 0,
        shape: "RECT",
        kind,
        isActive: true,
      });
      // Show it right away and keep any unsaved edits (the rooms refetch will
      // re-sync when the layout is not dirty).
      setDrafts((cur) => (cur.some((s) => s.id === created.id) ? cur : [...cur, { ...created }]));
      setSelectedId(created.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  };

  const save = async (): Promise<void> => {
    if (!room) return;
    await m.bulkUpdateSeats.mutateAsync({
      roomId: room.id,
      seats: drafts.map((s) => ({
        id: s.id,
        label: s.label,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        rotationDeg: s.rotationDeg,
        shape: s.shape,
        kind: s.kind,
        color: s.color,
        isActive: s.isActive,
      })),
    });
    setDirty(false);
  };

  const deleteSeat = async (id: string): Promise<void> => {
    if (!window.confirm(t("layout.deleteSeatConfirm"))) return;
    await m.deleteSeat.mutateAsync(id);
    setSelectedId(null);
    setDirty(false);
  };

  const addRoom = async (): Promise<void> => {
    const name = window.prompt(t("layout.roomName"));
    if (!name?.trim()) return;
    const created = await m.createRoom.mutateAsync({ name: name.trim(), width: 1000, height: 700 });
    setActiveRoomId(created.id);
    setDirty(false);
  };

  const props =
    selected != null ? (
      <SeatProperties
        seat={selected}
        onChange={(patch) => patchSeat(selected.id, patch)}
        onDelete={() => void deleteSeat(selected.id)}
      />
    ) : (
      <p className="text-sm text-stone-400">{t("layout.selectSeat")}</p>
    );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {rooms.length > 0 ? (
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                value={room?.id ?? ""}
                onChange={(id) => {
                  setActiveRoomId(id);
                  setDirty(false);
                  setSelectedId(null);
                }}
                options={rooms.map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => void addRoom()}>
            + {t("layout.addRoom")}
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {dirty ? <Badge tone="amber">{t("layout.unsaved")}</Badge> : null}
            <Button size="sm" variant="secondary" onClick={() => setShowRoomSettings(true)}>
              {t("layout.roomSettings")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void addSeat("PERMANENT")}>
              + {t("layout.seat")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void addSeat("DYNAMIC")}>
              + {t("layout.dynamicSeat")}
            </Button>
            <Button
              size="sm"
              variant="success"
              disabled={!dirty || m.bulkUpdateSeats.isPending}
              onClick={() => void save()}
            >
              {t("layout.save")}
            </Button>
          </div>
        </div>

        {room ? (
          <div ref={canvasRef} className="overflow-x-auto">
            <EditableCanvas
              width={room.width}
              height={room.height}
              background={room.background}
              scale={scale}
              seats={drafts}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={patchSeat}
            />
          </div>
        ) : (
          <Card>
            <EmptyState icon="▢" title={t("board.noRooms")} hint={t("board.noRoomsHint")} />
          </Card>
        )}

        {/* properties inline below the canvas on small screens — never covers it */}
        {selected != null ? (
          <Card className="p-3 lg:hidden">
            <div className="flex items-center justify-between">
              <SectionTitle>{t("layout.properties")}</SectionTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                {t("common.close")}
              </Button>
            </div>
            <div className="mt-2">{props}</div>
          </Card>
        ) : null}
      </div>

      {/* properties: side column on lg+ */}
      <div className="hidden w-64 shrink-0 lg:block">
        <Card className="p-3">
          <SectionTitle>{t("layout.properties")}</SectionTitle>
          <div className="mt-2">{props}</div>
        </Card>
      </div>

      {showRoomSettings && room ? (
        <RoomSettingsModal
          room={room}
          onClose={() => setShowRoomSettings(false)}
          onSave={(patch) => {
            void m.updateRoom.mutateAsync({ id: room.id, patch }).then(() => {
              setShowRoomSettings(false);
              setDirty(false);
            });
          }}
          onDelete={() => {
            if (window.confirm(t("layout.deleteRoomConfirm"))) {
              void m.deleteRoom.mutateAsync(room.id).then(() => {
                setShowRoomSettings(false);
                setActiveRoomId(null);
                setDirty(false);
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}

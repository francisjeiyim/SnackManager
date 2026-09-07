import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SeatKind } from "@snackmanager/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
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
    const n = drafts.length + 1;
    const created = await m.createSeat.mutateAsync({
      roomId: room.id,
      label: `${room.name.startsWith("テラス") ? "P" : "T"}${n}`,
      x: 40,
      y: 40,
      w: 100,
      h: 100,
      rotationDeg: 0,
      shape: "RECT",
      kind,
      isActive: true,
    });
    setDirty(false);
    setSelectedId(created.id);
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
      </div>

      {/* properties: side column on lg+, bottom sheet on smaller screens */}
      <div className="hidden w-64 shrink-0 lg:block">
        <Card className="p-3">
          <SectionTitle>{t("layout.properties")}</SectionTitle>
          <div className="mt-2">{props}</div>
        </Card>
      </div>
      {selected != null ? (
        <div className="lg:hidden">
          <Modal open title={t("layout.properties")} onClose={() => setSelectedId(null)}>
            {props}
          </Modal>
        </div>
      ) : null}

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

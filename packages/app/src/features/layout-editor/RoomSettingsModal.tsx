import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input, Modal } from "../../components/ui";
import type { RoomWithSeats } from "../../data/repository";

interface Props {
  room: RoomWithSeats;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    width: number;
    height: number;
    background: string | null;
  }) => void;
  onDelete: () => void;
}

export function RoomSettingsModal({ room, onClose, onSave, onDelete }: Props): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(room.name);
  const [width, setWidth] = useState(room.width);
  const [height, setHeight] = useState(room.height);
  const [background, setBackground] = useState(room.background ?? "#ffffff");

  return (
    <Modal
      open
      onClose={onClose}
      title={t("layout.roomSettings")}
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            {t("layout.deleteRoom")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() =>
              onSave({ name: name.trim(), width, height, background: background || null })
            }
          >
            {t("common.confirm")}
          </Button>
        </>
      }
    >
      <Field label={t("layout.roomName")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("layout.width")}>
          <Input
            type="number"
            value={width}
            onChange={(e) => setWidth(Math.max(200, Number(e.target.value) || 200))}
          />
        </Field>
        <Field label={t("layout.height")}>
          <Input
            type="number"
            value={height}
            onChange={(e) => setHeight(Math.max(200, Number(e.target.value) || 200))}
          />
        </Field>
      </div>
      <Field label={t("layout.background")}>
        <input
          type="color"
          className="h-10 w-full rounded-lg border border-slate-300"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

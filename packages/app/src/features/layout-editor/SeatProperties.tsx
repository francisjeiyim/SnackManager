import { useTranslation } from "react-i18next";
import type { SeatShape, SeatKind } from "@snackmanager/shared";
import { Button, Field, Input, Select } from "../../components/ui";
import type { SeatDraft } from "./types";

interface Props {
  seat: SeatDraft;
  onChange: (patch: Partial<SeatDraft>) => void;
  onDelete: () => void;
}

export function SeatProperties({ seat, onChange, onDelete }: Props): JSX.Element {
  const { t } = useTranslation();
  const num = (v: string): number => Number(v) || 0;

  return (
    <div className="space-y-3">
      <Field label={t("layout.label")}>
        <Input value={seat.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("layout.kind")}>
          <Select
            value={seat.kind}
            onChange={(e) => onChange({ kind: e.target.value as SeatKind })}
          >
            <option value="PERMANENT">{t("layout.permanent")}</option>
            <option value="DYNAMIC">{t("layout.dynamic")}</option>
          </Select>
        </Field>
        <Field label={t("layout.shape")}>
          <Select
            value={seat.shape}
            onChange={(e) => onChange({ shape: e.target.value as SeatShape })}
          >
            <option value="RECT">{t("layout.rect")}</option>
            <option value="ROUND">{t("layout.round")}</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <Input
            type="number"
            value={Math.round(seat.x)}
            onChange={(e) => onChange({ x: num(e.target.value) })}
          />
        </Field>
        <Field label="Y">
          <Input
            type="number"
            value={Math.round(seat.y)}
            onChange={(e) => onChange({ y: num(e.target.value) })}
          />
        </Field>
        <Field label="W">
          <Input
            type="number"
            value={Math.round(seat.w)}
            onChange={(e) => onChange({ w: num(e.target.value) })}
          />
        </Field>
        <Field label="H">
          <Input
            type="number"
            value={Math.round(seat.h)}
            onChange={(e) => onChange({ h: num(e.target.value) })}
          />
        </Field>
      </div>
      <Field label={t("layout.rotation")}>
        <Input
          type="number"
          value={Math.round(seat.rotationDeg)}
          onChange={(e) => onChange({ rotationDeg: num(e.target.value) })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={seat.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
        />
        {t("layout.active")}
      </label>
      <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
        {t("layout.deleteSeat")}
      </Button>
    </div>
  );
}

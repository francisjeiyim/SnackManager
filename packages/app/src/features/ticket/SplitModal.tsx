import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input, Modal } from "../../components/ui";
import { cn } from "../../lib/cn";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useSplitTicket } from "../../data/queries";
import type { SplitResult, TicketView } from "../../data/repository";

export function SplitModal({
  ticket,
  onClose,
  onDone,
}: {
  ticket: TicketView;
  onClose: () => void;
  onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const split = useSplitTicket(ticket.id);
  const [mode, setMode] = useState<"ITEMIZED" | "EVEN">("EVEN");
  const [parts, setParts] = useState(2);
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [shares, setShares] = useState<number[] | null>(null);

  const toggle = (set: string[], id: string): string[] =>
    set.includes(id) ? set.filter((x) => x !== id) : [...set, id];

  const confirm = (): void => {
    if (mode === "EVEN") {
      split.mutate(
        { mode: "EVEN", parts },
        {
          onSuccess: (r: SplitResult) => {
            if (r.mode === "EVEN") setShares(r.shares);
          },
        },
      );
    } else {
      split.mutate({ mode: "ITEMIZED", guestIds, itemIds }, { onSuccess: onDone });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("split.title")}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button
            disabled={
              split.isPending ||
              (mode === "ITEMIZED" && guestIds.length === 0 && itemIds.length === 0)
            }
            onClick={confirm}
          >
            {t("split.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex gap-2">
        {(["EVEN", "ITEMIZED"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              mode === m ? "border-slate-800 bg-slate-50" : "border-slate-200",
            )}
          >
            {t(m === "EVEN" ? "split.even" : "split.itemized")}
          </button>
        ))}
      </div>

      {mode === "EVEN" ? (
        <>
          <Field label={t("split.parts")}>
            <Input
              type="number"
              min={2}
              value={parts}
              onChange={(e) => setParts(Math.max(2, Number(e.target.value) || 2))}
            />
          </Field>
          {shares ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="mb-1 text-xs text-slate-500">{t("split.shares")}</div>
              <div className="flex flex-wrap gap-2">
                {shares.map((s, i) => (
                  <span key={i} className="rounded bg-white px-2 py-1 font-medium">
                    {yen(s, locale)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">{t("split.moveGuests")}</div>
            <div className="flex flex-wrap gap-2">
              {ticket.guests.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => setGuestIds((s) => toggle(s, g.id))}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-sm",
                    guestIds.includes(g.id) ? "border-slate-800 bg-slate-50" : "border-slate-200",
                  )}
                >
                  {g.displayName ?? `#${i + 1}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">{t("split.moveItems")}</div>
            <div className="space-y-1">
              {ticket.items
                .filter((it) => !it.voided)
                .map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setItemIds((s) => toggle(s, it.id))}
                    className={cn(
                      "flex w-full justify-between rounded-lg border px-3 py-1.5 text-sm",
                      itemIds.includes(it.id) ? "border-slate-800 bg-slate-50" : "border-slate-200",
                    )}
                  >
                    <span>
                      {it.nameSnapshot} ×{it.quantity}
                    </span>
                    <span className="text-slate-400">
                      {yen(it.unitPriceYen * it.quantity, locale)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
      {split.isError ? (
        <p className="text-sm text-rose-600">{(split.error as Error).message}</p>
      ) : null}
    </Modal>
  );
}

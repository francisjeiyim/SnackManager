import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Input, Modal } from "../../components/ui";
import { cn } from "../../lib/cn";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useSplitTicket } from "../../data/queries";
import type { SplitResult, TicketView } from "../../data/repository";

type Mode = "EVEN" | "ITEMIZED" | "GROUPS";

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
  const [mode, setMode] = useState<Mode>("GROUPS");
  const [parts, setParts] = useState(2);
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [shares, setShares] = useState<number[] | null>(null);

  // GROUPS state: guest id -> group index (0-based).
  const [groupCount, setGroupCount] = useState(2);
  const [groupOf, setGroupOf] = useState<Record<string, number>>({});

  const toggle = (set: string[], id: string): string[] =>
    set.includes(id) ? set.filter((x) => x !== id) : [...set, id];

  const chargeOf = useMemo(() => {
    const m = new Map(ticket.live.perGuest.map((p) => [p.guestId, p.timeChargeYen]));
    return (guestId: string): number => m.get(guestId) ?? 0;
  }, [ticket.live.perGuest]);

  const groups: string[][] = useMemo(() => {
    const acc: string[][] = Array.from({ length: groupCount }, () => []);
    for (const g of ticket.guests) {
      const idx = Math.min(groupOf[g.id] ?? 0, groupCount - 1);
      acc[idx]!.push(g.id);
    }
    return acc;
  }, [groupCount, groupOf, ticket.guests]);

  const groupSubtotal = (idx: number): number => {
    const ids = new Set(groups[idx] ?? []);
    const time = [...ids].reduce((a, id) => a + chargeOf(id), 0);
    const products = ticket.items
      .filter((it) => !it.voided)
      .filter((it) => (it.guestId != null ? ids.has(it.guestId) : idx === 0))
      .reduce((a, it) => a + it.unitPriceYen * it.quantity, 0);
    return time + products;
  };

  const nonEmptyGroups = groups.filter((g) => g.length > 0);
  const groupsValid =
    nonEmptyGroups.length >= 2 && !groups.some((g) => g.length === ticket.guests.length);

  const confirm = (): void => {
    if (mode === "EVEN") {
      split.mutate(
        { mode: "EVEN", parts },
        { onSuccess: (r: SplitResult) => r.mode === "EVEN" && setShares(r.shares) },
      );
    } else if (mode === "ITEMIZED") {
      split.mutate({ mode: "ITEMIZED", guestIds, itemIds }, { onSuccess: onDone });
    } else {
      split.mutate({ mode: "GROUPS", groups: nonEmptyGroups }, { onSuccess: onDone });
    }
  };

  const confirmDisabled =
    split.isPending ||
    (mode === "ITEMIZED" && guestIds.length === 0 && itemIds.length === 0) ||
    (mode === "GROUPS" && !groupsValid);

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
          <Button disabled={confirmDisabled} onClick={confirm}>
            {t("split.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex gap-2">
        {(["GROUPS", "EVEN", "ITEMIZED"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              mode === m ? "border-slate-800 bg-slate-50" : "border-slate-200",
            )}
          >
            {t(`split.${m.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {mode === "GROUPS" ? (
        <>
          <p className="text-xs text-slate-500">{t("split.assignAll")}</p>
          <div className="space-y-1.5">
            {ticket.guests.map((g, i) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm"
              >
                <span className="text-slate-700">
                  {g.displayName ?? `#${i + 1}`}
                  {g.seatLabel ? (
                    <span className="ml-1 text-xs text-slate-400">· {g.seatLabel}</span>
                  ) : null}
                  <span className="ml-2 text-xs text-slate-400">{yen(chargeOf(g.id), locale)}</span>
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: groupCount }, (_, k) => (
                    <button
                      key={k}
                      onClick={() => setGroupOf((s) => ({ ...s, [g.id]: k }))}
                      className={cn(
                        "h-7 w-7 rounded-md border text-xs font-semibold",
                        (groupOf[g.id] ?? 0) === k
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-300 text-slate-500",
                      )}
                    >
                      {k + 1}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGroupCount((c) => Math.min(c + 1, ticket.guests.length))}
            >
              + {t("split.group")}
            </Button>
            {groupCount > 2 ? (
              <Button size="sm" variant="ghost" onClick={() => setGroupCount((c) => c - 1)}>
                −
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: groupCount }, (_, k) => (
              <div key={k} className="rounded-lg border border-slate-200 p-2 text-sm">
                <div className="text-xs text-slate-400">
                  {t("split.group")} {k + 1} · {groups[k]?.length ?? 0}
                </div>
                <div className="font-semibold tabular-nums">{yen(groupSubtotal(k), locale)}</div>
              </div>
            ))}
          </div>
        </>
      ) : mode === "EVEN" ? (
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
                {shares.map((sh, i) => (
                  <span key={i} className="rounded bg-white px-2 py-1 font-medium">
                    {yen(sh, locale)}
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

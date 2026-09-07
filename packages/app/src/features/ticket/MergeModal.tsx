import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "../../components/ui";
import { cn } from "../../lib/cn";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useLiveTickets, useMergeTickets } from "../../data/queries";

export function MergeModal({
  ticketId,
  onClose,
  onDone,
}: {
  ticketId: string;
  onClose: () => void;
  onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const live = useLiveTickets();
  const merge = useMergeTickets();
  const [sources, setSources] = useState<string[]>([]);

  const candidates = (live.data ?? []).filter((tk) => tk.id !== ticketId);
  const toggle = (id: string): void =>
    setSources((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const confirm = (): void => {
    merge.mutate({ targetTicketId: ticketId, sourceTicketIds: sources }, { onSuccess: onDone });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("merge.title")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={sources.length === 0 || merge.isPending} onClick={confirm}>
            {t("merge.confirm")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-500">{t("merge.sources")}</p>
      <div className="space-y-1.5">
        {candidates.map((tk) => (
          <button
            key={tk.id}
            onClick={() => toggle(tk.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm",
              sources.includes(tk.id)
                ? "border-slate-800 bg-slate-50"
                : "border-slate-200 hover:bg-slate-50",
            )}
          >
            <span>#{tk.number}</span>
            <span className="text-slate-400">
              {tk.guests.length} · {yen(tk.live.totalYen, locale)}
            </span>
          </button>
        ))}
        {candidates.length === 0 ? <p className="text-sm text-slate-400">—</p> : null}
      </div>
      {merge.isError ? (
        <p className="text-sm text-rose-600">{(merge.error as Error).message}</p>
      ) : null}
    </Modal>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Modal, Select, Spinner } from "../../components/ui";
import { dateTime, yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { printReceipt } from "../../lib/printReceipt";
import { useTicketHistory } from "../../data/queries";
import type { TicketView } from "../../data/repository";

const STATUSES = ["", "OPEN", "CLOSED", "PAID", "VOID"] as const;

const tone = { OPEN: "emerald", CLOSED: "amber", PAID: "sky", VOID: "rose" } as const;

export function InvoicesPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const [status, setStatus] = useState("");
  const historyQ = useTicketHistory(status || undefined);
  const [detail, setDetail] = useState<TicketView | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">{t("invoices.title")}</h1>
        <div className="w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? t(`ticket.status.${s}`) : t("invoices.all")}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        {historyQ.isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : (historyQ.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-slate-400">{t("invoices.empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">{t("invoices.number")}</th>
                <th className="p-3">{t("invoices.opened")}</th>
                <th className="p-3">{t("invoices.closed")}</th>
                <th className="p-3 text-right">{t("invoices.total")}</th>
                <th className="p-3">{t("invoices.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(historyQ.data ?? []).map((tk) => (
                <tr
                  key={tk.id}
                  onClick={() => setDetail(tk)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="p-3 font-medium">#{tk.number}</td>
                  <td className="p-3 text-slate-500">{dateTime(tk.openedAt, locale)}</td>
                  <td className="p-3 text-slate-500">
                    {tk.closedAt ? dateTime(tk.closedAt, locale) : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">{yen(tk.totalYen, locale)}</td>
                  <td className="p-3">
                    <Badge tone={tone[tk.status]}>{t(`ticket.status.${tk.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {detail ? (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={t("ticket.title", { n: detail.number })}
          wide
          footer={
            <Button variant="secondary" onClick={() => printReceipt(detail, locale)}>
              {t("ticket.print")}
            </Button>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Badge tone={tone[detail.status]}>{t(`ticket.status.${detail.status}`)}</Badge>
              <span className="text-slate-400">{dateTime(detail.openedAt, locale)}</span>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase text-slate-400">{t("ticket.guests")}</div>
              {detail.guests.map((g, i) => (
                <div key={g.id} className="flex justify-between">
                  <span>
                    {g.displayName ?? `#${i + 1}`}
                    {g.seatLabel ? (
                      <span className="ml-1 text-xs text-slate-400">· {g.seatLabel}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {g.billedMinutes ?? "—"} min · {yen(g.timeChargeYen ?? 0, locale)}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-xs uppercase text-slate-400">{t("ticket.items")}</div>
              {detail.items
                .filter((it) => !it.voided)
                .map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span>
                      {it.nameSnapshot} ×{it.quantity}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {yen(it.unitPriceYen * it.quantity, locale)}
                    </span>
                  </div>
                ))}
            </div>
            <div className="space-y-1 border-t border-slate-200 pt-2">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("ticket.time")}</span>
                <span className="tabular-nums">{yen(detail.timeYen, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("ticket.products")}</span>
                <span className="tabular-nums">{yen(detail.productsYen, locale)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("ticket.total")}</span>
                <span className="tabular-nums">{yen(detail.totalYen, locale)}</span>
              </div>
              {detail.payments.length > 0 ? (
                <div className="pt-1 text-slate-500">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span>{t(`pay.methods.${p.method}`)}</span>
                      <span className="tabular-nums">{yen(p.amountYen, locale)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

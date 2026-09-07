import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, Input, Spinner } from "../../components/ui";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { serviceDayOf } from "../../lib/serviceDay";
import { useRooms, useSettings, useTicketsByDay } from "../../data/queries";
import type { TicketView } from "../../data/repository";

export function ReportsPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const settingsQ = useSettings();
  const roomsQ = useRooms();

  const cutover = settingsQ.data?.serviceDayCutoverHour ?? 5;
  const [day, setDay] = useState(() => serviceDayOf(new Date(), cutover));
  const ticketsQ = useTicketsByDay(day);

  const stats = useMemo(() => {
    const tickets = (ticketsQ.data ?? []) as TicketView[];
    const paid = tickets.filter((tk) => tk.status === "PAID");
    const open = tickets.filter((tk) => tk.status === "OPEN").length;

    const sum = (f: (tk: TicketView) => number): number => paid.reduce((a, tk) => a + f(tk), 0);
    const revenueYen = sum((tk) => tk.totalYen);
    const timeYen = sum((tk) => tk.timeYen);
    const productsYen = sum((tk) => tk.productsYen);

    const byMethod = new Map<string, number>();
    for (const tk of paid) {
      for (const p of tk.payments) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountYen);
      }
    }

    const guests = paid.flatMap((tk) => tk.guests);
    const stayMinutes = guests.map((g) => g.billedMinutes ?? 0).filter((m) => m > 0);
    const avgStay = stayMinutes.length
      ? Math.round(stayMinutes.reduce((a, b) => a + b, 0) / stayMinutes.length)
      : 0;
    const seatsUsed = new Set(guests.map((g) => g.seatId)).size;
    const totalSeats = (roomsQ.data ?? []).reduce(
      (a, r) => a + r.seats.filter((s) => s.isActive).length,
      0,
    );

    return {
      ticketCount: paid.length,
      openCount: open,
      revenueYen,
      timeYen,
      productsYen,
      byMethod: [...byMethod.entries()],
      guestCount: guests.length,
      avgGuests: paid.length ? (guests.length / paid.length).toFixed(1) : "0",
      avgStay,
      seatsUsed,
      totalSeats,
      occupancy: totalSeats ? Math.round((seatsUsed / totalSeats) * 100) : 0,
    };
  }, [ticketsQ.data, roomsQ.data]);

  const loading = ticketsQ.isLoading || settingsQ.isLoading;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">{t("reports.title")}</h1>
        <div className="w-44">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t("reports.revenue")} value={yen(stats.revenueYen, locale)} />
            <Tile label={t("reports.tickets")} value={String(stats.ticketCount)} />
            <Tile label={t("reports.openTickets")} value={String(stats.openCount)} />
            <Tile label={t("reports.guests")} value={String(stats.guestCount)} />
            <Tile label={t("reports.timeShare")} value={yen(stats.timeYen, locale)} />
            <Tile label={t("reports.productShare")} value={yen(stats.productsYen, locale)} />
            <Tile label={t("reports.avgGuests")} value={stats.avgGuests} />
            <Tile label={t("reports.avgStay")} value={`${stats.avgStay} min`} />
            <Tile
              label={t("reports.occupancy")}
              value={`${stats.occupancy}% (${stats.seatsUsed}/${stats.totalSeats})`}
            />
          </div>

          <Card className="p-4">
            <div className="mb-2 text-xs font-medium uppercase text-slate-400">
              {t("reports.byMethod")}
            </div>
            {stats.byMethod.length === 0 ? (
              <p className="text-sm text-slate-400">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stats.byMethod.map(([method, amount]) => (
                  <li key={method} className="flex justify-between">
                    <span className="text-slate-500">{t(`pay.methods.${method}`)}</span>
                    <span className="tabular-nums">{yen(amount, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Card className="p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{value}</div>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, EmptyState, Input, SectionTitle, Skeleton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { serviceDayOf } from "../../lib/serviceDay";
import { useRooms, useSettings, useTicketsRange } from "../../data/queries";
import type { TicketView } from "../../data/repository";

const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
};

type Preset = "today" | "yesterday" | "7d" | "month";

export function ReportsPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const settingsQ = useSettings();
  const roomsQ = useRooms();

  const cutover = settingsQ.data?.serviceDayCutoverHour ?? 5;
  const todaySd = serviceDayOf(new Date(), cutover);

  const [from, setFrom] = useState(todaySd);
  const [to, setTo] = useState(todaySd);
  const rangeQ = useTicketsRange(from, to);

  const applyPreset = (p: Preset): void => {
    if (p === "today") {
      setFrom(todaySd);
      setTo(todaySd);
    } else if (p === "yesterday") {
      const y = addDays(todaySd, -1);
      setFrom(y);
      setTo(y);
    } else if (p === "7d") {
      setFrom(addDays(todaySd, -6));
      setTo(todaySd);
    } else {
      setFrom(todaySd.slice(0, 8) + "01");
      setTo(todaySd);
    }
  };

  const data = useMemo(() => {
    const tickets = (rangeQ.data ?? []) as TicketView[];
    const paid = tickets.filter((tk) => tk.status === "PAID");
    const open = tickets.filter((tk) => tk.status === "OPEN").length;

    const sum = (f: (tk: TicketView) => number): number => paid.reduce((a, tk) => a + f(tk), 0);
    const revenueYen = sum((tk) => tk.totalYen);
    const timeYen = sum((tk) => tk.timeYen);
    const productsYen = sum((tk) => tk.productsYen);

    const byMethod = new Map<string, number>();
    for (const tk of paid) {
      for (const p of tk.payments)
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountYen);
    }

    const guests = paid.flatMap((tk) => tk.guests);
    const stay = guests.map((g) => g.billedMinutes ?? 0).filter((m) => m > 0);
    const avgStay = stay.length ? Math.round(stay.reduce((a, b) => a + b, 0) / stay.length) : 0;
    const seatsServed = new Set(guests.map((g) => g.seatId)).size;
    const totalSeats = (roomsQ.data ?? []).reduce(
      (a, r) => a + r.seats.filter((s) => s.isActive).length,
      0,
    );

    // per service day
    const dayMap = new Map<
      string,
      { tickets: number; guests: number; timeYen: number; productsYen: number; revenueYen: number }
    >();
    for (const tk of paid) {
      const key = tk.serviceDay || tk.openedAt.slice(0, 10);
      const row = dayMap.get(key) ?? {
        tickets: 0,
        guests: 0,
        timeYen: 0,
        productsYen: 0,
        revenueYen: 0,
      };
      row.tickets += 1;
      row.guests += tk.guests.length;
      row.timeYen += tk.timeYen;
      row.productsYen += tk.productsYen;
      row.revenueYen += tk.totalYen;
      dayMap.set(key, row);
    }
    const byDay = [...dayMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const maxDayRev = Math.max(1, ...byDay.map(([, r]) => r.revenueYen));

    return {
      ticketCount: paid.length,
      openCount: open,
      revenueYen,
      timeYen,
      productsYen,
      avgTicket: paid.length ? Math.round(revenueYen / paid.length) : 0,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
      guestCount: guests.length,
      avgStay,
      seatsServed,
      totalSeats,
      byDay,
      maxDayRev,
    };
  }, [rangeQ.data, roomsQ.data]);

  const exportCsv = (): void => {
    const lines: string[][] = [
      ["SnackManager report", `${from} → ${to}`],
      [],
      ["Metric", "Value"],
      ["Revenue", String(data.revenueYen)],
      ["Tickets", String(data.ticketCount)],
      ["Guests", String(data.guestCount)],
      ["Avg ticket", String(data.avgTicket)],
      ["Avg stay (min)", String(data.avgStay)],
      ["Time charge", String(data.timeYen)],
      ["Products", String(data.productsYen)],
      [],
      ["Date", "Tickets", "Guests", "Time", "Products", "Revenue"],
      ...data.byDay.map(([d, r]) => [
        d,
        String(r.tickets),
        String(r.guests),
        String(r.timeYen),
        String(r.productsYen),
        String(r.revenueYen),
      ]),
    ];
    const csv = lines.map((row) => row.map((c) => `"${c}"`).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snackmanager-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = rangeQ.isLoading || settingsQ.isLoading;
  const empty = !loading && data.ticketCount === 0 && data.openCount === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-semibold text-stone-800">{t("reports.title")}</h1>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={empty}>
          ↓ {t("reports.export")}
        </Button>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-3">
        <label className="text-xs text-stone-500">
          <span className="mb-1 block">{t("reports.from")}</span>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-stone-500">
          <span className="mb-1 block">{t("reports.to")}</span>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["today", "reports.presetToday"],
              ["yesterday", "reports.presetYesterday"],
              ["7d", "reports.preset7d"],
              ["month", "reports.presetMonth"],
            ] as Array<[Preset, string]>
          ).map(([p, key]) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:border-accent hover:text-accent"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : empty ? (
        <Card>
          <EmptyState icon="▤" title={t("reports.empty")} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label={t("reports.revenue")} value={yen(data.revenueYen, locale)} accent />
            <Tile label={t("reports.tickets")} value={String(data.ticketCount)} />
            <Tile label={t("reports.avgTicket")} value={yen(data.avgTicket, locale)} />
            <Tile label={t("reports.guests")} value={String(data.guestCount)} />
            <Tile label={t("reports.avgStay")} value={`${data.avgStay} min`} />
            <Tile
              label={t("reports.seatsServed")}
              value={`${data.seatsServed}${data.totalSeats ? ` / ${data.totalSeats}` : ""}`}
            />
          </div>

          <Card className="p-4">
            <SectionTitle>{t("reports.byMethod")}</SectionTitle>
            <div className="mt-2 space-y-2">
              {data.byMethod.length === 0 ? (
                <p className="text-sm text-stone-400">—</p>
              ) : (
                data.byMethod.map(([method, amount]) => {
                  const pct = Math.round((amount / Math.max(1, data.revenueYen)) * 100);
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-xs text-stone-500">
                        <span>{t(`pay.methods.${method}`)}</span>
                        <span className="tabular-nums">
                          {yen(amount, locale)} · {pct}%
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-stone-100 px-4 py-3">
              <SectionTitle>{t("reports.byDay")}</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead className="text-left text-xs uppercase text-stone-400">
                  <tr>
                    <th className="px-4 py-2">{t("reports.date")}</th>
                    <th className="px-4 py-2 text-right">{t("reports.tickets")}</th>
                    <th className="px-4 py-2 text-right">{t("reports.guests")}</th>
                    <th className="px-4 py-2 text-right">{t("reports.revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDay.map(([d, r]) => (
                    <tr key={d} className="border-t border-stone-50">
                      <td className="px-4 py-2 tabular-nums text-stone-600">{d}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.tickets}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.guests}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-24 rounded-full bg-stone-100 sm:block">
                            <div
                              className="h-full rounded-full bg-accent/70"
                              style={{ width: `${(r.revenueYen / data.maxDayRev) * 100}%` }}
                            />
                          </div>
                          <span className="tabular-nums font-medium">
                            {yen(r.revenueYen, locale)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <Card className={cn("p-3", accent && "border-accent-200 bg-accent-50")}>
      <div className="text-xs text-stone-400">{label}</div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          accent ? "text-accent-700" : "text-stone-800",
        )}
      >
        {value}
      </div>
    </Card>
  );
}

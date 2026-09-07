import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PaymentMethod } from "@snackmanager/shared";
import { Button, Field, Input, Modal, Select } from "../../components/ui";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useTakePayment } from "../../data/queries";
import type { PaymentResult } from "../../data/repository";

const METHODS: PaymentMethod[] = ["CASH", "CARD", "MOBILE", "OTHER"];

export function PayModal({
  ticketId,
  balanceYen,
  onClose,
}: {
  ticketId: string;
  balanceYen: number;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const pay = useTakePayment(ticketId);
  const [amount, setAmount] = useState(String(Math.max(0, balanceYen)));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [result, setResult] = useState<PaymentResult | null>(null);

  const amountNum = Number(amount) || 0;
  const change = method === "CASH" ? Math.max(0, amountNum - balanceYen) : 0;

  const submit = (): void => {
    pay.mutate(
      { amountYen: Math.min(amountNum, method === "CASH" ? balanceYen : amountNum), method },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.status === "PAID") setTimeout(onClose, 900);
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("pay.title")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button variant="success" disabled={pay.isPending || amountNum <= 0} onClick={submit}>
            {t("pay.confirm")}
          </Button>
        </>
      }
    >
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">{t("ticket.balance")}</span>
          <span className="font-semibold">{yen(balanceYen, locale)}</span>
        </div>
      </div>
      <Field label={t("pay.amount")}>
        <Input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label={t("pay.method")}>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`pay.methods.${m}`)}
            </option>
          ))}
        </Select>
      </Field>
      {change > 0 ? (
        <div className="flex justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <span>{t("pay.change")}</span>
          <span className="font-semibold">{yen(change, locale)}</span>
        </div>
      ) : null}
      {result ? (
        <p className="text-sm text-slate-500">
          {t("ticket.status." + result.status)} · {t("ticket.balance")}{" "}
          {yen(result.balanceYen, locale)}
        </p>
      ) : null}
      {pay.isError ? <p className="text-sm text-rose-600">{(pay.error as Error).message}</p> : null}
    </Modal>
  );
}

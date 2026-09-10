import { useTranslation } from "react-i18next";
import { Button, Modal, Spinner } from "../../components/ui";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useAddItem, useProducts } from "../../data/queries";

export function PosGridModal({
  ticketId,
  onClose,
}: {
  ticketId: string;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const products = useProducts();
  const addItem = useAddItem(ticketId);

  return (
    <Modal open onClose={onClose} title={t("ticket.addProduct")} wide>
      {products.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(products.data ?? []).map((p) => (
            <button
              key={p.id}
              disabled={addItem.isPending}
              onClick={() => addItem.mutate({ productId: p.id, quantity: 1 })}
              className="flex flex-col items-center gap-1 rounded-lg border border-stone-200 bg-white p-2 text-center hover:border-stone-400 disabled:opacity-50"
            >
              <span className="text-xl">{p.emoji ?? "🍽️"}</span>
              <span className="line-clamp-2 text-xs font-medium text-stone-700">{p.name}</span>
              <span className="text-xs text-stone-400">{yen(p.priceYen, locale)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-between text-sm text-stone-500">
        <span>{addItem.isPending ? t("common.loading") : ""}</span>
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}

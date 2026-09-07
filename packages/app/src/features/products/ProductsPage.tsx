import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "@snackmanager/shared";
import { Badge, Button, Card, Field, Input, Modal, Spinner } from "../../components/ui";
import { yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useProductMutations, useProducts } from "../../data/queries";

interface Draft {
  id?: string;
  name: string;
  category: string;
  priceYen: number;
  emoji: string;
  isActive: boolean;
}

const empty: Draft = { name: "", category: "", priceYen: 0, emoji: "", isActive: true };

export function ProductsPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const productsQ = useProducts(true);
  const { create, update } = useProductMutations();
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = (): void => {
    if (!draft) return;
    const payload = {
      name: draft.name.trim(),
      category: draft.category.trim() || null,
      priceYen: Math.max(0, Math.round(draft.priceYen)),
      emoji: draft.emoji.trim() || null,
      isActive: draft.isActive,
    };
    if (draft.id) {
      update.mutate({ id: draft.id, patch: payload }, { onSuccess: () => setDraft(null) });
    } else {
      create.mutate(payload, { onSuccess: () => setDraft(null) });
    }
  };

  const edit = (p: Product): void =>
    setDraft({
      id: p.id,
      name: p.name,
      category: p.category ?? "",
      priceYen: p.priceYen,
      emoji: p.emoji ?? "",
      isActive: p.isActive,
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">{t("products.title")}</h1>
        <Button size="sm" onClick={() => setDraft({ ...empty })}>
          {t("products.add")}
        </Button>
      </div>

      <Card>
        {productsQ.isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">{t("products.name")}</th>
                <th className="p-3">{t("products.category")}</th>
                <th className="p-3 text-right">{t("products.price")}</th>
                <th className="p-3">{t("products.active")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(productsQ.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3">
                    {p.emoji ? <span className="mr-1">{p.emoji}</span> : null}
                    {p.name}
                  </td>
                  <td className="p-3 text-slate-500">{p.category ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{yen(p.priceYen, locale)}</td>
                  <td className="p-3">
                    {p.isActive ? <Badge tone="emerald">✓</Badge> : <Badge tone="slate">—</Badge>}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => edit(p)}>
                      {t("products.edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {draft ? (
        <Modal
          open
          onClose={() => setDraft(null)}
          title={draft.id ? t("products.edit") : t("products.add")}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                {t("products.cancel")}
              </Button>
              <Button
                disabled={!draft.name.trim() || create.isPending || update.isPending}
                onClick={save}
              >
                {t("products.save")}
              </Button>
            </>
          }
        >
          <Field label={t("products.name")}>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("products.category")}>
              <Input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </Field>
            <Field label={t("products.price")}>
              <Input
                type="number"
                value={draft.priceYen}
                onChange={(e) => setDraft({ ...draft, priceYen: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Emoji">
              <Input
                value={draft.emoji}
                maxLength={4}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
              />
            </Field>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              {t("products.active")}
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

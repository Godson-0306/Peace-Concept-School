"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

type Inventory = { id: number; name: string };
type StockItem = {
  id: number;
  inventory: number;
  name: string;
  quantity: number;
  unit_price: string;
};

export default function StorePage() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [inventoryId, setInventoryId] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const inv = await apiJson<{ results?: Inventory[] } | Inventory[]>(
        "/api/inventories/",
      );
      const list = Array.isArray(inv) ? inv : inv.results ?? [];
      setInventories(list);
      if (list[0] && !inventoryId) setInventoryId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventories");
    }
  }, [inventoryId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!inventoryId) return;
    apiJson<{ results?: StockItem[] } | StockItem[]>(
      `/api/stock-items/?inventory=${inventoryId}`,
    )
      .then((data) => setItems(Array.isArray(data) ? data : data.results ?? []))
      .catch((e) => setError(e.message));
  }, [inventoryId]);

  async function stockIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const itemId = Number(data.get("item"));
    const qty = Number(data.get("quantity"));
    try {
      await apiJson("/api/stock-movements/", {
        method: "POST",
        body: JSON.stringify({
          item: itemId,
          movement_type: "in",
          quantity: qty,
          note: "Stock in",
        }),
      });
      setMessage("Stock updated.");
      setInventoryId(inventoryId);
      const refreshed = await apiJson<{ results?: StockItem[] } | StockItem[]>(
        `/api/stock-items/?inventory=${inventoryId}`,
      );
      setItems(Array.isArray(refreshed) ? refreshed : refreshed.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stock update failed");
    }
  }

  async function recordSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryId) return;
    const data = new FormData(event.currentTarget);
    const itemId = Number(data.get("item"));
    const item = items.find((i) => i.id === itemId);
    try {
      await apiJson("/api/sales/", {
        method: "POST",
        body: JSON.stringify({
          inventory: inventoryId,
          item: itemId,
          quantity: Number(data.get("quantity")),
          unit_price: item?.unit_price ?? 0,
          buyer_name: data.get("buyer_name") || "",
        }),
      });
      setMessage("Sale recorded.");
      const refreshed = await apiJson<{ results?: StockItem[] } | StockItem[]>(
        `/api/stock-items/?inventory=${inventoryId}`,
      );
      setItems(Array.isArray(refreshed) ? refreshed : refreshed.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sale failed");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Store / Sales
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Assigned inventory
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Manage stock and sales only for inventories assigned to you by Admin.
        </p>
      </header>

      {message ? (
        <p className="bg-[rgba(20,80,163,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <select
        className="field-input"
        value={inventoryId}
        onChange={(e) => setInventoryId(Number(e.target.value))}
      >
        {inventories.map((inv) => (
          <option key={inv.id} value={inv.id}>
            {inv.name}
          </option>
        ))}
      </select>

      <ul className="border border-[var(--line)] bg-white/80 divide-y divide-[var(--line)]">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
            <span>{item.name}</span>
            <span>
              Qty {item.quantity} · ₦{Number(item.unit_price).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={stockIn} className="border border-[var(--line)] bg-white/80 p-4 space-y-3">
          <h2 className="font-display text-xl">Stock in</h2>
          <select name="item" className="field-input w-full" required>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <input name="quantity" type="number" min="1" required className="field-input w-full" placeholder="Quantity" />
          <button className="btn-primary" type="submit">
            Add stock
          </button>
        </form>
        <form onSubmit={recordSale} className="border border-[var(--line)] bg-white/80 p-4 space-y-3">
          <h2 className="font-display text-xl">Record sale</h2>
          <select name="item" className="field-input w-full" required>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <input name="quantity" type="number" min="1" required className="field-input w-full" placeholder="Quantity" />
          <input name="buyer_name" className="field-input w-full" placeholder="Buyer name" />
          <button className="btn-primary" type="submit">
            Record sale
          </button>
        </form>
      </div>

      <style jsx global>{`
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          padding: 0.55rem 0.7rem;
        }
      `}</style>
    </div>
  );
}

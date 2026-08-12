"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, errorFromUnknown } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type Tab = "catalog" | "stock" | "sales" | "assignments";

type Inventory = {
  id: number;
  name: string;
  category: string;
  description: string;
  is_active: boolean;
  item_count?: number;
};

type StockItem = {
  id: number;
  inventory: number;
  inventory_name?: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: string;
  is_active: boolean;
};

type StockMovement = {
  id: number;
  item: number;
  item_name: string;
  inventory: number;
  inventory_name: string;
  movement_type: "in" | "out" | "adjust";
  quantity: number;
  note: string;
  recorded_by_name: string;
  recorded_at: string;
  remaining_quantity: number;
};

type Sale = {
  id: number;
  inventory: number;
  inventory_name: string;
  item: number;
  item_name: string;
  quantity: number;
  unit_price: string;
  total_amount: string;
  buyer_name: string;
  student: number | null;
  student_name: string;
  student_code: string;
  recorded_by_name: string;
  recorded_at: string;
  remaining_quantity: number;
};

type Assignment = {
  id: number;
  inventory: number;
  inventory_name: string;
  staff: number;
  staff_name: string;
  staff_username: string;
  is_active: boolean;
};

type StaffRow = {
  id: number;
  full_name: string;
  user?: { username?: string; account_type?: string };
};

type StudentHit = {
  id: number;
  student_id: string;
  full_name: string;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function naira(value: string | number) {
  return `₦${Number(value).toLocaleString()}`;
}

export default function InventoryPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("catalog");
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [storeStaff, setStoreStaff] = useState<StaffRow[]>([]);
  const [inventoryId, setInventoryId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Catalog forms
  const [invName, setInvName] = useState("");
  const [invCategory, setInvCategory] = useState("Apparel");
  const [editingInvId, setEditingInvId] = useState<number | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // Sales student search
  const [studentQuery, setStudentQuery] = useState("");
  const [studentHits, setStudentHits] = useState<StudentHit[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentHit | null>(null);

  const isAdmin = user?.account_type === "admin";
  const isAccountant = user?.account_type === "accountant";
  const isStore =
    user?.account_type === "store" || user?.account_type === "store_staff";
  const canAccessInventory = isAdmin || isAccountant || isStore;
  const canEditCatalog = isAdmin || isAccountant;
  const canManageAssignments = isAdmin;

  const selectedInventory = useMemo(
    () => inventories.find((i) => i.id === inventoryId) ?? null,
    [inventories, inventoryId],
  );

  const loadInventories = useCallback(async () => {
    const data = await apiJson<{ results?: Inventory[] } | Inventory[]>(
      "/api/inventories/?page_size=200",
    );
    const list = unwrapList(data);
    setInventories(list);
    setInventoryId((prev) => {
      if (prev && list.some((i) => i.id === prev)) return prev;
      return list[0]?.id ?? "";
    });
    return list;
  }, []);

  const loadItems = useCallback(async (invId: number) => {
    const data = await apiJson<{ results?: StockItem[] } | StockItem[]>(
      `/api/stock-items/?inventory=${invId}&page_size=500`,
    );
    setItems(unwrapList(data));
  }, []);

  const loadMovements = useCallback(async (invId: number) => {
    const data = await apiJson<{ results?: StockMovement[] } | StockMovement[]>(
      `/api/stock-movements/?inventory=${invId}&page_size=100`,
    );
    setMovements(unwrapList(data));
  }, []);

  const loadSales = useCallback(async (invId: number) => {
    const data = await apiJson<{ results?: Sale[] } | Sale[]>(
      `/api/sales/?inventory=${invId}&page_size=100`,
    );
    setSales(unwrapList(data));
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!canManageAssignments) return;
    const [asgData, staffData] = await Promise.all([
      apiJson<{ results?: Assignment[] } | Assignment[]>(
        "/api/inventory-assignments/?page_size=200",
      ),
      apiJson<{ results?: StaffRow[] } | StaffRow[]>("/api/staff/?page_size=500"),
    ]);
    setAssignments(unwrapList(asgData));
    const staff = unwrapList(staffData).filter(
      (s) => s.user?.account_type === "store_staff",
    );
    setStoreStaff(staff);
  }, [canManageAssignments]);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await loadInventories();
        if (user.account_type === "admin") {
          await loadAssignments();
        }
      } catch (e) {
        if (!cancelled) setError(errorFromUnknown(e, "Failed to load inventory"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadInventories, loadAssignments]);

  useEffect(() => {
    if (!inventoryId) {
      setItems([]);
      setMovements([]);
      setSales([]);
      return;
    }
    Promise.all([
      loadItems(inventoryId),
      loadMovements(inventoryId),
      loadSales(inventoryId),
    ]).catch((e) => setError(errorFromUnknown(e, "Failed to load inventory data")));
  }, [inventoryId, loadItems, loadMovements, loadSales]);

  useEffect(() => {
    if (!studentQuery.trim() || studentQuery.trim().length < 2) {
      setStudentHits([]);
      return;
    }
    const handle = setTimeout(() => {
      apiJson<{ results?: StudentHit[] } | StudentHit[]>(
        `/api/students/?search=${encodeURIComponent(studentQuery.trim())}&page_size=10`,
      )
        .then((data) => setStudentHits(unwrapList(data)))
        .catch(() => setStudentHits([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [studentQuery]);

  async function saveInventory(event: FormEvent) {
    event.preventDefault();
    if (!canEditCatalog || !isAdmin) return;
    setMessage("");
    setError("");
    const body = {
      name: invName.trim(),
      category: invCategory.trim(),
      is_active: true,
    };
    try {
      if (editingInvId) {
        await apiJson(`/api/inventories/${editingInvId}/`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessage("Inventory updated.");
      } else {
        await apiJson("/api/inventories/", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setMessage("Inventory created.");
      }
      setEditingInvId(null);
      setInvName("");
      await loadInventories();
    } catch (e) {
      setError(errorFromUnknown(e, "Could not save inventory"));
    }
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!inventoryId || !canEditCatalog) return;
    setMessage("");
    setError("");
    const body = {
      inventory: inventoryId,
      name: itemName.trim(),
      sku: itemSku.trim(),
      unit_price: itemPrice || "0",
      is_active: true,
    };
    try {
      if (editingItemId) {
        const updated = await apiJson<StockItem>(`/api/stock-items/${editingItemId}/`, {
          method: "PATCH",
          body: JSON.stringify({
            name: body.name,
            sku: body.sku,
            unit_price: body.unit_price,
            is_active: true,
          }),
        });
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setMessage("Item updated.");
      } else {
        const created = await apiJson<StockItem>("/api/stock-items/", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setMessage("Item created.");
      }
      setEditingItemId(null);
      setItemName("");
      setItemSku("");
      setItemPrice("");
      await loadInventories();
    } catch (e) {
      setError(errorFromUnknown(e, "Could not save item"));
    }
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const movement = await apiJson<StockMovement>("/api/stock-movements/", {
        method: "POST",
        body: JSON.stringify({
          item: Number(data.get("item")),
          movement_type: data.get("movement_type"),
          quantity: Number(data.get("quantity")),
          note: data.get("note") || "",
        }),
      });
      setMovements((prev) => [movement, ...prev]);
      setItems((prev) =>
        prev.map((i) =>
          i.id === movement.item
            ? { ...i, quantity: movement.remaining_quantity }
            : i,
        ),
      );
      form.reset();
      setMessage("Stock movement recorded.");
    } catch (e) {
      setError(errorFromUnknown(e, "Stock movement failed"));
    }
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inventoryId) return;
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const itemId = Number(data.get("item"));
    const item = items.find((i) => i.id === itemId);
    const unitPrice = data.get("unit_price") || item?.unit_price || "0";
    try {
      const sale = await apiJson<Sale>("/api/sales/", {
        method: "POST",
        body: JSON.stringify({
          inventory: inventoryId,
          item: itemId,
          quantity: Number(data.get("quantity")),
          unit_price: unitPrice,
          buyer_name: data.get("buyer_name") || selectedStudent?.full_name || "",
          student: selectedStudent?.id ?? null,
        }),
      });
      setSales((prev) => [sale, ...prev]);
      setItems((prev) =>
        prev.map((i) =>
          i.id === sale.item ? { ...i, quantity: sale.remaining_quantity } : i,
        ),
      );
      form.reset();
      setSelectedStudent(null);
      setStudentQuery("");
      setStudentHits([]);
      setMessage(`Sale recorded — ${naira(sale.total_amount)}.`);
    } catch (e) {
      setError(errorFromUnknown(e, "Sale failed"));
    }
  }

  async function assignStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAssignments) return;
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const created = await apiJson<Assignment>("/api/inventory-assignments/", {
        method: "POST",
        body: JSON.stringify({
          inventory: Number(data.get("inventory")),
          staff: Number(data.get("staff")),
          is_active: true,
        }),
      });
      setAssignments((prev) => [created, ...prev]);
      setMessage(`Assigned ${created.staff_name} to ${created.inventory_name}.`);
      event.currentTarget.reset();
    } catch (e) {
      setError(errorFromUnknown(e, "Assignment failed"));
    }
  }

  async function toggleAssignment(asg: Assignment) {
    try {
      const updated = await apiJson<Assignment>(
        `/api/inventory-assignments/${asg.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: !asg.is_active }),
        },
      );
      setAssignments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
      setMessage(
        updated.is_active
          ? `Reactivated ${updated.staff_name}.`
          : `Deactivated ${updated.staff_name}.`,
      );
    } catch (e) {
      setError(errorFromUnknown(e, "Could not update assignment"));
    }
  }

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "catalog", label: "Catalog" },
    { id: "stock", label: "Stock" },
    { id: "sales", label: "Sales" },
    { id: "assignments", label: "Assignments", adminOnly: true },
  ];

  if (user && !canAccessInventory) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-white p-6">
        <h1 className="font-display text-2xl text-[var(--brand-blue-deep)]">
          Inventory
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Inventory is available to admin, accountant, and assigned store staff
          only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Inventory
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Store &amp; stock
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Manage inventory catalogs, stock movements, and sales. Store staff only
          see inventories assigned to them.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => !t.adminOnly || canManageAssignments)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "btn-primary" : "btn-outline"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {message ? (
        <p className="bg-[rgba(20,80,163,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : null}

      {tab !== "assignments" ? (
        <label className="text-sm block max-w-sm">
          <span className="mb-1 block text-[var(--muted)]">Inventory</span>
          <select
            className="field-input w-full"
            value={inventoryId}
            onChange={(e) =>
              setInventoryId(e.target.value ? Number(e.target.value) : "")
            }
          >
            {inventories.length === 0 ? (
              <option value="">No inventories assigned</option>
            ) : null}
            {inventories.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
                {inv.category ? ` (${inv.category})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {tab === "catalog" ? (
        <div className="space-y-6">
          {isAdmin ? (
            <form
              onSubmit={saveInventory}
              className="grid gap-3 border border-[var(--line)] bg-white/80 p-5 md:grid-cols-3"
            >
              <h2 className="font-display text-2xl text-[var(--brand-green)] md:col-span-3">
                {editingInvId ? "Edit inventory" : "New inventory"}
              </h2>
              <input
                className="field-input"
                placeholder="Name"
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                required
              />
              <input
                className="field-input"
                placeholder="Category"
                value={invCategory}
                onChange={(e) => setInvCategory(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary">
                  {editingInvId ? "Update" : "Create"}
                </button>
                {editingInvId ? (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setEditingInvId(null);
                      setInvName("");
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-[var(--brand-green)]">
              Inventories
            </h2>
            {inventories.map((inv) => (
              <article
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-white/80 p-4"
              >
                <div>
                  <h3 className="font-medium text-[var(--brand-green)]">
                    {inv.name}
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {inv.category || "General"} · {inv.item_count ?? 0} items
                    {!inv.is_active ? " · inactive" : ""}
                  </p>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setEditingInvId(inv.id);
                      setInvName(inv.name);
                      setInvCategory(inv.category || "");
                      setInventoryId(inv.id);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
              </article>
            ))}
          </section>

          {inventoryId ? (
            <section className="space-y-4">
              <h2 className="font-display text-2xl text-[var(--brand-green)]">
                Items — {selectedInventory?.name}
              </h2>
              {canEditCatalog ? (
                <form
                  onSubmit={saveItem}
                  className="grid gap-3 border border-[var(--line)] bg-white/80 p-4 md:grid-cols-4"
                >
                  <input
                    className="field-input"
                    placeholder="Item name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                  />
                  <input
                    className="field-input"
                    placeholder="SKU"
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                  />
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit price"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary">
                    {editingItemId ? "Update item" : "Add item"}
                  </button>
                </form>
              ) : null}
              <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-white/80">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span>
                      {item.name}
                      {item.sku ? ` · ${item.sku}` : ""}
                    </span>
                    <span className="text-[var(--muted)]">
                      Qty {item.quantity} · {naira(item.unit_price)}
                    </span>
                    {canEditCatalog ? (
                      <button
                        type="button"
                        className="btn-outline text-sm"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setItemName(item.name);
                          setItemSku(item.sku || "");
                          setItemPrice(item.unit_price);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-[var(--muted)]">
                    No items yet.
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "stock" ? (
        <div className="space-y-6">
          {!inventoryId ? (
            <p className="text-sm text-[var(--muted)]">Select an inventory.</p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-white/80">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between px-4 py-3 text-sm"
                  >
                    <span>{item.name}</span>
                    <span>
                      Qty {item.quantity} · {naira(item.unit_price)}
                    </span>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={submitMovement}
                className="grid gap-3 border border-[var(--line)] bg-white/80 p-5 md:grid-cols-2"
              >
                <h2 className="font-display text-2xl text-[var(--brand-green)] md:col-span-2">
                  Record movement
                </h2>
                <select name="item" className="field-input" required>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (qty {i.quantity})
                    </option>
                  ))}
                </select>
                <select
                  name="movement_type"
                  className="field-input"
                  defaultValue="in"
                  required
                >
                  <option value="in">Stock in</option>
                  <option value="out">Stock out</option>
                  <option value="adjust">Adjust (+/−)</option>
                </select>
                <input
                  name="quantity"
                  type="number"
                  required
                  className="field-input"
                  placeholder="Quantity (adjust can be negative)"
                />
                <input
                  name="note"
                  className="field-input"
                  placeholder="Note"
                />
                <button type="submit" className="btn-primary md:col-span-2">
                  Save movement
                </button>
              </form>

              <section>
                <h2 className="font-display text-2xl text-[var(--brand-green)]">
                  Recent movements
                </h2>
                <ul className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)] bg-white/80">
                  {movements.map((m) => (
                    <li key={m.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>
                          <strong className="uppercase">{m.movement_type}</strong>{" "}
                          {m.item_name} · {m.quantity}
                        </span>
                        <span className="text-[var(--muted)]">
                          {m.recorded_at
                            ? new Date(m.recorded_at).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      <p className="text-[var(--muted)]">
                        {m.note || "—"} · by {m.recorded_by_name || "—"} · left{" "}
                        {m.remaining_quantity}
                      </p>
                    </li>
                  ))}
                  {movements.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-[var(--muted)]">
                      No movements yet.
                    </li>
                  ) : null}
                </ul>
              </section>
            </>
          )}
        </div>
      ) : null}

      {tab === "sales" ? (
        <div className="space-y-6">
          {!inventoryId ? (
            <p className="text-sm text-[var(--muted)]">Select an inventory.</p>
          ) : (
            <>
              <form
                onSubmit={submitSale}
                className="grid gap-3 border border-[var(--line)] bg-white/80 p-5 md:grid-cols-2"
              >
                <h2 className="font-display text-2xl text-[var(--brand-green)] md:col-span-2">
                  Record sale
                </h2>
                <select name="item" className="field-input" required>
                  {items
                    .filter((i) => i.is_active)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} (qty {i.quantity}) · {naira(i.unit_price)}
                      </option>
                    ))}
                </select>
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  required
                  className="field-input"
                  placeholder="Quantity"
                />
                <input
                  name="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                  placeholder="Unit price (optional override)"
                />
                <input
                  name="buyer_name"
                  className="field-input"
                  placeholder="Buyer name (walk-in)"
                  defaultValue={selectedStudent?.full_name || ""}
                />
                <div className="md:col-span-2 space-y-2">
                  <input
                    className="field-input w-full"
                    placeholder="Link student (search name or ID)"
                    value={studentQuery}
                    onChange={(e) => {
                      setStudentQuery(e.target.value);
                      setSelectedStudent(null);
                    }}
                  />
                  {selectedStudent ? (
                    <p className="text-sm text-[var(--brand-green)]">
                      Linked: {selectedStudent.full_name} (
                      {selectedStudent.student_id})
                      <button
                        type="button"
                        className="ml-2 underline"
                        onClick={() => setSelectedStudent(null)}
                      >
                        Clear
                      </button>
                    </p>
                  ) : null}
                  {studentHits.length > 0 && !selectedStudent ? (
                    <ul className="border border-[var(--line)] bg-white text-sm">
                      {studentHits.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-[rgba(20,80,163,0.06)]"
                            onClick={() => {
                              setSelectedStudent(s);
                              setStudentQuery(`${s.full_name} (${s.student_id})`);
                              setStudentHits([]);
                            }}
                          >
                            {s.full_name} · {s.student_id}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button type="submit" className="btn-primary md:col-span-2">
                  Record sale
                </button>
              </form>

              <section>
                <h2 className="font-display text-2xl text-[var(--brand-green)]">
                  Sales history
                </h2>
                <ul className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)] bg-white/80">
                  {sales.map((s) => (
                    <li key={s.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>
                          {s.item_name} × {s.quantity} ·{" "}
                          <strong>{naira(s.total_amount)}</strong>
                        </span>
                        <span className="text-[var(--muted)]">
                          {s.recorded_at
                            ? new Date(s.recorded_at).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      <p className="text-[var(--muted)]">
                        {s.student_code
                          ? `${s.student_name} (${s.student_code})`
                          : s.buyer_name || "Walk-in"}{" "}
                        · by {s.recorded_by_name || "—"}
                      </p>
                    </li>
                  ))}
                  {sales.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-[var(--muted)]">
                      No sales yet.
                    </li>
                  ) : null}
                </ul>
              </section>
            </>
          )}
        </div>
      ) : null}

      {tab === "assignments" && canManageAssignments ? (
        <div className="space-y-6">
          <form
            onSubmit={assignStaff}
            className="grid gap-3 border border-[var(--line)] bg-white/80 p-5 md:grid-cols-3"
          >
            <h2 className="font-display text-2xl text-[var(--brand-green)] md:col-span-3">
              Assign store staff
            </h2>
            <select name="inventory" className="field-input" required>
              {inventories.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name}
                </option>
              ))}
            </select>
            <select name="staff" className="field-input" required>
              {storeStaff.length === 0 ? (
                <option value="">No store staff users</option>
              ) : null}
              {storeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.user?.username ? ` (${s.user.username})` : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={storeStaff.length === 0}>
              Assign
            </button>
          </form>

          <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-white/80">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {a.staff_name}
                  {a.staff_username ? ` (${a.staff_username})` : ""} →{" "}
                  {a.inventory_name}
                  {!a.is_active ? " · inactive" : ""}
                </span>
                <button
                  type="button"
                  className="btn-outline text-sm"
                  onClick={() => toggleAssignment(a)}
                >
                  {a.is_active ? "Deactivate" : "Activate"}
                </button>
              </li>
            ))}
            {assignments.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[var(--muted)]">
                No assignments yet.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

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

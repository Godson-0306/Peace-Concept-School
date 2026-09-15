"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { loadClassLevels } from "@/lib/classLevels";

type ClassLevel = {
  id: number;
  name: string;
  order: number;
  fee_section: string;
};

type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
};

type FeeSection = {
  key: string;
  label: string;
  hint: string;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function SettingsClassesPage() {
  const router = useRouter();
  const [levels, setLevels] = useState<ClassLevel[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [sections, setSections] = useState<FeeSection[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Record<number, ClassLevel>>({});

  const user = getStoredUser();
  const isAdmin = user?.account_type === "admin";
  const canAccess =
    user?.account_type === "admin" || user?.account_type === "principal";

  const loadAll = useCallback(async () => {
    const [levelList, armData, sectionData] = await Promise.all([
      loadClassLevels(true),
      apiJson<{ results?: ClassArm[] } | ClassArm[]>("/api/class-arms/?page_size=500"),
      apiJson<FeeSection[]>("/api/fee-sections/"),
    ]);
    const withSection = (levelList as ClassLevel[]).map((level) => ({
      ...level,
      fee_section: level.fee_section || "",
    }));
    // loadClassLevels returns ClassLevelNav without fee_section — refetch full rows.
    const full = await apiJson<{ results?: ClassLevel[] } | ClassLevel[]>(
      "/api/class-levels/?page_size=200",
    );
    const rows = unwrapList(full).sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name),
    );
    setLevels(rows.length ? rows : withSection);
    setArms(unwrapList(armData));
    setSections(Array.isArray(sectionData) ? sectionData : []);
    setEditing({});
  }, []);

  useEffect(() => {
    if (
      user &&
      user.account_type !== "admin" &&
      user.account_type !== "principal"
    ) {
      router.replace("/app");
      return;
    }
    if (!canAccess) return;
    loadAll().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load classes"),
    );
  }, [canAccess, loadAll, router, user]);

  function draft(level: ClassLevel): ClassLevel {
    return editing[level.id] ?? level;
  }

  async function saveLevel(level: ClassLevel) {
    const next = draft(level);
    setPending(true);
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/class-levels/${level.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: next.name,
          order: Number(next.order),
          fee_section: next.fee_section,
        }),
      });
      setMessage(`${next.name} saved.`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save class");
    } finally {
      setPending(false);
    }
  }

  async function createLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    setError("");
    try {
      await apiJson("/api/class-levels/", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          order: Number(form.get("order") || levels.length + 1),
          fee_section: form.get("fee_section") || "",
        }),
      });
      setMessage("Class created with arms A and B.");
      event.currentTarget.reset();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create class");
    } finally {
      setPending(false);
    }
  }

  if (user && !canAccess) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Settings
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Classes
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          School class ladder (Creche first). Order controls Users navigation,
          enrolment, and bursary mapping. Each class has arms A and B.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue-deep)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <form
          onSubmit={createLevel}
          className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6"
        >
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            Add class
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label className="field">
              <span>Name</span>
              <input name="name" required className="field-input" placeholder="e.g. Creche" />
            </label>
            <label className="field">
              <span>Order</span>
              <input
                name="order"
                type="number"
                min="1"
                defaultValue={levels.length + 1}
                className="field-input"
              />
            </label>
            <label className="field">
              <span>Fee section</span>
              <select name="fee_section" className="field-input" defaultValue="">
                <option value="">Select</option>
                {sections.map((section) => (
                  <option key={section.key} value={section.key}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn-primary mt-5" disabled={pending}>
            {pending ? "Saving…" : "Create class"}
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/90">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Order</th>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Fee section</th>
              <th className="px-5 py-3 font-semibold">Arms</th>
              <th className="px-5 py-3 font-semibold"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {levels.map((level) => {
              const row = draft(level);
              const levelArms = arms
                .filter((arm) => arm.class_level === level.id)
                .sort((a, b) => a.name.localeCompare(b.name));
              return (
                <tr key={level.id}>
                  <td className="px-5 py-3">
                    <input
                      className="field-input w-20"
                      type="number"
                      min="1"
                      value={row.order}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [level.id]: { ...row, order: Number(e.target.value) },
                        }))
                      }
                      disabled={!isAdmin}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      className="field-input"
                      value={row.name}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [level.id]: { ...row, name: e.target.value },
                        }))
                      }
                      disabled={!isAdmin}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="field-input"
                      value={row.fee_section}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [level.id]: { ...row, fee_section: e.target.value },
                        }))
                      }
                      disabled={!isAdmin}
                    >
                      <option value="">Select</option>
                      {sections.map((section) => (
                        <option key={section.key} value={section.key}>
                          {section.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">
                    {levelArms.map((arm) => arm.name).join(" · ") || "A · B"}
                  </td>
                  <td className="px-5 py-3">
                    {isAdmin ? (
                      <button
                        type="button"
                        className="text-sm font-bold text-[var(--brand-blue)]"
                        disabled={pending}
                        onClick={() => saveLevel(level)}
                      >
                        Save
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .field span {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.65rem;
          padding: 0.55rem 0.7rem;
        }
      `}</style>
    </div>
  );
}

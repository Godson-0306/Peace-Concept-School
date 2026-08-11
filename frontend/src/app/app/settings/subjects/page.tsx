"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import {
  ClassLevelNav,
  SUBJECT_LEVEL_BANDS,
  sortClassLevelsForUsers,
} from "@/lib/portalNav";

type Subject = {
  id: number;
  name: string;
  code: string;
  class_level: number;
  class_level_name: string;
  subject_type: "subject" | "additional_assessment";
  is_active: boolean;
  order?: number;
};

type BandSubject = {
  name: string;
  code: string;
  subject_type: Subject["subject_type"];
  is_active: boolean;
  /** One row per class level in the band that has this subject name. */
  rows: Subject[];
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function groupBandSubjects(subjects: Subject[]): BandSubject[] {
  const map = new Map<string, BandSubject>();
  for (const subject of subjects) {
    const key = subject.name.trim().toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name: subject.name,
        code: subject.code,
        subject_type: subject.subject_type,
        is_active: subject.is_active,
        rows: [subject],
      });
      continue;
    }
    existing.rows.push(subject);
    // Prefer non-empty code / active flag if any row has it.
    if (!existing.code && subject.code) existing.code = subject.code;
    if (subject.is_active) existing.is_active = true;
  }
  return [...map.values()].sort((a, b) => {
    const orderA = Math.min(...a.rows.map((r) => r.order ?? 0));
    const orderB = Math.min(...b.rows.map((r) => r.order ?? 0));
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export default function SettingsSubjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [bandId, setBandId] = useState<(typeof SUBJECT_LEVEL_BANDS)[number]["id"]>(
    "primary",
  );
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<BandSubject | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage =
    user?.account_type === "admin" || user?.account_type === "principal";

  const orderedLevels = useMemo(() => sortClassLevelsForUsers(levels), [levels]);

  const band = useMemo(
    () => SUBJECT_LEVEL_BANDS.find((item) => item.id === bandId) ?? SUBJECT_LEVEL_BANDS[1],
    [bandId],
  );

  const bandLevels = useMemo(() => {
    const allowed = new Set(band.levels);
    return orderedLevels.filter((level) => allowed.has(level.name as never));
  }, [band, orderedLevels]);

  const bandSubjects = useMemo(() => groupBandSubjects(subjects), [subjects]);

  const loadLevels = useCallback(async () => {
    const levelData = await apiJson<{ results?: ClassLevelNav[] } | ClassLevelNav[]>(
      "/api/class-levels/?page_size=200",
    );
    setLevels(unwrapList(levelData));
  }, []);

  const loadBandSubjects = useCallback(async (levelIds: number[]) => {
    if (!levelIds.length) {
      setSubjects([]);
      return;
    }
    const batches = await Promise.all(
      levelIds.map((id) =>
        apiJson<{ results?: Subject[] } | Subject[]>(
          `/api/subjects/?class_level=${id}&page_size=500`,
        ),
      ),
    );
    setSubjects(batches.flatMap((batch) => unwrapList(batch)));
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (
      stored &&
      stored.account_type !== "admin" &&
      stored.account_type !== "principal"
    ) {
      router.replace("/app");
      return;
    }
    setLoading(true);
    loadLevels()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [router, loadLevels]);

  useEffect(() => {
    setEditing(null);
    setMessage("");
    setError("");
    if (!bandLevels.length) {
      setSubjects([]);
      return;
    }
    loadBandSubjects(bandLevels.map((level) => level.id)).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load subjects"),
    );
  }, [bandLevels, loadBandSubjects]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !bandLevels.length) return;
    setPending(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const code = String(form.get("code") || "").trim();
    const subject_type = String(form.get("subject_type") || "subject") as Subject["subject_type"];
    const is_active = form.get("is_active") === "on";

    if (!name) {
      setError("Subject name is required.");
      setPending(false);
      return;
    }

    try {
      if (editing) {
        await Promise.all(
          editing.rows.map((row) =>
            apiJson(`/api/subjects/${row.id}/`, {
              method: "PATCH",
              body: JSON.stringify({
                name,
                code,
                subject_type,
                is_active,
                department: null,
              }),
            }),
          ),
        );
        // Ensure every level in the band has this subject after rename/edit.
        const existingLevelIds = new Set(editing.rows.map((row) => row.class_level));
        const created: string[] = [];
        for (const level of bandLevels) {
          if (existingLevelIds.has(level.id)) continue;
          try {
            await apiJson("/api/subjects/", {
              method: "POST",
              body: JSON.stringify({
                name,
                code,
                class_level: level.id,
                department: null,
                subject_type,
                is_active,
              }),
            });
            created.push(level.name);
          } catch (e) {
            const text = e instanceof Error ? e.message : "";
            if (!text.includes("unique")) throw e;
          }
        }
        setMessage(
          created.length
            ? `Updated “${name}” across ${band.label} (also added on ${created.join(", ")}).`
            : `Updated “${name}” across ${band.label}.`,
        );
      } else {
        const created: string[] = [];
        const skipped: string[] = [];
        for (const level of bandLevels) {
          try {
            await apiJson("/api/subjects/", {
              method: "POST",
              body: JSON.stringify({
                name,
                code,
                class_level: level.id,
                department: null,
                subject_type,
                is_active,
              }),
            });
            created.push(level.name);
          } catch (e) {
            const text = e instanceof Error ? e.message : "";
            if (text.includes("unique") || text.includes("unique set")) {
              skipped.push(level.name);
              continue;
            }
            throw e;
          }
        }
        if (!created.length && skipped.length) {
          setMessage(
            `“${name}” already exists for all ${band.label} classes (${skipped.join(", ")}).`,
          );
        } else if (skipped.length) {
          setMessage(
            `Added “${name}” for ${created.join(", ")}. Already present on ${skipped.join(", ")}.`,
          );
        } else {
          setMessage(
            `Added “${name}” for all ${band.label} classes (${created.join(", ")}).`,
          );
        }
      }
      setEditing(null);
      event.currentTarget.reset();
      await loadBandSubjects(bandLevels.map((level) => level.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save subject");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(item: BandSubject) {
    const levelNames = item.rows.map((row) => row.class_level_name).join(", ");
    if (
      !confirm(
        `Remove “${item.name}” from all ${band.label} classes (${levelNames})?`,
      )
    ) {
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      for (const row of item.rows) {
        const response = await apiFetch(`/api/subjects/${row.id}/`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 204) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            typeof payload.detail === "string" ? payload.detail : "Delete failed",
          );
        }
      }
      setMessage(`Removed “${item.name}” from ${band.label}.`);
      if (editing?.name.toLowerCase() === item.name.toLowerCase()) {
        setEditing(null);
      }
      await loadBandSubjects(bandLevels.map((level) => level.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete subject");
    } finally {
      setPending(false);
    }
  }

  if (user && !canManage) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Settings
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Subjects Settings
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          Add a subject once for a whole section. Basic 1–5 share one list, JSS1–3
          share one list, and SS1–3 share one list (same for Nursery).
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

      <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Section
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SUBJECT_LEVEL_BANDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBandId(item.id)}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                bandId === item.id
                  ? "bg-[var(--brand-blue)] text-white"
                  : "bg-[var(--mist)] text-[var(--ink)] hover:bg-[var(--brand-blue-wash)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {loading
            ? "Loading classes…"
            : bandLevels.length
              ? `Applies to: ${bandLevels.map((level) => level.name).join(" · ")}`
              : "No class levels found for this section."}
        </p>
      </div>

      {canManage && bandLevels.length ? (
        <form
          onSubmit={onSubmit}
          key={editing ? `edit-${editing.name}` : `new-${bandId}`}
          className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6"
        >
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            {editing
              ? `Edit subject · ${band.label}`
              : `Add subject · ${band.label}`}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {editing
              ? "Changes apply to every class in this section that has this subject."
              : "Creates the subject on every class in this section. Existing copies are left as-is."}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="field sm:col-span-2">
              <span>Subject name</span>
              <input
                name="name"
                required
                defaultValue={editing?.name ?? ""}
                placeholder="e.g. Mathematics"
                className="field-input"
              />
            </label>
            <label className="field">
              <span>Code (optional)</span>
              <input
                name="code"
                defaultValue={editing?.code ?? ""}
                placeholder="e.g. MTH"
                className="field-input"
              />
            </label>
            <label className="field">
              <span>Type</span>
              <select
                name="subject_type"
                defaultValue={editing?.subject_type ?? "subject"}
                className="field-input"
              >
                <option value="subject">Subject</option>
                <option value="additional_assessment">Additional assessment</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editing ? editing.is_active : true}
              />
              <span>Active (available for assessments)</span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Add subject"}
            </button>
            {editing ? (
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                onClick={() => setEditing(null)}
                disabled={pending}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            Subjects · {band.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {bandSubjects.length} subject{bandSubjects.length === 1 ? "" : "s"} in
            this section
          </p>
        </div>
        {!bandLevels.length ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
            No class levels found for this section.
          </p>
        ) : bandSubjects.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
            No subjects yet for {band.label}. Add the first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Subject</th>
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Classes</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  {canManage ? (
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {bandSubjects.map((item) => (
                  <tr key={item.name.toLowerCase()}>
                    <td className="px-5 py-3.5 font-semibold">{item.name}</td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {item.code || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {item.subject_type === "additional_assessment"
                        ? "Additional"
                        : "Subject"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {item.rows.length}/{bandLevels.length} ·{" "}
                      {item.rows
                        .map((row) => row.class_level_name)
                        .sort()
                        .join(", ")}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.is_active ? (
                        <span className="font-semibold text-[var(--brand-blue)]">
                          Active
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">Inactive</span>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-5 py-3.5">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--brand-blue)] hover:underline"
                            onClick={() => {
                              setEditing(item);
                              setMessage("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--brand-pink)] hover:underline"
                            onClick={() => onDelete(item)}
                            disabled={pending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          width: 100%;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.65rem;
          padding: 0.65rem 0.75rem;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}

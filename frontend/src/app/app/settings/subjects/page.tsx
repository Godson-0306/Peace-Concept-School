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
  department: number | null;
  department_name?: string;
  subject_type: "subject" | "additional_assessment";
  is_active: boolean;
};

type Department = { id: number; name: string };

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function SettingsSubjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [bandId, setBandId] = useState<(typeof SUBJECT_LEVEL_BANDS)[number]["id"]>(
    "nursery",
  );
  const [levelId, setLevelId] = useState<number | "">("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage =
    user?.account_type === "admin" || user?.account_type === "principal";

  const orderedLevels = useMemo(() => sortClassLevelsForUsers(levels), [levels]);

  const bandLevels = useMemo(() => {
    const band = SUBJECT_LEVEL_BANDS.find((b) => b.id === bandId);
    if (!band) return [];
    const allowed = new Set(band.levels);
    return orderedLevels.filter((level) => allowed.has(level.name as never));
  }, [bandId, orderedLevels]);

  const selectedLevel = useMemo(
    () => bandLevels.find((level) => level.id === levelId) ?? null,
    [bandLevels, levelId],
  );

  const loadBase = useCallback(async () => {
    const [levelData, deptData] = await Promise.all([
      apiJson<{ results?: ClassLevelNav[] } | ClassLevelNav[]>("/api/class-levels/"),
      apiJson<{ results?: Department[] } | Department[]>("/api/departments/"),
    ]);
    setLevels(unwrapList(levelData));
    setDepartments(unwrapList(deptData));
  }, []);

  const loadSubjects = useCallback(async (classLevelId: number) => {
    const data = await apiJson<{ results?: Subject[] } | Subject[]>(
      `/api/subjects/?class_level=${classLevelId}`,
    );
    setSubjects(unwrapList(data));
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
    loadBase()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [router, loadBase]);

  useEffect(() => {
    if (!bandLevels.length) {
      setLevelId("");
      return;
    }
    setLevelId((current) =>
      current && bandLevels.some((level) => level.id === current)
        ? current
        : bandLevels[0].id,
    );
  }, [bandLevels]);

  useEffect(() => {
    if (!levelId) {
      setSubjects([]);
      return;
    }
    loadSubjects(levelId).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load subjects"),
    );
  }, [levelId, loadSubjects]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !levelId) return;
    setPending(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const departmentRaw = String(form.get("department") || "");
    const payload = {
      name: String(form.get("name") || "").trim(),
      code: String(form.get("code") || "").trim(),
      class_level: levelId,
      department: departmentRaw ? Number(departmentRaw) : null,
      subject_type: String(form.get("subject_type") || "subject"),
      is_active: form.get("is_active") === "on",
    };
    try {
      if (editing) {
        await apiJson(`/api/subjects/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage(`Updated “${payload.name}”.`);
      } else {
        await apiJson("/api/subjects/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage(`Added “${payload.name}” for ${selectedLevel?.name ?? "class"}.`);
      }
      setEditing(null);
      event.currentTarget.reset();
      await loadSubjects(levelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save subject");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(subject: Subject) {
    if (!confirm(`Remove “${subject.name}” from ${subject.class_level_name}?`)) {
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`/api/subjects/${subject.id}/`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload.detail === "string" ? payload.detail : "Delete failed",
        );
      }
      setMessage(`Removed “${subject.name}”.`);
      if (editing?.id === subject.id) setEditing(null);
      if (levelId) await loadSubjects(levelId);
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
          Set the subjects available for Nursery, Primary, Junior Secondary, and
          Senior Secondary classes.
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
          {SUBJECT_LEVEL_BANDS.map((band) => (
            <button
              key={band.id}
              type="button"
              onClick={() => setBandId(band.id)}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                bandId === band.id
                  ? "bg-[var(--brand-blue)] text-white"
                  : "bg-[var(--mist)] text-[var(--ink)] hover:bg-[var(--brand-blue-wash)]"
              }`}
            >
              {band.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Class level
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading classes…</p>
          ) : bandLevels.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No class levels found for this section.
            </p>
          ) : (
            bandLevels.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => setLevelId(level.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  levelId === level.id
                    ? "bg-[var(--brand-blue-deep)] text-white"
                    : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--mist)]"
                }`}
              >
                {level.name}
              </button>
            ))
          )}
        </div>
      </div>

      {canManage && levelId ? (
        <form
          onSubmit={onSubmit}
          key={editing ? `edit-${editing.id}` : `new-${levelId}`}
          className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6"
        >
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            {editing ? "Edit subject" : `Add subject · ${selectedLevel?.name ?? ""}`}
          </h2>
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
            <label className="field sm:col-span-2">
              <span>Department (optional)</span>
              <select
                name="department"
                defaultValue={editing?.department ?? ""}
                className="field-input"
              >
                <option value="">— None —</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
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
            {selectedLevel
              ? `Subjects · ${selectedLevel.name}`
              : "Subjects"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} configured
          </p>
        </div>
        {!levelId ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
            Choose a class level to view subjects.
          </p>
        ) : subjects.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
            No subjects yet for this class. Add the first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Subject</th>
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  {canManage ? (
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className="px-5 py-3.5 font-semibold">{subject.name}</td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {subject.code || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {subject.subject_type === "additional_assessment"
                        ? "Additional"
                        : "Subject"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {subject.department_name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {subject.is_active ? (
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
                              setEditing(subject);
                              setMessage("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--brand-pink)] hover:underline"
                            onClick={() => onDelete(subject)}
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

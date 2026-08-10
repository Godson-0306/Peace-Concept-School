"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";

type GalleryItem = {
  id: number;
  title: string;
  image: string;
  caption: string;
  is_published: boolean;
  created_at: string;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function PortalGalleryPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const data = await apiJson<{ results?: GalleryItem[] } | GalleryItem[]>(
      "/api/website/gallery/",
    );
    setItems(unwrapList(data));
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored && stored.account_type !== "admin") {
      router.replace("/app");
      return;
    }
    load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load gallery"),
    );
  }, [router, load]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const published = data.get("is_published") === "on";
    data.set("is_published", published ? "true" : "false");

    const file = data.get("image");
    if (editing && (!(file instanceof File) || file.size === 0)) {
      data.delete("image");
    }

    try {
      const path = editing
        ? `/api/website/gallery/${editing.id}/`
        : "/api/website/gallery/";
      const response = await apiFetch(path, {
        method: editing ? "PATCH" : "POST",
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : JSON.stringify(payload) || "Save failed",
        );
      }
      setMessage(editing ? "Gallery item updated." : "Gallery item added.");
      setEditing(null);
      form.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save gallery item");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(item: GalleryItem) {
    if (!confirm(`Delete “${item.title || "this image"}”?`)) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`/api/website/gallery/${item.id}/`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload.detail === "string" ? payload.detail : "Delete failed",
        );
      }
      setMessage("Gallery item deleted.");
      if (editing?.id === item.id) setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete item");
    } finally {
      setPending(false);
    }
  }

  if (user && user.account_type !== "admin") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Gallery
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Manage gallery
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          Add, update, or remove photos shown on the public gallery page.
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

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6"
      >
        <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
          {editing ? "Edit image" : "Add image"}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span>Title</span>
            <input
              name="title"
              defaultValue={editing?.title ?? ""}
              key={`title-${editing?.id ?? "new"}`}
              className="field-input"
              placeholder="e.g. Morning assembly"
            />
          </label>
          <label className="field sm:col-span-2">
            <span>Caption</span>
            <input
              name="caption"
              defaultValue={editing?.caption ?? ""}
              key={`caption-${editing?.id ?? "new"}`}
              className="field-input"
              placeholder="Optional caption"
            />
          </label>
          <label className="field sm:col-span-2">
            <span>{editing ? "Replace image (optional)" : "Image"}</span>
            <input
              name="image"
              type="file"
              accept="image/*"
              required={!editing}
              className="field-input"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <input
              name="is_published"
              type="checkbox"
              defaultChecked={editing?.is_published ?? true}
              key={`pub-${editing?.id ?? "new"}`}
            />
            Published on public site
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : editing ? "Update image" : "Add image"}
          </button>
          {editing ? (
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
              onClick={() => setEditing(null)}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-2xl border border-[var(--line)] bg-white/90">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            Gallery items
          </h2>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
            No gallery images yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6"
              >
                <div className="relative h-16 w-20 overflow-hidden rounded-lg bg-[var(--mist)]">
                  {item.image ? (
                    <Image
                      src={mediaUrl(item.image)}
                      alt={item.title || "Gallery image"}
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--ink)]">
                    {item.title || "Untitled"}
                    {!item.is_published ? (
                      <span className="ml-2 text-xs font-bold uppercase text-[var(--muted)]">
                        Draft
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {item.caption || "No caption"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-sm font-bold text-[var(--brand-blue)] hover:underline"
                    onClick={() => setEditing(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-sm font-bold text-[var(--brand-pink)] hover:underline"
                    onClick={() => onDelete(item)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
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

"use client";

import { useState } from "react";
import { HANDLE_RULES, validateHandle } from "@/lib/game/config";

/**
 * Inline editor for the player's handle. Displays the name with an "edit"
 * affordance; on save it PATCHes /api/me and calls onSaved (typically the
 * session refresh).
 */
export function HandleEditor({
  current,
  onSaved,
}: {
  current: string;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = validateHandle(value);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (v.handle === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: v.handle }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setEditing(false);
      await onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-2xl font-black">{current}</span>
        <button
          type="button"
          onClick={() => {
            setValue(current);
            setError(null);
            setEditing(true);
          }}
          className="text-xs text-muted underline underline-offset-2 hover:text-accent"
        >
          edit
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <input
          autoFocus
          value={value}
          maxLength={HANDLE_RULES.max}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-48 rounded-md border border-border bg-surface-2 px-2 py-1 text-lg font-bold outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn btn-primary px-3 py-1 text-xs"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn btn-ghost px-3 py-1 text-xs"
        >
          Cancel
        </button>
      </span>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}

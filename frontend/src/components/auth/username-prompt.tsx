"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * New users who sign up without a username (e.g. via Google) are asked for one right after
 * signing in. The navbar then greets them by it. Needs "Username" enabled in the Clerk
 * dashboard (Configure → Email, phone, username).
 */
export function UsernamePrompt() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoaded || !isSignedIn || user.username) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (name.length < 4) {
      setError("Use at least 4 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await user.update({ username: name });
    } catch (err) {
      const msg = (err as { errors?: { longMessage?: string; message: string }[] }).errors?.[0];
      setError(msg?.longMessage ?? msg?.message ?? "Could not save that username. Try another.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-neem/40 px-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-title"
        className="w-full max-w-md rounded-3xl bg-paper p-7 text-neem shadow-[0_8px_0_#173f30]"
      >
        <h2 id="username-title" className="font-hand text-4xl font-bold leading-none">
          Welcome to Taskora!
        </h2>
        <p className="font-note mt-3 text-lg text-neem-soft">Pick a username so your team knows who you are.</p>
        <label htmlFor="username" className="mt-5 block text-sm font-semibold">
          Username
        </label>
        <input
          id="username"
          autoFocus
          autoComplete="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 w-full rounded-xl bg-paper-deep px-4 py-3 text-lg text-neem ring-2 ring-neem placeholder:text-moss focus:outline-none focus-visible:ring-saffron"
          placeholder="e.g. ravi_k"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-kumkum">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-full bg-haldi px-6 py-3 text-lg font-semibold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/** Mirrors the signed-in Clerk user into Neon (once per session, and again if the username changes). */
export function UserSync() {
  const { isLoaded, isSignedIn, user } = useUser();
  const id = user?.id;
  const username = user?.username ?? "";

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !id) return;
    const key = `taskora-synced:${id}:${username}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {}
    fetch("/api/users/sync", { method: "POST" })
      .then((r) => {
        if (!r.ok) return;
        try {
          sessionStorage.setItem(key, "1");
        } catch {}
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, id, username]);

  return null;
}

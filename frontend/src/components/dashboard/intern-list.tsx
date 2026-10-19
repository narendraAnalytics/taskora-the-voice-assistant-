"use client";

import { GraduationCap, Trash2, Undo2, X } from "lucide-react";
import type { Invite } from "@/app/dashboard/actions";
import { Avatar } from "@/components/dashboard/status-chip";
import { cn } from "@/lib/utils";

export type Confirm = { id: string; kind: "complete" | "remove" } | null;

type Props = {
  invites: Invite[];
  view: "active" | "completed";
  setView: (v: "active" | "completed") => void;
  confirm: Confirm;
  setConfirm: (c: Confirm) => void;
  pending: boolean;
  error: string;
  onRevoke: (id: string) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onRemove: (id: string) => void;
};

const STATUS_CHIP: Record<Invite["status"], [string, string]> = {
  joined: ["Joined", "bg-tulsi text-neem"],
  invited: ["Invited", "bg-haldi text-neem"],
  completed: ["Completed", "bg-sage text-neem"],
  revoked: ["Revoked", "bg-sage text-neem"],
};

const iconBtn =
  "grid size-8 place-items-center rounded-full ring-1 ring-neem/25 hover:bg-kumkum hover:text-paper focus-visible:outline-2 focus-visible:outline-saffron";
const pillBtn =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-neem/25 focus-visible:outline-2 focus-visible:outline-saffron";

/** Interns grouped Active / Completed. Completing or removing asks first; invited rows keep the revoke X. */
export function InternList({ invites, view, setView, confirm, setConfirm, pending, error, onRevoke, onComplete, onReopen, onRemove }: Props) {
  const done = invites.filter((i) => i.status === "completed");
  const active = invites.filter((i) => i.status !== "completed");
  const tab = done.length === 0 ? "active" : view;
  const shown = tab === "active" ? active : done;

  return (
    <div className="mt-7 border-t border-neem/15 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-hand text-3xl font-bold leading-none">Your interns</h3>
        {done.length > 0 && (
          <div role="tablist" className="flex gap-1 rounded-full bg-neem/10 p-1 text-sm font-bold">
            {(["active", "completed"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                type="button"
                onClick={() => setView(t)}
                className={cn("rounded-full px-3.5 py-1", tab === t ? "bg-neem text-paper" : "hover:bg-haldi/60")}
              >
                {t === "active" ? `Active ${active.length}` : `Completed ${done.length}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-kumkum px-4 py-2.5 text-sm font-semibold text-paper">
          {error}
        </p>
      )}

      <ul className="mt-2 divide-y divide-neem/10">
        {shown.map((i) => {
          const label = i.name ?? i.email;
          const asking = confirm?.id === i.id ? confirm.kind : null;
          const [chipText, chipTone] = STATUS_CHIP[i.status];
          const remove = (
            <button type="button" onClick={() => setConfirm({ id: i.id, kind: "remove" })} disabled={pending} aria-label={`Remove ${label}`} className={iconBtn}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          );
          return (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={label} className={i.status === "completed" ? "opacity-60" : undefined} />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{label}</span>
                    {i.position && (
                      <span className="shrink-0 rounded-md bg-haldi px-2 py-0.5 text-xs font-bold text-neem ring-1 ring-neem/25">{i.position}</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-moss">{[i.college, i.email, i.phone].filter(Boolean).join(" · ")}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", chipTone)}>{chipText}</span>

                {i.status === "invited" && (
                  <button type="button" onClick={() => onRevoke(i.id)} disabled={pending} aria-label={`Revoke invite for ${i.email}`} className={iconBtn}>
                    <X className="size-4" aria-hidden />
                  </button>
                )}
                {i.status === "joined" && (
                  <>
                    <button type="button" onClick={() => setConfirm({ id: i.id, kind: "complete" })} disabled={pending} className={cn(pillBtn, "hover:bg-tulsi")}>
                      <GraduationCap className="size-4" aria-hidden />
                      Mark completed
                    </button>
                    {remove}
                  </>
                )}
                {i.status === "completed" && (
                  <>
                    <button type="button" onClick={() => onReopen(i.id)} disabled={pending} className={cn(pillBtn, "hover:bg-haldi/60")}>
                      <Undo2 className="size-4" aria-hidden />
                      Reopen
                    </button>
                    {remove}
                  </>
                )}
              </div>

              {asking && (
                <div
                  role="alertdialog"
                  aria-label="Confirm"
                  className={cn(
                    "mt-3 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3",
                    asking === "remove" ? "bg-kumkum/15 ring-1 ring-kumkum/40" : "bg-tulsi/40 ring-1 ring-neem/20",
                  )}
                >
                  <p className="min-w-0 flex-1 basis-56 text-sm font-semibold">
                    {asking === "complete"
                      ? `Mark ${label}'s internship as completed? They leave the active board and can no longer sign in. You can reopen it later.`
                      : `Remove ${label} for good? Their account is deleted and this cannot be undone.`}
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => (asking === "complete" ? onComplete(i.id) : onRemove(i.id))}
                    autoFocus
                    className={cn("rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60", asking === "remove" ? "bg-kumkum text-paper" : "bg-neem text-paper")}
                  >
                    {pending ? "Working…" : asking === "complete" ? "Yes, mark completed" : "Yes, remove"}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} disabled={pending} className="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-neem/30 hover:bg-haldi/50">
                    Cancel
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

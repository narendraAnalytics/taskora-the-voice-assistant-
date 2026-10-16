"use client";

import { useState, useTransition } from "react";
import { MailPlus, UserPlus, X } from "lucide-react";
import { inviteIntern, revokeInvite, type Invite } from "@/app/dashboard/actions";
import { Avatar } from "@/components/dashboard/status-chip";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const field =
  "h-12 w-full rounded-2xl bg-paper-deep/60 px-4 text-neem ring-1 ring-neem/20 placeholder:text-moss focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron";

/**
 * Organizer-only "Add interns" button + form. Interns get an emailed link to set their own
 * password, so nothing secret is shared. Invited interns are listed under the form.
 */
export function InviteDialog({ initial }: { initial: Invite[] }) {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState(initial);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const waiting = invites.filter((i) => i.status === "invited").length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNote("");
    start(async () => {
      const r = await inviteIntern(form);
      if (!r.ok) return setError(r.error);
      setInvites(r.invites);
      setNote(`Invite sent to ${form.email.trim()}. Add another?`);
      setForm({ name: "", email: "", phone: "" });
    });
  };

  const revoke = (id: string) =>
    start(async () => {
      const r = await revokeInvite(id);
      if (r.ok) setInvites(r.invites);
      else setError(r.error);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError("");
          setNote("");
        }
      }}
    >
      <DialogTrigger
        className="group relative inline-flex items-center gap-2.5 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_5px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-haldi"
      >
        <UserPlus className="size-5 transition-transform group-hover:rotate-12" aria-hidden />
        Add interns
        {waiting > 0 && (
          <span className="grid min-w-6 place-items-center rounded-full bg-neem px-1.5 text-sm text-paper" aria-label={`${waiting} pending invites`}>
            {waiting}
          </span>
        )}
      </DialogTrigger>

      <DialogContent
        className="max-h-[90svh] gap-0 overflow-y-auto rounded-[2rem] bg-paper p-6 text-neem ring-2 ring-neem/20 sm:max-w-lg sm:p-8"
      >
        <DialogTitle className="font-hand text-4xl font-bold leading-none">Add an intern</DialogTitle>
        <DialogDescription className="font-note mt-2 text-base text-moss">
          They get an email link to set their own password. Nothing to share.
        </DialogDescription>

        <form onSubmit={submit} className="mt-6 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Full name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ravi Teja"
              className={field}
              autoComplete="off"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ravi@college.edu"
              className={field}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Phone number</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="98765 43210"
              className={field}
              autoComplete="off"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-kumkum px-4 py-2.5 text-sm font-semibold text-paper">
              {error}
            </p>
          )}
          {note && (
            <p role="status" className="rounded-xl bg-tulsi px-4 py-2.5 text-sm font-semibold text-neem">
              {note}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30] disabled:opacity-60"
          >
            <MailPlus className="size-5" aria-hidden />
            {pending ? "Saving…" : "Save and send invite"}
          </button>
        </form>

        {invites.length > 0 && (
          <div className="mt-7 border-t border-neem/15 pt-5">
            <h3 className="font-hand text-3xl font-bold leading-none">Your interns</h3>
            <ul className="mt-2 divide-y divide-neem/10">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <Avatar name={i.name ?? i.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.name ?? i.email}</p>
                    <p className="truncate text-sm text-moss">
                      {i.email}
                      {i.phone ? ` · ${i.phone}` : ""}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", i.status === "joined" ? "bg-tulsi text-neem" : "bg-haldi text-neem")}>
                    {i.status === "joined" ? "Joined" : "Invited"}
                  </span>
                  {i.status === "invited" && (
                    <button
                      type="button"
                      onClick={() => revoke(i.id)}
                      disabled={pending}
                      aria-label={`Revoke invite for ${i.email}`}
                      className="grid size-8 place-items-center rounded-full ring-1 ring-neem/25 hover:bg-kumkum hover:text-paper"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

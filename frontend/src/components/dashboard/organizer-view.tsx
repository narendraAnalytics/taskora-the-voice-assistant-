"use client";

import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { INTERNS, type Intern, type Status } from "@/lib/demo-data";
import type { Invite } from "@/app/dashboard/actions";
import { InviteDialog } from "@/components/dashboard/invite-dialog";
import { Jarvis } from "@/components/dashboard/jarvis";
import { Avatar, StatusChip } from "@/components/dashboard/status-chip";
import { Shell } from "@/components/dashboard/shell";
import { cn } from "@/lib/utils";

const card = "rounded-[2rem] bg-paper-deep/70 p-5 ring-1 ring-neem/10 sm:p-6";

export function OrganizerView({ name, invites }: { name: string; invites: Invite[] }) {
  const [interns, setInterns] = useState<Intern[]>(INTERNS);

  /* Swap who owns a task: the receiver takes the sender's task, the sender is freed up. */
  const reassign = (fromId: string, toId: string) =>
    setInterns((list) => {
      const from = list.find((i) => i.id === fromId);
      if (!from) return list;
      return list.map((i) => {
        if (i.id === toId)
          return { ...i, task: from.task, status: "todo" as Status, progress: from.progress, due: from.due, update: `Took over ${from.task} from ${from.name}.`, updatedAt: "Just now" };
        if (i.id === fromId) return { ...i, task: "No task yet", status: "todo" as Status, progress: 0, due: "—", update: `Handed ${from.task} to a teammate.`, updatedAt: "Just now" };
        return i;
      });
    });

  const count = (s: Status) => interns.filter((i) => i.status === s).length;
  const behind = count("overdue") + count("blocked");
  const stats = [
    { label: "Interns", value: interns.length, icon: Users, tone: "bg-neem text-paper", sub: "in this batch" },
    { label: "On track", value: count("progress") + count("done"), icon: Activity, tone: "bg-tulsi text-neem", sub: "moving or done" },
    { label: "Done", value: count("done"), icon: CheckCircle2, tone: "bg-haldi text-neem", sub: "tasks finished" },
    { label: "Behind", value: behind, icon: AlertTriangle, tone: "bg-kumkum text-paper", sub: "blocked or overdue" },
  ];

  const feed = [...interns].sort((a, b) => (a.updatedAt === "Just now" ? -1 : b.updatedAt === "Just now" ? 1 : 0));

  return (
    <Shell name={name} role="organizer" title="Organizer dashboard" subtitle="Here is your intern batch today." action={<InviteDialog initial={invites} />}>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Jarvis interns={interns} onReassign={reassign} />
        </div>

        <div className="grid grid-cols-2 gap-5 lg:col-span-5">
          {stats.map((s) => (
            <div key={s.label} className={cn("flex flex-col justify-between rounded-[2rem] p-5", s.tone)}>
              <s.icon className="size-6 opacity-80" aria-hidden />
              <div className="mt-6">
                <p className="font-hand text-6xl font-bold leading-none tabular-nums">{s.value}</p>
                <p className="mt-1 text-base font-bold">{s.label}</p>
                <p className="text-sm opacity-75">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <section className={cn(card, "lg:col-span-7")}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-hand text-4xl font-bold leading-none">The board</h2>
            <p className="font-note text-sm text-moss">Updated from voice standups</p>
          </div>
          <ul className="mt-4 divide-y divide-neem/10">
            {interns.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3.5">
                <Avatar name={i.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="truncate text-sm text-moss">{i.task}</p>
                  <div className="mt-1.5 h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-neem/10">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-700", i.status === "blocked" || i.status === "overdue" ? "bg-kumkum" : "bg-neem")}
                      style={{ width: `${i.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusChip status={i.status} />
                  <span className="text-xs text-moss">Due {i.due}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(card, "lg:col-span-5")}>
          <h2 className="font-hand text-4xl font-bold leading-none">Standups</h2>
          <p className="font-note mt-1 text-sm text-moss">What interns said out loud</p>
          <ul className="mt-4 space-y-3">
            {feed.slice(0, 5).map((i) => (
              <li key={i.id} className="rounded-2xl bg-paper p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={i.name} className="size-8 text-xs" />
                  <span className="text-sm font-bold">{i.name}</span>
                  <span className="ml-auto text-xs text-moss">{i.updatedAt}</span>
                </div>
                <p className="font-note mt-2 text-[1.02rem] leading-snug">“{i.update}”</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

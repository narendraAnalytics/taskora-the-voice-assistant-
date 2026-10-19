"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper } from "lucide-react";
import { getInvites } from "@/app/dashboard/actions";
import { getTasks, reassignTask } from "@/app/dashboard/task-actions";
import { fmtDue, type TaskView } from "@/lib/task-types";
import { StatCards } from "@/components/dashboard/stat-cards";
import { STATUS_LABEL, type Intern, type Status } from "@/lib/demo-data";
import type { Invite } from "@/app/dashboard/actions";
import { InviteDialog } from "@/components/dashboard/invite-dialog";
import { Jarvis } from "@/components/dashboard/jarvis";
import { Avatar, StatusChip } from "@/components/dashboard/status-chip";
import { Shell } from "@/components/dashboard/shell";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GrowBar, PaperCard, Tape } from "@/components/dashboard/motion";
import { cn } from "@/lib/utils";

const card = "rounded-[2rem] bg-paper-deep/70 p-5 ring-1 ring-neem/10 backdrop-blur-sm sm:p-6";

const MIX: [Status, string][] = [
  ["done", "bg-tulsi"],
  ["progress", "bg-haldi"],
  ["todo", "bg-sage"],
  ["blocked", "bg-kumkum"],
  ["overdue", "bg-saffron"],
];

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  const d = Math.round(mins / 1440);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

/** Exact Indian time: "12:48 pm" for today, "18 Oct, 12:48 pm" for earlier days. */
function ist(iso: string) {
  const d = new Date(iso);
  const tz = "Asia/Kolkata";
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  if (day(d) === day(new Date())) return time;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: tz })}, ${time}`;
}

/** Open tasks first (nearest deadline), then the latest finished one. */
function mainTask(list: TaskView[]) {
  const open = list.filter((t) => t.status !== "done").sort((x, y) => (x.dueDate ?? "9999").localeCompare(y.dueDate ?? "9999"));
  return open[0] ?? list[0];
}

/** Interns on the batch (joined or invited), each with their main task from Neon. */
function fromInvites(invites: Invite[], tasks: TaskView[]): Intern[] {
  return invites
    .filter((i) => i.status === "joined" || i.status === "invited")
    .map((i) => {
      const full = i.name ?? i.email;
      const mine = tasks.filter((t) => t.inviteId === i.id);
      const t = mainTask(mine);
      return {
        id: i.id,
        name: full,
        aliases: [...new Set([full.toLowerCase(), full.split(" ")[0].toLowerCase()])],
        task: t ? t.title : i.status === "invited" ? "Invite sent, not joined yet" : "Joined, no task yet",
        status: t ? t.status : ("todo" as Status),
        progress: t ? t.progress : 0,
        due: t?.dueDate ? fmtDue(t.dueDate) : "—",
        update: "",
        updatedAt: "",
        taskId: t?.id,
        dueDate: t?.dueDate ?? null,
        more: Math.max(0, mine.length - 1),
        joined: i.status === "joined",
        // Only joined interns have "signed in"; an invited one has not used their invite yet.
        lastSignInAt: i.status === "joined" ? i.lastSignInAt : null,
      };
    });
}

export function OrganizerView({ invites, tasks: firstTasks }: { name?: string; invites: Invite[]; tasks: TaskView[] }) {
  const [list, setList] = useState(invites);
  const [taskList, setTaskList] = useState(firstTasks);
  // The board is always derived from the real invites and tasks, so it follows every change.
  const interns = useMemo(() => fromInvites(list, taskList), [list, taskList]);
  const reduce = useReducedMotion();

  const refreshTasks = useCallback(async () => {
    const next = await getTasks().catch(() => null);
    if (next) setTaskList((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  }, []);

  /* Move an intern's board task to someone else (saved in Neon, then the board reloads). */
  const reassign = async (fromId: string, toId: string) => {
    const taskId = interns.find((i) => i.id === fromId)?.taskId;
    if (!taskId) return { ok: false as const, error: "There is no task to move." };
    const r = await reassignTask(taskId, toId);
    if (r.ok) await refreshTasks();
    return r.ok ? { ok: true as const } : r;
  };

  // Pick up changes made elsewhere (an intern joining) without a reload, and say so.
  const [joinedNow, setJoinedNow] = useState<string[]>([]);
  const known = useRef(new Map(invites.map((i) => [i.id, i.status])));
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      void refreshTasks();
      const next = await getInvites().catch(() => null);
      if (!next) return;
      const arrived = next.filter((i) => i.status === "joined" && known.current.get(i.id) === "invited").map((i) => i.name ?? i.email);
      known.current = new Map(next.map((i) => [i.id, i.status]));
      setList((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
      if (arrived.length) setJoinedNow(arrived);
    };
    const t = window.setInterval(check, 15_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [refreshTasks]);
  useEffect(() => {
    if (!joinedNow.length) return;
    const t = window.setTimeout(() => setJoinedNow([]), 8000);
    return () => window.clearTimeout(t);
  }, [joinedNow]);

  const count = (s: Status) => interns.filter((i) => i.status === s).length;

  const feed = interns.filter((i) => i.update).sort((a, b) => (a.updatedAt === "Just now" ? -1 : b.updatedAt === "Just now" ? 1 : 0));

  return (
    <Shell name="Team" role="organizer" title="Organizer dashboard" subtitle="Here is your intern batch today." action={<InviteDialog invites={list} onChange={setList} />}>
      <AnimatePresence>
        {joinedNow.length > 0 && (
          <motion.div
            role="status"
            initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 flex items-center gap-3 rounded-2xl bg-tulsi px-5 py-3.5 font-semibold text-neem ring-2 ring-neem/25 shadow-[0_4px_0_rgba(23,63,48,0.2)]"
          >
            <PartyPopper className="size-6 shrink-0" aria-hidden />
            <p className="font-note text-lg">
              {joinedNow.length === 1 ? joinedNow[0] : joinedNow.slice(0, -1).join(", ") + " and " + joinedNow.at(-1)} just joined your batch!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid gap-5 lg:grid-cols-12">
        <PaperCard i={0} tilt={-1.5} className="lg:col-span-7">
          <Jarvis name="Team" interns={interns} onReassign={reassign} onTaskChange={refreshTasks} />
        </PaperCard>

        <StatCards interns={interns} invited={list.filter((i) => i.status === "invited").length} />

        <PaperCard as="section" i={5} tilt={1.5} className={cn(card, "lg:col-span-7")}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-hand text-4xl font-bold leading-none">The board</h2>
            <p className="font-note text-sm text-moss">Updated from voice standups</p>
          </div>

          {/* Batch mix ribbon */}
          <div className="mt-6 flex h-3 rounded-full bg-neem/10" role="list" aria-label="Status mix for the batch">
            {MIX.map(([s, tone]) =>
              count(s) ? (
                <motion.span
                  key={s}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${count(s)} ${STATUS_LABEL[s].toLowerCase()}`}
                  className={cn(
                    "group/seg relative h-full outline-none transition-[height,margin] duration-200 first:rounded-l-full last:rounded-r-full hover:-my-1 hover:h-5 focus-visible:-my-1 focus-visible:h-5",
                    tone,
                  )}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${(count(s) / interns.length) * 100}%` }}
                  transition={{ duration: 0.9, delay: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {/* Palette tooltip (replaces the browser's plain one) */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2.5 -translate-x-1/2 translate-y-1 scale-90 whitespace-nowrap rounded-2xl bg-neem px-3.5 py-1.5 text-paper opacity-0 shadow-[0_8px_20px_-8px_#173f3080] transition-all duration-200 group-hover/seg:translate-y-0 group-hover/seg:scale-100 group-hover/seg:opacity-100 group-focus-visible/seg:translate-y-0 group-focus-visible/seg:scale-100 group-focus-visible/seg:opacity-100"
                  >
                    <span className="font-hand text-2xl font-bold leading-none text-haldi">{count(s)}</span>{" "}
                    <span className="font-note text-base">{STATUS_LABEL[s].toLowerCase()}</span>
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-neem" />
                  </span>
                </motion.span>
              ) : null,
            )}
          </div>
          {/* Legend — also covers touch screens where there is no hover */}
          <ul className="font-note mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-moss">
            {MIX.map(([s, tone]) =>
              count(s) ? (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", tone)} aria-hidden />
                  {count(s)} {STATUS_LABEL[s].toLowerCase()}
                </li>
              ) : null,
            )}
          </ul>

          {interns.length === 0 && (
            <p className="font-note mt-6 rounded-2xl bg-paper px-4 py-6 text-center text-moss">
              No interns yet. Use “Add interns” to invite your first one.
            </p>
          )}
          <ul className="mt-3 divide-y divide-neem/10">
            {interns.map((i, n) => (
              <motion.li
                key={i.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, x: -18 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  backgroundColor: i.updatedAt === "Just now" ? ["#f2b33d66", "#f2b33d00"] : "#f2b33d00",
                }}
                transition={{ delay: 0.5 + n * 0.06, backgroundColor: { duration: 1.6 } }}
                className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-3.5 transition-colors hover:bg-paper/70"
              >
                <Avatar name={i.name} className="transition-transform group-hover:-rotate-6 group-hover:scale-110" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="truncate text-sm text-moss">
                    {i.task}
                    {!!i.more && <span className="font-semibold text-neem"> · +{i.more} more</span>}
                  </p>
                  {i.lastSignInAt && (
                    <p suppressHydrationWarning className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-neem">
                      <span aria-hidden className="size-2 rounded-full bg-tulsi ring-1 ring-neem/30" />
                      Signed in {ago(i.lastSignInAt)} · {ist(i.lastSignInAt)} IST
                    </p>
                  )}
                  <GrowBar
                    value={i.progress}
                    className="mt-1.5 h-1.5 w-full max-w-[14rem]"
                    barClassName={i.status === "blocked" || i.status === "overdue" ? "bg-kumkum" : "bg-neem"}
                  />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusChip status={i.status} />
                  <span className="text-xs text-moss">Due {i.due}</span>
                </div>
              </motion.li>
            ))}
          </ul>
        </PaperCard>

        <PaperCard as="section" i={6} tilt={-2} className={cn(card, "lg:col-span-5")}>
          <h2 className="font-hand text-4xl font-bold leading-none">Standups</h2>
          <p className="font-note mt-1 text-sm text-moss">What interns said out loud</p>
          {feed.length === 0 && (
            <p className="font-note mt-5 rounded-2xl bg-paper px-4 py-6 text-center text-moss">
              Nothing yet. Voice standups will show up here.
            </p>
          )}
          <ul className="mt-5 space-y-4">
            {feed.slice(0, 5).map((i, n) => (
              <motion.li
                key={i.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 16, rotate: n % 2 ? 2 : -2 }}
                animate={{ opacity: 1, y: 0, rotate: n % 2 ? 0.6 : -0.6 }}
                whileHover={reduce ? undefined : { rotate: 0, y: -3, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.7 + n * 0.08 }}
                className="relative rounded-2xl bg-paper p-3.5 shadow-[0_3px_0_#173f3014]"
              >
                {n === 0 && <Tape className="-top-3 right-8" />}
                <div className="flex items-center gap-2.5">
                  <Avatar name={i.name} className="size-8 text-xs" />
                  <span className="text-sm font-bold">{i.name}</span>
                  <span className="ml-auto text-xs text-moss">{i.updatedAt}</span>
                </div>
                <p className="font-note mt-2 text-[1.02rem] leading-snug">“{i.update}”</p>
              </motion.li>
            ))}
          </ul>
        </PaperCard>
      </div>
    </Shell>
  );
}

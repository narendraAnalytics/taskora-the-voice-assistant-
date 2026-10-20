"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, MessageSquareText, PartyPopper, Reply, Send } from "lucide-react";
import { getInvites } from "@/app/dashboard/actions";
import { getSentMessages, getStandups, getTasks, reassignTask, sendMessage } from "@/app/dashboard/task-actions";
import { fmtDue, type MessageView, type StandupView, type TaskView } from "@/lib/task-types";
import { StatCards } from "@/components/dashboard/stat-cards";
import { STATUS_LABEL, type Intern, type Status } from "@/lib/demo-data";
import type { Invite } from "@/app/dashboard/actions";
import { InviteDialog } from "@/components/dashboard/invite-dialog";
import { Jarvis } from "@/components/dashboard/jarvis";
import { Avatar, StatusChip } from "@/components/dashboard/status-chip";
import { Shell } from "@/components/dashboard/shell";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GrowBar, PaperCard, Tape } from "@/components/dashboard/motion";
import type { MyPlan } from "@/lib/plans";
import { ScrollFeed } from "@/components/dashboard/scroll-feed";
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
function fromInvites(invites: Invite[], tasks: TaskView[], notes: StandupView[]): Intern[] {
  return invites
    .filter((i) => i.status === "joined" || i.status === "invited")
    .map((i) => {
      const full = i.name ?? i.email;
      const mine = tasks.filter((t) => t.inviteId === i.id);
      const t = mainTask(mine);
      const note = t ? notes.find((n) => n.taskId === t.id) : undefined; // newest first
      return {
        id: i.id,
        name: full,
        aliases: [...new Set([full.toLowerCase(), full.split(" ")[0].toLowerCase()])],
        task: t ? t.title : i.status === "invited" ? "Invite sent, not joined yet" : "Joined, no task yet",
        status: t ? t.status : ("todo" as Status),
        progress: t ? t.progress : 0,
        due: t?.dueDate ? fmtDue(t.dueDate) : "—",
        update: note?.text ?? "",
        updatedAt: note ? ago(note.createdAt) : "",
        updates: notes.filter((n) => n.inviteId === i.id).map((n) => ({ task: n.taskTitle, text: n.text, status: n.status, at: n.createdAt })),
        taskId: t?.id,
        dueDate: t?.dueDate ?? null,
        more: Math.max(0, mine.length - 1),
        joined: i.status === "joined",
        // Only joined interns have "signed in"; an invited one has not used their invite yet.
        lastSignInAt: i.status === "joined" ? i.lastSignInAt : null,
      };
    });
}

/** Reply to an intern from their standup note: a message on their page, optionally also by email. */
function ReplyBox({ s, onSent, joined }: { s: StandupView; onSent: (m: MessageView) => void; joined: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mail, setMail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = s.status === "blocked";
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    const r = await sendMessage({ inviteId: s.inviteId, taskId: s.taskId, text: text.trim(), channel: mail ? "both" : "app" }).catch(() => ({ ok: false as const, error: "Could not send. Try again." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.message) onSent(r.message);
    setText("");
    setOpen(false);
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-2 transition-colors", blocked ? "ring-paper hover:bg-paper hover:text-neem" : "ring-neem hover:bg-haldi")}
      >
        <Reply className="size-3.5" aria-hidden /> Reply
      </button>
    );
  return (
    <form onSubmit={send} className="mt-2.5 space-y-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        rows={2}
        placeholder={"Write to " + s.internName.split(" ")[0] + "…"}
        aria-label={"Message to " + s.internName}
        className="font-note w-full resize-none rounded-xl bg-neem p-2.5 text-sm text-paper placeholder:text-sage/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !text.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-3.5 py-1.5 text-sm font-bold text-neem disabled:opacity-50">
          {busy ? "Sending…" : "Send message"} <Send className="size-3.5" aria-hidden />
        </button>
        {joined && (
          <label className={cn("inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold", blocked ? "text-paper" : "text-neem")}>
            <input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} className="size-3.5 accent-saffron" />
            <Mail className="size-3.5" aria-hidden /> Also email
          </label>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold underline">
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold">
          {error}
        </p>
      )}
    </form>
  );
}

export function OrganizerView({ invites, tasks: firstTasks, standups: firstStandups, messages: firstMessages = [], chat = [], plan }: {
  plan?: MyPlan; name?: string; invites: Invite[]; tasks: TaskView[]; standups: StandupView[]; messages?: MessageView[]; chat?: { from: "you" | "taskora"; text: string }[] }) {
  const [sent, setSent] = useState(firstMessages);
  const feedRoot = useRef<HTMLDivElement>(null);
  const [who, setWho] = useState<string>("all");
  const [list, setList] = useState(invites);
  const [taskList, setTaskList] = useState(firstTasks);
  // The board is always derived from the real invites and tasks, so it follows every change.
  const [standups, setStandups] = useState(firstStandups);
  const interns = useMemo(() => fromInvites(list, taskList, standups), [list, taskList, standups]);
  // Updates that arrived while this page was open, for the "just posted an update" banner.
  const [postedNow, setPostedNow] = useState<string[]>([]);
  const seenStandups = useRef(new Set(firstStandups.map((s) => s.id)));
  const reduce = useReducedMotion();

  const refreshTasks = useCallback(async () => {
    const [next, notes, out] = await Promise.all([getTasks().catch(() => null), getStandups().catch(() => null), getSentMessages().catch(() => null)]);
    if (out) setSent((cur) => (JSON.stringify(cur) === JSON.stringify(out) ? cur : out));
    if (next) setTaskList((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    if (notes) {
      const fresh = notes.filter((s) => !seenStandups.current.has(s.id));
      if (fresh.length) {
        fresh.forEach((s) => seenStandups.current.add(s.id));
        setPostedNow([...new Set(fresh.map((s) => s.internName))]);
      }
      setStandups((cur) => (JSON.stringify(cur) === JSON.stringify(notes) ? cur : notes));
    }
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
    if (!postedNow.length) return;
    const t = window.setTimeout(() => setPostedNow([]), 8000);
    return () => window.clearTimeout(t);
  }, [postedNow]);
  useEffect(() => {
    if (!joinedNow.length) return;
    const t = window.setTimeout(() => setJoinedNow([]), 8000);
    return () => window.clearTimeout(t);
  }, [joinedNow]);

  const count = (s: Status) => interns.filter((i) => i.status === s).length;


  return (
    <Shell name="Team" role="organizer" title="Organizer dashboard" subtitle="Here is your intern batch today." action={<InviteDialog invites={list} onChange={setList} plan={plan} />}>
      {plan && (
        <div className={cn("mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-5 py-3 font-semibold text-neem ring-2 ring-neem/20", plan.plan ? "bg-paper-deep" : "bg-saffron")}>
          {plan.plan ? (
            <>
              <span className="font-note text-lg">
                {plan.name} plan · {list.filter((i) => i.status === "invited" || i.status === "joined").length} of {plan.limit} interns
              </span>
              <span className="text-sm text-moss">Active until {new Date(plan.expiresAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              {list.filter((i) => i.status === "invited" || i.status === "joined").length >= plan.limit && (
                <a href="/#pricing" className="ml-auto rounded-full bg-neem px-3.5 py-1 text-sm font-bold text-haldi">Upgrade to add more</a>
              )}
            </>
          ) : (
            <>
              <span className="font-note text-lg">No plan yet. Choose one to add interns.</span>
              <a href="/#pricing" className="ml-auto rounded-full bg-neem px-3.5 py-1 text-sm font-bold text-haldi">See plans</a>
            </>
          )}
        </div>
      )}
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
      <AnimatePresence>
        {postedNow.length > 0 && (
          <motion.div
            role="status"
            initial={reduce ? false : { opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 flex items-center gap-3 rounded-2xl bg-haldi px-5 py-3.5 font-semibold text-neem ring-2 ring-neem/25 shadow-[0_4px_0_rgba(23,63,48,0.2)]"
          >
            <MessageSquareText className="size-6 shrink-0" aria-hidden />
            <p className="font-note text-lg">
              {postedNow.length === 1 ? postedNow[0] : postedNow.slice(0, -1).join(", ") + " and " + postedNow.at(-1)} just posted an update.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid gap-5 lg:grid-cols-12">
        <PaperCard i={0} tilt={-1.5} className="lg:col-span-7">
          <Jarvis name="Team" savedChat={chat} interns={interns} onReassign={reassign} onTaskChange={refreshTasks} />
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
          <p className="font-note mt-1 text-sm text-moss">What interns told you about their tasks</p>
          {standups.length === 0 && (
            <p className="font-note mt-5 rounded-2xl bg-paper px-4 py-6 text-center text-moss">
              Nothing yet. When an intern writes an update on a task, it shows up here.
            </p>
          )}
          {standups.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter updates by intern">
              {[["all", "All"], ...[...new Map(standups.map((x) => [x.inviteId, x.internName.split(" ")[0]])).entries()]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={who === id}
                  onClick={() => {
                    setWho(id);
                    feedRoot.current?.scrollTo({ top: 0 });
                  }}
                  className={cn("rounded-full px-3 py-1 text-xs font-bold transition-colors", who === id ? "bg-neem text-haldi" : "bg-paper ring-1 ring-neem/20 hover:bg-haldi")}
                >
                  {label}
                </button>
              ))}
              <span className="font-note ml-auto text-xs text-moss">{standups.filter((x) => who === "all" || x.inviteId === who).length} updates</span>
            </div>
          )}
          <ScrollFeed root={feedRoot} className="mt-4 max-h-[34rem] -mx-1 px-1 pb-6 pt-3">
          <ul className="space-y-4">
            {standups.filter((x) => who === "all" || x.inviteId === who).map((s, n) => (
              <motion.li
                key={s.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 24, rotate: n % 2 ? 2 : -2 }}
                whileInView={{ opacity: 1, y: 0, rotate: n % 2 ? 0.6 : -0.6 }}
                viewport={{ root: feedRoot, once: true, margin: "0px 0px -8% 0px" }}
                whileHover={reduce ? undefined : { rotate: 0, y: -3, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 200, damping: 16, delay: Math.min(n, 4) * 0.07 }}
                className={cn("relative rounded-2xl p-3.5 shadow-[0_3px_0_#173f3014]", s.status === "blocked" ? "bg-kumkum text-paper" : "bg-paper")}
              >
                {n === 0 && <Tape className="-top-3 right-8" />}
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.internName} className="size-8 text-xs" />
                  <span className="truncate text-sm font-bold">{s.internName}</span>
                  <span suppressHydrationWarning className={cn("ml-auto shrink-0 text-xs", s.status === "blocked" ? "text-paper/80" : "text-moss")}>
                    {ago(s.createdAt)}
                  </span>
                </div>
                <p className={cn("mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold", s.status === "blocked" ? "text-paper" : "text-moss")}>
                  <span className="truncate">{s.taskTitle}</span>
                  <StatusChip status={s.status} />
                </p>
                <p className="font-note mt-2 text-[1.02rem] leading-snug">“{s.text}”</p>
                {sent
                  .filter((m) => m.inviteId === s.inviteId && m.taskId === s.taskId && m.createdAt > s.createdAt && !(standups.find((x) => x.inviteId === s.inviteId && x.taskId === s.taskId && x.createdAt > s.createdAt && x.createdAt <= m.createdAt)))
                  .map((m) => (
                    <p key={m.id} className={cn("font-note mt-2 rounded-xl px-3 py-2 text-sm leading-snug", s.status === "blocked" ? "bg-neem text-paper" : "bg-haldi")}>
                      <span className="font-bold">You: </span>
                      {m.text}
                    </p>
                  ))}
                <ReplyBox s={s} joined={list.find((i) => i.id === s.inviteId)?.status === "joined"} onSent={(m) => setSent((cur) => [m, ...cur])} />
              </motion.li>
            ))}
          </ul>
          </ScrollFeed>
        </PaperCard>
      </div>
    </Shell>
  );
}

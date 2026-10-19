"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  Languages,
  Mail,
  MailPlus,
  Phone,
  School,
  Sparkles,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  completeIntern,
  inviteIntern,
  removeIntern,
  reopenIntern,
  revokeInvite,
  type Invite,
  type InviteResult,
} from "@/app/dashboard/actions";
import { Avatar } from "@/components/dashboard/status-chip";
import { InternList, type Confirm } from "@/components/dashboard/intern-list";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DURATIONS, LANGUAGES, MAX_SKILLS, POSITIONS, STUDY_YEARS } from "@/lib/intern-options";
import { cn } from "@/lib/utils";

const inputBase =
  "h-12 w-full rounded-2xl bg-paper-deep/60 pr-4 text-neem ring-1 ring-neem/20 placeholder:text-moss focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron";

const SKILL_IDEAS: Record<string, string[]> = {
  Frontend: ["React", "Next.js", "Tailwind", "TypeScript"],
  Backend: ["Python", "FastAPI", "Node.js", "SQL"],
  "Full stack": ["React", "Node.js", "Postgres", "Git"],
  Design: ["Figma", "UI design", "Branding", "Prototyping"],
  Data: ["Python", "SQL", "Excel", "Power BI"],
  Marketing: ["SEO", "Social media", "Canva", "Analytics"],
  Content: ["Writing", "Editing", "Video", "Scripting"],
  Operations: ["Excel", "Coordination", "Reports", "Communication"],
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  language: "English" as string,
  position: "",
  college: "",
  degree: "",
  studyYear: "" as string,
  durationMonths: null as number | null,
  startDate: "",
  skills: [] as string[],
};
type Form = typeof emptyForm;

/** Icon-led input: the icon sits inside the field's left edge. */
function Field({
  icon: Icon,
  label,
  optional,
  children,
}: {
  icon: LucideIcon;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        {label}
        {optional && <span className="font-normal text-moss">· optional</span>}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-moss" aria-hidden />
        {children}
      </span>
    </label>
  );
}

function Chip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron",
        active ? "bg-neem text-paper ring-neem shadow-[0_2px_0_#e8622a]" : "bg-paper-deep/50 text-neem ring-neem/25 hover:-translate-y-0.5 hover:bg-haldi/60",
      )}
    >
      {active ? <Check className="size-3.5" aria-hidden /> : Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

function Group({ icon: Icon, label, optional, children }: { icon: LucideIcon; label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        <Icon className="size-4 text-moss" aria-hidden />
        {label}
        {optional && <span className="font-normal text-moss">· optional</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function SkillsInput({ skills, ideas, onChange }: { skills: string[]; ideas: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, "").trim();
    if (!v || skills.length >= MAX_SKILLS || skills.some((s) => s.toLowerCase() === v.toLowerCase())) return setDraft("");
    onChange([...skills, v.slice(0, 30)]);
    setDraft("");
  };
  const remaining = ideas.filter((i) => !skills.some((s) => s.toLowerCase() === i.toLowerCase()));

  return (
    <div>
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        <Sparkles className="size-4 text-moss" aria-hidden />
        Skills
        <span className="font-normal text-moss">· optional, {skills.length}/{MAX_SKILLS}</span>
      </span>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl bg-paper-deep/60 p-2 ring-1 ring-neem/20 focus-within:ring-2 focus-within:ring-saffron">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-tulsi py-1 pl-3 pr-1.5 text-sm font-semibold text-neem">
            {s}
            <button
              type="button"
              onClick={() => onChange(skills.filter((x) => x !== s))}
              aria-label={`Remove ${s}`}
              className="grid size-5 place-items-center rounded-full hover:bg-neem hover:text-paper"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && skills.length) onChange(skills.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={skills.length ? "Add another…" : "Type a skill, press Enter"}
          aria-label="Add a skill"
          className="min-w-32 flex-1 bg-transparent px-2 py-1 text-neem placeholder:text-moss focus:outline-none"
        />
      </div>
      {remaining.length > 0 && skills.length < MAX_SKILLS && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-moss">Quick add:</span>
          {remaining.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => add(i)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-neem/25 hover:bg-haldi/60"
            >
              + {i}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatStart(d: string) {
  const t = new Date(`${d}T00:00:00`);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Live paper ID badge: fills in as the organizer types. */
function Badge({ f }: { f: Form }) {
  const reduce = useReducedMotion();
  const line = [f.degree.trim(), f.studyYear].filter(Boolean).join(" · ");
  const when = [f.durationMonths ? `${f.durationMonths} month${f.durationMonths > 1 ? "s" : ""}` : "", f.startDate ? `from ${formatStart(f.startDate)}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <motion.div
      initial={reduce ? false : { rotate: -3, y: 8, opacity: 0 }}
      animate={{ rotate: -2, y: 0, opacity: 1 }}
      className="relative mx-auto w-full max-w-64 origin-top"
      aria-hidden
    >
      <span className="absolute left-1/2 top-2 z-10 h-2.5 w-14 -translate-x-1/2 rounded-full bg-paper shadow-[inset_0_1px_3px_rgba(23,63,48,0.45)]" />
      <div className="overflow-hidden rounded-3xl bg-paper-deep ring-2 ring-neem/25 shadow-[0_8px_0_rgba(23,63,48,0.18)]">
        <div className="bg-neem px-4 pb-3 pt-6 text-center">
          <p className="font-hand text-2xl font-bold leading-none text-haldi">Taskora</p>
          <p className="text-xs tracking-wide text-sage">Intern pass</p>
        </div>
        <div className="space-y-3 px-4 pb-5 pt-4 text-center">
          <Avatar name={f.name.trim() || "?"} className="mx-auto size-16 text-xl ring-4 ring-paper" />
          <div>
            <p className={cn("font-hand text-3xl font-bold leading-none", !f.name.trim() && "text-moss/70")}>{f.name.trim() || "Intern name"}</p>
            <span
              className={cn(
                "mt-2 inline-block -rotate-2 rounded-md px-2.5 py-1 text-xs font-extrabold",
                f.position ? "bg-haldi text-neem ring-1 ring-neem/30" : "bg-sage/60 text-moss",
              )}
            >
              {f.position || "Position"}
            </span>
          </div>
          <dl className="space-y-1.5 text-left text-sm">
            <div className="flex items-start gap-2">
              <School className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
              <dd className={cn("font-semibold", !f.college.trim() && "text-moss/70")}>{f.college.trim() || "College or institute"}</dd>
            </div>
            {line && (
              <div className="flex items-start gap-2">
                <GraduationCap className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
                <dd>{line}</dd>
              </div>
            )}
            {when && (
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
                <dd>{when}</dd>
              </div>
            )}
            {f.language && (
              <div className="flex items-start gap-2">
                <Languages className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
                <dd>Standups in {f.language}</dd>
              </div>
            )}
          </dl>
          {f.skills.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {f.skills.map((s) => (
                <span key={s} className="rounded-full bg-tulsi px-2 py-0.5 text-xs font-semibold">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const PETALS = ["bg-haldi", "bg-saffron", "bg-tulsi", "bg-kumkum", "bg-haldi", "bg-tulsi", "bg-saffron", "bg-kumkum", "bg-haldi", "bg-tulsi", "bg-saffron", "bg-kumkum"];

/** Shown after a successful save: a check mark draws itself inside a burst of petals. */
function Sent({ who, onAnother, onDone }: { who: { name: string; email: string; position: string }; onAnother: () => void; onDone: () => void }) {
  const reduce = useReducedMotion();
  const first = who.name.split(" ")[0];
  return (
    <div role="status" className="flex flex-col items-center px-2 py-8 text-center">
      <div className="relative grid size-32 place-items-center">
        {!reduce &&
          PETALS.map((tone, i) => {
            const a = (i / PETALS.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden
                className={cn("absolute size-3 rounded-full", tone, i % 2 && "h-4 w-2 rounded-[40%]")}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ x: Math.cos(a) * 72, y: Math.sin(a) * 72, scale: [0, 1.2, 0.8], opacity: [1, 1, 0], rotate: i * 40 }}
                transition={{ duration: 1.1, delay: 0.25, ease: "easeOut" }}
              />
            );
          })}
        <motion.span
          className="absolute inset-3 rounded-full bg-tulsi ring-4 ring-neem"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-3 rounded-full ring-2 ring-tulsi"
          initial={reduce ? false : { scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        />
        <svg viewBox="0 0 48 48" className="relative size-14" fill="none" stroke="#173f30" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path
            d="M11 25.5 20 34.5 37 14"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }}
          />
        </svg>
      </div>

      <motion.h3
        className="font-hand mt-4 text-5xl font-bold leading-none"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {first} is added!
      </motion.h3>
      <motion.p
        className="font-note mt-3 max-w-sm text-base text-moss"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        A welcome email{who.position ? ` for the ${who.position} role` : ""} is on its way to <strong className="text-neem">{who.email}</strong>.
      </motion.p>

      <motion.div
        className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <button
          type="button"
          onClick={onAnother}
          autoFocus
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30]"
        >
          <UserPlus className="size-5" aria-hidden />
          Add another
        </button>
        <button type="button" onClick={onDone} className="rounded-full px-6 py-3.5 text-lg font-bold ring-2 ring-neem/30 hover:bg-haldi/50">
          Done
        </button>
      </motion.div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Who they are", "Their placement"];
  return (
    <ol className="mt-5 flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ring-1 transition-colors",
              i < step ? "bg-tulsi text-neem ring-neem/30" : i === step ? "bg-saffron text-neem ring-neem/40" : "text-moss ring-neem/25",
            )}
          >
            {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
          </span>
          <span className={cn("text-sm font-bold", i > step && "text-moss")}>{s}</span>
          {i < steps.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full", i < step ? "bg-tulsi" : "bg-neem/15")} />}
        </li>
      ))}
    </ol>
  );
}

/**
 * Organizer-only "Add interns" button + form. Interns get an emailed link to set their own
 * password, so nothing secret is shared. Invited interns are listed under the form.
 */
export function InviteDialog({ initial, onChange }: { initial: Invite[]; onChange?: (invites: Invite[]) => void }) {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState(initial);
  const [view, setView] = useState<"active" | "completed">("active");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [listError, setListError] = useState("");
  const update = (next: Invite[]) => {
    setInvites(next);
    onChange?.(next);
  };
  const [form, setForm] = useState<Form>(emptyForm);
  const [step, setStep] = useState(0);
  const [otherPosition, setOtherPosition] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ name: string; email: string; position: string } | null>(null);
  const [pending, start] = useTransition();
  const waiting = invites.filter((i) => i.status === "invited").length;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => {
    if (form.name.trim().length < 2) return setError("Enter the intern's name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    if (!form.phone.trim()) return setError("Enter a phone number.");
    setError("");
    setStep(1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) return next();
    setError("");
    start(async () => {
      const r = await inviteIntern({
        ...form,
        degree: form.degree || undefined,
        studyYear: (form.studyYear || null) as (typeof STUDY_YEARS)[number] | null,
        language: (form.language || null) as (typeof LANGUAGES)[number] | null,
        startDate: form.startDate || null,
      });
      if (!r.ok) return setError(r.error);
      update(r.invites);
      setSent({ name: form.name.trim(), email: form.email.trim(), position: form.position.trim() });
      setForm(emptyForm);
      setOtherPosition(false);
      setStep(0);
    });
  };

  const act = (action: (id: string) => Promise<InviteResult>, id: string) =>
    start(async () => {
      setListError("");
      const r = await action(id);
      setConfirm(null);
      if (r.ok) update(r.invites);
      else setListError(r.error);
    });

  const textInput = (extra?: string) => cn(inputBase, "pl-11", extra);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError("");
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

      <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto rounded-[2rem] bg-paper p-6 text-neem ring-2 ring-neem/20 sm:max-w-4xl sm:p-8">
        <DialogTitle className="font-hand text-4xl font-bold leading-none">Add an intern</DialogTitle>
        <DialogDescription className="font-note mt-2 text-base text-moss">
          They get an email link to set their own password. Nothing to share.
        </DialogDescription>

        {sent ? (
          <Sent
            who={sent}
            onAnother={() => setSent(null)}
            onDone={() => {
              setSent(null);
              setOpen(false);
            }}
          />
        ) : (
          <>
        <Stepper step={step} />

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_16rem]">
          <form onSubmit={submit} className="min-w-0 space-y-4">
            <AnimatePresence mode="wait" initial={false}>
              {step === 0 ? (
                <motion.div
                  key="who"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3.5"
                >
                  <Field icon={User} label="Full name">
                    <input
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Ravi Teja"
                      className={textInput()}
                      autoComplete="off"
                      autoFocus
                    />
                  </Field>
                  <Field icon={Mail} label="Email address">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="ravi@college.edu"
                      className={textInput()}
                      autoComplete="off"
                    />
                  </Field>
                  <Field icon={Phone} label="Phone number">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="98765 43210"
                      className={textInput()}
                      autoComplete="off"
                    />
                  </Field>
                  <Group icon={Languages} label="Voice standup language">
                    {LANGUAGES.map((l) => (
                      <Chip key={l} active={form.language === l} onClick={() => set("language", l)}>
                        {l}
                      </Chip>
                    ))}
                  </Group>
                </motion.div>
              ) : (
                <motion.div
                  key="placement"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <Group icon={Briefcase} label="Position">
                    {POSITIONS.map((p) => (
                      <Chip
                        key={p}
                        active={!otherPosition && form.position === p}
                        onClick={() => {
                          setOtherPosition(false);
                          set("position", p);
                        }}
                      >
                        {p}
                      </Chip>
                    ))}
                    <Chip
                      active={otherPosition}
                      onClick={() => {
                        setOtherPosition(true);
                        set("position", "");
                      }}
                    >
                      Other
                    </Chip>
                  </Group>
                  {otherPosition && (
                    <Field icon={Briefcase} label="Position title">
                      <input
                        value={form.position}
                        onChange={(e) => set("position", e.target.value)}
                        placeholder="e.g. QA tester"
                        maxLength={40}
                        className={textInput()}
                        autoFocus
                      />
                    </Field>
                  )}

                  <Field icon={School} label="College or institute">
                    <input
                      value={form.college}
                      onChange={(e) => set("college", e.target.value)}
                      placeholder="JNTU Hyderabad"
                      maxLength={120}
                      className={textInput()}
                      autoComplete="off"
                    />
                  </Field>
                  <Field icon={GraduationCap} label="Degree and branch" optional>
                    <input
                      value={form.degree}
                      onChange={(e) => set("degree", e.target.value)}
                      placeholder="B.Tech · CSE"
                      maxLength={60}
                      className={textInput()}
                      autoComplete="off"
                    />
                  </Field>

                  <Group icon={GraduationCap} label="Year of study" optional>
                    {STUDY_YEARS.map((y) => (
                      <Chip key={y} active={form.studyYear === y} onClick={() => set("studyYear", form.studyYear === y ? "" : y)}>
                        {y}
                      </Chip>
                    ))}
                  </Group>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Group icon={Clock} label="Duration" optional>
                      {DURATIONS.map((d) => (
                        <Chip key={d} active={form.durationMonths === d} onClick={() => set("durationMonths", form.durationMonths === d ? null : d)}>
                          {d} {d === 1 ? "month" : "months"}
                        </Chip>
                      ))}
                    </Group>
                    <Field icon={CalendarDays} label="Start date" optional>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => set("startDate", e.target.value)}
                        className={textInput("pr-3")}
                      />
                    </Field>
                  </div>

                  <SkillsInput skills={form.skills} ideas={SKILL_IDEAS[form.position] ?? []} onChange={(s) => set("skills", s)} />
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p role="alert" className="rounded-xl bg-kumkum px-4 py-2.5 text-sm font-semibold text-paper">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep(0);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-lg font-bold ring-2 ring-neem/30 hover:bg-haldi/50"
                >
                  <ArrowLeft className="size-5" aria-hidden />
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-saffron px-6 py-3.5 text-lg font-bold text-neem shadow-[0_4px_0_#173f30] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#173f30] disabled:opacity-60"
              >
                {step === 0 ? (
                  <>
                    Next: placement
                    <ArrowRight className="size-5" aria-hidden />
                  </>
                ) : (
                  <>
                    <MailPlus className="size-5" aria-hidden />
                    {pending ? "Saving…" : "Save and send invite"}
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="hidden md:block">
            <Badge f={form} />
          </div>
        </div>
          </>
        )}

        {invites.length > 0 && (
          <InternList
            invites={invites}
            view={view}
            setView={setView}
            confirm={confirm}
            setConfirm={setConfirm}
            pending={pending}
            error={listError}
            onRevoke={(id) => act(revokeInvite, id)}
            onComplete={(id) => act(completeIntern, id)}
            onReopen={(id) => act(reopenIntern, id)}
            onRemove={(id) => act(removeIntern, id)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

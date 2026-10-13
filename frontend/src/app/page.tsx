import { Check } from "lucide-react";
import { Commands } from "@/components/landing/commands";
import { Hero } from "@/components/landing/hero";
import { Logo } from "@/components/landing/logo";
import { SiteNav } from "@/components/landing/site-nav";
import { pilotMailto } from "@/lib/site";

const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

const PROBLEMS = [
  {
    title: "Organizers chase updates",
    body: "Hours go into calls and chats asking the same question: where are you on this?",
  },
  {
    title: "Boards drift out of date",
    body: "Interns forget to move their cards, so the board still shows last week.",
  },
  {
    title: "Blockers surface days late",
    body: "A stuck intern waits for the next meeting instead of saying so today.",
  },
  {
    title: "Talking is easier than typing",
    body: "Twenty seconds of speaking beats five minutes of typing, especially in your own language.",
  },
];

const STEPS = [
  {
    title: "Speak",
    body: "Hold the mic and talk the way you would to a teammate.",
  },
  {
    title: "Transcribe",
    body: "Sarvam Saaras v3 turns Telugu, Hindi, English or mixed speech into text.",
  },
  {
    title: "Understand",
    body: "Taskora works out the action, the person, the task and the date. If a name is unclear, it asks.",
  },
  {
    title: "Confirm",
    body: "Reassignments and bulk changes show a card first. Questions go straight to the answer.",
  },
  {
    title: "Update and reply",
    body: "The board changes for the whole team, and the answer is spoken back with Sarvam Bulbul v3.",
  },
];

const ROLES = [
  {
    title: "Organizers and mentors",
    body: "See allocated, pending and finished work at a glance. Assign, reassign and move deadlines by voice. Know who is stuck before the weekly call.",
  },
  {
    title: "Interns and fellows",
    body: "Hear today's tasks in the morning. Give your update by speaking for twenty seconds. Raise a blocker without waiting for a meeting.",
  },
  {
    title: "Program admins",
    body: "Attendance, weekly reports, mentor feedback and end-of-internship evaluations for a whole batch, in one place.",
  },
];

const RULES = [
  "Reassignments and bulk changes always show a confirm card.",
  "Similar names, like Ravi and Ravi K, get a question instead of a guess.",
  "Interns can only change their own tasks.",
  "Every change is logged, so you can undo it and any task can explain its history.",
  "Audio is deleted after 30 days. Transcripts stay so your history still makes sense.",
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "",
    fit: "For a student team or college club",
    features: ["1 team, up to 8 members", "Voice tasks and standups", "Team board and history"],
  },
  {
    name: "Team",
    price: "₹499",
    period: "per month",
    fit: "For a small agency or startup team",
    features: [
      "Up to 25 members",
      "6 pm summaries for organizers",
      "Email reminders",
      "GitHub sync for tech interns",
    ],
    featured: true,
  },
  {
    name: "Program",
    price: "₹1,999",
    period: "per batch, per month",
    fit: "For colleges and training institutes",
    features: [
      "Up to 100 interns",
      "Attendance by voice",
      "Evaluations and certificates",
      "Weekly reports for sponsors",
    ],
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <Hero />

      <main>
        {/* Problems */}
        <section className="bg-paper py-20 lg:py-28">
          <div className={`${wrap} grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20`}>
            <h2 className="display max-w-[16ch] text-[clamp(2.1rem,4.6vw,3.6rem)] text-neem">
              Status goes stale because typing updates is a chore.
            </h2>
            <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="border-t-2 border-neem pt-4">
                  <dt className="display text-xl text-neem">{p.title}</dt>
                  <dd className="mt-2 text-moss">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How it works — a real sequence, so it is numbered */}
        <section id="how" className="scroll-mt-6 bg-paper pb-20 lg:pb-28">
          <div className={wrap}>
            <div className="rounded-[2rem] bg-paper-deep/70 px-5 py-12 sm:px-10 lg:px-14 lg:py-16">
              <h2 className="display max-w-[22ch] text-[clamp(2rem,4vw,3.2rem)] text-neem">
                How a spoken update reaches the board
              </h2>
              <ol className="mt-12 grid gap-8 md:grid-cols-5 md:gap-6">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="relative">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-11 shrink-0 place-items-center rounded-full display text-lg ${
                          i === STEPS.length - 1 ? "bg-saffron text-neem" : "bg-neem text-paper"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {i < STEPS.length - 1 && (
                        <span aria-hidden className="hidden h-0.5 flex-1 bg-neem/25 md:block" />
                      )}
                    </div>
                    <h3 className="display mt-4 text-xl text-neem">{s.title}</h3>
                    <p className="mt-1.5 text-[0.98rem] text-moss">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Commands */}
        <section id="commands" data-nav="dark" className="scroll-mt-0 bg-neem py-20 text-paper lg:py-28">
          <div className={wrap}>
            <div className="max-w-[44rem]">
              <h2 className="display text-[clamp(2.1rem,4.6vw,3.6rem)]">
                Say it the way you&apos;d say it to a teammate
              </h2>
              <p className="mt-5 text-lg text-sage">
                Half Telugu, half English is normal here. Sarvam&apos;s code-mixed transcription keeps
                each word in the script it was spoken in, and Taskora understands the sentence as a
                whole.
              </p>
            </div>
            <div className="mt-12">
              <Commands />
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="bg-paper py-20 lg:py-28">
          <div className={wrap}>
            <h2 className="display max-w-[20ch] text-[clamp(2.1rem,4.6vw,3.6rem)] text-neem">
              Built for the people who run intern batches
            </h2>
            <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
              {ROLES.map((r) => (
                <div
                  key={r.title}
                  className="md:border-l-2 md:border-haldi md:px-8 md:first:border-l-0 md:first:pl-0"
                >
                  <h3 className="display text-2xl text-neem">{r.title}</h3>
                  <p className="mt-3 text-moss">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section className="bg-paper pb-20 lg:pb-28">
          <div className={wrap}>
            <div className="grid gap-10 rounded-[2rem] bg-neem px-5 py-12 text-paper sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-14 lg:py-16">
              <div>
                <h2 className="display text-[clamp(2rem,4vw,3.2rem)]">
                  Nothing changes until you say yes
                </h2>
                <p className="mt-4 text-lg text-sage">
                  Voice is fast, so the guardrails are strict. Reading the board is instant; changing
                  it always shows you what will happen first.
                </p>
              </div>
              <ul className="space-y-4">
                {RULES.map((r) => (
                  <li key={r} className="flex gap-3.5 text-lg">
                    <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-tulsi text-neem">
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-6 bg-paper pb-20 lg:pb-28">
          <div className={wrap}>
            <h2 className="display text-[clamp(2.1rem,4.6vw,3.6rem)] text-neem">
              Priced per team, not per seat
            </h2>
            <p className="mt-4 max-w-[38rem] text-lg text-moss">
              So a batch of thirty interns costs the same as a batch of ten. Pilot prices, in rupees.
            </p>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`flex flex-col rounded-[1.75rem] p-7 sm:p-8 ${
                    p.featured ? "bg-saffron text-neem" : "bg-paper-deep/70 text-neem"
                  }`}
                >
                  <h3 className="display text-2xl">{p.name}</h3>
                  <p className={p.featured ? "text-neem/80" : "text-moss"}>{p.fit}</p>
                  <p className="mt-6 flex items-baseline gap-2">
                    <span className="display-wide text-5xl">{p.price}</span>
                    {p.period && (
                      <span className={p.featured ? "text-neem/80" : "text-moss"}>{p.period}</span>
                    )}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="mt-1 size-4 shrink-0" strokeWidth={3} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#pilot"
                    className={`mt-8 rounded-full px-5 py-3 text-center font-semibold ${
                      p.featured
                        ? "bg-neem text-paper hover:bg-neem-soft"
                        : "text-neem ring-2 ring-neem hover:bg-neem hover:text-paper"
                    }`}
                  >
                    Join the pilot
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pilot CTA */}
        <section id="pilot" className="bg-haldi py-20 text-neem lg:py-28">
          <div className={`${wrap} grid items-end gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]`}>
            <div>
              <h2 className="display-wide text-[clamp(2.4rem,6vw,4.8rem)]">
                Run your next intern batch by voice.
              </h2>
              <p className="mt-6 max-w-[36rem] text-lg">
                We&apos;re setting Taskora up for free with three pilot programs this term: an
                engineering college, a training institute and a small agency. Tell us about your batch
                and we&apos;ll get your team talking to it within a week.
              </p>
            </div>
            <div className="lg:justify-self-end">
              <a
                href={pilotMailto}
                className="inline-block rounded-full bg-neem px-8 py-4 text-lg font-semibold text-paper hover:bg-neem-soft"
              >
                Join the pilot
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer data-nav="dark" className="bg-neem py-12 text-sage">
        <div className={`${wrap} flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <Logo />
            <p className="mt-3 max-w-[30rem]">
              A voice assistant for internship programs and small teams, made in India.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how" className="hover:text-paper">
              How it works
            </a>
            <a href="#commands" className="hover:text-paper">
              What you can say
            </a>
            <a href="#pricing" className="hover:text-paper">
              Pricing
            </a>
            <span>&copy; 2026 Taskora</span>
          </div>
        </div>
      </footer>
    </>
  );
}

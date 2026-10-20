import { Check } from "lucide-react";
import { Commands } from "@/components/landing/commands";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { StaleSection } from "@/components/landing/stale-section";
import { PlanCards } from "@/components/landing/plan-cards";
import { Roles } from "@/components/landing/roles";
import { pilotMailto } from "@/lib/site";

const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

const RULES = [
  "Reassignments and bulk changes always show a confirm card.",
  "Similar names, like Ravi and Ravi K, get a question instead of a guess.",
  "Interns can only change their own tasks.",
  "Every change is logged, so you can undo it and any task can explain its history.",
  "Audio is deleted after 30 days. Transcripts stay so your history still makes sense.",
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <Hero />

      <main>
        {/* Problems */}
        <StaleSection />

        {/* How it works — pinned showcase, scrubbed by scroll */}
        <HowItWorks />

        {/* Commands */}
        <section
          id="commands"
          data-nav="dark"
          className="relative isolate scroll-mt-0 overflow-hidden bg-neem py-20 text-paper lg:py-28"
        >
          {/* slow aurora + dot grid behind the console */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="aurora absolute -left-40 -top-40 size-[36rem] rounded-full bg-saffron/25 blur-3xl" />
            <div className="aurora absolute -bottom-48 -right-40 size-[40rem] rounded-full bg-haldi/20 blur-3xl [animation-delay:-9s]" />
            <div className="absolute inset-0 bg-[radial-gradient(#fce7b21f_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,#173f30_30%,transparent_75%)]" />
          </div>
          <div className={wrap}>
            <div className="max-w-[44rem]">
              <h2 className="font-hand text-[clamp(2.7rem,6vw,4.6rem)] font-bold leading-[1.02] text-haldi">
                Say it the way you&apos;d say it to a teammate
              </h2>
              <p className="font-note mt-5 text-lg text-sage">
                No commands to memorize. Ask in plain sentences, the way you would ask a teammate, and
                Taskora works out who, what and when.
              </p>
            </div>
            <div className="mt-12">
              <Commands />
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="scroll-mt-6 bg-paper py-20 lg:py-28">
          <div className={wrap}>
            <h2 className="font-note max-w-[20ch] bg-gradient-to-r from-neem via-neem-soft to-kumkum bg-clip-text text-[clamp(2.2rem,4.8vw,3.8rem)] font-bold leading-[1.1] text-transparent">
              Built for the people who run intern batches
            </h2>
            <p className="font-hand mt-4 max-w-[38rem] text-2xl text-moss">
              One voice assistant, three views of the same board. Hover or tap a role to see what it
              gets.
            </p>
            <div className="mt-12">
              <Roles />
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
              So a batch of thirty interns costs the same as a batch of ten. There is no free plan: every team starts on a paid plan, and the ₹150 Starter lets you test it with two interns. Prices are in rupees.
            </p>
            <PlanCards />
          </div>
        </section>

        {/* Pilot CTA */}
        <section id="pilot" className="bg-haldi py-20 text-neem lg:py-28">
          <div className={`${wrap} grid items-end gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]`}>
            <div>
              <h2 className="font-hand bg-gradient-to-r from-neem via-neem-soft to-kumkum bg-clip-text text-[clamp(3rem,7.5vw,6rem)] font-bold leading-[1] text-transparent">
                Run your next intern batch by voice.
              </h2>
              <p className="font-note mt-6 max-w-[36rem] text-lg">
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

      <SiteFooter />
    </>
  );
}

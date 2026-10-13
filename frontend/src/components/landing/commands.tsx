"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Command = { says: string; gloss?: string; does: string };

const GROUPS: { id: string; label: string; commands: Command[] }[] = [
  {
    id: "organizer",
    label: "Organizer",
    commands: [
      {
        says: "ఇవాళ pending tasks ఏంటి?",
        gloss: "What's pending today?",
        does: "Reads pending tasks grouped by intern, overdue first.",
      },
      {
        says: "Ravi task Priya కి shift చెయ్యి",
        gloss: "Move Ravi's task to Priya",
        does: "Reassigns after you confirm, keeps the history and tells both of them.",
      },
      {
        says: "Move all of Sneha's tasks by two days",
        does: "Shows every date that will change and applies them on confirm.",
      },
      {
        says: "Who is blocked?",
        does: "Lists blockers with who raised them and since when.",
      },
      {
        says: "आज किसने update नहीं किया?",
        gloss: "Who hasn't updated today?",
        does: "Names them and offers to send a reminder.",
      },
    ],
  },
  {
    id: "intern",
    label: "Intern",
    commands: [
      {
        says: "నా tasks ఏంటి ఇవాళ?",
        gloss: "What are my tasks today?",
        does: "Reads today's tasks and deadlines aloud.",
      },
      {
        says: "Login page done, API 50 percent, design కోసం waiting",
        gloss: "Login page done, API at 50%, waiting on design",
        does: "Marks one task done, updates another, logs a blocker and alerts your organizer.",
      },
      {
        says: "I'm stuck on the payment webhook",
        does: "Logs a blocker on the right task so it shows up in today's summary.",
      },
    ],
  },
  {
    id: "automatic",
    label: "Every evening",
    commands: [
      {
        says: "6 pm summary",
        does: "Organizers get what's done, pending and blocked, and who didn't update.",
      },
      {
        says: "Overdue nudge",
        does: "Interns with late tasks get a friendly reminder the next morning.",
      },
      {
        says: "Weekly report",
        does: "Program admins get progress per intern, ready to share with sponsors.",
      },
    ],
  },
];

export function Commands() {
  const [active, setActive] = useState(GROUPS[0].id);
  const group = GROUPS.find((g) => g.id === active)!;

  return (
    <div>
      <div role="tablist" aria-label="Who is speaking" className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            role="tab"
            id={`tab-${g.id}`}
            aria-selected={g.id === active}
            aria-controls="commands-panel"
            onClick={() => setActive(g.id)}
            className={cn(
              "rounded-full px-5 py-2 text-base font-semibold transition-colors",
              g.id === active
                ? "bg-haldi text-neem"
                : "text-paper ring-1 ring-paper/25 hover:bg-paper/10",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <ul
        id="commands-panel"
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="mt-10 divide-y divide-paper/15 border-y border-paper/15"
      >
        {group.commands.map((c) => (
          <li
            key={c.says}
            className="grid gap-2 py-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-10 animate-in fade-in duration-300"
          >
            <div>
              <p className="display text-2xl text-paper sm:text-[2rem]">“{c.says}”</p>
              {c.gloss && <p className="mt-1 text-sage">{c.gloss}</p>}
            </div>
            <p className="text-lg text-paper/85 md:pt-1.5">{c.does}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

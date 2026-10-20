/** The plans, shared by the pricing cards (client) and the server checks. There is no free plan. */
export const PLAN_IDS = ["starter", "team", "program"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Plan = {
  id: PlanId;
  name: string;
  rupees: number;
  /** Most interns an organizer can have invited or joined at once. */
  members: number;
  price: string;
  period: string;
  fit: string;
  features: string[];
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    rupees: 150,
    members: 2,
    price: "₹150",
    period: "",
    fit: "To try Taskora with your first two interns",
    features: ["1 team, up to 2 interns", "Voice tasks and standups", "Team board and history"],
  },
  {
    id: "team",
    name: "Team",
    rupees: 499,
    members: 25,
    price: "₹499",
    period: "per month",
    fit: "For a small agency or startup team",
    features: ["Up to 25 members", "6 pm summaries for organizers", "Email reminders", "GitHub sync for tech interns"],
    featured: true,
  },
  {
    id: "program",
    name: "Program",
    rupees: 1999,
    members: 100,
    price: "₹1,999",
    period: "per batch, per month",
    fit: "For colleges and training institutes",
    features: ["Up to 100 interns", "Attendance by voice", "Evaluations and certificates", "Weekly reports for sponsors"],
  },
];

export const planById = (id: string): Plan | undefined => PLANS.find((p) => p.id === id);

/** How long one payment keeps a plan active. */
export const PLAN_DAYS = 30;

/** What the pages need to know about the signed-in organizer's plan. */
export type MyPlan = {
  plan: PlanId | null;
  name: string | null;
  limit: number;
  used: number;
  /** ISO date, null without a plan. */
  expiresAt: string | null;
};

// Demo workspace: "Payvo" - a 9-person fintech startup building an SME invoicing + payments product.

export const DEMO_SOURCES = [
  {
    key: "s1",
    title: "Architecture Review",
    date: "2026-09-03",
    kind: "recording",
    summary:
      "Engineering and product aligned on the v1 platform: Postgres for the ledger, a SaaS-only deployment model, and an India-first launch built around UPI.",
    openQuestions: ["Which region should host the primary database?"],
  },
  {
    key: "s2",
    title: "Pricing & Roadmap Sync",
    date: "2026-09-17",
    kind: "transcript",
    summary:
      "Founders agreed a freemium tier, annual-plan discounts and deferred the mobile app so the team can focus on the web dashboard.",
    openQuestions: ["Do we charge per invoice or per seat for enterprise?"],
  },
];

export const DEMO_DECISIONS = [
  {
    source: "s1",
    title: "Postgres for the payments ledger",
    statement: "The core payments ledger will run on PostgreSQL (Cloud SQL), not MongoDB.",
    rationale: "Ledger entries need multi-row ACID transactions and strong consistency for reconciliation and audits.",
    alternativesRejected: ["MongoDB", "DynamoDB"],
    owner: "Arjun (CTO)",
    quote: "Money moves need real transactions. I'm not reconciling a ledger on eventual consistency.",
    tags: ["architecture", "database"],
  },
  {
    source: "s1",
    title: "SaaS-only, no on-prem for v1",
    statement: "Payvo v1 will be offered only as multi-tenant SaaS; we will not support on-premise deployments.",
    rationale: "With 4 engineers, on-prem installs would split focus, multiply support load and slow weekly releases.",
    alternativesRejected: ["On-prem installer", "Single-tenant dedicated cloud"],
    owner: "Arjun (CTO)",
    quote: "On-prem kills a team our size. Every customer becomes a separate product. Hard no for v1.",
    tags: ["architecture", "go-to-market"],
  },
  {
    source: "s1",
    title: "India-first launch with UPI",
    statement: "We launch in India first, with UPI collections as the primary payment rail.",
    rationale: "UPI has the lowest acquisition friction for SMEs and our pilot customers are all India-based.",
    alternativesRejected: ["Simultaneous SEA launch", "Card-first"],
    owner: "Meera (CEO)",
    quote: "Our first 40 customers are in Hyderabad and Pune. UPI is what they actually use.",
    tags: ["go-to-market", "payments"],
  },
  {
    source: "s2",
    title: "Freemium tier up to 3 users",
    statement: "We will offer a free plan for teams of up to 3 users and 50 invoices per month.",
    rationale: "SMEs adopt bottom-up; free usage drives word-of-mouth and lowers sales cost.",
    alternativesRejected: ["14-day free trial only", "No free plan"],
    owner: "Meera (CEO)",
    quote: "A trial ends; a free plan spreads. Let small shops live on it forever.",
    tags: ["pricing"],
  },
  {
    source: "s2",
    title: "20% discount on annual plans",
    statement: "Annual billing gets a 20% discount versus monthly.",
    rationale: "Improves cash flow and reduces churn in the first year.",
    alternativesRejected: ["10% discount", "2 months free"],
    owner: "Rahul (Finance)",
    quote: "Twenty percent is the number customers remember. It pays for itself in churn.",
    tags: ["pricing"],
  },
  {
    source: "s2",
    title: "Mobile app deferred to Q2 2027",
    statement: "The native mobile app is postponed to Q2 2027; the team focuses on the responsive web dashboard.",
    rationale: "Pilot users do invoicing from desktops; mobile would split a small frontend team.",
    alternativesRejected: ["React Native app in Q4"],
    owner: "Priya (Product)",
    quote: "Nobody in the pilot asked for an app. They asked for bulk invoice upload.",
    tags: ["roadmap"],
  },
];

export const DEMO_LIVE_MEETING = {
  title: "Enterprise Deal Debrief - Bank Pilot",
  date: "2026-10-15",
  text: `Meeting: Enterprise deal debrief. Attendees: Meera (CEO), Vikram (Sales), Priya (Product), Arjun (CTO) joined late.

Vikram: Big news. The bank pilot wants to move forward, but their infosec team will only sign if Payvo is installed inside their own data center. They said cloud is a non-starter for them.
Meera: This is a 40 lakh annual contract. That's more than our entire SME revenue.
Priya: What would they need from us?
Vikram: An on-prem installation of the full product, with our team doing the setup in their data center by December.
Meera: Okay. Let's do it. We'll offer the on-prem deployment for the bank. Vikram, tell them yes and start the contract.
Vikram: Done. Also, for enterprise customers, they asked that the free plan not apply - every user should be billed.
Meera: Agreed. Free plan stays for small businesses, but enterprise accounts are always paid, per seat.
Priya: One more - for the event logs and audit trail we should use Firestore so we can stream changes to the dashboard in real time.
Arjun (joining): Fine with Firestore for event logs, as long as the money ledger itself stays in Postgres.
Meera: Great. Decided. Let's move fast.`,
};

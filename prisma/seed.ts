/**
 * Nexora demo seed.
 *
 * Creates 5 demo businesses with realistic operational data so every screen
 * of the platform is populated: users & roles, 10 AI agents per business,
 * contacts, leads (AI-scored), pipelines & deals, conversations with full
 * message history, calls with transcripts, appointments, knowledge base
 * documents, workflows with run history, follow-up sequences, notifications,
 * agent runs and 90 days of daily metrics.
 *
 * The data is demo content; the platform code paths that consume it are the
 * same ones used in production.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

// --- deterministic PRNG so reseeding produces stable demo data -------------
let seedState = 42;
function rand(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

const now = new Date();
function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function daysFromNow(n: number, hour = 11, minute = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function utcDay(n: number): Date {
  const d = daysAgo(n);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const PASSWORD = "Nexora@2026";

// Agent blueprints are duplicated here (instead of importing from src/) so the
// seed stays runnable standalone; the source of truth for runtime behavior is
// src/lib/ai/agents.ts.
const AGENT_SEED = [
  { type: "RECEPTION", name: "Reception Agent", description: "First responder on every channel — greets customers, detects intent, routes to the right specialist.", temperature: 0.3 },
  { type: "SALES", name: "Sales Agent", description: "Handles inquiries, shares options from the knowledge base, handles objections, drives appointments.", temperature: 0.5 },
  { type: "SUPPORT", name: "Support Agent", description: "Resolves issues using policies and FAQs; escalates to humans when confidence is low.", temperature: 0.3 },
  { type: "VOICE", name: "Voice Agent", description: "Natural phone conversations — inbound answering, outbound qualification, voice bookings.", temperature: 0.6 },
  { type: "FOLLOW_UP", name: "Follow-up Agent", description: "Personalized Day 1 / 3 / 7 follow-up sequences referencing real conversation history.", temperature: 0.6 },
  { type: "LEAD_QUALIFICATION", name: "Lead Qualification Agent", description: "Scores every lead 0–100 on budget, intent, timeline and engagement.", temperature: 0.1 },
  { type: "APPOINTMENT", name: "Appointment Agent", description: "End-to-end scheduling: proposes slots, prevents double booking, confirms and reminds.", temperature: 0.2 },
  { type: "CRM", name: "CRM Agent", description: "Keeps Pulse CRM clean — extracts structured fields from every conversation automatically.", temperature: 0.1 },
  { type: "KNOWLEDGE", name: "Knowledge Agent", description: "Answers strictly from the business knowledge base with source references.", temperature: 0.2 },
  { type: "ANALYTICS", name: "Analytics Agent", description: "Turns metrics into daily executive briefings: what changed, why, and what to do.", temperature: 0.4 },
] as const;

const AGENT_PROMPT: Record<string, string> = {
  RECEPTION: `You are the Reception Agent for {{businessName}}, a {{industry}} business.\nGreet warmly, identify intent, and route to the right specialist.\nRespond with strict JSON: {"intent": "SALES" | "SUPPORT" | "APPOINTMENT" | "GENERAL", "reply": "<short greeting>", "urgency": "LOW" | "MEDIUM" | "HIGH"}`,
  SALES: `You are the Sales Agent for {{businessName}}.\nOnly quote facts from the provided knowledge context. Ask one qualifying question per reply. Propose an appointment when intent is high. Consultative and concise.`,
  SUPPORT: `You are the Support Agent for {{businessName}}.\nAnswer only from provided policy/FAQ context. If you cannot resolve or the customer is upset, end with [ESCALATE_TO_HUMAN].`,
  VOICE: `You are the Voice Agent for {{businessName}} on a live call.\nSpeak naturally, short sentences, confirm details by repeating them. Output [TRANSFER_TO_HUMAN] when the caller asks for a person.`,
  FOLLOW_UP: `You are the Follow-up Agent for {{businessName}}.\nWrite ONE short personalized follow-up (max 3 sentences) for the given sequence step, referencing the customer's actual history.`,
  LEAD_QUALIFICATION: `You are the Lead Qualification Agent for {{businessName}}.\nScore 0-100 (budget 0-30, intent 0-30, timeline 0-20, engagement 0-20).\nStrict JSON: {"score": <int>, "factors": [...], "recommendation": "HOT"|"WARM"|"COLD", "nextAction": "..."}`,
  APPOINTMENT: `You are the Appointment Agent for {{businessName}}.\nOnly offer provided slots. Confirm date/time/purpose. On confirmation output strict JSON {"action":"BOOK","title":"...","scheduledAt":"<ISO>","reply":"..."} else {"action":"PROPOSE","reply":"..."}`,
  CRM: `You are the CRM Agent for {{businessName}}.\nExtract structured CRM data as strict JSON: {"contact":{...},"lead":{"budget":<num>,"requirement":""},"summary":"","sentiment":"POSITIVE"|"NEUTRAL"|"NEGATIVE"}. Never guess.`,
  KNOWLEDGE: `You are the Knowledge Agent for {{businessName}}.\nAnswer ONLY from provided excerpts, citing source titles. If missing, say you'll confirm with a specialist.`,
  ANALYTICS: `You are the Analytics Agent for {{businessName}}.\nProduce an executive briefing: Headline, Wins (3), Risks (3), Recommended actions (3). Concrete numbers only.`,
};

interface BizConfig {
  slug: string;
  name: string;
  industry: string;
  description: string;
  stages: { name: string; probability: number; color: string }[];
  tags: { name: string; color: string }[];
  metricProfile: { revenueBase: number; leadsBase: number };
}

const BUSINESSES: BizConfig[] = [
  {
    slug: "skyline-realty",
    name: "Skyline Realty",
    industry: "REAL_ESTATE",
    description: "Premium residential and commercial property developer, Ahmedabad.",
    stages: [
      { name: "New Inquiry", probability: 10, color: "#64748B" },
      { name: "Qualified", probability: 30, color: "#2563EB" },
      { name: "Site Visit", probability: 55, color: "#7C3AED" },
      { name: "Negotiation", probability: 75, color: "#D97706" },
      { name: "Booking", probability: 95, color: "#059669" },
    ],
    tags: [
      { name: "Hot Lead", color: "#DC2626" },
      { name: "2BHK", color: "#2563EB" },
      { name: "3BHK", color: "#7C3AED" },
      { name: "Villa", color: "#D97706" },
      { name: "Investor", color: "#059669" },
      { name: "NRI", color: "#0891B2" },
    ],
    metricProfile: { revenueBase: 4200000, leadsBase: 14 },
  },
  {
    slug: "azure-grand-hotel",
    name: "Azure Grand Hotel",
    industry: "HOTEL",
    description: "5-star business hotel with 220 rooms, banquets and conferencing, Mumbai.",
    stages: [
      { name: "Inquiry", probability: 15, color: "#64748B" },
      { name: "Quote Sent", probability: 40, color: "#2563EB" },
      { name: "Negotiation", probability: 65, color: "#D97706" },
      { name: "Confirmed", probability: 95, color: "#059669" },
    ],
    tags: [
      { name: "Corporate", color: "#2563EB" },
      { name: "Wedding", color: "#DB2777" },
      { name: "Conference", color: "#7C3AED" },
      { name: "Repeat Guest", color: "#059669" },
    ],
    metricProfile: { revenueBase: 1850000, leadsBase: 22 },
  },
  {
    slug: "saffron-house",
    name: "Saffron House",
    industry: "RESTAURANT",
    description: "Fine-dining Indian restaurant with private dining and event catering, Delhi.",
    stages: [
      { name: "Inquiry", probability: 20, color: "#64748B" },
      { name: "Menu Shared", probability: 45, color: "#2563EB" },
      { name: "Tasting Booked", probability: 70, color: "#D97706" },
      { name: "Event Confirmed", probability: 95, color: "#059669" },
    ],
    tags: [
      { name: "Catering", color: "#D97706" },
      { name: "Private Dining", color: "#7C3AED" },
      { name: "Regular", color: "#059669" },
      { name: "Birthday", color: "#DB2777" },
    ],
    metricProfile: { revenueBase: 420000, leadsBase: 18 },
  },
  {
    slug: "medicare-plus-clinic",
    name: "MediCare Plus Clinic",
    industry: "CLINIC",
    description: "Multi-speciality clinic — dermatology, dental, physiotherapy and diagnostics, Pune.",
    stages: [
      { name: "Inquiry", probability: 15, color: "#64748B" },
      { name: "Consultation Booked", probability: 45, color: "#2563EB" },
      { name: "Treatment Plan", probability: 70, color: "#7C3AED" },
      { name: "Ongoing Care", probability: 95, color: "#059669" },
    ],
    tags: [
      { name: "Dermatology", color: "#DB2777" },
      { name: "Dental", color: "#2563EB" },
      { name: "Physio", color: "#059669" },
      { name: "Insurance", color: "#D97706" },
    ],
    metricProfile: { revenueBase: 380000, leadsBase: 16 },
  },
  {
    slug: "brightpath-academy",
    name: "Brightpath Academy",
    industry: "EDUCATION",
    description: "Career academy for data science, cloud and product management programs, Bangalore.",
    stages: [
      { name: "Inquiry", probability: 15, color: "#64748B" },
      { name: "Counseling", probability: 40, color: "#2563EB" },
      { name: "Application", probability: 65, color: "#D97706" },
      { name: "Enrolled", probability: 95, color: "#059669" },
    ],
    tags: [
      { name: "Data Science", color: "#2563EB" },
      { name: "Cloud", color: "#0891B2" },
      { name: "Working Professional", color: "#7C3AED" },
      { name: "Scholarship", color: "#059669" },
    ],
    metricProfile: { revenueBase: 950000, leadsBase: 26 },
  },
];

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Arjun", "Reyansh", "Ishaan", "Kabir", "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Meera", "Riya", "Rohan", "Karan", "Nisha", "Pooja", "Sanjay", "Deepak", "Farhan", "Zara", "Neha", "Amit", "Priya", "Rahul", "Sneha", "Vikram", "Anjali", "Manish"];
const LAST_NAMES = ["Sharma", "Patel", "Mehta", "Gupta", "Verma", "Shah", "Reddy", "Iyer", "Khan", "Singh", "Joshi", "Desai", "Nair", "Kulkarni", "Chopra", "Malhotra", "Agarwal", "Bhatt", "Rao", "Kapoor"];

function phoneNumber(): string {
  return `+91 ${randInt(70000, 99999)} ${randInt(10000, 99999)}`;
}

async function main() {
  console.log("Seeding Nexora demo data...");

  // Wipe in dependency order (SQLite dev database).
  await prisma.$transaction([
    prisma.agentRun.deleteMany(),
    prisma.workflowRun.deleteMany(),
    prisma.workflow.deleteMany(),
    prisma.followUp.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.dailyMetric.deleteMany(),
    prisma.analyticsEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.knowledgeChunk.deleteMany(),
    prisma.knowledgeDocument.deleteMany(),
    prisma.call.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.note.deleteMany(),
    prisma.task.deleteMany(),
    prisma.contactTag.deleteMany(),
    prisma.leadTag.deleteMany(),
    prisma.dealTag.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.stage.deleteMany(),
    prisma.pipeline.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.company.deleteMany(),
    prisma.customFieldDefinition.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.channel.deleteMany(),
    prisma.aiAgent.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.business.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // --- Platform owner ------------------------------------------------------
  const owner = await prisma.user.create({
    data: {
      email: "owner@nexora.app",
      passwordHash,
      name: "Bhavesh Choudhary",
      title: "Founder & CEO",
      isPlatformOwner: true,
      lastLoginAt: daysAgo(0, 9),
    },
  });

  for (const biz of BUSINESSES) {
    console.log(`  → ${biz.name}`);
    const business = await prisma.business.create({
      data: {
        slug: biz.slug,
        name: biz.name,
        industry: biz.industry,
        description: biz.description,
      },
    });

    // --- Team ---------------------------------------------------------------
    const mkUser = async (name: string, role: string, title: string) => {
      const email = `${name.toLowerCase().replace(/\s+/g, ".")}@${biz.slug}.demo`;
      const user = await prisma.user.create({
        data: { email, passwordHash, name, title, lastLoginAt: daysAgo(randInt(0, 3), randInt(9, 18)) },
      });
      await prisma.membership.create({
        data: { userId: user.id, businessId: business.id, role },
      });
      return user;
    };
    await prisma.membership.create({
      data: { userId: owner.id, businessId: business.id, role: "OWNER" },
    });
    const admin = await mkUser(pick(FIRST_NAMES) + " " + pick(LAST_NAMES), "ADMIN", "Operations Head");
    const manager = await mkUser(pick(FIRST_NAMES) + " " + pick(LAST_NAMES), "MANAGER", "Sales Manager");
    const agent1 = await mkUser(pick(FIRST_NAMES) + " " + pick(LAST_NAMES), "AGENT", "Sales Executive");
    const agent2 = await mkUser(pick(FIRST_NAMES) + " " + pick(LAST_NAMES), "AGENT", "Sales Executive");
    const support1 = await mkUser(pick(FIRST_NAMES) + " " + pick(LAST_NAMES), "SUPPORT", "Customer Support");
    const team = [admin, manager, agent1, agent2, support1];

    // --- AI agents ------------------------------------------------------------
    const agents: Record<string, { id: string }> = {};
    for (const a of AGENT_SEED) {
      agents[a.type] = await prisma.aiAgent.create({
        data: {
          businessId: business.id,
          type: a.type,
          name: a.name,
          description: a.description,
          systemPrompt: AGENT_PROMPT[a.type]!,
          temperature: a.temperature,
          status: "ACTIVE",
        },
      });
    }

    // --- Channels ---------------------------------------------------------------
    const channelSeed: [string, string, string][] = [
      ["WHATSAPP", "WhatsApp Business", "CONNECTED"],
      ["WEBSITE_CHAT", "Website Chat Widget", "CONNECTED"],
      ["INSTAGRAM", "Instagram DMs", "CONNECTED"],
      ["PHONE", "Voice Line", "CONNECTED"],
      ["EMAIL", "Email Inbox", "DISCONNECTED"],
      ["FACEBOOK", "Facebook Messenger", "DISCONNECTED"],
      ["TELEGRAM", "Telegram Bot", "DISCONNECTED"],
    ];
    for (const [type, name, status] of channelSeed) {
      await prisma.channel.create({
        data: { businessId: business.id, type, name, status },
      });
    }

    // --- Integrations -------------------------------------------------------------
    const integrations: [string, string, string][] = [
      ["ANTHROPIC", "Anthropic Claude", "AWAITING_CREDENTIALS"],
      ["N8N", "n8n Automation", "AWAITING_CREDENTIALS"],
      ["WHATSAPP_BUSINESS", "WhatsApp Business API", "AWAITING_CREDENTIALS"],
      ["TWILIO", "Twilio Voice & SMS", "AWAITING_CREDENTIALS"],
      ["GOOGLE_CALENDAR", "Google Calendar", "AWAITING_CREDENTIALS"],
      ["RAZORPAY", "Razorpay", "AWAITING_CREDENTIALS"],
    ];
    for (const [provider, name, status] of integrations) {
      await prisma.integration.create({
        data: { businessId: business.id, provider, name, status },
      });
    }

    // --- API key for n8n (demo key, documented in README) ---------------------------
    const rawKey = `nxk_demo_${biz.slug.replace(/-/g, "_")}_2f8a91c4d7e3b6a5`;
    await prisma.apiKey.create({
      data: {
        businessId: business.id,
        name: "n8n Automation Key",
        prefix: rawKey.slice(0, 12),
        hashedKey: createHash("sha256").update(rawKey).digest("hex"),
        scopesJson: JSON.stringify(["*"]),
        lastUsedAt: daysAgo(1, 14),
      },
    });

    // --- Tags -----------------------------------------------------------------------
    const tagRows: Record<string, { id: string }> = {};
    for (const t of biz.tags) {
      tagRows[t.name] = await prisma.tag.create({
        data: { businessId: business.id, name: t.name, color: t.color },
      });
    }

    // --- Custom fields ---------------------------------------------------------------
    const customFields: Record<string, [string, string, string][]> = {
      REAL_ESTATE: [
        ["LEAD", "preferred_location", "Preferred Location"],
        ["LEAD", "property_type", "Property Type"],
        ["CONTACT", "occupation", "Occupation"],
      ],
      HOTEL: [
        ["LEAD", "event_date", "Event Date"],
        ["LEAD", "guest_count", "Guest Count"],
        ["CONTACT", "company_name", "Company Name"],
      ],
      RESTAURANT: [
        ["LEAD", "party_size", "Party Size"],
        ["LEAD", "occasion", "Occasion"],
        ["CONTACT", "dietary_preference", "Dietary Preference"],
      ],
      CLINIC: [
        ["LEAD", "department", "Department"],
        ["CONTACT", "insurance_provider", "Insurance Provider"],
        ["CONTACT", "blood_group", "Blood Group"],
      ],
      EDUCATION: [
        ["LEAD", "program_interest", "Program Interest"],
        ["CONTACT", "highest_qualification", "Highest Qualification"],
        ["CONTACT", "work_experience_years", "Work Experience (Years)"],
      ],
    };
    for (const [entityType, key, label] of customFields[biz.industry] ?? []) {
      await prisma.customFieldDefinition.create({
        data: { businessId: business.id, entityType, key, label, fieldType: "TEXT" },
      });
    }

    // --- Pipeline & stages -------------------------------------------------------------
    const pipeline = await prisma.pipeline.create({
      data: { businessId: business.id, name: "Sales Pipeline", isDefault: true },
    });
    const stageRows = [];
    for (let i = 0; i < biz.stages.length; i++) {
      const s = biz.stages[i]!;
      stageRows.push(
        await prisma.stage.create({
          data: { pipelineId: pipeline.id, name: s.name, order: i, probability: s.probability, color: s.color },
        }),
      );
    }

    // --- Companies -----------------------------------------------------------------------
    const companyNames: Record<string, string[]> = {
      REAL_ESTATE: ["Vertex Infra LLP", "GreenSpace Developers", "Habitat Consulting"],
      HOTEL: ["TechNova Solutions", "Meridian Events Co", "GlobalTrade Exports"],
      RESTAURANT: ["Sterling Weddings", "CorpConnect Events", "Kappa Media House"],
      CLINIC: ["Shield Insurance TPA", "WellCorp Employee Care", "CityCare Diagnostics"],
      EDUCATION: ["TalentBridge HR", "Innovate Careers", "CampusConnect"],
    };
    const companies = [];
    for (const name of companyNames[biz.industry] ?? []) {
      companies.push(
        await prisma.company.create({
          data: {
            businessId: business.id,
            name,
            industry: biz.industry === "REAL_ESTATE" ? "Construction" : "Services",
            phone: phoneNumber(),
            website: `https://www.${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
            size: pick(["11-50", "51-200", "201-1000"]),
          },
        }),
      );
    }

    // --- Contacts & leads -------------------------------------------------------------------
    const requirements: Record<string, string[]> = {
      REAL_ESTATE: [
        "Looking for 2BHK under ₹50L in Satellite area",
        "3BHK apartment, ready possession, near SG Highway",
        "Villa with garden, budget ₹1.2Cr, 6-month timeline",
        "Commercial office space 2000 sq ft for IT company",
        "Investment property with rental yield above 4%",
        "2BHK for parents, ground floor preferred, lift building",
        "Plot in upcoming scheme for long-term investment",
        "3BHK with clubhouse amenities for family of five",
      ],
      HOTEL: [
        "Corporate offsite for 80 people, 2 nights, conference hall needed",
        "Wedding reception for 350 guests in December",
        "Monthly corporate booking — 15 rooms for visiting engineers",
        "Anniversary staycation package inquiry",
        "Product launch event with banquet and AV setup",
        "Team dinner for 40 with private dining",
      ],
      RESTAURANT: [
        "Birthday dinner for 25 people, veg only, private room",
        "Corporate catering for 120 — monthly contract",
        "Wedding sangeet catering, 300 guests",
        "Weekend chef's table experience for 8",
        "Kitty party package for 15 ladies, afternoon slot",
        "Office lunch delivery contract inquiry",
      ],
      CLINIC: [
        "Acne treatment consultation, dermatology",
        "Full dental checkup + whitening for couple",
        "Physiotherapy sessions for post-surgery knee recovery",
        "Annual health checkup package for family of four",
        "Hair loss treatment consultation",
        "Root canal treatment — insurance covered",
      ],
      EDUCATION: [
        "Data Science bootcamp — working professional, weekend batch",
        "Cloud certification program for team of 6 engineers",
        "Product Management course, career switch from sales",
        "Data Analytics course with placement support",
        "Corporate training for 20 analysts",
        "Python foundation course for fresher",
      ],
    };

    const contacts = [];
    const leads = [];
    const contactCount = biz.industry === "REAL_ESTATE" ? 18 : 12;
    for (let i = 0; i < contactCount; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const createdAt = daysAgo(randInt(0, 60), randInt(9, 20));
      const contact = await prisma.contact.create({
        data: {
          businessId: business.id,
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 99)}@gmail.com`,
          phone: phoneNumber(),
          whatsapp: phoneNumber(),
          source: pick(["WHATSAPP", "WEBSITE", "INSTAGRAM", "REFERRAL", "PHONE", "CAMPAIGN"]),
          lifecycleStage: pick(["LEAD", "LEAD", "PROSPECT", "CUSTOMER"]),
          ownerId: pick(team).id,
          companyId: rand() < 0.25 ? pick(companies).id : undefined,
          createdAt,
        },
      });
      contacts.push(contact);
      // tag some contacts
      if (rand() < 0.5) {
        await prisma.contactTag.create({
          data: { contactId: contact.id, tagId: pick(Object.values(tagRows)).id },
        });
      }

      const reqList = requirements[biz.industry]!;
      const score = randInt(20, 98);
      const status =
        score > 85 ? pick(["QUALIFIED", "CONVERTED"]) : score > 60 ? pick(["QUALIFIED", "CONTACTED"]) : pick(["NEW", "CONTACTED", "UNQUALIFIED", "LOST"]);
      const budgetRanges: Record<string, [number, number]> = {
        REAL_ESTATE: [3500000, 25000000],
        HOTEL: [80000, 2500000],
        RESTAURANT: [15000, 900000],
        CLINIC: [3000, 250000],
        EDUCATION: [45000, 600000],
      };
      const [bmin, bmax] = budgetRanges[biz.industry]!;
      const lead = await prisma.lead.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          title: reqList[i % reqList.length]!,
          source: contact.source ?? "WEBSITE",
          status,
          score,
          scoreFactorsJson: JSON.stringify([
            { factor: "Budget clarity & fit", points: Math.round(score * 0.3), detail: "Budget stated and within range" },
            { factor: "Intent strength", points: Math.round(score * 0.3), detail: "Asked specific availability questions" },
            { factor: "Timeline urgency", points: Math.round(score * 0.2), detail: "Decision expected within weeks" },
            { factor: "Engagement quality", points: Math.round(score * 0.2), detail: "Responsive across multiple sessions" },
          ]),
          budget: Math.round(randInt(bmin, bmax) / 1000) * 1000,
          requirement: reqList[i % reqList.length]!,
          assignedToId: pick(team).id,
          qualifiedByAi: score > 60,
          convertedAt: status === "CONVERTED" ? daysAgo(randInt(1, 20)) : undefined,
          createdAt,
        },
      });
      leads.push({ lead, contact });
      if (score > 85) {
        const hot = tagRows["Hot Lead"];
        if (hot) await prisma.leadTag.create({ data: { leadId: lead.id, tagId: hot.id } });
      }
      await prisma.activity.create({
        data: {
          businessId: business.id,
          type: "LEAD_CREATED",
          title: `Lead created from ${lead.source}`,
          actorType: "SYSTEM",
          contactId: contact.id,
          leadId: lead.id,
          createdAt,
        },
      });
      if (lead.qualifiedByAi) {
        await prisma.activity.create({
          data: {
            businessId: business.id,
            type: "LEAD_QUALIFIED",
            title: `Lead scored ${score}/100 by Lead Qualification Agent`,
            actorType: "AI_AGENT",
            actorAgentId: agents["LEAD_QUALIFICATION"]!.id,
            contactId: contact.id,
            leadId: lead.id,
            createdAt: new Date(createdAt.getTime() + 3600_000),
          },
        });
      }
    }

    // --- Deals ---------------------------------------------------------------------------------
    const dealTitles: Record<string, string[]> = {
      REAL_ESTATE: ["Skyline Heights — 3BHK Unit 1204", "Emerald Greens Villa E-7", "Skyline Heights — 2BHK Unit 806", "Skyline Business Park — Office 402", "Emerald Greens Villa C-2", "Skyline Heights — 3BHK Unit 1502", "Maple Residency Plot 118", "Skyline Heights — 2BHK Unit 1108"],
      HOTEL: ["TechNova Annual Offsite", "Kapoor Wedding — December Block", "Meridian Product Launch", "GlobalTrade Room Block Q3", "Sharma Anniversary Package", "CorpConnect Conference"],
      RESTAURANT: ["Sterling Wedding Catering", "CorpConnect Monthly Lunch Contract", "Mehta Birthday Private Dining", "Kappa Media Year-End Party", "Verma Sangeet Catering"],
      CLINIC: ["WellCorp Employee Health Program", "Family Health Checkup Package x4", "Dental Care Plan — Gupta Family", "Physio Recovery Package — 12 Sessions", "Derma Treatment Plan — 6 Months"],
      EDUCATION: ["Data Science Cohort — Jan Batch x3", "TalentBridge Corporate Training", "Cloud Certification Team of 6", "PM Program Enrollment", "Analytics Course + Placement Track"],
    };
    const dealValueRanges: Record<string, [number, number]> = {
      REAL_ESTATE: [3800000, 22000000],
      HOTEL: [150000, 3200000],
      RESTAURANT: [40000, 1200000],
      CLINIC: [8000, 350000],
      EDUCATION: [60000, 900000],
    };
    const [dmin, dmax] = dealValueRanges[biz.industry]!;
    const titles = dealTitles[biz.industry]!;
    const dealCount = Math.min(titles.length, 8);
    for (let i = 0; i < dealCount; i++) {
      const { contact } = leads[i % leads.length]!;
      const isWon = i % 4 === 1;
      const isLost = i % 7 === 3;
      const stage = isWon ? stageRows[stageRows.length - 1]! : stageRows[randInt(0, stageRows.length - 1)]!;
      const createdAt = daysAgo(randInt(5, 75), randInt(9, 18));
      const value = Math.round(randInt(dmin, dmax) / 5000) * 5000;
      const deal = await prisma.deal.create({
        data: {
          businessId: business.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          contactId: contact.id,
          companyId: rand() < 0.3 ? pick(companies).id : undefined,
          title: titles[i]!,
          value,
          status: isWon ? "WON" : isLost ? "LOST" : "OPEN",
          expectedCloseDate: daysFromNow(randInt(5, 45)),
          wonAt: isWon ? daysAgo(randInt(1, 25)) : undefined,
          lostAt: isLost ? daysAgo(randInt(1, 25)) : undefined,
          lostReason: isLost ? pick(["Budget mismatch", "Chose competitor", "Postponed decision"]) : undefined,
          ownerId: pick(team).id,
          aiSummary: `Customer engaged via ${pick(["WhatsApp", "website chat", "phone"])}. ${isWon ? "Closed after AI-scheduled site visit and two negotiation rounds." : isLost ? "Went cold after quote; Follow-up Agent ran full sequence." : "Active — next step scheduled by Appointment Agent."}`,
          source: pick(["WHATSAPP", "WEBSITE", "REFERRAL", "CAMPAIGN"]),
          createdAt,
        },
      });
      await prisma.activity.create({
        data: {
          businessId: business.id,
          type: isWon ? "DEAL_WON" : isLost ? "DEAL_LOST" : "DEAL_CREATED",
          title: isWon ? `Deal won — ${deal.title}` : isLost ? `Deal lost — ${deal.title}` : `Deal created — ${deal.title}`,
          actorType: "USER",
          actorUserId: deal.ownerId!,
          contactId: contact.id,
          dealId: deal.id,
          createdAt: isWon || isLost ? daysAgo(randInt(1, 25)) : createdAt,
        },
      });
      // a task + note per few deals
      if (i % 2 === 0) {
        await prisma.task.create({
          data: {
            businessId: business.id,
            title: pick(["Send revised quotation", "Confirm site visit slot", "Share payment schedule", "Collect KYC documents", "Schedule tasting session", "Send program brochure"]),
            dueAt: daysFromNow(randInt(1, 7), 17),
            priority: pick(["MEDIUM", "HIGH", "URGENT"]),
            status: "OPEN",
            assignedToId: pick(team).id,
            contactId: contact.id,
            dealId: deal.id,
            createdByType: pick(["HUMAN", "AI_AGENT"]),
          },
        });
        await prisma.note.create({
          data: {
            businessId: business.id,
            body: pick([
              "Customer prefers evening calls after 6 PM.",
              "Decision maker is the spouse — include both in next meeting.",
              "Very price sensitive; lead with value and payment plan options.",
              "Referred by an existing customer — high trust, fast-track.",
            ]),
            authorUserId: pick(team).id,
            contactId: contact.id,
            dealId: deal.id,
          },
        });
      }
    }

    // --- Appointments -----------------------------------------------------------------------------
    const apptTypes: Record<string, string[]> = {
      REAL_ESTATE: ["SITE_VISIT", "MEETING", "CALL"],
      HOTEL: ["MEETING", "CALL", "CHECK_IN"],
      RESTAURANT: ["TABLE_RESERVATION", "MEETING", "CALL"],
      CLINIC: ["CONSULTATION", "CALL"],
      EDUCATION: ["CONSULTATION", "DEMO", "CALL"],
    };
    for (let i = 0; i < 10; i++) {
      const { contact } = pick(leads);
      const upcoming = i < 6;
      const scheduledAt = upcoming
        ? daysFromNow(randInt(0, 7), randInt(10, 18))
        : daysAgo(randInt(1, 14), randInt(10, 18));
      await prisma.appointment.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          title: pick([
            `${pick(apptTypes[biz.industry]!).replace(/_/g, " ").toLowerCase()} with ${contact.firstName}`,
            `Meeting — ${contact.firstName} ${contact.lastName ?? ""}`,
          ]),
          type: pick(apptTypes[biz.industry]!),
          scheduledAt,
          endAt: new Date(scheduledAt.getTime() + 45 * 60_000),
          status: upcoming ? pick(["SCHEDULED", "CONFIRMED"]) : pick(["COMPLETED", "COMPLETED", "NO_SHOW"]),
          assignedToId: pick(team).id,
          bookedByType: pick(["AI_AGENT", "AI_AGENT", "HUMAN"]),
          location: biz.industry === "REAL_ESTATE" ? pick(["Skyline Heights Site Office", "Emerald Greens Gate 2", "Head Office"]) : "Main Premises",
          reminderSentAt: upcoming ? undefined : daysAgo(randInt(1, 14), 9),
        },
      });
    }

    // --- Conversations with messages ------------------------------------------------------------------
    const convSeeds: {
      channel: string;
      status: string;
      sentiment: string;
      summary: string;
      msgs: [string, string][]; // [senderType, body]
    }[] =
      biz.industry === "REAL_ESTATE"
        ? [
            {
              channel: "WHATSAPP",
              status: "AI_HANDLING",
              sentiment: "POSITIVE",
              summary: "Customer looking for a 3BHK near SG Highway under ₹95L. Shared Skyline Heights options; site visit proposed for Saturday 11 AM.",
              msgs: [
                ["CUSTOMER", "Hi, I saw your ad on Instagram. Looking for a 3BHK near SG Highway."],
                ["AI_AGENT", "Welcome to Skyline Realty! Great choice — we have 3BHK residences at Skyline Heights, right off SG Highway. May I know your budget range so I can share the best-matched options?"],
                ["CUSTOMER", "Around 90-95 lakh max"],
                ["AI_AGENT", "Perfect fit. Skyline Heights Tower B has 3BHK units (1,850 sq ft) between ₹88L–₹96L with clubhouse, pool and 2 covered parkings. Possession in 4 months. Would you like to visit the site this weekend? Saturday 11 AM or 4 PM slots are open."],
                ["CUSTOMER", "Saturday 11am works. Can my wife join?"],
                ["AI_AGENT", "Absolutely — I've booked your site visit for Saturday 11:00 AM at the Skyline Heights site office for 2 visitors. You'll get a reminder on Friday evening. Looking forward to hosting you both!"],
              ],
            },
            {
              channel: "WEBSITE_CHAT",
              status: "HUMAN_TAKEOVER",
              sentiment: "NEGATIVE",
              summary: "Existing buyer upset about a delayed registration date. Support Agent escalated to human; ops team owns resolution.",
              msgs: [
                ["CUSTOMER", "My registration was promised for last week and nobody is responding. This is really frustrating."],
                ["AI_AGENT", "I'm sorry about the delay — that's not the experience we want for you. I can see your booking for Unit 806. Let me connect you directly with our operations team right away."],
                ["HUMAN", "Hi, this is Priya from Skyline operations. I've checked your file — the sub-registrar slot moved due to a public holiday. Your new confirmed date is this Thursday 11 AM. I'll personally share the documents checklist here today."],
                ["CUSTOMER", "Ok thank you, please make sure it happens this time."],
              ],
            },
            {
              channel: "WHATSAPP",
              status: "AI_HANDLING",
              sentiment: "NEUTRAL",
              summary: "NRI investor evaluating villa inventory for rental yield; asked for payment plan PDF, which was shared.",
              msgs: [
                ["CUSTOMER", "Do you have villas suitable for rental investment? I'm based in Dubai."],
                ["AI_AGENT", "Yes — Emerald Greens villas (3 & 4BHK) have a strong rental profile: current yields are 3.8–4.3% with corporate leasing demand nearby. As an NRI you can complete the entire booking remotely. Shall I share the payment plan and rental projections PDF?"],
                ["CUSTOMER", "Yes please share"],
                ["AI_AGENT", "Sent! You'll find the Emerald Greens investor deck with payment schedule and 5-year projection. Our Voice Agent can also arrange a video walkthrough this week — would Wednesday or Friday evening IST suit you?"],
              ],
            },
            {
              channel: "INSTAGRAM",
              status: "RESOLVED",
              sentiment: "POSITIVE",
              summary: "Quick pricing question on 2BHK; answered from knowledge base, brochure sent.",
              msgs: [
                ["CUSTOMER", "price of 2bhk?"],
                ["AI_AGENT", "Hi! Skyline Heights 2BHK (1,180 sq ft) starts at ₹52.4L all-inclusive. Would you like the floor plan brochure or a quick site visit this week?"],
                ["CUSTOMER", "send brochure"],
                ["AI_AGENT", "Done — brochure sent. I'm here if you'd like to see it in person!"],
              ],
            },
          ]
        : [
            {
              channel: "WHATSAPP",
              status: "AI_HANDLING",
              sentiment: "POSITIVE",
              summary: `New inquiry handled end-to-end by AI; details captured in CRM and next step scheduled.`,
              msgs: [
                ["CUSTOMER", requirements[biz.industry]![0]!],
                ["AI_AGENT", `Thank you for reaching out to ${biz.name}! I can definitely help with that. Could you share your preferred date and approximate group size so I can check availability?`],
                ["CUSTOMER", "Sometime next week, will confirm exact date"],
                ["AI_AGENT", "Noted! I've saved your requirement and will hold tentative availability for next week. I'll follow up on Monday morning — or you can pick a slot anytime and I'll confirm it instantly."],
              ],
            },
            {
              channel: "WEBSITE_CHAT",
              status: "RESOLVED",
              sentiment: "NEUTRAL",
              summary: "Pricing question answered from the knowledge base; brochure shared.",
              msgs: [
                ["CUSTOMER", "What are your charges?"],
                ["AI_AGENT", `Here's our current pricing from the ${biz.name} catalog — I've shared the detailed PDF. Anything specific you'd like me to break down?`],
                ["CUSTOMER", "Ok I'll check and get back"],
                ["AI_AGENT", "Perfect — I'm available 24×7 whenever you're ready. Have a great day!"],
              ],
            },
            {
              channel: "PHONE",
              status: "HUMAN_TAKEOVER",
              sentiment: "NEGATIVE",
              summary: "Service complaint escalated to human support with full context handoff.",
              msgs: [
                ["CUSTOMER", "I have a complaint about my last experience. I want to speak to a manager."],
                ["AI_AGENT", "I'm truly sorry to hear that — your feedback matters. I'm connecting you with our duty manager right now and sharing your details so you won't have to repeat anything."],
                ["HUMAN", "Hello, this is the duty manager. I've read the full context — let me resolve this for you personally."],
              ],
            },
          ];

    for (const conv of convSeeds) {
      const { contact, lead } = pick(leads);
      const startedDaysAgo = randInt(0, 6);
      const conversation = await prisma.conversation.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          channelType: conv.channel,
          status: conv.status,
          aiAgentId: agents["SALES"]!.id,
          humanAssigneeId: conv.status === "HUMAN_TAKEOVER" ? support1.id : undefined,
          aiSummary: conv.summary,
          sentiment: conv.sentiment,
          unreadCount: conv.status === "AI_HANDLING" ? randInt(0, 2) : 0,
          createdAt: daysAgo(startedDaysAgo, 10),
          lastMessageAt: daysAgo(startedDaysAgo, 10 + conv.msgs.length),
        },
      });
      let minute = 0;
      for (const [senderType, body] of conv.msgs) {
        minute += randInt(1, 9);
        await prisma.message.create({
          data: {
            businessId: business.id,
            conversationId: conversation.id,
            direction: senderType === "CUSTOMER" ? "INBOUND" : "OUTBOUND",
            senderType,
            senderAgentId: senderType === "AI_AGENT" ? agents["SALES"]!.id : undefined,
            contentType: "TEXT",
            body,
            deliveryStatus: senderType === "CUSTOMER" ? "DELIVERED" : "READ",
            createdAt: new Date(daysAgo(startedDaysAgo, 10).getTime() + minute * 60_000),
          },
        });
        if (senderType === "AI_AGENT") {
          await prisma.agentRun.create({
            data: {
              businessId: business.id,
              agentId: agents["SALES"]!.id,
              action: "REPLY_MESSAGE",
              status: "COMPLETED",
              conversationId: conversation.id,
              contactId: contact.id,
              leadId: lead.id,
              inputSummary: "Customer message + knowledge context",
              outputSummary: body.slice(0, 200),
              tokensUsed: randInt(400, 1400),
              durationMs: randInt(900, 3200),
              createdAt: new Date(daysAgo(startedDaysAgo, 10).getTime() + minute * 60_000),
            },
          });
        }
      }
    }

    // --- Calls -------------------------------------------------------------------------------------------
    const callSeeds = [
      {
        direction: "INBOUND",
        status: "COMPLETED",
        outcome: "APPOINTMENT_BOOKED",
        sentiment: "POSITIVE",
        duration: randInt(180, 420),
        summary: "Caller asked about availability and pricing; Voice Agent answered from knowledge base and booked an appointment for this week.",
        transcript: `Agent: Good morning, thank you for calling ${biz.name}! How may I help you today?\nCaller: Hi, I wanted to check availability for this weekend.\nAgent: Of course. May I have your name please?\nCaller: This is ${pick(FIRST_NAMES)}.\nAgent: Thank you! We do have availability this weekend. Would you prefer Saturday or Sunday?\nCaller: Saturday works.\nAgent: Wonderful — I've booked that for you and sent a confirmation on WhatsApp. Anything else I can help with?\nCaller: No that's all, thanks!\nAgent: My pleasure. See you Saturday!`,
      },
      {
        direction: "OUTBOUND",
        status: "COMPLETED",
        outcome: "QUALIFIED",
        sentiment: "POSITIVE",
        duration: randInt(150, 380),
        summary: "Outbound qualification call 2 minutes after web lead. Budget and timeline confirmed; lead scored 91/100 and routed to sales.",
        transcript: `Agent: Hello, am I speaking with the person who inquired on our website a few minutes ago?\nCaller: Yes, that was quick!\nAgent: We try! I'd love to understand what you're looking for so we can help properly.\nCaller: (shares requirement and budget)\nAgent: That's very helpful. Based on this, I'll have our specialist share the two best options today. Would a visit this week suit you?\nCaller: Yes, maybe Thursday.\nAgent: Thursday it is — you'll receive a confirmation shortly. Thank you!`,
      },
      {
        direction: "INBOUND",
        status: "TRANSFERRED",
        outcome: "TRANSFERRED_TO_HUMAN",
        sentiment: "NEUTRAL",
        duration: randInt(120, 300),
        summary: "Caller had a billing question requiring account access; transferred to support with full context.",
        transcript: `Agent: Thank you for calling ${biz.name}, how can I help?\nCaller: I have a question about my invoice.\nAgent: I can help with general billing questions, but for account-specific details let me connect you to our support team. One moment please.\n(Transferred to human agent with call summary attached)`,
      },
      {
        direction: "OUTBOUND",
        status: "MISSED",
        outcome: "NO_ANSWER",
        sentiment: null,
        duration: 0,
        summary: "Follow-up call attempt — no answer. Retry scheduled and WhatsApp follow-up sent automatically.",
        transcript: null,
      },
      {
        direction: "INBOUND",
        status: "COMPLETED",
        outcome: "FOLLOW_UP_SCHEDULED",
        sentiment: "NEUTRAL",
        duration: randInt(90, 240),
        summary: "Price-sensitive caller comparing options; Voice Agent shared differentiators and scheduled a follow-up for next week.",
        transcript: `Agent: Good afternoon, ${biz.name}!\nCaller: I'm comparing a few options, what makes you different?\nAgent: Great question. (shares three differentiators from knowledge base)\nCaller: Interesting. Let me think about it.\nAgent: Absolutely — may I check back with you early next week after you've compared?\nCaller: Sure.\nAgent: Done. You'll also receive a summary on WhatsApp. Thank you!`,
      },
    ];
    for (const c of callSeeds) {
      const { contact } = pick(leads);
      const startedAt = daysAgo(randInt(0, 12), randInt(9, 19), randInt(0, 59));
      await prisma.call.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          direction: c.direction,
          status: c.status,
          durationSec: c.duration,
          transcript: c.transcript,
          aiSummary: c.summary,
          sentiment: c.sentiment,
          outcome: c.outcome,
          handledByAgentId: agents["VOICE"]!.id,
          transferredToId: c.status === "TRANSFERRED" ? support1.id : undefined,
          startedAt,
          endedAt: c.duration ? new Date(startedAt.getTime() + c.duration * 1000) : undefined,
        },
      });
      if (c.status !== "MISSED") {
        await prisma.agentRun.create({
          data: {
            businessId: business.id,
            agentId: agents["VOICE"]!.id,
            action: "HANDLE_CALL",
            status: "COMPLETED",
            contactId: contact.id,
            inputSummary: `${c.direction} call`,
            outputSummary: c.summary,
            tokensUsed: randInt(1500, 5200),
            durationMs: c.duration * 1000,
            createdAt: startedAt,
          },
        });
      }
    }

    // --- Knowledge base ---------------------------------------------------------------------------------------
    const kbSeeds: Record<string, { title: string; sourceType: string; chunks: string[] }[]> = {
      REAL_ESTATE: [
        {
          title: "Skyline Heights — Project Brochure",
          sourceType: "PDF",
          chunks: [
            "Skyline Heights is a 22-storey premium residential tower on SG Highway, Ahmedabad. Configurations: 2BHK (1,180 sq ft) from ₹52.4L and 3BHK (1,850 sq ft) from ₹88L to ₹96L. All prices all-inclusive of GST, parking and clubhouse membership.",
            "Amenities: infinity swimming pool, 8,000 sq ft clubhouse, gym, co-working lounge, children's play area, landscaped podium garden, 3-tier security with facial recognition, EV charging in all towers.",
            "Possession timeline: Tower A ready to move; Tower B possession within 4 months. RERA registration GJ/RERA/2024/11842. Bank approvals: SBI, HDFC, ICICI, Axis with pre-approved project loans.",
            "Payment plan: 10% booking, 40% within 60 days, 40% on slab completion milestones, 10% on possession. Special offer this quarter: stamp duty covered by developer for bookings this month.",
          ],
        },
        {
          title: "Emerald Greens Villas — Investor Deck",
          sourceType: "PDF",
          chunks: [
            "Emerald Greens: gated villa community with 84 units. 3BHK villas (2,400 sq ft) at ₹1.05Cr–₹1.2Cr and 4BHK villas (3,100 sq ft) at ₹1.45Cr–₹1.65Cr. Each villa has a private garden and 2-car garage.",
            "Rental performance: current corporate leasing demand yields 3.8–4.3% gross. 5-year historical price appreciation in the micro-market: 9.2% CAGR.",
            "NRI buying process: fully remote booking supported — video walkthrough, digital KYC, POA registration guidance and NRE/NRO payment routing assistance provided by our documentation desk.",
          ],
        },
        {
          title: "Frequently Asked Questions",
          sourceType: "FAQ",
          chunks: [
            "Q: Are the prices negotiable? A: Listed prices are best prices; however payment-plan flexibility and quarter-end offers are available. Q: Is home loan assistance provided? A: Yes, dedicated loan desk with 4 partner banks, sanction typically in 7 working days.",
            "Q: What are site visit timings? A: Every day 10 AM to 6 PM including weekends. Pickup can be arranged within the city. Q: Pet policy? A: Both projects are pet-friendly. Q: Maintenance charges? A: ₹3.2/sq ft/month at Skyline Heights, ₹4.1 at Emerald Greens.",
          ],
        },
        {
          title: "Booking & Cancellation Policy",
          sourceType: "POLICY",
          chunks: [
            "Booking token: ₹2L (refundable within 15 days, no questions asked). Cancellation after agreement: as per RERA guidelines. Registration support, legal verification and agreement drafting handled by in-house legal desk at no extra cost.",
          ],
        },
      ],
      HOTEL: [
        {
          title: "Banquets & Conferencing Catalog",
          sourceType: "CATALOG",
          chunks: [
            "Azure Grand Hotel: Grand Ballroom seats 500 (theatre) / 350 (rounds), Sapphire Hall seats 150, 4 boardrooms of 12-20. Wedding packages from ₹1,850/plate (veg) and ₹2,250/plate (non-veg) including decor consultation.",
            "Corporate packages: full-day conference at ₹2,900/person including hall, AV, 2 tea breaks and buffet lunch. Residential conference bundle with rooms from ₹8,500/night (corporate rate).",
          ],
        },
        {
          title: "Rooms & Rates",
          sourceType: "PDF",
          chunks: [
            "220 rooms: Deluxe (from ₹9,500), Club (₹12,500 with lounge access), Suites (from ₹19,000). Corporate contracted rates available for 10+ room-nights/month. Airport transfer complimentary for Club and above.",
            "Amenities: rooftop pool, spa, 24×7 gym, 3 restaurants, executive lounge. Check-in 2 PM, check-out 12 noon; early/late subject to availability.",
          ],
        },
        {
          title: "Cancellation & Payment Policy",
          sourceType: "POLICY",
          chunks: [
            "Room bookings: free cancellation till 48h before arrival. Events: 25% advance to block date, 50% at 30 days, balance 7 days prior. Date change allowed once without charge up to 45 days before event.",
          ],
        },
      ],
      RESTAURANT: [
        {
          title: "Menus & Catering Packages",
          sourceType: "CATALOG",
          chunks: [
            "Saffron House fine-dining: à la carte North Indian & Awadhi. Private Dining Room seats 24 (minimum spend ₹35,000 weekdays / ₹50,000 weekends). Chef's tasting menu ₹3,200/person (veg) ₹3,800 (non-veg).",
            "Catering: weddings & events from ₹1,450/plate (veg premium) with live counters. Corporate meal contracts from ₹280/meal for 50+ daily meals, monthly billing.",
          ],
        },
        {
          title: "Reservations & Events FAQ",
          sourceType: "FAQ",
          chunks: [
            "Q: Reservation policy? A: Tables held 15 minutes past booking time. Groups of 8+ require ₹500/person confirmation deposit, adjusted in bill. Q: Do you handle decor for private events? A: Yes, in-house decor partner with 3 standard themes; custom themes on request.",
          ],
        },
      ],
      CLINIC: [
        {
          title: "Services & Consultation Fees",
          sourceType: "CATALOG",
          chunks: [
            "MediCare Plus: Dermatology consultation ₹800, Dental consultation ₹500 (free with any treatment), Physiotherapy session ₹700 (package of 12: ₹7,200), Full-body health checkup ₹3,999 (couple ₹6,999).",
            "Specialist availability: Dermatology Mon/Wed/Fri 10-2, Dental daily 9-7, Physio daily 8-8. Teleconsultation available for follow-ups at ₹500.",
          ],
        },
        {
          title: "Insurance & Billing Policy",
          sourceType: "POLICY",
          chunks: [
            "Cashless facility with 14 insurers via Shield TPA. Pre-authorization takes 2-4 hours for planned procedures. All diagnostic reports delivered digitally within 24 hours. EMI available for treatment plans above ₹25,000.",
          ],
        },
      ],
      EDUCATION: [
        {
          title: "Programs & Fees Catalog",
          sourceType: "CATALOG",
          chunks: [
            "Brightpath Academy programs: Data Science Bootcamp (6 months, weekend, ₹1,45,000), Cloud Engineering Certification (4 months, ₹95,000), Product Management Accelerator (3 months, ₹85,000), Data Analytics + Placement Track (5 months, ₹1,20,000).",
            "All programs include: 1:1 mentorship, capstone projects with partner companies, placement support with 340+ hiring partners, EMI from ₹6,500/month with 0% interest for 12 months.",
          ],
        },
        {
          title: "Admissions FAQ",
          sourceType: "FAQ",
          chunks: [
            "Q: Eligibility? A: Any graduate; coding programs need basic logic aptitude (free assessment). Q: Scholarship? A: Merit scholarships up to 30% via entrance assessment; women-in-tech grant 15%. Q: Placement stats? A: 87% placement within 6 months, average package ₹9.2 LPA for Data Science cohort 2025.",
          ],
        },
      ],
    };
    for (const doc of kbSeeds[biz.industry] ?? []) {
      const document = await prisma.knowledgeDocument.create({
        data: {
          businessId: business.id,
          title: doc.title,
          sourceType: doc.sourceType,
          fileName: `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${doc.sourceType === "FAQ" || doc.sourceType === "POLICY" ? "md" : "pdf"}`,
          sizeBytes: randInt(80_000, 2_400_000),
          status: "READY",
          chunkCount: doc.chunks.length,
          uploadedById: admin.id,
          createdAt: daysAgo(randInt(10, 45)),
        },
      });
      for (let i = 0; i < doc.chunks.length; i++) {
        await prisma.knowledgeChunk.create({
          data: {
            businessId: business.id,
            documentId: document.id,
            order: i,
            content: doc.chunks[i]!,
            tokenCount: Math.round(doc.chunks[i]!.length / 4),
          },
        });
      }
    }

    // --- Workflows --------------------------------------------------------------------------------------------
    const workflowSeeds = [
      {
        name: "WhatsApp Omnichannel Pipeline",
        description: "Receives every WhatsApp message, detects media type, transcribes audio/voice notes, runs the multi-agent pipeline (reception → knowledge → sales/support → CRM → qualification), updates the dashboard and schedules automations.",
        category: "MESSAGING",
        trigger: "WhatsApp message received",
        status: "ACTIVE",
        n8nId: "wf_whatsapp_pipeline",
        nodes: ["WhatsApp Trigger", "Detect Message Type", "Media Transcription", "Nexora AI Orchestrator", "Knowledge Base Retrieval", "Lead Qualification", "CRM Update", "Appointment Booking", "Send Reply", "Analytics Update"],
      },
      {
        name: "Instant Lead Response Call",
        description: "When a new web/campaign lead lands, waits 2 minutes, then triggers an outbound Voice Agent qualification call; books an appointment or schedules a follow-up sequence based on the outcome.",
        category: "VOICE",
        trigger: "New lead created (web / campaign)",
        status: "ACTIVE",
        n8nId: "wf_instant_call",
        nodes: ["Lead Created Webhook", "Wait 2 Minutes", "Fetch Lead Context", "Voice Agent Outbound Call", "Call Outcome Router", "Book Appointment", "Schedule Follow-up", "CRM Update", "Notify Sales Team"],
      },
      {
        name: "Smart Follow-up Sequence",
        description: "Day 1 / Day 3 / Day 7 personalized follow-ups written by the Follow-up Agent from real conversation history; stops automatically when the customer replies or converts.",
        category: "FOLLOW_UP",
        trigger: "Lead inactive for 24 hours",
        status: "ACTIVE",
        n8nId: "wf_followup",
        nodes: ["Daily Schedule Trigger", "Fetch Due Follow-ups", "Stop-condition Check", "Follow-up Agent Compose", "Send via Channel", "Log to CRM", "Reschedule Next Step"],
      },
      {
        name: "Hot Lead Routing & Alerts",
        description: "Leads scored 85+ by the Lead Qualification Agent trigger instant alerts to the owner and are auto-assigned to the best available sales executive.",
        category: "LEAD_ROUTING",
        trigger: "Lead score updated ≥ 85",
        status: "ACTIVE",
        n8nId: "wf_hot_lead",
        nodes: ["Score Webhook", "Threshold Filter", "Pick Available Executive", "Assign in CRM", "WhatsApp Alert to Owner", "Create Priority Task"],
      },
      {
        name: "Daily Executive Briefing",
        description: "Every morning at 8 AM the Analytics Agent compiles yesterday's metrics into an executive briefing and delivers it to the owner on WhatsApp and email.",
        category: "ANALYTICS",
        trigger: "Schedule — daily 08:00",
        status: "ACTIVE",
        n8nId: "wf_daily_brief",
        nodes: ["Cron 08:00 Trigger", "Fetch Daily Metrics", "Analytics Agent Briefing", "Format Report", "Send WhatsApp", "Send Email"],
      },
      {
        name: "Appointment Reminder Engine",
        description: "Sends reminders 24h and 2h before every appointment; no-shows automatically get a reschedule message and the slot is released.",
        category: "NOTIFICATIONS",
        trigger: "Appointment upcoming (24h / 2h)",
        status: "PAUSED",
        n8nId: "wf_reminders",
        nodes: ["Schedule Trigger (15 min)", "Fetch Upcoming Appointments", "Reminder Window Filter", "Send Reminder", "Mark Reminded", "No-show Reschedule Flow"],
      },
    ];
    const workflowRows = [];
    for (const wf of workflowSeeds) {
      const nodes = wf.nodes.map((label, i) => ({ id: `n${i}`, label, order: i }));
      const edges = nodes.slice(0, -1).map((n, i) => [n.id, nodes[i + 1]!.id]);
      workflowRows.push(
        await prisma.workflow.create({
          data: {
            businessId: business.id,
            name: wf.name,
            description: wf.description,
            category: wf.category,
            trigger: wf.trigger,
            n8nWorkflowId: wf.n8nId,
            status: wf.status,
            definitionJson: JSON.stringify({ nodes, edges }),
            createdAt: daysAgo(randInt(20, 50)),
          },
        }),
      );
    }
    // Workflow runs (last 7 days)
    for (const wf of workflowRows) {
      const runsPerDay = wf.name.includes("WhatsApp") ? 14 : wf.name.includes("Follow-up") ? 6 : 3;
      for (let d = 0; d < 7; d++) {
        for (let r = 0; r < randInt(Math.max(1, runsPerDay - 3), runsPerDay); r++) {
          const failed = rand() < 0.04;
          const total = JSON.parse(wf.definitionJson).nodes.length;
          const startedAt = daysAgo(d, randInt(8, 21), randInt(0, 59));
          const durationMs = randInt(800, 12_000);
          await prisma.workflowRun.create({
            data: {
              businessId: business.id,
              workflowId: wf.id,
              status: failed ? "FAILED" : "SUCCESS",
              triggerSource: wf.category === "MESSAGING" ? "whatsapp:inbound" : wf.category === "ANALYTICS" ? "schedule" : "webhook",
              stepsCompleted: failed ? randInt(1, total - 1) : total,
              totalSteps: total,
              durationMs,
              error: failed ? pick(["Timeout waiting for channel API", "Rate limit from provider", "Webhook payload validation failed"]) : undefined,
              startedAt,
              finishedAt: new Date(startedAt.getTime() + durationMs),
            },
          });
        }
      }
    }

    // --- Follow-ups ------------------------------------------------------------------------------------------------
    for (let i = 0; i < 6; i++) {
      const { contact, lead } = pick(leads);
      const scheduled = i < 3;
      await prisma.followUp.create({
        data: {
          businessId: business.id,
          contactId: contact.id,
          leadId: lead.id,
          channel: pick(["WHATSAPP", "EMAIL", "SMS"]),
          message: pick([
            `Hi ${contact.firstName}, just checking in on your inquiry — happy to answer any questions or set up a quick visit this week.`,
            `Hi ${contact.firstName}! The options we discussed are still available. Would you like me to hold one while you decide?`,
            `${contact.firstName}, our current offer closes this weekend — want me to lock it in for you before it ends?`,
          ]),
          sequenceStep: randInt(1, 3),
          scheduledAt: scheduled ? daysFromNow(randInt(0, 4), randInt(10, 18)) : daysAgo(randInt(1, 6), randInt(10, 18)),
          status: scheduled ? "SCHEDULED" : "SENT",
          sentAt: scheduled ? undefined : daysAgo(randInt(1, 6), randInt(10, 18)),
        },
      });
    }

    // --- Notifications ------------------------------------------------------------------------------------------------
    const notifSeeds: [string, string, string, string][] = [
      ["HIGH_VALUE_LEAD", `Hot lead: ${pick(FIRST_NAMES)} (94/100)`, "Lead Qualification Agent flagged a high-intent inquiry with confirmed budget. Recommended action: call within 30 minutes.", "CRITICAL"],
      ["APPOINTMENT_BOOKED", "Appointment booked by AI", "The Appointment Agent booked a visit for tomorrow 11:00 AM and sent the confirmation.", "NORMAL"],
      ["DEAL_WON", "Deal won 🎉", `A deal was moved to Won. Revenue updated on the dashboard.`, "HIGH"],
      ["HUMAN_TAKEOVER_REQUESTED", "Human takeover requested", "Support Agent escalated a frustrated customer — full context attached to the conversation.", "HIGH"],
      ["SYSTEM", "Daily briefing ready", "Your executive briefing for yesterday is ready in Analytics.", "LOW"],
    ];
    for (let i = 0; i < notifSeeds.length; i++) {
      const [type, title, body, priority] = notifSeeds[i]!;
      await prisma.notification.create({
        data: {
          businessId: business.id,
          type,
          title,
          body,
          priority,
          readAt: i > 2 ? daysAgo(1) : undefined,
          createdAt: daysAgo(randInt(0, 2), randInt(8, 20)),
        },
      });
    }

    // --- Agent runs (30 days of AI activity powering AI analytics) ------------------------------------------------------
    const runProfiles: [string, string, number][] = [
      ["RECEPTION", "ROUTE_CONVERSATION", 10],
      ["SALES", "REPLY_MESSAGE", 9],
      ["SUPPORT", "REPLY_MESSAGE", 5],
      ["VOICE", "HANDLE_CALL", 4],
      ["FOLLOW_UP", "SEND_FOLLOW_UP", 6],
      ["LEAD_QUALIFICATION", "QUALIFY_LEAD", 7],
      ["APPOINTMENT", "BOOK_APPOINTMENT", 3],
      ["CRM", "UPDATE_CRM", 8],
      ["KNOWLEDGE", "SEARCH_KNOWLEDGE", 6],
      ["ANALYTICS", "ANALYZE_METRICS", 1],
    ];
    const agentRunRows: {
      businessId: string; agentId: string; action: string; status: string;
      tokensUsed: number; durationMs: number; createdAt: Date;
    }[] = [];
    for (let d = 0; d < 30; d++) {
      for (const [type, action, perDay] of runProfiles) {
        const count = randInt(Math.max(0, perDay - 3), perDay + 3);
        for (let i = 0; i < count; i++) {
          agentRunRows.push({
            businessId: business.id,
            agentId: agents[type]!.id,
            action,
            status: rand() < 0.025 ? "FAILED" : "COMPLETED",
            tokensUsed: randInt(300, 2600),
            durationMs: randInt(600, 4200),
            createdAt: daysAgo(d, randInt(8, 21), randInt(0, 59)),
          });
        }
      }
    }
    await prisma.agentRun.createMany({ data: agentRunRows });

    // --- Daily metrics (90 days) --------------------------------------------------------------------------------------------
    const metricRows: { businessId: string; date: Date; metric: string; value: number }[] = [];
    for (let d = 0; d < 90; d++) {
      const growth = 1 + (90 - d) * 0.004; // gentle upward trend toward today
      const weekend = [0, 6].includes(daysAgo(d).getDay()) ? 0.7 : 1;
      const push = (metric: string, value: number) =>
        metricRows.push({ businessId: business.id, date: utcDay(d), metric, value: Math.max(0, Math.round(value)) });

      const leadsToday = biz.metricProfile.leadsBase * growth * weekend * (0.7 + rand() * 0.6);
      push("NEW_LEADS", leadsToday);
      push("CONVERSATIONS", leadsToday * (1.6 + rand() * 0.8));
      push("AI_MESSAGES", leadsToday * (4 + rand() * 3));
      push("HUMAN_MESSAGES", leadsToday * (0.5 + rand() * 0.5));
      push("CALLS_INBOUND", leadsToday * (0.5 + rand() * 0.4));
      push("CALLS_OUTBOUND", leadsToday * (0.4 + rand() * 0.4));
      push("APPOINTMENTS", leadsToday * (0.28 + rand() * 0.18));
      push("LEADS_QUALIFIED", leadsToday * (0.4 + rand() * 0.2));
      push("FOLLOW_UPS_SENT", leadsToday * (0.8 + rand() * 0.6));
      const dealsWon = rand() < 0.55 ? randInt(0, biz.industry === "REAL_ESTATE" ? 2 : 4) : 0;
      push("DEALS_WON", dealsWon);
      push("DEALS_LOST", rand() < 0.4 ? randInt(0, 2) : 0);
      metricRows.push({
        businessId: business.id, date: utcDay(d), metric: "REVENUE",
        value: Math.round(dealsWon * biz.metricProfile.revenueBase * (0.6 + rand() * 0.9)),
      });
      metricRows.push({ businessId: business.id, date: utcDay(d), metric: "CSAT", value: Math.round((4.1 + rand() * 0.7) * 10) / 10 });
      metricRows.push({ businessId: business.id, date: utcDay(d), metric: "AVG_RESPONSE_TIME_SEC", value: randInt(2, 9) });
    }
    await prisma.dailyMetric.createMany({ data: metricRows });
  }

  console.log("\nSeed complete.");
  console.log("──────────────────────────────────────────────");
  console.log("Platform Owner login:  owner@nexora.app / " + PASSWORD);
  console.log("Business staff logins: <name>@<business-slug>.demo / " + PASSWORD);
  console.log("n8n API keys:          nxk_demo_<business_slug>_2f8a91c4d7e3b6a5");
  console.log("──────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

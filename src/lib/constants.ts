/**
 * Domain constants. The database stores plain strings (SQLite has no enums);
 * these constants are the single source of truth for every valid value.
 */

export const BUSINESS_INDUSTRIES = [
  "REAL_ESTATE",
  "HOTEL",
  "RESTAURANT",
  "HOSPITAL",
  "CLINIC",
  "EDUCATION",
  "SERVICE",
  "MANUFACTURING",
  "OTHER",
] as const;
export type BusinessIndustry = (typeof BUSINESS_INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<BusinessIndustry, string> = {
  REAL_ESTATE: "Real Estate",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant",
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  EDUCATION: "Education",
  SERVICE: "Service Business",
  MANUFACTURING: "Manufacturing",
  OTHER: "Other",
};

export const ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  AGENT: "Sales Agent",
  SUPPORT: "Support",
};

/** Role hierarchy — higher number means more authority. */
export const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  AGENT: 2,
  SUPPORT: 1,
};

export const AGENT_TYPES = [
  "RECEPTION",
  "SALES",
  "SUPPORT",
  "VOICE",
  "FOLLOW_UP",
  "LEAD_QUALIFICATION",
  "APPOINTMENT",
  "CRM",
  "KNOWLEDGE",
  "ANALYTICS",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  RECEPTION: "Reception Agent",
  SALES: "Sales Agent",
  SUPPORT: "Support Agent",
  VOICE: "Voice Agent",
  FOLLOW_UP: "Follow-up Agent",
  LEAD_QUALIFICATION: "Lead Qualification Agent",
  APPOINTMENT: "Appointment Agent",
  CRM: "CRM Agent",
  KNOWLEDGE: "Knowledge Agent",
  ANALYTICS: "Analytics Agent",
};

export const CHANNEL_TYPES = [
  "WHATSAPP",
  "WEBSITE_CHAT",
  "INSTAGRAM",
  "FACEBOOK",
  "TELEGRAM",
  "EMAIL",
  "PHONE",
  "SMS",
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  WHATSAPP: "WhatsApp",
  WEBSITE_CHAT: "Website Chat",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
  PHONE: "Phone",
  SMS: "SMS",
};

export const LEAD_SOURCES = [
  "WHATSAPP",
  "WEBSITE",
  "INSTAGRAM",
  "FACEBOOK",
  "REFERRAL",
  "WALK_IN",
  "PHONE",
  "EMAIL",
  "CAMPAIGN",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "CONVERTED",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const DEAL_STATUSES = ["OPEN", "WON", "LOST"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const CONVERSATION_STATUSES = [
  "OPEN",
  "AI_HANDLING",
  "HUMAN_TAKEOVER",
  "RESOLVED",
] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CALL_OUTCOMES = [
  "APPOINTMENT_BOOKED",
  "QUALIFIED",
  "FOLLOW_UP_SCHEDULED",
  "NOT_INTERESTED",
  "NO_ANSWER",
  "TRANSFERRED_TO_HUMAN",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const ACTIVITY_TYPES = [
  "LEAD_CREATED",
  "LEAD_QUALIFIED",
  "LEAD_STATUS_CHANGED",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "CALL_COMPLETED",
  "CALL_MISSED",
  "DEAL_CREATED",
  "DEAL_STAGE_CHANGED",
  "DEAL_WON",
  "DEAL_LOST",
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_COMPLETED",
  "NOTE_ADDED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "FOLLOW_UP_SENT",
  "AI_ACTION",
  "CONTACT_CREATED",
  "HUMAN_TAKEOVER",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const AGENT_ACTIONS = [
  "REPLY_MESSAGE",
  "QUALIFY_LEAD",
  "BOOK_APPOINTMENT",
  "UPDATE_CRM",
  "SEND_FOLLOW_UP",
  "HANDLE_CALL",
  "SEARCH_KNOWLEDGE",
  "GENERATE_SUMMARY",
  "ROUTE_CONVERSATION",
  "ANALYZE_METRICS",
] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

export const METRIC_KEYS = [
  "REVENUE",
  "NEW_LEADS",
  "CONVERSATIONS",
  "AI_MESSAGES",
  "HUMAN_MESSAGES",
  "CALLS_INBOUND",
  "CALLS_OUTBOUND",
  "APPOINTMENTS",
  "DEALS_WON",
  "DEALS_LOST",
  "CSAT",
  "AVG_RESPONSE_TIME_SEC",
  "LEADS_QUALIFIED",
  "FOLLOW_UPS_SENT",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const INTEGRATION_PROVIDERS = [
  "ANTHROPIC",
  "N8N",
  "WHATSAPP_BUSINESS",
  "TWILIO",
  "ELEVENLABS",
  "GOOGLE_CALENDAR",
  "GOOGLE_SHEETS",
  "GMAIL",
  "OUTLOOK",
  "SLACK",
  "TELEGRAM",
  "STRIPE",
  "RAZORPAY",
  "HUBSPOT",
  "SALESFORCE",
  "NOTION",
  "CUSTOM_REST_API",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_LABELS: Record<IntegrationProvider, string> = {
  ANTHROPIC: "Anthropic Claude",
  N8N: "n8n Automation",
  WHATSAPP_BUSINESS: "WhatsApp Business API",
  TWILIO: "Twilio Voice & SMS",
  ELEVENLABS: "ElevenLabs Voice",
  GOOGLE_CALENDAR: "Google Calendar",
  GOOGLE_SHEETS: "Google Sheets",
  GMAIL: "Gmail",
  OUTLOOK: "Outlook",
  SLACK: "Slack",
  TELEGRAM: "Telegram",
  STRIPE: "Stripe",
  RAZORPAY: "Razorpay",
  HUBSPOT: "HubSpot",
  SALESFORCE: "Salesforce",
  NOTION: "Notion",
  CUSTOM_REST_API: "Custom REST API",
};

export const APP_NAME = "Nexora";
export const APP_TAGLINE = "Enterprise AI Automation Platform";
export const CRM_NAME = "Pulse CRM";

// Shared taxonomy used by the agents, the heuristic fallback and the UI filters.
export const VERTICALS = [
  "Government", "Banking", "Insurance", "Financial Services", "Education", "Healthcare",
  "Telecom", "Retail", "Energy & Utilities", "Manufacturing", "Logistics", "Real Estate",
  "Hospitality & Travel", "Media", "Technology", "Cross-industry",
];

export const USE_CASE_TYPES = [
  "Agentic AI", "Conversational AI", "Workflow Automation", "Document Intelligence",
  "Data Integration", "Analytics & Insights", "Customer Experience", "Employee Experience",
  "IT Operations", "Compliance & Risk", "Knowledge & Search", "App Modernization",
];

export const STAGES = ["Idea", "Prototype", "Pilot", "Production"];

// Rough, conservative benchmarks used when no LLM is configured (and as a sanity anchor for the ROI agent).
export const ROI_BENCHMARKS = {
  "Agentic AI": { hours: 9000, efficiency: 45, payback: 6 },
  "Conversational AI": { hours: 12000, efficiency: 35, payback: 5 },
  "Workflow Automation": { hours: 8000, efficiency: 50, payback: 4 },
  "Document Intelligence": { hours: 7000, efficiency: 60, payback: 5 },
  "Data Integration": { hours: 4000, efficiency: 40, payback: 7 },
  "Analytics & Insights": { hours: 3000, efficiency: 25, payback: 8 },
  "Customer Experience": { hours: 10000, efficiency: 30, payback: 6 },
  "Employee Experience": { hours: 6000, efficiency: 30, payback: 6 },
  "IT Operations": { hours: 5000, efficiency: 40, payback: 5 },
  "Compliance & Risk": { hours: 4500, efficiency: 35, payback: 7 },
  "Knowledge & Search": { hours: 5000, efficiency: 30, payback: 5 },
  "App Modernization": { hours: 6000, efficiency: 35, payback: 9 },
};

const VERTICAL_KEYWORDS = {
  Government: ["government", "gov", "ministry", "municipal", "citizen", "public sector", "federal", "authority", "visa", "permit", "police", "e-gov", "smart city"],
  Banking: ["bank", "banking", "loan", "account opening", "kyc", "credit card", "mortgage", "deposit", "atm", "core banking"],
  Insurance: ["insurance", "claim", "policyholder", "underwriting", "premium", "insurer"],
  "Financial Services": ["fintech", "payment", "wealth", "investment", "trading", "finance", "invoice", "accounts payable", "aml"],
  Education: ["education", "student", "university", "school", "campus", "learning", "course", "admission", "teacher", "lms"],
  Healthcare: ["health", "patient", "hospital", "clinic", "medical", "doctor", "pharma", "ehr", "care"],
  Telecom: ["telecom", "telco", "mobile operator", "sim", "5g", "subscriber", "network operator"],
  Retail: ["retail", "e-commerce", "ecommerce", "shop", "store", "order", "merchandis", "cart", "consumer"],
  "Energy & Utilities": ["energy", "utility", "utilities", "oil", "gas", "power", "electric", "water", "grid"],
  Manufacturing: ["manufactur", "factory", "plant", "supply chain", "production line", "maintenance", "iot"],
  Logistics: ["logistic", "shipping", "fleet", "warehouse", "delivery", "freight", "port", "airport"],
  "Real Estate": ["real estate", "property", "tenant", "lease", "facility"],
  "Hospitality & Travel": ["hotel", "travel", "airline", "booking", "tourism", "hospitality"],
  Media: ["media", "content", "publishing", "broadcast", "news"],
  Technology: ["saas", "software", "developer", "api", "it service"],
};

const TYPE_KEYWORDS = {
  "Agentic AI": ["agent", "agentic", "autonomous", "copilot", "multi-agent", "ai assistant"],
  "Conversational AI": ["chatbot", "chat", "conversational", "voice", "whatsapp", "virtual assistant", "ivr"],
  "Workflow Automation": ["workflow", "automation", "automate", "approval", "process", "orchestrat", "rpa"],
  "Document Intelligence": ["document", "ocr", "invoice", "extract", "pdf", "contract", "form"],
  "Data Integration": ["integration", "etl", "pipeline", "sync", "connector", "data lake"],
  "Analytics & Insights": ["dashboard", "analytics", "insight", "report", "kpi", "forecast"],
  "Customer Experience": ["customer", "onboarding", "self-service", "portal", "support", "crm"],
  "Employee Experience": ["employee", "hr", "onboard", "helpdesk", "leave", "payroll"],
  "IT Operations": ["itsm", "incident", "ticket", "devops", "monitoring", "service desk"],
  "Compliance & Risk": ["compliance", "risk", "audit", "fraud", "regulat", "aml"],
  "Knowledge & Search": ["search", "knowledge", "rag", "q&a", "faq"],
  "App Modernization": ["legacy", "moderniz", "migration", "low-code", "app builder"],
};

const count = (text, words) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

export function guessVerticals(text) {
  const t = text.toLowerCase();
  const scored = Object.entries(VERTICAL_KEYWORDS)
    .map(([v, words]) => [v, count(t, words)])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return scored.length ? scored.slice(0, 3).map(([v]) => v) : ["Cross-industry"];
}

export function guessType(text) {
  const t = text.toLowerCase();
  const scored = Object.entries(TYPE_KEYWORDS)
    .map(([v, words]) => [v, count(t, words)])
    .sort((a, b) => b[1] - a[1]);
  return scored[0][1] > 0 ? scored[0][0] : "Workflow Automation";
}

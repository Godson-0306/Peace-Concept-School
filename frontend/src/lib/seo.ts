import {
  CLASS_LADDER_SHORT,
  CURRENT_SESSION,
  SCHOOL_ADDRESS_LINE,
  SCHOOL_HOURS,
  SCHOOL_INITIALS,
  SCHOOL_MOTTO,
  SCHOOL_NAME,
  SCHOOL_PHONE,
  SCHOOL_SHORT,
  SCHOOL_WEBSITE_URL,
} from "@/lib/brand";

export const SCHOOL_BRAND_ALIASES = [
  SCHOOL_SHORT,
  "Peace Concept School",
  SCHOOL_INITIALS,
] as const;

export const SCHOOL_CITY = "Port Harcourt";
export const SCHOOL_REGION = "Rivers State";
export const SCHOOL_COUNTRY = "Nigeria";
export const SCHOOL_LOCALITY = "Rumuigbo";
export const SCHOOL_OG_IMAGE = "/campus/hero.jpg";

export const SCHOOL_SEO_DESCRIPTION = `${SCHOOL_NAME} (Peace Concept School) in ${SCHOOL_LOCALITY}, ${SCHOOL_CITY}, ${SCHOOL_REGION}, ${SCHOOL_COUNTRY}. Official site for ${CLASS_LADDER_SHORT}. Session ${CURRENT_SESSION}.`;

export const SCHOOL_SEO_KEYWORDS = [
  SCHOOL_NAME,
  "Peace Concept School",
  SCHOOL_SHORT,
  SCHOOL_INITIALS,
  "pcism.com.ng",
  SCHOOL_LOCALITY,
  SCHOOL_CITY,
  SCHOOL_REGION,
  SCHOOL_COUNTRY,
  "Creche",
  "Pre-Nursery",
  "Nursery",
  "Basic",
  "JSS",
  "SS",
  "admissions",
  CURRENT_SESSION,
];

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = SCHOOL_WEBSITE_URL.replace(/\/$/, "");
  if (!path || path === "/") return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function schoolOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["EducationalOrganization", "School"],
    name: SCHOOL_NAME,
    alternateName: [...SCHOOL_BRAND_ALIASES],
    url: SCHOOL_WEBSITE_URL,
    logo: absoluteUrl("/pcims-logo.jpeg"),
    image: absoluteUrl(SCHOOL_OG_IMAGE),
    telephone: SCHOOL_PHONE,
    motto: SCHOOL_MOTTO,
    address: {
      "@type": "PostalAddress",
      streetAddress: SCHOOL_ADDRESS_LINE,
      addressLocality: SCHOOL_CITY,
      addressRegion: SCHOOL_REGION,
      addressCountry: "NG",
    },
    areaServed: `${SCHOOL_LOCALITY}, ${SCHOOL_CITY}, ${SCHOOL_REGION}, ${SCHOOL_COUNTRY}`,
    openingHours: "Mo-Fr 08:00-15:30",
    sameAs: [SCHOOL_WEBSITE_URL],
  };
}

export const ADMISSIONS_FAQS = [
  {
    question: "What is Peace Concept School?",
    answer: `${SCHOOL_NAME} (also called Peace Concept School or ${SCHOOL_SHORT}) is the official school at ${SCHOOL_ADDRESS_LINE}. The official website is ${SCHOOL_WEBSITE_URL}.`,
  },
  {
    question: "Which classes does Peace Concept offer?",
    answer: `Peace Concept School admits learners from ${CLASS_LADDER_SHORT} for the ${CURRENT_SESSION} session.`,
  },
  {
    question: "How do I apply to Peace Concept?",
    answer:
      "Enquire or visit the office, submit the online application, complete assessment and interview, then register if offered a place.",
  },
  {
    question: "What are Peace Concept School office hours?",
    answer: `The office is open ${SCHOOL_HOURS}. Call ${SCHOOL_PHONE} or use the contact form on ${SCHOOL_WEBSITE_URL}/contact.`,
  },
  {
    question: "Where is Peace Concept School in Port Harcourt?",
    answer: `Peace Concept is in ${SCHOOL_LOCALITY}, ${SCHOOL_CITY}: ${SCHOOL_ADDRESS_LINE}.`,
  },
] as const;

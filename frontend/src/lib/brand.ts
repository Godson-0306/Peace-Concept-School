export const SCHOOL_NAME = "Peace Concept International Mission Schools";
export const SCHOOL_SHORT = "Peace Concept";
export const SCHOOL_INITIALS = "PCIMS";

/** Campus location (matches Google Maps embed) */
export const SCHOOL_ADDRESS_LINE = "Port Harcourt, Rivers State, Nigeria";
export const SCHOOL_PHONE = "+234 801 234 5678";
export const SCHOOL_EMAIL = "info@peaceconceptschool.ng";
export const SCHOOL_HOURS = "Mon–Fri, 8:00 a.m. – 3:30 p.m.";


/** Full class ladder offered by the school */
export const CLASS_LEVELS = [
  "Day Care",
  "Nursery 1",
  "Nursery 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5",
  "JSS1",
  "JSS2",
  "JSS3",
  "SS1",
  "SS2",
  "SS3",
] as const;

export const CLASS_BANDS = [
  {
    title: "Early Years",
    range: "Day Care · Nursery 1–2",
    copy: "Warm care, play-based learning, and first steps in literacy and social skills.",
  },
  {
    title: "Basic Education",
    range: "Basic 1–5",
    copy: "Strong foundations in reading, writing, numeracy, and Christian character.",
  },
  {
    title: "Junior Secondary",
    range: "JSS1–3",
    copy: "Broader subjects, discovery, and habits that prepare learners for senior school.",
  },
  {
    title: "Senior Secondary",
    range: "SS1–3",
    copy: "Focused pathways for WAEC, NECO, and life after secondary school.",
  },
] as const;

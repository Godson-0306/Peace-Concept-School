/** Default subject score components shown on Subject Results cards. */
export const SUBJECT_SCORE_ASSESSMENTS = [
  { key: "ca1", label: "1st from order", max: 20 },
  { key: "ca2", label: "2nd from order", max: 20 },
  { key: "exam", label: "Exam", max: 60 },
] as const;

export const SCORE_LIMITS = {
  ca1: 20,
  ca2: 20,
  exam: 60,
} as const;

/** Default Form Class affective / psychomotor ratings for every class. */
export const FORM_CLASS_ASSESSMENT_MAX = 5;

export const FORM_CLASS_ASSESSMENTS = [
  { key: "reading", label: "Reading", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "verbal_fluency", label: "Verbal Fluency", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "games", label: "Games", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "tool_handling", label: "Handling Tools", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "handwriting", label: "Handwriting", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "leadership", label: "Leadership", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "punctuality", label: "Punctuality", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "self_control", label: "Self Control", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "politeness", label: "Politeness", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "neatness", label: "Neatness", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "obedience", label: "Obedience", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "honesty", label: "Honesty", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "creativity", label: "Creativity", max: FORM_CLASS_ASSESSMENT_MAX },
  { key: "attentiveness", label: "Attentiveness", max: FORM_CLASS_ASSESSMENT_MAX },
] as const;

export type FormClassAssessmentKey = (typeof FORM_CLASS_ASSESSMENTS)[number]["key"];
export type SubjectScoreKey = keyof typeof SCORE_LIMITS;

/** Clamp a numeric input to [0, max]; empty string stays empty. */
export function clampScoreInput(raw: string, max: number): string {
  if (raw.trim() === "") return "";
  const num = Number(raw);
  if (Number.isNaN(num)) return "";
  if (num < 0) return "0";
  if (num > max) return String(max);
  return raw;
}

export function parseClampedScore(raw: string, max: number): number {
  const num = Number(raw);
  if (Number.isNaN(num) || num < 0) return 0;
  return Math.min(num, max);
}
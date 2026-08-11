/** Default subject score components shown on Subject Results cards. */
export const SUBJECT_SCORE_ASSESSMENTS = [
  { key: "ca1", label: "1st from order" },
  { key: "ca2", label: "2nd from order" },
  { key: "exam", label: "Exam" },
] as const;

/** Default Form Class affective / psychomotor ratings for every class. */
export const FORM_CLASS_ASSESSMENTS = [
  { key: "reading", label: "Reading" },
  { key: "verbal_fluency", label: "Verbal Fluency" },
  { key: "games", label: "Games" },
  { key: "tool_handling", label: "Handling Tools" },
  { key: "handwriting", label: "Handwriting" },
  { key: "leadership", label: "Leadership" },
  { key: "punctuality", label: "Punctuality" },
  { key: "self_control", label: "Self Control" },
  { key: "politeness", label: "Politeness" },
  { key: "neatness", label: "Neatness" },
  { key: "obedience", label: "Obedience" },
  { key: "honesty", label: "Honesty" },
  { key: "creativity", label: "Creativity" },
  { key: "attentiveness", label: "Attentiveness" },
] as const;

export type FormClassAssessmentKey = (typeof FORM_CLASS_ASSESSMENTS)[number]["key"];

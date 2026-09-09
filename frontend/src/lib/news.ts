import { SCHOOL_NAME } from "@/lib/brand";
import { CAMPUS } from "@/lib/campusPhotos";

export type NewsItem = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  category: "News" | "Event" | "Announcement";
  image?: string;
};

export const newsItems: NewsItem[] = [
  {
    slug: "resumption-2025-2026",
    title: "Resumption for the 2025/2026 Academic Session",
    excerpt: `Students of ${SCHOOL_NAME} resume on Monday, 15 September 2025. Reporting times vary by class band.`,
    body: `The Management of ${SCHOOL_NAME} warmly welcomes all students and parents to the 2025/2026 academic session.

Day Care and Nursery learners should arrive by 8:00 a.m. Basic 1–5 students are expected by 7:45 a.m. Junior Secondary (JSS1–3) and Senior Secondary (SS1–3) students should report by 7:30 a.m. New students should arrive with their admission letters and completed medical forms.

We look forward to another year of excellence, discipline, and peace-centred learning.`,
    date: "2025-08-20",
    category: "Announcement",
    image: CAMPUS.hero,
  },
  {
    slug: "inter-house-sports-2025",
    title: "Annual Inter-House Sports Competition",
    excerpt:
      "Four houses will compete in track, field, and cultural displays on the school field this term.",
    body: `${SCHOOL_NAME} will host its Annual Inter-House Sports on Saturday, 18 October 2025. Houses — Emerald, Gold, Ivory, and Olive — will compete in athletics, football, volleyball, and cultural presentations.

Parents and guardians are cordially invited. Opening ceremony begins at 9:00 a.m. Refreshments will be available on the grounds.`,
    date: "2025-09-05",
    category: "Event",
    image: CAMPUS.primaryClass,
  },
  {
    slug: "waec-ssce-prep-clinic",
    title: "WAEC SSCE Intensive Prep Clinic for SS3",
    excerpt:
      "A four-week after-school clinic covering core subjects begins in January for graduating students.",
    body: `SS3 students preparing for the West African Senior School Certificate Examination will join a structured Prep Clinic covering Mathematics, English Language, Sciences, and selected electives.

Sessions run Mondays to Thursdays after normal lessons. Parents will receive a detailed timetable via class groups. Attendance is compulsory for all registered SS3 candidates.`,
    date: "2025-11-12",
    category: "News",
    image: CAMPUS.scienceLab,
  },
  {
    slug: "parent-teachers-forum",
    title: "First Term Parent–Teachers Forum",
    excerpt:
      "Meet class teachers, review academic expectations, and discuss pastoral care for the new session.",
    body: `The First Term Parent–Teachers Forum will hold on Saturday, 4 October 2025 in the school hall. Agenda includes curriculum overview from Day Care through SS, fee policies, and guidance counselling updates.

Class meetings follow the general assembly. We encourage at least one parent or guardian per student to attend.`,
    date: "2025-09-18",
    category: "Event",
    image: CAMPUS.secondaryClass,
  },
];

export function getNewsBySlug(slug: string): NewsItem | undefined {
  return newsItems.find((item) => item.slug === slug);
}

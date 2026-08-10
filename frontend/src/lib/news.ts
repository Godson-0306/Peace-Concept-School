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
    excerpt:
      "Students of Peace Concept School resume on Monday, 15 September 2025. Find reporting times for JSS and SSS classes.",
    body: `The Management of Peace Concept School warmly welcomes all students and parents to the 2025/2026 academic session.

Junior Secondary (JSS1–JSS3) students are expected to report by 7:45 a.m. Senior Secondary (SSS1–SSS3) students should report by 7:30 a.m. New students should arrive with their admission letters and completed medical forms.

We look forward to another year of excellence, discipline, and peace-centred learning.`,
    date: "2025-08-20",
    category: "Announcement",
    image:
      "https://images.unsplash.com/photo-1523050854058-8bc2c4e4cd81?auto=format&fit=crop&w=1200&q=80",
  },
  {
    slug: "inter-house-sports-2025",
    title: "Annual Inter-House Sports Competition",
    excerpt:
      "Four houses will compete in track, field, and cultural displays on the school field this term.",
    body: `Peace Concept School will host its Annual Inter-House Sports on Saturday, 18 October 2025. Houses — Emerald, Gold, Ivory, and Olive — will compete in athletics, football, volleyball, and cultural presentations.

Parents and guardians are cordially invited. Opening ceremony begins at 9:00 a.m. Refreshments will be available on the grounds.`,
    date: "2025-09-05",
    category: "Event",
    image:
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80",
  },
  {
    slug: "waec-ssce-prep-clinic",
    title: "WAEC SSCE Intensive Prep Clinic for SSS3",
    excerpt:
      "A four-week after-school clinic covering core subjects begins in January for graduating students.",
    body: `SSS3 students preparing for the West African Senior School Certificate Examination will join a structured Prep Clinic covering Mathematics, English Language, Sciences, and selected electives.

Sessions run Mondays to Thursdays after normal lessons. Parents will receive a detailed timetable via class groups. Attendance is compulsory for all registered SSS3 candidates.`,
    date: "2025-11-12",
    category: "News",
    image:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    slug: "parent-teachers-forum",
    title: "First Term Parent–Teachers Forum",
    excerpt:
      "Meet class teachers, review academic expectations, and discuss pastoral care for the new session.",
    body: `The First Term Parent–Teachers Forum will hold on Saturday, 4 October 2025 in the school hall. Agenda includes curriculum overview for JSS and SSS, fee policies, and guidance counselling updates.

Class meetings follow the general assembly. We encourage at least one parent or guardian per student to attend.`,
    date: "2025-09-18",
    category: "Event",
    image:
      "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1200&q=80",
  },
];

export function getNewsBySlug(slug: string): NewsItem | undefined {
  return newsItems.find((item) => item.slug === slug);
}

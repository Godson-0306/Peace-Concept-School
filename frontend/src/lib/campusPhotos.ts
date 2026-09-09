/** Curated campus photos from the school magazine (frontend/public/campus). */

export const CAMPUS = {
  hero: "/campus/hero.jpg",
  nurseryClass: "/campus/nursery-class.jpg",
  primaryClass: "/campus/primary-class.jpg",
  secondaryClass: "/campus/secondary-class.jpg",
  scienceLab: "/campus/science-lab.jpg",
  microscope: "/campus/microscope.jpg",
  studentSmile: "/campus/student-smile.jpg",
  earlyYears: "/campus/early-years.jpg",
  primaryStudent: "/campus/primary-student.jpg",
  juniorStudent: "/campus/junior-student.jpg",
  seniorGirl: "/campus/senior-girl.jpg",
  seniorBoy: "/campus/senior-boy.jpg",
} as const;

export const CAMPUS_MOSAIC = [
  { src: CAMPUS.nurseryClass, label: "Early Years class" },
  { src: CAMPUS.scienceLab, label: "Science laboratory" },
  { src: CAMPUS.studentSmile, label: "Student portrait" },
  { src: CAMPUS.secondaryClass, label: "Senior Secondary class" },
  { src: CAMPUS.primaryClass, label: "Basic class" },
  { src: CAMPUS.seniorBoy, label: "Senior student" },
] as const;

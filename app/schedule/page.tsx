"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import programs from "@/data/programs.json";

type StudentProfile = {
  programId: string;
  entry: string;
  coop: boolean;
};

type Section = {
  courseID: string;
  termCode: string;
  subject: string;
  catalog: string;
  section: string;
  componentCode: string;
  componentDescription: string;
  classNumber: string;
  classAssociation: string;
  courseTitle: string;
  classStatus: string;
  locationCode: string;
  instructionModeDescription: string;
  roomCode: string;
  classStartTime: string;
  classEndTime: string;
  modays: string;
  tuesdays: string;
  wednesdays: string;
  thursdays: string;
  fridays: string;
  classStartDate: string;
  classEndDate: string;
  enrollmentCapacity: string;
  currentEnrollment: string;
};

type TermOption = {
  termCode: string;
  termDescription: string;
};

type CourseSection = {
  courseCode: string;
  subject: string;
  catalog: string;
  sections: Section[];
  loading: boolean;
};

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(".").map(Number);
  return h * 60 + m;
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(".").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function getDays(section: Section): string {
  const days = [];
  if (section.modays === "Y") days.push("Mon");
  if (section.tuesdays === "Y") days.push("Tue");
  if (section.wednesdays === "Y") days.push("Wed");
  if (section.thursdays === "Y") days.push("Thu");
  if (section.fridays === "Y") days.push("Fri");
  return days.join(", ");
}

const COMPONENT_COLORS: Record<string, string> = {
  LEC: "bg-amaranth text-white",
  TUT: "bg-gunmetal text-white",
  LAB: "bg-teagreen text-gunmetal",
};

export default function SchedulePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [courseSections, setCourseSections] = useState<CourseSection[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("studentProfile");
    if (!stored) {
      router.push("/onboarding");
      return;
    }
    setProfile(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    async function fetchTerms() {
      const res = await fetch("/api/courses?type=sessions");
      const data: TermOption[] = await res.json();
      // Deduplicate by termCode and take last 6 unique terms
      const seen = new Set<string>();
      const unique: TermOption[] = [];
      for (const t of [...data].reverse()) {
        if (!seen.has(t.termCode)) {
          seen.add(t.termCode);
          unique.push({ termCode: t.termCode, termDescription: t.termDescription });
        }
        if (unique.length >= 6) break;
      }
      setTerms(unique);
      if (unique.length > 0) setSelectedTerm(unique[0].termCode);
    }
    fetchTerms();
  }, []);

  useEffect(() => {
    if (!profile || !selectedTerm) return;

    const program = programs.programs.find((p) => p.id === profile.programId);
    if (!program) return;

    const sequenceKey = profile.coop
      ? "coop"
      : profile.entry === "january"
      ? "january"
      : "september";

    const sequence = (program.sequences as any)[sequenceKey] ??
      (program.sequences as any)["september"];

    // Get all unique courses across all terms in the sequence
    const allCourses: { code: string; subject: string; catalog: string }[] = [];
    const seen = new Set<string>();

    for (const term of sequence) {
      for (const course of term.courses) {
        if (course.isWorkTerm) continue;
        const parts = course.code.trim().split(" ");
        if (parts.length < 2) continue;
        const subject = parts[0];
        const catalog = parts[1];
        const key = `${subject}-${catalog}`;
        if (!seen.has(key)) {
          seen.add(key);
          allCourses.push({ code: course.code, subject, catalog });
        }
      }
    }

    setCourseSections(
      allCourses.map((c) => ({
        courseCode: c.code,
        subject: c.subject,
        catalog: c.catalog,
        sections: [],
        loading: false,
      }))
    );
  }, [profile, selectedTerm]);

  async function fetchSections(subject: string, catalog: string) {
    setCourseSections((prev) =>
      prev.map((c) =>
        c.subject === subject && c.catalog === catalog
          ? { ...c, loading: true }
          : c
      )
    );

    const res = await fetch(
      `/api/courses?type=schedule&subject=${subject}&catalog=${catalog}`
    );
    const allSections: Section[] = await res.json();

    // Filter to selected term and active sections only
    const filtered = allSections.filter(
      (s) =>
        s.termCode === selectedTerm &&
        s.classStatus === "Active" &&
        s.classStartTime !== ""
    );

    setCourseSections((prev) =>
      prev.map((c) =>
        c.subject === subject && c.catalog === catalog
          ? { ...c, sections: filtered, loading: false }
          : c
      )
    );
  }

  function toggleCourse(subject: string, catalog: string, courseCode: string) {
    const key = `${subject}-${catalog}`;
    if (expandedCourse === key) {
      setExpandedCourse(null);
      return;
    }
    setExpandedCourse(key);
    const course = courseSections.find(
      (c) => c.subject === subject && c.catalog === catalog
    );
    if (course && course.sections.length === 0 && !course.loading) {
      fetchSections(subject, catalog);
    }
  }

  // Group sections by classAssociation
  function groupByAssociation(sections: Section[]) {
    const groups: Record<string, Section[]> = {};
    for (const s of sections) {
      if (!groups[s.classAssociation]) groups[s.classAssociation] = [];
      groups[s.classAssociation].push(s);
    }
    return groups;
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linen">
        <p className="text-gunmetal">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linen p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-amaranth">Schedule Builder</h1>
            <p className="text-sm text-gunmetal mt-0.5">
              Browse sections and plan your semester
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-gunmetal border border-dustgrey rounded-lg px-3 py-1.5 hover:border-amaranth hover:text-amaranth transition-colors cursor-pointer"
          >
            ← Dashboard
          </button>
        </div>

        {/* Term selector */}
        <div className="bg-white rounded-2xl border border-dustgrey p-5 mb-6">
          <h2 className="font-semibold text-gunmetal mb-3">Select Term</h2>
          <div className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <button
                key={t.termCode}
                onClick={() => setSelectedTerm(t.termCode)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                  selectedTerm === t.termCode
                    ? "bg-amaranth text-white border-amaranth"
                    : "bg-linen text-gunmetal border-dustgrey hover:border-amaranth"
                }`}
              >
                {t.termDescription}
              </button>
            ))}
          </div>
        </div>

        {/* Course list */}
        <h2 className="font-semibold text-gunmetal mb-3">Program Courses</h2>
        <div className="flex flex-col gap-3">
          {courseSections.map((course) => {
            const key = `${course.subject}-${course.catalog}`;
            const isExpanded = expandedCourse === key;
            const groups = groupByAssociation(course.sections);

            return (
              <div
                key={key}
                className="bg-white rounded-2xl border border-dustgrey overflow-hidden"
              >
                {/* Course header */}
                <button
                  onClick={() =>
                    toggleCourse(course.subject, course.catalog, course.courseCode)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-linen transition-colors cursor-pointer"
                >
                  <span className="font-medium text-gunmetal">
                    {course.courseCode}
                  </span>
                  <span className="text-xs text-gunmetal">
                    {course.loading
                      ? "Loading..."
                      : isExpanded
                      ? "▲ Hide sections"
                      : "▼ View sections"}
                  </span>
                </button>

                {/* Sections */}
                {isExpanded && !course.loading && (
                  <div className="border-t border-dustgrey px-5 py-4">
                    {course.sections.length === 0 ? (
                      <p className="text-sm text-gunmetal">
                        No sections available for this term.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {Object.entries(groups).map(([assoc, sections]) => (
                          <div key={assoc}>
                            <p className="text-xs font-semibold text-gunmetal mb-2">
                              Group {assoc}
                            </p>
                            <div className="flex flex-col gap-2">
                              {sections.map((s) => (
                                <div
                                  key={s.classNumber}
                                  className="flex items-center gap-3 rounded-xl border border-dustgrey px-4 py-2.5"
                                >
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                      COMPONENT_COLORS[s.componentCode] ||
                                      "bg-dustgrey text-gunmetal"
                                    }`}
                                  >
                                    {s.componentCode}
                                  </span>
                                  <span className="text-sm text-gunmetal font-medium w-20 shrink-0">
                                    §{s.section}
                                  </span>
                                  <span className="text-sm text-gunmetal">
                                    {getDays(s)}
                                  </span>
                                  <span className="text-sm text-gunmetal">
                                    {formatTime(s.classStartTime)} –{" "}
                                    {formatTime(s.classEndTime)}
                                  </span>
                                  <span className="text-xs text-gunmetal ml-auto shrink-0">
                                    {s.currentEnrollment}/{s.enrollmentCapacity}{" "}
                                    enrolled
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
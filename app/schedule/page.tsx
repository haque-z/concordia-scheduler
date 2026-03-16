"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import programs from "@/data/programs.json";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  classNumber: string;
  classAssociation: string;
  courseTitle: string;
  classStatus: string;
  instructionModeDescription: string;
  roomCode: string;
  classStartTime: string;
  classEndTime: string;
  modays: string;
  tuesdays: string;
  wednesdays: string;
  thursdays: string;
  fridays: string;
  enrollmentCapacity: string;
  currentEnrollment: string;
};

type TermOption = {
  termCode: string;
  termDescription: string;
};

type SelectedCourse = {
  subject: string;
  catalog: string;
  code: string;
  title: string;
  sections: Section[];
  loading: boolean;
};

type TimeSlot = {
  sections: Section[]; // all sections with this exact timeslot
  days: string[];
  startTime: string;
  endTime: string;
  componentCode: string;
  classAssociation: string;
};

type CourseOption = {
  courseCode: string;
  subject: string;
  catalog: string;
  lec: TimeSlot;
  tut: TimeSlot | null;
  lab: TimeSlot | null;
};

type ScheduleCombination = {
  options: CourseOption[];
};

type Preference =
  | "most-days-off"
  | "most-time-on-campus"
  | "least-time-on-campus"
  | "mornings"
  | "midday"
  | "evenings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(".");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(".");
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1] || "0");
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function getDays(section: Section): string[] {
  const days: string[] = [];
  if (section.modays === "Y") days.push("Mon");
  if (section.tuesdays === "Y") days.push("Tue");
  if (section.wednesdays === "Y") days.push("Wed");
  if (section.thursdays === "Y") days.push("Thu");
  if (section.fridays === "Y") days.push("Fri");
  return days;
}

function timeFingerprint(section: Section): string {
  return `${section.modays}${section.tuesdays}${section.wednesdays}${section.thursdays}${section.fridays}-${section.classStartTime}-${section.classEndTime}`;
}

function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const sharedDays = a.days.filter((d) => b.days.includes(d));
  if (sharedDays.length === 0) return false;
  const aStart = parseTimeToMinutes(a.startTime);
  const aEnd = parseTimeToMinutes(a.endTime);
  const bStart = parseTimeToMinutes(b.startTime);
  const bEnd = parseTimeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

function getAllSlotsInOption(option: CourseOption): TimeSlot[] {
  return [option.lec, option.tut, option.lab].filter(
    (s): s is TimeSlot => s !== null
  );
}

function combinationHasConflict(combo: CourseOption[]): boolean {
  const allSlots: TimeSlot[] = combo.flatMap(getAllSlotsInOption);
  for (let i = 0; i < allSlots.length; i++) {
    for (let j = i + 1; j < allSlots.length; j++) {
      if (slotsOverlap(allSlots[i], allSlots[j])) return true;
    }
  }
  return false;
}

// Build time-deduplicated options for a course
function buildCourseOptions(
  subject: string,
  catalog: string,
  sections: Section[]
): CourseOption[] {
  const active = sections.filter(
    (s) => s.classStatus === "Active" && s.classStartTime !== ""
  );

  const lecs = active.filter((s) => s.componentCode === "LEC");
  const tuts = active.filter((s) => s.componentCode === "TUT");
  const labs = active.filter((s) => s.componentCode === "LAB");

  const options: CourseOption[] = [];

  // Deduplicate sections by time fingerprint within a group
  function dedupeByTime(sects: Section[]): TimeSlot[] {
    const map = new Map<string, Section[]>();
    for (const s of sects) {
      const fp = timeFingerprint(s);
      if (!map.has(fp)) map.set(fp, []);
      map.get(fp)!.push(s);
    }
    return Array.from(map.values()).map((group) => ({
      sections: group,
      days: getDays(group[0]),
      startTime: group[0].classStartTime,
      endTime: group[0].classEndTime,
      componentCode: group[0].componentCode,
      classAssociation: group[0].classAssociation,
    }));
  }

  for (const lec of lecs) {
    const assoc = lec.classAssociation;

    // TUTs must match association OR be 9999
    const matchingTuts = tuts.filter(
      (t) => t.classAssociation === assoc || t.classAssociation === "9999"
    );
    // LABs must match association OR be 9999
    const matchingLabs = labs.filter(
      (l) => l.classAssociation === assoc || l.classAssociation === "9999"
    );

    const lecSlot: TimeSlot = {
      sections: [lec],
      days: getDays(lec),
      startTime: lec.classStartTime,
      endTime: lec.classEndTime,
      componentCode: "LEC",
      classAssociation: assoc,
    };

    const tutSlots = dedupeByTime(matchingTuts);
    const labSlots = dedupeByTime(matchingLabs);

    // Generate all LEC × TUT × LAB combos for this association group
    const tutOptions = tutSlots.length > 0 ? tutSlots : [null];
    const labOptions = labSlots.length > 0 ? labSlots : [null];

    for (const tut of tutOptions) {
      for (const lab of labOptions) {
        // Check internal conflicts within this course option
        const slots = [lecSlot, tut, lab].filter(
          (s): s is TimeSlot => s !== null
        );
        let internalConflict = false;
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            if (slotsOverlap(slots[i], slots[j])) {
              internalConflict = true;
              break;
            }
          }
          if (internalConflict) break;
        }
        if (!internalConflict) {
          options.push({
            courseCode: `${subject} ${catalog}`,
            subject,
            catalog,
            lec: lecSlot,
            tut: tut,
            lab: lab,
          });
        }
      }
    }
  }

  // Deduplicate options by overall time fingerprint
  const seen = new Set<string>();
  return options.filter((opt) => {
    const fp = getAllSlotsInOption(opt)
      .map((s) => `${s.componentCode}-${s.startTime}-${s.endTime}-${s.days.join("")}`)
      .join("|");
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

// Generate all valid cross-course combinations
function generateCombinations(
  courseOptions: CourseOption[][]
): ScheduleCombination[] {
  if (courseOptions.length === 0) return [];

  let results: CourseOption[][] = [[]];

  for (const options of courseOptions) {
    const next: CourseOption[][] = [];
    for (const existing of results) {
      for (const option of options) {
        const candidate = [...existing, option];
        if (!combinationHasConflict(candidate)) {
          next.push(candidate);
        }
      }
    }
    results = next;
    // Safety cap to avoid browser freeze
    if (results.length > 5000) {
      results = results.slice(0, 5000);
      break;
    }
  }

  return results.map((opts) => ({ options: opts }));
}

// Score a combination by preference
function scoreCombo(
  combo: ScheduleCombination,
  preference: Preference
): number {
  const allSlots = combo.options.flatMap(getAllSlotsInOption);

  const uniqueDays = new Set(allSlots.flatMap((s) => s.days));
  const dayCount = uniqueDays.size;

  const avgStart =
    allSlots.reduce((sum, s) => sum + parseTimeToMinutes(s.startTime), 0) /
    allSlots.length;

  const avgEnd =
    allSlots.reduce((sum, s) => sum + parseTimeToMinutes(s.endTime), 0) /
    allSlots.length;

  // Per-day campus time (end of last class - start of first class)
  const daySlots = new Map<string, TimeSlot[]>();
  for (const slot of allSlots) {
    for (const day of slot.days) {
      if (!daySlots.has(day)) daySlots.set(day, []);
      daySlots.get(day)!.push(slot);
    }
  }
  let totalCampusTime = 0;
  for (const [, slots] of daySlots) {
    const starts = slots.map((s) => parseTimeToMinutes(s.startTime));
    const ends = slots.map((s) => parseTimeToMinutes(s.endTime));
    totalCampusTime +=
      Math.max(...ends) - Math.min(...starts);
  }

  switch (preference) {
    case "most-days-off":
      return -dayCount;
    case "most-time-on-campus":
      return totalCampusTime;
    case "least-time-on-campus":
      return -totalCampusTime;
    case "mornings":
      return -avgStart;
    case "midday":
      return -Math.abs(avgStart - 11 * 60);
    case "evenings":
      return avgStart;
  }
}

// ─── Calendar Component ───────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START_HOUR = 8;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

const COURSE_COLORS = [
  "bg-amaranth text-white",
  "bg-gunmetal text-white",
  "bg-teagreen text-gunmetal",
  "bg-dustgrey text-gunmetal",
  "bg-[#d4a373] text-white",
];

function WeeklyCalendar({ combo }: { combo: ScheduleCombination }) {
  const allSlots = combo.options.flatMap((opt, i) =>
    getAllSlotsInOption(opt).map((slot) => ({ slot, courseIndex: i }))
  );

  const timeLabels = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    timeLabels.push(
      h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`
    );
  }

  return (
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] mb-1">
        <div />
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-xs font-semibold text-gunmetal text-center py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] relative"
        style={{ height: "336px" }}
      >
        {/* Time labels column */}
        <div className="relative">
          {timeLabels.map((label, i) => (
            <div
              key={i}
              className="absolute right-1 text-[10px] text-gunmetal/40 leading-none"
              style={{
                top: `${(i / (END_HOUR - START_HOUR)) * 100}%`,
                transform: "translateY(-50%)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="relative border-l border-dustgrey/60"
          >
            {/* Hour lines */}
            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-dustgrey/30"
                style={{
                  top: `${((i + 1) / (END_HOUR - START_HOUR)) * 100}%`,
                }}
              />
            ))}

            {/* Course blocks */}
            {allSlots
              .filter(({ slot }) => slot.days.includes(day))
              .map(({ slot, courseIndex }, i) => {
                const startMin =
                  parseTimeToMinutes(slot.startTime) - START_HOUR * 60;
                const endMin =
                  parseTimeToMinutes(slot.endTime) - START_HOUR * 60;
                const top = (startMin / TOTAL_MINUTES) * 100;
                const height = ((endMin - startMin) / TOTAL_MINUTES) * 100;
                const colorClass =
                  COURSE_COLORS[courseIndex % COURSE_COLORS.length];

                return (
                  <div
                    key={i}
                    className={`absolute w-full rounded px-1 py-0.5 overflow-hidden ${colorClass}`}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                    }}
                  >
                    <div
                      className="font-bold leading-tight"
                      style={{ fontSize: "0.6rem" }}
                    >
                      {slot.sections[0].subject} {slot.sections[0].catalog}
                    </div>
                    <div
                      className="leading-tight opacity-80"
                      style={{ fontSize: "0.55rem" }}
                    >
                      {slot.componentCode}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { subject: string; catalog: string; title: string }[]
  >([]);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [combinations, setCombinations] = useState<ScheduleCombination[]>([]);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [preference, setPreference] = useState<Preference>("most-days-off");
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [programCourses, setProgramCourses] = useState<
    { subject: string; catalog: string; code: string }[]
  >([]);

  useEffect(() => {
    const stored = localStorage.getItem("studentProfile");
    if (!stored) {
      router.push("/onboarding");
      return;
    }
    setProfile(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    const program = programs.programs.find((p) => p.id === profile.programId);
    if (!program) return;
    const sequenceKey = profile.coop
      ? "coop"
      : profile.entry === "january"
      ? "january"
      : "september";
    const sequence =
      (program.sequences as Record<string, { year: number; term: string; courses: { code: string; isWorkTerm?: boolean }[] }[]>)[sequenceKey] ??
      (program.sequences as Record<string, { year: number; term: string; courses: { code: string; isWorkTerm?: boolean }[] }[]>)["september"];

    const seen = new Set<string>();
    const courses: { subject: string; catalog: string; code: string }[] = [];
    for (const term of sequence) {
      for (const course of term.courses) {
        if (course.isWorkTerm) continue;
        const parts = course.code.trim().split(" ");
        if (parts.length < 2) continue;
        const key = course.code;
        if (!seen.has(key)) {
          seen.add(key);
          courses.push({ subject: parts[0], catalog: parts[1], code: course.code });
        }
      }
    }
    setProgramCourses(courses);
  }, [profile]);

  useEffect(() => {
  async function fetchTerms() {
  const res = await fetch("/api/courses?type=sessions");
  const data: TermOption[] = await res.json();
  const seen = new Set<string>();
  const unique: TermOption[] = [];

  // Manually add upcoming terms that exist in raw data but not yet in sessions API
  const upcomingTerms: TermOption[] = [
    { termCode: "2264", termDescription: "Winter 2027" },
    { termCode: "2262", termDescription: "Fall 2026" },
    { termCode: "2261", termDescription: "Summer 2026" },
  ];

  for (const t of upcomingTerms) {
    seen.add(t.termCode);
    unique.push(t);
  }

  // Add API terms from Fall 2025 onwards
  for (const t of [...data].reverse()) {
    if (!seen.has(t.termCode) && parseInt(t.termCode) >= 2252) {
      seen.add(t.termCode);
      unique.push({
        termCode: t.termCode,
        termDescription: t.termDescription,
      });
    }
  }

  setTerms(unique);
  if (unique.length > 0) setSelectedTerm(unique[0].termCode);
}
    fetchTerms();
  }, []);

  // Search courses
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toUpperCase();
    const results = programCourses
      .filter(
        (c) =>
          c.code.includes(q) &&
          !selectedCourses.find(
            (s) => s.subject === c.subject && s.catalog === c.catalog
          )
      )
      .slice(0, 6);
    setSearchResults(
      results.map((r) => ({ subject: r.subject, catalog: r.catalog, title: r.code }))
    );
  }, [searchQuery, programCourses, selectedCourses]);

  async function addCourse(subject: string, catalog: string) {
    setSearchQuery("");
    setSearchResults([]);
    setGenerated(false);

    const newCourse: SelectedCourse = {
      subject,
      catalog,
      code: `${subject} ${catalog}`,
      title: "",
      sections: [],
      loading: true,
    };

    setSelectedCourses((prev) => [...prev, newCourse]);

    const res = await fetch(
      `/api/courses?type=schedule&subject=${subject}&catalog=${catalog}`
    );
    const allSections: Section[] = await res.json();
    const filtered = allSections.filter((s) => s.termCode === selectedTerm);
    const title = filtered[0]?.courseTitle || `${subject} ${catalog}`;

    setSelectedCourses((prev) =>
      prev.map((c) =>
        c.subject === subject && c.catalog === catalog
          ? { ...c, sections: filtered, title, loading: false }
          : c
      )
    );
  }

  function removeCourse(subject: string, catalog: string) {
    setSelectedCourses((prev) =>
      prev.filter((c) => !(c.subject === subject && c.catalog === catalog))
    );
    setGenerated(false);
  }

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const allOptions = selectedCourses.map((c) =>
        buildCourseOptions(c.subject, c.catalog, c.sections)
      );
      const combos = generateCombinations(allOptions);
      const sorted = [...combos].sort(
        (a, b) => scoreCombo(b, preference) - scoreCombo(a, preference)
      );
      setCombinations(sorted);
      setCurrentComboIndex(0);
      setGenerated(true);
      setGenerating(false);
    }, 50);
  }, [selectedCourses, preference]);

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linen">
        <p className="text-gunmetal">Loading...</p>
      </main>
    );
  }

  const currentCombo = combinations[currentComboIndex];

  return (
    <main className="min-h-screen bg-linen p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-amaranth">
              Schedule Builder
            </h1>
            <p className="text-sm text-gunmetal mt-0.5">
              Select courses and generate conflict-free schedules
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-gunmetal border border-dustgrey rounded-lg px-3 py-1.5 hover:border-amaranth hover:text-amaranth transition-colors cursor-pointer"
          >
            ← Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left panel: course selection */}
          <div className="flex flex-col gap-4">

            {/* Term selector */}
            <div className="bg-white rounded-2xl border border-dustgrey p-5">
              <h2 className="font-semibold text-gunmetal mb-3">Term</h2>
              <div className="flex flex-wrap gap-2">
                {terms.map((t) => (
                  <button
                    key={t.termCode}
                    onClick={() => {
                      setSelectedTerm(t.termCode);
                      setSelectedCourses([]);
                      setGenerated(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
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

            {/* Course search */}
            <div className="bg-white rounded-2xl border border-dustgrey p-5">
              <h2 className="font-semibold text-gunmetal mb-3">
                Add Courses
              </h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by course code (e.g. COMP 248)"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value.toUpperCase())
                  }
                  className="w-full border border-dustgrey rounded-xl px-4 py-2.5 text-sm text-gunmetal bg-linen focus:outline-none focus:border-amaranth"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-dustgrey rounded-xl shadow-md z-10 overflow-hidden">
                    {searchResults.map((r) => (
                      <button
                        key={`${r.subject}-${r.catalog}`}
                        onClick={() => addCourse(r.subject, r.catalog)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gunmetal hover:bg-linen transition-colors cursor-pointer"
                      >
                        <span className="font-medium text-amaranth">
                          {r.subject} {r.catalog}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected courses list */}
              <div className="flex flex-col gap-2 mt-3">
                {selectedCourses.map((c) => (
                  <div
                    key={`${c.subject}-${c.catalog}`}
                    className="flex items-center justify-between bg-linen border border-dustgrey rounded-xl px-4 py-2.5"
                  >
                    <div>
                      <span className="font-medium text-sm text-gunmetal">
                        {c.code}
                      </span>
                      {c.loading ? (
                        <span className="text-xs text-gunmetal/40 ml-2">
                          Loading sections...
                        </span>
                      ) : (
                        <span className="text-xs text-gunmetal/40 ml-2">
                          {c.title}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeCourse(c.subject, c.catalog)}
                      className="text-xs text-gunmetal/40 hover:text-amaranth transition-colors cursor-pointer ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-2xl border border-dustgrey p-5">
              <h2 className="font-semibold text-gunmetal mb-3">Preference</h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["most-days-off", "Most Days Off"],
                    ["least-time-on-campus", "Least Time On Campus"],
                    ["most-time-on-campus", "Most Time On Campus"],
                    ["mornings", "Mornings"],
                    ["midday", "Mid-day"],
                    ["evenings", "Evenings"],
                  ] as [Preference, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPreference(val)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      preference === val
                        ? "bg-gunmetal text-white border-gunmetal"
                        : "bg-linen text-gunmetal border-dustgrey hover:border-gunmetal"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={
                selectedCourses.length === 0 ||
                selectedCourses.some((c) => c.loading) ||
                generating
              }
              className="w-full bg-amaranth text-white font-semibold py-3 rounded-2xl hover:bg-gunmetal transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating
                ? "Generating..."
                : "Generate Schedules"}
            </button>
          </div>

          {/* Right panel: results */}
          <div className="flex flex-col gap-4">
            {!generated ? (
              <div className="bg-white rounded-2xl border border-dustgrey p-8 flex flex-col items-center justify-center text-center h-full min-h-64">
                <p className="text-gunmetal font-medium mb-1">
                  No schedules generated yet
                </p>
                <p className="text-sm text-gunmetal/40">
                  Add courses and click Generate Schedules
                </p>
              </div>
            ) : combinations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dustgrey p-8 flex flex-col items-center justify-center text-center h-full min-h-64">
                <p className="text-gunmetal font-medium mb-1">
                  No valid combinations found
                </p>
                <p className="text-sm text-gunmetal/40">
                  Try removing a course or selecting a different term
                </p>
              </div>
            ) : (
              <>
                {/* Result counter + navigation */}
                <div className="bg-white rounded-2xl border border-dustgrey p-4 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setCurrentComboIndex((i) => Math.max(0, i - 1))
                    }
                    disabled={currentComboIndex === 0}
                    className="px-3 py-1.5 rounded-xl border border-dustgrey text-sm text-gunmetal hover:border-amaranth transition-colors cursor-pointer disabled:opacity-30"
                  >
                    ←
                  </button>
                  <span className="text-sm font-medium text-gunmetal">
                    Result {currentComboIndex + 1} of {combinations.length}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentComboIndex((i) =>
                        Math.min(combinations.length - 1, i + 1)
                      )
                    }
                    disabled={currentComboIndex === combinations.length - 1}
                    className="px-3 py-1.5 rounded-xl border border-dustgrey text-sm text-gunmetal hover:border-amaranth transition-colors cursor-pointer disabled:opacity-30"
                  >
                    →
                  </button>
                </div>

                {/* Weekly calendar */}
                {currentCombo && (
                  <div className="bg-white rounded-2xl border border-dustgrey p-4">
                    <WeeklyCalendar combo={currentCombo} />
                  </div>
                )}

                {/* Section details */}
                {currentCombo && (
                  <div className="bg-white rounded-2xl border border-dustgrey p-5">
                    <h3 className="font-semibold text-gunmetal mb-3">
                      Selected Sections
                    </h3>
                    <div className="flex flex-col gap-3">
                      {currentCombo.options.map((opt, i) => (
                        <div key={i}>
                          <p className="text-xs font-bold text-amaranth mb-1">
                            {opt.courseCode}
                          </p>
                          {getAllSlotsInOption(opt).map((slot, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-2 text-xs text-gunmetal mb-1"
                            >
                              <span className="font-medium w-8">
                                {slot.componentCode}
                              </span>
                              <span>{slot.days.join(", ")}</span>
                              <span>
                                {formatTime(slot.startTime)} –{" "}
                                {formatTime(slot.endTime)}
                              </span>
                              <span className="text-gunmetal/40">
                                §{slot.sections[0].section}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
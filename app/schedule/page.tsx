"use client";

import { useEffect, useState} from "react";
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
  componentDescription: string;
  classNumber: string;
  classAssociation: string;
  courseTitle: string;
  classStatus: string;
  locationCode: string;
  instructionModeCode: string;
  instructionModeDescription: string;
  roomCode: string;
  buildingCode: string;
  room: string;
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
  waitlistCapacity: string;
  currentWaitlistTotal: string;
  hasSeatReserved: string;
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
  sections: Section[];
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [d, m, y] = dateStr.split("/");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
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

  const options: CourseOption[] = [];

  for (const lec of lecs) {
    const assoc = lec.classAssociation;
    const matchingTuts = tuts.filter(
      (t) => t.classAssociation === assoc || t.classAssociation === "9999"
    );
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
    const tutOptions = tutSlots.length > 0 ? tutSlots : [null];
    const labOptions = labSlots.length > 0 ? labSlots : [null];

    for (const tut of tutOptions) {
      for (const lab of labOptions) {
        const slots = [lecSlot, tut, lab].filter((s): s is TimeSlot => s !== null);
        let internalConflict = false;
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            if (slotsOverlap(slots[i], slots[j])) { internalConflict = true; break; }
          }
          if (internalConflict) break;
        }
        if (!internalConflict) {
          options.push({ courseCode: `${subject} ${catalog}`, subject, catalog, lec: lecSlot, tut, lab });
        }
      }
    }
  }

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

function generateCombinations(
  courseOptions: CourseOption[][],
  pinnedOptions: (CourseOption | null)[]
): ScheduleCombination[] {
  if (courseOptions.length === 0) return [];

  let results: CourseOption[][] = [[]];

  for (let i = 0; i < courseOptions.length; i++) {
    const pinned = pinnedOptions[i];
    const options = pinned ? [pinned] : courseOptions[i];
    const next: CourseOption[][] = [];
    for (const existing of results) {
      for (const option of options) {
        const candidate = [...existing, option];
        if (!combinationHasConflict(candidate)) next.push(candidate);
      }
    }
    results = next;
    if (results.length > 5000) { results = results.slice(0, 5000); break; }
  }

  return results.map((opts) => ({ options: opts }));
}

function scoreCombo(combo: ScheduleCombination, preference: Preference): number {
  const allSlots = combo.options.flatMap(getAllSlotsInOption);
  const uniqueDays = new Set(allSlots.flatMap((s) => s.days));
  const dayCount = uniqueDays.size;
  const avgStart = allSlots.reduce((sum, s) => sum + parseTimeToMinutes(s.startTime), 0) / allSlots.length;
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
    totalCampusTime += Math.max(...ends) - Math.min(...starts);
  }
  switch (preference) {
    case "most-days-off": return -dayCount;
    case "most-time-on-campus": return totalCampusTime;
    case "least-time-on-campus": return -totalCampusTime;
    case "mornings": return -avgStart;
    case "midday": return -Math.abs(avgStart - 11 * 60);
    case "evenings": return avgStart;
  }
}

// ─── Calendar ────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const COURSE_COLORS = [
  { bg: "bg-[#f4a9b0]", text: "text-gunmetal", border: "border-[#c0404f]" },
  { bg: "bg-[#a8d5e2]", text: "text-gunmetal", border: "border-[#3a8fa3]" },
  { bg: "bg-[#b5e2b5]", text: "text-gunmetal", border: "border-[#3a8a3a]" },
  { bg: "bg-[#f7d9a0]", text: "text-gunmetal", border: "border-[#c49020]" },
  { bg: "bg-[#d5b8e8]", text: "text-gunmetal", border: "border-[#7a3fa8]" },
];

function WeeklyCalendar({
  combo,
  pinnedCourses,
  onTogglePin,
}: {
  combo: ScheduleCombination;
  pinnedCourses: Set<string>;
  onTogglePin: (courseCode: string) => void;
}) {
  const START_HOUR = 8;
  const latestEnd = combo.options
    .flatMap(getAllSlotsInOption)
    .reduce((max, slot) => {
      const endH = Math.ceil(parseTimeToMinutes(slot.endTime) / 60);
      return Math.max(max, endH);
    }, 20);
  const END_HOUR = Math.max(latestEnd, 20); // minimum 8pm
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
    const allSlots = combo.options.flatMap((opt, i) =>
    getAllSlotsInOption(opt).map((slot) => ({ slot, courseIndex: i, courseCode: opt.courseCode }))
  );

  const timeLabels = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    timeLabels.push(h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`);
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] mb-1">
        <div />
        {DAYS.map((day) => (
          <div key={day} className="text-xs font-semibold text-gunmetal text-center py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] relative" style={{ height: "336px" }}>
        <div className="relative">
          {timeLabels.map((label, i) => (
            <div
              key={i}
              className="absolute right-1 text-[10px] text-gunmetal leading-none"
              style={{ top: `${(i / (END_HOUR - START_HOUR)) * 100}%`, transform: "translateY(-50%)" }}
            >
              {label}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="relative border-l border-dustgrey/60">
            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-dustgrey/30"
                style={{ top: `${((i + 1) / (END_HOUR - START_HOUR)) * 100}%` }}
              />
            ))}
            {allSlots
              .filter(({ slot }) => slot.days.includes(day))
              .map(({ slot, courseIndex, courseCode }, i) => {
                const startMin = parseTimeToMinutes(slot.startTime) - START_HOUR * 60;
                const endMin = parseTimeToMinutes(slot.endTime) - START_HOUR * 60;
                const top = (startMin / TOTAL_MINUTES) * 100;
                const height = ((endMin - startMin) / TOTAL_MINUTES) * 100;
                const color = COURSE_COLORS[courseIndex % COURSE_COLORS.length];
                const isPinned = pinnedCourses.has(courseCode);

                return (
                  <div
                    key={i}
                    onClick={() => onTogglePin(courseCode)}
                    className={`absolute w-full rounded-none px-1 py-0.5 overflow-hidden cursor-pointer border-2 transition-opacity text-center ${color.bg} ${color.text} ${isPinned ? color.border : "border-transparent"}`}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    title={isPinned ? "Click to unpin" : "Click to pin this configuration"}
                  >
                    <div className="font-bold leading-tight" style={{ fontSize: "0.6rem" }}>
                      {slot.sections[0].subject} {slot.sections[0].catalog}
                      {isPinned && " 📌"}
                    </div>
                    <div className="leading-tight opacity-80" style={{ fontSize: "0.55rem" }}>
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

// ─── Course Info Card ─────────────────────────────────────────────────────────

function CourseInfoCard({
  option,
  colorIndex,
  isPinned,
  onTogglePin,
}: {
  option: CourseOption;
  colorIndex: number;
  isPinned: boolean;
  onTogglePin: (courseCode: string) => void;
}) {
  const color = COURSE_COLORS[colorIndex % COURSE_COLORS.length];
  const slots = getAllSlotsInOption(option);
  const firstSection = slots[0]?.sections[0];
  const termDesc = firstSection
    ? `${formatDate(firstSection.classStartDate)} – ${formatDate(firstSection.classEndDate)}`
    : "";

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${isPinned ? color.border : "border-dustgrey"}`}>
      {/* Header */}
      <div className={`px-4 py-3 ${color.bg} ${color.text}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-sm">{option.courseCode}</span>
            <span className="text-xs ml-2 opacity-80">
              {slots[0]?.sections[0]?.courseTitle}
            </span>
          </div>
          <button
            onClick={() => onTogglePin(option.courseCode)}
            className="text-xs px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
            title={isPinned ? "Unpin" : "Pin this configuration"}
          >
            {isPinned ? "📌 Pinned" : "Pin"}
          </button>
        </div>
        {termDesc && (
          <p className="text-xs opacity-70 mt-0.5">{termDesc}</p>
        )}
      </div>

      {/* Section rows */}
      <div className="divide-y divide-dustgrey/50">
        {slots.map((slot, i) => {
          const s = slot.sections[0];
          const seatsLeft = parseInt(s.enrollmentCapacity) - parseInt(s.currentEnrollment);
          const isFull = seatsLeft <= 0;
          return (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5 ${color.bg} ${color.text}`}>
                {slot.componentCode}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gunmetal">
                    §{s.section}
                  </span>
                  <span className="text-xs text-gunmetal/60">
                    #{s.classNumber}
                  </span>
                  <span className={`text-xs font-medium ${isFull ? "text-red-500" : "text-green-600"}`}>
                    {seatsLeft} / {s.enrollmentCapacity} seats
                  </span>
                </div>
                <div className="text-xs text-gunmetal/60 mt-0.5">
                  {slot.days.join(", ")} · {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                </div>
                {s.roomCode && (
                  <div className="text-xs text-gunmetal/50 mt-0.5">
                    {s.instructionModeDescription} · Room {s.roomCode}
                  </div>
                )}
                {slot.sections.length > 1 && (
                  <div className="text-xs text-gunmetal/40 mt-0.5">
                    +{slot.sections.length - 1} similar section{slot.sections.length > 2 ? "s" : ""} available
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
  const [allCourseOptions, setAllCourseOptions] = useState<CourseOption[][]>([]);
  const [combinations, setCombinations] = useState<ScheduleCombination[]>([]);
  const [currentComboIndex, setCurrentComboIndex] = useState(0);
  const [preference, setPreference] = useState<Preference>("most-days-off");
  const [generated, setGenerated] = useState(false);
  const [pinnedCourses, setPinnedCourses] = useState<Record<string, CourseOption>>({});
  const [programCourses, setProgramCourses] = useState<
    { subject: string; catalog: string; code: string }[]
  >([]);

  useEffect(() => {
    const stored = localStorage.getItem("studentProfile");
    if (!stored) { router.push("/onboarding"); return; }
    setProfile(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    const program = programs.programs.find((p) => p.id === profile.programId);
    if (!program) return;
    const sequenceKey = profile.coop ? "coop" : profile.entry === "january" ? "january" : "september";
    const sequence = (program.sequences as Record<string, { year: number; term: string; courses: { code: string; isWorkTerm?: boolean }[] }[]>)[sequenceKey]
      ?? (program.sequences as Record<string, { year: number; term: string; courses: { code: string; isWorkTerm?: boolean }[] }[]>)["september"];
    const seen = new Set<string>();
    const courses: { subject: string; catalog: string; code: string }[] = [];
    for (const term of sequence) {
      for (const course of term.courses) {
        if (course.isWorkTerm) continue;
        const parts = course.code.trim().split(" ");
        if (parts.length < 2) continue;
        if (!seen.has(course.code)) {
          seen.add(course.code);
          courses.push({ subject: parts[0], catalog: parts[1], code: course.code });
        }
      }
    }
    setProgramCourses(courses);
  }, [profile]);

  useEffect(() => {
    async function fetchTerms() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  function makeTermCode(y: number, suffix: string): string {
    const s = y.toString();
    return `${s[0]}${s[2]}${s[3]}${suffix}`;
  }

  const upcoming: TermOption[] = [];

  if (month >= 1 && month <= 2) {
    // Jan–Feb: Winter just started (within 2 months), include it
    upcoming.push({ termCode: makeTermCode(year, "4"), termDescription: `Winter ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "1"), termDescription: `Summer ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "2"), termDescription: `Fall ${year}` });
  } else if (month >= 3 && month <= 4) {
    // Mar–Apr: Winter is over 2 months in, skip it
    upcoming.push({ termCode: makeTermCode(year, "1"), termDescription: `Summer ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "2"), termDescription: `Fall ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "4"), termDescription: `Winter ${year + 1}` });
  } else if (month >= 7 && month <= 8) {
    // Jul–Aug: Summer still ongoing (short sessions), keep showing it
    upcoming.push({ termCode: makeTermCode(year, "1"), termDescription: `Summer ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "2"), termDescription: `Fall ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "4"), termDescription: `Winter ${year + 1}` });
  } else if (month >= 9 && month <= 10) {
    // Sep–Oct: Fall just started, include it
    upcoming.push({ termCode: makeTermCode(year, "2"), termDescription: `Fall ${year}` });
    upcoming.push({ termCode: makeTermCode(year, "4"), termDescription: `Winter ${year + 1}` });
    upcoming.push({ termCode: makeTermCode(year + 1, "1"), termDescription: `Summer ${year + 1}` });
  } else {
    // Nov–Dec: Fall is over 2 months in, skip it
    upcoming.push({ termCode: makeTermCode(year, "4"), termDescription: `Winter ${year + 1}` });
    upcoming.push({ termCode: makeTermCode(year + 1, "1"), termDescription: `Summer ${year + 1}` });
    upcoming.push({ termCode: makeTermCode(year + 1, "2"), termDescription: `Fall ${year + 1}` });
  }

  setTerms(upcoming);
  setSelectedTerm(upcoming[0].termCode); // default to first/most current term
}
    fetchTerms();
  }, []);

useEffect(() => {
  if (!searchQuery.trim()) { setSearchResults([]); return; }
  const q = searchQuery.toUpperCase().trim();

  // First search program courses
  const programMatches = programCourses
    .filter((c) =>
      c.code.includes(q) &&
      !selectedCourses.find((s) => s.subject === c.subject && s.catalog === c.catalog)
    )
    .slice(0, 6)
    .map((r) => ({ subject: r.subject, catalog: r.catalog, title: r.code }));

  if (programMatches.length >= 3) {
    setSearchResults(programMatches);
    return;
  }

  // Fall back to full catalog search
  import("@/data/course_catalog.json").then((mod) => {
    const catalog = mod.default as Record<string, { title: string; subject: string; catalog: string }>;
    const catalogMatches = Object.entries(catalog)
      .filter(([code, course]) =>
        (code.includes(q) || course.title.toUpperCase().includes(q)) &&
        !selectedCourses.find((s) => s.subject === course.subject && s.catalog === course.catalog) &&
        !programCourses.find((p) => p.code === code)
      )
      .slice(0, 6 - programMatches.length)
      .map(([code, course]) => ({
        subject: course.subject,
        catalog: course.catalog,
        title: `${code} — ${course.title}`,
      }));

    setSearchResults([...programMatches, ...catalogMatches]);
  });
}, [searchQuery, programCourses, selectedCourses]);

  async function addCourse(subject: string, catalog: string) {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedCourses((prev) => [...prev, { subject, catalog, code: `${subject} ${catalog}`, title: "", sections: [], loading: true }]);
    const res = await fetch(`/api/courses?type=schedule&subject=${subject}&catalog=${catalog}&termCode=${selectedTerm}`);
    const filtered: Section[] = await res.json();
    const title = filtered[0]?.courseTitle || `${subject} ${catalog}`;
    setSelectedCourses((prev) => {
  const updated = prev.map((c) =>
    c.subject === subject && c.catalog === catalog
      ? { ...c, sections: filtered, title, loading: false }
      : c
  );
  // Auto-generate if all courses are loaded
  if (updated.every((c) => !c.loading) && updated.length > 0) {
    const options = updated.map((c) => buildCourseOptions(c.subject, c.catalog, c.sections));
    setAllCourseOptions(options);
    const pinnedArr = updated.map((c) => pinnedCourses[c.code] ?? null);
    const combos = generateCombinations(options, pinnedArr);
    const sorted = [...combos].sort((a, b) => scoreCombo(b, preference) - scoreCombo(a, preference));
    setCombinations(sorted);
    setCurrentComboIndex(0);
    setGenerated(true);
  }
  return updated;
});
  }

function removeCourse(subject: string, catalog: string) {
  const code = `${subject} ${catalog}`;
  setPinnedCourses((prev) => {
    const next = { ...prev };
    delete next[code];
    return next;
  });
  setSelectedCourses((prev) => {
    const updated = prev.filter((c) => !(c.subject === subject && c.catalog === catalog));
    if (updated.length === 0) {
      setGenerated(false);
      setCombinations([]);
    } else if (updated.every((c) => !c.loading)) {
      const options = updated.map((c) => buildCourseOptions(c.subject, c.catalog, c.sections));
      setAllCourseOptions(options);
      const pinnedArr = updated.map((c) => pinnedCourses[c.code] ?? null);
      const combos = generateCombinations(options, pinnedArr);
      const sorted = [...combos].sort((a, b) => scoreCombo(b, preference) - scoreCombo(a, preference));
      setCombinations(sorted);
      setCurrentComboIndex(0);
      setGenerated(true);
    }
    return updated;
  });
}

function togglePin(courseCode: string) {
  if (!generated) return;
  const currentCombo = combinations[currentComboIndex];
  if (!currentCombo) return;
  const option = currentCombo.options.find((o) => o.courseCode === courseCode);
  if (!option) return;

  setPinnedCourses((prev) => {
    const next = { ...prev };
    if (courseCode in next) {
      delete next[courseCode];
    } else {
      next[courseCode] = option;
    }
    return next;
  });
}

  // Re-generate when pins change
  useEffect(() => {
    if (!generated || allCourseOptions.length === 0) return;
    const pinnedArr = selectedCourses.map((c) => pinnedCourses[c.code] ?? null);
    const combos = generateCombinations(allCourseOptions, pinnedArr);
    const sorted = [...combos].sort((a, b) => scoreCombo(b, preference) - scoreCombo(a, preference));
    setCombinations(sorted);
    setCurrentComboIndex(0);
  }, [pinnedCourses]);  // eslint-disable-line react-hooks/exhaustive-deps

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
            <h1 className="text-2xl font-bold text-amaranth">Schedule Builder</h1>
            <p className="text-sm text-gunmetal mt-0.5">Select courses and generate conflict-free schedules</p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-gunmetal border border-dustgrey rounded-lg px-3 py-1.5 hover:border-amaranth hover:text-amaranth transition-colors cursor-pointer"
          >
            ← Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel */}
          <div className="flex flex-col gap-4">
            {/* Term selector */}
            <div className="bg-white rounded-2xl border border-dustgrey p-5">
              <h2 className="font-semibold text-gunmetal mb-3">Term</h2>
              <div className="flex flex-wrap gap-2">
                {terms.map((t) => (
                  <button
                    key={t.termCode}
                    onClick={() => { setSelectedTerm(t.termCode); setSelectedCourses([]); setGenerated(false); setPinnedCourses({}); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${selectedTerm === t.termCode ? "bg-amaranth text-white border-amaranth" : "bg-linen text-gunmetal border-dustgrey hover:border-amaranth"}`}
                  >
                    {t.termDescription}
                  </button>
                ))}
              </div>
            </div>

            {/* Course search */}
            <div className="bg-white rounded-2xl border border-dustgrey p-5">
              <h2 className="font-semibold text-gunmetal mb-3">Add Courses</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by course code (e.g. COMP 248)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
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
                        <span className="font-medium text-amaranth">{r.subject} {r.catalog}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 mt-3">
                {selectedCourses.map((c, i) => (
                  <div
                    key={`${c.subject}-${c.catalog}`}
                    className="flex items-center justify-between rounded-xl px-4 py-2.5 border"
                    style={{ borderColor: COURSE_COLORS[i % COURSE_COLORS.length].bg.replace("bg-", "") }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${COURSE_COLORS[i % COURSE_COLORS.length].bg}`} />
                      <span className="font-medium text-sm text-gunmetal">{c.code}</span>
                      {c.loading ? (
                        <span className="text-xs text-gunmetal/40">Loading...</span>
                      ) : (
                        <span className="text-xs text-gunmetal/40">{c.title}</span>
                      )}
                      {c.code in pinnedCourses && <span className="text-xs">📌</span>}
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
                    onClick={() => {
                      setPreference(val);
                      if (generated && combinations.length > 0) {
                        const sorted = [...combinations].sort((a, b) => scoreCombo(b, val) - scoreCombo(a, val));
                        setCombinations(sorted);
                        setCurrentComboIndex(0);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${preference === val ? "bg-gunmetal text-white border-gunmetal" : "bg-linen text-gunmetal border-dustgrey hover:border-gunmetal"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">
            {!generated ? (
              <div className="bg-white rounded-2xl border border-dustgrey p-8 flex flex-col items-center justify-center text-center min-h-64">
                <p className="text-gunmetal font-medium mb-1">No schedules generated yet</p>
                <p className="text-sm text-gunmetal/40">Add courses and click Generate Schedules</p>
              </div>
            ) : combinations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dustgrey p-8 flex flex-col items-center justify-center text-center min-h-64">
                <p className="text-gunmetal font-medium mb-1">No valid combinations found</p>
                <p className="text-sm text-gunmetal/40">Try removing a course or selecting a different term</p>
              </div>
            ) : (
              <>
                {/* Result counter */}
                <div className="bg-white rounded-2xl border border-dustgrey p-4 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentComboIndex((i) => Math.max(0, i - 1))}
                    disabled={currentComboIndex === 0}
                    className="px-3 py-1.5 rounded-xl border border-dustgrey text-sm text-gunmetal hover:border-amaranth transition-colors cursor-pointer disabled:opacity-30"
                  >
                    ←
                  </button>
                  <div className="text-center">
                    <span className="text-sm font-medium text-gunmetal">
                      Result {currentComboIndex + 1} of {combinations.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setCurrentComboIndex((i) => Math.min(combinations.length - 1, i + 1))}
                    disabled={currentComboIndex === combinations.length - 1}
                    className="px-3 py-1.5 rounded-xl border border-dustgrey text-sm text-gunmetal hover:border-amaranth transition-colors cursor-pointer disabled:opacity-30"
                  >
                    →
                  </button>
                </div>

                {/* Weekly calendar */}
                {currentCombo && (
                  <div className="bg-white rounded-2xl border border-dustgrey p-4">
                    <WeeklyCalendar
                      combo={currentCombo}
                      pinnedCourses={new Set(Object.keys(pinnedCourses))}
                      onTogglePin={togglePin}
                    />
                  </div>
                )}

                {/* Course info cards */}
                {currentCombo && (
                  <div className="flex flex-col gap-3">
                    {currentCombo.options.map((opt, i) => (
                      <CourseInfoCard
                        key={opt.courseCode}
                        option={opt}
                        colorIndex={i}
                        isPinned={opt.courseCode in pinnedCourses}
                        onTogglePin={togglePin}
                      />
                    ))}
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
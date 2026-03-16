"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import programs from "@/data/programs.json";

type StudentProfile = {
  programId: string;
  entry: string;
  coop: boolean;
};

type Course = {
  code: string;
  title: string;
  credits: number;
  prerequisites?: string[];
  corequisites?: string[];
  isWorkTerm?: boolean;
};

type TermBlock = {
  year: number;
  term: string;
  courses: Course[];
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sequence, setSequence] = useState<TermBlock[]>([]);
  const [programData, setProgramData] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("studentProfile");
    if (!stored) {
      router.push("/onboarding");
      return;
    }
    const p: StudentProfile = JSON.parse(stored);
    setProfile(p);

    const program = programs.programs.find((prog) => prog.id === p.programId);
    if (!program) return;
    setProgramData(program);

    const sequenceKey = p.coop
      ? "coop"
      : p.entry === "january"
      ? "january"
      : "september";

    const seq =
      (program.sequences as any)[sequenceKey] ||
      (program.sequences as any)["september"];
    setSequence(seq);
  }, [router]);

  if (!profile || !programData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linen">
        <p className="text-gunmetal">Loading...</p>
      </main>
    );
  }

  const totalRequired = programData.graduation_requirements.total_credits;
  const totalPlanned = sequence.reduce(
    (sum: number, term: TermBlock) =>
      sum + term.courses.reduce((s, c) => s + (c.credits || 0), 0),
    0
  );

  return (
    <main className="min-h-screen bg-linen p-6">
      {/* Top bar */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-amaranth">
              Concordia Scheduler
            </h1>
            <p className="text-sm text-gunmetal mt-0.5">
              {programData.name} &mdash;{" "}
              {profile.entry === "september" ? "September" : "January"} Entry
              {profile.coop ? " · Co-op" : ""}
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("studentProfile");
              router.push("/onboarding");
            }}
            className="text-xs text-gunmetal border border-dustgrey rounded-lg px-3 py-1.5 hover:border-amaranth hover:text-amaranth transition-colors cursor-pointer"
          >
            Change Program
          </button>
        </div>

        {/* Credits overview */}
        <div className="bg-white rounded-2xl border border-dustgrey p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gunmetal">Degree Progress</h2>
            <span className="text-sm text-gunmetal">
              {totalPlanned} / {totalRequired} core credits planned
            </span>
          </div>
          <div className="w-full bg-dustgrey rounded-full h-2.5">
            <div
              className="bg-amaranth h-2.5 rounded-full transition-all"
              style={{
                width: `${Math.min((totalPlanned / totalRequired) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {programData.graduation_requirements.categories.map((cat: any) => (
              <div
                key={cat.name}
                className="text-xs bg-linen border border-dustgrey rounded-lg px-3 py-1.5"
              >
                <span className="text-gunmetal font-medium">{cat.name}</span>
                <span className="text-gunmetal ml-1">· {cat.credits} cr</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <h2 className="font-semibold text-gunmetal mb-3">Suggested Sequence</h2>
        <div className="flex flex-col gap-4">
          {sequence.map((term: TermBlock, i: number) => {
            const termCredits = term.courses.reduce(
              (s, c) => s + (c.credits || 0),
              0
            );
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-dustgrey p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gunmetal">
                    Year {term.year} &mdash; {term.term}
                  </h3>
                  <span className="text-xs text-gunmetal bg-linen border border-dustgrey rounded-full px-2.5 py-1">
                    {termCredits} credits
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {term.courses.map((course, j) => (
                    <div
                      key={j}
                      className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                        course.isWorkTerm
                          ? "bg-teagreen border border-teagreen"
                          : "bg-linen border border-dustgrey"
                      }`}
                    >
                      <div>
                        <span className="font-medium text-sm text-gunmetal">
                          {course.code}
                        </span>
                        {!course.isWorkTerm && (
                          <span className="text-sm text-gunmetal ml-2">
                            {course.title}
                          </span>
                        )}
                      </div>
                      {!course.isWorkTerm && (
                        <span className="text-xs text-gunmetal ml-4 shrink-0">
                          {course.credits} cr
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
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

type CreditCategory = {
  name: string;
  credits: number;
};

type GraduationRequirements = {
  total_credits: number;
  categories: CreditCategory[];
  notes?: string[];
};

type Program = {
  id: string;
  degree: string;
  name: string;
  department: string;
  graduation_requirements: GraduationRequirements;
  sequences: Record<string, TermBlock[]>;
};

// Group sequence terms by year, then by term name
function groupByYear(sequence: TermBlock[]): Map<number, Map<string, TermBlock>> {
  const byYear = new Map<number, Map<string, TermBlock>>();
  for (const block of sequence) {
    if (!byYear.has(block.year)) byYear.set(block.year, new Map());
    byYear.get(block.year)!.set(block.term, block);
  }
  return byYear;
}

// Determine which term columns exist across all years
function getTermColumns(sequence: TermBlock[]): string[] {
  const seen = new Set<string>();
  const order = ["Fall", "Winter", "Summer"];
  for (const block of sequence) seen.add(block.term);
  return order.filter((t) => seen.has(t));
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("studentProfile");
    if (!stored) { router.push("/onboarding"); return; }
    setProfile(JSON.parse(stored));
  }, [router]);

  const programData = profile
    ? ((programs.programs.find((prog) => prog.id === profile.programId) as Program | undefined) ?? null)
    : null;

  const sequence: TermBlock[] = programData
    ? (programData.sequences[
        profile?.coop ? "coop" : profile?.entry === "january" ? "january" : "september"
      ] ?? programData.sequences["september"])
    : [];

  if (!profile || !programData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linen">
        <p className="text-gunmetal">Loading...</p>
      </main>
    );
  }

  const totalRequired = programData.graduation_requirements.total_credits;
  const totalPlanned = sequence.reduce(
    (sum, term) => sum + term.courses.reduce((s, c) => s + (c.credits || 0), 0),
    0
  );

  const byYear = groupByYear(sequence);
  const termColumns = getTermColumns(sequence);
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);

  // Running credit total per term
  const runningTotals = new Map<string, number>();
  let running = 0;
  for (const block of sequence) {
    running += block.courses.reduce((s, c) => s + (c.credits || 0), 0);
    runningTotals.set(`${block.year}-${block.term}`, running);
  }

  return (
    <main className="min-h-screen bg-linen p-6">
      <div className="max-w-5xl mx-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-amaranth">Concordia Scheduler</h1>
            <p className="text-sm text-gunmetal mt-0.5">
              {programData.name} &mdash;{" "}
              {profile.entry === "september" ? "September" : "January"} Entry
              {profile.coop ? " · Co-op" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/schedule")}
              className="text-xs text-white bg-amaranth rounded-lg px-3 py-1.5 hover:bg-gunmetal transition-colors cursor-pointer"
            >
              Schedule Builder →
            </button>
            <button
              onClick={() => { localStorage.removeItem("studentProfile"); router.push("/onboarding"); }}
              className="text-xs text-gunmetal border border-dustgrey rounded-lg px-3 py-1.5 hover:border-amaranth hover:text-amaranth transition-colors cursor-pointer"
            >
              Change Program
            </button>
          </div>
        </div>

        {/* Credits overview */}
        <div className="bg-white rounded-2xl border border-dustgrey p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gunmetal text-sm">Degree Progress</h2>
            <span className="text-xs text-gunmetal">
              {totalPlanned} / {totalRequired} core credits
            </span>
          </div>
          <div className="w-full bg-dustgrey rounded-full h-2 mb-3">
            <div
              className="bg-amaranth h-2 rounded-full transition-all"
              style={{ width: `${Math.min((totalPlanned / totalRequired) * 100, 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {programData.graduation_requirements.categories.map((cat) => (
              <div key={cat.name} className="text-xs bg-linen border border-dustgrey rounded-lg px-2 py-1">
                <span className="text-gunmetal font-medium">{cat.name}</span>
                <span className="text-gunmetal/60 ml-1">{cat.credits} cr</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline grid */}
        <div className="bg-white rounded-2xl border border-dustgrey overflow-hidden">
          {/* Header row */}
          <div
            className="grid border-b border-dustgrey"
            style={{ gridTemplateColumns: `80px repeat(${termColumns.length}, 1fr)` }}
          >
            <div className="p-3 text-xs font-semibold text-gunmetal/40 border-r border-dustgrey" />
            {termColumns.map((term) => (
              <div key={term} className="p-3 text-xs font-semibold text-gunmetal text-center border-r border-dustgrey last:border-r-0">
                {term}
              </div>
            ))}
          </div>

          {/* Year rows */}
          {years.map((year, yi) => {
            const termMap = byYear.get(year)!;
            return (
              <div
                key={year}
                className={`grid border-b border-dustgrey last:border-b-0 ${yi % 2 === 0 ? "bg-white" : "bg-linen/40"}`}
                style={{ gridTemplateColumns: `80px repeat(${termColumns.length}, 1fr)` }}
              >
                {/* Year label */}
                <div className="p-3 border-r border-dustgrey flex items-start justify-center">
                  <span className="text-xs font-bold text-gunmetal">Year {year}</span>
                </div>

                {/* Term cells */}
                {termColumns.map((term) => {
                  const block = termMap.get(term);
                  const runningTotal = block ? runningTotals.get(`${year}-${term}`) : null;

                  return (
                    <div key={term} className="p-2 border-r border-dustgrey last:border-r-0 min-h-[80px]">
                      {block ? (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-gunmetal/40">
                              {block.courses.reduce((s, c) => s + (c.credits || 0), 0)} cr
                            </span>
                            <span className="text-[10px] text-amaranth font-medium">
                              {runningTotal} / {totalRequired}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {block.courses.map((course, j) => (
                              <div
                                key={j}
                                className={`text-[11px] px-1.5 py-0.5 rounded flex items-center justify-between gap-1 ${
                                  course.isWorkTerm
                                    ? "bg-teagreen text-gunmetal font-medium"
                                    : "bg-linen text-gunmetal"
                                }`}
                              >
                                <span className="font-medium truncate">{course.code}</span>
                                {!course.isWorkTerm && (
                                  <span className="text-gunmetal/40 shrink-0">{course.credits}cr</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <span className="text-[10px] text-gunmetal/20">—</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
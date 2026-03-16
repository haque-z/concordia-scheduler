"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import programs from "@/data/programs.json";

type Step = "program" | "entry" | "coop";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("program");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedEntry, setSelectedEntry] = useState("");

  function handleProgramSelect(programId: string) {
    setSelectedProgram(programId);
    setStep("entry");
  }

  function handleEntrySelect(entry: string) {
    setSelectedEntry(entry);
    setStep("coop");
  }

  function handleCoopSelect(coop: string) {
    const profile = {
      programId: selectedProgram,
      entry: selectedEntry,
      coop: coop === "yes",
    };
    localStorage.setItem("studentProfile", JSON.stringify(profile));
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-md p-8">

        {/* Header */}
        <h1 className="text-2xl font-bold text-[#912338] mb-1">
          Concordia Scheduler
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Let&apos;s set up your profile so we can personalize your experience.
        </p>

        {/* Step: Program */}
        {step === "program" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">
              What program are you in?
            </h2>
            <div className="flex flex-col gap-3">
              {programs.programs.map((program) => (
                <button
                  key={program.id}
                  onClick={() => handleProgramSelect(program.id)}
                  className="text-left border border-dustgrey rounded-xl px-4 py-3 hover:border-amaranth hover:bg-linen transition-colors group cursor-pointer"
                >
                  <span className="font-medium">{program.name}</span>
                  <span className="text-sm text-gray-400 ml-2">
                    {program.degree}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Entry */}
        {step === "entry" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">
              When did you (or will you) start?
            </h2>
            <div className="flex flex-col gap-3">
              {["september", "january"].map((entry) => (
                <button
                  key={entry}
                  onClick={() => handleEntrySelect(entry)}
                  className="text-left border border-dustgrey rounded-xl px-4 py-3 hover:border-amaranth hover:bg-linen transition-colors group cursor-pointer"
                >
                  {entry === "september" ? "September Entry" : "January Entry"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Co-op */}
        {step === "coop" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">
              Are you in the co-op program?
            </h2>
            <div className="flex flex-col gap-3">
              {[
                { value: "yes", label: "Yes, I'm in co-op" },
                { value: "no", label: "No, regular program" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleCoopSelect(option.value)}
                  className="text-left border border-dustgrey rounded-xl px-4 py-3 hover:border-amaranth hover:bg-linen transition-colors group cursor-pointer"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Back button */}
        {step !== "program" && (
          <button
            onClick={() =>
              setStep(step === "coop" ? "entry" : "program")
            }
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
        )}
      </div>
    </main>
  );
}
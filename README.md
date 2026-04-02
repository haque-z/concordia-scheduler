# Concordia Scheduler

A full-stack degree planning and course scheduling web application built for Concordia University Computer Science and Software Engineering students.

## Overview

Concordia Scheduler helps students plan their degree and build their semester schedules in an easier way. It combines real institutional data — course catalogs, live section availability, and official program sequences — into a single tool that replaces juggling the VSB, the undergraduate calendar, and a spreadsheet at the same time.

## Features

### Degree Timeline Dashboard
- Visual grid layout matching Concordia's course sequence form (years as rows, Fall/Winter/Summer as columns)
- Course history tracking: mark courses as Completed, In Progress, or Planned
- Completed credits tracked separately from planned, with a stacked progress bar
- Add electives taken outside your program sequence to any term
- All data stored locally in the browser — no account required

### Schedule Builder
- Search any of 4,326 undergraduate courses, not just CS/SOEN
- Select a term (Summer 2026, Fall 2026, Winter 2027) and add courses
- Automatically generates all valid schedule combinations with conflict detection
- Pin a preferred section for any course and re-generate around it
- Sort results by: Most Days Off, Least/Most Time on Campus, Mornings, Mid-day, Evenings
- Weekly calendar view with seat availability, room, and instruction mode per section

### Program-Aware Onboarding
- Supports 5 programs: BCompSc General, BCompSc Data Science, BCompSc Health & Life Sciences, BCompSc Computation Arts, BEng Software Engineering
- September and January entry sequences
- Co-op and non co-op variants

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Data:** Concordia Open Data API + preprocessed CSV exports
- **Storage:** localStorage (privacy-first)

## Data Sources

| File | Source |
|------|--------|
| `course_catalog.json` | Concordia Open Data CSV export — 4,326 UGRD courses with prerequisites |
| `upcoming_schedules.json` | Concordia Open Data CSV export — 14,379 sections across 126 subjects for Summer 2026 through Winter 2027 |
| `electives/comp.json` | Concordia Registrar — 2,264 eligible general electives for CS students |
| `programs.json` | Manually compiled from the Concordia Undergraduate Calendar |

## Getting Started

### Prerequisites
- Node.js 18+
- Concordia Open Data API credentials ([request here](https://opendata.concordia.ca))

### Installation

```bash
git clone https://github.com/haque-z/concordia-scheduler
cd concordia-scheduler
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```
CONCORDIA_API_USER=your_username
CONCORDIA_API_KEY=your_api_key
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roadmap

The long-term goal is to make Concordia Scheduler work seamlessly for all undergraduate Concordia students, regardless of faculty or program. This means expanding beyond CS and SOEN to support programs across Arts & Science, John Molson School of Business, Fine Arts, and Engineering — each with their own program sequences, electives lists, and degree requirements.
## Notes

- Schedule data for upcoming terms (2026–2027) is served from local JSON files rather than the API, since the API does not yet expose future terms. The API is used as a fallback for older terms.
- The app stores all student data (profile, course history) in `localStorage`. Nothing is sent to a server.
- General electives validation is specific to Computer Science programs. SOEN and other programs would require their own electives list.
import { readFileSync } from "fs";
import path from "path";

type ScheduleSection = {
  subject: string;
  catalog: string;
  termCode: string;
  [key: string]: string;
};

let upcomingCache: ScheduleSection[] | null = null;

function getUpcomingSchedules(): ScheduleSection[] {
  if (!upcomingCache) {
    const filePath = path.join(process.cwd(), "data", "upcoming_schedules.json");
    upcomingCache = JSON.parse(readFileSync(filePath, "utf-8"));
  }
  return upcomingCache!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") || "*";
  const catalog = searchParams.get("catalog") || "*";
  const type = searchParams.get("type") || "catalog";
  const termCode = searchParams.get("termCode") || "*";

  const user = process.env.CONCORDIA_API_USER;
  const key = process.env.CONCORDIA_API_KEY;
  const credentials = btoa(`${user}:${key}`);

  if (type === "sessions") {
    const url = `https://opendata.concordia.ca/API/v1/course/session/filter/UGRD/${termCode}/*`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const data = await response.json();
    return Response.json(data);
  }

  if (type === "catalog") {
    const url = `https://opendata.concordia.ca/API/v1/course/catalog/filter/${subject}/${catalog}/*`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const data = await response.json();
    return Response.json(data);
  }

  if (type === "schedule") {
    const newerTerms = new Set(["2261", "2262", "2263", "2264"]);

    // For newer terms, use local data only
    if (termCode !== "*" && newerTerms.has(termCode)) {
      const local = getUpcomingSchedules().filter(
        (s) =>
          s.termCode === termCode &&
          (subject === "*" || s.subject === subject) &&
          (catalog === "*" || s.catalog === catalog)
      );
      return Response.json(local);
    }

    // For current/older terms, use API
    const url = `https://opendata.concordia.ca/API/v1/course/schedule/filter/*/${subject}/${catalog}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const data = await response.json();
    const filtered = Array.isArray(data)
      ? data.filter((s: { termCode: string }) =>
          termCode === "*" || s.termCode === termCode
        )
      : [];
    return Response.json(filtered);
  }

  return Response.json([]);
}
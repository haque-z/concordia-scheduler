import upcomingSchedules from "@/data/upcoming_schedules.json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject") || "*";
  const catalog = searchParams.get("catalog") || "*";
  const type = searchParams.get("type") || "catalog";
  const termCode = searchParams.get("termCode") || "*";

  const user = process.env.CONCORDIA_API_USER;
  const key = process.env.CONCORDIA_API_KEY;
  const credentials = btoa(`${user}:${key}`);

  let url = "";

  if (type === "schedule") {
    url = `https://opendata.concordia.ca/API/v1/course/schedule/filter/*/${subject}/${catalog}`;
  } else if (type === "sessions") {
    url = `https://opendata.concordia.ca/API/v1/course/session/filter/UGRD/${termCode}/*`;
  } else {
    url = `https://opendata.concordia.ca/API/v1/course/catalog/filter/${subject}/${catalog}/*`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  const data = await response.json();

  if (type === "schedule") {
    const apiResults = Array.isArray(data) ? data : [];
    const newerTerms = new Set(["2261", "2262", "2264"]);

    // Filter API results to requested term if specified
    const filteredApi = termCode !== "*"
      ? apiResults.filter((s: { termCode: string }) => s.termCode === termCode)
      : apiResults;

    // Check if we need to supplement with local data
    if (termCode !== "*" && newerTerms.has(termCode)) {
      const localResults = (upcomingSchedules as { subject: string; catalog: string; termCode: string }[]).filter(
        (s) =>
          (subject === "*" || s.subject === subject) &&
          (catalog === "*" || s.catalog === catalog) &&
          s.termCode === termCode
      );
      return Response.json(localResults);
    }

    return Response.json(filteredApi);
  }

  return Response.json(data);
}
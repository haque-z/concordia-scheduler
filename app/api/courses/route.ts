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

  // For schedule requests, supplement with local CSV data for newer terms
  if (type === "schedule") {
    const apiResults = Array.isArray(data) ? data : [];

    // Check if any newer term data is missing from API response
    const newerTerms = new Set(["2261", "2262", "2264"]);
    const hasNewerTermData = apiResults.some((s: { termCode: string }) =>
      newerTerms.has(s.termCode)
    );

    if (!hasNewerTermData) {
      const localResults = (upcomingSchedules as { subject: string; catalog: string }[]).filter(
        (s) =>
          (subject === "*" || s.subject === subject) &&
          (catalog === "*" || s.catalog === catalog)
      );
      return Response.json([...apiResults, ...localResults]);
    }

    return Response.json(apiResults);
  }

  return Response.json(data);
}
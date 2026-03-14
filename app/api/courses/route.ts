export async function GET() {
  const user = process.env.CONCORDIA_API_USER;
  const key = process.env.CONCORDIA_API_KEY;
  const credentials = btoa(`${user}:${key}`);

  const response = await fetch(
    "https://opendata.concordia.ca/API/v1/course/catalog/filter/*/*/*",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  const data = await response.json();

  return Response.json(data);
}
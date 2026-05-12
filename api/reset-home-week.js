const HOME_DB_ID = "dd7ba18f385d407c977d1eb47f0671f2";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getLondonToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;

  return new Date(`${year}-${month}-${day}T12:00:00`);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);

  d.setDate(diff);
  d.setHours(12, 0, 0, 0);

  return d;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDayName(page) {
  const props = page.properties || {};

  return (
    props["Day of Week"]?.select?.name ||
    props["Day"]?.title?.[0]?.plain_text ||
    ""
  );
}

async function notionRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || text || "Notion request failed");
  }

  return data;
}

module.exports = async function handler(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({
        ok: false,
        stage: "env",
        error: "Missing NOTION_TOKEN in Vercel environment variables.",
      });
    }

    const today = getLondonToday();
    const monday = getMonday(today);

    const queryData = await notionRequest(
      `https://api.notion.com/v1/databases/${HOME_DB_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    );

    const pages = queryData.results || [];
    const updates = [];

    for (const dayName of DAY_ORDER) {
      const index = DAY_ORDER.indexOf(dayName);
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);

      const matchingPage = pages.find((page) => getDayName(page) === dayName);

      if (!matchingPage) {
        updates.push({
          day: dayName,
          status: "missing",
        });
        continue;
      }

      try {
        await notionRequest(`https://api.notion.com/v1/pages/${matchingPage.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              Day: {
                title: [
                  {
                    type: "text",
                    text: {
                      content: dayName,
                    },
                  },
                ],
              },
              "Day of Week": {
                select: {
                  name: dayName,
                },
              },
              Date: {
                date: {
                  start: toIsoDate(date),
                },
              },
              Status: {
                status: {
                  name: "Not started",
                },
              },
            },
          }),
        });

        updates.push({
          day: dayName,
          date: toIsoDate(date),
          status: "updated",
        });
      } catch (error) {
        updates.push({
          day: dayName,
          date: toIsoDate(date),
          status: "failed",
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      weekStarting: toIsoDate(monday),
      updates,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      stage: "reset-home-week",
      error: error.message || "Home week reset failed",
    });
  }
};

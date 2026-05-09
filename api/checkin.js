const DAILY_CHECKINS_DATABASE_ID = "d4bf74d2f4b649e788f20ee26758802a";

function textProperty(value) {
  return {
    rich_text: value
      ? [{ text: { content: String(value).slice(0, 1900) } }]
      : [],
  };
}

function checkboxProperty(value) {
  return { checkbox: !!value };
}

function numberProperty(value) {
  const number =
    value === "" || value === null || value === undefined ? null : Number(value);

  return { number: Number.isFinite(number) ? number : null };
}

function selectProperty(value) {
  return value ? { select: { name: String(value) } } : { select: null };
}

async function notionRequest(url, options, headers) {
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Notion returned non-JSON response: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Notion request failed with status ${response.status}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: "Missing NOTION_TOKEN in Vercel" });
  }

  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  try {
    const body = req.body || {};
    const date = body.date;

    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }

    const title = `Daily Check-in — ${date}`;

    const properties = {
      Name: {
        title: [{ text: { content: title } }],
      },
      Date: {
        date: { start: date },
      },
      "Main Focus": textProperty(body.mainFocus),
      "Next Right Step": textProperty(body.nextRightStep),
      Energy: numberProperty(body.energy),
      Mood: selectProperty(body.mood),
      Water: checkboxProperty(body.water),
      Breakfast: checkboxProperty(body.breakfast),
      Lunch: checkboxProperty(body.lunch),
      Dinner: checkboxProperty(body.dinner),
      Movement: checkboxProperty(body.movement),
      "15 Minutes Alone": checkboxProperty(body.aloneTime),
      "Nervous System Reset": checkboxProperty(body.nervousSystemReset),
      "One Me Thing": textProperty(body.oneMeThing),
      "One Home Thing": textProperty(body.oneHomeThing),
      "One Work Thing": textProperty(body.oneWorkThing),
      "Open Loops": textProperty(body.openLoops),
      "What Worked": textProperty(body.whatWorked),
      "What Felt Heavy": textProperty(body.whatFeltHeavy),
      "Carry Forward": textProperty(body.carryForward),
      "Evening Notes": textProperty(body.eveningNotes),
    };

    const existing = await notionRequest(
      `https://api.notion.com/v1/databases/${DAILY_CHECKINS_DATABASE_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          filter: {
            property: "Date",
            date: { equals: date },
          },
          page_size: 1,
        }),
      },
      headers
    );

    if (existing.results && existing.results.length > 0) {
      const pageId = existing.results[0].id;

      const updated = await notionRequest(
        `https://api.notion.com/v1/pages/${pageId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        },
        headers
      );

      return res.status(200).json({
        ok: true,
        mode: "updated",
        pageId: updated.id,
      });
    }

    const created = await notionRequest(
      "https://api.notion.com/v1/pages",
      {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: DAILY_CHECKINS_DATABASE_ID },
          properties,
        }),
      },
      headers
    );

    return res.status(200).json({
      ok: true,
      mode: "created",
      pageId: created.id,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Check-in save failed",
      details: error.message || String(error),
    });
  }
}

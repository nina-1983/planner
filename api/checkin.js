const CHECKIN_DB_ID = process.env.NOTION_CHECKIN_DB_ID;

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

function richText(value) {
  return {
    rich_text: value
      ? [
          {
            type: "text",
            text: {
              content: String(value).slice(0, 1900),
            },
          },
        ]
      : [],
  };
}

function titleText(value) {
  return {
    title: [
      {
        type: "text",
        text: {
          content: String(value || "Daily Check-in").slice(0, 1900),
        },
      },
    ],
  };
}

function checkbox(value) {
  return {
    checkbox: Boolean(value),
  };
}

function dateProp(value) {
  return {
    date: value ? { start: value } : null,
  };
}

function numberProp(value) {
  const number = Number(value);
  return {
    number: Number.isFinite(number) ? number : null,
  };
}

function selectProp(value) {
  return {
    select: value ? { name: String(value) } : null,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "Check-in API is live. Use Save Check-in from the planner.",
      });
    }

    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Missing NOTION_TOKEN in Vercel environment variables.",
      });
    }

    if (!CHECKIN_DB_ID) {
      return res.status(500).json({
        ok: false,
        error: "Missing NOTION_CHECKIN_DB_ID in Vercel environment variables.",
      });
    }

    const body = req.body || {};
    const date = body.date || new Date().toISOString().slice(0, 10);

    const properties = {
      Name: titleText(`Check-in — ${date}`),
      Date: dateProp(date),

      Mood: selectProp(body.mood),
      Energy: numberProp(body.energy),

      Water: checkbox(body.water),
      Breakfast: checkbox(body.breakfast),
      Lunch: checkbox(body.lunch),
      Dinner: checkbox(body.dinner),
      Movement: checkbox(body.movement),
      "Alone Time": checkbox(body.aloneTime),
      "Nervous System Reset": checkbox(body.nervousSystemReset),

      "Main Focus": richText(body.mainFocus),
      "Next Right Step": richText(body.nextRightStep),
      "One Me Thing": richText(body.oneMeThing),
      "One Home Thing": richText(body.oneHomeThing),
      "One Work Thing": richText(body.oneWorkThing),
      "Open Loops": richText(body.openLoops),
      "What Worked": richText(body.whatWorked),
      "What Felt Heavy": richText(body.whatFeltHeavy),
      "Carry Forward": richText(body.carryForward),
      "Evening Notes": richText(body.eveningNotes),
    };

    const data = await notionRequest("https://api.notion.com/v1/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: {
          database_id: CHECKIN_DB_ID,
        },
        properties,
      }),
    });

    return res.status(200).json({
      ok: true,
      id: data.id,
      url: data.url,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Check-in save failed",
    });
  }
};

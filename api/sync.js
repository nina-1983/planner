export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

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
    // ✅ TASKS
    const tasksResponse = await fetch(
      "https://api.notion.com/v1/databases/31bc1adacbe7802dac64dc95609a9496/query",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sorts: [{ property: "Due Date", direction: "ascending" }],
        }),
      }
    );

    const tasksData = await tasksResponse.json();

    if (!tasksResponse.ok) {
      return res.status(tasksResponse.status).json({
        error: "My Tasks failed",
        details: tasksData,
      });
    }

    const weekTasks = (tasksData.results || []).map((page) => ({
      name: page.properties.Name?.title?.[0]?.plain_text || "Untitled",
      priority: page.properties.Priority?.select?.name || "No priority",
      dueDate: page.properties["Due Date"]?.date?.start || "",
      status: page.properties.Status?.status?.name || "",
    }));

    // ✅ CLIENTS (FILTERED)
    const clientsResponse = await fetch(
      "https://api.notion.com/v1/databases/323c1adacbe780648916df44ef5a8465/query",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          filter: {
            or: [
              {
                property: "This Week Focus",
                rich_text: { is_not_empty: true },
              },
              {
                property: "Next Step",
                rich_text: { is_not_empty: true },
              },
            ],
          },
        }),
      }
    );

    const clientsData = await clientsResponse.json();

    if (!clientsResponse.ok) {
      return res.status(clientsResponse.status).json({
        error: "Client board failed",
        details: clientsData,
      });
    }

    const clientFocus = (clientsData.results || []).map((page) => ({
      client: page.properties.Clients?.title?.[0]?.plain_text || "Unknown",
      focus:
        page.properties["This Week Focus"]?.rich_text?.[0]?.plain_text || "",
      nextStep:
        page.properties["Next Step"]?.rich_text?.[0]?.plain_text || "",
    }));

    // ✅ HOME
    const today = new Date().toISOString().split("T")[0];

    const homeResponse = await fetch(
      "https://api.notion.com/v1/databases/dd7ba18f385d407c977d1eb47f0671f2/query",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          filter: {
            property: "Date",
            date: { equals: today },
          },
        }),
      }
    );

    const homeData = await homeResponse.json();

    if (!homeResponse.ok) {
      return res.status(homeResponse.status).json({
        error: "Home board failed",
        details: homeData,
      });
    }

    const homeToday = homeData.results?.[0]
      ? {
          mealPlan:
            homeData.results[0].properties["Meal Plan"]?.rich_text?.[0]
              ?.plain_text || "",
          movement:
            homeData.results[0].properties.Movement?.select?.name || "",
          energyNote:
            homeData.results[0].properties["Energy Note"]?.select?.name || "",
          dailyBasics:
            homeData.results[0].properties["Daily Basics"]?.multi_select?.map(
              (s) => s.name
            ) || [],
          homeAnchors:
            homeData.results[0].properties["Home Anchor"]?.multi_select?.map(
              (s) => s.name
            ) || [],
        }
      : {};

    return res.status(200).json({
      weekTasks,
      clientFocus,
      homeToday,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server crash",
      details: error.message,
    });
  }
}

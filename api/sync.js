const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
const CLIENT_FOCUS_DB_ID =
  process.env.NOTION_CLIENT_FOCUS_DB_ID || "323c1adacbe780648916df44ef5a8465";
const HOME_DB_ID =
  process.env.NOTION_HOME_DB_ID || "dd7ba18f385d407c977d1eb47f0671f2";

function getUKDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getWeekRange() {
  const today = new Date();
  const ukTodayString = getUKDateKey(today);
  const ukToday = new Date(`${ukTodayString}T12:00:00`);

  const day = ukToday.getDay();
  const diffToMonday = ukToday.getDate() - day + (day === 0 ? -6 : 1);

  const monday = new Date(ukToday);
  monday.setDate(diffToMonday);
  monday.setHours(12, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(12, 0, 0, 0);

  return {
    today: getUKDateKey(ukToday),
    monday: getUKDateKey(monday),
    sunday: getUKDateKey(sunday),
  };
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

async function queryDatabase(databaseId, payload = {}) {
  return notionRequest(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getTitle(property) {
  return property?.title?.map((item) => item.plain_text).join("") || "";
}

function getRichText(property) {
  return property?.rich_text?.map((item) => item.plain_text).join("") || "";
}

function getSelect(property) {
  return property?.select?.name || "";
}

function getStatus(property) {
  return property?.status?.name || "";
}

function getMultiSelect(property) {
  return property?.multi_select?.map((item) => item.name) || [];
}

function getDate(property) {
  return property?.date?.start || "";
}

module.exports = async function handler(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) {
      return res.status(500).json({
        error: "Missing NOTION_TOKEN",
      });
    }

    const { today, monday, sunday } = getWeekRange();

    let weekTasks = [];
    let clientFocus = [];
    let homeToday = {};

    if (TASKS_DB_ID) {
      const tasksResponse = await queryDatabase(TASKS_DB_ID, {
        page_size: 100,
        filter: {
          and: [
            {
              property: "Due Date",
              date: {
                on_or_after: monday,
              },
            },
            {
              property: "Due Date",
              date: {
                on_or_before: sunday,
              },
            },
          ],
        },
      });

      weekTasks = (tasksResponse.results || []).map((page) => {
        const props = page.properties || {};

        return {
          id: page.id,
          name:
            getTitle(props.Name) ||
            getTitle(props.Task) ||
            getTitle(props["Task Name"]) ||
            "Untitled task",
          priority:
            getSelect(props.Priority) ||
            getSelect(props["Priority Level"]) ||
            "",
          dueDate:
            getDate(props["Due Date"]) ||
            getDate(props.Date) ||
            "",
          status:
            getStatus(props.Status) ||
            getSelect(props.Status) ||
            "",
        };
      });
    }

    if (CLIENT_FOCUS_DB_ID) {
      const clientResponse = await queryDatabase(CLIENT_FOCUS_DB_ID, {
        page_size: 100,
        filter: {
          property: "Status",
          select: {
            equals: "Focus This Week",
          },
        },
      });

      clientFocus = (clientResponse.results || []).map((page) => {
        const props = page.properties || {};

        return {
          id: page.id,
          client:
            getTitle(props.Clients) ||
            getTitle(props.Client) ||
            getTitle(props.Name) ||
            "Client",
          focus:
            getRichText(props["This Week Focus"]) ||
            getRichText(props.Focus) ||
            getRichText(props["Weekly Focus"]) ||
            "",
          nextStep:
            getRichText(props["Next Step"]) ||
            getRichText(props["Next Action"]) ||
            "",
          waitingOn: getRichText(props["Waiting On"]) || "",
          priority: getSelect(props.Priority) || "",
          status: getSelect(props.Status) || "",
        };
      });
    }

    if (HOME_DB_ID) {
      const homeResponse = await queryDatabase(HOME_DB_ID, {
        page_size: 20,
        filter: {
          property: "Date",
          date: {
            equals: today,
          },
        },
      });

      const homePage = homeResponse.results?.[0];

      if (homePage) {
        const props = homePage.properties || {};

        homeToday = {
          id: homePage.id,
          day:
            getTitle(props.Day) ||
            getSelect(props["Day of Week"]) ||
            "",
          date: getDate(props.Date),
          briefSummary: getRichText(props["Brief Summary"]),
          alfieToday: getRichText(props["Alfie Today"]),
          kitNeeded: getRichText(props["Kit Needed"]),
          prepNeeded: getRichText(props["Prep Needed"]),
          mealPlan: getRichText(props["Meal Plan"]),
          movement: getSelect(props.Movement),
          oneKindThing: getRichText(props["One Kind Thing"]),
          dailyBasics: getMultiSelect(props["Daily Basics"]),
          homeAnchors: getMultiSelect(props["Home Anchor"]),
          steamHit: getSelect(props["Steam Hit"]),
          resetNeeded: props["Reset Needed"]?.checkbox || false,
          willyAway: props["Willy Away"]?.checkbox || false,
          priorityLevel: getSelect(props["Priority Level"]),
          status: getStatus(props.Status),
        };
      }
    }

    return res.status(200).json({
      weekTasks,
      clientFocus,
      homeToday,
      meta: {
        today,
        monday,
        sunday,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Notion sync failed",
    });
  }
};

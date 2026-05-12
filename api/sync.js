const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
const CLIENT_FOCUS_DB_ID = process.env.NOTION_CLIENT_FOCUS_DB_ID;
const HOME_DB_ID = process.env.NOTION_HOME_DB_ID || "dd7ba18f385d407c977d1eb47f0671f2";

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

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    today: getUKDateKey(ukToday),
    monday: getUKDateKey(monday),
    sunday: getUKDateKey(sunday),
  };
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
      const tasksResponse = await notion.databases.query({
        database_id: TASKS_DB_ID,
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

      weekTasks = tasksResponse.results.map((page) => {
        const props = page.properties;

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
      const clientResponse = await notion.databases.query({
        database_id: CLIENT_FOCUS_DB_ID,
        page_size: 100,
      });

      clientFocus = clientResponse.results.map((page) => {
        const props = page.properties;

        return {
          client:
            getTitle(props.Client) ||
            getTitle(props.Name) ||
            getTitle(props["Client Name"]) ||
            "Client",
          focus:
            getRichText(props.Focus) ||
            getRichText(props["Weekly Focus"]) ||
            "",
          nextStep:
            getRichText(props["Next Step"]) ||
            getRichText(props["Next Action"]) ||
            "",
        };
      });
    }

    if (HOME_DB_ID) {
      const homeResponse = await notion.databases.query({
        database_id: HOME_DB_ID,
        page_size: 20,
        filter: {
          property: "Date",
          date: {
            equals: today,
          },
        },
      });

      const homePage = homeResponse.results[0];

      if (homePage) {
        const props = homePage.properties;

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
    console.error("Sync failed:", error);

    return res.status(500).json({
      error: error.message || "Notion sync failed",
    });
  }
};

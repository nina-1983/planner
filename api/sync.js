export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
  try {
    // Fetch My Tasks
    const tasksResponse = await fetch('https://api.notion.com/v1/databases/31bc1adacbe7802dac64dc95609a9496/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          or: [
            { property: 'Status', status: { does_not_equal: 'Done' } },
            { property: 'Status', status: { does_not_equal: 'Cancelled' } },
          ],
        },
        sorts: [{ property: 'Due Date', direction: 'ascending' }],
      }),
    });
    const tasksData = await tasksResponse.json();
    const weekTasks = (tasksData.results || []).map(page => ({
      name: page.properties.Name?.title?.[0]?.plain_text || 'Untitled',
      priority: page.properties.Priority?.select?.name || 'No priority',
      dueDate: page.properties['Due Date']?.date?.start || 'No date',
      status: page.properties.Status?.status?.name || 'Not started',
    }));
    // Fetch Client Work Board (Focus This Week)
    const clientsResponse = await fetch('https://api.notion.com/v1/databases/323c1adacbe780648916df44ef5a8465/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Status',
          select: { equals: 'Focus This Week' },
        },
      }),
    });
    const clientsData = await clientsResponse.json();
    const clientFocus = (clientsData.results || []).map(page => ({
      client: page.properties.Clients?.title?.[0]?.plain_text || 'Unknown',
      focus: page.properties['This Week Focus']?.rich_text?.[0]?.plain_text || '',
      nextStep: page.properties['Next Step']?.rich_text?.[0]?.plain_text || '',
    }));
    // Fetch Daily Home Board (Today's entry)
    const today = new Date().toISOString().split('T')[0];
    const homeResponse = await fetch('https://api.notion.com/v1/databases/dd7ba18f385d407c977d1eb47f0671f2/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Date',
          date: { equals: today },
        },
      }),
    });
    const homeData = await homeResponse.json();
    const homeToday = homeData.results?.[0]
      ? {
          mealPlan: homeData.results[0].properties['Meal Plan']?.rich_text?.[0]?.plain_text || '',
          movement: homeData.results[0].properties.Movement?.select?.name || '',
          energyNote: homeData.results[0].properties['Energy Note']?.select?.name || '',
          dailyBasics: homeData.results[0].properties['Daily Basics']?.multi_select?.map(s => s.name) || [],
          homeAnchors: homeData.results[0].properties['Home Anchor']?.multi_select?.map(s => s.name) || [],
        }
      : {};
    res.status(200).json({
      weekTasks,
      clientFocus,
      homeToday,
    });
  } catch (error) {
    console.error('Notion sync error:', error);
    res.status(500).json({ error: 'Failed to sync Notion data', details: error.message });
  }
}

// Vercel serverless function — Google Calendar iCal 프록시 (CORS 우회)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const year = Number(req.query?.year ?? new Date().getFullYear());

  try {
    const icalUrl =
      'https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics';
    const response = await fetch(icalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error(`iCal fetch failed: ${response.status}`);
    const text = await response.text();

    const holidays = [];
    const blocks = text.split('BEGIN:VEVENT').slice(1);
    for (const block of blocks) {
      const dateMatch = block.match(/DTSTART[^:\r\n]*:(\d{8})/);
      const nameMatch = block.match(/SUMMARY:([^\r\n]+)/);
      if (!dateMatch || !nameMatch) continue;
      const d = dateMatch[1];
      if (parseInt(d.slice(0, 4)) !== year) continue;
      holidays.push({
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        name: nameMatch[1].trim().replace(/\\,/g, ','),
      });
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json({ year, holidays });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

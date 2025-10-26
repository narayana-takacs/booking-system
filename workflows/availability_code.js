// Calculate available 50-minute time slots with 10-minute breaks
const config = items[0].json.config || {};
const airtableToken = config.airtablePat || process.env.AIRTABLE_PAT;
const baseId = config.airtableBaseId || process.env.AIRTABLE_BASE_ID;
const availabilityTable = config.airtableAvailabilityTable || process.env.AIRTABLE_TABLE_AVAILABILITY;
const bookingsTable = config.airtableBookingsTable || process.env.AIRTABLE_TABLE_BOOKINGS;

if (!airtableToken || !baseId || !availabilityTable || !bookingsTable) {
  throw new Error('Incomplete Airtable configuration in environment variables.');
}

const headers = {
  Authorization: `Bearer ${airtableToken}`,
};

const fetchAll = async (table, params = {}) => {
  let offset;
  const records = [];
  do {
    const queryParams = { pageSize: '100', ...params };
    if (offset) queryParams.offset = offset;
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${queryString}`,
      headers,
      json: true,
    });
    records.push(...(response.records || []));
    offset = response.offset;
  } while (offset);
  return records;
};

// Fetch availability windows
const availabilityRecords = await fetchAll(availabilityTable);

// Fetch existing bookings (accepted only)
const bookingsRecords = await fetchAll(bookingsTable, {
  filterByFormula: "{Status}='Accepted'",
});

// Constants
const SESSION_DURATION_MS = 50 * 60 * 1000; // 50 minutes
const BREAK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const TOTAL_SLOT_MS = SESSION_DURATION_MS + BREAK_DURATION_MS; // 60 minutes total

// Get date range (next 30 days)
const now = new Date();
const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

// Generate all possible slots from availability windows
const allSlots = [];

availabilityRecords.forEach(record => {
  const startRaw = record.fields?.Start;
  const endRaw = record.fields?.End;

  if (!startRaw || !endRaw) return;

  const windowStart = new Date(startRaw);
  const windowEnd = new Date(endRaw);

  // Only include future windows within date range
  if (windowEnd <= now || windowStart >= endDate) return;

  // Generate 50-minute slots within this window
  let slotStart = new Date(Math.max(windowStart.getTime(), now.getTime()));

  // Round up to next hour for clean scheduling
  slotStart.setMinutes(0, 0, 0);
  if (slotStart < now) {
    slotStart = new Date(slotStart.getTime() + 60 * 60 * 1000);
  }

  while (slotStart.getTime() + SESSION_DURATION_MS <= windowEnd.getTime()) {
    const slotEnd = new Date(slotStart.getTime() + SESSION_DURATION_MS);

    // Check if slot overlaps with existing bookings
    const isBooked = bookingsRecords.some(booking => {
      const bookingStart = new Date(booking.fields?.Start);
      const bookingEnd = new Date(booking.fields?.End);

      // Check for overlap
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });

    if (!isBooked) {
      allSlots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        startLocal: slotStart.toLocaleString('en-AU', {
          timeZone: 'Australia/Sydney',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
      });
    }

    // Move to next slot (50 min session + 10 min break)
    slotStart = new Date(slotStart.getTime() + TOTAL_SLOT_MS);
  }
});

// Sort slots by start time
allSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

return [{
  json: {
    slots: allSlots,
    count: allSlots.length,
  }
}];

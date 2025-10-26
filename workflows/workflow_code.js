const body = (items[0].json.body ?? items[0].json) || {};
const config = items[0].json.config || {};
const requiredFields = ['name', 'email', 'bookingReason', 'requestedStart', 'requestedEnd'];
const missing = requiredFields.filter((field) => !body[field] || String(body[field]).trim() === '');
if (missing.length) {
  return [{ json: { status: 'error', message: `Missing fields: ${missing.join(', ')}` }, pairedItem: { item: 0 } }];
}
const toISO = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
};
const slotStart = toISO(body.requestedStart);
const slotEnd = toISO(body.requestedEnd);
if (slotEnd <= slotStart) {
  return [{ json: { status: 'error', message: 'requestedEnd must be after requestedStart' }, pairedItem: { item: 0 } }];
}
const envValue = (config.airtableUseStub ?? process.env.AIRTABLE_USE_STUB ?? '').toString().trim().toLowerCase();
const useStub = envValue === 'true';
const airtableToken = config.airtablePat || process.env.AIRTABLE_PAT;
const baseId = config.airtableBaseId || process.env.AIRTABLE_BASE_ID;
const availabilityTable = config.airtableAvailabilityTable || process.env.AIRTABLE_TABLE_AVAILABILITY;
const bookingsTable = config.airtableBookingsTable || process.env.AIRTABLE_TABLE_BOOKINGS;
const clientsTable = config.airtableClientsTable || process.env.AIRTABLE_TABLE_CLIENTS;
if (!useStub && (!airtableToken || !baseId || !availabilityTable || !bookingsTable || !clientsTable)) {
  const debug = {
    useStub,
    envValue,
    airtableTokenPresent: Boolean(airtableToken),
    baseIdPresent: Boolean(baseId),
    availabilityTable,
    bookingsTable,
    clientsTable,
  };
  throw new Error('Incomplete Airtable configuration in environment variables. Set AIRTABLE_USE_STUB=true for local testing. Debug: ' + JSON.stringify(debug));
}
const safeQuote = (value) => String(value).replace(/'/g, "''");
let clientRecord;
let clientStatusRaw = 'unknown';
let availabilityRecords = [];
let bookingsRecords = [];
let createBookingRecord;
if (useStub) {
  const stubStatus = (body.stubClientStatus || 'Active').toLowerCase();
  clientStatusRaw = stubStatus;
  clientRecord = {
    id: 'stub-client',
    fields: {
      Status: stubStatus.charAt(0).toUpperCase() + stubStatus.slice(1),
    },
  };
  availabilityRecords = [
    {
      fields: {
        Start: body.stubAvailabilityStart || slotStart.toISOString(),
        End: body.stubAvailabilityEnd || slotEnd.toISOString(),
      },
    },
  ];
  bookingsRecords = (body.stubExistingBookings || []).map((booking, index) => ({
    id: `stub-booking-${index}`,
    fields: {
      Status: booking.status || 'Accepted',
      Start: booking.start,
      End: booking.end,
    },
  }));
  createBookingRecord = async (fields) => ({ id: `stub-booking-${Date.now()}`, fields });
} else {
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
  const createRecord = async (table, fields) => {
    return this.helpers.httpRequest({
      method: 'POST',
      url: `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
      headers,
      body: { fields },
      json: true,
    });
  };
  const emailLower = body.email.trim().toLowerCase();
  const clientRecords = await fetchAll(clientsTable, {
    filterByFormula: `LOWER({Email})='${safeQuote(emailLower)}'`,
  });
  clientRecord = clientRecords[0];
  if (!clientRecord) {
    const newClientFields = {
      Name: body.name,
      Email: body.email,
      Status: 'Unknown',
      'Latest Reason': body.bookingReason,
    };
    const created = await createRecord(clientsTable, newClientFields);
    clientRecord = { id: created.id, fields: newClientFields };
  }
  clientStatusRaw = (clientRecord.fields?.Status || 'Unknown').toLowerCase();
  availabilityRecords = await fetchAll(availabilityTable);
  bookingsRecords = await fetchAll(bookingsTable, {
    filterByFormula: "NOT({Status}='Cancelled')",
  });
  createBookingRecord = async (fields) => createRecord(bookingsTable, fields);
}
clientStatusRaw = clientStatusRaw || 'unknown';
const findMatchingAvailability = availabilityRecords.find((record) => {
  const startRaw = record.fields?.Start;
  const endRaw = record.fields?.End;
  if (!startRaw || !endRaw) return false;
  const availStart = new Date(startRaw);
  const availEnd = new Date(endRaw);
  return availStart <= slotStart && availEnd >= slotEnd;
});
const acceptedBookings = bookingsRecords.filter((record) => (record.fields?.Status || '').toLowerCase() === 'accepted');
const overlapsExisting = acceptedBookings.some((record) => {
  const startRaw = record.fields?.Start;
  const endRaw = record.fields?.End;
  if (!startRaw || !endRaw) return false;
  const existingStart = new Date(startRaw);
  const existingEnd = new Date(endRaw);
  return slotStart < existingEnd && slotEnd > existingStart;
});
let status = 'pending';
let message = 'Request submitted and awaiting provider review.';
const availabilityMatched = Boolean(findMatchingAvailability);
let bookingResult = null;
const fieldsBase = {
  'Client Name': body.name,
  Email: body.email,
  Start: slotStart.toISOString(),
  End: slotEnd.toISOString(),
  'Booking Reason': body.bookingReason,
  'Client Status': clientStatusRaw.charAt(0).toUpperCase() + clientStatusRaw.slice(1),
  Source: 'Squarespace',
};
if (!availabilityMatched) {
  status = 'unavailable';
  message = 'Requested slot does not fall within available working hours.';
} else if (overlapsExisting) {
  status = 'unavailable';
  message = 'Requested slot is no longer available. Please select another time.';
} else if (clientStatusRaw === 'active') {
  status = 'accepted';
  message = 'Booking confirmed.';
  bookingResult = await createBookingRecord({
    ...fieldsBase,
    Status: 'Accepted',
    'Decision Timestamp': new Date().toISOString(),
  });
} else {
  status = 'pending';
  message = 'Request submitted and awaiting provider review.';
  bookingResult = await createBookingRecord({
    ...fieldsBase,
    Status: 'Pending Review',
  });
}
const response = {
  status,
  message,
  clientStatus: clientStatusRaw,
  slot: { start: slotStart.toISOString(), end: slotEnd.toISOString() },
  availabilityMatched,
  overlapsExisting,
  airtable: {
    clientRecordId: clientRecord?.id || null,
    bookingRecordId: bookingResult?.id || null,
  },
  client: { name: body.name, email: body.email },
  bookingReason: body.bookingReason,
};
if (status === 'accepted') {
  const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const summary = `Session with ${body.name}`;
  const uid = `${(bookingResult?.id || Date.now())}@booking-assistant`;
  const description = `Reason: ${body.bookingReason}`.replace(/\n/g, '\\n');
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Booking Assistant//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${formatICSDate(new Date())}\nDTSTART:${formatICSDate(slotStart)}\nDTEND:${formatICSDate(slotEnd)}\nSUMMARY:${summary}\nDESCRIPTION:${description}\nEND:VEVENT\nEND:VCALENDAR`;
  response.clientEmail = {
    to: body.email,
    subject: 'Booking confirmed',
    text: `Hi ${body.name},\n\nYour session is confirmed from ${slotStart.toISOString()} to ${slotEnd.toISOString()}.\n\nReason: ${body.bookingReason}\n\nYou can add the attached calendar invite to your preferred calendar.\n\nRegards,\nProvider`,
  };
  response.providerEmail = {
    to: config.providerAlertEmail || process.env.PROVIDER_ALERT_EMAIL || 'provider@example.com',
    subject: 'New confirmed booking',
    text: `Client: ${body.name}\nEmail: ${body.email}\nStart: ${slotStart.toISOString()}\nEnd: ${slotEnd.toISOString()}\nReason: ${body.bookingReason}\nStatus: Accepted`,
  };
  return [{
    json: response,
    binary: {
      ics: {
        data: Buffer.from(ics, 'utf8').toString('base64'),
        mimeType: 'text/calendar; charset=utf-8',
        fileName: 'booking.ics',
      },
    },
  }];
}
if (status === 'pending') {
  response.providerEmail = {
    to: config.providerAlertEmail || process.env.PROVIDER_ALERT_EMAIL || 'provider@example.com',
    subject: 'Booking request pending review',
    text: `Client: ${body.name}\nEmail: ${body.email}\nStart: ${slotStart.toISOString()}\nEnd: ${slotEnd.toISOString()}\nReason: ${body.bookingReason}\nStatus: Pending Review`,
  };
}
return [{ json: response }];

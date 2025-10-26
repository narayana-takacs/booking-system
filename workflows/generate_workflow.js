const fs = require('fs');
const code = fs.readFileSync('workflows/workflow_code.js', 'utf8');
const workflow = {
  name: 'Squarespace Booking Automation',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'booking-request',
        responseMode: 'lastNode',
        options: {
          responseContentType: 'application/json',
        },
      },
      name: 'Receive Booking Request',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [-900, 0],
      webhookId: 'bookingRequest',
    },
    {
      parameters: {
        keepOnlySet: false,
        values: {
          string: [
            { name: 'config.airtableUseStub', value: "={{$env[\"AIRTABLE_USE_STUB\"]}}" },
            { name: 'config.airtablePat', value: "={{$env[\"AIRTABLE_PAT\"]}}" },
            { name: 'config.airtableBaseId', value: "={{$env[\"AIRTABLE_BASE_ID\"]}}" },
            { name: 'config.airtableAvailabilityTable', value: "={{$env[\"AIRTABLE_TABLE_AVAILABILITY\"]}}" },
            { name: 'config.airtableBookingsTable', value: "={{$env[\"AIRTABLE_TABLE_BOOKINGS\"]}}" },
            { name: 'config.airtableClientsTable', value: "={{$env[\"AIRTABLE_TABLE_CLIENTS\"]}}" },
            { name: 'config.providerAlertEmail', value: "={{$env[\"PROVIDER_ALERT_EMAIL\"]}}" },
          ],
        },
      },
      name: 'Load Configuration',
      type: 'n8n-nodes-base.set',
      typeVersion: 2,
      position: [-740, 0],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javascript',
        jsCode: code,
      },
      name: 'Process Booking',
      type: 'n8n-nodes-base.code',
      typeVersion: 1,
      position: [-520, 0],
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{$json}}',
        options: {
          responseContentType: 'application/json',
        },
      },
      name: 'Respond to Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [-320, 0],
    },
  ],
  connections: {
    'Receive Booking Request': {
      main: [[{ node: 'Load Configuration', type: 'main', index: 0 }]],
    },
    'Load Configuration': {
      main: [[{ node: 'Process Booking', type: 'main', index: 0 }]],
    },
    'Process Booking': {
      main: [
        [{ node: 'Respond to Webhook', type: 'main', index: 0 }],
      ],
    },
  },
  settings: {
    executionOrder: 'v1',
    timezone: 'Etc/UTC',
  },
  pinData: {},
  active: false,
};
fs.writeFileSync('workflows/booking_airtable.json', JSON.stringify(workflow, null, 2));

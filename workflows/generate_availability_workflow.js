const fs = require('fs');
const code = fs.readFileSync('workflows/availability_code.js', 'utf8');

const workflow = {
  name: 'Get Available Slots',
  nodes: [
    {
      parameters: {
        httpMethod: 'GET',
        path: 'get-availability',
        responseMode: 'lastNode',
        options: {
          responseContentType: 'application/json',
        },
      },
      name: 'Receive Request',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [-800, 0],
      webhookId: 'getAvailability',
    },
    {
      parameters: {
        keepOnlySet: false,
        values: {
          string: [
            { name: 'config.airtablePat', value: "={{$env[\"AIRTABLE_PAT\"]}}" },
            { name: 'config.airtableBaseId', value: "={{$env[\"AIRTABLE_BASE_ID\"]}}" },
            { name: 'config.airtableAvailabilityTable', value: "={{$env[\"AIRTABLE_TABLE_AVAILABILITY\"]}}" },
            { name: 'config.airtableBookingsTable', value: "={{$env[\"AIRTABLE_TABLE_BOOKINGS\"]}}" },
          ],
        },
      },
      name: 'Load Configuration',
      type: 'n8n-nodes-base.set',
      typeVersion: 2,
      position: [-600, 0],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javascript',
        jsCode: code,
      },
      name: 'Calculate Available Slots',
      type: 'n8n-nodes-base.code',
      typeVersion: 1,
      position: [-400, 0],
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{$json}}',
        options: {
          responseContentType: 'application/json',
        },
      },
      name: 'Respond with Slots',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [-200, 0],
    },
  ],
  connections: {
    'Receive Request': {
      main: [[{ node: 'Load Configuration', type: 'main', index: 0 }]],
    },
    'Load Configuration': {
      main: [[{ node: 'Calculate Available Slots', type: 'main', index: 0 }]],
    },
    'Calculate Available Slots': {
      main: [[{ node: 'Respond with Slots', type: 'main', index: 0 }]],
    },
  },
  settings: {
    executionOrder: 'v1',
    timezone: 'Etc/UTC',
  },
  pinData: {},
  active: false,
};

fs.writeFileSync('workflows/get_availability.json', JSON.stringify(workflow, null, 2));
console.log('Generated workflows/get_availability.json');

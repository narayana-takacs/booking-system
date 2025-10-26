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
        conditions: {
          options: {
            caseSensitive: false,
          },
          string: [
            {
              value1: '={{$json.status}}',
              operation: 'equal',
              value2: 'accepted',
            },
          ],
        },
      },
      name: 'Is Accepted',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [-300, -160],
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: false,
          },
          string: [
            {
              value1: '={{$json.status}}',
              operation: 'equal',
              value2: 'pending',
            },
          ],
        },
      },
      name: 'Needs Review',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [-300, 160],
    },
    {
      parameters: {
        fromEmail: 'no-reply@booking.local',
        toEmail: '={{$json.clientEmail.to}}',
        subject: '={{$json.clientEmail.subject}}',
        text: '={{$json.clientEmail.text}}',
        smtpApi: 'smtp',
        smtpHost: '={{$env["SMTP_HOST"]}}',
        smtpPort: '={{$env["SMTP_PORT"]}}',
        smtpSsl: false,
        attachments: [
          {
            binaryPropertyName: 'ics',
          },
        ],
      },
      name: 'Send Client Confirmation',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2,
      position: [-60, -200],
    },
    {
      parameters: {
        fromEmail: 'no-reply@booking.local',
        toEmail: '={{$json.providerEmail.to}}',
        subject: '={{$json.providerEmail.subject}}',
        text: '={{$json.providerEmail.text}}',
        smtpApi: 'smtp',
        smtpHost: '={{$env["SMTP_HOST"]}}',
        smtpPort: '={{$env["SMTP_PORT"]}}',
        smtpSsl: false,
      },
      name: 'Send Provider Alert',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2,
      position: [-60, 200],
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
        [{ node: 'Is Accepted', type: 'main', index: 0 }],
        [{ node: 'Needs Review', type: 'main', index: 0 }],
      ],
    },
    'Is Accepted': {
      main: [[{ node: 'Send Client Confirmation', type: 'main', index: 0 }]],
    },
    'Needs Review': {
      main: [[{ node: 'Send Provider Alert', type: 'main', index: 0 }]],
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

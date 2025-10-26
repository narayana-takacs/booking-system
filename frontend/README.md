# Booking Form Frontend

This is a sample booking form that demonstrates how to integrate with the n8n booking automation webhook.

## Features

### User Interface
- **Clean, modern design** with gradient background and card layout
- **Responsive** - works on desktop, tablet, and mobile
- **Real-time validation** with visual feedback
- **Auto-calculated end time** - defaults to 30 minutes after start time
- **Timezone handling** - automatically converts local time to UTC
- **Loading states** - shows spinner during submission
- **Success/error messages** - clear feedback for all scenarios

### Form Fields

1. **Full Name** (required) - Client's name
2. **Email Address** (required) - Client's email for confirmation
3. **Reason for Booking** (required) - Multi-line text explaining the session purpose
4. **Start Time** (required) - Session start date/time (local timezone)
5. **End Time** (required) - Session end date/time (auto-populated)

### Booking Flow

```
User fills form → JavaScript validates → POST to webhook → Response handled
```

#### Response Scenarios

1. **Accepted** (status: "accepted")
   - Green success message
   - Shows confirmed booking time
   - Mentions email confirmation with .ics attachment
   - Form resets

2. **Pending Review** (status: "pending")
   - Yellow warning message
   - Explains manual review is required
   - Form resets

3. **Unavailable** (status: "unavailable")
   - Red error message
   - Shows why slot was rejected (out of hours or overlap)
   - Form stays filled for correction

4. **Error** (status: "error")
   - Red error message
   - Shows error details
   - Form stays filled

## Usage

### Local Testing

1. Ensure n8n is running:
   ```bash
   docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
   ```

2. Open `booking-form.html` in your browser

3. The form is pre-configured to connect to `http://localhost:5678/webhook/booking-request`

### Squarespace Integration

To embed in Squarespace:

1. **Create a new page** or edit existing page

2. **Add a Code Block**:
   - Click (+) to add a block
   - Choose "Code" from the menu
   - Paste the HTML from `booking-form.html`

3. **Update the webhook URL** (line 186):
   ```javascript
   const WEBHOOK_URL = 'https://your-production-domain.com/webhook/booking-request';
   ```

4. **Optional: Extract CSS to Site-Wide Styles**:
   - Copy the `<style>` section to Design > Custom CSS
   - Remove the `<style>` tags from the Code Block

5. **Optional: Extract JavaScript to Footer**:
   - Copy the `<script>` section to Settings > Advanced > Code Injection > Footer
   - Remove the `<script>` tags from the Code Block
   - This improves page load performance

### Production Configuration

Update these settings for production:

```javascript
// Change webhook URL to production
const WEBHOOK_URL = 'https://booking.yourdomain.com/webhook/booking-request';

// Optional: Add API key authentication
const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-secret-api-key' // If webhook security is enabled
    },
    body: JSON.stringify(formData)
});
```

## Customization

### Colors

The form uses a purple gradient theme. To customize:

```css
/* Main gradient background */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to blue gradient */
background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);

/* Change to green gradient */
background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
```

### Default Session Duration

Currently defaults to 30 minutes. To change:

```javascript
// Line 208 - change 30 to desired minutes
const endTime = new Date(startTime.getTime() + 30 * 60000);

// Example: 60 minutes
const endTime = new Date(startTime.getTime() + 60 * 60000);
```

### Field Labels and Placeholders

Update the HTML directly:

```html
<label for="name">Your Name <span class="required">*</span></label>
<input type="text" id="name" placeholder="First and Last Name">
```

## Future Enhancements

### Availability Display (Not Yet Implemented)

To show available slots instead of free-form datetime pickers:

1. Create GET endpoint in n8n workflow (e.g., `/webhook/get-availability`)
2. Fetch available slots on page load
3. Display as clickable buttons
4. Auto-fill start/end times when slot is selected

Example implementation:

```javascript
async function loadAvailability() {
    const response = await fetch('http://localhost:5678/webhook/get-availability');
    const data = await response.json();

    const container = document.getElementById('availabilitySlots');
    data.slots.forEach(slot => {
        const button = document.createElement('button');
        button.textContent = formatSlot(slot);
        button.onclick = () => selectSlot(slot);
        container.appendChild(button);
    });
}
```

### Calendar Integration

Display available slots in a calendar grid view instead of list/dropdown.

### Multi-Step Form

Break into steps: Time Selection → Details → Confirmation

### Booking History

Allow clients to view/manage their existing bookings (requires authentication).

## Testing Checklist

- [ ] Form loads correctly in all browsers (Chrome, Firefox, Safari, Edge)
- [ ] All validation works (required fields, email format, date logic)
- [ ] Successful booking shows green message
- [ ] Pending booking shows yellow message
- [ ] Unavailable slot shows red error
- [ ] Loading spinner appears during submission
- [ ] Form resets after successful submission
- [ ] Timezone conversion works correctly
- [ ] Mobile responsive layout works
- [ ] Keyboard navigation works (tab order)
- [ ] Screen reader accessibility (test with NVDA/JAWS)

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE11 - Not supported (uses modern JavaScript)

## Security Notes

- **CORS**: Ensure n8n webhook allows requests from Squarespace domain
- **API Keys**: Implement webhook authentication before public deployment
- **Rate Limiting**: Consider client-side debouncing to prevent spam
- **Input Sanitization**: Server (n8n) validates all inputs; client validation is UX only

## Files

- `booking-form.html` - Complete standalone HTML page with inline CSS/JS
- `README.md` - This file

## Support

For issues or questions, see:
- Main project docs: `../docs/PROJECT_OVERVIEW.md`
- Deployment guide: `../docs/DEPLOYMENT.md`
- Status document: `../STATUS.md`

# SkyWings Airlines Voice AI Assistant

A production-ready Voice AI system for airline customer service that handles booking modifications and add-on services through natural voice conversation.

## Features

- 🎙️ **Voice Interaction** - Natural speech recognition and text-to-speech
- 🛫 **Booking Management** - PNR lookup, seat selection, baggage add-ons
- 🎯 **Smart Conversation Flow** - Step-by-step guided assistance
- 📱 **WhatsApp Integration** - Send booking summaries
- ♿ **Special Services** - Wheelchair assistance, pet travel, priority check-in

## Demo

![Voice Orb](public/css/orb-preview.png)

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
http://localhost:3000
```

## Test PNRs

Use these PNRs for testing:
- **ABC123** - Rahul Sharma, BLR → DEL, Feb 15
- **XYZ789** - Priya Patel, MUM → BLR, Feb 20
- **DEF456** - Amit Kumar, DEL → HYD, Feb 25

## Available Services

| Service | Price |
|---------|-------|
| Window Seat | ₹200 |
| Aisle Seat | ₹150 |
| Extra Legroom | ₹800 |
| Extra Baggage | ₹500/5kg |
| Priority Check-in | FREE |
| Wheelchair | FREE |

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JS, CSS3
- **Voice**: Web Speech API
- **Design**: Premium glassmorphism UI

## Project Structure

```
├── server.js           # Main server with conversation logic
├── public/
│   ├── index.html      # Voice assistant UI
│   ├── css/styles.css  # Premium styling
│   └── js/
│       ├── app.js          # Application controller
│       └── voice-engine.js # Speech recognition/synthesis
├── data/
│   ├── bookings.json   # Mock booking database
│   ├── seats.json      # Seat availability
│   └── pricing.json    # Service pricing
└── package.json
```

## Conversation Flow

1. **Greeting** → AI asks for customer name
2. **Name** → AI greets by name, offers services
3. **Service Selection** → Customer chooses services + provides PNR
4. **Confirmation** → AI confirms flight details
5. **Sequential Processing** → Each service handled one by one
6. **WhatsApp Summary** → Booking summary sent to phone

## License

MIT

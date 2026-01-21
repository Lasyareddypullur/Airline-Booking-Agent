const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load data
const loadData = (filename) => {
    const filePath = path.join(__dirname, 'data', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const bookingsData = loadData('bookings.json');

// Session storage
const sessions = new Map();

// Conversation states
const STATES = {
    GREETING: 'greeting',
    WAITING_NAME: 'waiting_name',
    WAITING_SERVICE_CHOICE: 'waiting_service_choice',
    WAITING_PNR: 'waiting_pnr',
    CONFIRMING_FLIGHT: 'confirming_flight',
    SEAT_TYPE: 'seat_type',
    SEAT_CONFIRM: 'seat_confirm',
    BAGGAGE_AMOUNT: 'baggage_amount',
    BAGGAGE_CONFIRM: 'baggage_confirm',
    PRIORITY_CONFIRM: 'priority_confirm',
    WHEELCHAIR_NAME: 'wheelchair_name',
    WHEELCHAIR_TYPE: 'wheelchair_type',
    PET_DETAILS: 'pet_details',
    WHATSAPP_CONFIRM: 'whatsapp_confirm',
    TRANSFER: 'transfer',
    COMPLETED: 'completed'
};

// Available services
const KNOWN_SERVICES = ['seat', 'baggage', 'priority', 'wheelchair', 'pet'];

// Create new session
function createSession() {
    return {
        state: STATES.GREETING,
        customerName: null,
        pnr: null,
        booking: null,
        requestedServices: [],
        currentServiceIndex: 0,
        completedServices: [],
        pendingData: {},
        unknownRequests: []
    };
}

// Main chat endpoint
app.post('/api/chat', (req, res) => {
    const { sessionId, message, isStart } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
    }

    let session = sessions.get(sessionId);

    // Start new call
    if (isStart || !session) {
        session = createSession();
        sessions.set(sessionId, session);

        const greeting = "Hello, welcome to SkyWings Airlines Customer Service. This is Isha speaking. May I know your good name please?";
        session.state = STATES.WAITING_NAME;
        return res.json({ response: greeting });
    }

    // Process based on state
    const response = processMessage(session, message);

    res.json({
        response,
        booking: session.booking,
        state: session.state
    });
});

// Main message processor
function processMessage(session, message) {
    const lower = message.toLowerCase().trim();

    switch (session.state) {
        case STATES.WAITING_NAME:
            return handleName(session, message);

        case STATES.WAITING_SERVICE_CHOICE:
            return handleServiceChoice(session, message);

        case STATES.WAITING_PNR:
            return handlePnr(session, message);

        case STATES.CONFIRMING_FLIGHT:
            return handleFlightConfirmation(session, lower);

        case STATES.SEAT_TYPE:
            return handleSeatType(session, lower);

        case STATES.SEAT_CONFIRM:
            return handleSeatConfirm(session, lower);

        case STATES.BAGGAGE_AMOUNT:
            return handleBaggageAmount(session, message);

        case STATES.BAGGAGE_CONFIRM:
            return handleBaggageConfirm(session, lower);

        case STATES.PRIORITY_CONFIRM:
            return handlePriorityConfirm(session, lower);

        case STATES.WHEELCHAIR_NAME:
            return handleWheelchairName(session, message);

        case STATES.WHEELCHAIR_TYPE:
            return handleWheelchairType(session, message);

        case STATES.PET_DETAILS:
            return handlePetDetails(session, message);

        case STATES.WHATSAPP_CONFIRM:
            return handleWhatsappConfirm(session, lower);

        default:
            return "I'm sorry, I didn't understand. How may I assist you?";
    }
}

// State handlers

function handleName(session, message) {
    // Clean up the message
    const cleaned = message.trim();

    // Try different patterns to extract name
    let name = null;

    // Pattern 1: "This is Rahul", "I am Rahul", "My name is Rahul"
    const prefixMatch = cleaned.match(/(?:this is|i am|i'm|my name is|it's|call me|hi i'm|hey i'm)\s+([A-Za-z]+)/i);
    if (prefixMatch) {
        name = prefixMatch[1];
    }

    // Pattern 2: "Rahul here" or "Rahul speaking"
    if (!name) {
        const suffixMatch = cleaned.match(/^([A-Za-z]+)\s+(?:here|speaking|this side)/i);
        if (suffixMatch) {
            name = suffixMatch[1];
        }
    }

    // Pattern 3: Just a single word (the name itself)
    if (!name) {
        const singleWord = cleaned.match(/^([A-Za-z]{2,})$/i);
        if (singleWord) {
            name = singleWord[1];
        }
    }

    // Pattern 4: First capitalized word
    if (!name) {
        const firstWord = cleaned.match(/^([A-Z][a-z]+)/);
        if (firstWord) {
            name = firstWord[1];
        }
    }

    if (name) {
        // Capitalize first letter
        session.customerName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        session.state = STATES.WAITING_SERVICE_CHOICE;


        return `Hello ${session.customerName}! It's great to have you on the call. How may I assist you today? I can help you with seat selection, extra baggage, priority check-in, wheelchair assistance, or pet travel. What would you like help with?`;
    }

    return "I'm sorry, I couldn't catch your name. Could you please tell me your name?";
}

function handleServiceChoice(session, message) {
    const lower = message.toLowerCase();

    // Detect all requested services
    session.requestedServices = [];

    if (lower.includes('seat') || lower.includes('window') || lower.includes('aisle') || lower.includes('legroom')) {
        session.requestedServices.push('seat');
    }
    if (lower.includes('baggage') || lower.includes('luggage') || lower.includes('extra kg')) {
        session.requestedServices.push('baggage');
    }
    if (lower.includes('priority') || lower.includes('check-in')) {
        session.requestedServices.push('priority');
    }
    if (lower.includes('wheelchair') || lower.includes('special assistance')) {
        session.requestedServices.push('wheelchair');
    }
    if (lower.includes('pet') || lower.includes('dog') || lower.includes('cat')) {
        session.requestedServices.push('pet');
    }

    // Check for unknown requests (transfer to specialist)
    const knownKeywords = ['seat', 'window', 'aisle', 'legroom', 'baggage', 'luggage', 'priority', 'check-in', 'wheelchair', 'pet', 'dog', 'cat', 'assistance'];
    const hasKnownService = knownKeywords.some(kw => lower.includes(kw));

    if (!hasKnownService && lower.length > 5) {
        session.unknownRequests.push(message);
    }

    // Check for PNR in the message
    const pnrMatch = message.match(/([A-Z]{3}\d{3})/i);
    if (pnrMatch) {
        const pnr = pnrMatch[1].toUpperCase();
        if (bookingsData.bookings[pnr]) {
            session.pnr = pnr;
            session.booking = bookingsData.bookings[pnr];
        }
    }

    if (session.requestedServices.length === 0 && session.unknownRequests.length === 0) {
        return `${session.customerName}, I can help you with seat selection, extra baggage, priority check-in, wheelchair assistance, or pet travel. Which service would you like?`;
    }

    // Need PNR to proceed
    if (!session.pnr) {
        session.state = STATES.WAITING_PNR;
        const serviceList = session.requestedServices.length > 0
            ? session.requestedServices.join(', ').replace(/, ([^,]*)$/, ' and $1')
            : 'your request';
        return `Sure ${session.customerName}, I can help you with ${serviceList}. Could you please provide your PNR or booking reference number?`;
    }

    // Have PNR, confirm flight
    return confirmFlight(session);
}

function handlePnr(session, message) {
    const pnrMatch = message.match(/([A-Z]{3}\d{3})/i);

    if (pnrMatch) {
        const pnr = pnrMatch[1].toUpperCase();

        if (bookingsData.bookings[pnr]) {
            session.pnr = pnr;
            session.booking = bookingsData.bookings[pnr];
            return confirmFlight(session);
        } else {
            return `I'm sorry, I couldn't find a booking with PNR ${pnr}. Could you please check and provide the correct PNR?`;
        }
    }

    return "I couldn't catch the PNR number. Could you please spell it out? For example, A-B-C-1-2-3.";
}

function confirmFlight(session) {
    session.state = STATES.CONFIRMING_FLIGHT;
    const b = session.booking;
    const flight = b.flight;

    return `Let me help you step by step. First, just to confirm, your PNR is ${session.pnr}, and your flight is from ${flight.originCity} to ${flight.destinationCity} on ${flight.date}. Is that correct?`;
}

function handleFlightConfirmation(session, lower) {
    if (isPositive(lower)) {
        return startNextService(session, "Great!");
    } else if (isNegative(lower)) {
        session.state = STATES.WAITING_PNR;
        session.pnr = null;
        session.booking = null;
        return "Let me re-confirm the PNR number. Could you please provide your correct PNR?";
    }

    return "I didn't catch that. Is your flight from " + session.booking.flight.originCity + " to " + session.booking.flight.destinationCity + " correct? Please say yes or no.";
}

function startNextService(session, prefix = "") {
    // Check if we have more services to process
    if (session.currentServiceIndex >= session.requestedServices.length) {
        // Check for unknown requests that need specialist
        if (session.unknownRequests.length > 0) {
            session.state = STATES.WHATSAPP_CONFIRM;
            return `${prefix} I'll need to transfer you to a specialist for your other requests. Before I do that, would you like me to send a summary of everything we've completed to your WhatsApp?`;
        }

        // All done
        session.state = STATES.WHATSAPP_CONFIRM;
        return `${prefix} Is there anything else I can help you with, or would you like me to send a summary to your WhatsApp?`;
    }

    const service = session.requestedServices[session.currentServiceIndex];

    switch (service) {
        case 'seat':
            session.state = STATES.SEAT_TYPE;
            return `${prefix} For seat selection, would you prefer a window, aisle, or extra legroom seat?`;

        case 'baggage':
            session.state = STATES.BAGGAGE_AMOUNT;
            return `${prefix} For extra baggage, how many extra kilograms do you need?`;

        case 'priority':
            session.state = STATES.PRIORITY_CONFIRM;
            return `${prefix} Priority check-in and boarding is complimentary. Would you like me to activate it for you?`;

        case 'wheelchair':
            session.state = STATES.WHEELCHAIR_NAME;
            return `${prefix} For wheelchair assistance, may I have the name of the passenger who needs it?`;

        case 'pet':
            session.state = STATES.PET_DETAILS;
            return `${prefix} For pet travel, could you please tell me your pet's breed and approximate weight in kilograms?`;

        default:
            session.currentServiceIndex++;
            return startNextService(session, prefix);
    }
}

function handleSeatType(session, lower) {
    if (lower.includes('window')) {
        session.pendingData.seatType = 'window';
        session.pendingData.seatPrice = 200;
        session.pendingData.seatId = '14A';
        session.state = STATES.SEAT_CONFIRM;
        return "Checking availability... I see a window seat 14A available for Rs. 200. Would you like me to book that?";
    }

    if (lower.includes('aisle')) {
        session.pendingData.seatType = 'aisle';
        session.pendingData.seatPrice = 150;
        session.pendingData.seatId = '14C';
        session.state = STATES.SEAT_CONFIRM;
        return "Checking availability... I have aisle seat 14C available for Rs. 150. Would you like me to book that?";
    }

    if (lower.includes('legroom') || lower.includes('extra')) {
        session.pendingData.seatType = 'extra legroom';
        session.pendingData.seatPrice = 800;
        session.pendingData.seatId = '12A';
        session.state = STATES.SEAT_CONFIRM;
        return "Checking availability... I have extra legroom seat 12A available for Rs. 800. Would you like me to book that?";
    }

    return "I couldn't get that. Would you prefer a window seat, aisle seat, or extra legroom seat?";
}

function handleSeatConfirm(session, lower) {
    if (isPositive(lower)) {
        session.completedServices.push({
            type: 'seat',
            details: `Seat ${session.pendingData.seatId} (${session.pendingData.seatType})`,
            price: session.pendingData.seatPrice
        });
        session.currentServiceIndex++;
        return startNextService(session, `Done! Your ${session.pendingData.seatType} seat ${session.pendingData.seatId} is confirmed.`);
    }

    if (isNegative(lower)) {
        session.state = STATES.SEAT_TYPE;
        return "No problem. Would you like to choose a different seat type - window, aisle, or extra legroom?";
    }

    return "Would you like me to book this seat? Please say yes or no.";
}

function handleBaggageAmount(session, message) {
    const kgMatch = message.match(/(\d+)/);

    if (kgMatch) {
        const kg = parseInt(kgMatch[1]);
        const cost = Math.ceil(kg / 5) * 500;
        session.pendingData.baggageKg = kg;
        session.pendingData.baggageCost = cost;
        session.state = STATES.BAGGAGE_CONFIRM;
        return `Alright. For domestic flights, it's Rs. 500 per 5 kg, so Rs. ${cost} for ${kg} kg. Shall I add that to your booking?`;
    }

    return "Could you please tell me how many extra kilograms you need? For example, 5 kg or 10 kg.";
}

function handleBaggageConfirm(session, lower) {
    if (isPositive(lower)) {
        session.completedServices.push({
            type: 'baggage',
            details: `${session.pendingData.baggageKg} kg extra baggage`,
            price: session.pendingData.baggageCost
        });
        session.currentServiceIndex++;
        return startNextService(session, "Added!");
    }

    if (isNegative(lower)) {
        session.currentServiceIndex++;
        return startNextService(session, "No problem.");
    }

    return "Would you like me to add the extra baggage? Please say yes or no.";
}

function handlePriorityConfirm(session, lower) {
    if (isPositive(lower)) {
        session.completedServices.push({
            type: 'priority',
            details: 'Priority check-in and boarding',
            price: 0
        });
        session.currentServiceIndex++;
        return startNextService(session, "All set! Priority check-in and boarding is now active.");
    }

    if (isNegative(lower)) {
        session.currentServiceIndex++;
        return startNextService(session, "No problem.");
    }

    return "Would you like me to activate priority check-in? Please say yes or no.";
}

function handleWheelchairName(session, message) {
    // Try to extract a name
    const nameMatch = message.match(/(?:mrs?\.?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);

    if (nameMatch) {
        session.pendingData.wheelchairName = nameMatch[0];
        session.state = STATES.WHEELCHAIR_TYPE;
        return `Thank you. What type of assistance does ${session.pendingData.wheelchairName} need? Gate-to-gate, check-in to boarding, or full assistance from check-in to destination?`;
    }

    return "Could you please tell me the full name of the passenger who needs wheelchair assistance?";
}

function handleWheelchairType(session, message) {
    let assistanceType = 'full assistance';
    const lower = message.toLowerCase();

    if (lower.includes('gate') && lower.includes('gate')) {
        assistanceType = 'gate-to-gate';
    } else if (lower.includes('boarding')) {
        assistanceType = 'check-in to boarding';
    } else if (lower.includes('check-in') || lower.includes('destination') || lower.includes('full') || lower.includes('all')) {
        assistanceType = 'full assistance from check-in to destination';
    }

    session.completedServices.push({
        type: 'wheelchair',
        details: `Wheelchair for ${session.pendingData.wheelchairName} (${assistanceType})`,
        price: 0
    });
    session.currentServiceIndex++;

    return startNextService(session, `Got it, ${session.customerName}. Wheelchair assistance for ${session.pendingData.wheelchairName} with ${assistanceType} is arranged. This is a complimentary service.`);
}

function handlePetDetails(session, message) {
    const breedMatch = message.match(/(labrador|retriever|german\s*shepherd|poodle|beagle|bulldog|husky|golden|persian|siamese|cat|dog)/i);
    const weightMatch = message.match(/(\d+)\s*(?:kg|kilo)?/i);

    if (breedMatch || weightMatch) {
        const breed = breedMatch ? breedMatch[1] : 'pet';
        const weight = weightMatch ? weightMatch[1] : 'unknown';

        session.pendingData.petBreed = breed;
        session.pendingData.petWeight = weight;

        session.state = STATES.WHATSAPP_CONFIRM;

        return `Got it. For pets on board, I'll need to connect you to our specialist team who will complete the booking and documentation for your ${breed}${weight !== 'unknown' ? ` weighing ${weight} kg` : ''}. Before I transfer you, would you like me to send a summary of everything we've booked so far to your WhatsApp?`;
    }

    return "Could you please tell me your pet's breed and approximate weight in kilograms?";
}

function handleWhatsappConfirm(session, lower) {
    if (isPositive(lower)) {
        const summary = generateWhatsappSummary(session);

        // Check if we need to transfer for pet or unknown requests
        if (session.pendingData.petBreed || session.unknownRequests.length > 0) {
            session.state = STATES.TRANSFER;
            return `Perfect! I'm sending you a WhatsApp message with your booking summary including: ${session.completedServices.map(s => s.details).join(', ')}. Please check your phone for the message. Now, I'll transfer you to our specialist team. Please hold for a moment.`;
        }

        session.state = STATES.COMPLETED;
        return `Perfect! I'm sending you a WhatsApp message with your booking summary. Thank you for calling SkyWings Airlines, ${session.customerName}! Have a wonderful flight!`;
    }

    if (isNegative(lower) || lower.includes('else') || lower.includes('more')) {
        // Check if they want something else
        if (lower.includes('else') || lower.includes('more') || lower.includes('another')) {
            session.state = STATES.WAITING_SERVICE_CHOICE;
            return "Sure! What else would you like help with?";
        }

        // Check if we need to transfer
        if (session.pendingData.petBreed || session.unknownRequests.length > 0) {
            session.state = STATES.TRANSFER;
            return `Alright. I'll now transfer you to our specialist team. Please hold for a moment.`;
        }

        session.state = STATES.COMPLETED;
        return `Thank you for calling SkyWings Airlines, ${session.customerName}! Have a wonderful flight!`;
    }

    return "Would you like me to send a summary to your WhatsApp? Please say yes or no.";
}

function generateWhatsappSummary(session) {
    let summary = `🛫 SkyWings Airlines Booking Summary\n\n`;
    summary += `PNR: ${session.pnr}\n`;
    summary += `Passenger: ${session.customerName}\n`;

    if (session.booking) {
        const f = session.booking.flight;
        summary += `Flight: ${f.number}\n`;
        summary += `Route: ${f.originCity} → ${f.destinationCity}\n`;
        summary += `Date: ${f.date}\n\n`;
    }

    if (session.completedServices.length > 0) {
        summary += `Services Added:\n`;
        let total = 0;
        session.completedServices.forEach(s => {
            summary += `✓ ${s.details}`;
            if (s.price > 0) {
                summary += ` - Rs. ${s.price}`;
                total += s.price;
            } else {
                summary += ` - FREE`;
            }
            summary += `\n`;
        });

        if (total > 0) {
            summary += `\nTotal: Rs. ${total}\n`;
            summary += `Pay at: pay.skywings.com/${session.pnr}\n`;
        }
    }

    return summary;
}

// Helper functions
function isPositive(text) {
    return /^(yes|yeah|yep|sure|okay|ok|please|go ahead|correct|right|that's right|fine|absolutely|definitely)/i.test(text);
}

function isNegative(text) {
    return /^(no|nope|nah|cancel|wrong|incorrect|not right)/i.test(text);
}

// API endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🛫 SkyWings Voice AI`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`\n   PNRs: ABC123, XYZ789, DEF456\n`);
});

/**
 * Conversation Manager - Natural Dialog Flow
 * Handles step-by-step conversation like a real phone call
 */

class ConversationManager {
    constructor() {
        this.state = 'idle';
        this.context = {
            pnr: null,
            booking: null,
            customerName: null,
            currentService: null,
            pendingServices: [],
            completedServices: [],
            totalCost: 0,
            awaitingConfirmation: null,
            pendingData: null
        };

        this.intentEngine = new IntentEngine();
        this.onStateChangeCallback = null;
    }

    /**
     * Start a new call - AI greets
     */
    startCall() {
        this.resetContext();
        this.state = 'greeting';
        return "Hello, thank you for calling SkyWings Airlines Customer Service. This is Isha speaking. How may I assist you today?";
    }

    /**
     * Process user input and return AI response
     */
    async processInput(text) {
        console.log(`[State: ${this.state}] User: "${text}"`);

        const entities = this.intentEngine.extractAllEntities(text);
        const intents = this.intentEngine.detectMultipleIntents(text);

        // Extract customer name if mentioned
        if (!this.context.customerName) {
            const nameMatch = text.match(/(?:this is|i am|my name is|i'm)\s+([A-Z][a-z]+)/i);
            if (nameMatch) {
                this.context.customerName = nameMatch[1];
            }
        }

        // Route based on current state
        switch (this.state) {
            case 'greeting':
                return this.handleGreeting(text, entities, intents);

            case 'awaiting_pnr':
                return this.handlePnrInput(text, entities);

            case 'pnr_confirmed':
                return this.handleServiceRequest(text, intents, entities);

            case 'awaiting_seat_type':
                return this.handleSeatTypeInput(text, entities);

            case 'awaiting_seat_confirm':
                return this.handleSeatConfirmation(text);

            case 'awaiting_baggage_weight':
                return this.handleBaggageWeightInput(text, entities);

            case 'awaiting_baggage_confirm':
                return this.handleBaggageConfirmation(text);

            case 'awaiting_priority_confirm':
                return this.handlePriorityConfirmation(text);

            case 'awaiting_wheelchair_name':
                return this.handleWheelchairNameInput(text, entities);

            case 'awaiting_wheelchair_type':
                return this.handleWheelchairTypeInput(text, entities);

            case 'awaiting_pet_details':
                return this.handlePetDetailsInput(text, entities);

            case 'awaiting_whatsapp_confirm':
                return this.handleWhatsappConfirmation(text);

            case 'service_complete':
                return this.handleNextServiceOrEnd(text, intents, entities);

            default:
                return this.handleServiceRequest(text, intents, entities);
        }
    }

    /**
     * Handle initial greeting - extract name and PNR if provided
     */
    handleGreeting(text, entities, intents) {
        // Check if PNR is provided
        if (entities.pnr) {
            this.context.pnr = entities.pnr;

            // Queue any service intents for later
            const serviceIntents = intents.filter(i =>
                ['seat_selection', 'baggage', 'priority_service', 'wheelchair', 'pet_travel'].includes(i.name)
            );
            this.context.pendingServices = serviceIntents.map(i => ({
                type: i.name,
                entities: i.entities
            }));

            // Store any entities for later
            if (entities.seatType) this.context.requestedSeatType = entities.seatType;
            if (entities.weight) this.context.requestedWeight = entities.weight;

            return this.verifyPnr();
        }

        // No PNR yet, greet by name if we have it
        this.state = 'awaiting_pnr';

        if (this.context.customerName) {
            return `Hello ${this.context.customerName}! I'd be happy to help you. Could you please provide your PNR or booking reference number?`;
        }

        return "I'd be happy to help you. Could you please provide your PNR or booking reference number?";
    }

    /**
     * Handle PNR input
     */
    handlePnrInput(text, entities) {
        if (entities.pnr) {
            this.context.pnr = entities.pnr;
            return this.verifyPnr();
        }

        // Try to extract PNR directly
        const pnrMatch = text.match(/([A-Z]{3}\d{3}|[A-Z0-9]{6})/i);
        if (pnrMatch) {
            this.context.pnr = pnrMatch[1].toUpperCase();
            return this.verifyPnr();
        }

        return "I'm sorry, I couldn't catch that. Could you please spell out your 6-character PNR? For example, A-B-C-1-2-3.";
    }

    /**
     * Verify PNR with backend
     */
    async verifyPnr() {
        try {
            const response = await fetch('/api/verify-pnr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pnr: this.context.pnr })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                this.state = 'awaiting_pnr';
                return `I'm sorry, I couldn't find a booking with PNR ${this.context.pnr}. Could you please check and provide the correct PNR?`;
            }

            this.context.booking = data.booking;
            this.state = 'pnr_confirmed';

            const flight = data.booking.flight;
            const passengerName = data.booking.passengers[0].name;

            // Use customer's spoken name or passenger name
            const greeting = this.context.customerName || passengerName.split(' ')[0];

            let response_text = `Thank you, ${greeting}. I found your booking. `;
            response_text += `Your PNR is ${this.context.pnr}, flying ${flight.number} from ${flight.originCity} to ${flight.destinationCity} on ${this.formatDate(flight.date)}. `;
            response_text += `Is that correct?`;

            this.state = 'pnr_confirmed';
            return response_text;

        } catch (error) {
            console.error('PNR verification error:', error);
            return "I'm having trouble accessing our booking system. Please try again in a moment.";
        }
    }

    /**
     * Handle service requests after PNR confirmed
     */
    handleServiceRequest(text, intents, entities) {
        // Check for specific service requests
        const serviceIntent = intents.find(i =>
            ['seat_selection', 'baggage', 'priority_service', 'wheelchair', 'pet_travel', 'whatsapp_summary'].includes(i.name)
        );

        if (serviceIntent) {
            return this.startService(serviceIntent.name, entities);
        }

        // Check for confirmation of flight details
        if (this.intentEngine.isConfirmation(text)) {
            // Check if we have pending services from initial request
            if (this.context.pendingServices.length > 0) {
                const nextService = this.context.pendingServices.shift();
                return this.startService(nextService.type, nextService.entities);
            }

            return "Great! How may I assist you with this booking? I can help with seat selection, extra baggage, priority check-in, wheelchair assistance, or pet travel.";
        }

        // Check for goodbye
        if (intents.some(i => i.name === 'goodbye')) {
            return this.endConversation();
        }

        return "How may I assist you with your booking today? Would you like to select a seat, add baggage, or request any other service?";
    }

    /**
     * Start a specific service flow
     */
    startService(serviceName, entities = {}) {
        this.context.currentService = serviceName;

        switch (serviceName) {
            case 'seat_selection':
                this.state = 'awaiting_seat_type';
                if (entities.seatType || this.context.requestedSeatType) {
                    const seatType = entities.seatType || this.context.requestedSeatType;
                    this.context.requestedSeatType = null;
                    return this.findSeat(seatType);
                }
                return "For seat selection, would you prefer a window, aisle, or extra legroom seat?";

            case 'baggage':
                this.state = 'awaiting_baggage_weight';
                if (entities.weight || this.context.requestedWeight) {
                    const weight = entities.weight || this.context.requestedWeight;
                    this.context.requestedWeight = null;
                    return this.calculateBaggage(parseInt(weight));
                }
                return "For extra baggage, how many extra kilograms do you need?";

            case 'priority_service':
                this.state = 'awaiting_priority_confirm';
                return "I can activate priority check-in and boarding for you. This service is complimentary. Shall I enable it for your booking?";

            case 'wheelchair':
                this.state = 'awaiting_wheelchair_name';
                return "For wheelchair assistance, may I have the name of the passenger who needs the service?";

            case 'pet_travel':
                this.state = 'awaiting_pet_details';
                return "For pet travel, I'll need to collect some details. Could you please tell me your pet's breed and weight in kilograms?";

            case 'whatsapp_summary':
                return this.sendWhatsapp();

            default:
                return "I'm sorry, I didn't understand that. How can I help you?";
        }
    }

    /**
     * Handle seat type selection
     */
    handleSeatTypeInput(text, entities) {
        const seatType = entities.seatType || this.extractSeatType(text);

        if (seatType) {
            return this.findSeat(seatType);
        }

        return "Would you like a window seat, aisle seat, or extra legroom seat?";
    }

    extractSeatType(text) {
        const lower = text.toLowerCase();
        if (lower.includes('window')) return 'window';
        if (lower.includes('aisle')) return 'aisle';
        if (lower.includes('extra') || lower.includes('legroom')) return 'extra-legroom';
        if (lower.includes('middle')) return 'middle';
        return null;
    }

    /**
     * Find available seat
     */
    async findSeat(seatType) {
        try {
            const flightNumber = this.context.booking.flight.number;
            const response = await fetch(`/api/seats/${flightNumber}/available/${seatType}`);
            const data = await response.json();

            if (data.availableSeats && data.availableSeats.length > 0) {
                const seat = data.availableSeats[0];
                this.context.pendingData = seat;
                this.state = 'awaiting_seat_confirm';

                const typeLabel = seatType.replace(/-/g, ' ');
                const priceText = seat.price > 0 ? `for Rupees ${seat.price}` : 'at no extra cost';

                return `I found a ${typeLabel} seat available. Seat number ${seat.id}, ${priceText}. Would you like me to book that for you?`;
            }

            this.state = 'awaiting_seat_type';
            return `I'm sorry, there are no ${seatType.replace(/-/g, ' ')} seats available. Would you like to try a different seat type?`;

        } catch (error) {
            console.error('Seat search error:', error);
            return "I'm having trouble checking seat availability. Let me try again.";
        }
    }

    /**
     * Handle seat booking confirmation
     */
    async handleSeatConfirmation(text) {
        if (this.intentEngine.isConfirmation(text)) {
            return this.bookSeat();
        }

        if (this.intentEngine.isDenial(text)) {
            this.context.pendingData = null;
            this.state = 'awaiting_seat_type';
            return "No problem. Would you like a different seat type - window, aisle, or extra legroom?";
        }

        return "Sorry, I didn't catch that. Would you like me to book this seat? Please say yes or no.";
    }

    /**
     * Book the seat
     */
    async bookSeat() {
        try {
            const seat = this.context.pendingData;
            const passengerName = this.context.booking.passengers[0].name;

            const response = await fetch('/api/book-seat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pnr: this.context.pnr,
                    passengerName,
                    seatId: seat.id
                })
            });

            const data = await response.json();

            if (data.success) {
                this.context.completedServices.push({
                    type: 'seat',
                    details: `Seat ${seat.id}`,
                    price: seat.price
                });
                this.context.totalCost += seat.price;
                this.context.pendingData = null;
                this.state = 'service_complete';

                return `Done! Your ${seat.type.replace(/-/g, ' ')} seat ${seat.id} is now confirmed. Is there anything else I can help you with?`;
            }

            return "I'm sorry, there was an issue booking that seat. Would you like to try another seat?";

        } catch (error) {
            console.error('Seat booking error:', error);
            return "I encountered an error. Let me try again.";
        }
    }

    /**
     * Handle baggage weight input
     */
    handleBaggageWeightInput(text, entities) {
        const weight = entities.weight || this.extractWeight(text);

        if (weight) {
            return this.calculateBaggage(parseInt(weight));
        }

        return "How many extra kilograms of baggage would you like to add?";
    }

    extractWeight(text) {
        const match = text.match(/(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Calculate baggage cost
     */
    calculateBaggage(weight) {
        const units = Math.ceil(weight / 5);
        const cost = units * 500;

        this.context.pendingData = { weight, cost };
        this.state = 'awaiting_baggage_confirm';

        return `For ${weight} kilograms of extra baggage, the cost is Rupees ${cost}. That's Rupees 500 per 5 kilograms. Shall I add that to your booking?`;
    }

    /**
     * Handle baggage confirmation
     */
    async handleBaggageConfirmation(text) {
        if (this.intentEngine.isConfirmation(text)) {
            return this.addBaggage();
        }

        if (this.intentEngine.isDenial(text)) {
            this.context.pendingData = null;
            this.state = 'service_complete';
            return "No problem. Is there anything else I can help you with?";
        }

        return "Would you like me to add this baggage? Please say yes or no.";
    }

    /**
     * Add baggage to booking
     */
    async addBaggage() {
        try {
            const { weight, cost } = this.context.pendingData;

            const response = await fetch('/api/add-baggage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pnr: this.context.pnr,
                    extraKg: weight
                })
            });

            const data = await response.json();

            if (data.success) {
                this.context.completedServices.push({
                    type: 'baggage',
                    details: `${weight}kg extra`,
                    price: cost
                });
                this.context.totalCost += cost;
                this.context.pendingData = null;
                this.state = 'service_complete';

                return `Done! ${weight} kilograms of extra baggage has been added. Is there anything else I can help you with?`;
            }

            return "I'm sorry, there was an issue adding the baggage. Would you like to try again?";

        } catch (error) {
            console.error('Baggage error:', error);
            return "I encountered an error. Let me try again.";
        }
    }

    /**
     * Handle priority service confirmation
     */
    async handlePriorityConfirmation(text) {
        if (this.intentEngine.isConfirmation(text)) {
            try {
                const response = await fetch('/api/priority-service', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pnr: this.context.pnr })
                });

                const data = await response.json();

                if (data.success) {
                    this.context.completedServices.push({
                        type: 'priority',
                        details: 'Priority check-in & boarding',
                        price: 0
                    });
                    this.state = 'service_complete';

                    return "Done! Priority check-in and boarding has been activated for your booking. Is there anything else I can help you with?";
                }
            } catch (error) {
                console.error('Priority error:', error);
            }
            return "I encountered an error. Let me try again.";
        }

        if (this.intentEngine.isDenial(text)) {
            this.state = 'service_complete';
            return "No problem. Is there anything else I can help you with?";
        }

        return "Would you like me to activate priority service? Please say yes or no.";
    }

    /**
     * Handle wheelchair name input
     */
    handleWheelchairNameInput(text, entities) {
        // Try to extract name
        const nameMatch = text.match(/(?:for\s+)?(?:mrs?\.?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);

        if (nameMatch) {
            this.context.pendingData = { passengerName: nameMatch[1] };
            this.state = 'awaiting_wheelchair_type';
            return `Wheelchair assistance for ${nameMatch[1]}. What type of assistance do they need? Gate-to-gate, check-in to boarding, or full assistance throughout the journey?`;
        }

        // Check if they mentioned one of the passengers
        for (const p of this.context.booking.passengers) {
            if (text.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])) {
                this.context.pendingData = { passengerName: p.name };
                this.state = 'awaiting_wheelchair_type';
                return `Wheelchair assistance for ${p.name}. What type of assistance do they need?`;
            }
        }

        return "Could you please tell me the full name of the passenger who needs wheelchair assistance?";
    }

    /**
     * Handle wheelchair type input
     */
    async handleWheelchairTypeInput(text, entities) {
        let assistanceType = 'full-assistance';
        const lower = text.toLowerCase();

        if (lower.includes('gate') && lower.includes('gate')) {
            assistanceType = 'gate-to-gate';
        } else if (lower.includes('check') || lower.includes('boarding')) {
            assistanceType = 'checkin-to-boarding';
        } else if (lower.includes('arrival')) {
            assistanceType = 'arrival-assistance';
        }

        try {
            const response = await fetch('/api/wheelchair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pnr: this.context.pnr,
                    passengerName: this.context.pendingData.passengerName,
                    assistanceType
                })
            });

            const data = await response.json();

            if (data.success) {
                this.context.completedServices.push({
                    type: 'wheelchair',
                    details: `Wheelchair for ${this.context.pendingData.passengerName}`,
                    price: 0
                });
                this.context.pendingData = null;
                this.state = 'service_complete';

                return `Done! Wheelchair assistance for ${data.details.passenger} has been arranged. This service is complimentary. Is there anything else I can help you with?`;
            }
        } catch (error) {
            console.error('Wheelchair error:', error);
        }

        return "I encountered an error. Let me try again.";
    }

    /**
     * Handle pet details input
     */
    async handlePetDetailsInput(text, entities) {
        // Extract pet info
        const breedMatch = text.match(/(labrador|retriever|german\s*shepherd|poodle|beagle|bulldog|husky|golden|persian|siamese|dog|cat)/i);
        const weightMatch = text.match(/(\d+)\s*(?:kg|kilo)/i);

        if (breedMatch && weightMatch) {
            const breed = breedMatch[1];
            const weight = weightMatch[1];

            this.context.pendingData = { breed, weight };
            this.state = 'awaiting_whatsapp_confirm';

            let response = `Got it. For pets on board, I'll need to connect you to our specialist team who will complete the booking and documentation for your ${breed} weighing ${weight} kilograms. `;

            if (this.context.completedServices.length > 0) {
                response += `Before I transfer you, would you like me to send a summary of everything we've booked so far to your WhatsApp?`;
            } else {
                response += `I'll transfer you now to our pets-on-board specialist.`;
                this.state = 'transfer';
                setTimeout(() => this.triggerTransfer(), 3000);
            }

            return response;
        }

        if (breedMatch && !weightMatch) {
            this.context.pendingData = { breed: breedMatch[1] };
            return `Got it, a ${breedMatch[1]}. What is your pet's weight in kilograms?`;
        }

        if (!breedMatch && weightMatch) {
            this.context.pendingData = { weight: weightMatch[1] };
            return "And what breed is your pet?";
        }

        return "Could you please tell me your pet's breed and approximate weight in kilograms?";
    }

    /**
     * Handle WhatsApp confirmation
     */
    async handleWhatsappConfirmation(text) {
        if (this.intentEngine.isConfirmation(text)) {
            return this.sendWhatsapp();
        }

        if (this.intentEngine.isDenial(text)) {
            if (this.context.pendingData?.breed) {
                // Transfer for pet
                return this.initiateTransfer();
            }
            this.state = 'service_complete';
            return "Alright. Is there anything else I can help you with?";
        }

        return "Would you like me to send the booking summary to your WhatsApp?";
    }

    /**
     * Send WhatsApp summary
     */
    async sendWhatsapp() {
        try {
            const response = await fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pnr: this.context.pnr })
            });

            const data = await response.json();

            if (data.success) {
                // Check if we need to transfer for pet
                if (this.context.pendingData?.breed) {
                    return `Perfect! I'm sending the booking summary to your WhatsApp now. It includes all your add-ons and the payment link. ` + this.initiateTransfer();
                }

                this.state = 'service_complete';
                return "Done! I've sent your booking summary with all the details to your WhatsApp. Is there anything else I can help you with?";
            }
        } catch (error) {
            console.error('WhatsApp error:', error);
        }

        return "I'm having trouble sending the message. Let me try again.";
    }

    /**
     * Handle after service complete - ask for next or end
     */
    handleNextServiceOrEnd(text, intents, entities) {
        // Check for another service request
        const serviceIntent = intents.find(i =>
            ['seat_selection', 'baggage', 'priority_service', 'wheelchair', 'pet_travel', 'whatsapp_summary'].includes(i.name)
        );

        if (serviceIntent) {
            return this.startService(serviceIntent.name, entities);
        }

        // Check for pending services from initial request
        if (this.context.pendingServices.length > 0) {
            const nextService = this.context.pendingServices.shift();
            return this.startService(nextService.type, nextService.entities);
        }

        // Check for goodbye/nothing else
        if (this.intentEngine.isDenial(text) || intents.some(i => i.name === 'goodbye')) {
            return this.endConversation();
        }

        if (this.intentEngine.isConfirmation(text)) {
            return "What else would you like help with?";
        }

        return "Is there anything else I can help you with today?";
    }

    /**
     * Initiate transfer to specialist
     */
    initiateTransfer() {
        this.state = 'transfer';

        const pet = this.context.pendingData;

        if (this.onStateChangeCallback) {
            this.onStateChangeCallback('transfer', {
                specialistTeam: 'Pets-on-Board Specialist',
                petDetails: pet
            });
        }

        return `Now, I'll transfer you to our pets-on-board specialist to help with your ${pet?.breed || 'pet'}. Please hold for a moment. Thank you for calling SkyWings Airlines!`;
    }

    /**
     * End the conversation
     */
    endConversation() {
        this.state = 'ended';

        if (this.context.completedServices.length > 0) {
            return `Thank you for calling SkyWings Airlines! Your booking has been updated successfully. Have a wonderful flight, ${this.context.customerName || 'and thank you'}!`;
        }

        return "Thank you for calling SkyWings Airlines. Have a wonderful day!";
    }

    /**
     * Format date nicely
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    /**
     * Reset context
     */
    resetContext() {
        this.state = 'idle';
        this.context = {
            pnr: null,
            booking: null,
            customerName: null,
            currentService: null,
            pendingServices: [],
            completedServices: [],
            totalCost: 0,
            awaitingConfirmation: null,
            pendingData: null
        };
    }

    /**
     * Set state change callback
     */
    onStateChange(callback) {
        this.onStateChangeCallback = callback;
    }

    getContext() {
        return { ...this.context };
    }

    getState() {
        return this.state;
    }
}

window.ConversationManager = ConversationManager;

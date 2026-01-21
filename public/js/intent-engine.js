/**
 * Intent Engine - Natural Language Understanding
 * Detects user intents and extracts entities from speech
 */

class IntentEngine {
    constructor() {
        // Intent patterns with keywords and phrases
        this.intentPatterns = {
            greeting: {
                patterns: [/^(hi|hello|hey|good morning|good afternoon|good evening)/i],
                priority: 1
            },
            pnr_provide: {
                patterns: [
                    /pnr\s*(?:is|number)?\s*([A-Z0-9]{6})/i,
                    /my\s*(?:pnr|booking)\s*(?:is|number)?\s*([A-Z0-9]{6})/i,
                    /([A-Z]{3}\d{3})/i
                ],
                priority: 10,
                extractEntity: 'pnr'
            },
            seat_selection: {
                patterns: [
                    /(?:want|need|like|book|select|get)\s*(?:a|an)?\s*(window|aisle|extra\s*legroom|middle|premium)\s*seat/i,
                    /seat\s*selection/i,
                    /select\s*(?:my|a)?\s*seat/i,
                    /(window|aisle|extra\s*legroom)\s*(?:seat|please)/i
                ],
                priority: 8,
                extractEntity: 'seatType'
            },
            seat_confirm: {
                patterns: [
                    /yes.*book/i,
                    /go\s*ahead/i,
                    /please\s*(?:do|book)/i,
                    /^yes/i,
                    /confirm/i,
                    /that.?s?\s*(?:fine|ok|good)/i
                ],
                priority: 5
            },
            baggage: {
                patterns: [
                    /(?:extra|add|additional)\s*(?:baggage|luggage|bag)/i,
                    /(\d+)\s*(?:kg|kilo|kilogram)s?\s*(?:extra|additional)?/i,
                    /need\s*(\d+)\s*(?:kg|kilo)/i,
                    /baggage\s*(?:of)?\s*(\d+)/i
                ],
                priority: 8,
                extractEntity: 'weight'
            },
            priority_service: {
                patterns: [
                    /priority\s*(?:check.?in|boarding|service)/i,
                    /(?:want|need|get)\s*priority/i,
                    /fast\s*(?:track|check.?in)/i
                ],
                priority: 7
            },
            wheelchair: {
                patterns: [
                    /wheelchair/i,
                    /(?:special|mobility)\s*assistance/i,
                    /(?:need|require|arrange)\s*(?:a\s*)?wheelchair/i,
                    /assistance\s*(?:for|with)/i
                ],
                priority: 8,
                extractEntity: 'wheelchairType'
            },
            pet_travel: {
                patterns: [
                    /pet/i,
                    /(?:my|a)\s*(?:dog|cat|puppy|kitten)/i,
                    /travel\s*with\s*(?:my|a)\s*(?:pet|dog|cat)/i,
                    /(?:bring|carry)\s*(?:my|a)\s*(?:pet|dog|cat)/i,
                    /labrador|retriever|german\s*shepherd|poodle|beagle/i
                ],
                priority: 9,
                extractEntity: 'petInfo'
            },
            whatsapp_summary: {
                patterns: [
                    /(?:send|whatsapp|message)/i,
                    /summary\s*(?:on|via|through)?\s*whatsapp/i,
                    /whatsapp\s*(?:me|summary)/i,
                    /send\s*(?:me\s*)?(?:a\s*)?summary/i
                ],
                priority: 6
            },
            confirm_yes: {
                patterns: [
                    /^yes/i,
                    /^yeah/i,
                    /^yep/i,
                    /^sure/i,
                    /^ok/i,
                    /^okay/i,
                    /^right/i,
                    /^correct/i,
                    /that's\s*(?:right|correct)/i,
                    /please\s*do/i,
                    /go\s*ahead/i
                ],
                priority: 3
            },
            confirm_no: {
                patterns: [
                    /^no/i,
                    /^nope/i,
                    /^not\s*(?:now|yet)/i,
                    /cancel/i,
                    /don't/i,
                    /never\s*mind/i
                ],
                priority: 3
            },
            help: {
                patterns: [
                    /help/i,
                    /what\s*can\s*you\s*do/i,
                    /options/i,
                    /services/i
                ],
                priority: 2
            },
            goodbye: {
                patterns: [
                    /(?:bye|goodbye|thank\s*you|thanks|that's\s*all)/i,
                    /nothing\s*else/i,
                    /that\s*(?:would\s*be|is)\s*all/i
                ],
                priority: 1
            }
        };

        // Entity extraction patterns
        this.entityPatterns = {
            pnr: /([A-Z]{3}\d{3}|[A-Z0-9]{6})/i,
            weight: /(\d+)\s*(?:kg|kilo|kilogram)?s?/i,
            seatType: /(window|aisle|extra\s*legroom|middle|premium)/i,
            seatNumber: /(\d{1,2}[A-F])/i,
            name: /(?:name\s*is\s*|for\s*|mr\.?\s*|mrs\.?\s*|ms\.?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
            petBreed: /(labrador|retriever|german\s*shepherd|poodle|beagle|bulldog|husky|golden|persian|siamese)/i,
            petWeight: /(\d+)\s*(?:kg|kilo)/i,
            wheelchairType: /(gate.?to.?gate|check.?in.*boarding|arrival|full|complete)/i
        };
    }

    /**
     * Detect intents from user input
     * @param {string} text - User's spoken text
     * @returns {Array} - Array of detected intents with confidence scores
     */
    detectIntents(text) {
        const detectedIntents = [];
        const normalizedText = text.toLowerCase().trim();

        for (const [intentName, config] of Object.entries(this.intentPatterns)) {
            for (const pattern of config.patterns) {
                const match = normalizedText.match(pattern);
                if (match) {
                    const intent = {
                        name: intentName,
                        confidence: this.calculateConfidence(match, normalizedText),
                        priority: config.priority,
                        matchedText: match[0],
                        entities: {}
                    };

                    // Extract entities if applicable
                    if (config.extractEntity) {
                        const entityValue = this.extractEntity(config.extractEntity, text);
                        if (entityValue) {
                            intent.entities[config.extractEntity] = entityValue;
                        }
                    }

                    detectedIntents.push(intent);
                    break; // Only match once per intent
                }
            }
        }

        // Sort by priority and confidence
        detectedIntents.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return b.confidence - a.confidence;
        });

        return detectedIntents;
    }

    /**
     * Detect multiple intents in a complex sentence
     * @param {string} text - User's spoken text
     * @returns {Array} - Array of unique intents
     */
    detectMultipleIntents(text) {
        const intents = this.detectIntents(text);
        const uniqueIntents = [];
        const seenNames = new Set();

        // Filter service-related intents (seat, baggage, priority, wheelchair, pet)
        const serviceIntents = ['seat_selection', 'baggage', 'priority_service', 'wheelchair', 'pet_travel'];

        for (const intent of intents) {
            if (!seenNames.has(intent.name)) {
                seenNames.add(intent.name);
                uniqueIntents.push(intent);
            }
        }

        return uniqueIntents;
    }

    /**
     * Extract a specific entity from text
     * @param {string} entityType - Type of entity to extract
     * @param {string} text - Text to extract from
     * @returns {string|null} - Extracted entity value or null
     */
    extractEntity(entityType, text) {
        const pattern = this.entityPatterns[entityType];
        if (!pattern) return null;

        const match = text.match(pattern);
        if (match && match[1]) {
            // Clean up the extracted value
            let value = match[1].trim();

            // Normalize PNR to uppercase
            if (entityType === 'pnr') {
                value = value.toUpperCase();
            }

            // Normalize seat type
            if (entityType === 'seatType') {
                value = value.toLowerCase().replace(/\s+/g, '-');
            }

            // Normalize wheelchair type
            if (entityType === 'wheelchairType') {
                value = this.normalizeWheelchairType(value);
            }

            return value;
        }

        return null;
    }

    /**
     * Extract all entities from text
     * @param {string} text - Text to extract from
     * @returns {Object} - Object containing all extracted entities
     */
    extractAllEntities(text) {
        const entities = {};

        for (const entityType of Object.keys(this.entityPatterns)) {
            const value = this.extractEntity(entityType, text);
            if (value) {
                entities[entityType] = value;
            }
        }

        return entities;
    }

    /**
     * Calculate confidence score for a match
     */
    calculateConfidence(match, text) {
        // Base confidence on match length relative to text
        const matchRatio = match[0].length / text.length;
        return Math.min(0.5 + matchRatio * 0.5, 1.0);
    }

    /**
     * Normalize wheelchair type value
     */
    normalizeWheelchairType(value) {
        const normalized = value.toLowerCase();

        if (normalized.includes('gate') && normalized.includes('gate')) {
            return 'gate-to-gate';
        }
        if (normalized.includes('check') && normalized.includes('board')) {
            return 'checkin-to-boarding';
        }
        if (normalized.includes('arrival')) {
            return 'arrival-assistance';
        }
        if (normalized.includes('full') || normalized.includes('complete')) {
            return 'full-assistance';
        }

        return 'full-assistance'; // Default
    }

    /**
     * Check if text contains confirmation
     */
    isConfirmation(text) {
        const intents = this.detectIntents(text);
        return intents.some(i => i.name === 'confirm_yes');
    }

    /**
     * Check if text contains denial
     */
    isDenial(text) {
        const intents = this.detectIntents(text);
        return intents.some(i => i.name === 'confirm_no');
    }

    /**
     * Get primary intent from text
     */
    getPrimaryIntent(text) {
        const intents = this.detectIntents(text);
        return intents.length > 0 ? intents[0] : null;
    }
}

// Export for use
window.IntentEngine = IntentEngine;

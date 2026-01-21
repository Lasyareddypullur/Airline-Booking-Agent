/**
 * Voice Engine - Optimized for natural conversation
 */

class VoiceEngine {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.selectedVoice = null;

        this.onResultCallback = null;
        this.onErrorCallback = null;
        this.onStartCallback = null;
        this.onEndCallback = null;

        this.initRecognition();
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;  // Keep listening
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-IN';
        this.recognition.maxAlternatives = 1;

        let finalTranscript = '';
        let silenceTimer = null;

        this.recognition.onresult = (event) => {
            let interim = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            // Show interim results
            if (this.onResultCallback && interim) {
                this.onResultCallback(interim, false, 0);
            }

            // On final result, wait for pause then send
            if (finalTranscript) {
                clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => {
                    if (finalTranscript.trim()) {
                        const cleaned = this.cleanTranscript(finalTranscript.trim());
                        if (this.onResultCallback) {
                            this.onResultCallback(cleaned, true, 0.9);
                        }
                        finalTranscript = '';
                    }
                }, 1000); // Wait 1 second of silence
            }
        };

        this.recognition.onerror = (event) => {
            if (event.error !== 'aborted' && event.error !== 'no-speech') {
                console.error('Speech error:', event.error);
            }
            if (this.onErrorCallback) {
                this.onErrorCallback(event.error);
            }
        };

        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.onStartCallback) this.onStartCallback();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.onEndCallback) this.onEndCallback();
        };
    }

    cleanTranscript(text) {
        let cleaned = text;

        // PNR patterns - common misrecognitions
        cleaned = cleaned.replace(/a\s*b\s*c\s*1\s*2\s*3/gi, 'ABC123');
        cleaned = cleaned.replace(/abc\s*123/gi, 'ABC123');
        cleaned = cleaned.replace(/a\s*b\s*c\s*one\s*two\s*three/gi, 'ABC123');

        cleaned = cleaned.replace(/x\s*y\s*z\s*7\s*8\s*9/gi, 'XYZ789');
        cleaned = cleaned.replace(/xyz\s*789/gi, 'XYZ789');

        cleaned = cleaned.replace(/d\s*e\s*f\s*4\s*5\s*6/gi, 'DEF456');
        cleaned = cleaned.replace(/def\s*456/gi, 'DEF456');

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        return cleaned;
    }

    async initVoices() {
        return new Promise((resolve) => {
            const loadVoices = () => {
                const voices = this.synthesis.getVoices();

                // Find best quality English voice
                this.selectedVoice =
                    voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
                    voices.find(v => v.name.includes('Samantha')) ||
                    voices.find(v => v.name.includes('Microsoft') && v.name.includes('Zira')) ||
                    voices.find(v => v.lang === 'en-IN') ||
                    voices.find(v => v.lang.startsWith('en')) ||
                    voices[0];

                console.log('Voice:', this.selectedVoice?.name || 'default');
                resolve(this.selectedVoice);
            };

            if (this.synthesis.getVoices().length) {
                loadVoices();
            } else {
                this.synthesis.onvoiceschanged = loadVoices;
                setTimeout(loadVoices, 500);
            }
        });
    }

    startListening() {
        if (this.recognition && !this.isListening && !this.isSpeaking) {
            try {
                this.recognition.start();
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    stopListening() {
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) { }
        }
        this.isListening = false;
    }

    async speak(text) {
        this.synthesis.cancel();
        this.isSpeaking = true;

        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);

            if (this.selectedVoice) {
                utterance.voice = this.selectedVoice;
            }

            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onend = () => {
                this.isSpeaking = false;
                resolve();
            };

            utterance.onerror = () => {
                this.isSpeaking = false;
                resolve();
            };

            this.synthesis.speak(utterance);
        });
    }

    stopSpeaking() {
        this.synthesis.cancel();
        this.isSpeaking = false;
    }

    onResult(cb) { this.onResultCallback = cb; }
    onError(cb) { this.onErrorCallback = cb; }
    onStart(cb) { this.onStartCallback = cb; }
    onEnd(cb) { this.onEndCallback = cb; }

    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
}

window.VoiceEngine = VoiceEngine;

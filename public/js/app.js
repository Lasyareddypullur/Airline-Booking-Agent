/**
 * SkyWings Voice AI Application
 */

class AirlineVoiceApp {
    constructor() {
        this.voiceEngine = null;
        this.sessionId = null;
        this.isCallActive = false;
        this.isProcessing = false;

        // DOM Elements
        this.app = document.querySelector('.app');
        this.orbWrapper = document.getElementById('orbWrapper');
        this.orbStatus = document.getElementById('orbStatus');
        this.responseText = document.getElementById('responseText');
        this.callBtn = document.getElementById('callBtn');
        this.callText = document.getElementById('callText');
        this.textInput = document.getElementById('textInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.micBtn = document.getElementById('micBtn');

        this.init();
    }

    async init() {
        this.voiceEngine = new VoiceEngine();
        await this.voiceEngine.initVoices();

        this.setupCallbacks();
        this.setupEventListeners();

        console.log('SkyWings AI ready');
    }

    generateSessionId() {
        return 'session_' + Date.now();
    }

    setupCallbacks() {
        this.voiceEngine.onResult((text, isFinal) => {
            if (isFinal && text.trim()) {
                this.processMessage(text.trim());
            } else if (!isFinal) {
                this.textInput.value = text;
                this.orbStatus.textContent = 'Listening...';
            }
        });

        this.voiceEngine.onStart(() => {
            this.app.classList.add('listening');
            this.app.classList.remove('speaking');
            this.orbStatus.textContent = 'Listening...';
            this.micBtn.classList.add('active');
        });

        this.voiceEngine.onEnd(() => {
            this.app.classList.remove('listening');
            this.micBtn.classList.remove('active');

            if (this.isCallActive && !this.isProcessing && !this.voiceEngine.isSpeaking) {
                setTimeout(() => {
                    if (this.isCallActive && !this.isProcessing) {
                        this.voiceEngine.startListening();
                    }
                }, 300);
            }
        });

        this.voiceEngine.onError((error) => {
            if (error === 'no-speech' && this.isCallActive && !this.isProcessing) {
                this.voiceEngine.startListening();
            }
        });
    }

    setupEventListeners() {
        // Call button
        this.callBtn.addEventListener('click', () => this.toggleCall());

        // Orb click
        this.orbWrapper.addEventListener('click', () => {
            if (!this.isCallActive) {
                this.toggleCall();
            }
        });

        // Text input
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.textInput.value.trim()) {
                e.preventDefault();
                this.sendTextMessage();
            }
        });

        // Send button
        this.sendBtn.addEventListener('click', () => this.sendTextMessage());

        // Mic button
        this.micBtn.addEventListener('mousedown', () => this.startPushToTalk());
        this.micBtn.addEventListener('mouseup', () => this.stopPushToTalk());
        this.micBtn.addEventListener('mouseleave', () => this.stopPushToTalk());
    }

    startPushToTalk() {
        if (!this.isCallActive || this.isProcessing) return;
        this.voiceEngine.stopSpeaking();
        this.voiceEngine.startListening();
    }

    stopPushToTalk() {
        // Silence detector handles this
    }

    toggleCall() {
        if (this.isCallActive) {
            this.endCall();
        } else {
            this.startCall();
        }
    }

    async startCall() {
        this.isCallActive = true;
        this.isProcessing = true;
        this.sessionId = this.generateSessionId();

        this.app.classList.add('active');
        this.callText.textContent = 'End Call';
        this.orbStatus.textContent = 'Connecting...';
        this.textInput.value = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId, isStart: true })
            });

            const data = await response.json();

            this.responseText.textContent = data.response;
            this.orbStatus.textContent = 'Speaking...';
            this.app.classList.add('speaking');

            await this.voiceEngine.speak(data.response);

            this.app.classList.remove('speaking');

        } catch (error) {
            console.error('Start error:', error);
            const fallback = "Hello, welcome to SkyWings Airlines. How may I help you?";
            this.responseText.textContent = fallback;
            await this.voiceEngine.speak(fallback);
        }

        this.isProcessing = false;
        this.orbStatus.textContent = 'Listening...';
        this.voiceEngine.startListening();
    }

    endCall() {
        this.isCallActive = false;
        this.isProcessing = false;
        this.sessionId = null;

        this.voiceEngine.stopListening();
        this.voiceEngine.stopSpeaking();

        this.app.classList.remove('active', 'speaking', 'listening');
        this.callText.textContent = 'Start Conversation';
        this.orbStatus.textContent = 'Call ended';

        setTimeout(() => {
            if (!this.isCallActive) {
                this.orbStatus.textContent = 'Tap to start';
                this.responseText.textContent = 'Click the orb to start a conversation';
            }
        }, 2000);
    }

    sendTextMessage() {
        const text = this.textInput.value.trim();
        if (!text || !this.isCallActive) return;

        this.textInput.value = '';
        this.processMessage(text);
    }

    quickSend(text) {
        if (!this.isCallActive) return;
        this.processMessage(text);
    }

    async processMessage(text) {
        if (this.isProcessing || !text) return;

        this.isProcessing = true;
        this.voiceEngine.stopListening();
        this.app.classList.remove('listening');

        this.orbStatus.textContent = 'Processing...';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message: text
                })
            });

            const data = await response.json();

            if (data.response) {
                this.responseText.textContent = data.response;
                this.orbStatus.textContent = 'Speaking...';
                this.app.classList.add('speaking');

                await this.voiceEngine.speak(data.response);

                this.app.classList.remove('speaking');
            }

        } catch (error) {
            console.error('Chat error:', error);
            this.responseText.textContent = "I'm sorry, I'm having trouble. Please try again.";
        }

        this.isProcessing = false;

        if (this.isCallActive) {
            this.orbStatus.textContent = 'Listening...';
            this.voiceEngine.startListening();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AirlineVoiceApp();
});

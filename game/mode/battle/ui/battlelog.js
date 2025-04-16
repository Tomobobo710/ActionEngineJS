// game/mode/battle/ui/battlelog.js
class BattleLog {
    constructor() {
        this.messages = [];
        this.maxMessages = 10; // Increased for more history visibility
    }

    addMessage(text, type = "normal") {
        // Create message object with timestamp, turn info is already in text
        const message = {
            text,
            type, // 'normal', 'damage', 'heal', 'critical', 'system', 'turn', 'enemy', 'ally', etc.
            timestamp: Date.now()
        };
        
        this.messages.unshift(message);

        // Keep only the last maxMessages
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
        
        // Log to console for debugging
        console.log(`[Battle Log] ${text}`);
    }

    clear() {
        this.messages = [];
    }
    
    // Get turn-specific messages
    getTurnMessages(turnNumber) {
        return this.messages.filter(msg => 
            msg.text.includes(`Turn ${turnNumber}:`) || 
            msg.text.includes(`(Turn ${turnNumber})`)
        );
    }
}
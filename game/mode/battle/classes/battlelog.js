// game/mode/battle/classes/battlelog.js
class BattleLog {
    constructor() {
        this.messages = [];
        this.maxMessages = 5;
    }

    addMessage(text, type = "normal") {
        this.messages.unshift({
            text,
            type, // 'normal', 'damage', 'heal', 'critical', etc.
            timestamp: Date.now()
        });

        // Keep only the last maxMessages
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
    }

    clear() {
        this.messages = [];
    }
}
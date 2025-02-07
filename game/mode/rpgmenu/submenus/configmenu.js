class ConfigMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        super(ctx, input, gameMaster);
        const elementHeight = 40;
        const elementSpacing = 20;
        const columnSpacing = 400; // Space between left and right columns
        
        // Left column
        this.addElement("main", {
            id: "battle_speed",
            type: "slider",
            text: "Battle Speed",
            value: 0.5,
            x: 50,
            y: 50,
            height: elementHeight,
            width: 300,
            focusable: true,
            onChange: (value) => console.log(`Battle speed changed to ${value}`)
        });

        this.addElement("main", {
            id: "vibration",
            type: "toggle",
            text: "Vibration",
            value: true,
            x: 50,
            y: 50 + elementHeight + elementSpacing,
            height: elementHeight,
            width: 300,
            focusable: true,
            onChange: (value) => console.log(`Vibration ${value ? 'enabled' : 'disabled'}`)
        });

        // Right column
        this.addElement("main", {
            id: "message_speed",
            type: "slider",
            text: "Message Speed",
            value: 0.7,
            x: 50 + columnSpacing,
            y: 50,
            height: elementHeight,
            width: 300,
            focusable: true,
            onChange: (value) => console.log(`Message speed changed to ${value}`)
        });

        this.addElement("main", {
            id: "sound",
            type: "toggle",
            text: "Sound",
            value: true,
            x: 50 + columnSpacing,
            y: 50 + elementHeight + elementSpacing,
            height: elementHeight,
            width: 300,
            focusable: true,
            onChange: (value) => console.log(`Sound ${value ? 'enabled' : 'disabled'}`)
        });

        this.registerElements();

        // Set initial focus
        if (this.focusableElements.length > 0) {
            this.currentFocus = this.focusableElements[0];
            this.currentFocus.selected = true;
            console.log(`Initial selection: ${this.currentFocus.text}`);
        }
    }
}
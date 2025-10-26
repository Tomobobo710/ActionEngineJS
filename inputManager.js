// Input Manager for handling cursor lock, pointer events, and input state
export class InputManager {
    constructor(game) {
        this.game = game;
        this.cursorLocked = false;
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard event for cursor lock toggle (C key)
        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyC") {
                this.toggleCursorLock();
            }
        });

        // Pointer lock change events
        document.addEventListener("pointerlockchange", () => {
            this.handlePointerLockChange();
        });

        // Click to lock cursor when clicking on canvas
        document.addEventListener("click", (e) => {
            if (e.target === this.game.canvas && !this.cursorLocked) {
                this.toggleCursorLock();
            }
        });

        // Mouse movement tracking for pointer lock
        document.addEventListener("mousemove", (e) => {
            if (this.cursorLocked) {
                this.mouseDeltaX = e.movementX || 0;
                this.mouseDeltaY = e.movementY || 0;
            } else {
                this.mouseDeltaX = 0;
                this.mouseDeltaY = 0;
            }
        });
    }

    toggleCursorLock(forceLock = undefined) {
        if (forceLock === true) {
            if (!this.cursorLocked) {
                this.game.canvas.requestPointerLock();
                console.log('🔒 Requesting pointer lock (forced)...');
            }
        } else if (forceLock === false) {
            if (this.cursorLocked) {
                document.exitPointerLock();
                console.log('🔓 Exiting pointer lock (forced)...');
            }
        } else {
            // Toggle behavior
            if (!this.cursorLocked) {
                this.game.canvas.requestPointerLock();
                console.log('🔒 Requesting pointer lock...');
            } else {
                document.exitPointerLock();
                console.log('🔓 Exiting pointer lock...');
            }
        }
    }

    handlePointerLockChange() {
        const isLocked = document.pointerLockElement === this.game.canvas;
        this.cursorLocked = isLocked;

        if (isLocked) {
            console.log('✅ Pointer lock acquired');
            this.game.uiManager.addMessage("🔒 Mouse locked - ready to place blocks!");
        } else {
            console.log('❌ Pointer lock lost');
            this.game.uiManager.addMessage("🔓 Mouse unlocked - click canvas to continue");
        }
    }

    isCursorLocked() {
        return this.cursorLocked;
    }

    getMouseDelta() {
        return {
            x: this.mouseDeltaX,
            y: this.mouseDeltaY
        };
    }

    resetMouseDelta() {
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
    }

    // Method to clean up event listeners if needed
    destroy() {
        document.removeEventListener("keydown", this.keydownHandler);
        document.removeEventListener("pointerlockchange", this.pointerLockHandler);
        document.removeEventListener("click", this.clickHandler);
        document.removeEventListener("mousemove", this.mousemoveHandler);
    }
}
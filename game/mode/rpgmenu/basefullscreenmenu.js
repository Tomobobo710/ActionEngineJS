class BaseFullScreenMenu {
    constructor(ctx, input, gameMaster) {
        this.ctx = ctx;
        this.input = input;
        this.gameMaster = gameMaster;
        
        // Layout management
        this.containers = new Map();
        this.elements = new Map();
        this.focusableElements = [];
        this.currentFocus = null;
        
        // Make it fullscreen by default
        this.layout = {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT,
            padding: 20,
            elementSpacing: 10,
            fontSize: 24,
            labelWidth: 200
        };
        this.backButtonRegistered = false;
        this.layout.backButton = {
            width: 30,
            height: 30,
            rightOffset: 5,
            topOffset: 5
        };
        this.createGradient = this.gameMaster.modeManager.activeMode.createGradient.bind(
            this.gameMaster.modeManager.activeMode
        );
        this.colors = this.gameMaster.modeManager.activeMode.colors;

        // Create the main container by default
        this.createContainer("main", {
            x: 0,
            y: 0,
            width: Game.WIDTH,
            height: Game.HEIGHT
        });
    }
    registerBackButton(bounds) {
        if (!this.backButtonRegistered) {
            this.input.registerElement("back_button", { bounds });
            this.backButtonRegistered = true;
        }
    }
    createContainer(id, config) {
        const container = {
            id,
            x: config.x,
            y: config.y,
            width: config.width,
            height: config.height,
            elements: [],
            visible: true
        };

        this.containers.set(id, container);
        return container;
    }
    handleMouseInput() {
    // Back button check
    if (this.input.isElementJustPressed("back_button")) {
        return "exit";
    }

    // Reset hover states
    let foundHover = false;
    this.containers.forEach(container => {
        if (!container.visible) return;

        container.elements.forEach(element => {
            if (!element.visible || !element.focusable) return;

            if (this.input.isElementHovered(`menu_element_${element.id}`)) {
                foundHover = true;
                // Update currentFocus and selection on hover
                if (this.currentFocus !== element) {
                    if (this.currentFocus) {
                        this.currentFocus.selected = false;
                    }
                    this.currentFocus = element;
                    element.selected = true;
                }

                // Handle click
                if (this.input.isElementJustPressed(`menu_element_${element.id}`)) {
                    if (element.onChange) {
                        element.onChange(element.value);
                    }
                }
            }
        });
    });

    // If we're not hovering any element, keep the current selection
    if (!foundHover && this.currentFocus) {
        this.currentFocus.selected = true;
    }
}
    addElement(containerId, config) {
    const element = {
        id: config.id,
        type: config.type,
        x: config.x || 0,
        y: config.y || 0,
        width: config.width || this.layout.labelWidth,
        height: config.height || 30,
        text: config.text || "",
        value: config.value,
        focusable: config.focusable || false,
        selected: false,
        visible: true,
        onChange: config.onChange
    };

    const container = this.containers.get(containerId);
    if (container) {
        container.elements.push(element);
        if (element.focusable) {
            this.focusableElements.push(element);
            
            // Register hitbox to exactly match where we draw
            this.input.registerElement(`menu_element_${element.id}`, {
                bounds: () => ({
                    x: container.x + this.layout.padding + element.x - 5,
                    y: container.y + this.layout.padding + element.y - element.height/2,
                    width: element.width + 10,
                    height: element.height
                })
            });
        }
    }

    this.elements.set(element.id, element);
    return element;
}

    update() {
    // Handle keyboard navigation
    if (this.input.isKeyJustPressed("DirUp")) {
        this.moveFocus("up");
    }
    if (this.input.isKeyJustPressed("DirDown")) {
        this.moveFocus("down");
    }
    if (this.input.isKeyJustPressed("DirLeft")) {
        this.moveFocus("left");
    }
    if (this.input.isKeyJustPressed("DirRight")) {
        this.moveFocus("right");
    }

    // Handle mouse input first, since we want to check for back button
    const mouseResult = this.handleMouseInput();
    if (mouseResult === "exit") {
        return "exit";
    }

    // Handle action inputs
    if (this.input.isKeyJustPressed("Action1")) {
        return this.handleAction1();
    }
    if (this.input.isKeyJustPressed("Action2")) {
        return this.handleAction2();
    }
}

   moveFocus(direction) {
    if (!this.focusableElements.length) return;

    if (!this.currentFocus) {
        this.currentFocus = this.focusableElements[0];
        this.currentFocus.selected = true;
        return;
    }

    const current = this.currentFocus;
    let nextElement = null;
    let bestDistance = Infinity;

    // Get current element's center position
    const currentX = current.x + (current.width / 2);
    const currentY = current.y + (current.height / 2);

    this.focusableElements.forEach(element => {
        if (element === current) return;

        const elementX = element.x + (element.width / 2);
        const elementY = element.y + (element.height / 2);

        // Calculate position relative to current element
        const deltaX = elementX - currentX;
        const deltaY = elementY - currentY;
        
        // Check if element is in the right direction
        switch(direction) {
            case "right":
                if (deltaX <= 0) return; // Skip elements not to the right
                break;
            case "left":
                if (deltaX >= 0) return; // Skip elements not to the left
                break;
            case "up":
                if (deltaY >= 0) return; // Skip elements not above
                break;
            case "down":
                if (deltaY <= 0) return; // Skip elements not below
                break;
        }

        // Calculate distance (prioritize direction-aligned movement)
        const distance = Math.abs(deltaX) + Math.abs(deltaY);
        
        if (distance < bestDistance) {
            bestDistance = distance;
            nextElement = element;
        }
    });

    if (nextElement) {
        this.currentFocus.selected = false;
        this.currentFocus = nextElement;
        this.currentFocus.selected = true;
    }
}

handleAction1() {
    if (!this.currentFocus) return;

    console.log(`Action1 pressed on: ${this.currentFocus.text}`);

    switch (this.currentFocus.type) {
        case 'toggle':
            this.currentFocus.value = !this.currentFocus.value;
            break;
        case 'slider':
            this.currentFocus.value = Math.min(1, this.currentFocus.value + 0.1);
            break;
        case 'button':
            if (this.currentFocus.onClick) {
                this.currentFocus.onClick();
            }
            break;
    }

    if (this.currentFocus.onChange) {
        this.currentFocus.onChange(this.currentFocus.value);
    }
}

    draw() {
        // Fill the entire screen with the main background first
        this.ctx.fillStyle = this.createGradient(
            0,
            0,
            Game.WIDTH,
            Game.HEIGHT,
            this.colors.mainBackground.start,
            this.colors.mainBackground.end
        );
        this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        // Then draw all containers
        this.containers.forEach(container => {
            if (container.visible) {
                this.drawContainer(container);
            }
        });
        // Draw the back button last so it's on top
        const backButtonX = Game.WIDTH - this.layout.backButton.rightOffset - this.layout.backButton.width;
        const backButtonY = this.layout.backButton.topOffset;
        this.drawBackButton(
            backButtonX,
            backButtonY,
            this.layout.backButton.width,
            this.layout.backButton.height
        );
    }
    drawBackButton(x, y, width, height) {
        this.ctx.fillStyle = this.input.isElementHovered("back_button")
            ? this.colors.buttonTextHover
            : this.colors.buttonTextNormal;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("❌", x + width/2, y + 20);
    }
    
    
    drawContainer(container) {
        // Draw container background with gradient
        this.ctx.fillStyle = this.createGradient(
            container.x,
            container.y,
            container.width,
            container.height,
            this.colors.menuBackground.start,
            this.colors.menuBackground.end
        );
        this.ctx.fillRect(container.x, container.y, container.width, container.height);

        // Draw container elements
        container.elements.forEach((element) => {
            if (element.visible) {
                this.drawElement(container, element);
            }
        });
    }

    drawElement(container, element) {
    const x = container.x + this.layout.padding + element.x;
    const y = container.y + this.layout.padding + element.y;

    // Draw text
    this.ctx.fillStyle = element.selected ? 
        this.colors.selectedText : 
        this.colors.normalText;
    this.ctx.font = `${this.layout.fontSize}px monospace`;
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";  // This helps center the text vertically

    // If selected, draw highlight background
    if (element.selected) {
        this.ctx.save();
        this.ctx.shadowColor = this.colors.glowColor;
        this.ctx.shadowBlur = this.colors.glowBlur;
        
        // Background for selected element
        this.ctx.fillStyle = this.createGradient(
            x - 5,
            y - element.height/2,
            element.width + 10,
            element.height,
            this.colors.selectedBackground.start,
            this.colors.selectedBackground.end
        );
        this.ctx.fillRect(x - 5, y - element.height/2, element.width + 10, element.height);
        this.ctx.restore();
    }

    this.ctx.fillText(element.text, x, y);
}


    handleAction2() {
        // Base implementation - exits the menu
        return "exit";
    }
    registerElements() {
        // Register the back button using same pattern as BaseSubmenu
        const backButtonX = Game.WIDTH - this.layout.backButton.rightOffset - this.layout.backButton.width;
        const backButtonY = this.layout.backButton.topOffset;
        
        this.registerBackButton(() => ({
            x: backButtonX,
            y: backButtonY,
            width: this.layout.backButton.width,
            height: this.layout.backButton.height
        }));
    }
    cleanup() {
        if (this.backButtonRegistered) {
            this.input.removeElement("back_button");
            this.backButtonRegistered = false;
        }
        this.elements.forEach((element) => {
            if (element.focusable) {
                this.input.removeElement(`menu_element_${element.id}`);
            }
        });
    }
}

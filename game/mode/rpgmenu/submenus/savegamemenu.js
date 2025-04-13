// game/mode/rpgmenu/submenus/savegamemenu.js
class SaveGameMenu extends BaseFullScreenMenu {
    constructor(ctx, input, gameMaster, mode = "save") {
        super(ctx, input, gameMaster);
        this.mode = mode; // "save", "load", or "delete"
        this.saveManager = new SaveManager();
        this.selectedIndex = 0;
        this.message = null;
        this.messageTimeout = null;
        
        // Setup fixed number of slots
        this.maxSlots = 10;
        this.slotsPerPage = 5;
        this.currentPage = 0;
        
        // Confirmation dialog state
        this.confirmationDialog = null;
        this.pendingSaveSlotId = null;
        this.pendingDeleteSlotId = null;
        
        // Get current saves
        this.refreshSaves();
        
        // Setup menu colors
        this.colors = this.gameMaster.persistentParty.colors;
    }
    
    refreshSaves() {
        // Get existing saves
        const existingSaves = this.saveManager.getSaves();
        
        // Create a map of slot number to save
        this.saveSlots = [];
        for (let i = 0; i < this.maxSlots; i++) {
            // Find if there's a save with this slot number
            const slotId = `slot_${i + 1}`;
            const existingSave = existingSaves.find(save => save.id === slotId);
            
            if (existingSave) {
                this.saveSlots.push(existingSave);
            } else {
                // Create an empty slot placeholder
                this.saveSlots.push({
                    id: slotId,
                    name: `Empty Slot ${i + 1}`,
                    isEmpty: true
                });
            }
        }
    }
    
    registerElements() {
        // Register all base elements first
        super.registerElements();
        
        // If confirmation dialog is active, register its buttons
        if (this.confirmationDialog) {
            this.input.registerElement("confirm_yes", {
                bounds: () => ({
                    x: 300,
                    y: 350,
                    width: 100,
                    height: 40
                })
            });
            
            this.input.registerElement("confirm_no", {
                bounds: () => ({
                    x: 420,
                    y: 350,
                    width: 100,
                    height: 40
                })
            });
            
            // Don't register other elements when confirmation is active
            return;
        }
        
        // Get visible slots for current page
        const visibleSlots = this.getVisibleSlots();
        
        // Register slot elements
        visibleSlots.forEach((slot, index) => {
            const y = 150 + index * 70;
            this.input.registerElement(`save_slot_${index}`, {
                bounds: () => ({
                    x: 100,
                    y,
                    width: 600,
                    height: 60
                })
            });
        });
        
        // Register pagination buttons if we have multiple pages
        if (this.maxSlots > this.slotsPerPage) {
            // Previous page
            this.input.registerElement("prev_page", {
                bounds: () => ({
                    x: 250,
                    y: 520,
                    width: 50,
                    height: 40
                })
            });
            
            // Next page
            this.input.registerElement("next_page", {
                bounds: () => ({
                    x: 450,
                    y: 520,
                    width: 50,
                    height: 40
                })
            });
        }
        
        // Register delete/cancel button based on mode
        if (this.mode === "load") {
            this.input.registerElement("delete_button", {
                bounds: () => ({
                    x: 550,
                    y: 520,
                    width: 120,
                    height: 50
                })
            });
        } else if (this.mode === "delete") {
            this.input.registerElement("cancel_button", {
                bounds: () => ({
                    x: 550,
                    y: 520,
                    width: 120,
                    height: 50
                })
            });
        }
    }
    
    getVisibleSlots() {
        const startIndex = this.currentPage * this.slotsPerPage;
        return this.saveSlots.slice(startIndex, startIndex + this.slotsPerPage);
    }
    
    getTotalPages() {
        return Math.ceil(this.maxSlots / this.slotsPerPage);
    }
    
    cleanup() {
        // Clean up all base elements first
        super.cleanup();
        
        // Clean up confirmation dialog elements if present
        if (this.confirmationDialog) {
            this.input.removeElement("confirm_yes");
            this.input.removeElement("confirm_no");
        }
        
        // Clean up all added elements
        const visibleSlots = this.getVisibleSlots();
        visibleSlots.forEach((_, index) => {
            this.input.removeElement(`save_slot_${index}`);
        });
        
        // Clean up pagination buttons
        if (this.maxSlots > this.slotsPerPage) {
            this.input.removeElement("prev_page");
            this.input.removeElement("next_page");
        }
        
        // Clean up delete/cancel button
        if (this.mode === "load") {
            this.input.removeElement("delete_button");
        } else if (this.mode === "delete") {
            this.input.removeElement("cancel_button");
        }
        
        // Clear any pending message timeout
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
    }
    
    update() {
        // Handle confirmation dialog if active
        if (this.confirmationDialog) {
            // Yes button
            if (this.input.isElementJustPressed("confirm_yes")) {
                if (this.pendingSaveSlotId) {
                    this.processConfirmedSave();
                } else if (this.pendingDeleteSlotId) {
                    this.processConfirmedDelete();
                }
                return null;
            }
            
            // No button or cancel
            if (this.input.isElementJustPressed("confirm_no") || 
                this.input.isKeyJustPressed("Action2")) {
                // Just close the dialog
                this.confirmationDialog = null;
                this.pendingSaveSlotId = null;
                this.pendingDeleteSlotId = null;
                this.cleanup();
                this.registerElements();
                return null;
            }
            
            // Handle keyboard navigation in confirmation dialog
            if (this.input.isKeyJustPressed("DirLeft") || this.input.isKeyJustPressed("DirRight")) {
                this.confirmationDialog.selectedButton = 
                    this.confirmationDialog.selectedButton === "yes" ? "no" : "yes";
                return null;
            }
            
            // Handle Action1 key in confirmation dialog
            if (this.input.isKeyJustPressed("Action1")) {
                if (this.confirmationDialog.selectedButton === "yes") {
                    if (this.pendingSaveSlotId) {
                        this.processConfirmedSave();
                    } else if (this.pendingDeleteSlotId) {
                        this.processConfirmedDelete();
                    }
                } else {
                    this.confirmationDialog = null;
                    this.pendingSaveSlotId = null;
                    this.pendingDeleteSlotId = null;
                    this.cleanup();
                    this.registerElements();
                }
                return null;
            }
            
            // Handle mouse hovering for confirmation buttons
            if (this.input.isElementHovered("confirm_yes")) {
                this.confirmationDialog.selectedButton = "yes";
            } else if (this.input.isElementHovered("confirm_no")) {
                this.confirmationDialog.selectedButton = "no";
            }
            
            return null;
        }
        
        // Call the base update method which handles mouse input and Action keys
        const baseResult = super.update();
        if (baseResult === "exit") {
            return "exit";
        }
        
        const visibleSlots = this.getVisibleSlots();
        
        // Check for hovering/selection of save slots
        visibleSlots.forEach((slot, index) => {
            if (this.input.isElementHovered(`save_slot_${index}`)) {
                this.selectedIndex = index;
            }
            
            // Handle clicking on a save slot
            if (this.input.isElementJustPressed(`save_slot_${index}`)) {
                this.handleSlotAction(index);
            }
        });
        
        // Handle pagination
        if (this.maxSlots > this.slotsPerPage) {
            // Previous page button
            if (this.input.isElementJustPressed("prev_page") && this.currentPage > 0) {
                this.currentPage--;
                this.selectedIndex = 0;
                this.cleanup();
                this.registerElements();
                return null;
            }
            
            // Next page button
            if (this.input.isElementJustPressed("next_page") && this.currentPage < this.getTotalPages() - 1) {
                this.currentPage++;
                this.selectedIndex = 0;
                this.cleanup();
                this.registerElements();
                return null;
            }
        }
        
        // Handle delete button in load mode
        if (this.mode === "load" && this.input.isElementJustPressed("delete_button")) {
            this.mode = "delete";
            // Update UI
            this.cleanup();
            this.registerElements();
            return null;
        }
        
        // Handle cancel button in delete mode
        if (this.mode === "delete" && this.input.isElementJustPressed("cancel_button")) {
            this.mode = "load";
            // Update UI
            this.cleanup();
            this.registerElements();
            return null;
        }
        
        // Handle keyboard navigation
        if (this.input.isKeyJustPressed("DirUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            return null;
        }
        
        if (this.input.isKeyJustPressed("DirDown")) {
            this.selectedIndex = Math.min(visibleSlots.length - 1, this.selectedIndex + 1);
            return null;
        }
        
        return null;
    }
    
    handleAction1() {
        // If confirmation dialog is active
        if (this.confirmationDialog) {
            if (this.confirmationDialog.selectedButton === "yes") {
                if (this.pendingSaveSlotId) {
                    this.processConfirmedSave();
                } else if (this.pendingDeleteSlotId) {
                    this.processConfirmedDelete();
                }
            } else {
                this.confirmationDialog = null;
                this.pendingSaveSlotId = null;
                this.pendingDeleteSlotId = null;
                this.cleanup();
                this.registerElements();
            }
            return null;
        }
        
        const visibleSlots = this.getVisibleSlots();
        
        if (this.selectedIndex < visibleSlots.length) {
            // Handle slot selection
            this.handleSlotAction(this.selectedIndex);
        }
        
        return null;
    }
    
    handleAction2() {
        // If confirmation dialog is active, cancel it
        if (this.confirmationDialog) {
            this.confirmationDialog = null;
            this.pendingSaveSlotId = null;
            this.pendingDeleteSlotId = null;
            this.cleanup();
            this.registerElements();
            return null;
        }
        
        if (this.mode === "delete") {
            // Go back to load mode instead of exiting
            this.mode = "load";
            this.cleanup();
            this.registerElements();
            return null;
        }
        
        return "exit";
    }
    
    processConfirmedSave() {
        if (!this.pendingSaveSlotId) return;
        
        const result = this.saveManager.saveGame(this.gameMaster, this.pendingSaveSlotId);
        const slotNumber = this.pendingSaveSlotId.replace("slot_", "");
        
        if (result.success) {
            this.showMessage(`Game saved to slot ${slotNumber}!`, "success");
            // Refresh save list
            this.refreshSaves();
        } else {
            this.showMessage(`Error saving game: ${result.error}`, "error");
        }
        
        // Close confirmation dialog
        this.confirmationDialog = null;
        this.pendingSaveSlotId = null;
        this.cleanup();
        this.registerElements();
    }
    
    processConfirmedDelete() {
        if (!this.pendingDeleteSlotId) return;
        
        const deleteResult = this.saveManager.deleteSave(this.pendingDeleteSlotId);
        const slotNumber = this.pendingDeleteSlotId.replace("slot_", "");
        
        if (deleteResult.success) {
            this.showMessage(`Deleted save from slot ${slotNumber}!`, "success");
            // Refresh save list
            this.refreshSaves();
        } else {
            this.showMessage(`Error deleting save: ${deleteResult.error}`, "error");
        }
        
        // Close confirmation dialog
        this.confirmationDialog = null;
        this.pendingDeleteSlotId = null;
        this.cleanup();
        this.registerElements();
    }
    
    handleSlotAction(index) {
        const visibleSlots = this.getVisibleSlots();
        if (index >= visibleSlots.length) return;
        
        const slot = visibleSlots[index];
        const slotNumber = this.currentPage * this.slotsPerPage + index + 1;
        
        switch (this.mode) {
            case "save":
                // Check if we need to show confirmation dialog
                if (!slot.isEmpty) {
                    // Slot already has data, show confirmation dialog
                    this.confirmationDialog = {
                        message: `Save over existing data in Slot ${slotNumber}?`,
                        selectedButton: "no" // Default to "no" to prevent accidental overwrites
                    };
                    this.pendingSaveSlotId = `slot_${slotNumber}`;
                    this.cleanup();
                    this.registerElements();
                } else {
                    // Empty slot, no confirmation needed
                    this.saveGame(`slot_${slotNumber}`);
                }
                break;
                
            case "load":
                // Only allow loading if the slot is not empty
                if (!slot.isEmpty) {
                    this.loadGame(slot.id);
                } else {
                    this.showMessage("Cannot load from an empty slot", "error");
                }
                break;
                
            case "delete":
                // Only allow deletion if the slot is not empty
                if (!slot.isEmpty) {
                    // Show delete confirmation dialog
                    this.confirmationDialog = {
                        message: `Delete save data from Slot ${slotNumber}?`,
                        selectedButton: "no" // Default to "no" to prevent accidental deletions
                    };
                    this.pendingDeleteSlotId = `slot_${slotNumber}`;
                    this.cleanup();
                    this.registerElements();
                } else {
                    this.showMessage("Nothing to delete in an empty slot", "error");
                }
                break;
        }
    }
    
    saveGame(slotId) {
        // Create a simple slot-based name
        const slotNumber = slotId.replace("slot_", "");
        const saveName = `Slot ${slotNumber}`;
        
        const result = this.saveManager.saveGame(this.gameMaster, slotId);
        
        if (result.success) {
            this.showMessage(`Game saved to slot ${slotNumber}!`, "success");
            // Refresh save list
            this.refreshSaves();
            this.cleanup();
            this.registerElements();
        } else {
            this.showMessage(`Error saving game: ${result.error}`, "error");
        }
    }
    
    loadGame(slotId) {
        const loadResult = this.saveManager.loadGame(this.gameMaster, slotId);
        const slotNumber = slotId.replace("slot_", "");
        
        if (loadResult.success) {
            this.showMessage(`Loaded game from slot ${slotNumber}!`, "success");
            // Delay exit to show message
            setTimeout(() => {
                this.gameMaster.modeManager.switchMode("world");
            }, 1000);
        } else {
            this.showMessage(`Error loading game: ${loadResult.error}`, "error");
        }
    }
    
    deleteGame(slotId) {
        const deleteResult = this.saveManager.deleteSave(slotId);
        const slotNumber = slotId.replace("slot_", "");
        
        if (deleteResult.success) {
            this.showMessage(`Deleted save from slot ${slotNumber}!`, "success");
            // Refresh save list
            this.refreshSaves();
            this.cleanup();
            this.registerElements();
        } else {
            this.showMessage(`Error deleting save: ${deleteResult.error}`, "error");
        }
    }
    
    showMessage(text, type = "info") {
        this.message = { text, type };
        
        // Clear existing timeout
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        // Set a new timeout to clear the message
        this.messageTimeout = setTimeout(() => {
            this.message = null;
        }, 3000);
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, Game.WIDTH, Game.HEIGHT);
    
        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, Game.HEIGHT);
        gradient.addColorStop(0, this.colors.mainBackground.start);
        gradient.addColorStop(1, this.colors.mainBackground.end);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
    
        // Draw title
        const titleText = this.mode === "save" ? "Save Game" : 
                         this.mode === "load" ? "Load Game" : "Delete Save";
        this.drawTitle(titleText);
    
        // Draw save slots if no confirmation dialog
        if (!this.confirmationDialog) {
            this.drawSaveSlots();
            
            // Draw page navigation
            if (this.maxSlots > this.slotsPerPage) {
                this.drawPagination();
            }
            
            // Draw delete/cancel button based on mode
            if (this.mode === "load") {
                this.drawDeleteButton();
            } else if (this.mode === "delete") {
                this.drawCancelButton();
            }
        } else {
            // Draw confirmation dialog
            this.drawConfirmationDialog();
        }
        
        // Draw back button (unless confirmation dialog is active)
        if (!this.confirmationDialog) {
            this.drawBackButton(Game.WIDTH - 35, 5, this.backButtonSize);
        }
    
        // Draw message if present (always on top)
        if (this.message) {
            this.drawMessage();
        }
    }
    
    drawTitle(text) {
        this.ctx.save();
        this.ctx.fillStyle = this.colors.headerText;
        this.ctx.font = "36px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText(text, Game.WIDTH / 2, 80);
        this.ctx.restore();
    }
    
    drawSaveSlots() {
        const visibleSlots = this.getVisibleSlots();
        
        visibleSlots.forEach((slot, index) => {
            const y = 150 + index * 70;
            const isSelected = this.selectedIndex === index;
            
            // Draw slot background
            this.ctx.save();
            
            if (isSelected) {
                this.ctx.shadowColor = this.colors.glowColor;
                this.ctx.shadowBlur = this.colors.glowBlur;
            }
            
            // Create gradient for slot background
            const gradientColors = isSelected ? this.colors.selectedBackground : this.colors.menuBackground;
            const gradient = this.ctx.createLinearGradient(100, y, 700, y + 60);
            gradient.addColorStop(0, gradientColors.start);
            gradient.addColorStop(1, gradientColors.end);
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(100, y, 600, 60);
            
            // Draw slot info
            this.ctx.fillStyle = isSelected ? this.colors.selectedText : this.colors.normalText;
            this.ctx.font = "24px monospace";
            this.ctx.textAlign = "left";
            
            // Display slot number 
            const slotNumber = this.currentPage * this.slotsPerPage + index + 1;
            this.ctx.fillText(`Slot ${slotNumber}:`, 120, y + 25);
            
            // If slot is not empty, show save info
            if (!slot.isEmpty) {
                this.ctx.font = "18px monospace";
                const dateStr = slot.date ? slot.date.toLocaleString() : "";
                this.ctx.fillText(dateStr, 250, y + 25);
                
                // Draw character info
                const charInfo = slot.data && slot.data.party ? 
                    `${slot.data.party[0]?.name || "Unknown"} Lv.${slot.data.party[0]?.level || "?"}` : "";
                this.ctx.fillText(charInfo, 250, y + 50);
                
                // If in delete mode, show a delete indicator
                if (this.mode === "delete") {
                    this.ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
                    this.ctx.font = "24px monospace";
                    this.ctx.textAlign = "right";
                    this.ctx.fillText("DELETE", 680, y + 35);
                }
            } else {
                this.ctx.fillStyle = "rgba(150, 150, 150, 0.6)";
                this.ctx.fillText("Empty", 250, y + 25);
            }
            
            this.ctx.restore();
        });
    }
    
    drawDeleteButton() {
        this.ctx.save();
        
        // Create gradient for button background
        const gradient = this.ctx.createLinearGradient(550, 520, 670, 570);
        gradient.addColorStop(0, "rgba(128, 0, 0, 0.7)");
        gradient.addColorStop(1, "rgba(180, 0, 0, 0.7)");
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(550, 520, 120, 50);
        
        // Draw button text
        this.ctx.fillStyle = this.colors.buttonTextNormal;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Delete", 610, 550);
        
        this.ctx.restore();
    }
    
    drawCancelButton() {
        this.ctx.save();
        
        // Create gradient for button background
        const gradient = this.ctx.createLinearGradient(550, 520, 670, 570);
        gradient.addColorStop(0, "rgba(0, 100, 128, 0.7)");
        gradient.addColorStop(1, "rgba(0, 140, 180, 0.7)");
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(550, 520, 120, 50);
        
        // Draw button text
        this.ctx.fillStyle = this.colors.buttonTextNormal;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Cancel", 610, 550);
        
        this.ctx.restore();
    }
    
    drawPagination() {
        this.ctx.save();
        
        // Draw page indicator text
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`Page ${this.currentPage + 1}/${this.getTotalPages()}`, 350, 550);
        
        // Draw previous button if not on first page
        if (this.currentPage > 0) {
            this.ctx.fillStyle = this.colors.buttonNormal.start;
            this.ctx.fillRect(250, 520, 50, 40);
            this.ctx.fillStyle = this.colors.buttonTextNormal;
            this.ctx.textAlign = "center";
            this.ctx.fillText("<", 275, 545);
        }
        
        // Draw next button if not on last page
        if (this.currentPage < this.getTotalPages() - 1) {
            this.ctx.fillStyle = this.colors.buttonNormal.start;
            this.ctx.fillRect(450, 520, 50, 40);
            this.ctx.fillStyle = this.colors.buttonTextNormal;
            this.ctx.textAlign = "center";
            this.ctx.fillText(">", 475, 545);
        }
        
        this.ctx.restore();
    }
    
    drawConfirmationDialog() {
        this.ctx.save();
        
        // Darken the background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this.ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
        
        // Draw dialog box
        const dialogWidth = 500;
        const dialogHeight = 200;
        const dialogX = (Game.WIDTH - dialogWidth) / 2;
        const dialogY = (Game.HEIGHT - dialogHeight) / 2;
        
        // Create dialog background
        const gradient = this.ctx.createLinearGradient(dialogX, dialogY, dialogX, dialogY + dialogHeight);
        gradient.addColorStop(0, this.colors.menuBackground.start);
        gradient.addColorStop(1, this.colors.menuBackground.end);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
        
        // Draw border
        this.ctx.strokeStyle = this.colors.panelBorder.light;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);
        
        // Draw message text
        this.ctx.fillStyle = this.colors.headerText;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Confirmation", Game.WIDTH / 2, dialogY + 40);
        
        this.ctx.fillStyle = this.colors.normalText;
        this.ctx.font = "20px monospace";
        this.ctx.fillText(this.confirmationDialog.message, Game.WIDTH / 2, dialogY + 100);
        
        // Draw Yes button
        const yesButtonX = 300;
        const yesButtonY = 350;
        const buttonWidth = 100;
        const buttonHeight = 40;
        
        // Yes button background
        const isYesSelected = this.confirmationDialog.selectedButton === "yes";
        this.ctx.fillStyle = isYesSelected ? this.colors.selectedBackground.start : this.colors.buttonNormal.start;
        this.ctx.fillRect(yesButtonX, yesButtonY, buttonWidth, buttonHeight);
        
        // Yes button text
        this.ctx.fillStyle = isYesSelected ? this.colors.selectedText : this.colors.buttonTextNormal;
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Yes", yesButtonX + buttonWidth / 2, yesButtonY + 28);
        
        // Draw No button
        const noButtonX = 420;
        const noButtonY = 350;
        
        // No button background
        const isNoSelected = this.confirmationDialog.selectedButton === "no";
        this.ctx.fillStyle = isNoSelected ? this.colors.selectedBackground.start : this.colors.buttonNormal.start;
        this.ctx.fillRect(noButtonX, noButtonY, buttonWidth, buttonHeight);
        
        // No button text
        this.ctx.fillStyle = isNoSelected ? this.colors.selectedText : this.colors.buttonTextNormal;
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("No", noButtonX + buttonWidth / 2, noButtonY + 28);
        
        this.ctx.restore();
    }
    
    drawMessage() {
        this.ctx.save();
        
        // Draw message box at the top instead of bottom to avoid overlapping other elements
        const messageY = 10;
        const messageWidth = 500;
        const messageHeight = 40;
        const messageX = (Game.WIDTH - messageWidth) / 2;
        
        // Set color based on message type
        let backgroundColor;
        switch (this.message.type) {
            case "success":
                backgroundColor = "rgba(0, 128, 0, 0.8)";
                break;
            case "error":
                backgroundColor = "rgba(128, 0, 0, 0.8)";
                break;
            default:
                backgroundColor = "rgba(0, 0, 128, 0.8)";
                break;
        }
        
        // Check if roundRect is supported by the context
        if (this.ctx.roundRect) {
            // Draw message background with rounded corners
            this.ctx.fillStyle = backgroundColor;
            this.ctx.beginPath();
            this.ctx.roundRect(messageX, messageY, messageWidth, messageHeight, 8);
            this.ctx.fill();
        } else {
            // Fallback for browsers that don't support roundRect
            this.ctx.fillStyle = backgroundColor;
            this.ctx.fillRect(messageX, messageY, messageWidth, messageHeight);
        }
        
        // Draw message text
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "18px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.message.text, Game.WIDTH / 2, messageY + 25);
        
        this.ctx.restore();
    }
}
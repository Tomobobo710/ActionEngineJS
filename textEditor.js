// Text Editor for notes (2D overlay)
export class TextEditor {
	constructor(game) {
		this.game = game;
		this.isOpen = false;
		this.currentBlock = null;
		this.textContent = "";
		this.titleContent = ""; // New: for block title
		this.scrollOffset = 0;

		// Editor dimensions
		this.width = 600;
		this.height = 400;
		this.x = (800 - this.width) / 2;
		this.y = (600 - this.height) / 2;
		this.padding = 20;

        // Title input dimensions
        this.titleInputX = this.x + this.padding;
        this.titleInputY = this.y + 60;
        this.titleInputWidth = this.width - this.padding * 2;
        this.titleInputHeight = 30;

		// Text area dimensions
		this.textAreaX = this.x + this.padding;
		this.textAreaY = this.y + 100; // Adjusted Y for title input
		this.textAreaWidth = this.width - this.padding * 2;
		this.textAreaHeight = this.height - 180; // Adjusted height

		// Button dimensions
		this.buttonWidth = 120;
		this.buttonHeight = 40;
		this.buttonY = this.y + this.height - 60;

		// Cursor state
		this.cursorPosition = 0;
		this.cursorBlinkTime = 0;
		this.cursorVisible = true;

        // Title cursor state
        this.titleCursorPosition = 0;
        this.titleCursorBlinkTime = 0;
        this.titleCursorVisible = true;
        this.isTitleFocused = false;

		// Register UI elements
		this.registerElements();
	}

	registerElements() {
        // Title input area
        this.game.input.registerElement("editorTitleInput", {
            bounds: () => ({
                x: this.titleInputX,
                y: this.titleInputY,
                width: this.titleInputWidth,
                height: this.titleInputHeight
            })
        }, "gui");

		// Save button
		this.game.input.registerElement("editorSave", {
			bounds: () => ({
				x: this.x + this.padding,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Delete Note button
		this.game.input.registerElement("editorDeleteNote", { // Changed ID
			bounds: () => ({
				x: this.x + this.padding + this.buttonWidth + 20,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Delete Block button
		this.game.input.registerElement("editorDeleteBlock", {
			bounds: () => ({
				x: this.x + this.padding + (this.buttonWidth + 20) * 2, // Position next to delete note
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Close button
		this.game.input.registerElement("editorClose", {
			bounds: () => ({
				x: this.x + this.width - this.padding - this.buttonWidth,
				y: this.buttonY,
				width: this.buttonWidth,
				height: this.buttonHeight
			})
		}, "gui");

		// Text area (for click to focus)
		this.game.input.registerElement("editorTextArea", {
			bounds: () => ({
				x: this.textAreaX,
				y: this.textAreaY,
				width: this.textAreaWidth,
				height: this.textAreaHeight
			})
		}, "gui");
	}

	open(block) {
		if (!block) {
			console.error('❌ Cannot open text editor: block is undefined');
			return;
		}

		this.isOpen = true;
		this.currentBlock = block;
		this.textContent = block.getText() || "";
        this.titleContent = block.getTitle() || ""; // Populate title
		this.cursorPosition = this.textContent.length;
        this.titleCursorPosition = this.titleContent.length;
		this.scrollOffset = 0;
        this.isTitleFocused = false; // Start with text area focused

		// Capture keyboard input
		this.game.capturingTextInput = true;
		this.game.inputManager.toggleCursorLock(false); // Unlock cursor when editor opens
	}

	close() {
		this.isOpen = false;
		this.currentBlock = null;
		this.game.capturingTextInput = false;
		this.game.inputManager.toggleCursorLock(true); // Re-lock cursor when editor closes
        if (this.textarea) {
            document.body.removeChild(this.textarea);
            this.textarea = null;
        }
        if (this.titleInput) {
            document.body.removeChild(this.titleInput);
            this.titleInput = null;
        }
	}

	save() {
		if (this.currentBlock) {
		    this.currentBlock.setText(this.textContent);
	           this.currentBlock.setTitle(this.titleContent); // Save title
		    this.game.blockManager.saveToStorage();
		    this.game.uiManager.addMessage("Note saved!");
		}
		this.close();
	}

	deleteNote() {
		if (this.currentBlock) {
			this.currentBlock.setText("");
			this.game.blockManager.saveToStorage(); // Use blockManager.saveToStorage
			this.game.uiManager.addMessage("Note deleted!");
		}
		this.close();
	}

    deleteBlock() {
        if (this.currentBlock) {
            this.game.blockManager.deleteBlock(this.currentBlock.id); // Call blockManager method to delete block
            this.game.uiManager.addMessage("Block deleted!");
        }
        this.close();
    }

	handleInput() {
	   if (!this.isOpen) return;

	   // Handle button clicks
	   if (this.game.input.isElementJustPressed("editorSave", "gui")) {
	       this.save();
	       return;
	   }

	   if (this.game.input.isElementJustPressed("editorDeleteNote", "gui")) {
	       this.deleteNote();
	       return;
	   }

	   if (this.game.input.isElementJustPressed("editorDeleteBlock", "gui")) {
	       this.deleteBlock();
	       return;
	   }

	   if (this.game.input.isElementJustPressed("editorClose", "gui")) {
	       this.close();
	       return;
	   }

        // Handle focus switching between title and text area
        if (this.game.input.isElementJustPressed("editorTitleInput", "gui")) {
            this.isTitleFocused = true;
            if (this.textarea) this.textarea.blur(); // Unfocus text area
        } else if (this.game.input.isElementJustPressed("editorTextArea", "gui")) {
            this.isTitleFocused = false;
            if (this.titleInput) this.titleInput.blur(); // Unfocus title input
        }

	   // Handle title input when editor is open
	   if (this.isOpen && !this.titleInput) {
	       this.titleInput = document.createElement('input');
	       this.titleInput.type = 'text';
	       this.titleInput.style.position = 'absolute';
	       this.titleInput.style.left = '-9999px';
	       this.titleInput.style.top = '-9999px';
	       this.titleInput.style.width = '1px';
	       this.titleInput.style.height = '1px';
	       this.titleInput.style.opacity = '0';
	       this.titleInput.style.pointerEvents = 'none';
	       this.titleInput.style.zIndex = '-1';
	       document.body.appendChild(this.titleInput);

	       this.titleInput.addEventListener('input', (e) => {
	           this.titleContent = e.target.value;
	           this.titleCursorPosition = e.target.selectionStart;
	       });
	   }

	   // Handle text input when editor is open
	   if (this.isOpen && !this.textarea) { // Only create textarea once
	       this.textarea = document.createElement('textarea');
	       this.textarea.style.position = 'absolute';
	       this.textarea.style.left = '-9999px';
	       this.textarea.style.top = '-9999px';
	       this.textarea.style.width = '1px';
	       this.textarea.style.height = '1px';
	       this.textarea.style.opacity = '0';
	       this.textarea.style.pointerEvents = 'none';
	       this.textarea.style.zIndex = '-1';
	       document.body.appendChild(this.textarea);

	       this.textarea.addEventListener('input', (e) => {
	           this.textContent = e.target.value;
	           this.cursorPosition = e.target.selectionStart;
	       });

	       this.textarea.addEventListener('keydown', (e) => {
	           if (e.key === 'Enter' && !e.shiftKey) { // Regular Enter for new line
	               e.preventDefault();
	               this.textContent = this.textContent.slice(0, this.cursorPosition) +
	                                '\n' + this.textContent.slice(this.cursorPosition);
	               this.cursorPosition++;
	           } else if (e.key === 'Enter' && e.shiftKey) { // Shift+Enter to save/close
	               e.preventDefault();
	               this.save();
	           } else if (e.key === 'Backspace') {
	               // Handled by default textarea behavior
	           }
	       });
	   }

	   if (this.isOpen && this.titleInput && this.isTitleFocused) {
	       this.titleInput.focus();
	       this.titleInput.value = this.titleContent;
	       this.titleInput.setSelectionRange(this.titleCursorPosition, this.titleCursorPosition);
	   } else if (this.isOpen && this.textarea && !this.isTitleFocused) {
	       // Focus the hidden textarea
	       this.textarea.focus();
	       this.textarea.value = this.textContent;
	       this.textarea.setSelectionRange(this.cursorPosition, this.cursorPosition);
	   }
	}

	update(deltaTime) {
		if (!this.isOpen) return;

		// Cursor blink animation for text area
		this.cursorBlinkTime += deltaTime;
		if (this.cursorBlinkTime > 0.5) {
			this.cursorVisible = !this.cursorVisible;
			this.cursorBlinkTime = 0;
		}

		// Cursor blink animation for title input
		this.titleCursorBlinkTime += deltaTime;
		if (this.titleCursorBlinkTime > 0.5) {
			this.titleCursorVisible = !this.titleCursorVisible;
			this.titleCursorBlinkTime = 0;
		}
	}

	draw(ctx) {
		if (!this.isOpen) return;

		// Semi-transparent backdrop
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(0, 0, 800, 600);

		// Editor window background
		ctx.fillStyle = "#2a2a3e";
		ctx.fillRect(this.x, this.y, this.width, this.height);

		// Border
		ctx.strokeStyle = "#4a4a6e";
		ctx.lineWidth = 2;
		ctx.strokeRect(this.x, this.y, this.width, this.height);

		// Title bar
		ctx.fillStyle = "#1a1a2e";
		ctx.fillRect(this.x, this.y, this.width, 50);

		ctx.fillStyle = "#ffffff";
		ctx.font = "20px Arial";
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		ctx.fillText(`Block Notes: ${this.currentBlock ? this.currentBlock.getTitle() : ''}`, this.x + this.padding, this.y + 25);

        // Title input label
        ctx.fillStyle = "#e0e0e0";
        ctx.font = "14px Arial";
        ctx.fillText("Title:", this.titleInputX, this.titleInputY - 15);

        // Title input background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(this.titleInputX, this.titleInputY, this.titleInputWidth, this.titleInputHeight);

        // Title input border
        ctx.strokeStyle = this.isTitleFocused ? "#00ffff" : "#4a4a6e"; // Highlight if focused
        ctx.lineWidth = 1;
        ctx.strokeRect(this.titleInputX, this.titleInputY, this.titleInputWidth, this.titleInputHeight);

        // Draw title content
        ctx.fillStyle = "#e0e0e0";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.titleContent, this.titleInputX + 5, this.titleInputY + this.titleInputHeight / 2);

        // Draw title cursor
        if (this.isTitleFocused && this.titleCursorVisible) {
            const cursorX = this.titleInputX + 5 + ctx.measureText(this.titleContent.slice(0, this.titleCursorPosition)).width;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(cursorX, this.titleInputY + 5, 2, this.titleInputHeight - 10);
        }

		// Text area background
		ctx.fillStyle = "#1a1a2e";
		ctx.fillRect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);

		// Text area border
		ctx.strokeStyle = !this.isTitleFocused ? "#00ffff" : "#4a4a6e"; // Highlight if focused
		ctx.lineWidth = 1;
		ctx.strokeRect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);

		// Draw text content
		ctx.save();
		ctx.beginPath();
		ctx.rect(this.textAreaX, this.textAreaY, this.textAreaWidth, this.textAreaHeight);
		ctx.clip();

		ctx.fillStyle = "#e0e0e0";
		ctx.font = "16px monospace";
		ctx.textAlign = "left";
		ctx.textBaseline = "top";

		const lines = this.textContent.split('\n');
		const lineHeight = 22;
		let y = this.textAreaY + 10 - this.scrollOffset;

		lines.forEach((line, index) => {
			ctx.fillText(line || " ", this.textAreaX + 10, y);
			y += lineHeight;
		});

		// Draw cursor
		if (!this.isTitleFocused && this.cursorVisible) {
			const cursorLine = this.textContent.slice(0, this.cursorPosition).split('\n').length - 1;
			const cursorY = this.textAreaY + 10 + (cursorLine * lineHeight) - this.scrollOffset;
			const lastLineText = this.textContent.slice(0, this.cursorPosition).split('\n').pop();
			const cursorX = this.textAreaX + 10 + ctx.measureText(lastLineText).width;

			ctx.fillStyle = "#ffffff";
			ctx.fillRect(cursorX, cursorY, 2, 18);
		}

		ctx.restore();

		// Draw buttons
		this.drawButton(ctx, "Save", this.x + this.padding, this.buttonY,
			this.game.input.isElementHovered("editorSave", "gui"));

		this.drawButton(ctx, "Clear Note", this.x + this.padding + this.buttonWidth + 20, this.buttonY, // Changed text and ID
			this.game.input.isElementHovered("editorDeleteNote", "gui"));

		this.drawButton(ctx, "Delete Block", this.x + this.padding + (this.buttonWidth + 20) * 2, this.buttonY, // New button
			this.game.input.isElementHovered("editorDeleteBlock", "gui"));

		this.drawButton(ctx, "Close", this.x + this.width - this.padding - this.buttonWidth, this.buttonY,
			this.game.input.isElementHovered("editorClose", "gui"));

		// Instructions
		ctx.fillStyle = "#888888";
		ctx.font = "12px Arial";
		ctx.textAlign = "center";
		ctx.fillText("Type to add text • Action1: New Line • Action2: Backspace • Click Title/Text to Focus",
			this.x + this.width / 2, this.y + this.height - 20);
	}

	drawButton(ctx, text, x, y, hovered) {
		ctx.fillStyle = hovered ? "#4a6fa5" : "#3a5f95";
		ctx.fillRect(x, y, this.buttonWidth, this.buttonHeight);

		ctx.strokeStyle = "#5a7fb5";
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, this.buttonWidth, this.buttonHeight);

		ctx.fillStyle = "#ffffff";
		ctx.font = "16px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, x + this.buttonWidth / 2, y + this.buttonHeight / 2);
	}
}
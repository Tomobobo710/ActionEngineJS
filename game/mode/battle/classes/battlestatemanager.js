// game/mode/battle/classes/battlestatemanager.js
class BattleStateManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        
        // State properties - directly accessible
        this.state = "init";
        this.stateStartTime = null;
        this.readyForWorldTransition = false;
        this.transitionProgress = 0;
        this.isPaused = false;
        
        // Battle flow state
        this.activeChar = null;
        this.actionQueue = [];
        this.readyOrder = [];
        this.isProcessingAction = false;
        
        // Menu state
        this.currentMenu = "main";
        this.selectedAction = null;
        this.menuPosition = 0;
        this.subMenuPosition = 0;
        this.pendingSpell = null;
        this.pendingItem = null;
        
        // UI state
        this.hoveredMenuOption = null;
        this.hoveredItem = null;
        this.hoveredSpell = null;
        this.showCancelButton = false;
        this.upArrowHovered = false;
        this.downArrowHovered = false;
        this.currentMessage = null;
        
        // Pagination
        this.itemScrollOffset = 0;
        this.spellScrollOffset = 0;
        this.maxVisibleItems = 8;
        this.maxVisibleSpells = 8;
        
        // Animation state
        this.animations = [];
    }

    // Core state management
    resetState() {
        this.activeChar = null;
        this.currentMenu = "main";
        this.selectedAction = null;
        this.pendingSpell = null;
        this.pendingItem = null;
        this.showCancelButton = false;
    }
    
    enterBattleState() {
        this.state = "battle";
    }
    
    enterVictoryState() {
        this.state = "victory";
        this.transitionProgress = 0;
        this.stateStartTime = null;
    }
    
    enterGameOverState() {
        this.state = "gameover";
        this.transitionProgress = 0;
        this.stateStartTime = null;
    }
    
    enterResultsState() {
        this.state = "results";
        this.stateStartTime = null;
    }
    
    // Message handling
    showMessage(message) {
        this.currentMessage = {
            text: message,
            alpha: 1.0,
            startTime: Date.now()
        };
    }
    
    updateMessage() {
        if (this.currentMessage) {
            const messageAge = Date.now() - this.currentMessage.startTime;
            if (messageAge > 1000) {
                this.currentMessage.alpha = Math.max(0, 1 - (messageAge - 1000) / 1000);
            }
            if (this.currentMessage.alpha <= 0) {
                this.currentMessage = null;
            }
        }
    }
    
    // Animation handling
    addAnimation(animation) {
        this.animations.push(animation);
    }
    
    updateAnimations() {
        this.animations = this.animations.filter(anim => {
            anim.update();
            return !anim.finished;
        });
    }
    
    // Action queue management
    queueAction(action) {
        this.actionQueue.push(action);
    }
    
    dequeueAction() {
        return this.actionQueue.shift();
    }
    
    addReadyCharacter(character) {
        if (!this.readyOrder.includes(character)) {
            this.readyOrder.push(character);
        }
    }
    
    getNextReadyCharacter() {
        return this.readyOrder.length > 0 ? this.readyOrder[0] : null;
    }
    
    removeFromReadyOrder(character) {
        this.readyOrder = this.readyOrder.filter(char => char !== character);
    }
    
    // Update methods
    updateTransitions() {
    switch (this.state) {
        case "init":
            if (this.transitionProgress < 1) {
                this.transitionProgress += 0.02;
            } else {
                this.state = "battle";
            }
            break;

        case "victory":
        case "gameover":
        case "post_results": // Add this case
            if (this.transitionProgress < 1) {
                this.transitionProgress += 0.01;
            }
            break;
    }
}
    
    checkBattleEnd(party, enemies) {
        if (party.every(char => !char || char.isDead)) {
            this.enterGameOverState();
            return true;
        } else if (enemies.every(enemy => enemy.isDead)) {
            this.enterVictoryState();
            return true;
        }
        return false;
    }
}
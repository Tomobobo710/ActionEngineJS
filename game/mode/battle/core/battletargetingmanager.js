// game/mode/battle/core/battletargetingmanager.js
class BattleTargetingManager {
    constructor(battleSystem) {
        this.battle = battleSystem;
        
        // Targeting state
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.currentTargetGroup = "enemies";
        this.defaultTargetGroup = "enemies";
        this.isSingleTarget = true;
        this.isGroupTarget = false;
        this.hoveredTarget = null;
    }

    startTargeting(targetType) {
        this.targetingMode = true;

        // Set defaults based on action type
        switch (targetType) {
            case TARGET_TYPES.SINGLE_ENEMY:
                this.defaultTargetGroup = "enemies";
                this.isSingleTarget = true;
                this.isGroupTarget = false;
                break;
            case TARGET_TYPES.ALL_ENEMIES:
                this.defaultTargetGroup = "enemies";
                this.isSingleTarget = false;
                this.isGroupTarget = true;
                break;
            case TARGET_TYPES.SINGLE_ALLY:
                this.defaultTargetGroup = "allies";
                this.isSingleTarget = true;
                this.isGroupTarget = false;
                break;
            case TARGET_TYPES.ALL_ALLIES:
                this.defaultTargetGroup = "allies";
                this.isSingleTarget = false;
                this.isGroupTarget = true;
                break;
        }

        // Initialize to default group but allow switching
        this.currentTargetGroup = this.defaultTargetGroup;
        this.updateTargetList();
        
        // Let the battle system know we're in targeting mode for UI updates
        this.battle.showCancelButton = true;
    }

    updateTargetList() {
        // Get all targets in the current group (allies or enemies)
        const targetsAll = this.currentTargetGroup === "enemies" ? this.battle.enemies : this.battle.party;
        
        // Check if we're using a Phoenix - special case for targeting dead characters
        const isUsingPhoenix = this.battle.pendingItem && this.battle.pendingItem.name === "Phoenix";
        
        // Filter based on whether we're using a Phoenix or not
        let targetsFiltered;
        
        if (isUsingPhoenix) {
            // For Phoenix, we specifically target DEAD characters
            targetsFiltered = targetsAll.filter(target => target && target.isDead);
        } else {
            // Normal case - target only living characters
            targetsFiltered = targetsAll.filter(target => target && !target.isDead);
        }
        
        // For targeting, update the target list based on individual or group targeting
        this.targetList = this.isGroupTarget ? [targetsFiltered] : targetsFiltered;
        this.targetIndex = 0;
    }

    executeTargetedAction(target) {
        this.hoveredTarget = null;

        // First check if this character already has a queued action
        const existingAction = this.battle.actionQueue.find((action) => action.character === this.battle.activeChar);

        if (existingAction) {
            const message = `${this.battle.activeChar.name} already has an action queued!`;
            this.battle.battleLog.addMessage(message, "damage");
            this.battle.showBattleMessage(message);
            this.battle.audio.play("menu_error");
            return;
        }

        let actionObject = {
            character: this.battle.activeChar,
            target: target,
            isGroupTarget: this.isGroupTarget
        };

        if (this.battle.selectedAction === "fight") {
            actionObject.type = "attack";
        } else if (this.battle.pendingSpell) {
            actionObject.type = "spell";
            actionObject.spell = this.battle.pendingSpell;
        } else if (this.battle.selectedAction === "item" && this.battle.pendingItem) {
            actionObject.type = "item";
            actionObject.item = this.battle.pendingItem;
        }

        // Queue the action
        this.battle.actionQueue.push(actionObject);

        // After queueing the action, remove the character from readyOrder
        this.battle.readyOrder = this.battle.readyOrder.filter((char) => char !== this.battle.activeChar);

        // Reset character state after queueing
        this.battle.activeChar.isReady = false;
        this.battle.activeChar.atbCurrent = 0;

        // Reset UI state
        this.endTargeting();
        this.battle.currentMenu = "main";
        this.battle.selectedAction = null;
        this.battle.pendingItem = null;
        this.battle.pendingSpell = null;
        this.battle.activeChar = null;
        this.battle.audio.play("menu_select");
    }

    endTargeting() {
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.hoveredTarget = null;
        this.battle.showCancelButton = false;
    }

    switchTargetGroup() {
        this.currentTargetGroup = this.currentTargetGroup === "enemies" ? "allies" : "enemies";
        this.updateTargetList();
    }

    getTargetAt(index) {
        if (this.targetList.length === 0) return null;
        if (index >= 0 && index < this.targetList.length) {
            return this.targetList[index];
        }
        return null;
    }

    getCurrentTarget() {
        return this.getTargetAt(this.targetIndex);
    }

    setTargetIndex(index) {
        if (index >= 0 && index < this.targetList.length) {
            this.targetIndex = index;
        }
    }
}
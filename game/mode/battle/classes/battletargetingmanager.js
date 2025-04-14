// game/mode/battle/classes/battletargetingmanager.js
class BattleTargetingManager {
    constructor(battleSystem) {
        this.battle = battleSystem;

        // Targeting state
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
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
        this.battle.stateManager.currentTargetGroup = this.defaultTargetGroup;
        this.updateTargetList();

        // Let the battle system know we're in targeting mode for UI updates
        this.battle.stateManager.showCancelButton = true;
    }

    updateTargetList() {
        // Get all targets in the current group (allies or enemies)
        const targetsAll =
            this.battle.stateManager.currentTargetGroup === "enemies" ? this.battle.enemies : this.battle.party;

        // Check if we're using a Phoenix - special case for targeting dead characters
        const isUsingPhoenix =
            this.battle.stateManager.pendingItem && this.battle.stateManager.pendingItem.name === "Phoenix";

        // Filter based on whether we're using a Phoenix or not
        let targetsFiltered;

        if (isUsingPhoenix) {
            // For Phoenix, we specifically target DEAD characters
            targetsFiltered = targetsAll.filter((target) => target && target.isDead);
        } else {
            // Normal case - target only living characters
            targetsFiltered = targetsAll.filter((target) => target && !target.isDead);
        }

        // For targeting, update the target list based on individual or group targeting
        this.targetList = this.isGroupTarget ? [targetsFiltered] : targetsFiltered;
        this.targetIndex = 0;
    }

    executeTargetedAction(target) {
        this.hoveredTarget = null;

        // First check if this character already has a queued action
        const existingAction = this.battle.stateManager.actionQueue.find(
            (action) => action.character === this.battle.stateManager.activeChar
        );

        if (existingAction) {
            const message = `${this.battle.stateManager.activeChar.name} already has an action queued!`;
            this.battle.battleLog.addMessage(message, "damage");
            this.battle.showBattleMessage(message);
            this.battle.audio.play("menu_error");
            return;
        }

        let actionObject = {
            character: this.battle.stateManager.activeChar,
            target: target,
            isGroupTarget: this.isGroupTarget
        };

        if (this.battle.stateManager.selectedAction === "fight") {
            actionObject.type = "attack";
        } else if (this.battle.stateManager.pendingSpell) {
            actionObject.type = "spell";
            actionObject.spell = this.battle.stateManager.pendingSpell;
        } else if (this.battle.stateManager.selectedAction === "item" && this.battle.stateManager.pendingItem) {
            actionObject.type = "item";
            actionObject.item = this.battle.stateManager.pendingItem;
        }

        // Queue the action
        this.battle.stateManager.actionQueue.push(actionObject);

        // After queueing the action, remove the character from readyOrder
        this.battle.stateManager.readyOrder = this.battle.stateManager.readyOrder.filter(
            (char) => char !== this.battle.stateManager.activeChar
        );

        // Reset character state after queueing
        this.battle.stateManager.activeChar.isReady = false;
        this.battle.stateManager.activeChar.atbCurrent = 0;

        // Reset UI state
        this.endTargeting();
        this.battle.stateManager.currentMenu = "main";
        this.battle.stateManager.selectedAction = null;
        this.battle.stateManager.pendingItem = null;
        this.battle.stateManager.pendingSpell = null;
        this.battle.stateManager.activeChar = null;
        this.battle.audio.play("menu_select");
    }

    endTargeting() {
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.hoveredTarget = null;
        this.battle.stateManager.showCancelButton = false;
    }

    switchTargetGroup() {
        this.battle.stateManager.currentTargetGroup =
            this.battle.stateManager.currentTargetGroup === "enemies" ? "allies" : "enemies";
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
// game/mode/battle/classes/battleaicontroller.js
class BattleAIController {
    constructor(battleSystem) {
        this.battle = battleSystem;
    }

    handleEnemyInput(enemy) {
        // Add check to make sure the enemy isn't dead
        if (enemy.isDead) {
            console.log(`${enemy.name} is dead and cannot take action`);
            enemy.isReady = false;
            enemy.atbCurrent = 0;
            return;
        }
        const livingPartyMembers = this.battle.party.filter((member) => !member.isDead);
        const livingEnemies = this.battle.enemies.filter((e) => !e.isDead);

        if (livingPartyMembers.length === 0) return;

        const actions = [];

        // Basic attack
        actions.push({
            type: "attack",
            weight: 50,
            target: () => livingPartyMembers[Math.floor(Math.random() * livingPartyMembers.length)],
            isGroupTarget: false
        });

        // Consider spells
        if (enemy.spells && enemy.mp > 0) {
            enemy.spells.forEach((spellId) => {
                const spell = SPELLS[spellId];
                if (enemy.mp >= spell.mpCost) {
                    const isGroup =
                        spell.targetType === TARGET_TYPES.ALL_ENEMIES || spell.targetType === TARGET_TYPES.ALL_ALLIES;

                    // Reverse the targeting for enemy spells
                    let targets;
                    switch (spell.targetType) {
                        case TARGET_TYPES.SINGLE_ENEMY:
                        case TARGET_TYPES.ALL_ENEMIES:
                            targets = livingPartyMembers;
                            break;
                        case TARGET_TYPES.SINGLE_ALLY:
                        case TARGET_TYPES.ALL_ALLIES:
                            targets = livingEnemies;
                            break;
                    }

                    actions.push({
                        type: "spell",
                        spell: spell,
                        weight: 30,
                        target: () => (isGroup ? targets : targets[Math.floor(Math.random() * targets.length)]),
                        isGroupTarget: isGroup
                    });
                }
            });
        }

        // Consider items
        const availableItems = this.battle.enemyInventory.getAvailableItems();
        availableItems.forEach(({ id, item }) => {
            const isGroup = item.targetType === TARGET_TYPES.ALL_ENEMIES || item.targetType === TARGET_TYPES.ALL_ALLIES;

            // Reverse the targeting for enemy items
            let targets;
            switch (item.targetType) {
                case TARGET_TYPES.SINGLE_ENEMY:
                case TARGET_TYPES.ALL_ENEMIES:
                    targets = livingPartyMembers;
                    break;
                case TARGET_TYPES.SINGLE_ALLY:
                case TARGET_TYPES.ALL_ALLIES:
                    targets = livingEnemies;
                    break;
            }

            // Healing items logic
            if (item.targetType === TARGET_TYPES.SINGLE_ALLY && enemy.hp < enemy.maxHp * 0.3) {
                actions.push({
                    type: "item",
                    item: item,
                    itemId: id,
                    weight: 80,
                    target: () => enemy,
                    isGroupTarget: false
                });
            }
            // Offensive items logic
            else if (item.targetType === TARGET_TYPES.ALL_ENEMIES && livingPartyMembers.length > 1) {
                actions.push({
                    type: "item",
                    item: item,
                    itemId: id,
                    weight: 60,
                    target: () => targets,
                    isGroupTarget: isGroup
                });
            }
        });

        // Select and queue action
        if (actions.length > 0) {
            const totalWeight = actions.reduce((sum, action) => sum + action.weight, 0);
            let random = Math.random() * totalWeight;
            let selectedAction = actions[0];

            for (const action of actions) {
                random -= action.weight;
                if (random <= 0) {
                    selectedAction = action;
                    break;
                }
            }

            const actionObject = {
                character: enemy,
                type: selectedAction.type,
                target: selectedAction.target(),
                isGroupTarget: selectedAction.isGroupTarget
            };

            if (selectedAction.spell) {
                actionObject.spell = selectedAction.spell;
            }
            if (selectedAction.item) {
                actionObject.item = selectedAction.item;
                this.battle.enemyInventory.removeItem(selectedAction.itemId);
            }

            this.battle.actionQueue.push(actionObject);
        }

        enemy.isReady = false;
        enemy.atbCurrent = 0;
    }
}

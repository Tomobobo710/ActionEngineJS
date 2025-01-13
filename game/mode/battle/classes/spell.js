// game/mode/batle/classes/spell.js
class Spell {
    constructor(data) {
        this.name = data.name;
        this.mpCost = data.mpCost;
        this.power = data.power;
        this.element = data.element;
        this.targetType = data.targetType; // 'single' or 'all'
        this.animation = data.animation;
    }
}
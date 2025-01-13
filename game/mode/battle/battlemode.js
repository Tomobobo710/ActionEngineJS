// battle-rpg/classes/Sprite.js
class BattleLog {
    constructor() {
        this.messages = [];
        this.maxMessages = 5;
    }

    addMessage(text, type = 'normal') {
        this.messages.unshift({ 
            text,
            type, // 'normal', 'damage', 'heal', 'critical', etc.
            timestamp: Date.now()
        });
        
        // Keep only the last maxMessages
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
    }

    clear() {
        this.messages = [];
    }
}

class Sprite {
   static genHeroSprite(type) {
       const c = document.createElement('canvas');
       c.width = c.height = 32;
       const ctx = c.getContext('2d');
       
       switch(type) {
           case 'warrior':
               // Body
               ctx.fillStyle = '#4444aa';
               ctx.fillRect(8, 4, 16, 24);
               
               // Head
               ctx.fillStyle = '#ffcc99'; 
               ctx.fillRect(10, 0, 12, 8);
               
               // Hair
               ctx.fillStyle = '#332211';
               ctx.fillRect(8, 0, 16, 4);
               
               // Armor
               ctx.fillStyle = '#8888ff';
               ctx.fillRect(6, 12, 20, 8);
               
               // Shield
               ctx.fillStyle = '#aa4444';
               ctx.fillRect(4, 16, 8, 8);
               
               // Sword
               ctx.fillStyle = '#cccccc';
               ctx.fillRect(20, 8, 4, 16);
               
               break;
               
           case 'mage':
               // Robe
               ctx.fillStyle = '#884488';
               ctx.fillRect(8, 4, 16, 24);
               
               // Head
               ctx.fillStyle = '#ffcc99';
               ctx.fillRect(10, 0, 12, 8);
               
               // Hat
               ctx.fillStyle = '#aa44aa'; 
               ctx.beginPath();
               ctx.moveTo(8, 4);
               ctx.lineTo(16, 0);
               ctx.lineTo(24, 4);
               ctx.fill();
               
               // Staff
               ctx.fillStyle = '#885500';
               ctx.fillRect(20, 8, 4, 20);
               ctx.fillStyle = '#ffff00';
               ctx.fillRect(18, 4, 8, 8);
               
               break;
               
           case 'thief':
               // Body
               ctx.fillStyle = '#448844';
               ctx.fillRect(8, 4, 16, 24);
               
               // Head
               ctx.fillStyle = '#ffcc99';
               ctx.fillRect(10, 0, 12, 8);
               
               // Hood
               ctx.fillStyle = '#226622';
               ctx.fillRect(8, 0, 16, 4);
               ctx.fillRect(6, 4, 4, 8);
               ctx.fillRect(22, 4, 4, 8);
               
               // Cape
               ctx.fillStyle = '#226622';
               ctx.fillRect(6, 12, 20, 8);
               
               // Daggers
               ctx.fillStyle = '#cccccc';
               ctx.fillRect(4, 16, 8, 4);
               ctx.fillRect(20, 16, 8, 4);
               
               break;
       }
       
       // Add pixel art shading
       ctx.fillStyle = 'rgba(255,255,255,0.2)';
       for(let x = 0; x < 32; x+=2) {
           for(let y = 0; y < 32; y+=2) {
               if(Math.random() < 0.2) {
                   ctx.fillRect(x, y, 2, 2);
               }
           }
       }
       
       return c;
   }

   static genEnemySprite(type) {
       const c = document.createElement('canvas');
       c.width = c.height = 48;
       const ctx = c.getContext('2d');
       
       switch(type) {
           case 'slime':
               // Body 
               ctx.fillStyle = '#44aa44';
               ctx.beginPath();
               ctx.ellipse(24, 32, 20, 12, 0, 0, Math.PI*2);
               ctx.fill();
               
               // Eyes
               ctx.fillStyle = '#000000';
               ctx.beginPath();
               ctx.arc(16, 28, 4, 0, Math.PI*2);
               ctx.arc(32, 28, 4, 0, Math.PI*2);
               ctx.fill();
               
               break;
               
           case 'bat':
               // Wings
               ctx.fillStyle = '#442244';
               ctx.beginPath();
               ctx.moveTo(24, 24);
               ctx.lineTo(8, 16);
               ctx.lineTo(16, 32);
               ctx.lineTo(24, 24);
               ctx.moveTo(24, 24);
               ctx.lineTo(40, 16);
               ctx.lineTo(32, 32);
               ctx.lineTo(24, 24);
               ctx.fill();
               
               // Body
               ctx.fillStyle = '#884488';
               ctx.beginPath();
               ctx.ellipse(24, 24, 8, 12, 0, 0, Math.PI*2);
               ctx.fill();
               
               break;
               
           case 'goblin':
               // Body
               ctx.fillStyle = '#88aa44';
               ctx.fillRect(16, 8, 16, 32);
               
               // Head
               ctx.fillStyle = '#aacc66';
               ctx.beginPath();
               ctx.ellipse(24, 12, 10, 8, 0, 0, Math.PI*2);
               ctx.fill();
               
               // Eyes
               ctx.fillStyle = '#ff0000';
               ctx.beginPath();
               ctx.arc(20, 10, 3, 0, Math.PI*2);
               ctx.arc(28, 10, 3, 0, Math.PI*2);
               ctx.fill();
               
               // Club
               ctx.fillStyle = '#885500';
               ctx.fillRect(32, 4, 8, 20);
               
               break;
       }
       
       return c;
   }

   static genBackground(type='cave') {
       const c = document.createElement('canvas');
       c.width = 800;
       c.height = 600;
       const ctx = c.getContext('2d');
       
       switch(type) {
           case 'cave':
               // Background gradient
               const grad = ctx.createLinearGradient(0, 0, 0, 600);
               grad.addColorStop(0, '#000000');
               grad.addColorStop(1, '#222244');
               ctx.fillStyle = grad;
               ctx.fillRect(0, 0, 800, 600);
               
               // Cave walls
               ctx.fillStyle = '#443322';
               for(let x = 0; x < 800; x += 32) {
                   const height = Math.sin(x/100) * 50 + 100;
                   ctx.fillRect(x, 0, 32, height);
                   ctx.fillRect(x, 600-height, 32, height);
               }
               
               // Stalactites/stalagmites
               ctx.fillStyle = '#554433';
               for(let i = 0; i < 20; i++) {
                   const x = Math.random() * 800;
                   const h = Math.random() * 100 + 50;
                   
                   // Stalactite
                   ctx.beginPath();
                   ctx.moveTo(x, 0);
                   ctx.lineTo(x+20, h);
                   ctx.lineTo(x-20, h);
                   ctx.fill();
                   
                   // Stalagmite  
                   ctx.beginPath();
                   ctx.moveTo(x, 600);
                   ctx.lineTo(x+20, 600-h);
                   ctx.lineTo(x-20, 600-h);
                   ctx.fill();
               }
               
               break;
       }
       
       return c;
   }
}
// battle-rpg/classes/Character.js


// battle-rpg/classes/BattleSystem.js


const TARGET_TYPES = {
	SINGLE_ALLY: 'single_ally',
	ALL_ALLIES: 'all_allies', 
	SINGLE_ENEMY: 'single_enemy',
	ALL_ENEMIES: 'all_enemies'
};


const ITEMS = {
    potion: {
        name: 'Potion',
        emoji: '🧪',
        targetType: TARGET_TYPES.SINGLE_ALLY,
        effect: (target) => {
            const healAmount = 50;
            const actualHeal = target.heal(healAmount);
            return actualHeal;  // Return the actual amount healed instead of boolean
        },
        description: 'Restores 50 HP to one ally'
    },
    megaPotion: {
        name: 'Mega Potion',
        emoji: '⚗️',
        targetType: TARGET_TYPES.ALL_ALLIES,
        effect: (target) => {
            const healAmount = 100;
            const actualHeal = target.heal(healAmount);
            return actualHeal;  // Return the actual amount healed instead of boolean
        },
        description: 'Restores 100 HP to all allies'
    },
    poison: {
        name: 'Poison',
        emoji: '☠️',
        targetType: TARGET_TYPES.SINGLE_ENEMY,
        effect: (target) => {
            if (target.isDead) return false;
            target.addStatus('poison', 5);
            return true;
        },
        description: 'Poisons one enemy for 5 turns'
    },
    bomb: {
        name: 'Bomb',
        emoji: '💣',
        targetType: TARGET_TYPES.ALL_ENEMIES,
        effect: (target) => {
            if (target.isDead) return false;
            const damage = 30;
            const actualDamage = target.takeDamage(damage, 'physical');
            return actualDamage > 0; // Return true only if damage was dealt
        },
        description: 'Deals 30 damage to all enemies'
    }
};

class Inventory {
    constructor() {
        // Store items as a Map with item IDs and quantities
        this.items = new Map();
    }

    addItem(itemId, quantity = 1) {
        if (!ITEMS[itemId]) {
            console.warn(`Attempted to add invalid item: ${itemId}`);
            return false;
        }
        
        const currentQuantity = this.items.get(itemId) || 0;
        this.items.set(itemId, currentQuantity + quantity);
        return true;
    }

    removeItem(itemId, quantity = 1) {
        const currentQuantity = this.items.get(itemId) || 0;
        if (currentQuantity < quantity) {
            console.warn(`Attempted to remove more ${itemId} than available`);
            return false;
        }
        
        const newQuantity = currentQuantity - quantity;
        if (newQuantity === 0) {
            this.items.delete(itemId);
        } else {
            this.items.set(itemId, newQuantity);
        }
        return true;
    }

    useItem(itemId, target) {
		if (!this.hasItem(itemId)) {
			console.warn(`Attempted to use unavailable item: ${itemId}`);
			return false;
		}

		const item = ITEMS[itemId];
		const result = item.effect(target);
		
		// Only remove the item if the effect was successful
		if (result) {
			this.removeItem(itemId);
			return true;
		}
		return false;
	}
    hasItem(itemId) {
        return (this.items.get(itemId) || 0) > 0;
    }

    getQuantity(itemId) {
        return this.items.get(itemId) || 0;
    }

    getAvailableItems() {
        // Returns array of {id, item, quantity} for all items with quantity > 0
        return Array.from(this.items.entries())
            .filter(([_, quantity]) => quantity > 0)
            .map(([id, quantity]) => ({
                id,
                item: ITEMS[id],
                quantity
            }));
    }
}






// Define our spell library
const SPELLS = {
    fire: {
        name: 'Fire',
        mpCost: 4,
        power: 20,
        element: 'fire',
        targetType: TARGET_TYPES.SINGLE_ENEMY,  // Changed from 'single'
        animation: {
            color: '#ff4400',
            type: 'explosion'
        }
    },
    ice: {
        name: 'Ice',
        mpCost: 4,
        power: 18,
        element: 'ice',
        targetType: TARGET_TYPES.SINGLE_ENEMY,  // Changed from 'single'
        animation: {
            color: '#88ccff',
            type: 'crystals'
        }
    },
    lightning: {
        name: 'Lightning',
        mpCost: 5,
        power: 25,
        element: 'lightning',
        targetType: TARGET_TYPES.ALL_ENEMIES,
        animation: {
            color: '#ffff00',
            type: 'bolt'
        }
    },
    poison: {
        name: 'Poison',
        mpCost: 6,
        power: 12,
        element: 'poison',
        targetType: TARGET_TYPES.SINGLE_ENEMY,  // Changed from 'single'
        animation: {
            color: '#88ff88',
            type: 'mist'
        }
    },
	// New spells
		heal: {
			name: 'Heal',
			mpCost: 8,
			power: 40,
			element: 'holy',
			targetType: TARGET_TYPES.SINGLE_ALLY,
			animation: {
				color: '#ffffff',
				type: 'healing'
			}
		},
		quake: {
			name: 'Quake',
			mpCost: 12,
			power: 35,
			element: 'earth',
			targetType: TARGET_TYPES.ALL_ENEMIES,
			animation: {
				color: '#884400',
				type: 'explosion'
			}
		},
		wind: {
			name: 'Wind',
			mpCost: 7,
			power: 28,
			element: 'air',
			targetType: TARGET_TYPES.ALL_ENEMIES,
			animation: {
				color: '#88ff88',
				type: 'mist'
			}
		},
		water: {
			name: 'Water',
			mpCost: 6,
			power: 25,
			element: 'water',
			targetType: TARGET_TYPES.SINGLE_ENEMY,
			animation: {
				color: '#4488ff',
				type: 'crystals'
			}
		},
		holy: {
			name: 'Holy',
			mpCost: 15,
			power: 45,
			element: 'holy',
			targetType: TARGET_TYPES.SINGLE_ENEMY,
			animation: {
				color: '#ffffff',
				type: 'explosion'
			}
		}
	};

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

class AttackAnimation {
    constructor(attacker, target) {
        this.attacker = attacker;
        this.target = target;
        this.frame = 0;
        this.maxFrames = 60; // Reduced from 200 to make it snappier
        this.finished = false;
        
        this.originalPos = { 
            x: attacker.pos.x, 
            y: attacker.pos.y 
        };
        
        this.isEnemy = attacker.type === 'slime' || attacker.type === 'bat' || attacker.type === 'goblin';
        this.moveDistance = this.isEnemy ? 100 : -100;
        
        // Add slash effect properties
        this.slashAngles = [];
        for(let i = 0; i < 5; i++) {
            this.slashAngles.push({
                angle: (Math.random() * Math.PI / 4) - Math.PI / 8,
                offset: (Math.random() - 0.5) * 20,
                size: 30 + Math.random() * 20
            });
        }
    }
    
    update() {
        this.frame++;
        
        // Movement animation with improved timing
        if (this.frame < 15) {
            // Move toward target (wind up)
            this.attacker.pos.x = this.originalPos.x + (this.moveDistance * (this.frame / 15));
        } else if (this.frame < 30) {
            // Move back (follow through)
            this.attacker.pos.x = this.originalPos.x + (this.moveDistance * ((30 - this.frame) / 15));
        } else {
            // Reset position
            this.attacker.pos.x = this.originalPos.x;
        }
        
        if (this.frame >= this.maxFrames) {
            this.finished = true;
            this.attacker.pos.x = this.originalPos.x;
            this.attacker.pos.y = this.originalPos.y;
        }
    }
    
    render(ctx) {
        // Impact effect (when hit connects)
        if (this.frame >= 15 && this.frame < 30) {
            ctx.save();
            
            // Draw slash effects
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            
            const progress = (this.frame - 15) / 15;
            const fadeOut = 1 - progress;
            
            this.slashAngles.forEach(slash => {
                ctx.save();
                ctx.translate(this.target.pos.x + slash.offset, this.target.pos.y);
                ctx.rotate(slash.angle);
                
                // Main slash
                const gradient = ctx.createLinearGradient(-slash.size, 0, slash.size, 0);
                gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${fadeOut})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
                
                ctx.strokeStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(-slash.size, 0);
                ctx.lineTo(slash.size, 0);
                ctx.stroke();
                
                // Colored trail
                const trailGradient = ctx.createLinearGradient(-slash.size, 0, slash.size, 0);
                trailGradient.addColorStop(0, `rgba(255, 50, 50, 0)`);
                trailGradient.addColorStop(0.5, `rgba(255, 50, 50, ${fadeOut * 0.7})`);
                trailGradient.addColorStop(1, `rgba(255, 50, 50, 0)`);
                
                ctx.strokeStyle = trailGradient;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(-slash.size * 0.8, 0);
                ctx.lineTo(slash.size * 0.8, 0);
                ctx.stroke();
                
                ctx.restore();
            });
            
            // Impact burst
            const burstProgress = (this.frame - 15) / 5;
            if (burstProgress <= 1) {
                const burstSize = 40 * burstProgress;
                const burstOpacity = 1 - burstProgress;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${burstOpacity})`;
                ctx.beginPath();
                ctx.arc(this.target.pos.x, this.target.pos.y, burstSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
}

class SpellAnimation {
    constructor(config, targetPos, attacker) {
        this.config = config;
        this.targetPos = {...targetPos};
        this.attacker = attacker;
        this.frame = 0;
        this.maxFrames = 90; // Increased for more distinct phases
        this.finished = false;
        this.particles = [];
        
        this.originalPos = {
            x: attacker.pos.x,
            y: attacker.pos.y
        };
        
        this.isEnemy = attacker.type === 'slime' || attacker.type === 'bat' || attacker.type === 'goblin';
        this.moveDistance = this.isEnemy ? 50 : -50;
        
        // Define animation phases
        this.phases = {
            STEP_FORWARD: { start: 0, end: 15 },
            DARKEN: { start: 15, end: 30 },
            CAST_SPELL: { start: 30, end: 60 },
            LIGHTEN: { start: 60, end: 75 },
            STEP_BACK: { start: 75, end: 90 }
        };
        
        this.initializeParticles();
    }
    
    initializeParticles() {
        switch(this.config.type) {
            case 'explosion':
                for(let i = 0; i < 20; i++) {
                    this.particles.push({
                        angle: Math.random() * Math.PI * 2,
                        speed: 1 + Math.random() * 3,
                        size: 2 + Math.random() * 4,
                        life: 1.0,
                        x: 0,
                        y: 0
                    });
                }
                break;
                
            case 'crystals':
                for(let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    this.particles.push({
                        angle: angle,
                        speed: 2 + Math.random(),
                        size: 10 + Math.random() * 10,
                        life: 1.0,
                        rotation: Math.random() * Math.PI * 2,
                        spinSpeed: (Math.random() - 0.5) * 0.2
                    });
                }
                break;
                
            case 'bolt':
                this.boltSegments = [];
                this.generateLightningPath();
                break;
                
            case 'mist':
                for(let i = 0; i < 30; i++) {
                    this.particles.push({
                        x: (Math.random() - 0.5) * 60,
                        y: (Math.random() - 0.5) * 60,
                        size: 15 + Math.random() * 25,
                        life: 1.0,
                        drift: (Math.random() - 0.5) * 2
                    });
                }
                break;
        }
    }
    
	getCurrentPhase() {
        for (let [phase, timing] of Object.entries(this.phases)) {
            if (this.frame >= timing.start && this.frame < timing.end) {
                return phase;
            }
        }
        return null;
    }
	
	update() {
        this.frame++;
        
        const phase = this.getCurrentPhase();
        
        switch(phase) {
            case 'STEP_FORWARD':
                const stepProgress = (this.frame) / (this.phases.STEP_FORWARD.end);
                this.attacker.pos.x = this.originalPos.x + (this.moveDistance * stepProgress);
                break;
                
            case 'STEP_BACK':
                const returnProgress = (this.phases.STEP_BACK.end - this.frame) / 
                                    (this.phases.STEP_BACK.end - this.phases.STEP_BACK.start);
                this.attacker.pos.x = this.originalPos.x + (this.moveDistance * returnProgress);
                break;
                
            case 'CAST_SPELL':
                // Only update particles during actual spell cast
                const spellProgress = (this.frame - this.phases.CAST_SPELL.start) / 
                                    (this.phases.CAST_SPELL.end - this.phases.CAST_SPELL.start);
                this.particles.forEach(p => {
                    // Existing particle updates but using spellProgress instead of overall progress
                    switch(this.config.type) {
                        case 'explosion':
                        case 'crystals':
                            p.x = Math.cos(p.angle) * (p.speed * (this.frame - this.phases.CAST_SPELL.start));
                            p.y = Math.sin(p.angle) * (p.speed * (this.frame - this.phases.CAST_SPELL.start));
                            if(this.config.type === 'crystals') {
                                p.rotation += p.spinSpeed;
                            }
                            break;
                        case 'mist':
                            p.x += p.drift;
                            p.y += Math.sin((this.frame - this.phases.CAST_SPELL.start) * 0.1) * 0.5;
                            break;
                    }
                    p.life = Math.max(0, 1 - spellProgress);
                });
                break;
        }
        
        if(this.frame >= this.maxFrames) {
            this.finished = true;
            this.attacker.pos.x = this.originalPos.x;
            this.attacker.pos.y = this.originalPos.y;
        }
    }
	
    
    
    render(ctx) {
        const phase = this.getCurrentPhase();
        
        // Calculate darkness
        let darkness = 0;
        if (phase === 'DARKEN') {
            darkness = (this.frame - this.phases.DARKEN.start) / 
                      (this.phases.DARKEN.end - this.phases.DARKEN.start) * 0.7;
        } else if (phase === 'CAST_SPELL') {
            darkness = 0.7;
        } else if (phase === 'LIGHTEN') {
            darkness = (this.phases.LIGHTEN.end - this.frame) / 
                      (this.phases.LIGHTEN.end - this.phases.LIGHTEN.start) * 0.7;
        }
        
        // Draw darkness overlay
        if (darkness > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        
        // Only draw spell effects during CAST_SPELL phase
        if (phase === 'CAST_SPELL') {
            ctx.save();
            ctx.translate(this.targetPos.x, this.targetPos.y);
        
			const progress = this.frame / this.maxFrames;
			
			switch(this.config.type) {
				case 'explosion':
					// Core explosion
					const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 80 * progress);
					gradient.addColorStop(0, `rgba(255, 200, 50, ${1 - progress})`);
					gradient.addColorStop(0.5, `rgba(255, 100, 50, ${0.5 - progress * 0.5})`);
					gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
					
					ctx.fillStyle = gradient;
					ctx.beginPath();
					ctx.arc(0, 0, 80 * progress, 0, Math.PI * 2);
					ctx.fill();
					
					// Particles
					this.particles.forEach(p => {
						ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 50, ${p.life})`;
						ctx.beginPath();
						ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
						ctx.fill();
					});
					break;
					
				case 'crystals':
					// Draw glowing background
					ctx.fillStyle = `rgba(100, 200, 255, ${0.2 * (1 - progress)})`;
					ctx.beginPath();
					ctx.arc(0, 0, 60, 0, Math.PI * 2);
					ctx.fill();
					
					// Draw ice crystals
					this.particles.forEach(p => {
						ctx.save();
						ctx.translate(p.x, p.y);
						ctx.rotate(p.rotation);
						
						const crystalGradient = ctx.createLinearGradient(-p.size, 0, p.size, 0);
						crystalGradient.addColorStop(0, `rgba(130, 200, 255, ${p.life})`);
						crystalGradient.addColorStop(0.5, `rgba(255, 255, 255, ${p.life})`);
						crystalGradient.addColorStop(1, `rgba(130, 200, 255, ${p.life})`);
						
						ctx.fillStyle = crystalGradient;
						
						// Draw crystal shape
						ctx.beginPath();
						ctx.moveTo(-p.size, 0);
						ctx.lineTo(0, -p.size * 0.5);
						ctx.lineTo(p.size, 0);
						ctx.lineTo(0, p.size * 0.5);
						ctx.closePath();
						ctx.fill();
						
						// Add sparkle
						if(Math.random() < 0.3) {
							ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * p.life})`;
							ctx.beginPath();
							ctx.arc(0, 0, 2, 0, Math.PI * 2);
							ctx.fill();
						}
						
						ctx.restore();
					});
					break;
					
				case 'bolt':
					ctx.translate(-this.targetPos.x, -this.targetPos.y);
					
					// Draw multiple layers of lightning
					for(let layer = 3; layer >= 0; layer--) {
						const width = (3 - layer) * 2;
						const alpha = layer === 0 ? 0.8 : 0.2;
						const offset = (Math.random() - 0.5) * 2;
						
						ctx.strokeStyle = `rgba(255, 255, ${200 + layer * 20}, ${alpha * (1 - progress)})`;
						ctx.lineWidth = width;
						ctx.beginPath();
						
						this.boltSegments.forEach((segment, i) => {
							if(i === 0) {
								ctx.moveTo(segment.x + offset, segment.y);
							} else {
								ctx.lineTo(segment.x + offset, segment.y);
							}
						});
						
						ctx.stroke();
					}
					
					// Add electric particles
					for(let i = 0; i < 5; i++) {
						const randomSegment = this.boltSegments[Math.floor(Math.random() * this.boltSegments.length)];
						ctx.fillStyle = `rgba(255, 255, 200, ${Math.random() * (1 - progress)})`;
						ctx.beginPath();
						ctx.arc(
							randomSegment.x + (Math.random() - 0.5) * 20,
							randomSegment.y,
							2 + Math.random() * 2,
							0,
							Math.PI * 2
						);
						ctx.fill();
					}
					break;
					
				case 'mist':
					// Draw swirling mist particles
					this.particles.forEach(p => {
						const baseColor = this.config.color || '#88ff88';  // Default color if none provided
						const r = parseInt(baseColor.slice(1, 3), 16);
						const g = parseInt(baseColor.slice(3, 5), 16);
						const b = parseInt(baseColor.slice(5, 7), 16);
						
						const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
						gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.life * 0.5})`);
						gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
						
						ctx.fillStyle = gradient;
						ctx.beginPath();
						ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
						ctx.fill();
					});
					
					// Add some swirl effects
					const baseColor = this.config.color || '#88ff88';  // Default color if none provided
					const r = parseInt(baseColor.slice(1, 3), 16);
					const g = parseInt(baseColor.slice(3, 5), 16);
					const b = parseInt(baseColor.slice(5, 7), 16);
					ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.2 * (1 - progress)})`;
					ctx.lineWidth = 2;
					for(let i = 0; i < 3; i++) {
						ctx.beginPath();
						ctx.arc(0, 0, 20 + i * 20, 0, Math.PI * 2 * (1 - progress) + i * Math.PI / 2);
						ctx.stroke();
					}
					break;
			}
			
			ctx.restore();
		}
	}
	
	generateLightningPath() {
        let x = this.targetPos.x;
        let y = this.targetPos.y - 150;
        let segments = [{x, y}];
        
        while(y < this.targetPos.y) {
            y += 15 + Math.random() * 15;
            x += (Math.random() - 0.5) * 40;
            segments.push({x, y});
        }
        
        this.boltSegments = segments;
    }
}

class Character {
   constructor(data) {
       this.name = data.name;
       this.type = data.type;
       this.level = data.level || 1;
       this.maxHp = data.maxHp || 100;
       this.hp = data.hp || this.maxHp;
       this.maxMp = data.maxMp || 50;
       this.mp = data.mp || this.maxMp;
       this.strength = data.strength || 10;
       this.magic = data.magic || 10;
       this.speed = data.speed || 10;
       this.sprite = data.sprite;
       
       // ATB (Active Time Battle) properties
       this.atbMax = 100;
       this.atbCurrent = 0;
       this.isReady = false;
       
	   // Menu state tracking
	   this.menuState = {
           lastAction: null,  // 'fight', 'magic', 'item', etc
           lastSpellIndex: 0, // For magic menu
           lastItemIndex: 0,  // For item menu
           lastTarget: null,  // Store target reference
           menuColumn: 0,     // Current column in menus
           menuPosition: 0    // Current position in menus
       };
	   
       // Status effects
       this.status = {
           poison: 0,
           blind: 0,
           silence: 0
       };
       
       // Animation properties
       this.pos = {x: 0, y: 0};
       this.targetPos = {x: 0, y: 0}; 
       this.animating = false;
       this.animFrame = 0;
       
       // Battle state
       this.isDead = false;
       this.isDefending = false;
       this.currentTarget = null;
       
       // Skills/spells known
       this.skills = data.skills || ['Attack'];
       this.spells = data.spells || [];
       
       // Equipment & stats
       this.equipment = {
           weapon: null,
           armor: null,
           accessory: null
       };
       
       // Calculated stats
       this.stats = {
           attack: 0,
           defense: 0,
           magicAttack: 0,
           magicDefense: 0,
           accuracy: 0,
           evasion: 0
       };
       
       this.calculateStats();
   }
   
       castSpell(spell, target) {
    if(this.mp < spell.mpCost) return false;
    if(this.status.silence > 0) return false;
    
    this.mp -= spell.mpCost;
    
    let damage = Math.floor((this.stats.magicAttack * spell.power) / 10);
    
    // Handle both single targets and arrays of targets
    const targets = Array.isArray(target) ? target : [target];
    let totalDamage = 0;

    targets.forEach(t => {
        if (!t.isDead) {
            // Apply elemental weaknesses/resistances
            let finalDamage = damage;
            if(t.weaknesses && t.weaknesses.includes(spell.element)) {
                finalDamage = Math.floor(finalDamage * 1.5);
            }
            if(t.resistances && t.resistances.includes(spell.element)) {
                finalDamage = Math.floor(finalDamage * 0.5);
            }
            
            totalDamage += t.takeDamage(finalDamage, 'magical');
        }
    });
    
    return totalDamage;
}
   
   calculateStats() {
       // Base stats
       this.stats.attack = this.strength;
       this.stats.defense = Math.floor(this.strength/2);
       this.stats.magicAttack = this.magic;
       this.stats.magicDefense = Math.floor(this.magic/2);
       this.stats.accuracy = 90 + Math.floor(this.speed/2);
       this.stats.evasion = Math.floor(this.speed/3);
       
       // Add equipment bonuses
       if(this.equipment.weapon) {
           this.stats.attack += this.equipment.weapon.attack || 0;
           this.stats.magicAttack += this.equipment.weapon.magicAttack || 0;
       }
       
       if(this.equipment.armor) {
           this.stats.defense += this.equipment.armor.defense || 0;
           this.stats.magicDefense += this.equipment.armor.magicDefense || 0;
       }
       
       if(this.equipment.accessory) {
           Object.keys(this.stats).forEach(stat => {
               if(this.equipment.accessory[stat]) {
                   this.stats[stat] += this.equipment.accessory[stat];
               }
           });
       }
   }
   
   updateATB() {
		if(!this.isDead && !this.isReady) {
			// Divide speed by 30 instead of 10 to make it 3x slower
			this.atbCurrent += this.speed/30;
			if(this.atbCurrent >= this.atbMax) {
				this.atbCurrent = this.atbMax;
				this.isReady = true;
			}
		}
	}
   
   takeDamage(amount, type='physical') {
       if(this.isDead) return 0;
       
       let defense = type === 'physical' ? this.stats.defense : this.stats.magicDefense;
       if(this.isDefending) defense *= 2;
       
       let damage = Math.max(1, amount - defense);
       this.hp = Math.max(0, this.hp - damage);
       
       if(this.hp === 0) {
           this.isDead = true;
           this.isReady = false;
       }
       
       return damage;
   }
   
   heal(amount) {
		if (this.isDead) return 0;
		
		const oldHp = this.hp;
		this.hp = Math.min(this.maxHp, this.hp + amount);
		return this.hp - oldHp; // Return actual amount healed
	}
   
   useMP(amount) {
       if(this.mp < amount) return false;
       this.mp -= amount;
       return true;
   }
   
   addStatus(status, duration) {
       this.status[status] = Math.max(this.status[status], duration);
   }
   
   updateStatus() {
       Object.keys(this.status).forEach(status => {
           if(this.status[status] > 0) {
               this.status[status]--;
               
               // Status effects
               switch(status) {
                   case 'poison':
                       this.takeDamage(Math.floor(this.maxHp/16));
                       break;
               }
           }
       });
   }
}

class BattleSystem {
    constructor(party, enemyParty, audio, input, inventory) {
        this.party = party.map(data => new Character(data));
        this.enemies = enemyParty.map(data => new Character(data));
        this.partyInventory = inventory;
		this.enemyInventory = new Inventory();
        this.audio = audio;
		this.input = input;
        this.state = 'init';
        this.battleLog = new BattleLog();
		
		
        this.initializeState();
        this.inputManager = new BattleInputManager(this, this.input);
        this.createSoundEffects();
        this.setupInitialPositions();
		// Create enemy inventory with random items
		this.enemyInventory = new Inventory();
		this.initializeEnemyInventory();
	}

	initializeEnemyInventory() {
		// Random chance to have each item type
		Object.keys(ITEMS).forEach(itemId => {
			if (Math.random() < 0.3) { // 30% chance for each item
				const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 of each
				this.enemyInventory.addItem(itemId, quantity);
			}
		});
	}

    initializeState() {
        this.activeChar = null;
        this.selectedTarget = null;
        this.currentMenu = 'main';
        this.selectedAction = null;
        this.menuPosition = 0;
        this.subMenuPosition = 0;
        this.currentMessage = null;
        this.animations = [];
        this.transitionProgress = 0;
        this.isPaused = false;
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.pendingSpell = null;
        this.itemMenuPosition = 0;
		this.itemScrollOffset = 0;
		this.maxVisibleItems = 8;
		this.hoveredItem = null;
        this.pendingItem = null;
        this.currentTargetGroup = 'enemies';
        this.defaultTargetGroup = 'enemies';
        this.isSingleTarget = true;
        this.hoveredMenuOption = null;
        this.hoveredTarget = null;
        this.hoveredSpell = null;
        this.showCancelButton = false;
        this.spellScrollOffset = 0;
        this.maxVisibleSpells = 8;
        this.upArrowHovered = false;
        this.downArrowHovered = false;
		this.actionQueue = [];  // Will hold {character, action, target} objects
		this.readyOrder = []; // track who filled their ATB in order
		this.isProcessingAction = false;  // Flag to track if we're currently animating/processing an action
    }

    handleInput(input) {
        this.inputManager.handleInput(input);
    }
	// Add methods to handle party management
	addPartyMember(character, slot) {
		if (slot >= 0 && slot < 4) {
			this.party[slot] = character;
			character.pos = {
				x: 600,
				y: 150 + slot * 100
			};
			character.targetPos = {...character.pos};
		}
	}

	removePartyMember(slot) {
		if (slot >= 0 && slot < 4) {
			this.party[slot] = null;
		}
	}
    startTargeting(targetType) {
		this.targetingMode = true;
		
		// Set defaults based on action type
		switch(targetType) {
			case TARGET_TYPES.SINGLE_ENEMY:
				this.defaultTargetGroup = 'enemies';
				this.isSingleTarget = true;
				this.isGroupTarget = false;
				break;
			case TARGET_TYPES.ALL_ENEMIES:
				this.defaultTargetGroup = 'enemies';
				this.isSingleTarget = false;
				this.isGroupTarget = true;
				break;
			case TARGET_TYPES.SINGLE_ALLY:
				this.defaultTargetGroup = 'allies';
				this.isSingleTarget = true;
				this.isGroupTarget = false;
				break;
			case TARGET_TYPES.ALL_ALLIES:
				this.defaultTargetGroup = 'allies';
				this.isSingleTarget = false;
				this.isGroupTarget = true;
				break;
		}
		
		// Initialize to default group but allow switching
		this.currentTargetGroup = this.defaultTargetGroup;
		this.updateTargetList();
	}

    updateTargetList() {
		const targets = this.currentTargetGroup === 'enemies' ? 
			this.enemies.filter(e => e && !e.isDead) : 
			this.party.filter(c => c && !c.isDead);
		
		this.targetList = this.isGroupTarget ? [targets] : targets;
		this.targetIndex = 0;
	}

    executeTargetedAction(target) {
    this.hoveredTarget = null;
    
    // First check if this character already has a queued action
    const existingAction = this.actionQueue.find(action => 
        action.character === this.activeChar
    );
    
    if (existingAction) {		
		const message = `${this.activeChar.name} already has an action queued!`;
		this.battleLog.addMessage(message, 'damage');
		this.showBattleMessage(message);
        this.audio.play('menu_error');
        return;
    }

    let actionObject = {
        character: this.activeChar,
        target: target,
        isGroupTarget: this.isGroupTarget
    };

    if (this.selectedAction === 'fight') {
        actionObject.type = 'attack';
    } else if (this.pendingSpell) {
        actionObject.type = 'spell';
        actionObject.spell = this.pendingSpell;
    } else if (this.selectedAction === 'item' && this.pendingItem) {
        actionObject.type = 'item';
        actionObject.item = this.pendingItem;
    }

    // Queue the action
    this.actionQueue.push(actionObject);
    
	// After queueing the action, remove the character from readyOrder
    this.readyOrder = this.readyOrder.filter(char => char !== this.activeChar);
	
    // Reset character state after queueing
    this.activeChar.isReady = false;
    this.activeChar.atbCurrent = 0;
    
    // Reset UI state
    this.endTargeting();
    this.currentMenu = 'main';
    this.selectedAction = null;
    this.pendingItem = null;
    this.pendingSpell = null;
    this.activeChar = null;
    this.audio.play('menu_select');
}

    executeAttack(attack) {
		if (!attack || !attack.character || !attack.target) return;
		
		this.isProcessingAction = true;
		this.animations.push(new AttackAnimation(attack.character, attack.target));
		
		setTimeout(() => {
			const damage = Math.floor(attack.character.stats.attack * 1.5);
			const actualDamage = attack.target.takeDamage(damage);
			
			const message = `${attack.character.name} attacks ${attack.target.name} for ${actualDamage} damage!`;
			this.battleLog.addMessage(message, 'damage');
			this.showBattleMessage(message);
			
			this.audio.play('sword_hit');
			this.isProcessingAction = false;
		}, 0);
	}

    executeSpell(action) {
		if (!action || !action.spell || !action.character || !action.target) return;
		
		let totalDamage = 0;
		let targetMessage;
		
		if (action.isGroupTarget) {
			const targets = Array.isArray(action.target) ? action.target : [action.target];
			targets.forEach(enemy => {
				if (!enemy.isDead) {
					const damage = action.character.castSpell(action.spell, enemy);
					totalDamage += damage;
					// Pass the caster to SpellAnimation
					this.animations.push(new SpellAnimation(action.spell.animation, enemy.pos, action.character));
				}
			});
			targetMessage = "all enemies";
		} else {
			totalDamage = action.character.castSpell(action.spell, action.target);
			// Pass the caster to SpellAnimation
			this.animations.push(new SpellAnimation(action.spell.animation, action.target.pos, action.character));
			targetMessage = action.target.name;
		}
		
		this.audio.play('magic_cast');
		const message = `${action.character.name} casts ${action.spell.name} on ${targetMessage} for ${totalDamage} damage!`;
		this.battleLog.addMessage(message, 'damage');
		this.showBattleMessage(message);
	}

	executeItem(action) {
	   if (!action || !action.item || !action.character || !action.target) return;

	   let targetMessage;
	   let effectMessage = '';
	   let totalHealing = 0;

	   if (action.isGroupTarget) {
		   action.target.forEach(t => {
			   const result = action.item.effect(t);
			   if (action.item.name.toLowerCase().includes('potion')) {
				   totalHealing += result;  // result will be healing amount
			   }
		   });
		   targetMessage = "all allies";
	   } else {
		   const result = action.item.effect(action.target);
		   if (action.item.name.toLowerCase().includes('potion')) {
			   totalHealing = result;  // result will be healing amount
		   }
		   targetMessage = action.target.name;
	   }

	   // Add healing amount to message for potions
	   if (action.item.name.toLowerCase().includes('potion')) {
		   effectMessage = ` restoring ${totalHealing} HP`;
	   } else if (action.item.name.toLowerCase().includes('poison')) {
		   effectMessage = " inflicting poison";
	   } else if (action.item.name.toLowerCase().includes('bomb')) {
		   effectMessage = " dealing damage";
	   }

	   const itemId = Object.keys(ITEMS).find(id => ITEMS[id] === action.item);
	   this.partyInventory.removeItem(itemId);

	   const message = `${action.character.name} used ${action.item.name} on ${targetMessage}${effectMessage}!`;
        this.battleLog.addMessage(message, action.item.name.toLowerCase().includes('potion') ? 'heal' : 'damage');
        this.showBattleMessage(message);
	}

	handleEnemyInput(enemy) {
		const livingPartyMembers = this.party.filter(member => !member.isDead);
		const livingEnemies = this.enemies.filter(e => !e.isDead);
		
		if (livingPartyMembers.length === 0) return;

		const actions = [];
		
		// Basic attack
		actions.push({
			type: 'attack',
			weight: 50,
			target: () => livingPartyMembers[Math.floor(Math.random() * livingPartyMembers.length)],
			isGroupTarget: false
		});

		// Consider spells
		if (enemy.spells && enemy.mp > 0) {
			enemy.spells.forEach(spellId => {
				const spell = SPELLS[spellId];
				if (enemy.mp >= spell.mpCost) {
					const isGroup = spell.targetType === TARGET_TYPES.ALL_ENEMIES || 
								  spell.targetType === TARGET_TYPES.ALL_ALLIES;
								  
					// Reverse the targeting for enemy spells
					let targets;
					switch(spell.targetType) {
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
						type: 'spell',
						spell: spell,
						weight: 30,
						target: () => isGroup ? targets : targets[Math.floor(Math.random() * targets.length)],
						isGroupTarget: isGroup
					});
				}
			});
		}

		// Consider items
		const availableItems = this.enemyInventory.getAvailableItems();
		availableItems.forEach(({id, item}) => {
			const isGroup = item.targetType === TARGET_TYPES.ALL_ENEMIES || 
						   item.targetType === TARGET_TYPES.ALL_ALLIES;
						   
			// Reverse the targeting for enemy items
			let targets;
			switch(item.targetType) {
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
					type: 'item',
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
					type: 'item',
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
				this.enemyInventory.removeItem(selectedAction.itemId);
			}

			this.actionQueue.push(actionObject);
		}
		
		enemy.isReady = false;
		enemy.atbCurrent = 0;
	}
	
    handleSpellSelection(selectedSpell) {
        if (this.activeChar.mp >= selectedSpell.mpCost) {
            this.pendingSpell = selectedSpell;
            this.startTargeting(selectedSpell.targetType);
            this.audio.play('menu_select');
        } else {
			this.showBattleMessage("Not enough MP!");
            this.audio.play('menu_error');
        }
    }

    endTargeting() {
        this.targetingMode = false;
        this.targetList = [];
        this.targetIndex = 0;
        this.pendingSpell = null;
        this.selectedAction = null;
    }

    attemptRun() {
        if (Math.random() < 0.5) {
			this.battleLog.addMessage("Got away safely!", 'system');
            this.state = 'victory';
        } else {
			this.battleLog.addMessage("Couldn't escape!", 'system');
			this.showBattleMessage("Couldn't escape!");
        }
    }

    createSoundEffects() {
       // Menus and UI
       this.audio.createComplexSound('menu_move', {
           frequencies: [880, 1100],
           types: ['square', 'sine'],
           mix: [0.7, 0.3],
           duration: 0.05,
           envelope: {
               attack: 0.01,
               decay: 0.02,
               sustain: 0.3,
               release: 0.02
           }
       });
       
       this.audio.createComplexSound('menu_select', {
           frequencies: [440, 880, 1320],
           types: ['square', 'sine', 'triangle'],
           mix: [0.4, 0.3, 0.3],
           duration: 0.1,
           envelope: {
               attack: 0.01,
               decay: 0.05,
               sustain: 0.5,
               release: 0.04
           }
       });
       
       // Battle actions
       this.audio.createComplexSound('sword_hit', {
           frequencies: [220, 440, 880],
           types: ['square', 'square', 'triangle'],
           mix: [0.5, 0.3, 0.2],
           duration: 0.2,
           envelope: {
               attack: 0.01,
               decay: 0.1,
               sustain: 0.4,
               release: 0.09
           }
       });
       
       this.audio.createComplexSound('magic_cast', {
           frequencies: [440, 587, 880, 1174],
           types: ['sine', 'triangle', 'sine', 'triangle'],
           mix: [0.3, 0.3, 0.2, 0.2],
           duration: 0.5,
           envelope: {
               attack: 0.1,
               decay: 0.2,
               sustain: 0.4,
               release: 0.2
           }
       });
       
       this.audio.createSweepSound('heal', {
           startFreq: 440,
           endFreq: 880,
           type: 'sine',
           duration: 0.3,
           envelope: {
               attack: 0.05,
               decay: 0.1,
               sustain: 0.6,
               release: 0.15
           }
       });
       
       this.audio.createComplexSound('victory', {
           frequencies: [440, 550, 660, 880],
           types: ['triangle', 'sine', 'triangle', 'sine'],
           mix: [0.3, 0.3, 0.2, 0.2],
           duration: 1.0,
           envelope: {
               attack: 0.05,
               decay: 0.2,
               sustain: 0.5,
               release: 0.25
           }
       });
   }
   
    setupInitialPositions() {
        this.party.forEach((char, i) => {
            char.pos.x = 600;
            char.pos.y = 150 + i * 100;
            char.targetPos = {...char.pos};
        });
        
        this.enemies.forEach((enemy, i) => {
            enemy.pos.x = 200;
            enemy.pos.y = 150 + i * 80;
            enemy.targetPos = {...enemy.pos};
        });
    }


	update() {
		if(this.isPaused) return;
		
		if (this.currentMenu === 'magic' || this.currentMenu === 'item' || this.targetingMode) {
			this.showCancelButton = true;
		} else {
			this.showCancelButton = false;
		}

		// First, handle animations and transitions
		this.handleAnimations();
		this.updateTransitions();

		// Check victory/defeat conditions
		if(this.checkBattleEnd()) return;

		// Update ATB gauges and track who becomes ready
		this.updateATBGauges();

		// Only process actions if we're not already processing one
		// and there are no active animations
		if(!this.isProcessingAction && this.animations.length === 0) {
			// If we have queued actions, process the next one
			if(this.actionQueue.length > 0) {
				this.processNextAction();
			}
			// Otherwise, if we have ready characters and no active character
			else if(!this.activeChar && this.readyOrder.length > 0) {
				const nextCharacter = this.readyOrder[0];
				
				if(nextCharacter.isEnemy) {
					// Only handle enemy input if no actions are queued at all
					if(this.actionQueue.length === 0) {
						this.handleEnemyInput(nextCharacter);
						this.readyOrder.shift();
					}
				} else {
					this.activeChar = nextCharacter;
				}
			}
		}
	}

	processNextAction() {
		const nextAction = this.actionQueue[0];
		this.isProcessingAction = true;
		
		switch(nextAction.type) {
			case 'attack':
				this.executeAttack(nextAction);
				break;
			case 'spell':
				this.executeSpell(nextAction);
				break;
			case 'item':
				this.executeItem(nextAction);
				break;
		}
		
		this.actionQueue.shift();
		this.isProcessingAction = false;
	}

	handleAnimations() {
		// Handle character position animations
		[...this.party, ...this.enemies].forEach(char => {
			if(char.animating) {
				char.pos.x += (char.targetPos.x - char.pos.x) * 0.2;
				char.pos.y += (char.targetPos.y - char.pos.y) * 0.2;
				
				if(Math.abs(char.pos.x - char.targetPos.x) < 0.1 && 
				   Math.abs(char.pos.y - char.targetPos.y) < 0.1) {
					char.pos = {...char.targetPos};
					char.animating = false;
				}
			}
		});

		// Update and filter battle animations
		this.animations = this.animations.filter(anim => {
			anim.update();
			return !anim.finished;
		});
	}

	updateATBGauges() {
		[...this.party, ...this.enemies].forEach(char => {
			const wasReady = char.isReady;
			char.updateATB();
			char.updateStatus();
			
			if(!wasReady && char.isReady) {
				const hasQueuedAction = this.actionQueue.some(action => 
					action.character === char
				);
				const alreadyInReadyOrder = this.readyOrder.includes(char);
				
				if(!hasQueuedAction && !alreadyInReadyOrder) {
					char.isEnemy = this.enemies.includes(char);
					this.readyOrder.push(char);
				}
			}
		});
	}

	checkBattleEnd() {
		if(this.party.every(char => char.isDead)) {
			this.state = 'gameover';
			this.battleLog.addMessage("Game Over!", 'system');
			return true;
		} else if(this.enemies.every(enemy => enemy.isDead)) {
			this.state = 'victory';
			this.battleLog.addMessage("Victory!", 'system');
			return true;
		}
		return false;
	}

    updateTransitions() {
        switch(this.state) {
            case 'init':
                if(this.transitionProgress < 1) {
                    this.transitionProgress += 0.02;
                } else {
                    this.state = 'battle';
                }
                break;
                
            case 'victory':
            case 'gameover':
                if(this.transitionProgress < 1) {
                    this.transitionProgress += 0.01;
                }
                break;
        }
    }

    render(ctx) {
		// Draw enhanced targeting effects for enemies/allies
		if (this.hoveredTarget && !this.hoveredTarget.isDead) {
			const target = this.hoveredTarget;
			
			// Animated target highlight
			ctx.save();
			const time = Date.now() / 1000;
			const pulseSize = Math.sin(time * 4) * 2;
			
			// Outer glow
			ctx.strokeStyle = target.type === 'enemy' ? '#ff8888' : '#88ff88';
			ctx.lineWidth = 2;
			ctx.shadowColor = target.type === 'enemy' ? '#ff0000' : '#00ff00';
			ctx.shadowBlur = 15;
			
			// Animated selection ring
			ctx.beginPath();
			ctx.arc(
				target.pos.x, 
				target.pos.y, 
				(target.type === 'enemy' ? 24 : 16) + pulseSize, 
				0, Math.PI * 2
			);
			ctx.stroke();
			
			// Info popup with enhanced styling
			ctx.fillStyle = 'rgba(0, 0, 102, 0.95)';
			ctx.shadowColor = '#4444ff';
			ctx.shadowBlur = 10;
			ctx.fillRect(target.pos.x + 30, target.pos.y - 40, 160, 80);
			ctx.strokeStyle = '#ffffff';
			ctx.strokeRect(target.pos.x + 30, target.pos.y - 40, 160, 80);
			
			// Target info
			ctx.shadowBlur = 0;
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 14px monospace';
			ctx.textAlign = 'left';
			ctx.fillText(target.name, target.pos.x + 40, target.pos.y - 20);
			
			// HP bar with gradient
			const hpWidth = 140;
			const hpHeight = 8;
			const hpX = target.pos.x + 40;
			const hpY = target.pos.y;
			
			// HP bar background
			ctx.fillStyle = '#333333';
			ctx.fillRect(hpX, hpY, hpWidth, hpHeight);
			
			// HP bar fill with gradient
			const hpPercent = target.hp / target.maxHp;
			const hpGradient = ctx.createLinearGradient(hpX, hpY, hpX + hpWidth * hpPercent, hpY);
			if (hpPercent > 0.6) {
				hpGradient.addColorStop(0, '#00ff00');
				hpGradient.addColorStop(1, '#88ff88');
			} else if (hpPercent > 0.3) {
				hpGradient.addColorStop(0, '#ffff00');
				hpGradient.addColorStop(1, '#ffff88');
			} else {
				hpGradient.addColorStop(0, '#ff0000');
				hpGradient.addColorStop(1, '#ff8888');
			}
			ctx.fillStyle = hpGradient;
			ctx.fillRect(hpX, hpY, hpWidth * hpPercent, hpHeight);
			
			// HP text
			ctx.fillStyle = '#ffffff';
			ctx.font = '12px monospace';
			ctx.fillText(
				`${target.hp}/${target.maxHp} HP`,
				hpX, hpY + 20
			);
			
			// Show status effects if any
			let statusY = target.pos.y + 30;
			Object.entries(target.status).forEach(([status, duration]) => {
				if (duration > 0) {
					ctx.fillStyle = '#ffff00';
					ctx.fillText(
						`${status.toUpperCase()}: ${duration}`,
						hpX, statusY
					);
					statusY += 12;
				}
			});
			
			ctx.restore();
		}
		// Add active character indicator in battle area
		if (this.activeChar && !this.activeChar.isDead) {
			// Keep the existing glow effect
			const gradient = ctx.createRadialGradient(
				this.activeChar.pos.x, this.activeChar.pos.y, 10,
				this.activeChar.pos.x, this.activeChar.pos.y, 30
			);
			gradient.addColorStop(0, 'rgba(255, 255, 0, 0.2)');
			gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(this.activeChar.pos.x, this.activeChar.pos.y, 30, 0, Math.PI * 2);
			ctx.fill();
			
			// Add a bouncing white arrow to the left
			const bounce = Math.sin(Date.now() / 100) * 5;
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.moveTo(this.activeChar.pos.x - 50 + bounce, this.activeChar.pos.y);
			ctx.lineTo(this.activeChar.pos.x - 35 + bounce, this.activeChar.pos.y - 10);
			ctx.lineTo(this.activeChar.pos.x - 35 + bounce, this.activeChar.pos.y + 10);
			ctx.closePath();
			ctx.fill();
		}
			
		// Draw targeting cursor if in targeting mode
		if (this.targetingMode && this.targetList.length > 0) {
			if (this.isGroupTarget) {
				// Draw targeting cursor over entire group
				const targets = this.targetList[0]; // Get the group array
				const bounce = Math.sin(Date.now() / 100) * 5;
				
				// Draw an arrow over each target
				targets.forEach(target => {
					ctx.fillStyle = '#ffff00';
					ctx.beginPath();
					ctx.moveTo(target.pos.x, target.pos.y - 30 + bounce);
					ctx.lineTo(target.pos.x + 10, target.pos.y - 40 + bounce);
					ctx.lineTo(target.pos.x - 10, target.pos.y - 40 + bounce);
					ctx.closePath();
					ctx.fill();
				});
				
				// Also draw the group selection box
				let minX = Infinity, minY = Infinity;
				let maxX = -Infinity, maxY = -Infinity;
				targets.forEach(target => {
					minX = Math.min(minX, target.pos.x - 30);
					minY = Math.min(minY, target.pos.y - 30);
					maxX = Math.max(maxX, target.pos.x + 30);
					maxY = Math.max(maxY, target.pos.y + 30);
				});

				ctx.strokeStyle = '#ffff00';
				ctx.lineWidth = 2;
				ctx.strokeRect(
				minX - 10 + bounce/2,
				minY - 10 + bounce/2,
				maxX - minX + 20,
				maxY - minY + 20
				);
			} else {
                // Single target cursor
				const target = this.targetList[this.targetIndex];
				if (target && !target.isDead) {
					const bounce = Math.sin(Date.now() / 100) * 5;

					ctx.fillStyle = '#ffff00';
					ctx.beginPath();
					// Keep the original Y position (-40) but arrange points to point downward
					ctx.moveTo(target.pos.x, target.pos.y - 30 + bounce);
					ctx.lineTo(target.pos.x + 10, target.pos.y - 40 + bounce);
					ctx.lineTo(target.pos.x - 10, target.pos.y - 40 + bounce);
					ctx.closePath();
					ctx.fill();
				} else {
					
					// If target is dead or undefined, end targeting mode
					this.endTargeting();
					this.currentMenu = 'main';
				}
			}
		}
		
		// Draw enemies
this.enemies.forEach(enemy => {
    if(!enemy.isDead) {
        ctx.drawImage(enemy.sprite, enemy.pos.x - 24, enemy.pos.y - 24);
        
        // Constants for bar dimensions
        const barWidth = 48;
        const barHeight = 4;
        const barSpacing = 6;
        
        // HP bar
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y + 30, barWidth, barHeight);
        
        ctx.fillStyle = '#f00';
        const hpWidth = (enemy.hp / enemy.maxHp) * barWidth;
        ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y + 30, hpWidth, barHeight);
        
        // ATB gauge
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y + 30 + barSpacing, barWidth, barHeight);
        
        ctx.fillStyle = enemy.isReady ? '#ff0' : '#fff';
        const atbWidth = (enemy.atbCurrent / enemy.atbMax) * barWidth;
        ctx.fillRect(enemy.pos.x - barWidth/2, enemy.pos.y + 30 + barSpacing, atbWidth, barHeight);
    }
});
		// Draw party members
		this.party.forEach(char => {
			if (!char) return; // Skip empty slots
			if(!char.isDead) {
				ctx.drawImage(char.sprite, char.pos.x - 16, char.pos.y - 16);
				
				// Draw character HP/MP bars
				const barWidth = 64;
				const barHeight = 4;
				const barSpacing = 6;
				
				// HP bar
				ctx.fillStyle = '#333';
				ctx.fillRect(char.pos.x - barWidth/2, char.pos.y + 30, barWidth, barHeight);
				
				ctx.fillStyle = '#0f0';
				const hpWidth = (char.hp / char.maxHp) * barWidth;
				ctx.fillRect(char.pos.x - barWidth/2, char.pos.y + 30, hpWidth, barHeight);
				
				// MP bar
				ctx.fillStyle = '#333';
				ctx.fillRect(char.pos.x - barWidth/2, char.pos.y + 30 + barSpacing, barWidth, barHeight);
				
				ctx.fillStyle = '#00f';
				const mpWidth = (char.mp / char.maxMp) * barWidth;
				ctx.fillRect(char.pos.x - barWidth/2, char.pos.y + 30 + barSpacing, mpWidth, barHeight);
				
				// ATB gauge
				ctx.fillStyle = '#333';
				ctx.fillRect(char.pos.x - barWidth/2, char.pos.y + 30 + barSpacing*2, barWidth, barHeight);
				
				ctx.fillStyle = char.isReady ? '#ff0' : '#fff';
				const atbWidth = (char.atbCurrent / char.atbMax) * barWidth;
				ctx.fillRect(char.pos.x - barWidth/2, char.pos.y + 30 + barSpacing*2, atbWidth, barHeight);
			}
		});

		// Draw battle menu
		this.drawBattleMenu(ctx);
		
		// Draw active animations
		this.animations.forEach(anim => anim.render(ctx));
		
		// Draw messages
		this.drawMessages(ctx);
		
		// Draw transition effects
		if(this.state === 'init' || this.state === 'victory' || this.state === 'gameover') {
			this.drawTransition(ctx);
		}
	}

    drawBattleMenu(ctx) {
		// Draw cancel button if needed
		if (this.showCancelButton) {
			const isHovered = this.hoveredCancel;
			
			ctx.save();
			// Make background wider to cover all text
			ctx.fillStyle = isHovered ? 'rgba(40, 40, 40, 0.8)' : 'rgba(20, 20, 20, 0.6)';
			 ctx.fillRect(2, Game.HEIGHT - 185, 200, 30);  // Moved left 8px (from 10) and up 5px (from -180)
			
			if (isHovered) {
				ctx.shadowColor = '#ff4444';
				ctx.shadowBlur = 10;
			}
			
			// Separate the text properly
			ctx.textAlign = 'left';  // Changed to left align
			
			// "CANCEL" text
			ctx.fillStyle = '#ff4444';
			ctx.fillText('CANCEL', 12, Game.HEIGHT - 164);  // Moved left 8px (from 20) and up 5px
    
			ctx.fillStyle = '#ffffff';
			ctx.fillText('with Action2', 70, Game.HEIGHT - 164);  // Moved left 8px (from 85) and up 5px
			
			ctx.restore();
		}
		// Draw menu background (keeping existing code)
		ctx.fillStyle = 'rgba(0, 0, 102, 0.95)';
		ctx.fillRect(0, Game.HEIGHT - 150, Game.WIDTH, 150);
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.strokeRect(0, Game.HEIGHT - 150, Game.WIDTH, 150);
		// Draw party status with improved layout
		this.party.forEach((char, i) => {
			const x = 475;  // This puts it more towards the right side of the empty space
			const y = Game.HEIGHT - 140 + i * 45;
			const isActive = char === this.activeChar;
			
			// Draw highlight box for active character
			if (isActive) {
				ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
				ctx.fillRect(x, y, 300, 40);
			}
			
			// Character name
			ctx.fillStyle = isActive ? '#ffff00' : '#fff';
			ctx.font = '16px monospace';
			ctx.textAlign = 'left';
			ctx.fillText(char.name, x + 10, y + 20);
			
			// HP bar
			const hpBarWidth = 100;
			const hpPercent = char.hp / char.maxHp;
			ctx.fillStyle = '#333';
			ctx.fillRect(x + 100, y + 10, hpBarWidth, 8);
			ctx.fillStyle = hpPercent < 0.2 ? '#ff0000' : hpPercent < 0.5 ? '#ffff00' : '#00ff00';
			ctx.fillRect(x + 100, y + 10, hpBarWidth * hpPercent, 8);
			ctx.fillStyle = '#fff';
			ctx.fillText(`${char.hp}/${char.maxHp}`, x + 210, y + 20);
			
			// MP bar
			const mpBarWidth = 100;
			const mpPercent = char.mp / char.maxMp;
			ctx.fillStyle = '#333';
			ctx.fillRect(x + 100, y + 25, mpBarWidth, 8);
			ctx.fillStyle = '#4444ff';
			ctx.fillRect(x + 100, y + 25, mpBarWidth * mpPercent, 8);
			ctx.fillStyle = '#fff';
			ctx.fillText(`${char.mp}/${char.maxMp}`, x + 210, y + 35);
			
			// Draw status effects
			Object.entries(char.status).forEach(([status, duration], j) => {
				if(duration > 0) {
					ctx.fillStyle = '#ff0';
					ctx.fillText(status.toUpperCase(), x + 300 + j * 70, y + 25);
				}
			});
		});
		// Enhanced command menu
		const commands = ['Fight', 'Magic', 'Item', 'Run'];
		commands.forEach((cmd, i) => {
			const isHovered = this.hoveredMenuOption === cmd.toLowerCase();
			
			// Enhanced background effect
			if (isHovered) {
				// Animated gradient effect
				const time = Date.now() / 1000;
				const gradient = ctx.createLinearGradient(
					10, Game.HEIGHT - 140 + i * 35,
					110, Game.HEIGHT - 110 + i * 35
				);
				gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
				gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
				gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
				ctx.fillStyle = gradient;
			} else {
				ctx.fillStyle = i === this.menuPosition ? '#4444ff' : 'transparent';
			}
			
			ctx.fillRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
			
			// Add glow effect when hovered
			if (isHovered) {
				ctx.save();
				ctx.shadowColor = '#8888ff';
				ctx.shadowBlur = 15;
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 2;
				ctx.strokeRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
				ctx.restore();
			} else {
				ctx.strokeStyle = '#ffffff';
				ctx.strokeRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
			}
			
			// Enhanced text rendering
			if (isHovered) {
				ctx.save();
				ctx.shadowColor = '#ffffff';
				ctx.shadowBlur = 10;
			}
			ctx.fillStyle = isHovered ? '#ffff88' : '#ffffff';
			ctx.font = isHovered ? 'bold 16px monospace' : '16px monospace';
			ctx.textAlign = 'left';
			ctx.fillText(cmd, 20, Game.HEIGHT - 120 + i * 35);
			if (isHovered) ctx.restore();
		});
		
		
		// Enhanced magic menu
		if (this.currentMenu === 'magic') {
			const spells = this.activeChar.spells;
			const totalSpells = spells.length;
			const totalPages = Math.ceil(totalSpells / this.maxVisibleSpells);
			const currentPage = Math.floor(this.spellScrollOffset / this.maxVisibleSpells);
			const visibleSpells = Math.min(this.maxVisibleSpells, totalSpells);
			
			// Define layout constants
			const gap = 10;
			const baseX = 120;
			const columnWidth = 150;
			//const arrowX = baseX + (2 * (columnWidth + gap + 6));
			
			
			///// THIS IS THE WHITE ARROWs VISUALs////////
			// Draw page navigation arrows
			// In drawBattleMenu() - apply the offset when drawing like other elements:
			if (totalSpells > this.maxVisibleSpells) {
				const arrowX = 455;
				const arrowSize = 15;
				
				// Up arrow
				if (currentPage > 0) {
					ctx.fillStyle = this.upArrowHovered ? '#ffff88' : '#ffffff';
					if (this.upArrowHovered) {
						ctx.shadowColor = '#ffffff';
						ctx.shadowBlur = 10;
					}
					
					ctx.beginPath();
					ctx.moveTo(arrowX, Game.HEIGHT - 130);              // Top point
					ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 110);  // Bottom left
					ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 110);  // Bottom right
					ctx.closePath();
					ctx.fill();
					if (this.upArrowHovered) {
						ctx.shadowBlur = 0;
					}
				}

				// Page indicator centered between arrows
				ctx.fillStyle = '#ffffff';
				ctx.font = '14px monospace';
				ctx.textAlign = 'center';
				ctx.fillText('Page', arrowX, Game.HEIGHT - 80);
				ctx.fillText(`${currentPage + 1}/${totalPages}`, arrowX, Game.HEIGHT - 57);

				// Down arrow
				if (currentPage < totalPages - 1) {
					ctx.fillStyle = this.downArrowHovered ? '#ffff88' : '#ffffff';
					if (this.downArrowHovered) {
						ctx.shadowColor = '#ffffff';
						ctx.shadowBlur = 10;
					}
					
					ctx.beginPath();
					ctx.moveTo(arrowX, Game.HEIGHT - 15);           // Bottom point
					ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 35);  // Top left
					ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 35);  // Top right
					ctx.closePath();
					ctx.fill();
					
					if (this.downArrowHovered) {
						ctx.shadowBlur = 0;
					}
				}
			}

			// Draw visible spells - rewrite the entire spell drawing section
			for(let i = 0; i < visibleSpells; i++) {
			const spellIndex = i + this.spellScrollOffset;
			if (spellIndex >= totalSpells) break;
			
			const spellId = spells[spellIndex];
			const spell = SPELLS[spellId];
			const isHovered = this.hoveredSpell === spell;
			const isSelected = spellIndex === this.subMenuPosition;
			
			const spellCol = Math.floor(i / 4);
			const spellRow = i % 4;
			const spellX = baseX + (spellCol * (columnWidth + gap));
			const spellY = Game.HEIGHT - 140 + spellRow * 35;
			
			// Draw background rectangle
			if (isHovered) {
				const time = Date.now() / 1000;
				const gradient = ctx.createLinearGradient(spellX, spellY, spellX + columnWidth, spellY + 30);
				gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
				gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
				gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
				ctx.fillStyle = gradient;
			} else if (isSelected) {
				ctx.fillStyle = '#4444ff';
			} else {
				ctx.fillStyle = 'transparent';
			}
			
			ctx.fillRect(spellX, spellY, columnWidth, 30);
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.strokeRect(spellX, spellY, columnWidth, 30);
			
			if (isHovered) {
				ctx.save();
				ctx.shadowColor = '#ffffff';
				ctx.shadowBlur = 10;
			}
			
			ctx.fillStyle = isHovered ? '#ffff88' : '#ffffff';
			ctx.font = isHovered ? 'bold 16px monospace' : '16px monospace';
			ctx.textAlign = 'left';
			// The key fix is here - use spellX + 10 instead of just baseX + 10
			ctx.fillText(
				`${spell.name} (${spell.mpCost} MP)`,
				spellX + 10,  // This ensures text aligns with its column
				spellY + 20
			);
			
			if (isHovered) {
				ctx.restore();
			}
		}
	}
	
	if (this.currentMenu === 'item') {
        this.drawItemMenu(ctx);
    }
}
	
	drawItemMenu(ctx) {
		const availableItems = this.partyInventory.getAvailableItems();
		const totalItems = availableItems.length;
		const totalPages = Math.ceil(totalItems / this.maxVisibleItems);
		const currentPage = Math.floor(this.itemScrollOffset / this.maxVisibleItems);
		const visibleItems = Math.min(this.maxVisibleItems, totalItems);
		
		// Define layout constants
		const gap = 10;
		const baseX = 120;
		const columnWidth = 150;

		// Draw visible items
		for(let i = 0; i < visibleItems; i++) {
			const itemIndex = i + this.itemScrollOffset;
			if (itemIndex >= totalItems) break;
			
			const itemData = availableItems[itemIndex];
			const isHovered = this.hoveredItem === itemData;
			const isSelected = itemIndex === this.subMenuPosition;
			
			const itemCol = Math.floor(i / 4);
			const itemRow = i % 4;
			const itemX = baseX + (itemCol * (columnWidth + gap));
			const itemY = Game.HEIGHT - 140 + itemRow * 35;
			
			// Draw background rectangle
			if (isHovered) {
				const time = Date.now() / 1000;
				const gradient = ctx.createLinearGradient(itemX, itemY, itemX + columnWidth, itemY + 30);
				gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
				gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
				gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
				ctx.fillStyle = gradient;
			} else if (isSelected) {
				ctx.fillStyle = '#4444ff';
			} else {
				ctx.fillStyle = 'transparent';
			}
			
			ctx.fillRect(itemX, itemY, columnWidth, 30);
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.strokeRect(itemX, itemY, columnWidth, 30);
			
			if (isHovered) {
				ctx.save();
				ctx.shadowColor = '#ffffff';
				ctx.shadowBlur = 10;
			}
			
			ctx.fillStyle = isHovered ? '#ffff88' : '#ffffff';
			ctx.font = isHovered ? 'bold 16px monospace' : '16px monospace';
			ctx.textAlign = 'left';
			ctx.fillText(
				`${itemData.item.emoji} ${itemData.item.name} (${itemData.quantity})`,
				itemX + 10,
				itemY + 20
			);
			
			if (isHovered) {
				ctx.restore();
			}
		}

		// Draw page navigation arrows (reuse the same code from magic menu)
		if (totalItems > this.maxVisibleItems) {
			const arrowX = 455;
			const arrowSize = 15;
			
			// Up arrow
			if (currentPage > 0) {
				ctx.fillStyle = this.upArrowHovered ? '#ffff88' : '#ffffff';
				if (this.upArrowHovered) {
					ctx.shadowColor = '#ffffff';
					ctx.shadowBlur = 10;
				}
				
				ctx.beginPath();
				ctx.moveTo(arrowX, Game.HEIGHT - 130);
				ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 110);
				ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 110);
				ctx.closePath();
				ctx.fill();
				if (this.upArrowHovered) {
					ctx.shadowBlur = 0;
				}
			}

			// Page indicator
			ctx.fillStyle = '#ffffff';
			ctx.font = '14px monospace';
			ctx.textAlign = 'center';
			ctx.fillText('Page', arrowX, Game.HEIGHT - 80);
			ctx.fillText(`${currentPage + 1}/${totalPages}`, arrowX, Game.HEIGHT - 57);

			// Down arrow
			if (currentPage < totalPages - 1) {
				ctx.fillStyle = this.downArrowHovered ? '#ffff88' : '#ffffff';
				if (this.downArrowHovered) {
					ctx.shadowColor = '#ffffff';
					ctx.shadowBlur = 10;
				}
				
				ctx.beginPath();
				ctx.moveTo(arrowX, Game.HEIGHT - 15);
				ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 35);
				ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 35);
				ctx.closePath();
				ctx.fill();
				
				if (this.downArrowHovered) {
					ctx.shadowBlur = 0;
				}
			}
		}
	}
	
	showBattleMessage(message) {
        this.currentMessage = {
            text: message,
            alpha: 1.0,
            startTime: Date.now()
        };
    }
	
	drawMessages(ctx) {
        if (this.currentMessage) {
            // Calculate how long the message has been showing
            const messageAge = Date.now() - this.currentMessage.startTime;
            
            // Start fading after 1 second
            if (messageAge > 1000) {
                this.currentMessage.alpha = Math.max(0, 1 - (messageAge - 1000) / 1000);
            }

            // Draw the message
            ctx.fillStyle = `rgba(255,255,255,${this.currentMessage.alpha})`;
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.currentMessage.text, Game.WIDTH/2, 50);

            // Remove message when fully faded
            if (this.currentMessage.alpha <= 0) {
                this.currentMessage = null;
            }
        }
    }
	
    drawTransition(ctx) {
        ctx.fillStyle = `rgba(0,0,0,${this.transitionProgress})`;
        ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
        
        if(this.state === 'victory' || this.state === 'gameover') {
            ctx.fillStyle = '#fff';
            ctx.font = '48px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.state.toUpperCase(), Game.WIDTH/2, Game.HEIGHT/2);
        }
    }
}

class BattleInputManager {
    constructor(battleSystem, input) {
        this.battle = battleSystem;
        this.input = input;
        this.lastBounds = {};
    }

    handleInput() {
        if (this.battle.state !== 'battle' || !this.battle.activeChar) return;

        const mousePos = this.input.getPointerPosition();
        const isTouching = this.input.isPointerDown();
        const justTouched = this.input.isPointerJustDown();
		
		// Add cancel button hover check
		if (this.battle.showCancelButton) {
			const bounds = {
				x: 102,
				y: 600 - 170,
				width: 200,
				height: 30
			};
			
			const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
			if (isInBounds !== this.battle.lastCancelBounds) {
				if (isInBounds) {
					this.battle.hoveredCancel = true;
				} else if (!isTouching) {
					this.battle.hoveredCancel = false;
				}
				this.battle.lastCancelBounds = isInBounds;
			}
		}

		
		// Add this for cancel button handling
		if (this.battle.showCancelButton) {
			const isHovered = this.input.isPointInBounds(
				mousePos.x,
				mousePos.y,
				{
					x: 102,
					y: this.battle.HEIGHT - 170,
					width: 200,
					height: 30
				}
			);

			// Update hover state
			if (isHovered !== this.lastBounds.cancel) {
				this.battle.hoveredCancel = isHovered;
				this.lastBounds.cancel = isHovered;
			}

			// Handle cancel click
			if (this.input.isElementJustPressed('cancel_button')) {
				this.battle.endTargeting();
				this.battle.currentMenu = 'main';
				this.battle.audio.play('menu_cancel');
			}
		}
		
		/*
        // Clear hover states only if touch ended
        if (!isTouching && justTouched === false) {
            this.clearHoverStates();
        }
		*/
		
        if (this.battle.targetingMode) {
            this.handleTargeting(mousePos, isTouching);
            return;
        }

        if (this.battle.currentMenu === 'magic') {
            this.handleMagicMenu(mousePos, isTouching);
            return;
        }

        // Add proper item menu handling
		if (this.battle.currentMenu === 'item') {
			this.handleItemMenu(mousePos, isTouching);
			return;
		}

        this.handleMainMenu(mousePos, isTouching);
    }

	handleMainMenu(mousePos, isTouching) {
		const commands = ['fight', 'magic', 'item', 'run'];
		
		commands.forEach((command, i) => {
			const bounds = {
				x: 60,  
				y: 600 - 140 + i * 35 + 15,
				width: 100,
				height: 30
			};
			
			const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
			if (isInBounds !== this.battle[`last${command}Bounds`]) {
				if (isInBounds) {
					this.battle.hoveredMenuOption = command;
					this.battle.menuPosition = i;
					this.battle.audio.play('menu_move');
				} else if (this.battle.hoveredMenuOption === command && !isTouching) {
					this.battle.hoveredMenuOption = null;
				}
				this.battle[`last${command}Bounds`] = isInBounds;
			}

			if (this.input.isElementJustPressed(`menu_${command}`)) {
				this.executeMainMenuAction(command, i);
			}
		});

		// Handle keyboard navigation
		if (this.input.isKeyJustPressed('DirUp')) {
			this.battle.menuPosition = (this.battle.menuPosition - 1 + 4) % 4;
			this.battle.hoveredMenuOption = commands[this.battle.menuPosition];
			this.battle.audio.play('menu_move');
		}
		if (this.input.isKeyJustPressed('DirDown')) {
			this.battle.menuPosition = (this.battle.menuPosition + 1) % 4;
			this.battle.hoveredMenuOption = commands[this.battle.menuPosition];
			this.battle.audio.play('menu_move');
		}
		if (this.input.isKeyJustPressed('Action1')) {
			const command = commands[this.battle.menuPosition];
			this.executeMainMenuAction(command, this.battle.menuPosition);
		}
	}

    executeMainMenuAction(command, index) {
        this.battle.menuPosition = index;
        switch(command) {
            case 'fight':
                this.battle.selectedAction = 'fight';
                this.battle.startTargeting(TARGET_TYPES.SINGLE_ENEMY);
                this.battle.audio.play('menu_select');
                break;
            case 'magic':
                if (this.battle.activeChar.spells.length > 0) {
                    this.battle.currentMenu = 'magic';
                    this.battle.subMenuPosition = 0;
                    this.battle.audio.play('menu_select');
                } else {
					this.showBattleMessage("No spells known!");
					
                }
                break;
            case 'item':
				const availableItems = this.battle.partyInventory.getAvailableItems();
				if (availableItems.length > 0) {
					this.battle.currentMenu = 'item';
					this.battle.subMenuPosition = 0;
					this.battle.selectedAction = 'item';
					this.battle.audio.play('menu_select');
				} else {
					this.showBattleMessage("No items available!");
				}
				break;
            case 'run':
                this.battle.attemptRun();
                break;
        }
    }

    handleMagicMenu(mousePos, isTouching) {
		const spells = this.battle.activeChar.spells;
		const totalPages = Math.ceil(spells.length / this.battle.maxVisibleSpells);
		const currentPage = Math.floor(this.battle.spellScrollOffset / this.battle.maxVisibleSpells);
		const spellsPerColumn = 4;
		const visibleSpells = spells.slice(currentPage * this.battle.maxVisibleSpells, 
										 (currentPage + 1) * this.battle.maxVisibleSpells);

		// Handle spell hovers for both columns, but only for actual spells
		visibleSpells.forEach((spellId, visibleIndex) => {
			const actualIndex = visibleIndex + (currentPage * this.battle.maxVisibleSpells);
			const isSecondColumn = visibleIndex >= spellsPerColumn;
			const bounds = {
				x: isSecondColumn ? 355 : 195,
				y: 600 - 140 + (visibleIndex % spellsPerColumn) * 35 + 15,
				width: 150,
				height: 30
			};
			
			const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
			if (isInBounds !== this.battle[`lastSpell${actualIndex}Bounds`]) {
				if (isInBounds) {
					this.battle.hoveredSpell = SPELLS[spellId];
					this.battle.subMenuPosition = actualIndex;
					this.battle.audio.play('menu_move');
				} else if (this.battle.hoveredSpell === SPELLS[spellId] && !isTouching) {
					this.battle.hoveredSpell = null;
				}
				this.battle[`lastSpell${actualIndex}Bounds`] = isInBounds;
			}

			if (this.input.isElementJustPressed(`submenu_slot_${visibleIndex}`)) {
				this.battle.handleSpellSelection(SPELLS[spellId]);
			}
		});

		// Rest of the method remains the same
		this.handleScrollArrows(mousePos, currentPage, totalPages);
		this.handleSpellKeyboardNav(spells, currentPage, totalPages);
		
		if (this.input.isKeyJustPressed('Action2')) {
			this.battle.currentMenu = 'main';
			this.battle.spellScrollOffset = 0;
			this.battle.audio.play('menu_cancel');
		}
	}

    handleTargeting(mousePos, isTouching) {
        this.handleTargetGroupSelection();
        this.handleTargetHovers(mousePos, isTouching);
        this.handleTargetSelection();
        this.handleTargetingCancel();
    }

    handleTargetGroupSelection() {
        if (this.input.isKeyJustPressed('DirLeft') || this.input.isKeyJustPressed('DirRight')) {
            this.battle.currentTargetGroup = this.battle.currentTargetGroup === 'enemies' ? 'allies' : 'enemies';
            this.battle.updateTargetList();
            this.battle.audio.play('menu_move');
        }
		if (!this.battle.isGroupTarget) {  // Only allow individual target selection if not group targeting
			const pressedUp = this.input.isKeyJustPressed('DirUp');
			const pressedDown = this.input.isKeyJustPressed('DirDown');
			
			if (pressedUp || pressedDown) {
				const dir = pressedUp ? -1 : 1;
				this.battle.targetIndex = (this.battle.targetIndex + dir + this.battle.targetList.length) % this.battle.targetList.length;
				this.battle.audio.play('menu_move');
			}
		}
	}
    
	handleTargetHovers(mousePos, isTouching) {
		const updateHoverState = (target, index, group) => {
			if (target.isDead) return; // Safety check
			
			this.battle.currentTargetGroup = group;
			const livingTargets = group === 'enemies' 
				? this.battle.enemies.filter(e => !e.isDead)
				: this.battle.party.filter(c => !c.isDead);
				
			const livingIndex = livingTargets.indexOf(target);
			if (livingIndex === -1) return;
			
			this.battle.targetIndex = livingIndex;
			this.battle.targetList = this.battle.isGroupTarget ? [livingTargets] : livingTargets;
			this.battle.hoveredTarget = target;
		};

		// Check living enemies
		this.battle.enemies.filter(enemy => !enemy.isDead).forEach((enemy, i) => {
			const isInBounds = this.input.isPointInBounds(
				mousePos.x,
				mousePos.y,
				{ x: enemy.pos.x, y: enemy.pos.y, width: 48, height: 48 }
			);

			if (isInBounds !== enemy.lastInBounds) {
				if (isInBounds) {
					updateHoverState(enemy, i, 'enemies');
					this.battle.audio.play('menu_move');
				} else if (this.battle.hoveredTarget === enemy && !isTouching) {
					this.battle.hoveredTarget = null;
				}
				enemy.lastInBounds = isInBounds;
			}
		});

		// Check living party members
		this.battle.party.forEach((ally, i) => {
			if (!ally || ally.isDead) return; // Skip empty slots or dead allies
			
			const isInBounds = this.input.isPointInBounds(
				mousePos.x,
				mousePos.y,
				{ x: ally.pos.x, y: ally.pos.y, width: 32, height: 32 }
			);

			if (isInBounds !== ally.lastInBounds) {
				if (isInBounds) {
					updateHoverState(ally, i, 'allies');
					this.battle.audio.play('menu_move');
				} else if (this.battle.hoveredTarget === ally && !isTouching) {
					this.battle.hoveredTarget = null;
				}
				ally.lastInBounds = isInBounds;
			}
		});
	}

    updateTargetHover(target, index) {
        this.battle.currentTargetGroup = target.type === 'enemy' ? 'enemies' : 'allies';
        this.battle.targetIndex = index;
        const filteredTargets = this.battle.currentTargetGroup === 'enemies' ? 
            this.battle.enemies.filter(e => !e.isDead) : 
            this.battle.party.filter(c => !c.isDead);
        this.battle.targetList = this.battle.isGroupTarget ? [filteredTargets] : filteredTargets;
        this.battle.hoveredTarget = target;
    }

    handleTargetSelection() {
		// Handle enemy clicks
		this.battle.enemies.forEach((enemy, index) => {
			if (this.input.isElementJustPressed(`enemy_${index}`)) {
				if (this.battle.isGroupTarget && this.battle.currentTargetGroup === 'enemies') {
					const targets = this.battle.enemies.filter(e => !e.isDead);
					this.battle.executeTargetedAction(targets);
				} else {
					this.battle.executeTargetedAction(enemy);
				}
			}
		});

		// Handle ally clicks with same logic as enemies
		this.battle.party.forEach((ally, index) => {
			if (this.input.isElementJustPressed(`char_${index}`)) {
				if (this.battle.isGroupTarget && this.battle.currentTargetGroup === 'allies') {
					const targets = this.battle.party.filter(c => !c.isDead);
					this.battle.executeTargetedAction(targets);
				} else {
					this.battle.executeTargetedAction(ally);
				}
			}
		});

		// Keep existing keyboard handling
		if (this.input.isKeyJustPressed('Action1')) {
			const target = this.battle.targetList[this.battle.targetIndex];
			if (target && !target.isDead) {
				this.battle.executeTargetedAction(target);
			}
		}
	}

    handleTargetingCancel() {
        if (this.input.isKeyJustPressed('Action2')) {
            this.battle.endTargeting();
            this.battle.currentMenu = 'main';
            this.battle.audio.play('menu_cancel');
        }
    }

    clearHoverStates() {
        this.battle.hoveredMenuOption = null;
        this.battle.hoveredTarget = null;
        this.battle.hoveredSpell = null;
        this.battle.hoveredCancel = false;
    }

    getSpellMenuBounds(index) {
        const isSecondColumn = index >= 4;
        return {
            x: isSecondColumn ? 355 : 195,
            y: this.battle.HEIGHT - 140 + (index % 4) * 35 + 15,
            width: 150,
            height: 30
        };
    }
	
	handleItemMenu(mousePos, isTouching) {
		const availableItems = this.battle.partyInventory.getAvailableItems();
		const totalItems = availableItems.length;
		const totalPages = Math.ceil(totalItems / this.battle.maxVisibleItems);
		const currentPage = Math.floor(this.battle.itemScrollOffset / this.battle.maxVisibleItems);
		const itemsPerColumn = 4;
		const visibleItems = availableItems.slice(
			currentPage * this.battle.maxVisibleItems,
			(currentPage + 1) * this.battle.maxVisibleItems
		);

		// Handle item hovers
		visibleItems.forEach((itemData, visibleIndex) => {
			const actualIndex = visibleIndex + (currentPage * this.battle.maxVisibleItems);
			const isSecondColumn = visibleIndex >= itemsPerColumn;
			const bounds = {
				x: isSecondColumn ? 355 : 195,
				y: 600 - 140 + (visibleIndex % itemsPerColumn) * 35 + 15,
				width: 150,
				height: 30
			};
			
			const isInBounds = this.input.isPointInBounds(mousePos.x, mousePos.y, bounds);
			if (isInBounds !== this.battle[`lastItem${actualIndex}Bounds`]) {
				if (isInBounds) {
					this.battle.hoveredItem = itemData;
					this.battle.subMenuPosition = actualIndex;
					this.battle.audio.play('menu_move');
				} else if (this.battle.hoveredItem === itemData && !isTouching) {
					this.battle.hoveredItem = null;
				}
				this.battle[`lastItem${actualIndex}Bounds`] = isInBounds;
			}

			if (this.input.isElementJustPressed(`submenu_slot_${visibleIndex}`)) {
				this.handleItemSelection(itemData);
			}
		});

		// Handle scroll arrows
		this.handleItemScrollArrows(mousePos, currentPage, totalPages);
		this.handleItemKeyboardNav(availableItems, currentPage, totalPages);
		
		if (this.input.isKeyJustPressed('Action2')) {
			this.battle.currentMenu = 'main';
			this.battle.itemScrollOffset = 0;
			this.battle.audio.play('menu_cancel');
		}
	}
	
	scrollItems(direction) {
		const change = direction === 'up' ? -this.battle.maxVisibleItems : this.battle.maxVisibleItems;
		this.battle.itemScrollOffset += change;
		this.battle.subMenuPosition = this.battle.itemScrollOffset;
		this.battle.audio.play('menu_move');
	}
	
	handleItemSelection(itemData) {
		this.battle.pendingItem = itemData.item;
		this.battle.startTargeting(itemData.item.targetType);
		this.battle.audio.play('menu_select');
	}
	
	handleItemKeyboardNav(items, currentPage, totalPages) {
		const pressedLeft = this.input.isKeyJustPressed('DirLeft');
		const pressedRight = this.input.isKeyJustPressed('DirRight');
		const pressedUp = this.input.isKeyJustPressed('DirUp');
		const pressedDown = this.input.isKeyJustPressed('DirDown');
		
		const itemsPerColumn = 4;
		const itemsPerPage = itemsPerColumn * 2;
		const currentPageStart = currentPage * itemsPerPage;
		
		const positionInPage = this.battle.subMenuPosition % itemsPerPage;
		const currentColumn = Math.floor(positionInPage / itemsPerColumn);
		const currentRow = positionInPage % itemsPerColumn;
		
		if (pressedLeft || pressedRight) {
			const targetColumn = currentColumn === 0 ? 1 : 0;
			const targetPosition = currentPageStart + (targetColumn * itemsPerColumn) + currentRow;
			
			if (targetPosition < items.length) {
				this.battle.subMenuPosition = targetPosition;
				this.battle.hoveredItem = items[targetPosition];
				this.battle.audio.play('menu_move');
			}
		}
		
		if (pressedUp) {
			if (currentRow > 0) {
				this.battle.subMenuPosition--;
				this.battle.hoveredItem = items[this.battle.subMenuPosition];
				this.battle.audio.play('menu_move');
			} else if (currentPage > 0) {
				this.scrollItems('up');
				const newPageStart = (currentPage - 1) * itemsPerPage;
				this.battle.subMenuPosition = Math.min(
					items.length - 1,
					newPageStart + (currentColumn * itemsPerColumn) + (itemsPerColumn - 1)
				);
				this.battle.hoveredItem = items[this.battle.subMenuPosition];
			}
		}
		
		if (pressedDown) {
			if (currentRow < itemsPerColumn - 1 && this.battle.subMenuPosition + 1 < items.length) {
				this.battle.subMenuPosition++;
				this.battle.hoveredItem = items[this.battle.subMenuPosition];
				this.battle.audio.play('menu_move');
			} else if (currentPage < totalPages - 1) {
				this.scrollItems('down');
				const newPageStart = (currentPage + 1) * itemsPerPage;
				this.battle.subMenuPosition = Math.min(
					items.length - 1,
					newPageStart + (currentColumn * itemsPerColumn)
				);
				this.battle.hoveredItem = items[this.battle.subMenuPosition];
			}
		}

		if (this.input.isKeyJustPressed('Action1')) {
			const selectedItem = items[this.battle.subMenuPosition];
			if (selectedItem) {
				this.handleItemSelection(selectedItem);
			}
		}
	}
	handleItemScrollArrows(mousePos, currentPage, totalPages) {
		const arrowBounds = {
			up: { x: 455, y: 600 - 130, width: 30, height: 20 },
			down: { x: 455, y: 600 - 25, width: 30, height: 20 }
		};

		// Handle up arrow
		if (currentPage > 0) {
			const upArrowInBounds = this.input.isPointInBounds(
				mousePos.x, 
				mousePos.y, 
				arrowBounds.up
			);
			if (upArrowInBounds !== this.battle.lastUpArrowBounds) {
				this.battle.upArrowHovered = upArrowInBounds;
				this.battle.lastUpArrowBounds = upArrowInBounds;
			}
		}

		// Handle down arrow
		if (currentPage < totalPages - 1) {
			const downArrowInBounds = this.input.isPointInBounds(
				mousePos.x, 
				mousePos.y, 
				arrowBounds.down
			);
			if (downArrowInBounds !== this.battle.lastDownArrowBounds) {
				this.battle.downArrowHovered = downArrowInBounds;
				this.battle.lastDownArrowBounds = downArrowInBounds;
			}
		}

		// Handle arrow clicks
		if (currentPage > 0 && this.input.isElementJustPressed('item_scroll_up')) {
			this.scrollItems('up');
		}
		if (currentPage < totalPages - 1 && this.input.isElementJustPressed('item_scroll_down')) {
			this.scrollItems('down');
		}
	}
	
    handleScrollArrows(mousePos, currentPage, totalPages) {
		const arrowBounds = {
			up: { x: 455, y: 600 - 130, width: 30, height: 20 },
			down: { x: 455, y: 600 - 25, width: 30, height: 20 }
		};

		// Up arrow hover
		if (currentPage > 0) {
			const upArrowInBounds = this.input.isPointInBounds(
				mousePos.x, 
				mousePos.y, 
				arrowBounds.up
			);
			if (upArrowInBounds !== this.battle.lastUpArrowBounds) {
				this.battle.upArrowHovered = upArrowInBounds;
				this.battle.lastUpArrowBounds = upArrowInBounds;
			}
		}

		// Down arrow hover
		if (currentPage < totalPages - 1) {
			const downArrowInBounds = this.input.isPointInBounds(
				mousePos.x, 
				mousePos.y, 
				arrowBounds.down
			);
			if (downArrowInBounds !== this.battle.lastDownArrowBounds) {
				this.battle.downArrowHovered = downArrowInBounds;
				this.battle.lastDownArrowBounds = downArrowInBounds;
			}
		}

		// Existing click handling
		if (currentPage > 0 && this.input.isElementJustPressed('spell_scroll_up')) {
			this.scrollSpells('up');
		}
		if (currentPage < totalPages - 1 && this.input.isElementJustPressed('spell_scroll_down')) {
			this.scrollSpells('down');
		}
	}

    scrollSpells(direction) {
        const change = direction === 'up' ? -this.battle.maxVisibleSpells : this.battle.maxVisibleSpells;
        this.battle.spellScrollOffset += change;
        this.battle.subMenuPosition = this.battle.spellScrollOffset;
        this.battle.audio.play('menu_move');
    }


	handleSpellKeyboardNav(spells, currentPage, totalPages) {
		const pressedLeft = this.input.isKeyJustPressed('DirLeft');
		const pressedRight = this.input.isKeyJustPressed('DirRight');
		const pressedUp = this.input.isKeyJustPressed('DirUp');
		const pressedDown = this.input.isKeyJustPressed('DirDown');
		
		// Always set hover state to match current cursor position
		this.battle.hoveredSpell = SPELLS[spells[this.battle.subMenuPosition]];
		
		const spellsPerColumn = 4;
		const spellsPerPage = spellsPerColumn * 2;
		const currentPageStart = currentPage * spellsPerPage;
		
		// Calculate current position
		const positionInPage = this.battle.subMenuPosition % spellsPerPage;
		const currentColumn = Math.floor(positionInPage / spellsPerColumn);
		const currentRow = positionInPage % spellsPerColumn;
		
		if (pressedLeft || pressedRight) {
			// Move between columns, wrapping around
			const targetColumn = currentColumn === 0 ? 1 : 0;
			const targetPosition = currentPageStart + (targetColumn * spellsPerColumn) + currentRow;
			
			// Only move if target position has a spell
			if (targetPosition < spells.length) {
				this.battle.subMenuPosition = targetPosition;
				this.battle.audio.play('menu_move');
			}
		}
		
		if (pressedUp) {
			if (currentRow > 0) {
				// Move up within current column
				this.battle.subMenuPosition--;
				this.battle.audio.play('menu_move');
			} else if (currentPage > 0) {
				// At top of any column, go to previous page
				this.scrollSpells('up');
				// Position at BOTTOM of same column on previous page
				const newPageStart = (currentPage - 1) * spellsPerPage;
				this.battle.subMenuPosition = Math.min(
					spells.length - 1,
					newPageStart + (currentColumn * spellsPerColumn) + (spellsPerColumn - 1)
				);
			}
		}
		
		if (pressedDown) {
			if (currentRow < spellsPerColumn - 1 && this.battle.subMenuPosition + 1 < spells.length) {
				// Move down within current column
				this.battle.subMenuPosition++;
				this.battle.audio.play('menu_move');
			} else if (currentPage < totalPages - 1) {
				// At bottom of any column, go to next page
				this.scrollSpells('down');
				// Position at TOP of same column on next page
				const newPageStart = (currentPage + 1) * spellsPerPage;
				this.battle.subMenuPosition = Math.min(
					spells.length - 1,
					newPageStart + (currentColumn * spellsPerColumn)
				);
			}
		}

		if (this.input.isKeyJustPressed('Action1')) {
			const selectedSpell = SPELLS[spells[this.battle.subMenuPosition]];
			this.battle.handleSpellSelection(selectedSpell);
		}
	}

    navigateSpellList(direction, spells, currentPage, totalPages) {
        const newPos = this.battle.subMenuPosition + direction;
        if (newPos >= 0 && newPos < spells.length) {
            this.battle.subMenuPosition = newPos;
            // Handle scrolling if needed
            if (newPos >= (currentPage + 1) * this.battle.maxVisibleSpells) {
                this.scrollSpells('down');
            } else if (newPos < currentPage * this.battle.maxVisibleSpells) {
                this.scrollSpells('up');
            }
            this.battle.audio.play('menu_move');
        }
    }
}


class BattleMode {
   constructor(canvases, input, audio) {
       this.debugMode = false;
       this.uiElements = new Map();
       // We'll use the GUI canvas for everything
       this.canvas = canvases.guiCanvas;
       this.ctx = this.canvas.getContext('2d');
       this.input = input;
       this.audio = audio;

       // Initialize core systems
       this.state = 'battle';
       this.sprites = {};
       this.backgrounds = {};
       this.loadSprites();

       // Create default party data
       this.defaultParty = [
           {
               name: 'Cecil',
               type: 'warrior',
               level: 10,
               maxHp: 150,
               maxMp: 30,
               strength: 15,
               magic: 8,
               speed: 12,
               skills: ['Attack', 'Defend'],
               spells: ['fire']
           },
           {
               name: 'Rosa',
               type: 'mage', 
               level: 10,
               maxHp: 90,
               maxMp: 80,
               strength: 6,
               magic: 18,
               speed: 10,
               skills: ['Attack'],
               spells: ['fire', 'ice', 'lightning', 'poison', 'heal', 'quake', 'wind', 'water', 'holy']
           },
           {
               name: 'Edge',
               type: 'thief',
               level: 10, 
               maxHp: 110,
               maxMp: 45,
               strength: 13,
               magic: 10,
               speed: 16,
               skills: ['Attack', 'Steal'],
               spells: ['lightning', 'poison']
           }
       ];

       this.enemyTemplates = {
    slime: {
        type: 'slime',
        maxHp: 30,
        maxMp: 20,
        strength: 8,
        magic: 5,
        speed: 12,
        spells: ['poison']
    },
    bat: {
        type: 'bat', 
        maxHp: 45,
        maxMp: 35,
        strength: 12,
        magic: 8,
        speed: 14,
        spells: ['wind']
    },
    goblin: {
        type: 'goblin',
        maxHp: 65,
        maxMp: 25,
        strength: 14,
        magic: 6,
        speed: 16,
        spells: ['fire']
    }
};
       
       this.partyInventory = new Inventory();
       
       // Create party with default inventory
       this.persistentParty = this.defaultParty.map(char => ({
           ...char,
           sprite: this.sprites[char.type]
       }));
       
       Object.defineProperty(this.persistentParty, 'inventory', {
           value: this.partyInventory,
           enumerable: false
       });
       
       // Add starter items
       this.persistentParty.inventory.addItem('potion', 5);
       this.persistentParty.inventory.addItem('megaPotion', 2);
       this.persistentParty.inventory.addItem('poison', 3);
       this.persistentParty.inventory.addItem('bomb', 2);

       // Start initial battle
       this.startNewBattle();

       // Register UI elements
       this.registerUIElements();
   }

   loadSprites() {
       // Load hero sprites
       ['warrior', 'mage', 'thief'].forEach(type => {
           this.sprites[type] = Sprite.genHeroSprite(type);
       });

       // Load enemy sprites
       ['slime', 'bat', 'goblin'].forEach(type => {
           this.sprites[type] = Sprite.genEnemySprite(type);
       });

       // Load backgrounds
       ['cave'].forEach(type => {
           this.backgrounds[type] = Sprite.genBackground(type);
       });
   }

   generateEnemyParty() {
       const count = Math.floor(Math.random() * 4) + 1;
       const enemies = [];
       const types = Object.keys(this.enemyTemplates);

       for(let i = 0; i < count; i++) {
           const type = types[Math.floor(Math.random() * types.length)];
           const template = this.enemyTemplates[type];
           enemies.push({
               name: type.charAt(0).toUpperCase() + type.slice(1),
               ...template,
               sprite: this.sprites[type]
           });
       }

       return enemies;
   }
   startNewBattle() {
       // Add sprites to party data
       const party = this.defaultParty.map(char => ({
           ...char,
           sprite: this.sprites[char.type]
       }));

       const enemies = this.generateEnemyParty();
		this.battle = new BattleSystem(this.persistentParty, enemies, this.audio, this.input, this.partyInventory);
    }
   registerUIElements() {
	   
	   // Cancel button - positioned above menu, with wider area
		const cancelBoundsFn = () => ({
			x: 102,  // Moved left 8px (from 110)
			y: Game.HEIGHT - 170,  // Moved up 5px (from -165)
			width: 200,
			height: 30
		});
		this.input.registerElement('cancel_button', { bounds: cancelBoundsFn });
		this.uiElements.set('cancel_button', cancelBoundsFn);
		
		// Main menu - centered coordinates
		const menuItems = ['Fight', 'Magic', 'Item', 'Run'];
		menuItems.forEach((item, i) => {
			const boundsFn = () => ({
				x: 60,  // 10 + 100/2 (left + width/2)
				y: Game.HEIGHT - 140 + i * 35 + 15, // y + height/2
				width: 100,
				height: 30
			});
			this.input.registerElement(`menu_${item.toLowerCase()}`, { bounds: boundsFn });
			this.uiElements.set(`menu_${item.toLowerCase()}`, boundsFn);
		});

		// Submenu slots (for magic/items) - centered coordinates
		const menuItemHeight = 35;
		const menuStartY = Game.HEIGHT - 140;
		const maxMenuItems = Math.floor(140 / menuItemHeight);
		
		for(let i = 0; i < maxMenuItems; i++) {
			const boundsFn = () => ({
				x: 195,  // 120 + 150/2 (left + width/2)
				y: menuStartY + (i * menuItemHeight) + 15, // y + height/2
				width: 150,
				height: 30
			});
			this.input.registerElement(`submenu_slot_${i}`, { bounds: boundsFn });
			this.uiElements.set(`submenu_slot_${i}`, boundsFn);
		}
		
		// Second column of spell slots
		for(let i = 0; i < maxMenuItems; i++) {
			const boundsFn = () => ({
				x: 355,  // Update this to match the visual spacing from drawBattleMenu
				y: menuStartY + (i * menuItemHeight) + 15,
				width: 150,
				height: 30
			});
			this.input.registerElement(`submenu_slot_${i + maxMenuItems}`, { bounds: boundsFn });
			this.uiElements.set(`submenu_slot_${i + maxMenuItems}`, boundsFn);
		}

		// Add scroll arrows to uiElements
		const arrowX = 455; // Consistent X position
		const arrowWidth = 30;
		const arrowHeight = 20;

		// Up arrow - centered coordinates
		const upArrowBoundsFn = () => ({
			x: arrowX,  // Center point
			y: Game.HEIGHT - 120, // Centered at top of menu
			width: arrowWidth,
			height: arrowHeight
		});
		this.input.registerElement('spell_scroll_up', { bounds: upArrowBoundsFn });
		this.uiElements.set('spell_scroll_up', upArrowBoundsFn);

		// Down arrow - centered coordinates
		const downArrowBoundsFn = () => ({
			x: arrowX,  // Center point
			y: Game.HEIGHT - 25, // Centered near bottom of menu
			width: arrowWidth,
			height: arrowHeight
		});
		this.input.registerElement('spell_scroll_down', { bounds: downArrowBoundsFn });
		this.uiElements.set('spell_scroll_down', downArrowBoundsFn);
		

		// Enemies - all possible positions (typically up to 4)
		for(let i = 0; i < 4; i++) {
			const boundsFn = () => ({
				x: 200,  // Base enemy X position
				y: 150 + i * 80,  // Spread vertically like in setupInitialPositions
				width: 48,
				height: 48
			});
			this.input.registerElement(`enemy_${i}`, { bounds: boundsFn });
			this.uiElements.set(`enemy_${i}`, boundsFn);
		}
		
		// Party members - all possible positions
		for(let i = 0; i < 4; i++) {
			const boundsFn = () => ({
				x: 600,  // Base party X position
				y: 150 + i * 100,  // Spread vertically like in setupInitialPositions
				width: 32,
				height: 32
			});
			this.input.registerElement(`char_${i}`, { bounds: boundsFn });
			this.uiElements.set(`char_${i}`, boundsFn);
		}
	}
   drawDebugHitboxes() {
		const ctx = this.ctx;
		
		this.uiElements.forEach((boundsFn, id) => {
			const bounds = boundsFn();
			
			// Different colors for different types of elements
			switch(true) {
				case id.startsWith('menu_'):
					ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
					break;
				case id.startsWith('char_'):
					ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
					break;
				case id.startsWith('enemy_'):
					ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
					break;
				case id.startsWith('submenu_'):
					ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
					break;
				default:
					ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
			}
			
			ctx.lineWidth = 2;
			// Offset the drawing position by half width/height
			ctx.strokeRect(
				bounds.x - bounds.width/2, 
				bounds.y - bounds.height/2, 
				bounds.width, 
				bounds.height
			);
			
			ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
			ctx.font = '12px monospace';
			ctx.textAlign = 'left';
			ctx.fillText(
				`${id} (${bounds.x},${bounds.y},${bounds.width},${bounds.height})`,
				bounds.x - bounds.width/2,
				bounds.y - bounds.height/2 - 2
			);
		});
	}

   toggleDebug() {
       this.debugMode = !this.debugMode;
   }

   update(deltaTime) {
       if (this.input.isKeyJustPressed('Action3')) {
           this.toggleDebug();
       }
       this.battle.update(this.input);
       if (!this.battle.isPaused) {
           this.battle.handleInput(this.input);
           
           if (this.battle.state === 'victory' && this.battle.transitionProgress >= 1) {
               setTimeout(() => {
                   this.persistentParty = this.battle.party;
                   this.startNewBattle();
               }, 1000);
           }
       }
   }

   draw() {
       // Clear canvas
       this.ctx.clearRect(0, 0, 800, 600);

       // Draw current background
       this.ctx.drawImage(this.backgrounds.cave, 0, 0);

       // Draw battle scene
       this.battle.render(this.ctx);

       // Draw pause overlay if paused
       if(this.battle.isPaused) {
           this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
           this.ctx.fillRect(0, 0, 800, 600);
           
           this.ctx.fillStyle = '#fff';
           this.ctx.font = '48px monospace';
           this.ctx.textAlign = 'center';
           this.ctx.fillText('PAUSED', 400, 300);
       }
       
       if(this.debugMode) {
           this.drawDebugHitboxes();
           
           this.ctx.fillStyle = 'rgba(0, 0, 102, 0.95)';
           this.ctx.fillRect(10, 10, 500, 120);
           this.ctx.strokeStyle = '#ffffff';
           this.ctx.lineWidth = 2;
           this.ctx.strokeRect(10, 10, 500, 120);

           this.ctx.font = '14px monospace';
           this.ctx.textAlign = 'left';
           
           this.battle.battleLog.messages.forEach((msg, i) => {
               switch(msg.type) {
                   case 'damage':
                       this.ctx.fillStyle = '#ff8888';
                       break;
                   case 'heal':
                       this.ctx.fillStyle = '#88ff88';
                       break;
                   case 'critical':
                       this.ctx.fillStyle = '#ffff88';
                       break;
                   default:
                       this.ctx.fillStyle = '#ffffff';
               }
               
               this.ctx.fillText(msg.text, 20, 35 + (i * 20));
           });
       }
   }

   pause() {
       if (this.battle) {
           this.battle.isPaused = true;
       }
   }

   resume() {
       if (this.battle) {
           this.battle.isPaused = false;
       }
   }

   cleanup() {
       // Clear battle system
       if (this.battle) {
           // TODO: Add proper battle cleanup
           this.battle = null;
       }

       // Clear UI elements
       this.uiElements.clear();

       // Clear sprites and backgrounds
       this.sprites = {};
       this.backgrounds = {};

       // Clear canvas
       if (this.ctx) {
           this.ctx.clearRect(0, 0, 800, 600);
       }

       // Clear references
       this.canvas = null;
       this.ctx = null;
       this.input = null;
       this.audio = null;
       this.persistentParty = null;
       this.partyInventory = null;
   }
}
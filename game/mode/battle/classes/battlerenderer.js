// game/mode/battle/classes/battlerenderer.js
class BattleRenderer {
    constructor(battleSystem) {
        this.battle = battleSystem;
        // Keep references to the UI state from battle system
        this.upArrowHovered = false;
        this.downArrowHovered = false;
    }

    render(ctx) {
        // Draw enhanced targeting effects for enemies/allies
        this.renderTargetingEffects(ctx);

        // Add active character indicator in battle area
        this.renderActiveCharacterIndicator(ctx);

        // Draw targeting cursor if in targeting mode
        const targetingManager = this.battle.targetingManager;
        if (targetingManager.targetingMode && targetingManager.targetList.length > 0) {
            this.renderTargetingCursor(ctx);
        }

        // Draw enemies
        this.renderEnemies(ctx);

        // Draw party members
        this.renderPartyMembers(ctx);
        
        // Draw turn counter in the top-right corner
        this.renderTurnCounter(ctx);

        // Draw battle menu
        this.drawBattleMenu(ctx);

        // Draw active animations
        this.battle.animations.forEach((anim) => anim.render(ctx));
        
        // Render damage numbers
        this.renderDamageNumbers(ctx);

        // Draw messages
        this.drawMessages(ctx);

        // Draw transition effects
        if (this.battle.state === "init" || this.battle.state === "victory" || this.battle.state === "gameover") {
            this.drawTransition(ctx);
        }
    }
    
    // Enhanced method to render the turn counter and battle log
    renderTurnCounter(ctx) {
        // Draw battle log messages in the top-left corner
        this.renderBattleLog(ctx);
        
        // Only show turn counter if battle has started and actions have occurred
        if (this.battle.turnCounter > 0) {
            ctx.save();
            
            // Background for turn counter
            const turnText = `Turn: ${this.battle.turnCounter}`;
            ctx.font = "bold 18px monospace";
            const textWidth = ctx.measureText(turnText).width;
            
            // Create a semi-transparent background with border
            ctx.fillStyle = "rgba(0, 0, 102, 0.7)";
            ctx.fillRect(Game.WIDTH - textWidth - 30, 10, textWidth + 20, 30);
            ctx.strokeStyle = "#ffff00";
            ctx.lineWidth = 2;
            ctx.strokeRect(Game.WIDTH - textWidth - 30, 10, textWidth + 20, 30);
            
            // Draw turn counter text
            ctx.fillStyle = "#ffff00"; // Bright yellow for visibility
            ctx.textAlign = "center";
            ctx.fillText(turnText, Game.WIDTH - textWidth/2 - 20, 30);
            
            ctx.restore();
        }
    }
    
    
    // New method to render the battle log
    renderBattleLog(ctx) {
        const messages = this.battle.battleLog.messages;
        if (messages.length === 0) return;
        
        ctx.save();
        
        // Background for battle log
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(10, 10, 400, Math.min(messages.length * 25 + 10, 150));
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, 400, Math.min(messages.length * 25 + 10, 150));
        
        // Draw battle log messages
        ctx.font = "14px monospace";
        ctx.textAlign = "left";
        
        // Show the most recent messages at the top
        const maxMessagesToShow = 5;
        const messagesToRender = messages.slice(0, maxMessagesToShow);
        
        messagesToRender.forEach((message, index) => {
            // Choose color based on message type
            switch (message.type) {
                case "damage":
                    ctx.fillStyle = "#ff3333"; // Red for damage
                    break;
                case "heal":
                    ctx.fillStyle = "#33ff33"; // Green for healing
                    break;
                case "system":
                    ctx.fillStyle = "#ffff33"; // Yellow for system messages
                    break;
                case "turn":
                case "enemy":
                    ctx.fillStyle = "#ff9933"; // Orange for turn/enemy messages
                    break;
                case "ally":
                    ctx.fillStyle = "#33ccff"; // Blue for ally messages
                    break;
                default:
                    ctx.fillStyle = "#ffffff"; // White for normal messages
            }
            
            ctx.fillText(message.text, 20, 30 + index * 25);
        });
        
        ctx.restore();
    }
    renderTargetingEffects(ctx) {
        const targetingManager = this.battle.targetingManager;
        if (targetingManager.hoveredTarget) {
            const target = targetingManager.hoveredTarget;
            const isDeadTarget = target.isDead;

            // Animated target highlight
            ctx.save();
            const time = Date.now() / 1000;
            const pulseSize = Math.sin(time * 4) * 2;

            // Outer glow - adjust color based on if targeting a dead character with Phoenix
            let isPhoenix = this.battle.pendingItem && this.battle.pendingItem.name === "Phoenix";
            
            // Use different colors for dead/alive targets
            if (isDeadTarget && isPhoenix) {
                // Golden/resurrection glow for Phoenix on dead targets
                ctx.strokeStyle = "#ffdf00";
                ctx.shadowColor = "#ffa500";
            } else {
                // Regular colors for normal targeting
                ctx.strokeStyle = target.type === "enemy" ? "#ff8888" : "#88ff88";
                ctx.shadowColor = target.type === "enemy" ? "#ff0000" : "#00ff00";
            }
            
            ctx.lineWidth = 2;
            ctx.shadowBlur = 15;

            // Animated selection ring
            ctx.beginPath();
            ctx.arc(target.pos.x, target.pos.y, (target.type === "enemy" ? 24 : 16) + pulseSize, 0, Math.PI * 2);
            ctx.stroke();

            // Info popup with enhanced styling
            ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
            ctx.shadowColor = "#4444ff";
            ctx.shadowBlur = 10;
            ctx.fillRect(target.pos.x + 30, target.pos.y - 40, 160, 80);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(target.pos.x + 30, target.pos.y - 40, 160, 80);

            // Target info
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "left";
            ctx.fillText(target.name, target.pos.x + 40, target.pos.y - 20);

            // HP bar with gradient
            const hpWidth = 140;
            const hpHeight = 8;
            const hpX = target.pos.x + 40;
            const hpY = target.pos.y;

            // HP bar background
            ctx.fillStyle = "#333333";
            ctx.fillRect(hpX, hpY, hpWidth, hpHeight);

            // HP bar fill with gradient
            const hpPercent = target.hp / target.maxHp;
            const hpGradient = ctx.createLinearGradient(hpX, hpY, hpX + hpWidth * hpPercent, hpY);
            if (hpPercent > 0.6) {
                hpGradient.addColorStop(0, "#00ff00");
                hpGradient.addColorStop(1, "#88ff88");
            } else if (hpPercent > 0.3) {
                hpGradient.addColorStop(0, "#ffff00");
                hpGradient.addColorStop(1, "#ffff88");
            } else {
                hpGradient.addColorStop(0, "#ff0000");
                hpGradient.addColorStop(1, "#ff8888");
            }
            ctx.fillStyle = hpGradient;
            ctx.fillRect(hpX, hpY, hpWidth * hpPercent, hpHeight);

            // HP text
            ctx.fillStyle = "#ffffff";
            ctx.font = "12px monospace";
            ctx.fillText(`${target.hp}/${target.maxHp} HP`, hpX, hpY + 20);

            // Show status effects if any
            let statusY = target.pos.y + 30;
            Object.entries(target.status).forEach(([status, duration]) => {
                if (duration > 0) {
                    // Use different colors for different status types
                    let statusColor;
                    switch (status) {
                        case "poison":
                            statusColor = "#9933ff"; // Purple for poison
                            break;
                        case "blind":
                            statusColor = "#888888"; // Gray for blind
                            break;
                        case "silence":
                            statusColor = "#33ccff"; // Light blue for silence
                            break;
                        default:
                            statusColor = "#ffff00"; // Yellow for default
                    }
                    
                    ctx.fillStyle = statusColor;
                    ctx.fillText(`${status.toUpperCase()}: ${duration}`, hpX, statusY);
                    statusY += 12;
                }
            });
            
            // Show dead status if applicable
            if (isDeadTarget) {
                ctx.fillStyle = "#ff4444";
                ctx.fillText("DEAD", hpX, statusY);
            }

            ctx.restore();
        }
    }

    renderActiveCharacterIndicator(ctx) {
        if (this.battle.activeChar && !this.battle.activeChar.isDead) {
            // Keep the existing glow effect
            const gradient = ctx.createRadialGradient(
                this.battle.activeChar.pos.x,
                this.battle.activeChar.pos.y,
                10,
                this.battle.activeChar.pos.x,
                this.battle.activeChar.pos.y,
                30
            );
            gradient.addColorStop(0, "rgba(255, 255, 0, 0.2)");
            gradient.addColorStop(1, "rgba(255, 255, 0, 0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.battle.activeChar.pos.x, this.battle.activeChar.pos.y, 30, 0, Math.PI * 2);
            ctx.fill();

            // Add a bouncing white arrow to the left
            const bounce = Math.sin(Date.now() / 100) * 5;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(this.battle.activeChar.pos.x - 50 + bounce, this.battle.activeChar.pos.y);
            ctx.lineTo(this.battle.activeChar.pos.x - 35 + bounce, this.battle.activeChar.pos.y - 10);
            ctx.lineTo(this.battle.activeChar.pos.x - 35 + bounce, this.battle.activeChar.pos.y + 10);
            ctx.closePath();
            ctx.fill();
        }
    }

    renderTargetingCursor(ctx) {
        const targetingManager = this.battle.targetingManager;
        
        // Check if using a Phoenix item
        const isUsingPhoenix = this.battle.pendingItem && this.battle.pendingItem.name === "Phoenix";
        
        if (targetingManager.isGroupTarget) {
            // Draw targeting cursor over entire group
            const targets = targetingManager.targetList[0]; // Get the group array
            const bounce = Math.sin(Date.now() / 100) * 5;

            // Draw an arrow over each target
            targets.forEach((target) => {
                // Use gold color for Phoenix targeting
                ctx.fillStyle = isUsingPhoenix ? "#ffdf00" : "#ffff00";
                ctx.beginPath();
                ctx.moveTo(target.pos.x, target.pos.y - 30 + bounce);
                ctx.lineTo(target.pos.x + 10, target.pos.y - 40 + bounce);
                ctx.lineTo(target.pos.x - 10, target.pos.y - 40 + bounce);
                ctx.closePath();
                ctx.fill();
            });

            // Also draw the group selection box
            let minX = Infinity,
                minY = Infinity;
            let maxX = -Infinity,
                maxY = -Infinity;
            targets.forEach((target) => {
                minX = Math.min(minX, target.pos.x - 30);
                minY = Math.min(minY, target.pos.y - 30);
                maxX = Math.max(maxX, target.pos.x + 30);
                maxY = Math.max(maxY, target.pos.y + 30);
            });

            ctx.strokeStyle = isUsingPhoenix ? "#ffdf00" : "#ffff00";
            ctx.lineWidth = 2;
            ctx.strokeRect(minX - 10 + bounce / 2, minY - 10 + bounce / 2, maxX - minX + 20, maxY - minY + 20);
        } else {
            // Single target cursor
            const target = targetingManager.getCurrentTarget();
            if (target) {
                const bounce = Math.sin(Date.now() / 100) * 5;

                // Adjust color for Phoenix targeting
                ctx.fillStyle = isUsingPhoenix ? "#ffdf00" : "#ffff00";
                ctx.beginPath();
                // Keep the original Y position (-40) but arrange points to point downward
                ctx.moveTo(target.pos.x, target.pos.y - 30 + bounce);
                ctx.lineTo(target.pos.x + 10, target.pos.y - 40 + bounce);
                ctx.lineTo(target.pos.x - 10, target.pos.y - 40 + bounce);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    renderEnemies(ctx) {
        this.battle.enemies.forEach((enemy, index) => {
            // Render all enemies, but apply specific styling for dead ones
            if (enemy.isDead) {
                // For dead enemies, draw them with transparency and a visual indicator
                ctx.globalAlpha = 0.5; // Make them semi-transparent
                ctx.drawImage(enemy.sprite, enemy.pos.x - 24, enemy.pos.y - 24);
                
                // Draw an "X" over dead enemies
                ctx.strokeStyle = "red";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(enemy.pos.x - 20, enemy.pos.y - 20);
                ctx.lineTo(enemy.pos.x + 20, enemy.pos.y + 20);
                ctx.moveTo(enemy.pos.x + 20, enemy.pos.y - 20);
                ctx.lineTo(enemy.pos.x - 20, enemy.pos.y + 20);
                ctx.stroke();
                
                // Reset alpha for other elements
                ctx.globalAlpha = 1.0;
            } else {
                // Regular rendering for living enemies
                ctx.drawImage(enemy.sprite, enemy.pos.x - 24, enemy.pos.y - 24);

                // Constants for bar dimensions
                const barWidth = 48;
                const barHeight = 4;
                const barSpacing = 6;

                // HP bar with animation
                ctx.fillStyle = "#333";
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30, barWidth, barHeight);

                let hpPercent;
                if (enemy.animatingHP) {
                    const startPercent = enemy.hp / enemy.maxHp;
                    const endPercent = enemy.targetHP / enemy.maxHp;
                    hpPercent = startPercent + (endPercent - startPercent) * enemy.hpAnimProgress;
                } else {
                    hpPercent = enemy.hp / enemy.maxHp;
                }

                ctx.fillStyle = "#f00";
                const hpWidth = hpPercent * barWidth;
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30, hpWidth, barHeight);

                // ATB gauge
                ctx.fillStyle = "#333";
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30 + barSpacing, barWidth, barHeight);

                ctx.fillStyle = enemy.isReady ? "#ff0" : "#fff";
                const atbWidth = (enemy.atbCurrent / enemy.atbMax) * barWidth;
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30 + barSpacing, atbWidth, barHeight);
            }

            // Draw status effect icons
            this.renderStatusEffects(ctx, enemy);
        });
    }

    renderPartyMembers(ctx) {
        this.battle.party.forEach((char) => {
            if (!char) return; // Skip empty slots
            
            // Check for phoenix targeting mode
            const isPhoenixMode = this.battle.pendingItem && this.battle.pendingItem.name === "Phoenix";
            
            if (char.isDead) {
                // For dead party members, add a visual representation
                ctx.globalAlpha = 0.5; // Make them semi-transparent
                ctx.drawImage(char.sprite, char.pos.x - 16, char.pos.y - 16);
                
                // Draw a cross over dead party members
                ctx.strokeStyle = "red";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(char.pos.x - 12, char.pos.y - 12);
                ctx.lineTo(char.pos.x + 12, char.pos.y + 12);
                ctx.moveTo(char.pos.x + 12, char.pos.y - 12);
                ctx.lineTo(char.pos.x - 12, char.pos.y + 12);
                ctx.stroke();
                
                // Add "DEAD" text
                ctx.fillStyle = "#ff4444";
                ctx.font = "10px monospace";
                ctx.textAlign = "center";
                ctx.fillText("DEAD", char.pos.x, char.pos.y + 25);
                
                // If in phoenix targeting mode, add a special glow
                if (isPhoenixMode) {
                    const time = Date.now() / 1000;
                    const pulseAlpha = 0.3 + Math.sin(time * 3) * 0.2;
                    
                    ctx.globalAlpha = pulseAlpha;
                    ctx.fillStyle = "#ffdf00";
                    ctx.beginPath();
                    ctx.arc(char.pos.x, char.pos.y, 20, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Reset alpha
                ctx.globalAlpha = 1.0;
            } else {
                // Regular rendering for living party members
                ctx.drawImage(char.sprite, char.pos.x - 16, char.pos.y - 16);

                // Draw character HP/MP bars
                const barWidth = 64;
                const barHeight = 4;
                const barSpacing = 6;

                // HP bar with animation
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30, barWidth, barHeight);

                let hpPercent;
                if (char.animatingHP) {
                    const startPercent = char.hp / char.maxHp;
                    const endPercent = char.targetHP / char.maxHp;
                    hpPercent = startPercent + (endPercent - startPercent) * char.hpAnimProgress;
                } else {
                    hpPercent = char.hp / char.maxHp;
                }

                ctx.fillStyle = "#0f0";
                const hpWidth = hpPercent * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30, hpWidth, barHeight);

                // MP bar with animation
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing, barWidth, barHeight);

                let mpPercent;
                if (char.animatingMP) {
                    const startPercent = char.mp / char.maxMp;
                    const endPercent = char.targetMP / char.maxMp;
                    mpPercent = startPercent + (endPercent - startPercent) * char.mpAnimProgress;
                } else {
                    mpPercent = char.mp / char.maxMp;
                }

                ctx.fillStyle = "#00f";
                const mpWidth = mpPercent * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing, mpWidth, barHeight);

                // ATB gauge
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing * 2, barWidth, barHeight);

                ctx.fillStyle = char.isReady ? "#ff0" : "#fff";
                const atbWidth = (char.atbCurrent / char.atbMax) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing * 2, atbWidth, barHeight);
            }
            
            // Draw status effect icons
            this.renderStatusEffects(ctx, char);
        });
    }
    
    // Render status effect icons
    renderStatusEffects(ctx, character) {
        const statusEffects = [];
        
        // Check which status effects are active
        Object.entries(character.status).forEach(([status, duration]) => {
            if (duration > 0) {
                statusEffects.push({ type: status, duration: duration });
            }
        });
        
        if (statusEffects.length > 0) {
            // Position above the character
            const baseX = character.pos.x - ((statusEffects.length - 1) * 10);
            const baseY = character.pos.y - 40;
            
            statusEffects.forEach((effect, index) => {
                const x = baseX + index * 20;
                const y = baseY;
                
                // Draw circle for the status with a pulsing effect
                ctx.save();
                
                // Add pulsing effect
                const time = Date.now() / 1000;
                const pulse = Math.sin(time * 2 + index) * 0.2 + 0.9; // Oscillate between 0.7 and 1.1 size
                
                ctx.beginPath();
                ctx.arc(x, y, 10 * pulse, 0, Math.PI * 2);
                
                // Set color based on status type with gradient for better visibility
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10 * pulse);
                
                switch (effect.type) {
                    case "poison":
                        gradient.addColorStop(0, "rgba(180, 60, 255, 0.9)"); // Brighter center
                        gradient.addColorStop(1, "rgba(136, 0, 255, 0.7)"); // Purple for poison
                        break;
                    case "blind":
                        gradient.addColorStop(0, "rgba(150, 150, 150, 0.9)");
                        gradient.addColorStop(1, "rgba(68, 68, 68, 0.7)"); // Dark gray for blind
                        break;
                    case "silence":
                        gradient.addColorStop(0, "rgba(100, 220, 255, 0.9)");
                        gradient.addColorStop(1, "rgba(0, 204, 255, 0.7)"); // Light blue for silence
                        break;
                    default:
                        gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
                        gradient.addColorStop(1, "rgba(255, 255, 255, 0.7)"); // White for unknown
                }
                
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Add a stroke for better visibility
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Draw status duration
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(effect.duration, x, y);
                
                // Draw a tiny icon to represent the status type
                const iconY = y - 1; // Slight adjustment to center visually
                ctx.textAlign = "center";
                
                // Draw icon based on status type
                switch (effect.type) {
                    case "poison":
                        ctx.font = "8px Arial";
                        ctx.fillText("☠️", x, iconY);
                        break;
                    case "blind":
                        ctx.font = "8px Arial";
                        ctx.fillText("👁️", x, iconY);
                        break;
                    case "silence":
                        ctx.font = "8px Arial";
                        ctx.fillText("🤐", x, iconY);
                        break;
                }
                
                ctx.restore();
            });
        }
    }
    
    // Render damage numbers
    renderDamageNumbers(ctx) {
        // Remove expired damage numbers
        this.battle.damageNumbers = this.battle.damageNumbers.filter(number => {
            const elapsed = Date.now() - number.startTime;
            return elapsed < number.duration;
        });
        
        // Render active damage numbers
        this.battle.damageNumbers.forEach(number => {
            const elapsed = Date.now() - number.startTime;
            const progress = elapsed / number.duration;
            
            // Float upward and fade out
            const offsetY = -30 * progress;
            const alpha = 1 - progress;
            
            // Different colors for different damage types
            let color;
            switch (number.type) {
                case "physical":
                    color = "#ff3333"; // Red for physical damage
                    break;
                case "magical":
                    color = "#ffff00"; // Yellow for magic damage
                    break;
                case "poison":
                    color = "#9933ff"; // Purple for poison damage
                    break;
                case "heal":
                    color = "#33ff33"; // Green for healing
                    break;
                case "blind":
                    color = "#888888"; // Gray for blind
                    break;
                case "silence":
                    color = "#33ccff"; // Light blue for silence
                    break;
                default:
                    color = "#ffffff"; // White for unknown
            }
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // Draw text with outline for better visibility
            ctx.strokeText(number.amount, number.x, number.y + offsetY);
            ctx.fillText(number.amount, number.x, number.y + offsetY);
            
            ctx.restore();
        });
    }

    drawBattleMenu(ctx) {
        // Draw cancel button if needed
        if (this.battle.showCancelButton) {
            const isHovered = this.battle.hoveredCancel;

            ctx.save();
            // Make background wider to cover all text
            ctx.fillStyle = isHovered ? "rgba(40, 40, 40, 0.8)" : "rgba(20, 20, 20, 0.6)";
            ctx.fillRect(2, Game.HEIGHT - 185, 200, 30); // Moved left 8px (from 10) and up 5px (from -180)

            if (isHovered) {
                ctx.shadowColor = "#ff4444";
                ctx.shadowBlur = 10;
            }

            // Separate the text properly
            ctx.textAlign = "left"; // Changed to left align

            // "CANCEL" text
            ctx.fillStyle = "#ff4444";
            ctx.fillText("CANCEL", 12, Game.HEIGHT - 164); // Moved left 8px (from 20) and up 5px

            ctx.fillStyle = "#ffffff";
            ctx.fillText("with Action2", 70, Game.HEIGHT - 164); // Moved left 8px (from 85) and up 5px

            ctx.restore();
        }

        // Draw menu background
        ctx.fillStyle = "rgba(0, 0, 102, 0.95)";
        ctx.fillRect(0, Game.HEIGHT - 150, Game.WIDTH, 150);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, Game.HEIGHT - 150, Game.WIDTH, 150);

        // Draw party status with improved layout
        this.renderPartyStatus(ctx);

        // Draw command menu
        this.renderCommandMenu(ctx);

        // Draw sub-menus
        if (this.battle.currentMenu === "magic") {
            this.renderMagicMenu(ctx);
        } else if (this.battle.currentMenu === "item") {
            this.drawItemMenu(ctx);
        }
    }

    renderPartyStatus(ctx) {
        this.battle.party.forEach((char, i) => {
            if (!char) return; // Skip empty slots

            const x = 475;
            const y = Game.HEIGHT - 140 + i * 45;
            const isActive = char === this.battle.activeChar;

            // Draw highlight box for active character
            if (isActive) {
                ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
                ctx.fillRect(x, y, 300, 40);
            }

            // Character name
            ctx.fillStyle = isActive ? "#ffff00" : char.isDead ? "#ff4444" : "#fff";
            ctx.font = "16px monospace";
            ctx.textAlign = "left";
            
            // Add "DEAD" indicator for dead characters
            let nameText = char.name;
            if (char.isDead) {
                nameText += " [DEAD]";
            }
            
            ctx.fillText(nameText, x + 10, y + 20);

            // HP bar with animation
            const hpBarWidth = 100;
            let hpPercent;
            if (char.animatingHP) {
                const startPercent = char.hp / char.maxHp;
                const endPercent = char.targetHP / char.maxHp;
                hpPercent = startPercent + (endPercent - startPercent) * char.hpAnimProgress;
            } else {
                hpPercent = char.hp / char.maxHp;
            }

            ctx.fillStyle = "#333";
            ctx.fillRect(x + 100, y + 10, hpBarWidth, 8);
            ctx.fillStyle = hpPercent < 0.2 ? "#ff0000" : hpPercent < 0.5 ? "#ffff00" : "#00ff00";
            ctx.fillRect(x + 100, y + 10, hpBarWidth * hpPercent, 8);

            // Display the animated HP value
            const displayHP = char.animatingHP
                ? Math.round(char.hp + (char.targetHP - char.hp) * char.hpAnimProgress)
                : char.hp;

            ctx.fillStyle = "#fff";
            ctx.fillText(`${displayHP}/${char.maxHp}`, x + 210, y + 20);

            // MP bar with animation
            const mpBarWidth = 100;
            let mpPercent;
            if (char.animatingMP) {
                const startPercent = char.mp / char.maxMp;
                const endPercent = char.targetMP / char.maxMp;
                mpPercent = startPercent + (endPercent - startPercent) * char.mpAnimProgress;
            } else {
                mpPercent = char.mp / char.maxMp;
            }

            ctx.fillStyle = "#333";
            ctx.fillRect(x + 100, y + 25, mpBarWidth, 8);
            ctx.fillStyle = "#4444ff";
            ctx.fillRect(x + 100, y + 25, mpBarWidth * mpPercent, 8);

            // Display the animated MP value
            const displayMP = char.animatingMP
                ? Math.round(char.mp + (char.targetMP - char.mp) * char.mpAnimProgress)
                : char.mp;

            ctx.fillStyle = "#fff";
            ctx.fillText(`${displayMP}/${char.maxMp}`, x + 210, y + 35);

            // Draw status effects
            Object.entries(char.status).forEach(([status, duration], j) => {
                if (duration > 0) {
                    // Use different colors for different status types
                    let statusColor;
                    switch (status) {
                        case "poison":
                            statusColor = "#9933ff"; // Purple for poison
                            break;
                        case "blind":
                            statusColor = "#888888"; // Gray for blind
                            break;
                        case "silence":
                            statusColor = "#33ccff"; // Light blue for silence
                            break;
                        default:
                            statusColor = "#ffff00"; // Yellow for default
                    }
                    
                    ctx.fillStyle = statusColor;
                    ctx.fillText(`${status.toUpperCase()}:${duration}`, x + 300 + j * 70, y + 25);
                }
            });
        });
    }

    renderCommandMenu(ctx) {
        const commands = ["Fight", "Magic", "Item", "Run"];
        commands.forEach((cmd, i) => {
            const isHovered = this.battle.hoveredMenuOption === cmd.toLowerCase();

            // Enhanced background effect
            if (isHovered) {
                // Animated gradient effect
                const time = Date.now() / 1000;
                const gradient = ctx.createLinearGradient(
                    10,
                    Game.HEIGHT - 140 + i * 35,
                    110,
                    Game.HEIGHT - 110 + i * 35
                );
                gradient.addColorStop(0, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                gradient.addColorStop(0.5, `rgba(68, 68, 255, ${0.8 + Math.sin(time * 2) * 0.2})`);
                gradient.addColorStop(1, `rgba(68, 68, 255, ${0.6 + Math.sin(time * 2) * 0.2})`);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = i === this.battle.menuPosition ? "#4444ff" : "transparent";
            }

            ctx.fillRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);

            // Add glow effect when hovered
            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#8888ff";
                ctx.shadowBlur = 15;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.strokeRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
                ctx.restore();
            } else {
                ctx.strokeStyle = "#ffffff";
                ctx.strokeRect(10, Game.HEIGHT - 140 + i * 35, 100, 30);
            }

            // Enhanced text rendering
            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }
            ctx.fillStyle = isHovered ? "#ffff88" : "#ffffff";
            ctx.font = isHovered ? "bold 16px monospace" : "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(cmd, 20, Game.HEIGHT - 120 + i * 35);
            if (isHovered) ctx.restore();
        });
    }

    renderMagicMenu(ctx) {
        const spells = this.battle.activeChar.spells;
        const totalSpells = spells.length;
        const totalPages = Math.ceil(totalSpells / this.battle.maxVisibleSpells);
        const currentPage = Math.floor(this.battle.spellScrollOffset / this.battle.maxVisibleSpells);
        const visibleSpells = Math.min(this.battle.maxVisibleSpells, totalSpells);

        // Define layout constants
        const gap = 10;
        const baseX = 120;
        const columnWidth = 150;

        // Draw page navigation arrows
        if (totalSpells > this.battle.maxVisibleSpells) {
            this.renderPaginationArrows(ctx, currentPage, totalPages);
        }

        // Draw visible spells
        for (let i = 0; i < visibleSpells; i++) {
            const spellIndex = i + this.battle.spellScrollOffset;
            if (spellIndex >= totalSpells) break;

            const spellId = spells[spellIndex];
            const spell = SPELLS[spellId];
            const isHovered = this.battle.hoveredSpell === spell;
            const isSelected = spellIndex === this.battle.subMenuPosition;

            const spellCol = Math.floor(i / 4);
            const spellRow = i % 4;
            const spellX = baseX + spellCol * (columnWidth + gap);
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
                ctx.fillStyle = "#4444ff";
            } else {
                ctx.fillStyle = "transparent";
            }

            ctx.fillRect(spellX, spellY, columnWidth, 30);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(spellX, spellY, columnWidth, 30);

            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }

            ctx.fillStyle = isHovered ? "#ffff88" : "#ffffff";
            ctx.font = isHovered ? "bold 16px monospace" : "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`${spell.name} (${spell.mpCost} MP)`, spellX + 10, spellY + 20);

            if (isHovered) {
                ctx.restore();
            }
        }
    }

    drawItemMenu(ctx) {
        const availableItems = this.battle.partyInventory.getAvailableItems();
        const totalItems = availableItems.length;
        const totalPages = Math.ceil(totalItems / this.battle.maxVisibleItems);
        const currentPage = Math.floor(this.battle.itemScrollOffset / this.battle.maxVisibleItems);
        const visibleItems = Math.min(this.battle.maxVisibleItems, totalItems);

        // Define layout constants
        const gap = 10;
        const baseX = 120;
        const columnWidth = 150;

        // Draw visible items
        for (let i = 0; i < visibleItems; i++) {
            const itemIndex = i + this.battle.itemScrollOffset;
            if (itemIndex >= totalItems) break;

            const itemData = availableItems[itemIndex];
            const isHovered = this.battle.hoveredItem === itemData;
            const isSelected = itemIndex === this.battle.subMenuPosition;

            const itemCol = Math.floor(i / 4);
            const itemRow = i % 4;
            const itemX = baseX + itemCol * (columnWidth + gap);
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
                ctx.fillStyle = "#4444ff";
            } else {
                ctx.fillStyle = "transparent";
            }

            ctx.fillRect(itemX, itemY, columnWidth, 30);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(itemX, itemY, columnWidth, 30);

            if (isHovered) {
                ctx.save();
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }

            ctx.fillStyle = isHovered ? "#ffff88" : "#ffffff";
            ctx.font = isHovered ? "bold 16px monospace" : "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`${itemData.item.emoji} ${itemData.item.name} (${itemData.quantity})`, itemX + 10, itemY + 20);

            if (isHovered) {
                ctx.restore();
            }
        }

        // Draw page navigation arrows
        if (totalItems > this.battle.maxVisibleItems) {
            this.renderPaginationArrows(ctx, currentPage, totalPages);
        }
    }

    renderPaginationArrows(ctx, currentPage, totalPages) {
        const arrowX = 455;
        const arrowSize = 15;

        // Up arrow
        if (currentPage > 0) {
            ctx.fillStyle = this.battle.upArrowHovered ? "#ffff88" : "#ffffff";
            if (this.battle.upArrowHovered) {
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }

            ctx.beginPath();
            ctx.moveTo(arrowX, Game.HEIGHT - 130);
            ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 110);
            ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 110);
            ctx.closePath();
            ctx.fill();
            if (this.battle.upArrowHovered) {
                ctx.shadowBlur = 0;
            }
        }

        // Page indicator
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Page", arrowX, Game.HEIGHT - 80);
        ctx.fillText(`${currentPage + 1}/${totalPages}`, arrowX, Game.HEIGHT - 57);

        // Down arrow
        if (currentPage < totalPages - 1) {
            ctx.fillStyle = this.battle.downArrowHovered ? "#ffff88" : "#ffffff";
            if (this.battle.downArrowHovered) {
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 10;
            }

            ctx.beginPath();
            ctx.moveTo(arrowX, Game.HEIGHT - 15);
            ctx.lineTo(arrowX - arrowSize, Game.HEIGHT - 35);
            ctx.lineTo(arrowX + arrowSize, Game.HEIGHT - 35);
            ctx.closePath();
            ctx.fill();

            if (this.battle.downArrowHovered) {
                ctx.shadowBlur = 0;
            }
        }
    }

    drawMessages(ctx) {
        if (this.battle.currentMessage) {
            // Calculate how long the message has been showing
            const messageAge = Date.now() - this.battle.currentMessage.startTime;

            // Start fading after 1 second
            if (messageAge > 1000) {
                this.battle.currentMessage.alpha = Math.max(0, 1 - (messageAge - 1000) / 1000);
            }

            // Draw the message
            ctx.fillStyle = `rgba(255,255,255,${this.battle.currentMessage.alpha})`;
            ctx.font = "20px monospace";
            ctx.textAlign = "center";
            ctx.fillText(this.battle.currentMessage.text, Game.WIDTH / 2, 50);

            // Remove message when fully faded
            if (this.battle.currentMessage.alpha <= 0) {
                this.battle.currentMessage = null;
            }
        }
    }

    drawTransition(ctx) {
        // Handle initial fade in/out
        if (this.battle.state === "init") {
            ctx.fillStyle = `rgba(0,0,0,${1 - this.battle.transitionProgress})`;
            ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT - 150); // Only darken the battle area
        }
        // Handle victory/gameover screens
        else if (this.battle.state === "victory" || this.battle.state === "gameover") {
            // Background fade
            ctx.fillStyle = `rgba(0,0,0,${0.7})`;
            ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT - 150); // Only darken the battle area (600-150 = 450)

            // Add time-based effect
            const time = Date.now() / 1000;
            const scale = 1 + Math.sin(time * 2) * 0.05;

            // Draw main text
            ctx.save();
            ctx.translate(Game.WIDTH / 2, Game.HEIGHT / 2 - 50);
            ctx.scale(scale, scale);
            ctx.fillStyle = this.battle.state === "victory" ? "#ffff00" : "#ff4444";
            ctx.font = "bold 48px monospace";
            ctx.textAlign = "center";
            ctx.shadowColor = this.battle.state === "victory" ? "#ffaa00" : "#aa0000";
            ctx.shadowBlur = 15;
            ctx.fillText(this.battle.state.toUpperCase() + "!", 0, 0);
            ctx.restore();

            // Draw secondary message
            ctx.fillStyle = "#ffffff";
            ctx.font = "20px monospace";
            ctx.textAlign = "center";

            if (this.battle.state === "victory") {
                ctx.fillText("You defeated all enemies!", Game.WIDTH / 2, Game.HEIGHT / 2 + 20);
            } else {
                ctx.fillText("Your party was defeated...", Game.WIDTH / 2, Game.HEIGHT / 2 + 20);
            }
        }
    }
}
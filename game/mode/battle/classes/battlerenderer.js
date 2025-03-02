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
        if (this.battle.targetingMode && this.battle.targetList.length > 0) {
            this.renderTargetingCursor(ctx);
        }

        // Draw enemies
        this.renderEnemies(ctx);
        
        // Draw party members
        this.renderPartyMembers(ctx);

        // Draw battle menu
        this.drawBattleMenu(ctx);

        // Draw active animations
        this.battle.animations.forEach((anim) => anim.render(ctx));

        // Draw messages
        this.drawMessages(ctx);

        // Draw transition effects
        if (this.battle.state === "init" || this.battle.state === "victory" || this.battle.state === "gameover") {
            this.drawTransition(ctx);
        }
    }

    renderTargetingEffects(ctx) {
        if (this.battle.hoveredTarget && !this.battle.hoveredTarget.isDead) {
            const target = this.battle.hoveredTarget;

            // Animated target highlight
            ctx.save();
            const time = Date.now() / 1000;
            const pulseSize = Math.sin(time * 4) * 2;

            // Outer glow
            ctx.strokeStyle = target.type === "enemy" ? "#ff8888" : "#88ff88";
            ctx.lineWidth = 2;
            ctx.shadowColor = target.type === "enemy" ? "#ff0000" : "#00ff00";
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
                    ctx.fillStyle = "#ffff00";
                    ctx.fillText(`${status.toUpperCase()}: ${duration}`, hpX, statusY);
                    statusY += 12;
                }
            });

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
        if (this.battle.isGroupTarget) {
            // Draw targeting cursor over entire group
            const targets = this.battle.targetList[0]; // Get the group array
            const bounce = Math.sin(Date.now() / 100) * 5;

            // Draw an arrow over each target
            targets.forEach((target) => {
                ctx.fillStyle = "#ffff00";
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

            ctx.strokeStyle = "#ffff00";
            ctx.lineWidth = 2;
            ctx.strokeRect(minX - 10 + bounce / 2, minY - 10 + bounce / 2, maxX - minX + 20, maxY - minY + 20);
        } else {
            // Single target cursor
            const target = this.battle.targetList[this.battle.targetIndex];
            if (target && !target.isDead) {
                const bounce = Math.sin(Date.now() / 100) * 5;

                ctx.fillStyle = "#ffff00";
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
        this.battle.enemies.forEach((enemy) => {
            if (!enemy.isDead) {
                ctx.drawImage(enemy.sprite, enemy.pos.x - 24, enemy.pos.y - 24);

                // Constants for bar dimensions
                const barWidth = 48;
                const barHeight = 4;
                const barSpacing = 6;

                // HP bar
                ctx.fillStyle = "#333";
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30, barWidth, barHeight);

                ctx.fillStyle = "#f00";
                const hpWidth = (enemy.hp / enemy.maxHp) * barWidth;
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30, hpWidth, barHeight);

                // ATB gauge
                ctx.fillStyle = "#333";
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30 + barSpacing, barWidth, barHeight);

                ctx.fillStyle = enemy.isReady ? "#ff0" : "#fff";
                const atbWidth = (enemy.atbCurrent / enemy.atbMax) * barWidth;
                ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y + 30 + barSpacing, atbWidth, barHeight);
            }
        });
    }

    renderPartyMembers(ctx) {
        this.battle.party.forEach((char) => {
            if (!char) return; // Skip empty slots
            if (!char.isDead) {
                ctx.drawImage(char.sprite, char.pos.x - 16, char.pos.y - 16);

                // Draw character HP/MP bars
                const barWidth = 64;
                const barHeight = 4;
                const barSpacing = 6;

                // HP bar
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30, barWidth, barHeight);

                ctx.fillStyle = "#0f0";
                const hpWidth = (char.hp / char.maxHp) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30, hpWidth, barHeight);

                // MP bar
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing, barWidth, barHeight);

                ctx.fillStyle = "#00f";
                const mpWidth = (char.mp / char.maxMp) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing, mpWidth, barHeight);

                // ATB gauge
                ctx.fillStyle = "#333";
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing * 2, barWidth, barHeight);

                ctx.fillStyle = char.isReady ? "#ff0" : "#fff";
                const atbWidth = (char.atbCurrent / char.atbMax) * barWidth;
                ctx.fillRect(char.pos.x - barWidth / 2, char.pos.y + 30 + barSpacing * 2, atbWidth, barHeight);
            }
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
            
            const x = 475; // This puts it more towards the right side of the empty space
            const y = Game.HEIGHT - 140 + i * 45;
            const isActive = char === this.battle.activeChar;

            // Draw highlight box for active character
            if (isActive) {
                ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
                ctx.fillRect(x, y, 300, 40);
            }

            // Character name
            ctx.fillStyle = isActive ? "#ffff00" : "#fff";
            ctx.font = "16px monospace";
            ctx.textAlign = "left";
            ctx.fillText(char.name, x + 10, y + 20);

            // HP bar
            const hpBarWidth = 100;
            const hpPercent = char.hp / char.maxHp;
            ctx.fillStyle = "#333";
            ctx.fillRect(x + 100, y + 10, hpBarWidth, 8);
            ctx.fillStyle = hpPercent < 0.2 ? "#ff0000" : hpPercent < 0.5 ? "#ffff00" : "#00ff00";
            ctx.fillRect(x + 100, y + 10, hpBarWidth * hpPercent, 8);
            ctx.fillStyle = "#fff";
            ctx.fillText(`${char.hp}/${char.maxHp}`, x + 210, y + 20);

            // MP bar
            const mpBarWidth = 100;
            const mpPercent = char.mp / char.maxMp;
            ctx.fillStyle = "#333";
            ctx.fillRect(x + 100, y + 25, mpBarWidth, 8);
            ctx.fillStyle = "#4444ff";
            ctx.fillRect(x + 100, y + 25, mpBarWidth * mpPercent, 8);
            ctx.fillStyle = "#fff";
            ctx.fillText(`${char.mp}/${char.maxMp}`, x + 210, y + 35);

            // Draw status effects
            Object.entries(char.status).forEach(([status, duration], j) => {
                if (duration > 0) {
                    ctx.fillStyle = "#ff0";
                    ctx.fillText(status.toUpperCase(), x + 300 + j * 70, y + 25);
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
            ctx.fillText(
                `${spell.name} (${spell.mpCost} MP)`,
                spellX + 10,
                spellY + 20
            );

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
        ctx.fillStyle = `rgba(0,0,0,${this.battle.transitionProgress})`;
        ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

        if (this.battle.state === "victory" || this.battle.state === "gameover") {
            ctx.fillStyle = "#fff";
            ctx.font = "48px monospace";
            ctx.textAlign = "center";
            ctx.fillText(this.battle.state.toUpperCase(), Game.WIDTH / 2, Game.HEIGHT / 2);
        }
    }
}
// game/mode/rpgmenu/submenus/basesubmenu.js
class BaseSubmenu {
    constructor(ctx, input, gameMaster, characterPanel) {
        this.ctx = ctx;
        this.input = input;
        this.gameMaster = gameMaster;
        this.characterPanel = characterPanel;
        this.createGradient = this.gameMaster.modeManager.activeMode.createGradient.bind(
            this.gameMaster.modeManager.activeMode
        );
        this.backButtonRegistered = false;
        this.selectedIndex = 0;
        this.layout = {
            x: 530,
            y: 20,
            width: 250,
            height: 505,
            headerHeight: 40,
            spellSpacing: 45,
            spellHeight: 40,
            padding: 10,
            textOffset: 25,
            backButton: {
                width: 30,
                height: 30,
                rightOffset: 5,
                topOffset: 5
            },
            itemPadding: 10,
            itemSpacing: 45,
            itemHeight: 40
        };
        // Pagination config
        this.pagination = {
            currentPage: 0,
            itemsPerPage: 8,
            arrows: {
                width: 30,
                height: 30,
                padding: 10,
                symbols: {
                    left: "◀",
                    right: "▶"
                }
            },
            pageInfo: {
                y: 470,
                font: "20px monospace"
            }
        };
        // Add description panel config
        this.descriptionPanel = {
            x: 20,
            y: 540,
            width: 425,
            height: 40,
            fontSize: 22,
            textPadding: 10
        };
    }

    registerPaginationElements(menuLayout, totalItems) {
        const { x, y, height, width } = menuLayout;
        const { itemsPerPage, currentPage, arrows } = this.pagination;

        if (totalItems > itemsPerPage) {
            const registerArrow = (name, posX) => {
                this.input.registerElement(name, {
                    bounds: () => ({
                        x: posX,
                        y: y + height - 40,
                        width: arrows.width,
                        height: arrows.height
                    })
                });
            };

            if (currentPage > 0) registerArrow("arrow_left", x + arrows.padding);
            if ((currentPage + 1) * itemsPerPage < totalItems)
                registerArrow("arrow_right", x + width - arrows.width - arrows.padding);
        }
    }

    registerBackButton(bounds) {
        if (!this.backButtonRegistered) {
            this.input.registerElement("back_button", { bounds });
            this.backButtonRegistered = true;
        }
    }

    drawBackButton(x, y, width, height) {
        this.ctx.fillStyle = this.input.isElementHovered("back_button")
            ? this.gameMaster.modeManager.activeMode.colors.buttonTextHover
            : this.gameMaster.modeManager.activeMode.colors.buttonTextNormal;
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("❌", x, y + 20);
    }

    drawPagination(totalItems, menuLayout) {
        const { x, y, height, width } = menuLayout;
        const { pageInfo, arrows, itemsPerPage, currentPage } = this.pagination;
        const colors = this.gameMaster.modeManager.activeMode.colors;

        // Page info
        this.ctx.fillStyle = colors.normalText;
        this.ctx.font = pageInfo.font;
        this.ctx.textAlign = "center";
        this.ctx.fillText(
            `Page ${currentPage + 1}/${Math.ceil(totalItems / itemsPerPage)}`,
            x + width / 2,
            y + height - 20
        );

        const drawArrow = (name, symbol, posX) => {
            this.ctx.save();

            if (this.input.isElementHovered(name)) {
                this.ctx.shadowColor = colors.glowColor;
                this.ctx.shadowBlur = colors.glowBlur;
                this.ctx.fillStyle = colors.paginationHover;
            } else {
                this.ctx.fillStyle = colors.paginationNormal;
            }

            this.ctx.fillText(symbol, posX, y + height - 20);
            this.ctx.restore();
        };

        if (currentPage > 0) {
            drawArrow("arrow_left", arrows.symbols.left, x + arrows.padding + arrows.width / 2);
        }

        if ((currentPage + 1) * itemsPerPage < totalItems) {
            drawArrow("arrow_right", arrows.symbols.right, x + width - arrows.padding - arrows.width / 2);
        }
    }

    drawDescriptionPanel(text) {
        const d = this.descriptionPanel;
        const colors = this.gameMaster.modeManager.activeMode.colors;

        this.ctx.save();

        // Description panel background with gradient
        this.ctx.fillStyle = this.createGradient(
            d.x,
            d.y,
            d.width,
            d.height,
            colors.descriptionBackground.start,
            colors.descriptionBackground.end
        );
        this.ctx.fillRect(d.x, d.y, d.width, d.height);

        if (text) {
            this.ctx.fillStyle = colors.normalText;
            this.ctx.font = `${d.fontSize}px monospace`;
            this.ctx.textAlign = "left";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(text, d.x + d.textPadding, d.y + d.height / 2);
        }

        this.ctx.restore();
    }

    cleanup() {
        if (this.backButtonRegistered) {
            this.input.removeElement("back_button");
            this.backButtonRegistered = false;
        }
        this.input.removeElement("arrow_left");
        this.input.removeElement("arrow_right");
    }
}
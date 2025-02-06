// game/mode/rpgmenu/submenus/basesubmenu.js
class BaseSubmenu {
    constructor(ctx, input, gameMaster, characterPanel) {
        this.ctx = ctx;
        this.input = input;
        this.gameMaster = gameMaster;
        this.characterPanel = characterPanel;

        this.backButtonRegistered = false;
        this.selectedIndex = 0;

        // Add pagination config
        this.pagination = {
            currentPage: 0,
            itemsPerPage: 8,
            arrows: {
                width: 30,
                height: 30,
                padding: 10,
                color: {
                    normal: "#ffffff",
                    hover: "#00ffff"
                },
                symbols: {
                    left: "◀",
                    right: "▶"
                }
            },
            pageInfo: {
                y: 470,
                font: "16px monospace",
                color: "#00ffff"
            }
        };
        // Add description panel config
        this.descriptionPanel = {
            x: 20,
            y: 540,
            width: 350,
            height: 40,
            fontSize: 20,
            textPadding: 10,
            color: "rgba(0, 0, 102, 0.8)"
        };
    }

    registerPaginationElements(menuLayout, totalItems) {
        const m = menuLayout;
        const p = this.pagination;

        if (totalItems > p.itemsPerPage) {
            if (p.currentPage > 0) {
                this.input.registerElement("arrow_left", {
                    bounds: () => ({
                        x: m.x + p.arrows.padding,
                        y: m.y + m.height - 35,
                        width: p.arrows.width,
                        height: p.arrows.height
                    })
                });
            }

            if ((p.currentPage + 1) * p.itemsPerPage < totalItems) {
                this.input.registerElement("arrow_right", {
                    bounds: () => ({
                        x: m.x + m.width - p.arrows.width - p.arrows.padding,
                        y: m.y + m.height - 35,
                        width: p.arrows.width,
                        height: p.arrows.height
                    })
                });
            }
        }
    }

    registerBackButton(bounds) {
        if (!this.backButtonRegistered) {
            this.input.registerElement("back_button", { bounds });
            this.backButtonRegistered = true;
        }
    }

    drawBackButton(x, y, width, height) {
        this.ctx.fillStyle = this.input.isElementHovered("back_button") ? "#00ffff" : "#ffffff";
        this.ctx.font = "24px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("❌", x, y + 20);
    }

    drawPagination(totalItems, menuLayout) {
        const m = menuLayout;
        const p = this.pagination;

        // Page info
        this.ctx.fillStyle = p.pageInfo.color;
        this.ctx.font = p.pageInfo.font;
        this.ctx.textAlign = "center";
        this.ctx.fillText(
            `Page ${p.currentPage + 1}/${Math.ceil(totalItems / p.itemsPerPage)}`,
            m.x + m.width / 2,
            m.y + m.height - 20
        );

        // Left arrow
        if (p.currentPage > 0) {
            this.ctx.fillStyle = this.input.isElementHovered("arrow_left")
                ? p.arrows.color.hover
                : p.arrows.color.normal;
            this.ctx.fillText(p.arrows.symbols.left, m.x + p.arrows.padding + p.arrows.width / 2, m.y + m.height - 20);
        }

        // Right arrow
        if ((p.currentPage + 1) * p.itemsPerPage < totalItems) {
            this.ctx.fillStyle = this.input.isElementHovered("arrow_right")
                ? p.arrows.color.hover
                : p.arrows.color.normal;
            this.ctx.fillText(
                p.arrows.symbols.right,
                m.x + m.width - p.arrows.padding - p.arrows.width / 2,
                m.y + m.height - 20
            );
        }
    }

    drawDescriptionPanel(text) {
        const d = this.descriptionPanel;

        this.ctx.save();

        // Draw panel background
        this.ctx.fillStyle = d.color;
        this.ctx.fillRect(d.x, d.y, d.width, d.height);

        if (text) {
            this.ctx.fillStyle = "#ffffff";
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
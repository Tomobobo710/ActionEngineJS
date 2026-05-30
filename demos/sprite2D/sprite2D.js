// sprite2D.js - Test ActionSprite2D with ActionRenderer2D
class Game {
    static get WIDTH() {
        return 800;
    }
    static get HEIGHT() {
        return 600;
    }

    constructor(canvases, input, audio) {
        this.input = input;
        this.gameCanvas = canvases.gameCanvas;

        this.renderer = new ActionRenderer2D(this.gameCanvas);

        // Load real images and create sprites
        const img1 = new Image();
        img1.onload = () => {
            this.sprite = new ActionSprite2D({
                image: img1,
                x: 400,
                y: 300,
                z: 10,
                alpha: 0.8
            });
            this.renderer.addSprite(this.sprite);
        };
        img1.src = "test1.png";

        const img2 = new Image();
        img2.onload = () => {
            this.sprite2 = new ActionSprite2D({
                image: img2,
                x: 200,
                y: 200,
                z: 5
            });
            this.renderer.addSprite(this.sprite2);
        };
        img2.src = "test2.jpg";

        // Canvas-based sprite
        const canvasImg = document.createElement("canvas");
        canvasImg.width = 64;
        canvasImg.height = 64;
        const cctx = canvasImg.getContext("2d");
        cctx.fillStyle = "#00ff88";
        cctx.fillRect(0, 0, 64, 64);
        cctx.fillStyle = "#004422";
        cctx.fillRect(16, 16, 32, 32);

        this.sprite3 = new ActionSprite2D({
            image: canvasImg,
            x: 600,
            y: 400,
            z: 7,
            alpha: 0.6
        });
        this.renderer.addSprite(this.sprite3);
    }

    action_update(dt) {
        const t = performance.now() / 1000;
        if (this.sprite) {
            this.sprite.x = 400 + Math.cos(t) * 150;
            this.sprite.y = 300 + Math.sin(t) * 100;
            this.sprite.rotation = t;
        }
        if (this.sprite2) {
            this.sprite2.x = 200 + Math.sin(t * 0.7) * 100;
            this.sprite2.y = 200 + Math.cos(t * 0.5) * 80;
            this.sprite2.setScale(1 + Math.sin(t * 2) * 0.5);
        }
        if (this.sprite3) {
            this.sprite3.x = 600 + Math.sin(t * 0.8) * 120;
            this.sprite3.y = 400 + Math.cos(t * 0.6) * 100;
            this.sprite3.rotation = -t * 0.5;
            this.sprite3.setFlip(t % 2 < 1, false);
        }
    }

    action_draw(alpha) {
        this.renderer.render(null, null, false, null);
    }
}

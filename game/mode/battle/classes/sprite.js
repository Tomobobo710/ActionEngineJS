// game/mode/battle/classes/sprite.js
class Sprite {
    static genHeroSprite(type) {
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const ctx = c.getContext("2d");

        switch (type) {
            case "warrior":
                // Body
                ctx.fillStyle = "#4444aa";
                ctx.fillRect(8, 4, 16, 24);

                // Head
                ctx.fillStyle = "#ffcc99";
                ctx.fillRect(10, 0, 12, 8);

                // Hair
                ctx.fillStyle = "#332211";
                ctx.fillRect(8, 0, 16, 4);

                // Armor
                ctx.fillStyle = "#8888ff";
                ctx.fillRect(6, 12, 20, 8);

                // Shield
                ctx.fillStyle = "#aa4444";
                ctx.fillRect(4, 16, 8, 8);

                // Sword
                ctx.fillStyle = "#cccccc";
                ctx.fillRect(20, 8, 4, 16);

                break;

            case "mage":
                // Robe
                ctx.fillStyle = "#884488";
                ctx.fillRect(8, 4, 16, 24);

                // Head
                ctx.fillStyle = "#ffcc99";
                ctx.fillRect(10, 0, 12, 8);

                // Hat
                ctx.fillStyle = "#aa44aa";
                ctx.beginPath();
                ctx.moveTo(8, 4);
                ctx.lineTo(16, 0);
                ctx.lineTo(24, 4);
                ctx.fill();

                // Staff
                ctx.fillStyle = "#885500";
                ctx.fillRect(20, 8, 4, 20);
                ctx.fillStyle = "#ffff00";
                ctx.fillRect(18, 4, 8, 8);

                break;

            case "thief":
                // Body
                ctx.fillStyle = "#448844";
                ctx.fillRect(8, 4, 16, 24);

                // Head
                ctx.fillStyle = "#ffcc99";
                ctx.fillRect(10, 0, 12, 8);

                // Hood
                ctx.fillStyle = "#226622";
                ctx.fillRect(8, 0, 16, 4);
                ctx.fillRect(6, 4, 4, 8);
                ctx.fillRect(22, 4, 4, 8);

                // Cape
                ctx.fillStyle = "#226622";
                ctx.fillRect(6, 12, 20, 8);

                // Daggers
                ctx.fillStyle = "#cccccc";
                ctx.fillRect(4, 16, 8, 4);
                ctx.fillRect(20, 16, 8, 4);

                break;
        }

        // Add pixel art shading
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        for (let x = 0; x < 32; x += 2) {
            for (let y = 0; y < 32; y += 2) {
                if (Math.random() < 0.2) {
                    ctx.fillRect(x, y, 2, 2);
                }
            }
        }

        return c;
    }

    static genEnemySprite(type) {
        const c = document.createElement("canvas");
        c.width = c.height = 48;
        const ctx = c.getContext("2d");

        switch (type) {
            case "slime":
                // Body
                ctx.fillStyle = "#44aa44";
                ctx.beginPath();
                ctx.ellipse(24, 32, 20, 12, 0, 0, Math.PI * 2);
                ctx.fill();

                // Eyes
                ctx.fillStyle = "#000000";
                ctx.beginPath();
                ctx.arc(16, 28, 4, 0, Math.PI * 2);
                ctx.arc(32, 28, 4, 0, Math.PI * 2);
                ctx.fill();

                break;

            case "bat":
                // Wings
                ctx.fillStyle = "#442244";
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
                ctx.fillStyle = "#884488";
                ctx.beginPath();
                ctx.ellipse(24, 24, 8, 12, 0, 0, Math.PI * 2);
                ctx.fill();

                break;

            case "goblin":
                // Body
                ctx.fillStyle = "#88aa44";
                ctx.fillRect(16, 8, 16, 32);

                // Head
                ctx.fillStyle = "#aacc66";
                ctx.beginPath();
                ctx.ellipse(24, 12, 10, 8, 0, 0, Math.PI * 2);
                ctx.fill();

                // Eyes
                ctx.fillStyle = "#ff0000";
                ctx.beginPath();
                ctx.arc(20, 10, 3, 0, Math.PI * 2);
                ctx.arc(28, 10, 3, 0, Math.PI * 2);
                ctx.fill();

                // Club
                ctx.fillStyle = "#885500";
                ctx.fillRect(32, 4, 8, 20);

                break;
        }

        return c;
    }

    static genBackground(type = "cave") {
        const c = document.createElement("canvas");
        c.width = 800;
        c.height = 600;
        const ctx = c.getContext("2d");

        switch (type) {
            case "cave":
                // Background gradient
                const grad = ctx.createLinearGradient(0, 0, 0, 600);
                grad.addColorStop(0, "#000000");
                grad.addColorStop(1, "#222244");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 800, 600);

                // Cave walls
                ctx.fillStyle = "#443322";
                for (let x = 0; x < 800; x += 32) {
                    const height = Math.sin(x / 100) * 50 + 100;
                    ctx.fillRect(x, 0, 32, height);
                    ctx.fillRect(x, 600 - height, 32, height);
                }

                // Stalactites/stalagmites
                ctx.fillStyle = "#554433";
                for (let i = 0; i < 20; i++) {
                    const x = Math.random() * 800;
                    const h = Math.random() * 100 + 50;

                    // Stalactite
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x + 20, h);
                    ctx.lineTo(x - 20, h);
                    ctx.fill();

                    // Stalagmite
                    ctx.beginPath();
                    ctx.moveTo(x, 600);
                    ctx.lineTo(x + 20, 600 - h);
                    ctx.lineTo(x - 20, 600 - h);
                    ctx.fill();
                }

                break;
        }

        return c;
    }
}
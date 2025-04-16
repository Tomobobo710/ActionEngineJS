// game/mode/battle/entities/sprite.js
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
    // Ornate Steel Helmet with Gold Trim
    ctx.fillStyle = "#a8a8a8";  // Bright steel
    ctx.fillRect(10, 0, 12, 4);  // Helmet crown
    ctx.fillStyle = "#949494";  // Mid steel
    ctx.fillRect(8, 4, 16, 8);   // Helmet main body
    ctx.fillStyle = "#787878";  // Dark steel
    ctx.fillRect(10, 6, 12, 2);  // Visor slit
    ctx.fillStyle = "#ffd700";  // Gold trim
    ctx.fillRect(8, 2, 2, 2);    // Left ornament
    ctx.fillRect(22, 2, 2, 2);   // Right ornament
    
    // Intricately Detailed Armor Body
    ctx.fillStyle = "#b0b0b0";  // Main armor plate
    ctx.fillRect(8, 12, 16, 16); // Torso
    ctx.fillStyle = "#c8c8c8";  // Highlight plates
    ctx.fillRect(10, 14, 12, 2); // Upper chest plate
    ctx.fillRect(9, 18, 14, 2);  // Lower chest plate
    
    // Magnificent Flowing Cape with Dynamic Shading
    ctx.fillStyle = "#cc0000";  // Rich red
    ctx.fillRect(4, 8, 24, 4);   // Cape top
    ctx.fillStyle = "#aa0000";  // Mid red
    ctx.fillRect(4, 12, 4, 20);  // Left cape
    ctx.fillRect(24, 12, 4, 20); // Right cape
    ctx.fillStyle = "#880000";  // Dark red for depth
    ctx.fillRect(6, 14, 2, 16);  // Left cape shadow
    ctx.fillRect(24, 14, 2, 16); // Right cape shadow
    
    // Masterwork Sword with Ornate Details
    ctx.fillStyle = "#ffd700";  // Gold handle
    ctx.fillRect(2, 16, 8, 4);   // Handle
    ctx.fillStyle = "#eeeeee";  // Bright steel blade
    ctx.fillRect(0, 15, 2, 6);   // Blade
    ctx.fillStyle = "#ffd700";  // Gold guard
    ctx.fillRect(3, 14, 6, 2);   // Crossguard
    
    // Advanced Armor Plating with Shadow Detail
    ctx.fillStyle = "#a0a0a0";  // Steel
    ctx.fillRect(6, 12, 4, 6);   // Left pauldron
    ctx.fillRect(22, 12, 4, 6);  // Right pauldron
    
    // Articulated Leg Armor with Intricate Joints
    ctx.fillStyle = "#b0b0b0";  // Main leg plates
    ctx.fillRect(10, 28, 6, 12); // Left leg
    ctx.fillRect(16, 28, 6, 12); // Right leg
    ctx.fillStyle = "#c8c8c8";  // Highlight
    ctx.fillRect(11, 30, 4, 2);  // Left knee plate
    ctx.fillRect(17, 30, 4, 2);  // Right knee plate
    
    // Elaborate Gold Trim and Decorative Elements
    ctx.fillStyle = "#ffd700";  // Gold
    ctx.fillRect(12, 20, 8, 2);  // Belt
    ctx.fillRect(8, 16, 2, 2);   // Left shoulder ornament
    ctx.fillRect(22, 16, 2, 2);  // Right shoulder ornament
    
    // Additional Armor Details and Weathering
    ctx.fillStyle = "#d0d0d0";  // Brightest steel
    ctx.fillRect(9, 15, 1, 4);   // Left edge highlight
    ctx.fillRect(22, 15, 1, 4);  // Right edge highlight
    
    // Leather Straps and Buckles
    ctx.fillStyle = "#8b4513";  // Leather color
    ctx.fillRect(7, 14, 2, 8);   // Left strap
    ctx.fillRect(23, 14, 2, 8);  // Right strap
    ctx.fillStyle = "#daa520";  // Bronze buckles
    ctx.fillRect(7, 18, 2, 2);   // Left buckle
    ctx.fillRect(23, 18, 2, 2);  // Right buckle
    
    // Hidden Daggers and Tools
    ctx.fillStyle = "#silver";  // Steel
    ctx.fillRect(6, 24, 2, 6);   // Left dagger
    ctx.fillRect(24, 24, 2, 6);  // Right dagger
    
    // Chainmail Underlayer Showing Through
    ctx.fillStyle = "#808080";  // Chain detail
    for(let y = 14; y < 28; y += 2) {
        for(let x = 10; x < 22; x += 2) {
            if(Math.random() > 0.7) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    // Battle Damage and Wear
    ctx.fillStyle = "#696969";  // Scratches
    for(let i = 0; i < 10; i++) {
        const x = 8 + Math.floor(Math.random() * 16);
        const y = 12 + Math.floor(Math.random() * 20);
        ctx.fillRect(x, y, 2, 1);
    }
    
    // Advanced Shadow Effects
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(8, 26, 16, 4);  // Body shadow
    ctx.fillRect(4, 30, 24, 2);  // Ground shadow
    
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
                // Main body - larger dome shape with pixels
                ctx.fillStyle = "#44aa44";
                // Bottom layer (widest)
                ctx.fillRect(8, 36, 32, 12);
                // Lower middle layer
                ctx.fillRect(4, 32, 40, 8);
                // Upper middle layer
                ctx.fillRect(6, 26, 36, 8);
                // Upper layer
                ctx.fillRect(8, 20, 32, 8);
                // Top layer
                ctx.fillRect(12, 16, 24, 8);

                // Eyes (larger squares)
                ctx.fillStyle = "#000000";
                ctx.fillRect(14, 24, 8, 8); // Left eye
                ctx.fillRect(26, 24, 8, 8); // Right eye

                // Shine/highlight pixels
                ctx.fillStyle = "#55cc55";
                ctx.fillRect(16, 20, 6, 6); // Left highlight
                ctx.fillRect(26, 20, 6, 6); // Right highlight

                // Bottom shading details
                ctx.fillStyle = "#338833";
                ctx.fillRect(10, 40, 28, 6); // Bottom shade
                ctx.fillRect(6, 36, 4, 4); // Left edge shade
                ctx.fillRect(38, 36, 4, 4); // Right edge shade

                break;
                
                case "ghoul":
    // Main body structure with more defined anatomy
    ctx.fillStyle = "#a0a090";  // Base corpse color
    ctx.fillRect(16, 12, 16, 28);    // Torso
    
    // Enhanced skeletal details
    ctx.fillStyle = "#908070";  // Darker tone for bone protrusions
    ctx.fillRect(18, 16, 2, 24);     // Visible ribcage left
    ctx.fillRect(28, 16, 2, 24);     // Visible ribcage right
    ctx.fillRect(22, 20, 4, 16);     // Spine detail
    
    // Decaying flesh patches
    ctx.fillStyle = "#7a756a";  // Rotting flesh tone
    ctx.fillRect(17, 18, 3, 5);      // Left torso decay
    ctx.fillRect(28, 22, 4, 6);      // Right torso decay
    ctx.fillRect(20, 30, 8, 4);      // Center decay patch
    
    // Enhanced head with more horror elements
    ctx.fillStyle = "#a0a090";
    ctx.fillRect(14, 2, 20, 14);     // Wider, more grotesque head
    
    // Sunken face details
    ctx.fillStyle = "#807060";  // Shadowed areas
    ctx.fillRect(16, 4, 16, 6);      // Sunken cheeks
    
    // Glowing eyes with more detail
    ctx.fillStyle = "#000000";  // Eye sockets
    ctx.fillRect(18, 5, 5, 5);       // Left socket
    ctx.fillRect(25, 5, 5, 5);       // Right socket
    ctx.fillStyle = "#ffff00";  // Glowing effect
    ctx.fillRect(19, 6, 3, 3);       // Left eye
    ctx.fillRect(26, 6, 3, 3);       // Right eye
    ctx.fillStyle = "#ffffff";  // Intense center glow
    ctx.fillRect(20, 7, 1, 1);       // Left eye highlight
    ctx.fillRect(27, 7, 1, 1);       // Right eye highlight
    
    // Jagged mouth with exposed teeth
    ctx.fillStyle = "#000000";  // Mouth cavity
    ctx.fillRect(20, 12, 8, 3);      // Open maw
    ctx.fillStyle = "#ddd8d0";  // Teeth
    ctx.fillRect(21, 12, 1, 2);      // Individual teeth
    ctx.fillRect(23, 12, 1, 2);
    ctx.fillRect(25, 12, 1, 2);
    
    // Enhanced claws and arms
    ctx.fillStyle = "#807060";  // Arm base color
    ctx.fillRect(10, 20, 6, 14);     // Left arm
    ctx.fillRect(32, 20, 6, 14);     // Right arm
    
    // Detailed claws
    ctx.fillStyle = "#605040";  // Claw color
    // Left hand claws
    ctx.fillRect(8, 30, 2, 4);       // Thumb
    ctx.fillRect(10, 32, 2, 5);      // Index
    ctx.fillRect(12, 32, 2, 6);      // Middle
    ctx.fillRect(14, 32, 2, 5);      // Ring
    // Right hand claws
    ctx.fillRect(32, 32, 2, 5);      // Index
    ctx.fillRect(34, 32, 2, 6);      // Middle
    ctx.fillRect(36, 32, 2, 5);      // Ring
    ctx.fillRect(38, 30, 2, 4);      // Thumb
    
    // Tattered robe with more detail
    ctx.fillStyle = "#404040";  // Base robe color
    ctx.fillRect(14, 16, 20, 24);    // Main robe
    ctx.fillStyle = "#303030";  // Darker robe details
    // Torn edges and folds
    for(let i = 0; i < 6; i++) {
        const x = 14 + (i * 4);
        const h = Math.floor(Math.random() * 6) + 2;
        ctx.fillRect(x, 36, 2, h);    // Bottom tears
    }
    
    // Add gore and viscera details
    ctx.fillStyle = "#8b0000";  // Dark blood color
    for(let i = 0; i < 8; i++) {
        const x = 14 + Math.floor(Math.random() * 20);
        const y = 16 + Math.floor(Math.random() * 20);
        ctx.fillRect(x, y, 2, 2);     // Blood spots
    }
    
    // Atmospheric effects
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    for(let i = 0; i < 20; i++) {
        const x = 10 + Math.floor(Math.random() * 28);
        const y = 4 + Math.floor(Math.random() * 40);
        ctx.fillRect(x, y, 1, 1);     // Dark spots for depth
    }
    
    break;

            case "zombie":
    // Legs
    ctx.fillStyle = "#4d645c";  // Base pants color
    ctx.fillRect(16, 32, 16, 16);    // Legs
    // Torn pants details
    ctx.fillStyle = "#3a4d45";       // Darker shade
    ctx.fillRect(16, 36, 4, 8);      // Left tear
    ctx.fillRect(24, 34, 6, 6);      // Right tear
    ctx.fillRect(18, 42, 12, 4);     // Bottom fraying
    
    // Torso
    ctx.fillStyle = "#608060";       // Base zombie color
    ctx.fillRect(16, 16, 16, 16);    // Main torso
    
    // Tattered Shirt
    ctx.fillStyle = "#45584d";       // Dirty shirt color
    ctx.fillRect(16, 16, 16, 12);    // Shirt body
    ctx.fillStyle = "#3a4d45";       // Darker shirt details
    ctx.fillRect(16, 20, 4, 6);      // Left tear
    ctx.fillRect(26, 18, 4, 8);      // Right tear
    ctx.fillRect(20, 24, 8, 4);      // Bottom shirt fraying
    
    // Arms Base
    ctx.fillStyle = "#608060";       // Zombie flesh
    ctx.fillRect(4, 22, 40, 4);      // Basic arm structure
    
    // Detailed Arms
    ctx.fillStyle = "#4d645c";       // Shading
    ctx.fillRect(8, 22, 4, 2);       // Left arm detail
    ctx.fillRect(36, 22, 4, 2);      // Right arm detail
    // Muscle definition
    ctx.fillStyle = "#6a8c6a";       // Lighter highlights
    ctx.fillRect(12, 21, 4, 1);      // Left bicep
    ctx.fillRect(32, 21, 4, 1);      // Right bicep
    
    // Head
    ctx.fillStyle = "#608060";       // Base head color
    ctx.fillRect(16, 8, 16, 8);      // Basic head shape
    // Face details
    ctx.fillStyle = "#6a8c6a";       // Lighter green for highlights
    ctx.fillRect(18, 9, 12, 6);      // Face structure
    
    // Eyes
    ctx.fillStyle = "#000000";       // Eye sockets
    ctx.fillRect(19, 10, 4, 4);      // Left socket
    ctx.fillRect(25, 10, 4, 4);      // Right socket
    ctx.fillStyle = "#ff0000";       // Glowing red
    ctx.fillRect(20, 11, 2, 2);      // Left eye
    ctx.fillRect(26, 11, 2, 2);      // Right eye
    
    // Decaying flesh details
    ctx.fillStyle = "#4d645c";       // Darker rot spots
    ctx.fillRect(17, 12, 2, 2);      // Face decay
    ctx.fillRect(29, 10, 2, 3);      // Head wound
    ctx.fillRect(22, 14, 3, 2);      // Jaw decay
    
    // Bone showing through
    ctx.fillStyle = "#e8e8e8";       // Bone color
    ctx.fillRect(6, 23, 2, 2);       // Left arm bone
    ctx.fillRect(40, 23, 2, 2);      // Right arm bone
    
    // Gore/blood details
    ctx.fillStyle = "#8b0000";       // Dark blood
    ctx.fillRect(16, 26, 2, 4);      // Torso blood
    ctx.fillRect(28, 30, 3, 6);      // Leg blood
    
    // Additional shading/highlights
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(16, 28, 16, 4);     // Torso shadow
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(18, 18, 12, 2);     // Upper torso highlight
    
    break;

           case "bat":
    // Enhanced wing structure - Left side
    ctx.fillStyle = "#442244";
    // Main wing membrane with detail
    ctx.fillRect(4, 12, 16, 4);      // Upper wing segment
    ctx.fillRect(8, 16, 12, 4);      // Middle wing segment
    ctx.fillRect(12, 20, 8, 4);      // Lower wing segment
    
    // Wing bone structure
    ctx.fillStyle = "#331133";       // Darker shade for bones
    ctx.fillRect(6, 13, 12, 1);      // Upper wing bone
    ctx.fillRect(10, 17, 8, 1);      // Middle wing bone
    ctx.fillRect(14, 21, 4, 1);      // Lower wing bone
    
    // Wing membrane details
    ctx.fillStyle = "#553355";       // Lighter shade for veins
    for(let i = 0; i < 3; i++) {     // Wing membrane veins
        ctx.fillRect(8 + (i*4), 14, 1, 6);
    }
    
    // Enhanced wing structure - Right side
    ctx.fillStyle = "#442244";
    ctx.fillRect(28, 12, 16, 4);     // Upper wing segment
    ctx.fillRect(28, 16, 12, 4);     // Middle wing segment
    ctx.fillRect(28, 20, 8, 4);      // Lower wing segment
    
    // Right wing bone structure
    ctx.fillStyle = "#331133";
    ctx.fillRect(30, 13, 12, 1);     // Upper wing bone
    ctx.fillRect(30, 17, 8, 1);      // Middle wing bone
    ctx.fillRect(30, 21, 4, 1);      // Lower wing bone
    
    // Right wing membrane details
    ctx.fillStyle = "#553355";
    for(let i = 0; i < 3; i++) {     // Wing membrane veins
        ctx.fillRect(32 + (i*4), 14, 1, 6);
    }
    
    // Enhanced body with fur texture
    ctx.fillStyle = "#884488";       // Main body color
    ctx.fillRect(18, 16, 12, 16);    // Center body
    ctx.fillRect(16, 20, 16, 8);     // Wider middle section
    
    // Fur detail
    ctx.fillStyle = "#773377";       // Darker fur patches
    for(let i = 0; i < 8; i++) {
        const x = 18 + Math.floor(Math.random() * 10);
        const y = 18 + Math.floor(Math.random() * 12);
        ctx.fillRect(x, y, 2, 2);    // Random fur tufts
    }
    
    // Enhanced head with more detail
    ctx.fillStyle = "#884488";
    ctx.fillRect(20, 12, 8, 8);      // Head base
    
    // Detailed face features
    ctx.fillStyle = "#773377";       // Darker shade
    ctx.fillRect(21, 16, 6, 2);      // Mouth area
    
    // Enhanced eyes with glow effect
    ctx.fillStyle = "#000000";       // Eye sockets
    ctx.fillRect(21, 13, 3, 3);      // Left eye socket
    ctx.fillRect(25, 13, 3, 3);      // Right eye socket
    
    ctx.fillStyle = "#ff0000";       // Main eye color
    ctx.fillRect(22, 14, 2, 2);      // Left eye
    ctx.fillRect(26, 14, 2, 2);      // Right eye
    
    ctx.fillStyle = "#ff6666";       // Eye shine
    ctx.fillRect(22, 14, 1, 1);      // Left eye highlight
    ctx.fillRect(26, 14, 1, 1);      // Right eye highlight
    
    // Enhanced ears with more detail
    ctx.fillStyle = "#442244";       // Base ear color
    ctx.fillRect(20, 8, 3, 4);       // Left ear
    ctx.fillRect(25, 8, 3, 4);       // Right ear
    
    // Inner ear detail
    ctx.fillStyle = "#663366";
    ctx.fillRect(21, 9, 1, 2);       // Left inner ear
    ctx.fillRect(26, 9, 1, 2);       // Right inner ear
    
    // Fangs
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(22, 17, 1, 2);      // Left fang
    ctx.fillRect(25, 17, 1, 2);      // Right fang
    
    // Body shading and texture
    ctx.fillStyle = "#663366";
    ctx.fillRect(20, 24, 8, 4);      // Lower body shading
    
    // Wing joint details
    ctx.fillStyle = "#331133";
    ctx.fillRect(8, 14, 4, 2);       // Left wing joint
    ctx.fillRect(36, 14, 4, 2);      // Right wing joint
    
    // Additional atmospheric details
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    for(let i = 0; i < 10; i++) {
        const x = 16 + Math.floor(Math.random() * 16);
        const y = 12 + Math.floor(Math.random() * 16);
        ctx.fillRect(x, y, 1, 1);    // Shadow spots
    }
    
    // Claw details on wing joints
    ctx.fillStyle = "#331133";
    ctx.fillRect(6, 15, 2, 2);       // Left wing claw
    ctx.fillRect(40, 15, 2, 2);      // Right wing claw
    
    break;

            case "skeleton":
    // Enhanced skull with detailed structure
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(16, 4, 16, 16);     // Main skull shape
    
    // Skull detail and structure
    ctx.fillStyle = "#e0e0e0";       // Shading for bone depth
    ctx.fillRect(17, 6, 14, 2);      // Brow ridge
    ctx.fillRect(18, 14, 12, 2);     // Cheekbones
    ctx.fillRect(19, 16, 10, 2);     // Jaw structure
    
    // Enhanced eye sockets with depth
    ctx.fillStyle = "#000000";       // Deep shadow
    ctx.fillRect(20, 8, 4, 6);       // Left eye socket
    ctx.fillRect(26, 8, 4, 6);       // Right eye socket
    
    // Glowing eye effect
    ctx.fillStyle = "#0000ff";       // Deep blue glow
    ctx.fillRect(21, 9, 2, 2);       // Left eye
    ctx.fillRect(27, 9, 2, 2);       // Right eye
    ctx.fillStyle = "#4444ff";       // Lighter blue
    ctx.fillRect(21, 9, 1, 1);       // Left eye highlight
    ctx.fillRect(27, 9, 1, 1);       // Right eye highlight
    
    // Detailed jaw and teeth
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(18, 16, 12, 4);     // Jaw base
    ctx.fillStyle = "#e0e0e0";       // Tooth detail
    for(let i = 0; i < 5; i++) {     // Individual teeth
        ctx.fillRect(19 + (i*2), 18, 1, 2);
    }
    
    // Enhanced ribcage with depth
    ctx.fillStyle = "#ffffff";       // Main bone color
    ctx.fillRect(18, 24, 12, 16);    // Spine
    
    // Detailed ribs with shading
    for(let i = 0; i < 3; i++) {     // Each rib pair
        const y = 26 + (i * 6);
        // Left ribs
        ctx.fillRect(14, y, 20, 4);      // Base rib
        ctx.fillStyle = "#e0e0e0";       // Shading
        ctx.fillRect(14, y + 1, 19, 2);  // Rib detail
        ctx.fillStyle = "#ffffff";
        
        // Rib curve details
        ctx.fillRect(12, y + 1, 2, 2);   // Left curve
        ctx.fillRect(32, y + 1, 2, 2);   // Right curve
    }
    
    // Enhanced arm structure
    ctx.fillStyle = "#ffffff";
    // Upper arms with joint detail
    ctx.fillRect(12, 24, 4, 16);     // Left upper arm
    ctx.fillRect(32, 24, 4, 16);     // Right upper arm
    
    // Elbow joints
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(11, 36, 6, 4);      // Left elbow
    ctx.fillRect(31, 36, 6, 4);      // Right elbow
    
    // Forearms with bone detail
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(10, 36, 4, 12);     // Left forearm
    ctx.fillRect(34, 36, 4, 12);     // Right forearm
    
    // Detailed hands with individual bones
    ctx.fillStyle = "#ffffff";
    // Left hand
    for(let i = 0; i < 4; i++) {     // Finger bones
        ctx.fillRect(8 + (i*2), 44, 2, 4);
    }
    // Right hand
    for(let i = 0; i < 4; i++) {
        ctx.fillRect(32 + (i*2), 44, 2, 4);
    }
    
    // Enhanced leg structure
    ctx.fillStyle = "#ffffff";
    // Thigh bones with detail
    ctx.fillRect(20, 44, 4, 16);     // Left leg
    ctx.fillRect(26, 44, 4, 16);     // Right leg
    
    // Knee joints
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(19, 56, 6, 4);      // Left knee
    ctx.fillRect(25, 56, 6, 4);      // Right knee
    
    // Detailed feet with individual bones
    ctx.fillStyle = "#ffffff";
    // Left foot
    for(let i = 0; i < 3; i++) {     // Toe bones
        ctx.fillRect(18 + (i*2), 56, 2, 4);
    }
    // Right foot
    for(let i = 0; i < 3; i++) {
        ctx.fillRect(26 + (i*2), 56, 2, 4);
    }
    
    // Enhanced sword with medieval detail
    // Blade
    ctx.fillStyle = "#cccccc";       // Base blade
    ctx.fillRect(38, 24, 4, 20);     // Main blade
    ctx.fillStyle = "#ffffff";       // Blade shine
    ctx.fillRect(39, 24, 2, 20);     // Center fuller
    
    // Detailed crossguard
    ctx.fillStyle = "#885500";       // Bronze guard
    ctx.fillRect(36, 40, 8, 4);      // Main guard
    ctx.fillStyle = "#663300";       // Guard detail
    ctx.fillRect(35, 41, 10, 2);     // Decorative pattern
    
    // Ornate handle
    ctx.fillStyle = "#885500";       // Handle wrap
    ctx.fillRect(38, 44, 4, 8);      // Handle
    ctx.fillStyle = "#663300";       // Wrap detail
    for(let i = 0; i < 4; i++) {     // Handle wrapping
        ctx.fillRect(38, 44 + (i*2), 4, 1);
    }
    
    // Pommel detail
    ctx.fillStyle = "#885500";
    ctx.fillRect(37, 52, 6, 3);      // Pommel base
    ctx.fillStyle = "#ffcc00";       // Gold detail
    ctx.fillRect(38, 52, 4, 2);      // Pommel decoration
    
    // Ancient rune effects
    ctx.fillStyle = "#4444ff";       // Magical blue
    for(let i = 0; i < 3; i++) {     // Glowing runes
        ctx.fillRect(39, 26 + (i*6), 2, 2);
    }
    
    // Additional aging effects
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    for(let i = 0; i < 20; i++) {    // Weathered bone effect
        const x = 16 + Math.floor(Math.random() * 16);
        const y = 8 + Math.floor(Math.random() * 48);
        ctx.fillRect(x, y, 1, 1);
    }
    
    break;
               
    case "wolf":
    // Larger, longer body structure
    ctx.fillStyle = "#404050";       // Dark grey base
    ctx.fillRect(8, 20, 32, 16);     // Elongated main body
    
    // Muscular definition and fur texture
    ctx.fillStyle = "#303040";       // Darker shade for depth
    ctx.fillRect(10, 22, 28, 4);     // Upper body muscles
    ctx.fillRect(12, 26, 24, 4);     // Lower body definition
    
    // Larger, more aggressive head
    ctx.fillStyle = "#404050";
    ctx.fillRect(36, 16, 16, 14);    // Bigger head
    
    // Extended snout structure
    ctx.fillStyle = "#404050";
    ctx.fillRect(44, 18, 12, 12);    // Base of snout
    
    // Snout detail and nose
    ctx.fillStyle = "#303040";
    ctx.fillRect(44, 20, 14, 8);     // Extended snout
    ctx.fillStyle = "#202030";
    ctx.fillRect(56, 22, 4, 4);      // Nose tip
    
    // Menacing teeth along extended jaw
    ctx.fillStyle = "#ffffff";
    // Upper jaw
    ctx.fillRect(48, 26, 2, 3);      // Front fangs
    ctx.fillRect(52, 26, 2, 3);
    ctx.fillRect(45, 26, 2, 2);
    ctx.fillRect(55, 26, 2, 2);
    // Lower jaw
    ctx.fillRect(47, 28, 2, 2);
    ctx.fillRect(51, 28, 2, 2);
    ctx.fillRect(44, 28, 2, 2);
    ctx.fillRect(54, 28, 2, 2);
    
    // Taller pointed ears 
    ctx.fillStyle = "#404050";
    // Left ear - tall triangular shape
    ctx.beginPath();
    ctx.moveTo(38, 16);      // Base left
    ctx.lineTo(41, 2);       // Point (moved up for height)
    ctx.lineTo(44, 16);      // Base right
    ctx.fill();
    
    // Right ear - tall triangular shape
    ctx.beginPath();
    ctx.moveTo(46, 16);      // Base left
    ctx.lineTo(49, 2);       // Point (moved up for height)
    ctx.lineTo(52, 16);      // Base right
    ctx.fill();
    
    // Inner ear detail - taller
    ctx.fillStyle = "#303040";
    // Left inner ear
    ctx.beginPath();
    ctx.moveTo(39, 15);
    ctx.lineTo(41, 4);       // Moved up
    ctx.lineTo(43, 15);
    ctx.fill();
    
    // Right inner ear
    ctx.beginPath();
    ctx.moveTo(47, 15);
    ctx.lineTo(49, 4);       // Moved up
    ctx.lineTo(51, 15);
    ctx.fill();
    
    // Fierce glowing eyes
    ctx.fillStyle = "#000000";       // Eye sockets
    ctx.fillRect(40, 18, 4, 4);      // Left socket
    ctx.fillRect(46, 18, 4, 4);      // Right socket
    
    ctx.fillStyle = "#ff0000";       // Glowing red
    ctx.fillRect(41, 19, 3, 3);      // Left eye
    ctx.fillRect(47, 19, 3, 3);      // Right eye
    
    ctx.fillStyle = "#ff6666";       // Intense center glow
    ctx.fillRect(42, 20, 1, 1);      // Left eye highlight
    ctx.fillRect(48, 20, 1, 1);      // Right eye highlight
    
    // Powerful legs
    ctx.fillStyle = "#404050";
    ctx.fillRect(10, 34, 8, 12);     // Back leg
    ctx.fillRect(28, 34, 8, 12);     // Front leg
    
    // Leg muscle definition
    ctx.fillStyle = "#303040";
    ctx.fillRect(11, 36, 6, 8);      // Back leg muscles
    ctx.fillRect(29, 36, 6, 8);      // Front leg muscles
    
    // Large paws with claws
    ctx.fillStyle = "#303040";
    ctx.fillRect(9, 44, 10, 4);      // Back paw
    ctx.fillRect(27, 44, 10, 4);     // Front paw
    
    // Sharp claws
    ctx.fillStyle = "#202030";
    for(let i = 0; i < 3; i++) {
        ctx.fillRect(8 + (i*4), 46, 3, 2);  // Back paw claws
        ctx.fillRect(26 + (i*4), 46, 3, 2); // Front paw claws
    }
    
    // Longer pointed tail
    ctx.fillStyle = "#404050";
    // Main tail shape
    ctx.beginPath();
    ctx.moveTo(8, 24);       // Base
    ctx.lineTo(-4, 25);      // Extended point
    ctx.lineTo(8, 26);       // Base bottom
    ctx.fill();
    
    // Tail detail extending along length
    ctx.fillStyle = "#303040";
    ctx.beginPath();
    ctx.moveTo(7, 24.5);
    ctx.lineTo(-2, 25);      // Extended point
    ctx.lineTo(7, 25.5);
    ctx.fill();
    
    // Additional tail fur details
    ctx.fillStyle = "#505060";
    for(let i = 0; i < 6; i++) {
        const x = -2 + (i * 2);
        const y = 24 + Math.random() * 2;
        ctx.fillRect(x, y, 2, 1);    // Fur along tail
    }
    
    // Fur texture and details
    ctx.fillStyle = "#505060";
    for(let i = 0; i < 20; i++) {
        const x = 8 + Math.floor(Math.random() * 32);
        const y = 20 + Math.floor(Math.random() * 16);
        ctx.fillRect(x, y, 2, 1);    // Random fur detail
    }
    
    break;          
                
    case "redSlime":
    // Define three aggressive slime positions
    const slimePositions = [
        {x: 8, y: 8},    // Top left slime
        {x: 24, y: 24},  // Center slime
        {x: 32, y: 12}   // Top right slime
    ];

    // Draw each detailed slime
    slimePositions.forEach(pos => {
        // Main body layers with enhanced shading
        ctx.fillStyle = "#aa2222";  // Deep angry red base
        // Bottom layer (widest)
        ctx.fillRect(pos.x, pos.y + 8, 12, 6);
        // Middle layer with organic shape
        ctx.fillRect(pos.x - 1, pos.y + 6, 14, 4);
        // Upper layer for bounce animation suggestion
        ctx.fillRect(pos.x + 2, pos.y + 4, 8, 4);
        
        // Inner body with translucent effect
        ctx.fillStyle = "#cc3333";  // Lighter red for inner mass
        ctx.fillRect(pos.x + 1, pos.y + 5, 10, 7);
        
        // Aggressive eyes with detail
        ctx.fillStyle = "#000000";  // Dark eye base
        // Angled angry eyes
        ctx.fillRect(pos.x + 3, pos.y + 6, 3, 1);    // Left eye
        ctx.fillRect(pos.x + 7, pos.y + 6, 3, 1);    // Right eye
        ctx.fillRect(pos.x + 4, pos.y + 5, 2, 1);    // Left eye angle
        ctx.fillRect(pos.x + 8, pos.y + 5, 2, 1);    // Right eye angle
        
        // Rage highlights in eyes
        ctx.fillStyle = "#ff0000";  // Bright red glow
        ctx.fillRect(pos.x + 4, pos.y + 5, 1, 1);    // Left eye glow
        ctx.fillRect(pos.x + 8, pos.y + 5, 1, 1);    // Right eye glow
        
        // Snarling mouth detail
        ctx.fillStyle = "#800000";  // Dark red for mouth
        ctx.fillRect(pos.x + 3, pos.y + 8, 7, 2);    // Angry mouth shape
        
        // Surface tension highlights
        ctx.fillStyle = "#ff4444";  // Bright highlight
        ctx.fillRect(pos.x + 2, pos.y + 4, 2, 1);    // Left highlight
        ctx.fillRect(pos.x + 9, pos.y + 4, 2, 1);    // Right highlight
        
        // Bubble effects inside body
        ctx.fillStyle = "#dd4444";  // Medium red for bubbles
        for(let i = 0; i < 3; i++) {
            const bubbleX = pos.x + 3 + Math.floor(Math.random() * 6);
            const bubbleY = pos.y + 7 + Math.floor(Math.random() * 4);
            ctx.fillRect(bubbleX, bubbleY, 2, 2);
        }
        
        // Splatter/drip effects
        ctx.fillStyle = "#991111";  // Dark red drips
        for(let i = 0; i < 4; i++) {
            const dropX = pos.x + 2 + Math.floor(Math.random() * 8);
            ctx.fillRect(dropX, pos.y + 12, 1, 2);
        }
        
        // Acidic effect around edges
        ctx.fillStyle = "rgba(255,0,0,0.3)";
        for(let i = 0; i < 6; i++) {
            const effectX = pos.x - 2 + Math.floor(Math.random() * 16);
            const effectY = pos.y + 10 + Math.floor(Math.random() * 4);
            ctx.fillRect(effectX, effectY, 1, 1);
        }
    });
    
    // Global atmospheric effects
    ctx.fillStyle = "rgba(255,0,0,0.1)";
    for(let i = 0; i < 20; i++) {
        const x = Math.floor(Math.random() * 48);
        const y = Math.floor(Math.random() * 48);
        ctx.fillRect(x, y, 2, 2);    // Ambient red glow
    }
    
    break;

    case "rat":
    // Muscular body structure with battle scars
    ctx.fillStyle = "#806060";       // Base fur color
    ctx.fillRect(14, 24, 20, 12);    // Main body
    
    // Battle-scarred fur texture
    ctx.fillStyle = "#705050";       // Darker fur patches
    for(let i = 0; i < 15; i++) {
        const x = 14 + Math.floor(Math.random() * 18);
        const y = 24 + Math.floor(Math.random() * 10);
        ctx.fillRect(x, y, 3, 1);    // Scar tissue
    }
    
    // Blood stains and matted fur
    ctx.fillStyle = "#8b0000";       // Dark blood
    for(let i = 0; i < 8; i++) {
        const x = 16 + Math.floor(Math.random() * 16);
        const y = 26 + Math.floor(Math.random() * 8);
        ctx.fillRect(x, y, 2, 2);    // Blood patches
    }
    
    // Enhanced aggressive head structure
    ctx.fillStyle = "#806060";
    ctx.fillRect(28, 20, 14, 10);    // Larger, more threatening head
    
    // Torn and mangled ears
    ctx.fillStyle = "#705050";
    // Left ear - torn
    ctx.fillRect(32, 16, 4, 3);      // Partial left ear
    ctx.fillRect(33, 15, 2, 4);      // Torn edges
    // Right ear - scarred
    ctx.fillRect(36, 16, 4, 4);      // Right ear
    ctx.fillStyle = "#8b0000";       // Blood on ears
    ctx.fillRect(32, 17, 2, 2);      // Ear wound
    
    // Rabid, aggressive eyes
    ctx.fillStyle = "#300000";       // Dark red base
    ctx.fillRect(32, 22, 3, 3);      // Left eye socket
    ctx.fillRect(36, 22, 3, 3);      // Right eye socket
    ctx.fillStyle = "#ff0000";       // Glowing red
    ctx.fillRect(33, 22, 2, 2);      // Left eye
    ctx.fillRect(37, 22, 2, 2);      // Right eye
    ctx.fillStyle = "#ff6666";       // Intense glow
    ctx.fillRect(33, 22, 1, 1);      // Eye rage highlight
    ctx.fillRect(37, 22, 1, 1);
    
    // Blood-stained snout and mouth
    ctx.fillStyle = "#8b0000";       // Blood color
    ctx.fillRect(38, 24, 3, 2);      // Bloody nose
    ctx.fillRect(36, 25, 4, 1);      // Blood drips
    
    // Enhanced teeth and snarling mouth
    ctx.fillStyle = "#ffffff";       // Teeth
    ctx.fillRect(37, 25, 2, 1);      // Upper fangs
    ctx.fillRect(39, 25, 2, 1);
    ctx.fillRect(36, 26, 2, 1);      // Lower fangs
    ctx.fillRect(40, 26, 2, 1);
    
    // Mangled, scarred tail
    ctx.fillStyle = "#806060";
    ctx.fillRect(8, 28, 6, 2);       // Base tail
    ctx.fillStyle = "#8b0000";       // Wounded areas
    for(let i = 0; i < 3; i++) {
        ctx.fillRect(9 + (i*2), 28, 1, 2); // Tail wounds
    }
    
    // Clawed paws with blood
    ctx.fillStyle = "#705050";
    // Back paws
    ctx.fillRect(16, 34, 5, 2);      // Left back paw
    ctx.fillRect(28, 34, 5, 2);      // Right back paw
    
    // Sharp claws
    ctx.fillStyle = "#400000";       // Dark claw color
    for(let i = 0; i < 3; i++) {
        // Left paw claws
        ctx.fillRect(16 + (i*2), 35, 2, 2);
        // Right paw claws
        ctx.fillRect(28 + (i*2), 35, 2, 2);
    }
    
    // Blood on claws
    ctx.fillStyle = "#8b0000";
    for(let i = 0; i < 3; i++) {
        ctx.fillRect(16 + (i*2), 36, 1, 1);
        ctx.fillRect(28 + (i*2), 36, 1, 1);
    }
    
    // Matted, dirty whiskers
    ctx.fillStyle = "#808080";       // Darker, dirty whiskers
    ctx.fillRect(38, 22, 5, 1);      // Upper whiskers
    ctx.fillRect(38, 24, 5, 1);      // Lower whiskers
    
    // Gore and viscera details
    ctx.fillStyle = "#aa0000";       // Fresh blood
    for(let i = 0; i < 6; i++) {
        const x = 14 + Math.floor(Math.random() * 20);
        const y = 24 + Math.floor(Math.random() * 12);
        ctx.fillRect(x, y, 1, 1);    // Blood spatter
    }
    
    // Atmospheric shadow effects
    ctx.fillStyle = "rgba(100,0,0,0.2)";
    ctx.fillRect(14, 32, 20, 4);     // Bloody shadow
    
    break;            
                
            case "goblin":
    // Enhanced muscular legs with detail
    ctx.fillStyle = "#88aa44";  // Base goblin skin
    ctx.fillRect(16, 36, 6, 12);     // Left leg muscle
    ctx.fillRect(26, 36, 6, 12);     // Right leg muscle
    ctx.fillStyle = "#779933";       // Muscle definition
    ctx.fillRect(17, 38, 4, 4);      // Left leg detail
    ctx.fillRect(27, 38, 4, 4);      // Right leg detail
    
    // Detailed feet with claws
    ctx.fillStyle = "#88aa44";
    ctx.fillRect(14, 44, 8, 4);      // Left foot
    ctx.fillRect(24, 44, 8, 4);      // Right foot
    ctx.fillStyle = "#556622";       // Claws
    ctx.fillRect(13, 46, 2, 2);      // Left toe claws
    ctx.fillRect(16, 46, 2, 2);
    ctx.fillRect(19, 46, 2, 2);
    ctx.fillRect(23, 46, 2, 2);      // Right toe claws
    ctx.fillRect(26, 46, 2, 2);
    ctx.fillRect(29, 46, 2, 2);

    // Enhanced muscular body
    ctx.fillStyle = "#88aa44";
    ctx.fillRect(16, 16, 16, 24);    // Main torso
    ctx.fillStyle = "#779933";       // Muscle definition
    ctx.fillRect(18, 20, 12, 2);     // Upper abs
    ctx.fillRect(18, 24, 12, 2);     // Lower abs
    ctx.fillRect(18, 28, 12, 2);     // Bottom abs
    
    // Detailed leather waistcloth
    ctx.fillStyle = "#885500";       // Base leather color
    ctx.fillRect(14, 32, 20, 8);     // Main waist wrap
    ctx.fillStyle = "#664400";       // Leather detail
    ctx.fillRect(16, 33, 16, 2);     // Upper strap
    ctx.fillRect(12, 36, 4, 6);      // Left dangling cloth
    ctx.fillRect(32, 36, 4, 6);      // Right dangling cloth
    // Wear and tear details
    ctx.fillStyle = "#443300";
    ctx.fillRect(15, 35, 2, 4);      // Leather scratches
    ctx.fillRect(31, 35, 2, 4);
    
    // Enhanced arms with muscle definition
    ctx.fillStyle = "#88aa44";
    ctx.fillRect(12, 18, 6, 12);     // Left arm
    ctx.fillRect(30, 18, 6, 12);     // Right arm
    ctx.fillStyle = "#779933";       // Muscle tone
    ctx.fillRect(13, 20, 4, 3);      // Left bicep
    ctx.fillRect(31, 20, 4, 3);      // Right bicep
    
    // Detailed hands with claws
    ctx.fillStyle = "#88aa44";
    ctx.fillRect(10, 26, 8, 6);      // Left hand
    ctx.fillRect(28, 26, 8, 6);      // Right hand
    ctx.fillStyle = "#556622";       // Claws
    ctx.fillRect(9, 27, 2, 2);       // Individual fingers
    ctx.fillRect(11, 28, 2, 2);
    ctx.fillRect(13, 29, 2, 2);
    ctx.fillRect(27, 27, 2, 2);
    ctx.fillRect(29, 28, 2, 2);
    ctx.fillRect(31, 29, 2, 2);

    // Enhanced head with more character
    ctx.fillStyle = "#aacc66";
    ctx.fillRect(14, 4, 20, 12);     // Base head
    ctx.fillRect(12, 6, 24, 8);      // Wider section
    
    // Detailed face features
    ctx.fillStyle = "#88aa44";       // Darker skin tone
    ctx.fillRect(16, 8, 8, 2);       // Brow ridge left
    ctx.fillRect(24, 8, 8, 2);       // Brow ridge right
    
    // Enhanced pointy ears with detail
    ctx.fillStyle = "#aacc66";
    ctx.fillRect(8, 8, 4, 8);        // Left ear base
    ctx.fillRect(36, 8, 4, 8);       // Right ear base
    ctx.fillRect(4, 10, 4, 4);       // Left point
    ctx.fillRect(40, 10, 4, 4);      // Right point
    ctx.fillStyle = "#88aa44";       // Inner ear detail
    ctx.fillRect(9, 9, 2, 6);        // Left ear detail
    ctx.fillRect(37, 9, 2, 6);       // Right ear detail
    
    // Menacing eyes with glow
    ctx.fillStyle = "#000000";       // Eye sockets
    ctx.fillRect(18, 8, 4, 4);       // Left socket
    ctx.fillRect(26, 8, 4, 4);       // Right socket
    ctx.fillStyle = "#ff0000";       // Glowing red
    ctx.fillRect(19, 9, 2, 2);       // Left eye
    ctx.fillRect(27, 9, 2, 2);       // Right eye
    ctx.fillStyle = "#ff6600";       // Eye highlight
    ctx.fillRect(19, 9, 1, 1);       // Left highlight
    ctx.fillRect(27, 9, 1, 1);       // Right highlight
    
    // Detailed mouth with fangs
    ctx.fillStyle = "#664422";
    ctx.fillRect(20, 13, 8, 2);      // Mouth
    ctx.fillStyle = "#ffffff";       // Fangs
    ctx.fillRect(20, 12, 2, 2);      // Left fang
    ctx.fillRect(26, 12, 2, 2);      // Right fang
    
    // Enhanced club with details
    ctx.fillStyle = "#885500";       // Base wood color
    ctx.fillRect(34, 4, 8, 20);      // Handle
    ctx.fillStyle = "#664400";       // Wood grain
    ctx.fillRect(35, 6, 2, 16);      // Grain lines
    ctx.fillRect(39, 6, 2, 16);
    
    // Club head with spikes
    ctx.fillStyle = "#885500";
    ctx.fillRect(32, 2, 12, 8);      // Main club head
    ctx.fillStyle = "#443300";       // Darker wood
    ctx.fillRect(33, 3, 10, 6);      // Club detail
    // Metal spikes
    ctx.fillStyle = "#aaaaaa";
    ctx.fillRect(31, 3, 2, 2);       // Left spike
    ctx.fillRect(43, 3, 2, 2);       // Right spike
    ctx.fillRect(37, 1, 2, 2);       // Top spike
    
    // Battle scars and details
    ctx.fillStyle = "#779933";
    for(let i = 0; i < 5; i++) {
        const x = 16 + Math.floor(Math.random() * 16);
        const y = 20 + Math.floor(Math.random() * 16);
        ctx.fillRect(x, y, 2, 1);    // Random scars
    }
    
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
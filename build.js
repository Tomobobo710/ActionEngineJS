const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

// List of files in dependency order (from index.html)
const files = [
    // 3rd party
    'actionengine/3rdparty/goblin/goblin.js',
    
    // Math
    'actionengine/math/geometry/triangle.js',
    'actionengine/math/geometry/triangleutils.js',
    'actionengine/math/geometry/geometrybuilder.js',
    'actionengine/math/geometry/glbloader.js',
    'actionengine/math/geometry/glbexporter.js',
    'actionengine/math/geometry/modelcodegenerator.js',
    'actionengine/math/vector2.js',
    'actionengine/math/vector3.js',
    'actionengine/math/matrix4.js',
    'actionengine/math/quaternion.js',
    'actionengine/math/mathutils.js',
    'actionengine/math/viewfrustum.js',
    
    // Rendering
    'actionengine/display/graphics/renderableobject.js',
    'actionengine/display/graphics/actionmodel3D.js',
    'actionengine/display/graphics/actionsprite3D.js',
    'actionengine/display/graphics/renderers/actionrenderer2D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/actionrenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/objectrenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/weatherrenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/waterrenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/sunrenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/spriterenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/debugrenderer3D.js',
    'actionengine/display/graphics/renderers/actionrenderer3D/canvasmanager3D.js',
    
    // Lighting
    'actionengine/display/graphics/lighting/lightingconstants.js',
    'actionengine/display/graphics/lighting/actionlight.js',
    'actionengine/display/graphics/lighting/actiondirectionalshadowlight.js',
    'actionengine/display/graphics/lighting/actionomnidirectionalshadowlight.js',
    'actionengine/display/graphics/lighting/lightmanager.js',
    
    // Debug
    'actionengine/debug/basedebugpanel.js',
    
    // Textures
    'actionengine/display/graphics/texture/proceduraltexture.js',
    'actionengine/display/graphics/texture/texturemanager.js',
    'actionengine/display/graphics/texture/textureregistry.js',
    
    // GL Shaders
    'actionengine/display/gl/programmanager.js',
    'actionengine/display/gl/shaders/objectshader.js',
    'actionengine/display/gl/shaders/lineshader.js',
    'actionengine/display/gl/shaders/spriteshader.js',
    'actionengine/display/gl/shaders/shadowshader.js',
    'actionengine/display/gl/shaders/watershader.js',
    'actionengine/display/gl/shaders/particleshader.js',
    
    // Physics
    'actionengine/math/physics/actionphysicsworld3D.js',
    'actionengine/math/physics/actionphysicsobject3D.js',
    'actionengine/math/physics/shapes/actionphysicsplane3D.js',
    'actionengine/math/physics/shapes/actionphysicsbox3D.js',
    'actionengine/math/physics/shapes/actionphysicssphere3D.js',
    'actionengine/math/physics/shapes/actionphysicscapsule3D.js',
    'actionengine/math/physics/shapes/actionphysicscone3D.js',
    'actionengine/math/physics/shapes/actionphysicscylinder3D.js',
    'actionengine/math/physics/shapes/actionphysicscompoundshape3D.js',
    'actionengine/math/physics/shapes/actionphysicsconvexshape3D.js',
    'actionengine/math/physics/shapes/actionphysicsmesh3D.js',
    'actionengine/math/physics/actionraycast.js',
    'actionengine/math/physics/actionphysics.js',
    
    // Audio
    'actionengine/sound/soundfont/actionreverb.js',
    'actionengine/sound/soundfont/actionparser.js',
    'actionengine/sound/soundfont/actionsoundfont.js',
    'actionengine/sound/soundfont/soundfont.js',
    'actionengine/sound/audiomanager.js',
    
    // Input
    'actionengine/input/inputhandler.js',
    'actionengine/input/actionscrollablearea.js',
    
    // Networking
    'actionengine/network/p2p/ActionNetPeer.js',
    'actionengine/network/p2p/ActionNetTrackerClient.js',
    'actionengine/network/p2p/DataConnection.js',
    'actionengine/network/client/ActionNetManager.js',
    'actionengine/network/client/SyncSystem.js',
    'actionengine/network/client/ActionNetManagerGUI.js',
    'actionengine/network/client/ActionNetManagerP2P.js',
    
    // Camera
    'actionengine/camera/actioncamera.js',
    'actionengine/camera/cameracollisionhandler.js',
    
    // Canvas system
    'actionengine/display/canvasmanager.js',
    
    // Character
    'actionengine/character/actioncharacter.js',
    'actionengine/character/actioncharacter3D.js',
    
    // Core
    'actionengine/core/app.js'
];

async function bundle() {
    // Read all files in order
    let content = '';
    for (const file of files) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`Adding ${file}...`);
            content += fs.readFileSync(filePath, 'utf8') + '\n';
        } else {
            console.warn(`Warning: File not found: ${file}`);
        }
    }
    
    // Ensure dist directory exists
    if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist');
    }
    
    // Write concatenated file
    const tempFile = 'dist/action-engine-temp.js';
    fs.writeFileSync(tempFile, content);
    
    try {
        // Minify with esbuild
        await esbuild.build({
            entryPoints: [tempFile],
            outfile: 'dist/action-engine.min.js',
            minify: true,
            bundle: false, // Don't bundle, we already concatenated
            format: 'iife' // Immediately Invoked Function Expression for global scope
        });
        
        console.log('✓ Built: dist/action-engine.min.js');
        
        // Clean up temp file
        fs.unlinkSync(tempFile);
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

bundle();

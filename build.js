const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

// List of files in dependency order (from index.html)
const files = [
    // 3rd party
    'actionengine/3rdparty/goblin/goblin.js',
    
    // Math & Transformation
    'actionengine/math/vector2.js',
    'actionengine/math/vector3.js',
    'actionengine/math/matrix4.js',
    'actionengine/math/quaternion.js',
    'actionengine/math/transform.js',
    
    // Geometry & Resources
    'actionengine/geometry/triangle.js',
    'actionengine/geometry/triangleutils.js',
    'actionengine/geometry/actionboxgeometry.js',
    'actionengine/geometry/geometrybuilder.js',
    'actionengine/geometry/glbloader.js',
    'actionengine/geometry/glbexporter.js',
    'actionengine/geometry/modelcodegenerator.js',
    'actionengine/geometry/modelregistry.js',
    'actionengine/geometry/actionmodelpackageloader.js',
    
    // ActionUI Library
    'actionengine/ui/actionuitheme.js',
    'actionengine/ui/actionuicomponent.js',
    'actionengine/ui/actionuiiconrenderer.js',
    'actionengine/ui/actionuipanel.js',
    'actionengine/ui/actionuilabel.js',
    'actionengine/ui/actionuibutton.js',
    'actionengine/ui/actionuicheckbox.js',
    'actionengine/ui/actionuiradiogroup.js',
    'actionengine/ui/actionuislider.js',
    'actionengine/ui/actionuiprogressbar.js',
    'actionengine/ui/actionuitextinput.js',
    'actionengine/ui/actionuitoggleswitch.js',
    'actionengine/ui/actionuinumberstepper.js',
    'actionengine/ui/actionuidropdown.js',
    'actionengine/ui/actionuitooltip.js',
    'actionengine/ui/actionuimodal.js',
    'actionengine/ui/actionuinotification.js',
    'actionengine/ui/actionuitabbar.js',
    'actionengine/ui/actionuiseparator.js',
    'actionengine/ui/actionuibadge.js',
    'actionengine/ui/actionuicontextmenu.js',
    'actionengine/ui/actionuiscrollablearea.js',
    'actionengine/ui/actionuiscrollpanel.js',
    'actionengine/ui/actionuicolorswatch.js',
    'actionengine/ui/actionuispinner.js',
    'actionengine/ui/actionuiavatardisplay.js',
    'actionengine/ui/actionuigrid.js',
    'actionengine/ui/actionuiwindow.js',
    'actionengine/ui/actionuionscreenkeyboard.js',
    'actionengine/ui/actionuilistview.js',
    'actionengine/ui/actionui.js',
    
    // Rendering: Core & Objects
    'actionengine/display/canvasmanager.js',
    'actionengine/rendering/renderableobject.js',
    'actionengine/rendering/actionmodel3D.js',
    'actionengine/rendering/actionsprite3D.js',
    'actionengine/rendering/actionsprite2d.js',
    
    // Rendering: Lighting & Textures
    'actionengine/rendering/texture/texturemanager.js',
    'actionengine/rendering/texture/textureset.js',
    'actionengine/rendering/lighting/lightingconstants.js',
    'actionengine/rendering/lighting/actionlight.js',
    'actionengine/rendering/lighting/lightmanager.js',
    'actionengine/rendering/lighting/actiondirectionalshadowlight.js',
    'actionengine/rendering/lighting/actionomnidirectionalshadowlight.js',
    
    // Rendering: Specialized Renderers (2D)
    'actionengine/rendering/renderers/actionrenderer2D/cpuvertexskinning.js',
    'actionengine/rendering/renderers/actionrenderer2D/actionrenderer2D.js',
    
    // Rendering: Specialized Renderers (3D WebGL)
    'actionengine/rendering/renderers/actionrenderer3D/glstatemanager.js',
    'actionengine/rendering/renderers/actionrenderer3D/canvasmanager3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/actionrenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/objectrenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/transparentobjectrenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/shadowrenderer3d.js',
    'actionengine/rendering/renderers/actionrenderer3D/spriteRenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/weatherrenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/waterrenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/sunrenderer3D.js',
    'actionengine/rendering/renderers/actionrenderer3D/debugrenderer3D.js',
    
    // GPU Pipeline (WebGL GLSL)
    'actionengine/gl/uniformbuffermanager.js',
    'actionengine/gl/programmanager.js',
    'actionengine/gl/shaders/objectshader.js',
    'actionengine/gl/shaders/lineshader.js',
    'actionengine/gl/shaders/spriteshader.js',
    'actionengine/gl/shaders/shadowshader.js',
    'actionengine/gl/shaders/watershader.js',
    'actionengine/gl/shaders/particleshader.js',
    
    // Physics 3D
    'actionengine/physics/3D/actionraycast3D.js',
    'actionengine/physics/3D/actionrigidbody3D.js',
    'actionengine/physics/3D/physicsshapebuilder3D.js',
    'actionengine/physics/3D/actionphysicsworld3D.js',
    'actionengine/physics/3D/actionphysicsobject3D.js',
    'actionengine/physics/3D/shapes/actionphysicsplane3D.js',
    'actionengine/physics/3D/shapes/actionphysicsbox3D.js',
    'actionengine/physics/3D/shapes/actionphysicssphere3D.js',
    'actionengine/physics/3D/shapes/actionphysicscapsule3D.js',
    'actionengine/physics/3D/shapes/actionphysicscone3D.js',
    'actionengine/physics/3D/shapes/actionphysicscylinder3D.js',
    'actionengine/physics/3D/shapes/actionphysicsmesh3D.js',
    'actionengine/physics/3D/shapes/actionphysicscompoundshape3D.js',
    'actionengine/physics/3D/shapes/actionphysicsconvexshape3D.js',
    
    // Physics 2D
    'actionengine/physics/2D/physicsconstants2D.js',
    'actionengine/physics/2D/actionaabb2D.js',
    'actionengine/physics/2D/actionshape2D.js',
    'actionengine/physics/2D/actioncircleshape2D.js',
    'actionengine/physics/2D/actionboxshape2D.js',
    'actionengine/physics/2D/actionrigidbody2D.js',
    'actionengine/physics/2D/actionmanifold2D.js',
    'actionengine/physics/2D/actionnarrowphase2D.js',
    'actionengine/physics/2D/actioncontactsolver2D.js',
    'actionengine/physics/2D/actionbroadphase2D.js',
    'actionengine/physics/2D/actionphysicsworld2D.js',
    
    // Audio System
    'actionengine/sound/audiomanager.js',
    'actionengine/sound/soundfont/soundfont.js',
    'actionengine/sound/soundfont/actionreverb.js',
    'actionengine/sound/soundfont/actionparser.js',
    'actionengine/sound/soundfont/actionsoundfont.js',
    
    // Input & Controls
    'actionengine/input/inputhandler.js',
    'actionengine/input/actionscrollablearea.js',
    
    // Camera & Character
    'actionengine/camera/actioncamera.js',
    'actionengine/camera/viewfrustum.js',
    'actionengine/camera/cameracollisionhandler.js',
    'actionengine/character/actioncharacter.js',
    'actionengine/character/actioncharacter3D.js',
    'actionengine/character/actionfpsinput.js',
    'actionengine/character/actionfpsweaponsystem.js',
    'actionengine/character/actionfpscharactermodel.js',
    'actionengine/character/actionhitresolver.js',
    'actionengine/character/actionfpsweapon.js',
    'actionengine/character/actionfpscombat.js',
    'actionengine/character/actionfpsgrabber.js',
    'actionengine/character/actionfpsbodymodel.js',
    'actionengine/character/actionfpscontroller3D.js',
    
    // Networking (P2P)
    'actionengine/network/p2p/ActionNetPeer.js',
    'actionengine/network/p2p/ActionNetTrackerClient.js',
    'actionengine/network/p2p/DataConnection.js',
    'actionengine/network/client/ActionNetManager.js',
    'actionengine/network/client/SyncSystem.js',
    'actionengine/network/client/ActionNetManagerGUI.js',
    'actionengine/network/client/ActionNetManagerP2P.js',
    
    // Diagnostics & Utilities
    'actionengine/util/actionzip.js',
    'actionengine/debug/basedebugpanel.js',
    'actionengine/debug/lightingdebugpanel.js',
    
    // Application Bootstrap
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
             bundle: false // Don't bundle, we already concatenated
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

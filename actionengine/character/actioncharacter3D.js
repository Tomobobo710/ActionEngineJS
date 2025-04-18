// actionengine/character/actioncharacter3D.js

/*
 * A basic character controller wrapper.
 * It is based on GoblinPhysics spring based CharacterController.
 */

class ActionCharacter3D extends ActionCharacter {
    constructor(camera, game) {
        super(camera, game);
                
        // Set additional properties needed by the parent class
        this.firstPersonHeight = this.height * 0.5;
        
        // Create a capsule physics model
        this.characterModel = new ActionPhysicsCapsule3D(
            this.game.physicsWorld,
            this.radius,
            this.height,
            0, // mass
            new Vector3(0, 10, 0), // position
            "#4488FF", // primary color
            "#8899FF"  // secondary color
        );
        
        // Set up character position and properties - start higher to avoid ground collision issues
        this.body.position.set(0, 40, 0);
        
        console.log("[ActionCharacter3D] Initialized");
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        // Update the visual representation (capsule) to match the character controller
        if (this.characterModel && this.body) {
            // Copy position from character controller to our visual model
            this.characterModel.body.position.x = this.body.position.x;
            this.characterModel.body.position.y = this.body.position.y;
            this.characterModel.body.position.z = this.body.position.z;
            
            // Update capsule rotation based on character facing direction
            const angle = Math.atan2(this.facingDirection.x, this.facingDirection.z);
            
            // First create quaternion using ActionEngine's Quaternion class
            const engineQuat = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), angle);
            
            // Directly set the rotation components on the body's rotation quaternion
            this.characterModel.body.rotation.x = engineQuat.x;
            this.characterModel.body.rotation.y = engineQuat.y;
            this.characterModel.body.rotation.z = engineQuat.z;
            this.characterModel.body.rotation.w = engineQuat.w;
            
            // Update the visual triangles
            this.characterModel.updateVisual();
        }
    }
}
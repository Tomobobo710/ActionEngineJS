// actionengine/math/physics/actionphysics.js
class ActionPhysics {
    static initialize(ammo, world) {
        this.ammo = ammo;
        this.world = world;
        
        // Cache common physics objects
        this._rayStart = new ammo.btVector3(0, 0, 0);
        this._rayEnd = new ammo.btVector3(0, 0, 0);
        this._rayCallback = new ammo.ClosestRayResultCallback(this._rayStart, this._rayEnd);
        this._sweepStart = new ammo.btTransform();
        this._sweepEnd = new ammo.btTransform();
        this._tmpVec = new ammo.btVector3(0, 0, 0);
        this._halfExtents = new ammo.btVector3(0, 0, 0);
        this._sweepCallback = new ammo.ClosestConvexResultCallback(this._rayStart, this._rayEnd);
    }

    static rayTest(body, direction, distance) {
        const origin = body.getWorldTransform().getOrigin();

        // Use cached vectors
        this._rayStart.setValue(origin.x(), origin.y(), origin.z());
        this._rayEnd.setValue(
            origin.x() + direction.x * distance,
            origin.y() + direction.y * distance,
            origin.z() + direction.z * distance
        );

        // Reset and reuse callback
        this._rayCallback.set_m_closestHitFraction(1);
        this._rayCallback.set_m_collisionObject(null);

        this.world.rayTest(this._rayStart, this._rayEnd, this._rayCallback);
        return this._rayCallback.hasHit();
    }
    
    static boxSweepTest(position, size, direction, distance) {
        // Set up start transform at current position
        this._sweepStart.setIdentity();
        this._sweepStart.setOrigin(new this.ammo.btVector3(
            position.x,
            position.y,
            position.z
        ));

        // Set up end transform
        this._sweepEnd.setIdentity();
        this._tmpVec.setValue(
            position.x + direction.x * distance,
            position.y + direction.y * distance, 
            position.z + direction.z * distance
        );
        this._sweepEnd.setOrigin(this._tmpVec);

        // Use cached halfExtents vector
        this._halfExtents.setValue(
            size.x * 0.5,
            size.y * 0.5,
            size.z * 0.5
        );
        const boxShape = new this.ammo.btBoxShape(this._halfExtents);

        // Reset and reuse callback
        this._sweepCallback.set_m_closestHitFraction(1);

        this.world.convexSweepTest(
            boxShape,
            this._sweepStart,
            this._sweepEnd,
            this._sweepCallback,
            0.0
        );

        const hasHit = this._sweepCallback.hasHit();
        
        // Only the shape needs cleanup now
        Ammo.destroy(boxShape);

        return {
            hasHit,
            hitFraction: this._sweepCallback.m_closestHitFraction
        };
    }
    static cleanup() {
        if (this._rayStart) {
            Ammo.destroy(this._rayStart);
            this._rayStart = null;
        }
        if (this._rayEnd) {
            Ammo.destroy(this._rayEnd);
            this._rayEnd = null;
        }
        if (this._rayCallback) {
            Ammo.destroy(this._rayCallback);
            this._rayCallback = null;
        }
        if (this._sweepStart) Ammo.destroy(this._sweepStart);
        if (this._sweepEnd) Ammo.destroy(this._sweepEnd);
        if (this._tmpVec) Ammo.destroy(this._tmpVec);
        if (this._halfExtents) Ammo.destroy(this._halfExtents);
        if (this._sweepCallback) Ammo.destroy(this._sweepCallback);
        this._sweepStart = null;
        this._sweepEnd = null;
        this._tmpVec = null;
        this._halfExtents = null;
        this._sweepCallback = null;
    }
}
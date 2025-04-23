// actionengine/math/vector3.js
class Vector3 {
    // Vector pool for object reuse
    static _pool = [];
    static _poolSize = 0;
    static _maxPoolSize = 1000;
    
    // Get a vector from the pool or create a new one
    static getFromPool(x = 0, y = 0, z = 0) {
        if (Vector3._poolSize > 0) {
            const vec = Vector3._pool[--Vector3._poolSize];
            vec.set(x, y, z);
            return vec;
        }
        return new Vector3(x, y, z);
    }
    
    // Return a vector to the pool when done with it
    static returnToPool(vec) {
        if (Vector3._poolSize < Vector3._maxPoolSize) {
            Vector3._pool[Vector3._poolSize++] = vec;
        }
    }
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    set(x, y, z) {
        if (y === undefined && z === undefined && x.x !== undefined) {
            // If passed another vector
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        } else {
            // If passed 3 numbers
            this.x = x;
            this.y = y;
            this.z = z;
        }
        return this;
    }
	// For distance calculations between points
	distanceTo(other) {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		const dz = this.z - other.z;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}
	
	// More efficient squared distance, avoids costly sqrt when possible
	distanceSquared(other) {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		const dz = this.z - other.z;
		return dx * dx + dy * dy + dz * dz;
	}

	// For horizontal distance (ignoring Y) - useful for camera calculations
	horizontalDistanceTo(other) {
		const dx = this.x - other.x;
		const dz = this.z - other.z;
		return Math.sqrt(dx * dx + dz * dz);
	}
	
	// More efficient squared horizontal distance
	horizontalDistanceSquared(other) {
		const dx = this.x - other.x;
		const dz = this.z - other.z;
		return dx * dx + dz * dz;
	}

	// For applying movement/translation
	translate(direction, amount) {
		return new Vector3(
			this.x + direction.x * amount,
			this.y + direction.y * amount,
			this.z + direction.z * amount
		);
	}
	
	// In-place version to avoid creating a new Vector3
	translateInPlace(direction, amount) {
		this.x += direction.x * amount;
		this.y += direction.y * amount;
		this.z += direction.z * amount;
		return this;
	}

	// For rotation around Y axis (useful for camera orbiting)
	rotateY(angle) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return new Vector3(
			this.x * cos + this.z * sin,
			this.y,
			-this.x * sin + this.z * cos
		);
	}
	
	// In-place version to avoid creating a new Vector3
	rotateYInPlace(angle) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const x = this.x;
		const z = this.z;
		this.x = x * cos + z * sin;
		this.z = -x * sin + z * cos;
		return this;
	}

	// Gets a normalized vector representing just the horizontal component
	horizontalNormalize() {
		return new Vector3(this.x, 0, this.z).normalize();
	}

    static transformMat4(vec, mat) {
    // Make sure we can access the matrix data whether it's Array or Float32Array
    const getElement = (idx) => mat[idx] !== undefined ? mat[idx] : mat.at(idx);
    
    const x = vec.x;
    const y = vec.y;
    const z = vec.z;
    let w = getElement(3) * x + getElement(7) * y + getElement(11) * z + getElement(15);
    if (w === 0) w = 1;

    return new Vector3(
        (getElement(0) * x + getElement(4) * y + getElement(8) * z + getElement(12)) / w,
        (getElement(1) * x + getElement(5) * y + getElement(9) * z + getElement(13)) / w,
        (getElement(2) * x + getElement(6) * y + getElement(10) * z + getElement(14)) / w
    );
}
    static fromValues(x, y, z) {
    return new Vector3(x, y, z);
}

static min(out, a, b) {
    out.x = Math.min(a.x, b.x);
    out.y = Math.min(a.y, b.y);
    out.z = Math.min(a.z, b.z);
    return out;
}

static max(out, a, b) {
    out.x = Math.max(a.x, b.x);
    out.y = Math.max(a.y, b.y);
    out.z = Math.max(a.z, b.z);
    return out;
}
    static create(x = 0, y = 0, z = 0) {
        return new Vector3(x, y, z);
    }
    
    // Add optimized add operation that creates less garbage
    add(other) {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    
    // In-place addition
    addInPlace(other) {
        this.x += other.x;
        this.y += other.y;
        this.z += other.z;
        return this;
    }
    
    // Add optimized subtract operation
    sub(other) {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    
    // In-place subtraction
    subInPlace(other) {
        this.x -= other.x;
        this.y -= other.y;
        this.z -= other.z;
        return this;
    }
    
    // Vector normalization
    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len === 0) {
            return new Vector3(0, 0, 0);
        }
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }
    
    // In-place normalization
    normalizeInPlace() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len !== 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }
    
    // Add dot product operation
    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }
    
    // Add cross product operation
    cross(other) {
        return new Vector3(
            this.y * other.z - this.z * other.y,
            this.z * other.x - this.x * other.z,
            this.x * other.y - this.y * other.x
        );
    }
    
    // Array conversion
    toArray() {
        return [this.x, this.y, this.z];
    }
    
    // Length calculation
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    
    // Squared length (faster, avoids sqrt)
    lengthSquared() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    sub(v) {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    mult(n) {
        return new Vector3(this.x * n, this.y * n, this.z * n);
    }

    normalize() {
        const len = this.length();
        if (len === 0) {
            return new Vector3();
        }
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }
    
    scale(scalar) {
        return new Vector3(
            this.x * scalar,
            this.y * scalar,
            this.z * scalar
        );
    }
    
    divideScalar(scalar) {
        if (scalar === 0) {
            console.warn("Vector3: Division by zero!");
            return new Vector3(0, 0, 0);
        }
        
        return new Vector3(
            this.x / scalar,
            this.y / scalar,
            this.z / scalar
        );
    }
    
    subtract(other) {
        return new Vector3(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z
        );
    }
    
    equals(other) {
        const epsilon = 0.000001; // Small threshold for floating point comparison
        return Math.abs(this.x - other.x) < epsilon && 
               Math.abs(this.y - other.y) < epsilon && 
               Math.abs(this.z - other.z) < epsilon;
    }
    
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        return new Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    lerp(target, t) {
        return new Vector3(
            this.x + (target.x - this.x) * t,
            this.y + (target.y - this.y) * t,
            this.z + (target.z - this.z) * t
        );
    }
}
// actionengine/math/vector3.js
class Vector3 {
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
		return Math.sqrt(
			Math.pow(this.x - other.x, 2) + 
			Math.pow(this.y - other.y, 2) + 
			Math.pow(this.z - other.z, 2)
		);
	}

	// For horizontal distance (ignoring Y) - useful for camera calculations
	horizontalDistanceTo(other) {
		return Math.sqrt(
			Math.pow(this.x - other.x, 2) + 
			Math.pow(this.z - other.z, 2)
		);
	}

	// For applying movement/translation
	translate(direction, amount) {
		return new Vector3(
			this.x + direction.x * amount,
			this.y + direction.y * amount,
			this.z + direction.z * amount
		);
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

	// Gets a normalized vector representing just the horizontal component
	horizontalNormalize() {
		return new Vector3(this.x, 0, this.z).normalize();
	}

    static transformMat4(vec, mat4) {
        const x = vec.x,
            y = vec.y,
            z = vec.z;
        const w = mat4[3] * x + mat4[7] * y + mat4[11] * z + mat4[15] || 1.0;

        return new Vector3(
            (mat4[0] * x + mat4[4] * y + mat4[8] * z + mat4[12]) / w,
            (mat4[1] * x + mat4[5] * y + mat4[9] * z + mat4[13]) / w,
            (mat4[2] * x + mat4[6] * y + mat4[10] * z + mat4[14]) / w
        );
    }

    static create(x = 0, y = 0, z = 0) {
        return new Vector3(x, y, z);
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
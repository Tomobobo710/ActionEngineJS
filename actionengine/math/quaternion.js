// actionengine/math/quaternion.js
class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    static fromAxisAngle(axis, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);
        return new Quaternion(
            axis.x * s,
            axis.y * s,
            axis.z * s,
            Math.cos(halfAngle)
        );
    }

    static fromEulerY(yAngle) {
        const halfAngle = yAngle * 0.5;
        return new Quaternion(
            0,
            Math.sin(halfAngle),
            0,
            Math.cos(halfAngle)
        );
    }

    slerp(other, t) {
        let cosHalfTheta = this.x * other.x + this.y * other.y + 
                          this.z * other.z + this.w * other.w;

        if (Math.abs(cosHalfTheta) >= 1.0) {
            return this;
        }

        const halfTheta = Math.acos(cosHalfTheta);
        const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

        if (Math.abs(sinHalfTheta) < 0.001) {
            return new Quaternion(
                this.x * 0.5 + other.x * 0.5,
                this.y * 0.5 + other.y * 0.5,
                this.z * 0.5 + other.z * 0.5,
                this.w * 0.5 + other.w * 0.5
            );
        }

        const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
        const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

        return new Quaternion(
            this.x * ratioA + other.x * ratioB,
            this.y * ratioA + other.y * ratioB,
            this.z * ratioA + other.z * ratioB,
            this.w * ratioA + other.w * ratioB
        );
    }
}

export { Quaternion };
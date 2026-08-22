/**
* Goblin Physics
*
* @module Goblin
*/
(function(){
	var Goblin = {};
Goblin.Matrix3 = function( e00, e01, e02, e10, e11, e12, e20, e21, e22 ) {
	this.e00 = e00 || 0;
	this.e01 = e01 || 0;
	this.e02 = e02 || 0;

	this.e10 = e10 || 0;
	this.e11 = e11 || 0;
	this.e12 = e12 || 0;

	this.e20 = e20 || 0;
	this.e21 = e21 || 0;
	this.e22 = e22 || 0;
};

Goblin.Matrix3.prototype = {
	identity: function() {
		this.e00 = 1;
		this.e01 = 0;
		this.e02 = 0;

		this.e10 = 0;
		this.e11 = 1;
		this.e12 = 0;

		this.e20 = 0;
		this.e21 = 0;
		this.e22 = 1;
	},

	fromMatrix4: function( m ) {
		this.e00 = m.e00;
		this.e01 = m.e01;
		this.e02 = m.e02;

		this.e10 = m.e10;
		this.e11 = m.e11;
		this.e12 = m.e12;

		this.e20 = m.e20;
		this.e21 = m.e21;
		this.e22 = m.e22;
	},

	fromQuaternion: function( q ) {
		var x2 = q.x + q.x,
			y2 = q.y + q.y,
			z2 = q.z + q.z,

			xx = q.x * x2,
			xy = q.x * y2,
			xz = q.x * z2,
			yy = q.y * y2,
			yz = q.y * z2,
			zz = q.z * z2,
			wx = q.w * x2,
			wy = q.w * y2,
			wz = q.w * z2;

		this.e00 = 1 - (yy + zz);
		this.e10 = xy + wz;
		this.e20 = xz - wy;

		this.e01 = xy - wz;
		this.e11 = 1 - (xx + zz);
		this.e21 = yz + wx;

		this.e02 = xz + wy;
		this.e12 = yz - wx;
		this.e22 = 1 - (xx + yy);
	},

	transformVector3: function( v ) {
		var x = v.x,
			y = v.y,
			z = v.z;
		v.x = this.e00 * x + this.e01 * y + this.e02 * z;
		v.y = this.e10 * x + this.e11 * y + this.e12 * z;
		v.z = this.e20 * x + this.e21 * y + this.e22 * z;
	},

	transformVector3Into: function( v, dest ) {
		dest.x = this.e00 * v.x + this.e01 * v.y + this.e02 * v.z;
		dest.y = this.e10 * v.x + this.e11 * v.y + this.e12 * v.z;
		dest.z = this.e20 * v.x + this.e21 * v.y + this.e22 * v.z;
	},

	transposeInto: function( m ) {
		m.e00 = this.e00;
		m.e10 = this.e01;
		m.e20 = this.e02;
		m.e01 = this.e10;
		m.e11 = this.e11;
		m.e21 = this.e12;
		m.e02 = this.e20;
		m.e12 = this.e21;
		m.e22 = this.e22;
	},

	invert: function() {
		var a00 = this.e00, a01 = this.e01, a02 = this.e02,
			a10 = this.e10, a11 = this.e11, a12 = this.e12,
			a20 = this.e20, a21 = this.e21, a22 = this.e22,

			b01 = a22 * a11 - a12 * a21,
			b11 = -a22 * a10 + a12 * a20,
			b21 = a21 * a10 - a11 * a20,

			d = a00 * b01 + a01 * b11 + a02 * b21,
			id;

		if ( !d ) {
			return true;
		}
		id = 1 / d;

		this.e00 = b01 * id;
		this.e01 = (-a22 * a01 + a02 * a21) * id;
		this.e02 = (a12 * a01 - a02 * a11) * id;
		this.e10 = b11 * id;
		this.e11 = (a22 * a00 - a02 * a20) * id;
		this.e12 = (-a12 * a00 + a02 * a10) * id;
		this.e20 = b21 * id;
		this.e21 = (-a21 * a00 + a01 * a20) * id;
		this.e22 = (a11 * a00 - a01 * a10) * id;

		return true;
	},

	invertInto: function( m ) {
		var a00 = this.e00, a01 = this.e01, a02 = this.e02,
			a10 = this.e10, a11 = this.e11, a12 = this.e12,
			a20 = this.e20, a21 = this.e21, a22 = this.e22,

			b01 = a22 * a11 - a12 * a21,
			b11 = -a22 * a10 + a12 * a20,
			b21 = a21 * a10 - a11 * a20,

			d = a00 * b01 + a01 * b11 + a02 * b21,
			id;

		if ( !d ) {
			return false;
		}
		id = 1 / d;

		m.e00 = b01 * id;
		m.e01 = (-a22 * a01 + a02 * a21) * id;
		m.e02 = (a12 * a01 - a02 * a11) * id;
		m.e10 = b11 * id;
		m.e11 = (a22 * a00 - a02 * a20) * id;
		m.e12 = (-a12 * a00 + a02 * a10) * id;
		m.e20 = b21 * id;
		m.e21 = (-a21 * a00 + a01 * a20) * id;
		m.e22 = (a11 * a00 - a01 * a10) * id;

		return true;
	},

	multiply: function( m ) {
		var a00 = this.e00, a01 = this.e01, a02 = this.e02,
			a10 = this.e10, a11 = this.e11, a12 = this.e12,
			a20 = this.e20, a21 = this.e21, a22 = this.e22,

			b00 = m.e00, b01 = m.e01, b02 = m.e02,
			b10 = m.e10, b11 = m.e11, b12 = m.e12,
			b20 = m.e20, b21 = m.e21, b22 = m.e22;

		this.e00 = b00 * a00 + b10 * a01 + b20 * a02;
		this.e10 = b00 * a10 + b10 * a11 + b20 * a12;
		this.e20 = b00 * a20 + b10 * a21 + b20 * a22;

		this.e01 = b01 * a00 + b11 * a01 + b21 * a02;
		this.e11 = b01 * a10 + b11 * a11 + b21 * a12;
		this.e21 = b01 * a20 + b11 * a21 + b21 * a22;

		this.e02 = b02 * a00 + b12 * a01 + b22 * a02;
		this.e12 = b02 * a10 + b12 * a11 + b22 * a12;
		this.e22 = b02 * a20 + b12 * a21 + b22 * a22;
	},

	multiplyFrom: function( a, b ) {
		var a00 = a.e00, a01 = a.e01, a02 = a.e02,
			a10 = a.e10, a11 = a.e11, a12 = a.e12,
			a20 = a.e20, a21 = a.e21, a22 = a.e22,

			b00 = b.e00, b01 = b.e01, b02 = b.e02,
			b10 = b.e10, b11 = b.e11, b12 = b.e12,
			b20 = b.e20, b21 = b.e21, b22 = b.e22;

		this.e00 = b00 * a00 + b10 * a01 + b20 * a02;
		this.e10 = b00 * a10 + b10 * a11 + b20 * a12;
		this.e20 = b00 * a20 + b10 * a21 + b20 * a22;

		this.e01 = b01 * a00 + b11 * a01 + b21 * a02;
		this.e11 = b01 * a10 + b11 * a11 + b21 * a12;
		this.e21 = b01 * a20 + b11 * a21 + b21 * a22;

		this.e02 = b02 * a00 + b12 * a01 + b22 * a02;
		this.e12 = b02 * a10 + b12 * a11 + b22 * a12;
		this.e22 = b02 * a20 + b12 * a21 + b22 * a22;
	}
};
Goblin.Matrix4 = function() {
	this.e00 = 0;
	this.e01 = 0;
	this.e02 = 0;
	this.e03 = 0;

	this.e10 = 0;
	this.e11 = 0;
	this.e12 = 0;
	this.e13 = 0;

	this.e20 = 0;
	this.e21 = 0;
	this.e22 = 0;
	this.e23 = 0;

	this.e30 = 0;
	this.e31 = 0;
	this.e32 = 0;
	this.e33 = 0;
};

Goblin.Matrix4.prototype = {
	identity: function() {
		this.e00 = 1;
		this.e01 = 0;
		this.e02 = 0;
		this.e03 = 0;

		this.e10 = 0;
		this.e11 = 1;
		this.e12 = 0;
		this.e13 = 0;

		this.e20 = 0;
		this.e21 = 0;
		this.e22 = 1;
		this.e23 = 0;

		this.e30 = 0;
		this.e31 = 0;
		this.e32 = 0;
		this.e33 = 1;
	},

	copy: function( m ) {
		this.e00 = m.e00;
		this.e01 = m.e01;
		this.e02 = m.e02;
		this.e03 = m.e03;

		this.e10 = m.e10;
		this.e11 = m.e11;
		this.e12 = m.e12;
		this.e13 = m.e13;

		this.e20 = m.e20;
		this.e21 = m.e21;
		this.e22 = m.e22;
		this.e23 = m.e23;

		this.e30 = m.e30;
		this.e31 = m.e31;
		this.e32 = m.e32;
		this.e33 = m.e33;
	},

	makeTransform: function( rotation, translation ) {
		// Setup rotation
		var x2 = rotation.x + rotation.x,
			y2 = rotation.y + rotation.y,
			z2 = rotation.z + rotation.z,
			xx = rotation.x * x2,
			xy = rotation.x * y2,
			xz = rotation.x * z2,
			yy = rotation.y * y2,
			yz = rotation.y * z2,
			zz = rotation.z * z2,
			wx = rotation.w * x2,
			wy = rotation.w * y2,
			wz = rotation.w * z2;

		this.e00 = 1 - ( yy + zz );
		this.e10 = xy + wz;
		this.e20 = xz - wy;
		this.e30 = 0;
		this.e01 = xy - wz;
		this.e11 = 1 - (xx + zz);
		this.e21 = yz + wx;
		this.e31 = 0;
		this.e02 = xz + wy;
		this.e12 = yz - wx;
		this.e22 = 1 - (xx + yy);
		this.e32 = 0;

		// Translation
		this.e03 = translation.x;
		this.e13 = translation.y;
		this.e23 = translation.z;
		this.e33 = 1;
	},

	transformVector3: function( v ) {
		// Technically this should compute the `w` term and divide the resulting vector
		// components by `w` to homogenize but we don't scale so `w` is just `1`
		var x = v.x,
			y = v.y,
			z = v.z;
		v.x = this.e00 * x + this.e01 * y + this.e02 * z + this.e03;
		v.y = this.e10 * x + this.e11 * y + this.e12 * z + this.e13;
		v.z = this.e20 * x + this.e21 * y + this.e22 * z + this.e23;
	},

	transformVector3Into: function( v, dest ) {
		// Technically this should compute the `w` term and divide the resulting vector
		// components by `w` to homogenize but we don't scale so `w` is just `1`
		dest.x = this.e00 * v.x + this.e01 * v.y + this.e02 * v.z + this.e03;
		dest.y = this.e10 * v.x + this.e11 * v.y + this.e12 * v.z + this.e13;
		dest.z = this.e20 * v.x + this.e21 * v.y + this.e22 * v.z + this.e23;
	},

	rotateVector3: function( v ) {
		var x = v.x,
			y = v.y,
			z = v.z;
		v.x = this.e00 * x + this.e01 * y + this.e02 * z;
		v.y = this.e10 * x + this.e11 * y + this.e12 * z;
		v.z = this.e20 * x + this.e21 * y + this.e22 * z;
	},

	rotateVector3Into: function( v, dest ) {
		dest.x = this.e00 * v.x + this.e01 * v.y + this.e02 * v.z;
		dest.y = this.e10 * v.x + this.e11 * v.y + this.e12 * v.z;
		dest.z = this.e20 * v.x + this.e21 * v.y + this.e22 * v.z;
	},

	invert: function() {
		var a00 = this.e00, a01 = this.e01, a02 = this.e02, a03 = this.e03,
			a10 = this.e10, a11 = this.e11, a12 = this.e12, a13 = this.e13,
			a20 = this.e20, a21 = this.e21, a22 = this.e22, a23 = this.e23,
			a30 = this.e30, a31 = this.e31, a32 = this.e32, a33 = this.e33,

			b00 = a00 * a11 - a01 * a10,
			b01 = a00 * a12 - a02 * a10,
			b02 = a00 * a13 - a03 * a10,
			b03 = a01 * a12 - a02 * a11,
			b04 = a01 * a13 - a03 * a11,
			b05 = a02 * a13 - a03 * a12,
			b06 = a20 * a31 - a21 * a30,
			b07 = a20 * a32 - a22 * a30,
			b08 = a20 * a33 - a23 * a30,
			b09 = a21 * a32 - a22 * a31,
			b10 = a21 * a33 - a23 * a31,
			b11 = a22 * a33 - a23 * a32,

			d = (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06),
			invDet;

		// Calculate the determinant
		if ( !d ) {
			return false;
		}
		invDet = 1 / d;

		this.e00 = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
		this.e01 = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
		this.e02 = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
		this.e03 = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
		this.e10 = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
		this.e11 = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
		this.e12 = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
		this.e13 = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
		this.e20 = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
		this.e21 = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
		this.e22 = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
		this.e23 = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
		this.e30 = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
		this.e31 = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
		this.e32 = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
		this.e33 = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;

		return true;
	},

	invertInto: function( m ) {
		var a00 = this.e00, a01 = this.e10, a02 = this.e20, a03 = this.e30,
			a10 = this.e01, a11 = this.e11, a12 = this.e21, a13 = this.e31,
			a20 = this.e02, a21 = this.e12, a22 = this.e22, a23 = this.e32,
			a30 = this.e03, a31 = this.e13, a32 = this.e23, a33 = this.e33,

			b00 = a00 * a11 - a01 * a10,
			b01 = a00 * a12 - a02 * a10,
			b02 = a00 * a13 - a03 * a10,
			b03 = a01 * a12 - a02 * a11,
			b04 = a01 * a13 - a03 * a11,
			b05 = a02 * a13 - a03 * a12,
			b06 = a20 * a31 - a21 * a30,
			b07 = a20 * a32 - a22 * a30,
			b08 = a20 * a33 - a23 * a30,
			b09 = a21 * a32 - a22 * a31,
			b10 = a21 * a33 - a23 * a31,
			b11 = a22 * a33 - a23 * a32,

			d = (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06),
			invDet;

		// Calculate the determinant
		if ( !d ) {
			return false;
		}
		invDet = 1 / d;

		m.e00 = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
		m.e10 = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
		m.e20 = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
		m.e30 = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
		m.e01 = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
		m.e11 = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
		m.e21 = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
		m.e31 = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
		m.e02 = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
		m.e12 = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
		m.e22 = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
		m.e32 = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
		m.e03 = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
		m.e13 = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
		m.e23 = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
		m.e33 = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
	},

	multiply: function( m ) {
		// Cache the matrix values (makes for huge speed increases!)
		var a00 = this.e00, a01 = this.e10, a02 = this.e20, a03 = this.e30;
		var a10 = this.e01, a11 = this.e11, a12 = this.e21, a13 = this.e31;
		var a20 = this.e02, a21 = this.e12, a22 = this.e22, a23 = this.e32;
		var a30 = this.e03, a31 = this.e13, a32 = this.e23, a33 = this.e33;

		// Cache only the current line of the second matrix
		var b0  = m.e00, b1 = m.e10, b2 = m.e20, b3 = m.e30;
		this.e00 = b0*a00 + b1*a10 + b2*a20 + b3*a30;
		this.e10 = b0*a01 + b1*a11 + b2*a21 + b3*a31;
		this.e20 = b0*a02 + b1*a12 + b2*a22 + b3*a32;
		this.e30 = b0*a03 + b1*a13 + b2*a23 + b3*a33;

		b0 = m.e01;
		b1 = m.e11;
		b2 = m.e21;
		b3 = m.e31;
		this.e01 = b0*a00 + b1*a10 + b2*a20 + b3*a30;
		this.e11 = b0*a01 + b1*a11 + b2*a21 + b3*a31;
		this.e21 = b0*a02 + b1*a12 + b2*a22 + b3*a32;
		this.e31 = b0*a03 + b1*a13 + b2*a23 + b3*a33;

		b0 = m.e02;
		b1 = m.e12;
		b2 = m.e22;
		b3 = m.e32;
		this.e02 = b0*a00 + b1*a10 + b2*a20 + b3*a30;
		this.e12 = b0*a01 + b1*a11 + b2*a21 + b3*a31;
		this.e22 = b0*a02 + b1*a12 + b2*a22 + b3*a32;
		this.e32 = b0*a03 + b1*a13 + b2*a23 + b3*a33;

		b0 = m.e03;
		b1 = m.e13;
		b2 = m.e23;
		b3 = m.e33;
		this.e03 = b0*a00 + b1*a10 + b2*a20 + b3*a30;
		this.e13 = b0*a01 + b1*a11 + b2*a21 + b3*a31;
		this.e23 = b0*a02 + b1*a12 + b2*a22 + b3*a32;
		this.e33 = b0*a03 + b1*a13 + b2*a23 + b3*a33;
	}
};
Goblin.Quaternion = function( x, y, z, w ) {
	this.x = x != null ? x : 0;
	this.y = y != null ? y : 0;
	this.z = z != null ? z : 0;
	this.w = w != null ? w : 1;
	this.normalize();
};

Goblin.Quaternion.prototype = {
	set: function( x, y, z, w ) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	},

	multiply: function( q ) {
		var x = this.x, y = this.y, z = this.z, w = this.w,
			qx = q.x, qy = q.y, qz = q.z, qw = q.w;

		this.x = x * qw + w * qx + y * qz - z * qy;
		this.y = y * qw + w * qy + z * qx - x * qz;
		this.z = z * qw + w * qz + x * qy - y * qx;
		this.w = w * qw - x * qx - y * qy - z * qz;
	},

	multiplyQuaternions: function( a, b ) {
		this.x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y;
		this.y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z;
		this.z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x;
		this.w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
	},

	normalize: function() {
		var x = this.x, y = this.y, z = this.z, w = this.w,
			length = Math.sqrt( x * x + y * y + z * z + w * w );

		if ( length === 0) {
			this.x = this.y = this.z = this.w = 0;
		} else {
			length = 1 / length;
			this.x *= length;
			this.y *= length;
			this.z *= length;
			this.w *= length;
		}
	},

	invertQuaternion: function( q ) {
		var x = q.x, y = q.y, z = q.z, w = q.w,
			dot = x * x + y * y + z * z + w * w;

		if ( dot === 0 ) {
			this.x = this.y = this.z = this.w = 0;
		} else {
			var inv_dot = -1 / dot;
			this.x = q.x * inv_dot;
			this.y = q.y *  inv_dot;
			this.z = q.z *  inv_dot;
			this.w = q.w *  -inv_dot;
		}
	},

	transformVector3: function( v ) {
		var x = v.x, y = v.y, z = v.z,
			qx = this.x, qy = this.y, qz = this.z, qw = this.w,

		// calculate quat * vec
			ix = qw * x + qy * z - qz * y,
			iy = qw * y + qz * x - qx * z,
			iz = qw * z + qx * y - qy * x,
			iw = -qx * x - qy * y - qz * z;

		// calculate result * inverse quat
		v.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
		v.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
		v.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	},

	transformVector3Into: function( v, dest ) {
		var x = v.x, y = v.y, z = v.z,
			qx = this.x, qy = this.y, qz = this.z, qw = this.w,

		// calculate quat * vec
			ix = qw * x + qy * z - qz * y,
			iy = qw * y + qz * x - qx * z,
			iz = qw * z + qx * y - qy * x,
			iw = -qx * x - qy * y - qz * z;

		// calculate result * inverse quat
		dest.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
		dest.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
		dest.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	},

	angleBetween: function( q ) {
		/*_tmp_quat4_1.invertQuaternion( this );
		_tmp_quat4_1.multiply( q );
		_tmp_vec3_1.set( _tmp_quat4_1.x, _tmp_quat4_1.y, _tmp_quat4_1.z );
		return 2 * Math.atan2( _tmp_vec3_1.length(), Math.abs( _tmp_quat4_1.w ) );*/

		return 2 * Math.acos( this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w );
	},

	signedAngleBetween: function( q, normal ) {
		if ( Math.abs(x_axis.dot( normal )) < 0.5 ) {
			_tmp_vec3_1.set( 1, 0, 0 );
		} else {
			_tmp_vec3_1.set( 0, 0, 1 );
		}
		this.transformVector3Into( _tmp_vec3_1, _tmp_vec3_2 );
		q.transformVector3Into( _tmp_vec3_1, _tmp_vec3_3 );

		_tmp_vec3_1.crossVectors( _tmp_vec3_2, _tmp_vec3_3 );
		return Math.atan2(
			normal.dot( _tmp_vec3_1 ),
			_tmp_vec3_2.dot( _tmp_vec3_3 )
		);
	}
};
Goblin.Vector3 = function( x, y, z ) {
	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;
};

Goblin.Vector3.prototype = {
	set: function( x, y, z ) {
		this.x = x;
		this.y = y;
		this.z = z;
	},

	copy: function( v ) {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
	},

	add: function( v ) {
		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
	},

	addVectors: function( a, b ) {
		this.x = a.x + b.x;
		this.y = a.y + b.y;
		this.z = a.z + b.z;
	},

	subtract: function( v ) {
		this.x -= v.x;
		this.y -= v.y;
		this.z -= v.z;
	},

	subtractVectors: function( a, b ) {
		this.x = a.x - b.x;
		this.y = a.y - b.y;
		this.z = a.z - b.z;
	},

	multiply: function( v ) {
		this.x *= v.x;
		this.y *= v.y;
		this.z *= v.z;
	},

	multiplyVectors: function( a, b ) {
		this.x = a.x * b.x;
		this.y = a.y * b.y;
		this.z = a.z * b.z;
	},

	scale: function( scalar ) {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
	},

	scaleVector: function( v, scalar ) {
		this.x = v.x * scalar;
		this.y = v.y * scalar;
		this.z = v.z * scalar;
	},

	lengthSquared: function() {
		return this.dot( this );
	},

	length: function() {
		return Math.sqrt( this.lengthSquared() );
	},

	normalize: function() {
		var length = this.length();
		if ( length === 0 ) {
			this.x = this.y = this.z = 0;
		} else {
			this.scale( 1 / length );
		}
	},

	normalizeVector: function( v ) {
		this.copy( v );
		this.normalize();
	},

	dot: function( v ) {
		return this.x * v.x + this.y * v.y + this.z * v.z;
	},

	cross: function( v ) {
		var x = this.x, y = this.y, z = this.z;

		this.x = y * v.z - z * v.y;
		this.y = z * v.x - x * v.z;
		this.z = x * v.y - y * v.x;
	},

	crossVectors: function( a, b ) {
		this.x = a.y * b.z - a.z * b.y;
		this.y = a.z * b.x - a.x * b.z;
		this.z = a.x * b.y - a.y * b.x;
	},

	distanceTo: function( v ) {
		var x = v.x - this.x,
			y = v.y - this.y,
			z = v.z - this.z;
		return Math.sqrt( x*x + y*y + z*z );
	},

	findOrthogonal: function( o1, o2 ) {
		var a, k;
		if ( Math.abs( this.z ) > 0.7071067811865476 ) {
			// choose p in y-z plane
			a = -this.y * this.y + this.z * this.z;
			k = 1 / Math.sqrt( a );
			o1.set( 0, -this.z * k, this.y * k );
			// set q = n x p
			o2.set( a * k, -this.x * o1.z, this.x * o1.y );
		}
		else {
			// choose p in x-y plane
			a = this.x * this.x + this.y * this.y;
			k = 1 / Math.sqrt( a );
			o1.set( -this.y * k, this.x * k, 0 );
			// set q = n x p
			o2.set( -this.z * o1.y, this.z * o1.x, a * k );
		}
	}
};
Goblin.EPSILON = 0.00001;

var _tmp_vec3_1 = new Goblin.Vector3(),
	_tmp_vec3_2 = new Goblin.Vector3(),
	_tmp_vec3_3 = new Goblin.Vector3(),

	x_axis = new Goblin.Vector3( 1, 0, 0 ),
	y_axis = new Goblin.Vector3( 0, 1, 0 ),
	z_axis = new Goblin.Vector3( 0, 0, 1 ),

	_tmp_quat4_1 = new Goblin.Quaternion(),
	_tmp_quat4_2 = new Goblin.Quaternion(),

	_tmp_mat3_1 = new Goblin.Matrix3(),
	_tmp_mat3_2 = new Goblin.Matrix3();
Goblin.EventEmitter = function(){};

Goblin.EventEmitter.prototype = {
	addListener: function( event, listener ) {
		if ( this.listeners[event] == null ) {
			this.listeners[event] = [];
		}

		if ( this.listeners[event].indexOf( listener ) === -1 ) {
			this.listeners[event].push( listener );
		}
	},

	removeListener: function( event, listener ) {
		if ( this.listeners[event] == null ) {
			this.listeners[event] = [];
		}

		var index = this.listeners[event].indexOf( listener );
		if ( index !== -1 ) {
			this.listeners[event].splice( index, 1 );
		}
	},

	removeAllListeners: function() {
		var listeners = Object.keys( this.listeners );
		for ( var i = 0; i < listeners.length; i++ ) {
			this.listeners[listeners[i]].length = 0;
		}
	},

	emit: function( event ) {
		var event_arguments = Array.prototype.slice.call( arguments, 1 ),
			ret_value;

		if ( this.listeners[event] instanceof Array ) {
			var listeners = this.listeners[event].slice();
			for ( var i = 0; i < listeners.length; i++ ) {
				ret_value = listeners[i].apply( this, event_arguments );
				if ( ret_value === false ) {
					return false;
				}
			}
		}
	}
};

Goblin.EventEmitter.apply = function( klass ) {
	klass.prototype.addListener = Goblin.EventEmitter.prototype.addListener;
	klass.prototype.removeListener = Goblin.EventEmitter.prototype.removeListener;
	klass.prototype.removeAllListeners = Goblin.EventEmitter.prototype.removeAllListeners;
	klass.prototype.emit = Goblin.EventEmitter.prototype.emit;
};
/**
 * Represents a rigid body
 *
 * @class RigidBody
 * @constructor
 * @param shape
 * @param mass {Number}
 */
Goblin.RigidBody = (function() {
	var body_count = 0;

	return function( shape, mass ) {
		/**
		 * goblin ID of the body
		 *
		 * @property id
		 * @type {Number}
		 */
		this.id = body_count++;

		/**
		 * shape definition for this rigid body
		 *
		 * @property shape
		 */
		this.shape = shape;

        /**
         * axis-aligned bounding box enclosing this body
         *
         * @property aabb
         * @type {AABB}
         */
        this.aabb = new Goblin.AABB();

		/**
		 * the rigid body's mass
		 *
		 * @property mass
		 * @type {Number}
		 * @default Infinity
		 */
		this._mass = mass || Infinity;
		this._mass_inverted = 1 / mass;

		/**
		 * the rigid body's current position
		 *
		 * @property position
		 * @type {vec3}
		 * @default [ 0, 0, 0 ]
		 */
		this.position = new Goblin.Vector3();

		/**
		 * rotation of the rigid body
		 *
		 * @property rotation
		 * @type {quat4}
		 */
		this.rotation = new Goblin.Quaternion( 0, 0, 0, 1 );

		/**
		 * the rigid body's current linear velocity
		 *
		 * @property linear_velocity
		 * @type {vec3}
		 * @default [ 0, 0, 0 ]
		 */
		this.linear_velocity = new Goblin.Vector3();

		/**
		 * the rigid body's current angular velocity
		 *
		 * @property angular_velocity
		 * @type {vec3}
		 * @default [ 0, 0, 0 ]
		 */
		this.angular_velocity = new Goblin.Vector3();

		/**
		 * transformation matrix transforming points from object space to world space
		 *
		 * @property transform
		 * @type {mat4}
		 */
		this.transform = new Goblin.Matrix4();
		this.transform.identity();

		/**
		 * transformation matrix transforming points from world space to object space
		 *
		 * @property transform_inverse
		 * @type {mat4}
		 */
		this.transform_inverse = new Goblin.Matrix4();
		this.transform_inverse.identity();

		this.inertiaTensor = shape.getInertiaTensor( mass );

		this.inverseInertiaTensor = new Goblin.Matrix3();
		this.inertiaTensor.invertInto( this.inverseInertiaTensor );

		this.inertiaTensorWorldFrame = new Goblin.Matrix3();

		this.inverseInertiaTensorWorldFrame = new Goblin.Matrix3();

		/**
		 * the rigid body's current acceleration
		 *
		 * @property acceleration
		 * @type {vec3}
		 * @default [ 0, 0, 0 ]
		 */
		this.acceleration = new Goblin.Vector3();

		/**
		 * amount of restitution this object has
		 *
		 * @property restitution
		 * @type {Number}
		 * @default 0.1
		 */
		this.restitution = 0.1;

		/**
		 * amount of friction this object has
		 *
		 * @property friction
		 * @type {Number}
		 * @default 0.5
		 */
		this.friction = 0.5;

		/**
		 * bitmask indicating what collision groups this object belongs to
		 *
		 * @property collision_groups
		 * @type {Number}
		 */
		this.collision_groups = 0;

		/**
		 * collision groups mask for the object, specifying what groups to not collide with (BIT 1=0) or which groups to only collide with (Bit 1=1)
		 *
		 * @property collision_mask
		 * @type {Number}
		 */
		this.collision_mask = 0;

		/**
		 * the rigid body's custom gravity
		 *
		 * @property gravity
		 * @type {vec3}
		 * @default null
		 * @private
		 */
		this.gravity = null;

		/**
		 * proportion of linear velocity lost per second ( 0.0 - 1.0 )
		 *
		 * @property linear_damping
		 * @type {Number}
		 */
		this.linear_damping = 0;

		/**
		 * proportion of angular velocity lost per second ( 0.0 - 1.0 )
		 *
		 * @property angular_damping
		 * @type {Number}
		 */
		this.angular_damping = 0;

		/**
		 * multiplier of linear force applied to this body
		 *
		 * @property linear_factor
		 * @type {Goblin.Vector3}
		 */
		this.linear_factor = new Goblin.Vector3( 1, 1, 1 );

		/**
		 * multiplier of angular force applied to this body
		 *
		 * @property angular_factor
		 * @type {Goblin.Vector3}
		 */
		this.angular_factor = new Goblin.Vector3( 1, 1, 1 );

		/**
		 * the world to which the rigid body has been added,
		 * this is set when the rigid body is added to a world
		 *
		 * @property world
		 * @type {Goblin.World}
		 * @default null
		 */
		this.world = null;

		/**
		 * all resultant force accumulated by the rigid body
		 * this force is applied in the next occurring integration
		 *
		 * @property accumulated_force
		 * @type {vec3}
		 * @default [ 0, 0, 0 ]
		 * @private
		 */
		this.accumulated_force = new Goblin.Vector3();

		/**
		 * All resultant torque accumulated by the rigid body
		 * this torque is applied in the next occurring integration
		 *
		 * @property accumulated_force
		 * @type {vec3}
		 * @default [ 0, 0, 0 ]
		 * @private
		 */
		this.accumulated_torque = new Goblin.Vector3();

		// Used by the constraint solver to determine what impulse needs to be added to the body
		this.push_velocity = new Goblin.Vector3();
		this.turn_velocity = new Goblin.Vector3();
		this.solver_impulse = new Float64Array( 6 );

		// Set default derived values
		this.updateDerived();

		this.listeners = {};
	};
})();
Goblin.EventEmitter.apply( Goblin.RigidBody );

Object.defineProperty(
	Goblin.RigidBody.prototype,
	'mass',
	{
		get: function() {
			return this._mass;
		},
		set: function( n ) {
			this._mass = n;
			this._mass_inverted = 1 / n;
			this.inertiaTensor = this.shape.getInertiaTensor( n );
		}
	}
);

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.RigidBody.prototype.findSupportPoint = (function(){
	var local_direction = new Goblin.Vector3();

	return function( direction, support_point ) {
		// Convert direction into local frame for the shape
		this.transform_inverse.rotateVector3Into( direction, local_direction );

		this.shape.findSupportPoint( local_direction, support_point );

		// Convert from the shape's local coordinates to world coordinates
		this.transform.transformVector3( support_point );
	};
})();

/**
 * Checks if a ray segment intersects with the object
 *
 * @method rayIntersect
 * @property ray_start {vec3} start point of the segment
 * @property ray_end {vec3{ end point of the segment
 * @property intersection_list {Array} array to append intersection to
 */
Goblin.RigidBody.prototype.rayIntersect = (function(){
	var local_start = new Goblin.Vector3(),
		local_end = new Goblin.Vector3();

	return function( ray_start, ray_end, intersection_list ) {
		// transform start & end into local coordinates
		this.transform_inverse.transformVector3Into( ray_start, local_start );
		this.transform_inverse.transformVector3Into( ray_end, local_end );

		// Intersect with shape
		var intersection = this.shape.rayIntersect( local_start, local_end );

		if ( intersection != null ) {
			intersection.object = this; // change from the shape to the body
			this.transform.transformVector3( intersection.point ); // transform shape's local coordinates to the body's world coordinates

            // Rotate intersection normal
			this.transform.rotateVector3( intersection.normal );

			intersection_list.push( intersection );
		}
	};
})();

/**
 * Updates the rigid body's position, velocity, and acceleration
 *
 * @method integrate
 * @param timestep {Number} time, in seconds, to use in integration
 */
Goblin.RigidBody.prototype.integrate = function( timestep ) {
	if ( this._mass === Infinity ) {
		return;
	}

	// Add accumulated linear force
	_tmp_vec3_1.scaleVector( this.accumulated_force, this._mass_inverted );
	_tmp_vec3_1.multiply( this.linear_factor );
	this.linear_velocity.add( _tmp_vec3_1 );

	// Add accumulated angular force
	this.inverseInertiaTensorWorldFrame.transformVector3Into( this.accumulated_torque, _tmp_vec3_1 );
	_tmp_vec3_1.multiply( this.angular_factor );
	this.angular_velocity.add( _tmp_vec3_1 );

	// Apply damping
	this.linear_velocity.scale( Math.pow( 1 - this.linear_damping, timestep ) );
	this.angular_velocity.scale( Math.pow( 1 - this.angular_damping, timestep ) );

	// Update position
	_tmp_vec3_1.scaleVector( this.linear_velocity, timestep );
	this.position.add( _tmp_vec3_1 );

	// Update rotation
	_tmp_quat4_1.x = this.angular_velocity.x * timestep;
	_tmp_quat4_1.y = this.angular_velocity.y * timestep;
	_tmp_quat4_1.z = this.angular_velocity.z * timestep;
	_tmp_quat4_1.w = 0;

	_tmp_quat4_1.multiply( this.rotation );

	var half_dt = 0.5;
	this.rotation.x += half_dt * _tmp_quat4_1.x;
	this.rotation.y += half_dt * _tmp_quat4_1.y;
	this.rotation.z += half_dt * _tmp_quat4_1.z;
	this.rotation.w += half_dt * _tmp_quat4_1.w;
	this.rotation.normalize();

	// Clear accumulated forces
	this.accumulated_force.x = this.accumulated_force.y = this.accumulated_force.z = 0;
	this.accumulated_torque.x = this.accumulated_torque.y = this.accumulated_torque.z = 0;
	this.solver_impulse[0] = this.solver_impulse[1] = this.solver_impulse[2] = this.solver_impulse[3] = this.solver_impulse[4] = this.solver_impulse[5] = 0;
	this.push_velocity.x = this.push_velocity.y = this.push_velocity.z = 0;
	this.turn_velocity.x = this.turn_velocity.y = this.turn_velocity.z = 0;
};

/**
 * Sets a custom gravity value for this rigid_body
 *
 * @method setGravity
 * @param x {Number} gravity to apply on x axis
 * @param y {Number} gravity to apply on y axis
 * @param z {Number} gravity to apply on z axis
 */
Goblin.RigidBody.prototype.setGravity = function( x, y, z ) {
	if ( this.gravity ) {
		this.gravity.x = x;
		this.gravity.y = y;
		this.gravity.z = z;
	} else {
		this.gravity = new Goblin.Vector3( x, y, z );
	}
};

/**
 * Directly adds linear velocity to the body
 *
 * @method applyImpulse
 * @param impulse {vec3} linear velocity to add to the body
 */
Goblin.RigidBody.prototype.applyImpulse = function( impulse ) {
	_tmp_vec3_1.multiplyVectors( impulse, this.linear_factor );
	this.linear_velocity.add( _tmp_vec3_1 );
};

/**
 * Adds a force to the rigid_body which will be used only for the next integration
 *
 * @method applyForce
 * @param force {vec3} force to apply to the rigid_body
 */
Goblin.RigidBody.prototype.applyForce = function( force ) {
	this.accumulated_force.add( force );
};

/**
 * Applies the vector `force` at world coordinate `point`
 *
 * @method applyForceAtWorldPoint
 * @param force {vec3} Force to apply
 * @param point {vec3} world coordinates where force originates
 */
Goblin.RigidBody.prototype.applyForceAtWorldPoint = function( force, point ) {
	_tmp_vec3_1.copy( point );
	_tmp_vec3_1.subtract( this.position );
	_tmp_vec3_1.cross( force );

	this.accumulated_force.add( force );
	this.accumulated_torque.add( _tmp_vec3_1 );
};

/**
 * Applies vector `force` to body at position `point` in body's frame
 *
 * @method applyForceAtLocalPoint
 * @param force {vec3} Force to apply
 * @param point {vec3} local frame coordinates where force originates
 */
Goblin.RigidBody.prototype.applyForceAtLocalPoint = function( force, point ) {
	this.transform.transformVector3Into( point, _tmp_vec3_1 );
	this.applyForceAtWorldPoint( force, _tmp_vec3_1 );
};

Goblin.RigidBody.prototype.getVelocityInLocalPoint = function( point, out ) {
	if ( this._mass === Infinity ) {
		out.set( 0, 0, 0 );
	} else {
		out.copy( this.angular_velocity );
		out.cross( point );
		out.add( this.linear_velocity );
	}
};

/**
 * Sets the rigid body's transformation matrix to the current position and rotation
 *
 * @method updateDerived
 */
Goblin.RigidBody.prototype.updateDerived = function() {
	// normalize rotation
	this.rotation.normalize();

	// update this.transform and this.transform_inverse
	this.transform.makeTransform( this.rotation, this.position );
	this.transform.invertInto( this.transform_inverse );

	// Update the world frame inertia tensor and inverse
	if ( this._mass !== Infinity ) {
		_tmp_mat3_1.fromMatrix4( this.transform_inverse );
		_tmp_mat3_1.transposeInto( _tmp_mat3_2 );
		_tmp_mat3_2.multiply( this.inertiaTensor );
		this.inertiaTensorWorldFrame.multiplyFrom( _tmp_mat3_2, _tmp_mat3_1 );

		this.inertiaTensorWorldFrame.invertInto( this.inverseInertiaTensorWorldFrame );
	}

	// Update AABB
	this.aabb.transform( this.shape.aabb, this.transform );
};
/**
 * adds a constant force to associated objects
 *
 * @class ForceGenerator
 * @constructor
 * @param force {vec3} [optional] force the generator applies
*/
Goblin.ForceGenerator = function( force ) {
	/**
	* force which will be applied to affected objects
	*
	* @property force
	* @type {vec3}
	* @default [ 0, 0, 0 ]
	*/
	this.force = force || new Goblin.Vector3();

	/**
	* whether or not the force generator is enabled
	*
	* @property enabled
	* @type {Boolean}
	* @default true
	*/
	this.enabled = true;

	/**
	* array of objects affected by the generator
	*
	* @property affected
	* @type {Array}
	* @default []
	* @private
	*/
	this.affected = [];
};
/**
* applies force to the associated objects
*
* @method applyForce
*/
Goblin.ForceGenerator.prototype.applyForce = function() {
	if ( !this.enabled ) {
		return;
	}

	var i, affected_count;
	for ( i = 0, affected_count = this.affected.length; i < affected_count; i++ ) {
		this.affected[i].applyForce( this.force );
	}
};
/**
* enables the force generator
*
* @method enable
*/
Goblin.ForceGenerator.prototype.enable = function() {
	this.enabled = true;
};
/**
* disables the force generator
*
* @method disable
*/
Goblin.ForceGenerator.prototype.disable = function() {
	this.enabled = false;
};
/**
* adds an object to be affected by the generator
*
* @method affect
* @param object {Mixed} object to be affected, must have `applyForce` method
*/
Goblin.ForceGenerator.prototype.affect = function( object ) {
	var i, affected_count;
	// Make sure this object isn't already affected
	for ( i = 0, affected_count = this.affected.length; i < affected_count; i++ ) {
		if ( this.affected[i] === object ) {
			return;
		}
	}

	this.affected.push( object );
};
/**
* removes an object from being affected by the generator
*
* @method unaffect
* @param object {Mixed} object to be affected, must have `applyForce` method
*/
Goblin.ForceGenerator.prototype.unaffect = function( object ) {
	var i, affected_count;
	for ( i = 0, affected_count = this.affected.length; i < affected_count; i++ ) {
		if ( this.affected[i] === object ) {
			this.affected.splice( i, 1 );
			return;
		}
	}
};
/**
 * Performs a n^2 check of all collision objects to see if any could be in contact
 *
 * @class BasicBroadphase
 * @constructor
 */
Goblin.BasicBroadphase = function() {
	/**
	 * Holds all of the collision objects that the broadphase is responsible for
	 *
	 * @property bodies
	 * @type {Array}
	 */
	this.bodies = [];

	/**
	 * Array of all (current) collision pairs between the broadphases' bodies
	 *
	 * @property collision_pairs
	 * @type {Array}
	 */
	this.collision_pairs = [];
};

/**
 * Adds a body to the broadphase for contact checking
 *
 * @method addBody
 * @param body {RigidBody} body to add to the broadphase contact checking
 */
Goblin.BasicBroadphase.prototype.addBody = function( body ) {
	this.bodies.push( body );
};

/**
 * Removes a body from the broadphase contact checking
 *
 * @method removeBody
 * @param body {RigidBody} body to remove from the broadphase contact checking
 */
Goblin.BasicBroadphase.prototype.removeBody = function( body ) {
	var i,
		body_count = this.bodies.length;

	for ( i = 0; i < body_count; i++ ) {
		if ( this.bodies[i] === body ) {
			this.bodies.splice( i, 1 );
			break;
		}
	}
};

/**
 * Checks all collision objects to find any which are possibly in contact
 *  resulting contact pairs are held in the object's `collision_pairs` property
 *
 * @method update
 */
Goblin.BasicBroadphase.prototype.update = function() {
	var i, j,
		object_a, object_b,
		bodies_count = this.bodies.length;

	// Clear any old contact pairs
	this.collision_pairs.length = 0;

	// Loop over all collision objects and check for overlapping boundary spheres
	for ( i = 0; i < bodies_count; i++ ) {
		object_a = this.bodies[i];

		for ( j = 0; j < bodies_count; j++ ) {
			if ( i <= j ) {
				// if i < j then we have already performed this check
				// if i === j then the two objects are the same and can't be in contact
				continue;
			}

			object_b = this.bodies[j];

			if( Goblin.CollisionUtils.canBodiesCollide( object_a, object_b ) ) {
				if ( object_a.aabb.intersects( object_b.aabb ) ) {
					this.collision_pairs.push( [ object_b, object_a ] );
				}
			}
		}
	}
};

/**
 * Returns an array of objects the given body may be colliding with
 *
 * @method intersectsWith
 * @param object_a {RigidBody}
 * @return Array<RigidBody>
 */
Goblin.BasicBroadphase.prototype.intersectsWith = function( object_a ) {
	var i, object_b,
		bodies_count = this.bodies.length,
		intersections = [];

	// Loop over all collision objects and check for overlapping boundary spheres
	for ( i = 0; i < bodies_count; i++ ) {
		object_b = this.bodies[i];

		if ( object_a === object_b ) {
			continue;
		}

		if ( object_a.aabb.intersects( object_b.aabb ) ) {
			intersections.push( object_b );
		}
	}

	return intersections;
};

/**
 * Checks if a ray segment intersects with objects in the world
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {Array<RayIntersection>} an unsorted array of intersections
 */
Goblin.BasicBroadphase.prototype.rayIntersect = function( start, end ) {
	var bodies_count = this.bodies.length,
		i, body,
		intersections = [];
	for ( i = 0; i < bodies_count; i++ ) {
		body = this.bodies[i];
		if ( body.aabb.testRayIntersect( start, end ) ) {
			body.rayIntersect( start, end, intersections );
		}
	}

	return intersections;
};
(function(){
	/**
	 * @class SAPMarker
	 * @private
	 * @param {SAPMarker.TYPES} marker_type
	 * @param {RigidBody} body
	 * @param {Number} position
	 * @constructor
	 */
	var SAPMarker = function( marker_type, body, position ) {
		this.type = marker_type;
		this.body = body;
		this.position = position;
		
		this.prev = null;
		this.next = null;
	};
	SAPMarker.TYPES = {
		START: 0,
		END: 1
	};

	var LinkedList = function() {
		this.first = null;
		this.last = null;
	};

	/**
	 * Sweep and Prune broadphase
	 *
	 * @class SAPBroadphase
	 * @constructor
	 */
	Goblin.SAPBroadphase = function() {
		/**
		 * linked list of the start/end markers along the X axis
		 *
		 * @property bodies
		 * @type {SAPMarker<SAPMarker>}
		 */
		this.markers_x = new LinkedList();

		/**
		 * linked list of the start/end markers along the Y axis
		 *
		 * @property bodies
		 * @type {SAPMarker<SAPMarker>}
		 */
		this.markers_y = new LinkedList();

		/**
		 * linked list of the start/end markers along the Z axis
		 *
		 * @property bodies
		 * @type {SAPMarker<SAPMarker>}
		 */
		this.markers_z = new LinkedList();

		/**
		 * maintains count of axis over which two bodies overlap; if count is three, their AABBs touch/penetrate
		 *
		 * @property overlap_counter
		 * @type {Object}
		 */
		this.overlap_counter = {};

		/**
		 * array of all (current) collision pairs between the broadphases' bodies
		 *
		 * @property collision_pairs
		 * @type {Array}
		 */
		this.collision_pairs = [];

		/**
		 * array of bodies which have been added to the broadphase since the last update
		 *
		 * @property pending_bodies
		 * @type {Array<RigidBody>}
		 */
		this.pending_bodies = [];
	};

	Goblin.SAPBroadphase.prototype = {
		incrementOverlaps: function( body_a, body_b ) {
			if( !Goblin.CollisionUtils.canBodiesCollide( body_a, body_b ) ) {
				return;
			}

			var key = body_a.id < body_b.id ? body_a.id + '-' + body_b.id : body_b.id + '-' + body_a.id;

			if ( !this.overlap_counter.hasOwnProperty( key ) ) {
				this.overlap_counter[key] = 0;
			}

			this.overlap_counter[key]++;

			if ( this.overlap_counter[key] === 3 ) {
				// The AABBs are touching, add to potential contacts
				this.collision_pairs.push([ body_a.id < body_b.id ? body_a : body_b, body_a.id < body_b.id ? body_b : body_a ]);
			}
		},

		decrementOverlaps: function( body_a, body_b ) {
			var key = body_a.id < body_b.id ? body_a.id + '-' + body_b.id : body_b.id + '-' + body_a.id;

			if ( !this.overlap_counter.hasOwnProperty( key ) ) {
				this.overlap_counter[key] = 0;
			}

			this.overlap_counter[key]--;

			if ( this.overlap_counter[key] === 0 ) {
				delete this.overlap_counter[key];
			} else if ( this.overlap_counter[key] === 2 ) {
				// These are no longer touching, remove from potential contacts
				this.collision_pairs = this.collision_pairs.filter(function( pair ){
					if ( pair[0] === body_a && pair[1] === body_b ) {
						return false;
					}
					if ( pair[0] === body_b && pair[1] === body_a ) {
						return false;
					}
					return true;
				});
			}
		},

		/**
		 * Adds a body to the broadphase for contact checking
		 *
		 * @method addBody
		 * @param body {RigidBody} body to add to the broadphase contact checking
		 */
		addBody: function( body ) {
			this.pending_bodies.push( body );
		},

		removeBody: function( body ) {
			// first, check if the body is pending
			var pending_index = this.pending_bodies.indexOf( body );
			if ( pending_index !== -1 ) {
				this.pending_bodies.splice( pending_index, 1 );
				return;
			}

			// body was already added, find & remove
			var next, prev;
			var marker = this.markers_x.first;
			while ( marker ) {
				if ( marker.body === body ) {
					next = marker.next;
					prev = marker.prev;
					if ( next != null ) {
						next.prev = prev;
						if ( prev != null ) {
							prev.next = next;
						}
					} else {
						this.markers_x.last = prev;
					}
					if ( prev != null ) {
						prev.next = next;
						if ( next != null ) {
							next.prev = prev;
						}
					} else {
						this.markers_x.first = next;
					}
				}
				marker = marker.next;
			}

			marker = this.markers_y.first;
			while ( marker ) {
				if ( marker.body === body ) {
					next = marker.next;
					prev = marker.prev;
					if ( next != null ) {
						next.prev = prev;
						if ( prev != null ) {
							prev.next = next;
						}
					} else {
						this.markers_y.last = prev;
					}
					if ( prev != null ) {
						prev.next = next;
						if ( next != null ) {
							next.prev = prev;
						}
					} else {
						this.markers_y.first = next;
					}
				}
				marker = marker.next;
			}

			marker = this.markers_z.first;
			while ( marker ) {
				if ( marker.body === body ) {
					next = marker.next;
					prev = marker.prev;
					if ( next != null ) {
						next.prev = prev;
						if ( prev != null ) {
							prev.next = next;
						}
					} else {
						this.markers_z.last = prev;
					}
					if ( prev != null ) {
						prev.next = next;
						if ( next != null ) {
							next.prev = prev;
						}
					} else {
						this.markers_z.first = next;
					}
				}
				marker = marker.next;
			}

			// remove any collisions
			this.collision_pairs = this.collision_pairs.filter(function( pair ){
				if ( pair[0] === body || pair[1] === body ) {
					return false;
				}
				return true;
			});
		},

		insertPending: function() {
			var body;
			while ( ( body = this.pending_bodies.pop() ) ) {
				body.updateDerived();
				var start_marker_x = new SAPMarker( SAPMarker.TYPES.START, body, body.aabb.min.x ),
					start_marker_y = new SAPMarker( SAPMarker.TYPES.START, body, body.aabb.min.y ),
					start_marker_z = new SAPMarker( SAPMarker.TYPES.START, body, body.aabb.min.z ),
					end_marker_x = new SAPMarker( SAPMarker.TYPES.END, body, body.aabb.max.x ),
					end_marker_y = new SAPMarker( SAPMarker.TYPES.END, body, body.aabb.max.y ),
					end_marker_z = new SAPMarker( SAPMarker.TYPES.END, body, body.aabb.max.z );

				// Insert these markers, incrementing overlap counter
				this.insert( this.markers_x, start_marker_x );
				this.insert( this.markers_x, end_marker_x );
				this.insert( this.markers_y, start_marker_y );
				this.insert( this.markers_y, end_marker_y );
				this.insert( this.markers_z, start_marker_z );
				this.insert( this.markers_z, end_marker_z );
			}
		},

		insert: function( list, marker ) {
			if ( list.first == null ) {
				list.first = list.last = marker;
			} else {
				// Insert at the end of the list & sort
				marker.prev = list.last;
				list.last.next = marker;
				list.last = marker;
				this.sort( list, marker );
			}
		},

		sort: function( list, marker ) {
			var prev;
			while (
				marker.prev != null &&
				(
					marker.position < marker.prev.position ||
					( marker.position === marker.prev.position && marker.type === SAPMarker.TYPES.START && marker.prev.type === SAPMarker.TYPES.END )
				)
			) {
				prev = marker.prev;

				// check if this swap changes overlap counters
				if ( marker.type !== prev.type ) {
					if ( marker.type === SAPMarker.TYPES.START ) {
						// marker is START, moving into an overlap
						this.incrementOverlaps( marker.body, prev.body );
					} else {
						// marker is END, leaving an overlap
						this.decrementOverlaps( marker.body, prev.body );
					}
				}

				marker.prev = prev.prev;
				prev.next = marker.next;

				marker.next = prev;
				prev.prev = marker;

				if ( marker.prev == null ) {
					list.first = marker;
				} else {
					marker.prev.next = marker;
				}
				if ( prev.next == null ) {
					list.last = prev;
				} else {
					prev.next.prev = prev;
				}
			}
		},

		/**
		 * Updates the broadphase's internal representation and current predicted contacts
		 *
		 * @method update
		 */
		update: function() {
			this.insertPending();

			var marker = this.markers_x.first;
			while ( marker ) {
				if ( marker.type === SAPMarker.TYPES.START ) {
					marker.position = marker.body.aabb.min.x;
				} else {
					marker.position = marker.body.aabb.max.x;
				}
				this.sort( this.markers_x, marker );
				marker = marker.next;
			}

			marker = this.markers_y.first;
			while ( marker ) {
				if ( marker.type === SAPMarker.TYPES.START ) {
					marker.position = marker.body.aabb.min.y;
				} else {
					marker.position = marker.body.aabb.max.y;
				}
				this.sort( this.markers_y, marker );
				marker = marker.next;
			}

			marker = this.markers_z.first;
			while ( marker ) {
				if ( marker.type === SAPMarker.TYPES.START ) {
					marker.position = marker.body.aabb.min.z;
				} else {
					marker.position = marker.body.aabb.max.z;
				}
				this.sort( this.markers_z, marker );
				marker = marker.next;
			}
		},

		/**
		 * Returns an array of objects the given body may be colliding with
		 *
		 * @method intersectsWith
		 * @param body {RigidBody}
		 * @return Array<RigidBody>
		 */
		intersectsWith: function( body ) {
			this.addBody( body );
			this.update();

			var possibilities = this.collision_pairs.filter(function( pair ){
				if ( pair[0] === body || pair[1] === body ) {
					return true;
				}
				return false;
			}).map(function( pair ){
				return pair[0] === body ? pair[1] : pair[0];
			});

			this.removeBody( body );
			return possibilities;
		},

		/**
		 * Checks if a ray segment intersects with objects in the world
		 *
		 * @method rayIntersect
		 * @property start {vec3} start point of the segment
		 * @property end {vec3{ end point of the segment
         * @return {Array<RayIntersection>} an unsorted array of intersections
		 */
		rayIntersect: function( start, end ) {
			// It's assumed that raytracing will be performed through a proxy like Goblin.World,
			// thus that the only time this broadphase cares about updating itself is if an object was added
			if ( this.pending_bodies.length > 0 ) {
				this.update();
			}

			// This implementation only scans the X axis because the overall process gets slower the more axes you add
			// thanks JavaScript

			var active_bodies = {},
				intersections = [],
				id_body_map = {},
				id_intersection_count = {},
				ordered_start, ordered_end,
				marker, has_encountered_start,
				i, body, key, keys;

			// X axis
			marker = this.markers_x.first;
			has_encountered_start = false;
			active_bodies = {};
			ordered_start = start.x < end.x ? start.x : end.x;
			ordered_end = start.x < end.x ? end.x : start.x;
			while ( marker ) {
				if ( marker.type === SAPMarker.TYPES.START ) {
					active_bodies[marker.body.id] = marker.body;
				}

				if ( marker.position >= ordered_start ) {
					if ( has_encountered_start === false ) {
						has_encountered_start = true;
						keys = Object.keys( active_bodies );
						for ( i = 0; i < keys.length; i++ ) {
							key = keys[i];
							body = active_bodies[key];
							if ( body == null ) { // needed because we don't delete but set to null, see below comment
								continue;
							}
							// The next two lines are piss-slow
							id_body_map[body.id] = body;
							id_intersection_count[body.id] = id_intersection_count[body.id] ? id_intersection_count[body.id] + 1 : 1;
						}
					} else if ( marker.type === SAPMarker.TYPES.START ) {
						// The next two lines are piss-slow
						id_body_map[marker.body.id] = marker.body;
						id_intersection_count[marker.body.id] = id_intersection_count[marker.body.id] ? id_intersection_count[marker.body.id] + 1 : 1;
					}
				}

				if ( marker.type === SAPMarker.TYPES.END ) {
					active_bodies[marker.body.id] = null; // this is massively faster than deleting the association
					//delete active_bodies[marker.body.id];
				}

				if ( marker.position > ordered_end ) {
					// no more intersections to find on this axis
					break;
				}

				marker = marker.next;
			}

			keys = Object.keys( id_intersection_count );
			for ( i = 0; i < keys.length; i++ ) {
				var body_id = keys[i];
				if ( id_intersection_count[body_id] === 1 ) {
					if ( id_body_map[body_id].aabb.testRayIntersect( start, end ) ) {
						id_body_map[body_id].rayIntersect( start, end, intersections );
					}
				}
			}

			return intersections;
		}
	};
})();
Goblin.BoxSphere = function( object_a, object_b ) {
	var sphere = object_a.shape instanceof Goblin.SphereShape ? object_a : object_b,
		box = object_a.shape instanceof Goblin.SphereShape ? object_b : object_a,
		contact, distance;

	// Transform the center of the sphere into box coordinates
	box.transform_inverse.transformVector3Into( sphere.position, _tmp_vec3_1 );

	// Early out check to see if we can exclude the contact
	if ( Math.abs( _tmp_vec3_1.x ) - sphere.shape.radius > box.shape.half_width ||
		Math.abs( _tmp_vec3_1.y ) - sphere.shape.radius > box.shape.half_height ||
		Math.abs( _tmp_vec3_1.z ) - sphere.shape.radius > box.shape.half_depth )
	{
		return;
	}

	// `_tmp_vec3_1` is the center of the sphere in relation to the box
	// `_tmp_vec3_2` will hold the point on the box closest to the sphere
	_tmp_vec3_2.x = _tmp_vec3_2.y = _tmp_vec3_2.z = 0;

	// Clamp each coordinate to the box.
	distance = _tmp_vec3_1.x;
	if ( distance > box.shape.half_width ) {
		distance = box.shape.half_width;
	} else if (distance < -box.shape.half_width ) {
		distance = -box.shape.half_width;
	}
	_tmp_vec3_2.x = distance;

	distance = _tmp_vec3_1.y;
	if ( distance > box.shape.half_height ) {
		distance = box.shape.half_height;
	} else if (distance < -box.shape.half_height ) {
		distance = -box.shape.half_height;
	}
	_tmp_vec3_2.y = distance;

	distance = _tmp_vec3_1.z;
	if ( distance > box.shape.half_depth ) {
		distance = box.shape.half_depth;
	} else if (distance < -box.shape.half_depth ) {
		distance = -box.shape.half_depth;
	}
	_tmp_vec3_2.z = distance;

	// Check we're in contact
	_tmp_vec3_3.subtractVectors( _tmp_vec3_2, _tmp_vec3_1 );
	distance = _tmp_vec3_3.lengthSquared();
	if ( distance > sphere.shape.radius * sphere.shape.radius ) {
		return;
	}

	// Get a ContactDetails object populate it
	contact = Goblin.ObjectPool.getObject( 'ContactDetails' );
	contact.object_a = sphere;
	contact.object_b = box;

	if ( distance === 0 ) {

		// The center of the sphere is contained within the box
		Goblin.BoxSphere.spherePenetration( box.shape, _tmp_vec3_1, _tmp_vec3_2, contact );

	} else {

		// Center of the sphere is outside of the box

		// Find contact normal and penetration depth
		contact.contact_normal.subtractVectors( _tmp_vec3_2, _tmp_vec3_1 );
		contact.penetration_depth = -contact.contact_normal.length();
		contact.contact_normal.scale( -1 / contact.penetration_depth );

		// Set contact point of `object_b` (the box )
		contact.contact_point_in_b.copy( _tmp_vec3_2 );

	}

	// Update penetration depth to include sphere's radius
	contact.penetration_depth += sphere.shape.radius;

	// Convert contact normal to world coordinates
	box.transform.rotateVector3( contact.contact_normal );

	// Contact point in `object_a` (the sphere) is the normal * radius converted to the sphere's frame
	sphere.transform_inverse.rotateVector3Into( contact.contact_normal, contact.contact_point_in_a );
	contact.contact_point_in_a.scale( sphere.shape.radius );

	// Find contact position
	contact.contact_point.scaleVector( contact.contact_normal, sphere.shape.radius - contact.penetration_depth / 2 );
	contact.contact_point.add( sphere.position );

	contact.restitution = ( sphere.restitution + box.restitution ) / 2;
	contact.friction = ( sphere.friction + box.friction ) / 2;

	return contact;
};

Goblin.BoxSphere.spherePenetration = function( box, sphere_center, box_point, contact ) {
	var min_distance, face_distance;

	if ( sphere_center.x < 0 ) {
		min_distance = box.half_width + sphere_center.x;
		box_point.x = -box.half_width;
		box_point.y = box_point.z = 0;
		contact.penetration_depth = min_distance;
	} else {
		min_distance = box.half_width - sphere_center.x;
		box_point.x = box.half_width;
		box_point.y = box_point.z = 0;
		contact.penetration_depth = min_distance;
	}

	if ( sphere_center.y < 0 ) {
		face_distance = box.half_height + sphere_center.y;
		if ( face_distance < min_distance ) {
			min_distance = face_distance;
			box_point.y = -box.half_height;
			box_point.x = box_point.z = 0;
			contact.penetration_depth = min_distance;
		}
	} else {
		face_distance = box.half_height - sphere_center.y;
		if ( face_distance < min_distance ) {
			min_distance = face_distance;
			box_point.y = box.half_height;
			box_point.x = box_point.z = 0;
			contact.penetration_depth = min_distance;
		}
	}

	if ( sphere_center.z < 0 ) {
		face_distance = box.half_depth + sphere_center.z;
		if ( face_distance < min_distance ) {
			box_point.z = -box.half_depth;
			box_point.x = box_point.y = 0;
			contact.penetration_depth = min_distance;
		}
	} else {
		face_distance = box.half_depth - sphere_center.z;
		if ( face_distance < min_distance ) {
			box_point.z = box.half_depth;
			box_point.x = box_point.y = 0;
			contact.penetration_depth = min_distance;
		}
	}

	// Set contact point of `object_b` (the box)
	contact.contact_point_in_b.copy( _tmp_vec3_2 );
	contact.contact_normal.scaleVector( contact.contact_point_in_b, -1 );
	contact.contact_normal.normalize();
};
/**
 * Provides the classes and algorithms for running GJK+EPA based collision detection
 *
 * @class GjkEpa
 * @static
 */
Goblin.GjkEpa = {
	margins: 0.01,
	result: null,

    max_iterations: 20,
    epa_condition: 0.001,

    /**
     * Holds a point on the edge of a Minkowski difference along with that point's witnesses and the direction used to find the point
     *
     * @class SupportPoint
     * @param witness_a {vec3} Point in first object used to find the supporting point
     * @param witness_b {vec3} Point in the second object ued to find th supporting point
     * @param point {vec3} The support point on the edge of the Minkowski difference
     * @constructor
     */
    SupportPoint: function( witness_a, witness_b, point ) {
        this.witness_a = witness_a;
        this.witness_b = witness_b;
        this.point = point;
    },

    /**
     * Finds the extant point on the edge of the Minkowski difference for `object_a` - `object_b` in `direction`
     *
     * @method findSupportPoint
     * @param object_a {Goblin.RigidBody} First object in the search
     * @param object_b {Goblin.RigidBody} Second object in the search
     * @param direction {vec3} Direction to find the extant point in
     * @param gjk_point {Goblin.GjkEpa.SupportPoint} `SupportPoint` class to store the resulting point & witnesses in
     */
    findSupportPoint: (function(){
        var temp = new Goblin.Vector3();
        return function( object_a, object_b, direction, support_point ) {
            // Find witnesses from the objects
            object_a.findSupportPoint( direction, support_point.witness_a );
            temp.scaleVector( direction, -1 );
            object_b.findSupportPoint( temp, support_point.witness_b );

            // Find the CSO support point
            support_point.point.subtractVectors( support_point.witness_a, support_point.witness_b );
        };
    })(),

	testCollision: function( object_a, object_b ) {
		var simplex = Goblin.GjkEpa.GJK( object_a, object_b );
		if ( Goblin.GjkEpa.result != null ) {
			return Goblin.GjkEpa.result;
		} else if ( simplex != null ) {
			return Goblin.GjkEpa.EPA( simplex );
		}
	},

    /**
     * Perform GJK algorithm against two objects. Returns a ContactDetails object if there is a collision, else null
     *
     * @method GJK
     * @param object_a {Goblin.RigidBody}
     * @param object_b {Goblin.RigidBody}
     * @return {Goblin.ContactDetails|Boolean} Returns `null` if no collision, else a `ContactDetails` object
     */
	GJK: (function(){
        return function( object_a, object_b ) {
            var simplex = new Goblin.GjkEpa.Simplex( object_a, object_b ),
                last_point;

			Goblin.GjkEpa.result = null;

            while ( ( last_point = simplex.addPoint() ) ){}

            // If last_point is false then there is no collision
            if ( last_point === false ) {
				Goblin.GjkEpa.freeSimplex( simplex );
                return null;
            }

            return simplex;
        };
    })(),

	freeSimplex: function( simplex ) {
		// Free the support points used by this simplex
		for ( var i = 0, points_length = simplex.points.length; i < points_length; i++ ) {
			Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', simplex.points[i] );
		}
	},

	freePolyhedron: function( polyhedron ) {
		// Free the support points used by the polyhedron (includes the points from the simplex used to create the polyhedron
		var pool = Goblin.ObjectPool.pools['GJK2SupportPoint'];

		for ( var i = 0, faces_length = polyhedron.faces.length; i < faces_length; i++ ) {
			// The indexOf checking is required because vertices are shared between faces
			if ( pool.indexOf( polyhedron.faces[i].a ) === -1 ) {
				Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', polyhedron.faces[i].a );
			}
			if ( pool.indexOf( polyhedron.faces[i].b ) === -1 ) {
				Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', polyhedron.faces[i].b );
			}
			if ( pool.indexOf( polyhedron.faces[i].c ) === -1 ) {
				Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', polyhedron.faces[i].c );
			}
		}
	},

    /**
     * Performs the Expanding Polytope Algorithm a GJK simplex
     *
     * @method EPA
     * @param simplex {Goblin.GjkEpa.Simplex} Simplex generated by the GJK algorithm
     * @return {Goblin.ContactDetails}
     */
    EPA: (function(){
		var barycentric = new Goblin.Vector3(),
			confirm = {
				a: new Goblin.Vector3(),
				b: new Goblin.Vector3(),
				c: new Goblin.Vector3()
			};
		return function( simplex ) {
            // Time to convert the simplex to real faces
            // @TODO this should be a priority queue where the position in the queue is ordered by distance from face to origin
			var polyhedron = new Goblin.GjkEpa.Polyhedron( simplex );

			var i = 0;

            // Expand the polyhedron until it doesn't expand any more
			while ( ++i ) {
				polyhedron.findFaceClosestToOrigin();

				// Find a new support point in the direction of the closest point
				if ( polyhedron.closest_face_distance < Goblin.EPSILON ) {
					_tmp_vec3_1.copy( polyhedron.faces[polyhedron.closest_face].normal );
				} else {
					_tmp_vec3_1.copy( polyhedron.closest_point );
				}

				var support_point = Goblin.ObjectPool.getObject( 'GJK2SupportPoint' );
				Goblin.GjkEpa.findSupportPoint( simplex.object_a, simplex.object_b, _tmp_vec3_1, support_point );

				// Check for terminating condition
                _tmp_vec3_1.subtractVectors( support_point.point, polyhedron.closest_point );
                var gap = _tmp_vec3_1.lengthSquared();

				if ( i === Goblin.GjkEpa.max_iterations || ( gap < Goblin.GjkEpa.epa_condition && polyhedron.closest_face_distance > Goblin.EPSILON ) ) {

					// Get a ContactDetails object and fill out its details
					var contact = Goblin.ObjectPool.getObject( 'ContactDetails' );
					contact.object_a = simplex.object_a;
					contact.object_b = simplex.object_b;

					contact.contact_normal.normalizeVector( polyhedron.closest_point );
					if ( contact.contact_normal.lengthSquared() === 0 ) {
						contact.contact_normal.subtractVectors( contact.object_b.position, contact.object_a.position );
					}
					contact.contact_normal.normalize();

					Goblin.GeometryMethods.findBarycentricCoordinates( polyhedron.closest_point, polyhedron.faces[polyhedron.closest_face].a.point, polyhedron.faces[polyhedron.closest_face].b.point, polyhedron.faces[polyhedron.closest_face].c.point, barycentric );

					if ( isNaN( barycentric.x ) ) {
                        // @TODO: Avoid this degenerate case
						//console.log( 'Point not in triangle' );
						//debugger;
						Goblin.GjkEpa.freePolyhedron( polyhedron );
						return null;
					}

					// Contact coordinates of object a
					confirm.a.scaleVector( polyhedron.faces[polyhedron.closest_face].a.witness_a, barycentric.x );
					confirm.b.scaleVector( polyhedron.faces[polyhedron.closest_face].b.witness_a, barycentric.y );
					confirm.c.scaleVector( polyhedron.faces[polyhedron.closest_face].c.witness_a, barycentric.z );
					contact.contact_point_in_a.addVectors( confirm.a, confirm.b );
					contact.contact_point_in_a.add( confirm.c );

					// Contact coordinates of object b
					confirm.a.scaleVector( polyhedron.faces[polyhedron.closest_face].a.witness_b, barycentric.x );
					confirm.b.scaleVector( polyhedron.faces[polyhedron.closest_face].b.witness_b, barycentric.y );
					confirm.c.scaleVector( polyhedron.faces[polyhedron.closest_face].c.witness_b, barycentric.z );
					contact.contact_point_in_b.addVectors( confirm.a, confirm.b );
					contact.contact_point_in_b.add( confirm.c );

					// Find actual contact point
					contact.contact_point.addVectors( contact.contact_point_in_a, contact.contact_point_in_b );
					contact.contact_point.scale( 0.5  );

					// Set objects' local points
					contact.object_a.transform_inverse.transformVector3( contact.contact_point_in_a );
					contact.object_b.transform_inverse.transformVector3( contact.contact_point_in_b );

					// Calculate penetration depth
					contact.penetration_depth = polyhedron.closest_point.length() + Goblin.GjkEpa.margins;

					contact.restitution = ( simplex.object_a.restitution + simplex.object_b.restitution ) / 2;
					contact.friction = ( simplex.object_a.friction + simplex.object_b.friction ) / 2;

					Goblin.GjkEpa.freePolyhedron( polyhedron );

					return contact;
				}

                polyhedron.addVertex( support_point );
			}

			Goblin.GjkEpa.freePolyhedron( polyhedron );
            return null;
        };
    })(),

    Face: function( polyhedron, a, b, c ) {
		this.active = true;
		//this.polyhedron = polyhedron;
        this.a = a;
        this.b = b;
        this.c = c;
        this.normal = new Goblin.Vector3();
		this.neighbors = [];

        _tmp_vec3_1.subtractVectors( b.point, a.point );
        _tmp_vec3_2.subtractVectors( c.point, a.point );
        this.normal.crossVectors( _tmp_vec3_1, _tmp_vec3_2 );
        this.normal.normalize();
    }
};

Goblin.GjkEpa.Polyhedron = function( simplex ) {
	this.closest_face = null;
	this.closest_face_distance = null;
	this.closest_point = new Goblin.Vector3();

	this.faces = [
		//BCD, ACB, CAD, DAB
		new Goblin.GjkEpa.Face( this, simplex.points[2], simplex.points[1], simplex.points[0] ),
		new Goblin.GjkEpa.Face( this, simplex.points[3], simplex.points[1], simplex.points[2] ),
		new Goblin.GjkEpa.Face( this, simplex.points[1], simplex.points[3], simplex.points[0] ),
		new Goblin.GjkEpa.Face( this, simplex.points[0], simplex.points[3], simplex.points[2] )
	];

	this.faces[0].neighbors.push( this.faces[1], this.faces[2], this.faces[3] );
	this.faces[1].neighbors.push( this.faces[2], this.faces[0], this.faces[3] );
	this.faces[2].neighbors.push( this.faces[1], this.faces[3], this.faces[0] );
	this.faces[3].neighbors.push( this.faces[2], this.faces[1], this.faces[0] );
};
Goblin.GjkEpa.Polyhedron.prototype = {
    addVertex: function( vertex )
    {
        var edges = [], faces = [], i, j, a, b, last_b;
        this.faces[this.closest_face].silhouette( vertex, edges );

        // Re-order the edges if needed
        for ( i = 0; i < edges.length - 5; i += 5 ) {
            a = edges[i+3];
            b = edges[i+4];

            // Ensure this edge really should be the next one
            if ( i !== 0 && last_b !== a ) {
                // It shouldn't
                for ( j = i + 5; j < edges.length; j += 5 ) {
                    if ( edges[j+3] === last_b ) {
                        // Found it
                        var tmp = edges.slice( i, i + 5 );
                        edges[i] = edges[j];
                        edges[i+1] = edges[j+1];
                        edges[i+2] = edges[j+2];
                        edges[i+3] = edges[j+3];
                        edges[i+4] = edges[j+4];
                        edges[j] = tmp[0];
                        edges[j+1] = tmp[1];
                        edges[j+2] = tmp[2];
                        edges[j+3] = tmp[3];
                        edges[j+4] = tmp[4];

                        a = edges[i+3];
                        b = edges[i+4];
                        break;
                    }
                }
            }
            last_b = b;
        }

        for ( i = 0; i < edges.length; i += 5 ) {
            var neighbor = edges[i];
            a = edges[i+3];
            b = edges[i+4];

            var face = new Goblin.GjkEpa.Face( this, b, vertex, a );
            face.neighbors[2] = edges[i];
            faces.push( face );

            neighbor.neighbors[neighbor.neighbors.indexOf( edges[i+2] )] = face;
        }

        for ( i = 0; i < faces.length; i++ ) {
            faces[i].neighbors[0] = faces[ i + 1 === faces.length ? 0 : i + 1 ];
            faces[i].neighbors[1] = faces[ i - 1 < 0 ? faces.length - 1 : i - 1 ];
        }

		Array.prototype.push.apply( this.faces, faces );

        return edges;
    },

	findFaceClosestToOrigin: (function(){
		var origin = new Goblin.Vector3(),
			point = new Goblin.Vector3();

		return function() {
			this.closest_face_distance = Infinity;

			var distance, i;

			for ( i = 0; i < this.faces.length; i++ ) {
				if ( this.faces[i].active === false ) {
					continue;
				}

				Goblin.GeometryMethods.findClosestPointInTriangle( origin, this.faces[i].a.point, this.faces[i].b.point, this.faces[i].c.point, point );
				distance = point.lengthSquared();
				if ( distance < this.closest_face_distance ) {
					this.closest_face_distance = distance;
					this.closest_face = i;
					this.closest_point.copy( point );
				}
			}
		};
	})()
};

Goblin.GjkEpa.Face.prototype = {
	/**
	 * Determines if a vertex is in front of or behind the face
	 *
	 * @method classifyVertex
	 * @param vertex {vec3} Vertex to classify
	 * @return {Number} If greater than 0 then `vertex' is in front of the face
	 */
	classifyVertex: function( vertex ) {
		var w = this.normal.dot( this.a.point );
		return this.normal.dot( vertex.point ) - w;
	},

	silhouette: function( point, edges, source ) {
        if ( this.active === false ) {
            return;
        }

        if ( this.classifyVertex( point ) > 0 ) {
			// This face is visible from `point`. Deactivate this face and alert the neighbors
			this.active = false;

			this.neighbors[0].silhouette( point, edges, this );
			this.neighbors[1].silhouette( point, edges, this );
            this.neighbors[2].silhouette( point, edges, this );
		} else if ( source ) {
			// This face is a neighbor to a now-silhouetted face, determine which neighbor and replace it
			var neighbor_idx = this.neighbors.indexOf( source ),
                a, b;
            if ( neighbor_idx === 0 ) {
                a = this.a;
                b = this.b;
            } else if ( neighbor_idx === 1 ) {
                a = this.b;
                b = this.c;
            } else {
                a = this.c;
                b = this.a;
            }
			edges.push( this, neighbor_idx, source, b, a );
		}
	}
};

(function(){
    var origin = new Goblin.Vector3(),
		ao = new Goblin.Vector3(),
        ab = new Goblin.Vector3(),
        ac = new Goblin.Vector3(),
        ad = new Goblin.Vector3();

	var barycentric = new Goblin.Vector3(),
		confirm = {
			a: new Goblin.Vector3(),
			b: new Goblin.Vector3(),
			c: new Goblin.Vector3()
		};

    Goblin.GjkEpa.Simplex = function( object_a, object_b ) {
        this.object_a = object_a;
        this.object_b = object_b;
        this.points = [];
        this.iterations = 0;
        this.next_direction = new Goblin.Vector3();
        this.updateDirection();
    };
    Goblin.GjkEpa.Simplex.prototype = {
        addPoint: function() {
            if ( ++this.iterations === Goblin.GjkEpa.max_iterations ) {
                return false;
            }

            var support_point = Goblin.ObjectPool.getObject( 'GJK2SupportPoint' );
            Goblin.GjkEpa.findSupportPoint( this.object_a, this.object_b, this.next_direction, support_point );
            this.points.push( support_point );

			if ( support_point.point.dot( this.next_direction ) < 0 && this.points.length > 1 ) {
				// Check the margins first
				// @TODO this can be expanded to support 1-simplex (2 points)
				if ( this.points.length >= 3 ) {
					Goblin.GeometryMethods.findClosestPointInTriangle(
						origin,
						this.points[0].point,
						this.points[1].point,
						this.points[2].point,
						_tmp_vec3_1
					);
					var distanceSquared = _tmp_vec3_1.lengthSquared();

					if ( distanceSquared <= Goblin.GjkEpa.margins * Goblin.GjkEpa.margins ) {
						// Get a ContactDetails object and fill out its details
						var contact = Goblin.ObjectPool.getObject( 'ContactDetails' );
						contact.object_a = this.object_a;
						contact.object_b = this.object_b;

						contact.contact_normal.normalizeVector( _tmp_vec3_1 );
						if ( contact.contact_normal.lengthSquared() === 0 ) {
							contact.contact_normal.subtractVectors( contact.object_b.position, contact.object_a.position );
						}
						contact.contact_normal.normalize();
						contact.contact_normal.scale( -1 );

						contact.penetration_depth = Goblin.GjkEpa.margins - Math.sqrt( distanceSquared );

						Goblin.GeometryMethods.findBarycentricCoordinates( _tmp_vec3_1, this.points[0].point, this.points[1].point, this.points[2].point, barycentric );

						if ( isNaN( barycentric.x ) ) {
							//debugger;
							return false;
						}

						// Contact coordinates of object a
						confirm.a.scaleVector( this.points[0].witness_a, barycentric.x );
						confirm.b.scaleVector( this.points[1].witness_a, barycentric.y );
						confirm.c.scaleVector( this.points[2].witness_a, barycentric.z );
						contact.contact_point_in_a.addVectors( confirm.a, confirm.b );
						contact.contact_point_in_a.add( confirm.c );

						// Contact coordinates of object b
						contact.contact_point_in_b.scaleVector( contact.contact_normal, -contact.penetration_depth );
						contact.contact_point_in_b.add( contact.contact_point_in_a );

						// Find actual contact point
						contact.contact_point.addVectors( contact.contact_point_in_a, contact.contact_point_in_b );
						contact.contact_point.scale( 0.5  );

						// Set objects' local points
						contact.object_a.transform_inverse.transformVector3( contact.contact_point_in_a );
						contact.object_b.transform_inverse.transformVector3( contact.contact_point_in_b );

						contact.restitution = ( this.object_a.restitution + this.object_b.restitution ) / 2;
						contact.friction = ( this.object_a.friction + this.object_b.friction ) / 2;

						//Goblin.GjkEpa.freePolyhedron( polyhedron );

						Goblin.GjkEpa.result = contact;
						return null;
					}
				}

				// if the last added point was not past the origin in the direction
				// then the Minkowski difference cannot contain the origin because
				// point added is past the edge of the Minkowski difference
				return false;
			}

            if ( this.updateDirection() === true ) {
                // Found a collision
                return null;
            }

            return support_point;
        },

        findDirectionFromLine: function() {
            ao.scaleVector( this.points[1].point, -1 );
            ab.subtractVectors( this.points[0].point, this.points[1].point );

            if ( ab.dot( ao ) < 0 ) {
                // Origin is on the opposite side of A from B
                this.next_direction.copy( ao );
				Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', this.points[1] );
                this.points.length = 1; // Remove second point
			} else {
                // Origin lies between A and B, move on to a 2-simplex
                this.next_direction.crossVectors( ab, ao );
                this.next_direction.cross( ab );

                // In the case that `ab` and `ao` are parallel vectors, direction becomes a 0-vector
                if (
                    this.next_direction.x === 0 &&
                    this.next_direction.y === 0 &&
                    this.next_direction.z === 0
                ) {
                    ab.normalize();
                    this.next_direction.x = 1 - Math.abs( ab.x );
                    this.next_direction.y = 1 - Math.abs( ab.y );
                    this.next_direction.z = 1 - Math.abs( ab.z );
                }
            }
        },

        findDirectionFromTriangle: function() {
            // Triangle
            var a = this.points[2],
                b = this.points[1],
                c = this.points[0];

            ao.scaleVector( a.point, -1 ); // ao
            ab.subtractVectors( b.point, a.point ); // ab
            ac.subtractVectors( c.point, a.point ); // ac

            // Determine the triangle's normal
            _tmp_vec3_1.crossVectors( ab, ac );

            // Edge cross products
            _tmp_vec3_2.crossVectors( ab, _tmp_vec3_1 );
            _tmp_vec3_3.crossVectors( _tmp_vec3_1, ac );

            if ( _tmp_vec3_3.dot( ao ) >= 0 ) {
                // Origin lies on side of ac opposite the triangle
                if ( ac.dot( ao ) >= 0 ) {
                    // Origin outside of the ac line, so we form a new
                    // 1-simplex (line) with points A and C, leaving B behind
                    this.points.length = 0;
                    this.points.push( c, a );
					Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', b );

                    // New search direction is from ac towards the origin
                    this.next_direction.crossVectors( ac, ao );
                    this.next_direction.cross( ac );
                } else {
                    // *
                    if ( ab.dot( ao ) >= 0 ) {
                        // Origin outside of the ab line, so we form a new
                        // 1-simplex (line) with points A and B, leaving C behind
                        this.points.length = 0;
                        this.points.push( b, a );
						Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', c );

                        // New search direction is from ac towards the origin
                        this.next_direction.crossVectors( ab, ao );
                        this.next_direction.cross( ab );
                    } else {
                        // only A gives us a good reference point, start over with a 0-simplex
                        this.points.length = 0;
                        this.points.push( a );
						Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', b );
						Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', c );
                    }
                    // *
                }

            } else {

                // Origin lies on the triangle side of ac
                if ( _tmp_vec3_2.dot( ao ) >= 0 ) {
                    // Origin lies on side of ab opposite the triangle

                    // *
                    if ( ab.dot( ao ) >= 0 ) {
                        // Origin outside of the ab line, so we form a new
                        // 1-simplex (line) with points A and B, leaving C behind
                        this.points.length = 0;
                        this.points.push( b, a );
						Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', c );

                        // New search direction is from ac towards the origin
                        this.next_direction.crossVectors( ab, ao );
                        this.next_direction.cross( ab );
                    } else {
                        // only A gives us a good reference point, start over with a 0-simplex
                        this.points.length = 0;
                        this.points.push( a );
						Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', b );
						Goblin.ObjectPool.freeObject( 'GJK2SupportPoint', c );
                    }
                    // *

                } else {

                    // Origin lies somewhere in the triangle or above/below it
                    if ( _tmp_vec3_1.dot( ao ) >= 0 ) {
                        // Origin is on the front side of the triangle
                        this.next_direction.copy( _tmp_vec3_1 );
						this.points.length = 0;
						this.points.push( a, b, c );
                    } else {
                        // Origin is on the back side of the triangle
                        this.next_direction.copy( _tmp_vec3_1 );
                        this.next_direction.scale( -1 );
                    }

                }

            }
        },

        getFaceNormal: function( a, b, c, destination ) {
            ab.subtractVectors( b.point, a.point );
            ac.subtractVectors( c.point, a.point );
            destination.crossVectors( ab, ac );
            destination.normalize();
        },

        faceNormalDotOrigin: function( a, b, c ) {
            // Find face normal
            this.getFaceNormal( a, b, c, _tmp_vec3_1 );

            // Find direction of origin from center of face
            _tmp_vec3_2.addVectors( a.point, b.point );
            _tmp_vec3_2.add( c.point );
			_tmp_vec3_2.scale( -3 );
			_tmp_vec3_2.normalize();

            return _tmp_vec3_1.dot( _tmp_vec3_2 );
        },

        findDirectionFromTetrahedron: function() {
            var a = this.points[3],
                b = this.points[2],
                c = this.points[1],
                d = this.points[0];

			// Check each of the four sides to see which one is facing the origin.
			// Then keep the three points for that triangle and use its normal as the search direction
			// The four faces are BCD, ACB, CAD, DAB
			var closest_face = null,
				closest_dot = Goblin.EPSILON,
				face_dot;

			// @TODO we end up calculating the "winning" face normal twice, don't do that

			face_dot = this.faceNormalDotOrigin( b, c, d );
			if ( face_dot > closest_dot ) {
				closest_face = 1;
				closest_dot = face_dot;
			}

			face_dot = this.faceNormalDotOrigin( a, c, b );
			if ( face_dot > closest_dot ) {
				closest_face = 2;
				closest_dot = face_dot;
			}

			face_dot = this.faceNormalDotOrigin( c, a, d );
			if ( face_dot > closest_dot ) {
				closest_face = 3;
				closest_dot = face_dot;
			}

			face_dot = this.faceNormalDotOrigin( d, a, b );
			if ( face_dot > closest_dot ) {
				closest_face = 4;
				closest_dot = face_dot;
			}

			if ( closest_face === null ) {
				// We have a collision, ready for EPA
				return true;
			} else if ( closest_face === 1 ) {
				// BCD
				this.points.length = 0;
				this.points.push( b, c, d );
				this.getFaceNormal( b, c, d, _tmp_vec3_1 );
				this.next_direction.copy( _tmp_vec3_1 );
			} else if ( closest_face === 2 ) {
				// ACB
				this.points.length = 0;
				this.points.push( a, c, b );
				this.getFaceNormal( a, c, b, _tmp_vec3_1 );
				this.next_direction.copy( _tmp_vec3_1 );
			} else if ( closest_face === 3 ) {
				// CAD
				this.points.length = 0;
				this.points.push( c, a, d );
				this.getFaceNormal( c, a, d, _tmp_vec3_1 );
				this.next_direction.copy( _tmp_vec3_1 );
			} else if ( closest_face === 4 ) {
				// DAB
				this.points.length = 0;
				this.points.push( d, a, b );
				this.getFaceNormal( d, a, b, _tmp_vec3_1 );
				this.next_direction.copy( _tmp_vec3_1 );
			}
        },

        containsOrigin: function() {
			var a = this.points[3],
                b = this.points[2],
                c = this.points[1],
                d = this.points[0];

            // Check DCA
            ab.subtractVectors( d.point, a.point );
            ad.subtractVectors( c.point, a.point );
            _tmp_vec3_1.crossVectors( ab, ad );
            if ( _tmp_vec3_1.dot( a.point ) > 0 ) {
                return false;
            }

            // Check CBA
            ab.subtractVectors( c.point, a.point );
            ad.subtractVectors( b.point, a.point );
            _tmp_vec3_1.crossVectors( ab, ad );
            if ( _tmp_vec3_1.dot( a.point ) > 0 ) {
                return false;
            }

            // Check ADB
            ab.subtractVectors( b.point, a.point );
            ad.subtractVectors( d.point, a.point );
            _tmp_vec3_1.crossVectors( ab, ad );
            if ( _tmp_vec3_1.dot( a.point ) > 0 ) {
                return false;
            }

            // Check DCB
            ab.subtractVectors( d.point, c.point );
            ad.subtractVectors( b.point, c.point );
            _tmp_vec3_1.crossVectors( ab, ad );
            if ( _tmp_vec3_1.dot( d.point ) > 0 ) {
                return false;
            }

            return true;
        },

        updateDirection: function() {
            if ( this.points.length === 0 ) {

                this.next_direction.subtractVectors( this.object_b.position, this.object_a.position );

            } else if ( this.points.length === 1 ) {

                this.next_direction.scale( -1 );

            } else if ( this.points.length === 2 ) {

                this.findDirectionFromLine();

            } else if ( this.points.length === 3 ) {

                this.findDirectionFromTriangle();

            } else {

                return this.findDirectionFromTetrahedron();

            }
        }
    };
})();

Goblin.SphereSphere = function( object_a, object_b ) {
	// Cache positions of the spheres
	var position_a = object_a.position,
		position_b = object_b.position;

	// Get the vector between the two objects
	_tmp_vec3_1.subtractVectors( position_b, position_a );
	var distance = _tmp_vec3_1.length();

	// If the distance between the objects is greater than their combined radii
	// then they are not touching, continue processing the other possible contacts
	if ( distance > object_a.shape.radius + object_b.shape.radius ) {
		return;
	}

	// Get a ContactDetails object and fill out it's information
	var contact = Goblin.ObjectPool.getObject( 'ContactDetails' );
	contact.object_a = object_a;
	contact.object_b = object_b;

	// Because we already have the distance (vector magnitude), don't normalize
	// instead we will calculate this value manually
	contact.contact_normal.scaleVector( _tmp_vec3_1, 1 / distance );

	// Calculate contact position
	_tmp_vec3_1.scale( -0.5  );
	contact.contact_point.addVectors( _tmp_vec3_1, position_a );

	// Calculate penetration depth
	contact.penetration_depth = object_a.shape.radius + object_b.shape.radius - distance;

	// Contact points in both objects - in world coordinates at first
	contact.contact_point_in_a.scaleVector( contact.contact_normal, contact.object_a.shape.radius );
	contact.contact_point_in_a.add( contact.object_a.position );
	contact.contact_point_in_b.scaleVector( contact.contact_normal, -contact.object_b.shape.radius );
	contact.contact_point_in_b.add( contact.object_b.position );

	// Find actual contact point
	contact.contact_point.addVectors( contact.contact_point_in_a, contact.contact_point_in_b );
	contact.contact_point.scale( 0.5 );

	// Convert contact_point_in_a and contact_point_in_b to those objects' local frames
	contact.object_a.transform_inverse.transformVector3( contact.contact_point_in_a );
	contact.object_b.transform_inverse.transformVector3( contact.contact_point_in_b );

	contact.restitution = ( object_a.restitution + object_b.restitution ) / 2;
	contact.friction = ( object_a.friction + object_b.friction ) / 2;

	return contact;
};
/**
 * Performs an intersection test between two triangles
 *
 * @method TriangleTriangle
 * @param tri_a {TriangleShape}
 * @param tri_b {TriangleShape}
 */
Goblin.TriangleTriangle = function( tri_a, tri_b ) {
	var dv1_0 = tri_b.classifyVertex( tri_a.a ),
		dv1_1 = tri_b.classifyVertex( tri_a.b ),
		dv1_2 = tri_b.classifyVertex( tri_a.c );

	if (
		(dv1_0 > 0 && dv1_1 > 0 && dv1_2 > 0 ) ||
		(dv1_0 < 0 && dv1_1 < 0 && dv1_2 < 0 )
	)
	{
		// All vertices of tri_a are on the same side of tri_b, no intersection possible
		return null;
	}

	var dv2_0 = tri_a.classifyVertex( tri_b.a ),
		dv2_1 = tri_a.classifyVertex( tri_b.b ),
		dv2_2 = tri_a.classifyVertex( tri_b.c );
	if (
		( dv2_0 > 0 && dv2_1 > 0 && dv2_2 > 0 ) ||
		( dv2_0 < 0 && dv2_1 < 0 && dv2_2 < 0 )
		)
	{
		// All vertices of tri_b are on the same side of tri_a, no intersection possible
		return null;
	}

	var d = new Goblin.Vector3();
	d.crossVectors( tri_a.normal, tri_b.normal );
	d.normalize();

	var pv1_0 = d.dot( tri_a.a ),
		pv1_1 = d.dot( tri_a.b ),
		pv1_2 = d.dot( tri_a.c ),
		pv2_0 = d.dot( tri_b.a ),
		pv2_1 = d.dot( tri_b.b ),
		pv2_2 = d.dot( tri_b.c );

	var aa = tri_a.a,
		ab = tri_a.b,
		ac = tri_a.c,
		ba = tri_b.a,
		bb = tri_b.b,
		bc = tri_b.c;

	var tmp;
	if ( Math.sign( dv1_0 ) === Math.sign( dv1_1 ) ) {
		tmp = dv1_0;
		dv1_0 = dv1_2;
		dv1_2 = tmp;

		tmp = pv1_0;
		pv1_0 = pv1_2;
		pv1_2 = tmp;

		tmp = aa;
		aa = ac;
		ac = tmp;
	} else if ( Math.sign( dv1_0 ) === Math.sign( dv1_2 ) ) {
		tmp = dv1_0;
		dv1_0 = dv1_1;
		dv1_1 = tmp;

		tmp = pv1_0;
		pv1_0 = pv1_1;
		pv1_1 = tmp;

		tmp = aa;
		aa = ab;
		ab = tmp;
	}

	if ( Math.sign( dv2_0 ) === Math.sign( dv2_1 ) ) {
		tmp = dv2_0;
		dv2_0 = dv2_2;
		dv2_2 = tmp;

		tmp = pv2_0;
		pv2_0 = pv2_2;
		pv2_2 = tmp;

		tmp = ba;
		ba = bc;
		bc = tmp;
	} else if ( Math.sign( dv2_0 ) === Math.sign( dv2_2 ) ) {
		tmp = dv2_0;
		dv2_0 = dv2_1;
		dv2_1 = tmp;

		tmp = pv2_0;
		pv2_0 = pv2_1;
		pv2_1 = tmp;

		tmp = ba;
		ba = bb;
		bb = tmp;
	}

	var a_t1 = pv1_0 + ( pv1_1 - pv1_0 ) * ( dv1_0 / ( dv1_0 - dv1_1 ) ),
		a_t2 = pv1_0 + ( pv1_2 - pv1_0 ) * ( dv1_0 / ( dv1_0 - dv1_2 ) ),
		b_t1 = pv2_0 + ( pv2_1 - pv2_0 ) * ( dv2_0 / ( dv2_0 - dv2_1 ) ),
		b_t2 = pv2_0 + ( pv2_2 - pv2_0 ) * ( dv2_0 / ( dv2_0 - dv2_2 ) );

	if ( a_t1 > a_t2 ) {
		tmp = a_t1;
		a_t1 = a_t2;
		a_t2 = tmp;

		tmp = pv1_1;
		pv1_1 = pv1_2;
		pv1_2 = tmp;

		tmp = ab;
		ab = ac;
		ac = tmp;
	}
	if ( b_t1 > b_t2 ) {
		tmp = b_t1;
		b_t1 = b_t2;
		b_t2 = tmp;

		tmp = pv2_1;
		pv2_1 = pv2_2;
		pv2_2 = tmp;

		tmp = bb;
		bb = bc;
		bc = tmp;
	}

	if (
		( a_t1 >= b_t1 && a_t1 <= b_t2 ) ||
		( a_t2 >= b_t1 && a_t2 <= b_t2 ) ||
		( b_t1 >= a_t1 && b_t1 <= a_t2 ) ||
		( b_t2 >= a_t1 && b_t2 <= a_t2 )
	) {
		//console.log( 'contact' );

		var contact = Goblin.ObjectPool.getObject( 'ContactDetails' );

		contact.object_a = tri_a;
		contact.object_b = tri_b;

        //debugger;

        var best_a_a = new Goblin.Vector3(),
            best_a_b = new Goblin.Vector3(),
            best_a_n = new Goblin.Vector3(),
            best_b_a = new Goblin.Vector3(),
            best_b_b = new Goblin.Vector3(),
            best_b_n = new Goblin.Vector3(),
            has_a = false,
            has_b = false;

        if ( tri_b.classifyVertex( aa ) <= 0 ) {
            // aa is penetrating tri_b
            has_a = true;
            Goblin.GeometryMethods.findClosestPointInTriangle( aa, ba, bb, bc, best_a_b );
            best_a_a.copy( aa );
            best_a_n.copy( tri_b.normal );
            best_a_n.scale( -1 );
        } else {
            if ( a_t1 >= b_t1 && a_t1 <= b_t2 ) {
                // ab is penetrating tri_b
                has_a = true;
                Goblin.GeometryMethods.findClosestPointInTriangle( ab, ba, bb, bc, best_a_b );
                best_a_a.copy( ab );
                best_a_n.copy( tri_b.normal );
                best_a_n.scale( -1 );
            } else if ( a_t2 >= b_t1 && a_t2 <= b_t2 ) {
                // ac is penetration tri_b
                has_a = true;
                Goblin.GeometryMethods.findClosestPointInTriangle( ac, ba, bb, bc, best_a_b );
                best_a_a.copy( ac );
                best_a_n.copy( tri_b.normal );
                best_a_n.scale( -1 );
            }
        }

        if ( tri_a.classifyVertex( ba ) <= 0 ) {
            // ba is penetrating tri_a
            has_b = true;
            Goblin.GeometryMethods.findClosestPointInTriangle( ba, aa, ab, ac, best_b_a );
            best_b_b.copy( ba );
            best_b_n.copy( tri_a.normal );
        } else {
            if ( b_t1 >= a_t1 && b_t1 <= a_t2 ) {
                // bb is penetrating tri_a
                has_b = true;
                Goblin.GeometryMethods.findClosestPointInTriangle( bb, aa, ab, ac, best_b_a );
                best_b_b.copy( bb );
                best_b_n.copy( tri_a.normal );
            } else if ( b_t2 >= a_t1 && b_t2 <= a_t2 ) {
                // bc is penetration tri_a
                has_b = true;
                Goblin.GeometryMethods.findClosestPointInTriangle( bc, aa, ab, ac, best_b_a );
                best_b_b.copy( bc );
                best_b_n.copy( tri_a.normal );
            }
        }

        _tmp_vec3_1.subtractVectors( best_a_a, best_a_b );
        _tmp_vec3_2.subtractVectors( best_b_a, best_b_b );
        if ( !has_b || ( has_a && _tmp_vec3_1.lengthSquared() < _tmp_vec3_2.lengthSquared() ) ) {
            contact.contact_point_in_a.copy( best_a_a );
            contact.contact_point_in_b.copy( best_a_b );
            contact.contact_normal.copy( best_a_n );
        } else {
            contact.contact_point_in_a.copy( best_b_a );
            contact.contact_point_in_b.copy( best_b_b );
            contact.contact_normal.copy( best_b_n );
        }
        _tmp_vec3_1.subtractVectors( contact.contact_point_in_a, contact.contact_point_in_b );
        contact.penetration_depth = _tmp_vec3_1.length();
        //console.log( 'depth', contact.penetration_depth );
        //console.log( contact.contact_normal );
		//if (contact.penetration_depth > 1) debugger;



		contact.contact_point.addVectors( contact.contact_point_in_a, contact.contact_point_in_b );
		contact.contact_point.scale( 0.5 );

		/*m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0xFF0000 }) );
		m.position.copy( contact.contact_point_in_a );
		exampleUtils.scene.add( m );

        m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0x0000FF }) );
        m.position.copy( contact.contact_point_in_b );
        exampleUtils.scene.add( m );

        m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0x00FF00 }) );
        m.position.copy( contact.contact_point );
        exampleUtils.scene.add( m );*/

		return contact;
	}

	/*var m;
	_tmp_vec3_1.scaleVector( d, a_t1 / d.length() );
	m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0xDDAAAA }) );
	m.position.copy( _tmp_vec3_1 );
	exampleUtils.scene.add( m );

	_tmp_vec3_1.scaleVector( d, a_t2 / d.length() );
	m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0xDDAAAA }) );
	m.position.copy( _tmp_vec3_1 );
	exampleUtils.scene.add( m );

	_tmp_vec3_1.scaleVector( d, b_t1 / d.length() );
	m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0xAAAADD }) );
	m.position.copy( _tmp_vec3_1 );
	exampleUtils.scene.add( m );

	_tmp_vec3_1.scaleVector( d, b_t2 / d.length() );
	m = new THREE.Mesh( new THREE.SphereGeometry( 0.05 ), new THREE.MeshBasicMaterial({ color: 0xAAAADD }) );
	m.position.copy( _tmp_vec3_1 );
	exampleUtils.scene.add( m );*/

	return null;
};

/**
 * Base class for velocity constraints solved by the IterativeSolver. Not used directly - concrete
 * constraints (ContactConstraint, FrictionConstraint, HingeConstraint, PointConstraint,
 * SliderConstraint, WeldConstraint) extend this via `Object.create( Goblin.Constraint.prototype )`
 * and populate `rows` with the ConstraintRow(s) that express their particular restriction.
 *
 * @class Constraint
 * @constructor
 */
Goblin.Constraint = (function() {
	var constraint_count = 0;

	return function() {
		this.id = constraint_count++;

		this.active = true;

		this.object_a = null;

		this.object_b = null;

		this.limit = new Goblin.ConstraintLimit();

		this.motor = new Goblin.ConstraintMotor();

		this.rows = [];

		this.factor = 1;

		this.last_impulse = new Goblin.Vector3();

		this.breaking_threshold = 0;

		this.listeners = {};
	};
})();
Goblin.EventEmitter.apply( Goblin.Constraint );

/**
 * Marks this constraint inactive and emits a `deactivate` event, so the solver drops it from
 * `all_constraints` and any listeners (e.g. a manifold's contact/friction constraint pair) can
 * clean up in response.
 *
 * @method deactivate
 */
Goblin.Constraint.prototype.deactivate = function() {
	this.active = false;
	this.emit( 'deactivate' );
};

/**
 * Recomputes this constraint's row(s) (jacobian, bias) from current body state. Called once per
 * solver iteration before the rows are consumed. No-op on the base class; concrete constraints
 * override this.
 *
 * @method update
 */
Goblin.Constraint.prototype.update = function(){};
/**
 * Optional lower/upper bound on a constraint's separating value (e.g. a HingeConstraint's angle
 * about its axis). Owned by the constraint it limits; only allocates its ConstraintRow lazily,
 * on demand, when the bound is actually violated.
 *
 * @class ConstraintLimit
 * @constructor
 * @param limit_lower {Number} lower bound, or null/undefined to leave that side unconstrained
 * @param limit_upper {Number} upper bound, or null/undefined to leave that side unconstrained
 */
Goblin.ConstraintLimit = function( limit_lower, limit_upper ) {
	this.erp = 0.3;
	this.constraint_row = null;

	this.set( limit_lower, limit_upper );
};

/**
 * Updates the lower/upper bounds and re-derives `enabled` from whether either bound is set.
 *
 * @method set
 * @param limit_lower {Number} lower bound, or null/undefined to leave that side unconstrained
 * @param limit_upper {Number} upper bound, or null/undefined to leave that side unconstrained
 */
Goblin.ConstraintLimit.prototype.set = function( limit_lower, limit_upper ) {
	this.limit_lower = limit_lower;
	this.limit_upper = limit_upper;

	this.enabled = this.limit_lower != null || this.limit_upper != null;
};

/**
 * Allocates this limit's ConstraintRow from the object pool. Called by the owning constraint the
 * first time the limit is actually violated in a given step.
 *
 * @method createConstraintRow
 */
Goblin.ConstraintLimit.prototype.createConstraintRow = function() {
	this.constraint_row = Goblin.ConstraintRow.createConstraintRow();
};
/**
 * Optional powered drive on a constraint (e.g. a HingeConstraint spinning its axis under a bounded
 * torque up to a target speed). Owned by the constraint it drives; only allocates its
 * ConstraintRow lazily, on demand, once enabled.
 *
 * @class ConstraintMotor
 * @constructor
 * @param torque {Number} maximum torque/force the motor may apply, or null/undefined to disable
 * @param max_speed {Number} target speed the motor drives toward, or null/undefined to disable
 */
Goblin.ConstraintMotor = function( torque, max_speed ) {
	this.constraint_row = null;
	this.set( torque, max_speed);
};

/**
 * Updates the motor's torque/speed and re-derives `enabled` from whether both are set.
 *
 * @method set
 * @param torque {Number} maximum torque/force the motor may apply, or null/undefined to disable
 * @param max_speed {Number} target speed the motor drives toward, or null/undefined to disable
 */
Goblin.ConstraintMotor.prototype.set = function( torque, max_speed ) {
	this.enabled = torque != null && max_speed != null;
	this.torque = torque;
	this.max_speed = max_speed;
};

/**
 * Allocates this motor's ConstraintRow from the object pool. Called by the owning constraint the
 * first time the motor is enabled.
 *
 * @method createConstraintRow
 */
Goblin.ConstraintMotor.prototype.createConstraintRow = function() {
	this.constraint_row = Goblin.ConstraintRow.createConstraintRow();
};
/**
 * One scalar row of a Constraint's velocity-level equation: `jacobian . v = bias`, solved by the
 * IterativeSolver as a 1D LCP bounded by `lower_limit`/`upper_limit`. `jacobian` packs both
 * bodies' linear and angular coefficients into 12 slots (object_a: [0..2] linear, [3..5] angular;
 * object_b: [6..8] linear, [9..11] angular). A Constraint may own several rows (e.g. a
 * HingeConstraint's 5 positional + rotational rows).
 *
 * @class ConstraintRow
 * @constructor
 */
Goblin.ConstraintRow = function() {
	this.jacobian = new Float64Array( 12 );
	this.B = new Float64Array( 12 ); // `B` is the jacobian multiplied by the objects' inverted mass & inertia tensors
	this.D = 0; // Length of the jacobian

	this.lower_limit = -Infinity;
	this.upper_limit = Infinity;

	this.bias = 0;
	this.multiplier = 0;
	this.multiplier_cached = 0;
	this.eta = 0;
	this.eta_row = new Float64Array( 12 );
};

/**
 * Fetches a ConstraintRow from the object pool and resets it to a fresh, unbounded, zero-jacobian
 * state, ready for a constraint to populate. Preferred over `new Goblin.ConstraintRow()` in the
 * per-step solve path to avoid churn.
 *
 * @method createConstraintRow
 * @return {ConstraintRow} a pooled row reset to defaults
 * @static
 */
Goblin.ConstraintRow.createConstraintRow = function() {
	var row =  Goblin.ObjectPool.getObject( 'ConstraintRow' );
	row.lower_limit = -Infinity;
	row.upper_limit = Infinity;
	row.bias = 0;

	row.jacobian[0] = row.jacobian[1] = row.jacobian[2] =
	row.jacobian[3] = row.jacobian[4] = row.jacobian[5] =
	row.jacobian[6] = row.jacobian[7] = row.jacobian[8] =
	row.jacobian[9] = row.jacobian[10] = row.jacobian[11] = 0;

	return row;
};

/**
 * Computes `B`, the jacobian pre-multiplied by each body's inverse mass and inverse inertia tensor
 * (and clamped by its linear/angular factor). `B` is the row's effective impulse-per-unit-lambda;
 * it's reused by `computeD` and by the solver's per-iteration impulse application.
 *
 * @method computeB
 * @param constraint {Constraint} the owning constraint, for its object_a/object_b
 */
Goblin.ConstraintRow.prototype.computeB = function( constraint ) {
	var invmass;

	if ( constraint.object_a != null && constraint.object_a._mass !== Infinity ) {
		invmass = constraint.object_a._mass_inverted;

		this.B[0] = invmass * this.jacobian[0] * constraint.object_a.linear_factor.x;
		this.B[1] = invmass * this.jacobian[1] * constraint.object_a.linear_factor.y;
		this.B[2] = invmass * this.jacobian[2] * constraint.object_a.linear_factor.z;

		_tmp_vec3_1.x = this.jacobian[3];
		_tmp_vec3_1.y = this.jacobian[4];
		_tmp_vec3_1.z = this.jacobian[5];
		constraint.object_a.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );
		this.B[3] = _tmp_vec3_1.x * constraint.object_a.angular_factor.x;
		this.B[4] = _tmp_vec3_1.y * constraint.object_a.angular_factor.y;
		this.B[5] = _tmp_vec3_1.z * constraint.object_a.angular_factor.z;
	} else {
		this.B[0] = this.B[1] = this.B[2] = 0;
		this.B[3] = this.B[4] = this.B[5] = 0;
	}

	if ( constraint.object_b != null && constraint.object_b._mass !== Infinity ) {
		invmass = constraint.object_b._mass_inverted;
		this.B[6] = invmass * this.jacobian[6] * constraint.object_b.linear_factor.x;
		this.B[7] = invmass * this.jacobian[7] * constraint.object_b.linear_factor.y;
		this.B[8] = invmass * this.jacobian[8] * constraint.object_b.linear_factor.z;

		_tmp_vec3_1.x = this.jacobian[9];
		_tmp_vec3_1.y = this.jacobian[10];
		_tmp_vec3_1.z = this.jacobian[11];
		constraint.object_b.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );
		this.B[9] = _tmp_vec3_1.x * constraint.object_b.linear_factor.x;
		this.B[10] = _tmp_vec3_1.y * constraint.object_b.linear_factor.y;
		this.B[11] = _tmp_vec3_1.z * constraint.object_b.linear_factor.z;
	} else {
		this.B[6] = this.B[7] = this.B[8] = 0;
		this.B[9] = this.B[10] = this.B[11] = 0;
	}
};

/**
 * Computes `D`, the effective mass of this row (`jacobian . B`) - the denominator used when
 * solving for the impulse `lambda` that satisfies this row's velocity constraint.
 *
 * @method computeD
 */
Goblin.ConstraintRow.prototype.computeD = function() {
	this.D = (
		this.jacobian[0] * this.B[0] +
		this.jacobian[1] * this.B[1] +
		this.jacobian[2] * this.B[2] +
		this.jacobian[3] * this.B[3] +
		this.jacobian[4] * this.B[4] +
		this.jacobian[5] * this.B[5] +
		this.jacobian[6] * this.B[6] +
		this.jacobian[7] * this.B[7] +
		this.jacobian[8] * this.B[8] +
		this.jacobian[9] * this.B[9] +
		this.jacobian[10] * this.B[10] +
		this.jacobian[11] * this.B[11]
	);
};

/**
 * Computes `eta`, the amount of work needed this step to satisfy the row's constraint: the
 * velocity implied by each body's current velocity plus its accumulated (unresolved) force/torque,
 * projected through the jacobian, offset by the row's position-error `bias`. This is the target
 * the solver drives `jacobian . v` toward.
 *
 * @method computeEta
 * @param constraint {Constraint} the owning constraint, for its object_a/object_b
 * @param time_delta {Number} the step's time delta, in seconds
 */
Goblin.ConstraintRow.prototype.computeEta = function( constraint, time_delta ) {
	var invmass,
		inverse_time_delta = 1 / time_delta;

	if ( constraint.object_a == null || constraint.object_a._mass === Infinity ) {
		this.eta_row[0] = this.eta_row[1] = this.eta_row[2] = this.eta_row[3] = this.eta_row[4] = this.eta_row[5] = 0;
	} else {
		invmass = constraint.object_a._mass_inverted;

		this.eta_row[0] = ( constraint.object_a.linear_velocity.x + ( invmass * constraint.object_a.accumulated_force.x ) ) * inverse_time_delta;
		this.eta_row[1] = ( constraint.object_a.linear_velocity.y + ( invmass * constraint.object_a.accumulated_force.y ) ) * inverse_time_delta;
		this.eta_row[2] = ( constraint.object_a.linear_velocity.z + ( invmass * constraint.object_a.accumulated_force.z ) ) * inverse_time_delta;

		_tmp_vec3_1.copy( constraint.object_a.accumulated_torque );
		constraint.object_a.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );
		this.eta_row[3] = ( constraint.object_a.angular_velocity.x + _tmp_vec3_1.x ) * inverse_time_delta;
		this.eta_row[4] = ( constraint.object_a.angular_velocity.y + _tmp_vec3_1.y ) * inverse_time_delta;
		this.eta_row[5] = ( constraint.object_a.angular_velocity.z + _tmp_vec3_1.z ) * inverse_time_delta;
	}

	if ( constraint.object_b == null || constraint.object_b._mass === Infinity ) {
		this.eta_row[6] = this.eta_row[7] = this.eta_row[8] = this.eta_row[9] = this.eta_row[10] = this.eta_row[11] = 0;
	} else {
		invmass = constraint.object_b._mass_inverted;

		this.eta_row[6] = ( constraint.object_b.linear_velocity.x + ( invmass * constraint.object_b.accumulated_force.x ) ) * inverse_time_delta;
		this.eta_row[7] = ( constraint.object_b.linear_velocity.y + ( invmass * constraint.object_b.accumulated_force.y ) ) * inverse_time_delta;
		this.eta_row[8] = ( constraint.object_b.linear_velocity.z + ( invmass * constraint.object_b.accumulated_force.z ) ) * inverse_time_delta;

		_tmp_vec3_1.copy( constraint.object_b.accumulated_torque );
		constraint.object_b.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );
		this.eta_row[9] = ( constraint.object_b.angular_velocity.x + _tmp_vec3_1.x ) * inverse_time_delta;
		this.eta_row[10] = ( constraint.object_b.angular_velocity.y + _tmp_vec3_1.y ) * inverse_time_delta;
		this.eta_row[11] = ( constraint.object_b.angular_velocity.z + _tmp_vec3_1.z ) * inverse_time_delta;
	}

	var jdotv = this.jacobian[0] * this.eta_row[0] +
		this.jacobian[1] * this.eta_row[1] +
		this.jacobian[2] * this.eta_row[2] +
		this.jacobian[3] * this.eta_row[3] +
		this.jacobian[4] * this.eta_row[4] +
		this.jacobian[5] * this.eta_row[5] +
		this.jacobian[6] * this.eta_row[6] +
		this.jacobian[7] * this.eta_row[7] +
		this.jacobian[8] * this.eta_row[8] +
		this.jacobian[9] * this.eta_row[9] +
		this.jacobian[10] * this.eta_row[10] +
		this.jacobian[11] * this.eta_row[11];

	this.eta = ( this.bias * inverse_time_delta ) - jdotv;
};
/**
 * The non-penetration half of a contact: a single-row, one-sided ([0, Infinity]) constraint along
 * the contact normal that prevents two bodies from interpenetrating, with restitution folded into
 * its bias. Always built and solved alongside a FrictionConstraint for the same ContactDetails -
 * see IterativeSolver.processContactManifolds.
 *
 * @class ContactConstraint
 * @constructor
 */
Goblin.ContactConstraint = function() {
	Goblin.Constraint.call( this );

	this.contact = null;
};
Goblin.ContactConstraint.prototype = Object.create( Goblin.Constraint.prototype );

/**
 * Initializes this constraint from a ContactDetails: sets object_a/object_b, wires a listener so
 * the constraint deactivates itself if the contact is destroyed, and builds the initial row.
 *
 * @method buildFromContact
 * @param contact {ContactDetails} the contact this constraint enforces
 */
Goblin.ContactConstraint.prototype.buildFromContact = function( contact ) {
	this.object_a = contact.object_a;
	this.object_b = contact.object_b;
	this.contact = contact;

	var self = this;
	var onDestroy = function() {
		this.removeListener( 'destroy', onDestroy );
		self.deactivate();
	};
	this.contact.addListener( 'destroy', onDestroy );

	var row = this.rows[0] || Goblin.ObjectPool.getObject( 'ConstraintRow' );
	row.lower_limit = 0;
	row.upper_limit = Infinity;
	this.rows[0] = row;

	this.update();
};

/**
 * Recomputes the constraint's single row from current body/contact state: the normal-direction
 * jacobian for both bodies, the restitution bias from relative velocity at the contact point, and
 * the perpendicular-lever correction (see `_bleedPerpLever`) that removes rounding-scale phantom
 * torque on a near-centered contact.
 *
 * @method update
 */

Goblin.ContactConstraint.prototype.update = function() {
	var row = this.rows[0];

	if ( this.object_a == null || this.object_a._mass === Infinity ) {
		row.jacobian[0] = row.jacobian[1] = row.jacobian[2] = 0;
		row.jacobian[3] = row.jacobian[4] = row.jacobian[5] = 0;
	} else {
		row.jacobian[0] = -this.contact.contact_normal.x;
		row.jacobian[1] = -this.contact.contact_normal.y;
		row.jacobian[2] = -this.contact.contact_normal.z;

		_tmp_vec3_1.subtractVectors( this.contact.contact_point, this.contact.object_a.position );
		_tmp_vec3_1.cross( this.contact.contact_normal );
		row.jacobian[3] = -_tmp_vec3_1.x;
		row.jacobian[4] = -_tmp_vec3_1.y;
		row.jacobian[5] = -_tmp_vec3_1.z;
	}

	if ( this.object_b == null || this.object_b._mass === Infinity ) {
		row.jacobian[6] = row.jacobian[7] = row.jacobian[8] = 0;
		row.jacobian[9] = row.jacobian[10] = row.jacobian[11] = 0;
	} else {
		row.jacobian[6] = this.contact.contact_normal.x;
		row.jacobian[7] = this.contact.contact_normal.y;
		row.jacobian[8] = this.contact.contact_normal.z;

		_tmp_vec3_1.subtractVectors( this.contact.contact_point, this.contact.object_b.position );
		_tmp_vec3_1.cross( this.contact.contact_normal );
		row.jacobian[9] = _tmp_vec3_1.x;
		row.jacobian[10] = _tmp_vec3_1.y;
		row.jacobian[11] = _tmp_vec3_1.z;
	}

	// Pre-calc error
	row.bias = 0;

	// Apply restitution, from each body's velocity at the world contact point. The lever arm is
	// world-space (contact_point - position), matching the angular jacobian above; a body-local
	// anchor is not a world lever once the body has rotated, and using one lets a rolling body's
	// spin leak into the normal velocity as phantom restitution.
	var velocity_along_normal = 0;
	if ( this.object_a._mass !== Infinity ) {
		_tmp_vec3_2.subtractVectors( this.contact.contact_point, this.object_a.position );
		_tmp_vec3_1.crossVectors( this.object_a.angular_velocity, _tmp_vec3_2 );
		_tmp_vec3_1.add( this.object_a.linear_velocity );
		velocity_along_normal += _tmp_vec3_1.dot( this.contact.contact_normal );
	}
	if ( this.object_b._mass !== Infinity ) {
		_tmp_vec3_2.subtractVectors( this.contact.contact_point, this.object_b.position );
		_tmp_vec3_1.crossVectors( this.object_b.angular_velocity, _tmp_vec3_2 );
		_tmp_vec3_1.add( this.object_b.linear_velocity );
		velocity_along_normal -= _tmp_vec3_1.dot( this.contact.contact_normal );
	}

	// Add restitution to bias
	row.bias += velocity_along_normal * this.contact.restitution;

	// Remove the normal impulse's phantom torque for a near-centered contact
	Goblin.ContactConstraint._bleedPerpLever( this.rows[0], 3, this.contact.contact_point, this.object_a, this.contact.contact_normal );
	Goblin.ContactConstraint._bleedPerpLever( this.rows[0], 9, this.contact.contact_point, this.object_b, this.contact.contact_normal );
};

/**
 * Perpendicular lever-arm length below which a contact is treated as centered under the body and its
 * normal-impulse torque is zeroed. Above it the contact is genuinely off-center and left untouched.
 *
 * @property PERP_GATE
 * @type {Number}
 * @static
 */
Goblin.ContactConstraint.PERP_GATE = 1e-4;

/**
 * Zeroes the phantom torque a normal impulse would apply through a near-centered contact's lever arm.
 * The normal row's angular jacobian is (contact_point - body.position) x contact_normal; its component
 * perpendicular to the normal is the torque lever. When that lever is within `PERP_GATE` the contact is
 * centered under the body and the lever is floating-point noise, so it is dropped (the jacobian becomes
 * the along-normal cross product, which is zero). Genuinely off-center contacts have a larger lever and
 * are left unchanged.
 *
 * @method _bleedPerpLever
 * @param row {ConstraintRow} the normal constraint row to correct
 * @param jbase {Number} angular jacobian offset for the body ( 3 for object_a, 9 for object_b )
 * @param contact_point {Vector3} world-space contact point
 * @param body {RigidBody} the body whose lever arm is measured
 * @param normal {Vector3} world-space contact normal
 * @static
 * @private
 */
Goblin.ContactConstraint._bleedPerpLever = (function(){
	var r = new Goblin.Vector3(), along_vec = new Goblin.Vector3(), lever = new Goblin.Vector3();
	return function( row, jbase, contact_point, body, normal ) {
		if ( body == null || body._mass === Infinity ) {
			return;
		}
		r.subtractVectors( contact_point, body.position );
		var along = r.x * normal.x + r.y * normal.y + r.z * normal.z;
		along_vec.scaleVector( normal, along );

		var px = r.x - along_vec.x, py = r.y - along_vec.y, pz = r.z - along_vec.z;
		var plen = Math.sqrt( px * px + py * py + pz * pz );
		if ( plen < 1e-12 || plen > Goblin.ContactConstraint.PERP_GATE ) {
			return;
		}

		lever.crossVectors( along_vec, normal );
		var sign = ( jbase === 3 ) ? -1 : 1;
		row.jacobian[ jbase ]     = sign * lever.x;
		row.jacobian[ jbase + 1 ] = sign * lever.y;
		row.jacobian[ jbase + 2 ] = sign * lever.z;
	};
})();
/**
 * The tangential half of a contact: two rows constraining relative velocity along a pair of axes
 * orthogonal to the contact normal, bounded by +/- (friction coefficient * normal mass) so the
 * friction force can never exceed what Coulomb friction allows for the current normal load. Always
 * built and solved alongside a ContactConstraint for the same ContactDetails - see
 * IterativeSolver.processContactManifolds.
 *
 * @class FrictionConstraint
 * @constructor
 */
Goblin.FrictionConstraint = function() {
	Goblin.Constraint.call( this );

	this.contact = null;
};
Goblin.FrictionConstraint.prototype = Object.create( Goblin.Constraint.prototype );

/**
 * Initializes this constraint from a ContactDetails: allocates its two rows, sets
 * object_a/object_b, wires a listener so the constraint deactivates itself if the contact is
 * destroyed, and builds the initial rows.
 *
 * @method buildFromContact
 * @param contact {ContactDetails} the contact this constraint enforces
 */
Goblin.FrictionConstraint.prototype.buildFromContact = function( contact ) {
	this.rows[0] = this.rows[0] || Goblin.ObjectPool.getObject( 'ConstraintRow' );
	this.rows[1] = this.rows[1] || Goblin.ObjectPool.getObject( 'ConstraintRow' );

	this.object_a = contact.object_a;
	this.object_b = contact.object_b;
	this.contact = contact;

	var self = this;
	var onDestroy = function() {
		this.removeListener( 'destroy', onDestroy );
		self.deactivate();
	};
	this.contact.addListener( 'destroy', onDestroy );

	this.update();
};

/**
 * Recomputes both rows from current body/contact state: the two tangent-direction jacobians
 * (found via `contact_normal.findOrthogonal`) and the current friction limit, derived from the
 * contact's friction coefficient scaled by both bodies' mass.
 *
 * @method update
 */
Goblin.FrictionConstraint.prototype.update = (function(){
	var rel_a = new Goblin.Vector3(),
		rel_b = new Goblin.Vector3(),
		u1 = new Goblin.Vector3(),
		u2 = new Goblin.Vector3();

	return function updateFrictionConstraint() {
		var row_1 = this.rows[0],
			row_2 = this.rows[1];

		// Find the contact point relative to object_a and object_b
		rel_a.subtractVectors( this.contact.contact_point, this.object_a.position );
		rel_b.subtractVectors( this.contact.contact_point, this.object_b.position );

		this.contact.contact_normal.findOrthogonal( u1, u2 );

		if ( this.object_a == null || this.object_a._mass === Infinity ) {
			row_1.jacobian[0] = row_1.jacobian[1] = row_1.jacobian[2] = 0;
			row_1.jacobian[3] = row_1.jacobian[4] = row_1.jacobian[5] = 0;
			row_2.jacobian[0] = row_2.jacobian[1] = row_2.jacobian[2] = 0;
			row_2.jacobian[3] = row_2.jacobian[4] = row_2.jacobian[5] = 0;
		} else {
			row_1.jacobian[0] = -u1.x;
			row_1.jacobian[1] = -u1.y;
			row_1.jacobian[2] = -u1.z;

			_tmp_vec3_1.crossVectors( rel_a, u1 );
			row_1.jacobian[3] = -_tmp_vec3_1.x;
			row_1.jacobian[4] = -_tmp_vec3_1.y;
			row_1.jacobian[5] = -_tmp_vec3_1.z;

			row_2.jacobian[0] = -u2.x;
			row_2.jacobian[1] = -u2.y;
			row_2.jacobian[2] = -u2.z;

			_tmp_vec3_1.crossVectors( rel_a, u2 );
			row_2.jacobian[3] = -_tmp_vec3_1.x;
			row_2.jacobian[4] = -_tmp_vec3_1.y;
			row_2.jacobian[5] = -_tmp_vec3_1.z;
		}

		if ( this.object_b == null || this.object_b._mass === Infinity ) {
			row_1.jacobian[6] = row_1.jacobian[7] = row_1.jacobian[8] = 0;
			row_1.jacobian[9] = row_1.jacobian[10] = row_1.jacobian[11] = 0;
			row_2.jacobian[6] = row_2.jacobian[7] = row_2.jacobian[8] = 0;
			row_2.jacobian[9] = row_2.jacobian[10] = row_2.jacobian[11] = 0;
		} else {
			row_1.jacobian[6] = u1.x;
			row_1.jacobian[7] = u1.y;
			row_1.jacobian[8] = u1.z;

			_tmp_vec3_1.crossVectors( rel_b, u1 );
			row_1.jacobian[9] = _tmp_vec3_1.x;
			row_1.jacobian[10] = _tmp_vec3_1.y;
			row_1.jacobian[11] = _tmp_vec3_1.z;

			row_2.jacobian[6] = u2.x;
			row_2.jacobian[7] = u2.y;
			row_2.jacobian[8] = u2.z;

			_tmp_vec3_1.crossVectors( rel_b, u2 );
			row_2.jacobian[9] = _tmp_vec3_1.x;
			row_2.jacobian[10] = _tmp_vec3_1.y;
			row_2.jacobian[11] = _tmp_vec3_1.z;
		}

		// Scale the friction clamp by the lighter body's mass
		var ma = ( this.object_a != null && this.object_a._mass !== Infinity ) ? this.object_a._mass : Infinity;
		var mb = ( this.object_b != null && this.object_b._mass !== Infinity ) ? this.object_b._mass : Infinity;
		var mscale = Math.min( ma, mb );
		if ( mscale === Infinity ) {
			mscale = 1;
		}
		var limit = this.contact.friction * mscale;
		if ( limit < 0 ) {
			limit = 0;
		}
		row_1.lower_limit = row_2.lower_limit = -limit;
		row_1.upper_limit = row_2.upper_limit = limit;

		row_1.bias = row_2.bias = 0;

		this.rows[0] = row_1;
		this.rows[1] = row_2;
	};
})();
/**
 * Constrains two bodies (or one body and the world) to rotate about a shared axis and pivot point,
 * like a door hinge: 3 rows lock relative position at the pivot, 2 more lock rotation to the single
 * degree of freedom about the hinge axis. Optionally bounded by a ConstraintLimit (swing angle) and
 * driven by a ConstraintMotor (powered rotation).
 *
 * @class HingeConstraint
 * @constructor
 * @param object_a {RigidBody} first body
 * @param hinge_a {Vector3} hinge axis, in object_a's local space
 * @param point_a {Vector3} pivot point, in object_a's local space
 * @param object_b {RigidBody} second body, or null/undefined to hinge object_a to the world
 * @param point_b {Vector3} pivot point in object_b's local space (only used when object_b is set)
 */
Goblin.HingeConstraint = function( object_a, hinge_a, point_a, object_b, point_b ) {
	Goblin.Constraint.call( this );

	this.object_a = object_a;
	this.hinge_a = hinge_a;
	this.point_a = point_a;

	this.initial_quaternion = new Goblin.Quaternion();

	this.object_b = object_b || null;
	this.point_b = new Goblin.Vector3();
	this.hinge_b = new Goblin.Vector3();
	if ( this.object_b != null ) {
		this.object_a.rotation.transformVector3Into( this.hinge_a, this.hinge_b );
		_tmp_quat4_1.invertQuaternion( this.object_b.rotation );
		_tmp_quat4_1.transformVector3( this.hinge_b );

		this.point_b = point_b;

		this.initial_quaternion.multiplyQuaternions( _tmp_quat4_1, this.object_a.rotation );
	} else {
		this.object_a.updateDerived(); // Ensure the body's transform is correct
		this.object_a.rotation.transformVector3Into( this.hinge_a, this.hinge_b );
		this.object_a.transform.transformVector3Into( this.point_a, this.point_b );
		this.initial_quaternion.set( this.object_a.rotation.x, this.object_a.rotation.y, this.object_a.rotation.z, this.object_a.rotation.w );
	}

	this.erp = 0.1;

	// Create rows
	// rows 0,1,2 are the same as point constraint and constrain the objects' positions
	// rows 3,4 introduce the rotational constraints which constrains angular velocity orthogonal to the hinge axis
	for ( var i = 0; i < 5; i++ ) {
		this.rows[i] = Goblin.ConstraintRow.createConstraintRow();
	}
};
Goblin.HingeConstraint.prototype = Object.create( Goblin.Constraint.prototype );

function removeConstraintLimitRow( constraint ) {
	if ( constraint.limit.constraint_row != null ) {
		var row_idx = constraint.rows.indexOf(constraint.limit.constraint_row);
		constraint.rows.splice(row_idx, 1);
		constraint.limit.constraint_row = null;
	}
}

function removeConstraintMotorRow( constraint ) {
	if ( constraint.motor.constraint_row != null ) {
		var row_idx = constraint.rows.indexOf(constraint.motor.constraint_row);
		constraint.rows.splice(row_idx, 1);
		constraint.motor.constraint_row = null;
	}
}

/**
 * Adds or removes this hinge's limit row depending on whether the current swing angle about
 * `world_axis` violates `this.limit`. Lazily allocates the row on first violation and drops it once
 * the limit is no longer active, so an unlimited or currently-satisfied hinge costs nothing extra.
 *
 * @method updateLimits
 * @param world_axis {Vector3} the hinge axis, already transformed into world space
 * @param time_delta {Number} the step's time delta, in seconds
 */
Goblin.HingeConstraint.prototype.updateLimits = function( world_axis, time_delta ) {
	if ( this.limit.enabled === false ) {
		// remove existing `constraint_row` if it was previously set
		removeConstraintLimitRow( this );
		return;
	}

	var separating_angle, correction;

	if ( this.object_b == null ) {
		// this.initial_quaternion is the original rotation of object_a
		separating_angle = this.initial_quaternion.signedAngleBetween( this.object_a.rotation, world_axis );
	} else {
		// this.initial_quaternion is the original difference in rotation between object_a and object_b (A - B)
		_tmp_quat4_1.invertQuaternion( this.object_b.rotation );
		_tmp_quat4_1.multiply( this.object_a.rotation );

		separating_angle = this.initial_quaternion.signedAngleBetween( _tmp_quat4_1, world_axis );
	}

	if (
		( this.limit.limit_lower == null || this.limit.limit_lower < separating_angle ) &&
		( this.limit.limit_upper == null || this.limit.limit_upper > separating_angle )
	) {
		// there limit is not violated, ignore
		removeConstraintLimitRow( this );
		return;
	}

	if ( this.limit.limit_lower != null && separating_angle <= this.limit.limit_lower ) {
		if ( this.limit.constraint_row == null ) {
			this.limit.createConstraintRow();
			this.limit.constraint_row.upper_limit = 0;
			this.rows.push( this.limit.constraint_row );
		}
		this.limit.constraint_row.jacobian[3] = -world_axis.x;
		this.limit.constraint_row.jacobian[4] = -world_axis.y;
		this.limit.constraint_row.jacobian[5] = -world_axis.z;

		if ( this.object_b != null ) {
			this.limit.constraint_row.jacobian[9] = world_axis.x;
			this.limit.constraint_row.jacobian[10] = world_axis.y;
			this.limit.constraint_row.jacobian[11] = world_axis.z;
		}

		correction = separating_angle - this.limit.limit_lower;
		this.limit.constraint_row.bias = correction * this.limit.erp / time_delta;
	} else if ( this.limit.limit_upper != null && separating_angle >= this.limit.limit_upper ) {
		if ( this.limit.constraint_row == null ) {
			this.limit.createConstraintRow();
			this.limit.constraint_row.lower_limit = 0;
			this.rows.push( this.limit.constraint_row );
		}
		this.limit.constraint_row.jacobian[3] = -world_axis.x;
		this.limit.constraint_row.jacobian[4] = -world_axis.y;
		this.limit.constraint_row.jacobian[5] = -world_axis.z;

		if ( this.object_b != null ) {
			this.limit.constraint_row.jacobian[9] = world_axis.x;
			this.limit.constraint_row.jacobian[10] = world_axis.y;
			this.limit.constraint_row.jacobian[11] = world_axis.z;
		}

		correction = separating_angle - this.limit.limit_upper;
		this.limit.constraint_row.bias = correction * this.limit.erp / time_delta;
	}
};

/**
 * Adds or removes this hinge's motor row depending on whether `this.motor` is enabled, and (when
 * enabled) updates its target speed and torque limit for this step.
 *
 * @method updateMotor
 * @param world_axis {Vector3} the hinge axis, already transformed into world space
 */
Goblin.HingeConstraint.prototype.updateMotor = function( world_axis ) {
	if ( this.motor.enabled === false ) {
		removeConstraintMotorRow( this );
		return;
	}

	if ( this.motor.constraint_row == null ) {
		this.motor.createConstraintRow();
		this.rows.push( this.motor.constraint_row );
		this.motor.constraint_row.jacobian[3] = world_axis.x;
		this.motor.constraint_row.jacobian[4] = world_axis.y;
		this.motor.constraint_row.jacobian[5] = world_axis.z;

		if ( this.object_b != null ) {
			this.motor.constraint_row.jacobian[9] = -world_axis.x;
			this.motor.constraint_row.jacobian[10] = -world_axis.y;
			this.motor.constraint_row.jacobian[11] = -world_axis.z;
		}
	}

	this.motor.constraint_row.bias = this.motor.max_speed;
	if ( this.motor.max_speed >= 0 ) {
		this.motor.constraint_row.lower_limit = 0;
		this.motor.constraint_row.upper_limit = this.motor.torque;
	} else {
		this.motor.constraint_row.lower_limit = -this.motor.torque;
		this.motor.constraint_row.upper_limit = 0;
	}
};

/**
 * Recomputes the hinge's rows from current body state: the 3 positional rows and 2 rotational rows
 * described in the constructor, plus their bias terms for positional/angular error correction, and
 * then delegates to `updateLimits`/`updateMotor` for the optional limit/motor rows.
 *
 * @method update
 * @param time_delta {Number} the step's time delta, in seconds
 */
Goblin.HingeConstraint.prototype.update = (function(){
	var r1 = new Goblin.Vector3(),
		r2 = new Goblin.Vector3(),
		t1 = new Goblin.Vector3(),
		t2 = new Goblin.Vector3(),
		world_axis = new Goblin.Vector3();

	return function( time_delta ) {
		this.object_a.rotation.transformVector3Into( this.hinge_a, world_axis );

		this.object_a.transform.transformVector3Into( this.point_a, _tmp_vec3_1 );
		r1.subtractVectors( _tmp_vec3_1, this.object_a.position );

		// 0,1,2 are positional, same as PointConstraint
		this.rows[0].jacobian[0] = -1;
		this.rows[0].jacobian[1] = 0;
		this.rows[0].jacobian[2] = 0;
		this.rows[0].jacobian[3] = 0;
		this.rows[0].jacobian[4] = -r1.z;
		this.rows[0].jacobian[5] = r1.y;

		this.rows[1].jacobian[0] = 0;
		this.rows[1].jacobian[1] = -1;
		this.rows[1].jacobian[2] = 0;
		this.rows[1].jacobian[3] = r1.z;
		this.rows[1].jacobian[4] = 0;
		this.rows[1].jacobian[5] = -r1.x;

		this.rows[2].jacobian[0] = 0;
		this.rows[2].jacobian[1] = 0;
		this.rows[2].jacobian[2] = -1;
		this.rows[2].jacobian[3] = -r1.y;
		this.rows[2].jacobian[4] = r1.x;
		this.rows[2].jacobian[5] = 0;

		// 3,4 are rotational, constraining motion orthogonal to axis
		world_axis.findOrthogonal( t1, t2 );
		this.rows[3].jacobian[3] = -t1.x;
		this.rows[3].jacobian[4] = -t1.y;
		this.rows[3].jacobian[5] = -t1.z;

		this.rows[4].jacobian[3] = -t2.x;
		this.rows[4].jacobian[4] = -t2.y;
		this.rows[4].jacobian[5] = -t2.z;

		if ( this.object_b != null ) {
			this.object_b.transform.transformVector3Into( this.point_b, _tmp_vec3_2 );
			r2.subtractVectors( _tmp_vec3_2, this.object_b.position );

			// 0,1,2 are positional, same as PointConstraint
			this.rows[0].jacobian[6] = 1;
			this.rows[0].jacobian[7] = 0;
			this.rows[0].jacobian[8] = 0;
			this.rows[0].jacobian[9] = 0;
			this.rows[0].jacobian[10] = r2.z;
			this.rows[0].jacobian[11] = -r2.y;

			this.rows[1].jacobian[6] = 0;
			this.rows[1].jacobian[7] = 1;
			this.rows[1].jacobian[8] = 0;
			this.rows[1].jacobian[9] = -r2.z;
			this.rows[1].jacobian[10] = 0;
			this.rows[1].jacobian[11] = r2.x;

			this.rows[2].jacobian[6] = 0;
			this.rows[2].jacobian[7] = 0;
			this.rows[2].jacobian[8] = 1;
			this.rows[2].jacobian[9] = r2.y;
			this.rows[2].jacobian[10] = -r2.z;
			this.rows[2].jacobian[11] = 0;

			// 3,4 are rotational, constraining motion orthogonal to axis
			this.rows[3].jacobian[9] = t1.x;
			this.rows[3].jacobian[10] = t1.y;
			this.rows[3].jacobian[11] = t1.z;

			this.rows[4].jacobian[9] = t2.x;
			this.rows[4].jacobian[10] = t2.y;
			this.rows[4].jacobian[11] = t2.z;
		} else {
			_tmp_vec3_2.copy( this.point_b );
		}

		// Linear error correction
		_tmp_vec3_3.subtractVectors( _tmp_vec3_1, _tmp_vec3_2 );
		_tmp_vec3_3.scale( this.erp / time_delta );
		this.rows[0].bias = _tmp_vec3_3.x;
		this.rows[1].bias = _tmp_vec3_3.y;
		this.rows[2].bias = _tmp_vec3_3.z;

		// Angular error correction
		if (this.object_b != null) {
			this.object_a.rotation.transformVector3Into(this.hinge_a, _tmp_vec3_1);
			this.object_b.rotation.transformVector3Into(this.hinge_b, _tmp_vec3_2);
			_tmp_vec3_1.cross(_tmp_vec3_2);
			this.rows[3].bias = -_tmp_vec3_1.dot(t1) * this.erp / time_delta;
			this.rows[4].bias = -_tmp_vec3_1.dot(t2) * this.erp / time_delta;
		} else {
			this.rows[3].bias = this.rows[4].bias = 0;
		}

		// limits & motor
		this.updateLimits( world_axis, time_delta );
		this.updateMotor( world_axis );
	};
})( );
/**
 * Constrains a point on one body (or one body and a fixed world point) to coincide with a point on
 * another - a ball-and-socket joint. Three rows lock relative linear velocity at the pivot; no
 * rotational constraint, so both bodies remain free to rotate about the shared point.
 *
 * @class PointConstraint
 * @constructor
 * @param object_a {RigidBody} first body
 * @param point_a {Vector3} pivot point, in object_a's local space
 * @param object_b {RigidBody} second body, or null/undefined to anchor object_a to a fixed world point
 * @param point_b {Vector3} pivot point in object_b's local space (only used when object_b is set)
 */
Goblin.PointConstraint = function( object_a, point_a, object_b, point_b ) {
	Goblin.Constraint.call( this );

	this.object_a = object_a;
	this.point_a = point_a;

	this.object_b = object_b || null;
	if ( this.object_b != null ) {
		this.point_b = point_b;
	} else {
		this.point_b = new Goblin.Vector3();
		this.object_a.updateDerived(); // Ensure the body's transform is correct
		this.object_a.transform.transformVector3Into( this.point_a, this.point_b );
	}

	this.erp = 0.1;

	// Create rows
	for ( var i = 0; i < 3; i++ ) {
		this.rows[i] = Goblin.ObjectPool.getObject( 'ConstraintRow' );
		this.rows[i].lower_limit = -Infinity;
		this.rows[i].upper_limit = Infinity;
		this.rows[i].bias = 0;

		this.rows[i].jacobian[6] = this.rows[i].jacobian[7] = this.rows[i].jacobian[8] =
			this.rows[i].jacobian[9] = this.rows[i].jacobian[10] = this.rows[i].jacobian[11] = 0;
	}
};
Goblin.PointConstraint.prototype = Object.create( Goblin.Constraint.prototype );

/**
 * Recomputes the three positional rows from current body state, plus their bias terms driving the
 * two pivot points back together at rate `erp / time_delta`.
 *
 * @method update
 * @param time_delta {Number} the step's time delta, in seconds
 */
Goblin.PointConstraint.prototype.update = (function(){
	var r1 = new Goblin.Vector3(),
		r2 = new Goblin.Vector3();

	return function( time_delta ) {
		this.object_a.transform.transformVector3Into( this.point_a, _tmp_vec3_1 );
		r1.subtractVectors( _tmp_vec3_1, this.object_a.position );

		this.rows[0].jacobian[0] = -1;
		this.rows[0].jacobian[1] = 0;
		this.rows[0].jacobian[2] = 0;
		this.rows[0].jacobian[3] = 0;
		this.rows[0].jacobian[4] = -r1.z;
		this.rows[0].jacobian[5] = r1.y;

		this.rows[1].jacobian[0] = 0;
		this.rows[1].jacobian[1] = -1;
		this.rows[1].jacobian[2] = 0;
		this.rows[1].jacobian[3] = r1.z;
		this.rows[1].jacobian[4] = 0;
		this.rows[1].jacobian[5] = -r1.x;

		this.rows[2].jacobian[0] = 0;
		this.rows[2].jacobian[1] = 0;
		this.rows[2].jacobian[2] = -1;
		this.rows[2].jacobian[3] = -r1.y;
		this.rows[2].jacobian[4] = r1.x;
		this.rows[2].jacobian[5] = 0;

		if ( this.object_b != null ) {
			this.object_b.transform.transformVector3Into( this.point_b, _tmp_vec3_2 );
			r2.subtractVectors( _tmp_vec3_2, this.object_b.position );

			this.rows[0].jacobian[6] = 1;
			this.rows[0].jacobian[7] = 0;
			this.rows[0].jacobian[8] = 0;
			this.rows[0].jacobian[9] = 0;
			this.rows[0].jacobian[10] = r2.z;
			this.rows[0].jacobian[11] = -r2.y;

			this.rows[1].jacobian[6] = 0;
			this.rows[1].jacobian[7] = 1;
			this.rows[1].jacobian[8] = 0;
			this.rows[1].jacobian[9] = -r2.z;
			this.rows[1].jacobian[10] = 0;
			this.rows[1].jacobian[11] = r2.x;

			this.rows[2].jacobian[6] = 0;
			this.rows[2].jacobian[7] = 0;
			this.rows[2].jacobian[8] = 1;
			this.rows[2].jacobian[9] = r2.y;
			this.rows[2].jacobian[10] = -r2.x;
			this.rows[2].jacobian[11] = 0;
		} else {
			_tmp_vec3_2.copy( this.point_b );
		}

		_tmp_vec3_3.subtractVectors( _tmp_vec3_1, _tmp_vec3_2 );
		_tmp_vec3_3.scale( this.erp / time_delta );
		this.rows[0].bias = _tmp_vec3_3.x;
		this.rows[1].bias = _tmp_vec3_3.y;
		this.rows[2].bias = _tmp_vec3_3.z;
	};
})( );

/**
 * Constrains two bodies to slide relative to each other only along a shared axis, like a piston:
 * two rows lock relative linear velocity orthogonal to the axis (leaving motion along it free),
 * three more lock relative rotation entirely. Note: the rotational rows' `bias` (position-error
 * correction for accumulated angular drift) is computed in `_updateAngularConstraints` but
 * currently commented out before being assigned, so rotation is velocity-constrained but not
 * drift-corrected; only the two linear rows get bias-driven error correction.
 *
 * @class SliderConstraint
 * @constructor
 * @param object_a {RigidBody} first body
 * @param axis {Vector3} slide axis, in object_a's local space
 * @param object_b {RigidBody} second body
 */
Goblin.SliderConstraint = function( object_a, axis, object_b ) {
	Goblin.Constraint.call( this );

	this.object_a = object_a;
	this.axis = axis;
	this.object_b = object_b;

	// Find the initial distance between the two objects in object_a's local frame
	this.position_error = new Goblin.Vector3();
	this.position_error.subtractVectors( this.object_b.position, this.object_a.position );
	_tmp_quat4_1.invertQuaternion( this.object_a.rotation );
	_tmp_quat4_1.transformVector3( this.position_error );

	this.rotation_difference = new Goblin.Quaternion();
	if ( this.object_b != null ) {
		_tmp_quat4_1.invertQuaternion( this.object_b.rotation );
		this.rotation_difference.multiplyQuaternions( _tmp_quat4_1, this.object_a.rotation );
	}

	this.erp = 0.1;

	// First two rows constrain the linear velocities orthogonal to `axis`
	// Rows three through five constrain angular velocities
	for ( var i = 0; i < 5; i++ ) {
		this.rows[i] = Goblin.ObjectPool.getObject( 'ConstraintRow' );
		this.rows[i].lower_limit = -Infinity;
		this.rows[i].upper_limit = Infinity;
		this.rows[i].bias = 0;

		this.rows[i].jacobian[0] = this.rows[i].jacobian[1] = this.rows[i].jacobian[2] =
			this.rows[i].jacobian[3] = this.rows[i].jacobian[4] = this.rows[i].jacobian[5] =
			this.rows[i].jacobian[6] = this.rows[i].jacobian[7] = this.rows[i].jacobian[8] =
			this.rows[i].jacobian[9] = this.rows[i].jacobian[10] = this.rows[i].jacobian[11] = 0;
	}
};
Goblin.SliderConstraint.prototype = Object.create( Goblin.Constraint.prototype );

/**
 * Recomputes all five rows from current body state by delegating to
 * `_updateLinearConstraints`/`_updateAngularConstraints`.
 *
 * @method update
 * @param time_delta {Number} the step's time delta, in seconds
 */
Goblin.SliderConstraint.prototype.update = (function(){
	var _axis = new Goblin.Vector3(),
		n1 = new Goblin.Vector3(),
		n2 = new Goblin.Vector3();

	return function( time_delta ) {
		// `axis` is in object_a's local frame, convert to world
		this.object_a.rotation.transformVector3Into( this.axis, _axis );

		// Find two vectors that are orthogonal to `axis`
		_axis.findOrthogonal( n1, n2 );

		this._updateLinearConstraints( time_delta, n1, n2 );
		this._updateAngularConstraints( time_delta, n1, n2 );
	};
})();

/**
 * Recomputes the two linear rows constraining relative velocity orthogonal to the slide axis
 * (`n1`/`n2`), plus their bias terms driving accumulated off-axis position error back to zero.
 *
 * @method _updateLinearConstraints
 * @param time_delta {Number} the step's time delta, in seconds
 * @param n1 {Vector3} first world-space axis orthogonal to the slide axis
 * @param n2 {Vector3} second world-space axis orthogonal to the slide axis (and to n1)
 * @private
 */
Goblin.SliderConstraint.prototype._updateLinearConstraints = function( time_delta, n1, n2 ) {
	var c = new Goblin.Vector3();
	c.subtractVectors( this.object_b.position, this.object_a.position );
	//c.scale( 0.5 );

	var cx = new Goblin.Vector3( );

	// first linear constraint
	cx.crossVectors( c, n1 );
	this.rows[0].jacobian[0] = -n1.x;
	this.rows[0].jacobian[1] = -n1.y;
	this.rows[0].jacobian[2] = -n1.z;
	//this.rows[0].jacobian[3] = -cx[0];
	//this.rows[0].jacobian[4] = -cx[1];
	//this.rows[0].jacobian[5] = -cx[2];

	this.rows[0].jacobian[6] = n1.x;
	this.rows[0].jacobian[7] = n1.y;
	this.rows[0].jacobian[8] = n1.z;
	this.rows[0].jacobian[9] = 0;
	this.rows[0].jacobian[10] = 0;
	this.rows[0].jacobian[11] = 0;

	// second linear constraint
	cx.crossVectors( c, n2 );
	this.rows[1].jacobian[0] = -n2.x;
	this.rows[1].jacobian[1] = -n2.y;
	this.rows[1].jacobian[2] = -n2.z;
	//this.rows[1].jacobian[3] = -cx[0];
	//this.rows[1].jacobian[4] = -cx[1];
	//this.rows[1].jacobian[5] = -cx[2];

	this.rows[1].jacobian[6] = n2.x;
	this.rows[1].jacobian[7] = n2.y;
	this.rows[1].jacobian[8] = n2.z;
	this.rows[1].jacobian[9] = 0;
	this.rows[1].jacobian[10] = 0;
	this.rows[1].jacobian[11] = 0;

	// linear constraint error
	//c.scale( 2  );
	this.object_a.rotation.transformVector3Into( this.position_error, _tmp_vec3_1 );
	_tmp_vec3_2.subtractVectors( c, _tmp_vec3_1 );
	_tmp_vec3_2.scale( this.erp / time_delta  );
	this.rows[0].bias = -n1.dot( _tmp_vec3_2 );
	this.rows[1].bias = -n2.dot( _tmp_vec3_2 );
};

/**
 * Recomputes the three rotational rows locking relative rotation entirely. Also computes the
 * rotational drift `error` but does not currently assign it to the rows' `bias` (see the class
 * doc) - this method locks rotational velocity but does not correct accumulated angular drift.
 *
 * @method _updateAngularConstraints
 * @param time_delta {Number} the step's time delta, in seconds
 * @param n1 {Vector3} first world-space axis orthogonal to the slide axis (unused directly here)
 * @param n2 {Vector3} second world-space axis orthogonal to the slide axis (unused directly here)
 * @private
 */
Goblin.SliderConstraint.prototype._updateAngularConstraints = function( time_delta, n1, n2, axis ) {
	this.rows[2].jacobian[3] = this.rows[3].jacobian[4] = this.rows[4].jacobian[5] = -1;
	this.rows[2].jacobian[9] = this.rows[3].jacobian[10] = this.rows[4].jacobian[11] = 1;

	_tmp_quat4_1.invertQuaternion( this.object_b.rotation );
	_tmp_quat4_1.multiply( this.object_a.rotation );

	_tmp_quat4_2.invertQuaternion( this.rotation_difference );
	_tmp_quat4_2.multiply( _tmp_quat4_1 );
	// _tmp_quat4_2 is now the rotational error that needs to be corrected

	var error = new Goblin.Vector3();
	error.x = _tmp_quat4_2.x;
	error.y = _tmp_quat4_2.y;
	error.z = _tmp_quat4_2.z;
	error.scale( this.erp / time_delta  );

	//this.rows[2].bias = error[0];
	//this.rows[3].bias = error[1];
	//this.rows[4].bias = error[2];
};
/**
 * Rigidly fuses two bodies together at a shared point (or fixes one body in place relative to the
 * world): three rows lock relative linear velocity at the point, three more lock relative angular
 * velocity entirely, so the pair moves as if welded.
 *
 * @class WeldConstraint
 * @constructor
 * @param object_a {RigidBody} first body
 * @param point_a {Vector3} weld point, in object_a's local space
 * @param object_b {RigidBody} second body, or null/undefined to weld object_a fixed to the world
 * @param point_b {Vector3} weld point in object_b's local space (only used when object_b is set)
 */
Goblin.WeldConstraint = function( object_a, point_a, object_b, point_b ) {
	Goblin.Constraint.call( this );

	this.object_a = object_a;
	this.point_a = point_a;

	this.object_b = object_b || null;
	this.point_b = point_b || null;

	this.rotation_difference = new Goblin.Quaternion();
	if ( this.object_b != null ) {
		_tmp_quat4_1.invertQuaternion( this.object_b.rotation );
		this.rotation_difference.multiplyQuaternions( _tmp_quat4_1, this.object_a.rotation );
	}

	this.erp = 0.1;

	// Create translation constraint rows
	for ( var i = 0; i < 3; i++ ) {
		this.rows[i] = Goblin.ObjectPool.getObject( 'ConstraintRow' );
		this.rows[i].lower_limit = -Infinity;
		this.rows[i].upper_limit = Infinity;
		this.rows[i].bias = 0;

		if ( this.object_b == null ) {
			this.rows[i].jacobian[0] = this.rows[i].jacobian[1] = this.rows[i].jacobian[2] =
				this.rows[i].jacobian[4] = this.rows[i].jacobian[5] = this.rows[i].jacobian[6] =
				this.rows[i].jacobian[7] = this.rows[i].jacobian[8] = this.rows[i].jacobian[9] =
				this.rows[i].jacobian[10] = this.rows[i].jacobian[11] = this.rows[i].jacobian[12] = 0;
			this.rows[i].jacobian[i] = 1;
		}
	}

	// Create rotation constraint rows
	for ( i = 3; i < 6; i++ ) {
		this.rows[i] = Goblin.ObjectPool.getObject( 'ConstraintRow' );
		this.rows[i].lower_limit = -Infinity;
		this.rows[i].upper_limit = Infinity;
		this.rows[i].bias = 0;

		if ( this.object_b == null ) {
			this.rows[i].jacobian[0] = this.rows[i].jacobian[1] = this.rows[i].jacobian[2] =
				this.rows[i].jacobian[4] = this.rows[i].jacobian[5] = this.rows[i].jacobian[6] =
				this.rows[i].jacobian[7] = this.rows[i].jacobian[8] = this.rows[i].jacobian[9] =
				this.rows[i].jacobian[10] = this.rows[i].jacobian[11] = this.rows[i].jacobian[12] = 0;
			this.rows[i].jacobian[i] = 1;
		} else {
			this.rows[i].jacobian[0] = this.rows[i].jacobian[1] = this.rows[i].jacobian[2] = 0;
			this.rows[i].jacobian[3] = this.rows[i].jacobian[4] = this.rows[i].jacobian[5] = 0;
			this.rows[i].jacobian[ i ] = -1;

			this.rows[i].jacobian[6] = this.rows[i].jacobian[7] = this.rows[i].jacobian[8] = 0;
			this.rows[i].jacobian[9] = this.rows[i].jacobian[10] = this.rows[i].jacobian[11] = 0;
			this.rows[i].jacobian[ i + 6 ] = 1;
		}
	}
};
Goblin.WeldConstraint.prototype = Object.create( Goblin.Constraint.prototype );

/**
 * Recomputes all six rows from current body state, plus bias terms driving both accumulated
 * positional and rotational error back to zero at rate `erp / time_delta`. No-op when object_b is
 * null: a world-welded body's rows are set once in the constructor and never need updating.
 *
 * @method update
 * @param time_delta {Number} the step's time delta, in seconds
 */
Goblin.WeldConstraint.prototype.update = (function(){
	var r1 = new Goblin.Vector3(),
		r2 = new Goblin.Vector3();

	return function( time_delta ) {
		if ( this.object_b == null ) {
			// No need to update the constraint, all motion is already constrained
			return;
		}

		this.object_a.transform.transformVector3Into( this.point_a, _tmp_vec3_1 );
		r1.subtractVectors( _tmp_vec3_1, this.object_a.position );

		this.rows[0].jacobian[0] = -1;
		this.rows[0].jacobian[1] = 0;
		this.rows[0].jacobian[2] = 0;
		this.rows[0].jacobian[3] = 0;
		this.rows[0].jacobian[4] = -r1.z;
		this.rows[0].jacobian[5] = r1.y;

		this.rows[1].jacobian[0] = 0;
		this.rows[1].jacobian[1] = -1;
		this.rows[1].jacobian[2] = 0;
		this.rows[1].jacobian[3] = r1.z;
		this.rows[1].jacobian[4] = 0;
		this.rows[1].jacobian[5] = -r1.x;

		this.rows[2].jacobian[0] = 0;
		this.rows[2].jacobian[1] = 0;
		this.rows[2].jacobian[2] = -1;
		this.rows[2].jacobian[3] = -r1.y;
		this.rows[2].jacobian[4] = r1.x;
		this.rows[2].jacobian[5] = 0;

		if ( this.object_b != null ) {
			this.object_b.transform.transformVector3Into( this.point_b, _tmp_vec3_2 );
			r2.subtractVectors( _tmp_vec3_2, this.object_b.position );

			this.rows[0].jacobian[6] = 1;
			this.rows[0].jacobian[7] = 0;
			this.rows[0].jacobian[8] = 0;
			this.rows[0].jacobian[9] = 0;
			this.rows[0].jacobian[10] = r2.z;
			this.rows[0].jacobian[11] = -r2.y;

			this.rows[1].jacobian[6] = 0;
			this.rows[1].jacobian[7] = 1;
			this.rows[1].jacobian[8] = 0;
			this.rows[1].jacobian[9] = -r2.z;
			this.rows[1].jacobian[10] = 0;
			this.rows[1].jacobian[11] = r2.x;

			this.rows[2].jacobian[6] = 0;
			this.rows[2].jacobian[7] = 0;
			this.rows[2].jacobian[8] = 1;
			this.rows[2].jacobian[9] = r2.y;
			this.rows[2].jacobian[10] = -r2.x;
			this.rows[2].jacobian[11] = 0;
		} else {
			_tmp_vec3_2.copy( this.point_b );
		}

		var error = new Goblin.Vector3();

		// Linear correction
		error.subtractVectors( _tmp_vec3_1, _tmp_vec3_2 );
		error.scale( this.erp / time_delta  );
		this.rows[0].bias = error.x;
		this.rows[1].bias = error.y;
		this.rows[2].bias = error.z;

		// Rotation correction
		_tmp_quat4_1.invertQuaternion( this.object_b.rotation );
		_tmp_quat4_1.multiply( this.object_a.rotation );

		_tmp_quat4_2.invertQuaternion( this.rotation_difference );
		_tmp_quat4_2.multiply( _tmp_quat4_1 );
		// _tmp_quat4_2 is now the rotational error that needs to be corrected

		error.x = _tmp_quat4_2.x;
		error.y = _tmp_quat4_2.y;
		error.z = _tmp_quat4_2.z;
		error.scale( this.erp / time_delta );

		this.rows[3].bias = error.x;
		this.rows[4].bias = error.y;
		this.rows[5].bias = error.z;
	};
})( );
/**
* adds a drag force to associated objects
*
* @class DragForce
* @extends ForceGenerator
* @constructor
*/
Goblin.DragForce = function( drag_coefficient, squared_drag_coefficient ) {
	/**
	* drag coefficient
	*
	* @property drag_coefficient
	* @type {Number}
	* @default 0
	*/
	this.drag_coefficient = drag_coefficient || 0;

	/**
	* drag coefficient
	*
	* @property drag_coefficient
	* @type {Number}
	* @default 0
	*/
	this.squared_drag_coefficient = squared_drag_coefficient || 0;

	/**
	* whether or not the force generator is enabled
	*
	* @property enabled
	* @type {Boolean}
	* @default true
	*/
	this.enabled = true;

	/**
	* array of objects affected by the generator
	*
	* @property affected
	* @type {Array}
	* @default []
	* @private
	*/
	this.affected = [];
};
Goblin.DragForce.prototype.enable = Goblin.ForceGenerator.prototype.enable;
Goblin.DragForce.prototype.disable = Goblin.ForceGenerator.prototype.disable;
Goblin.DragForce.prototype.affect = Goblin.ForceGenerator.prototype.affect;
Goblin.DragForce.prototype.unaffect = Goblin.ForceGenerator.prototype.unaffect;
/**
* applies force to the associated objects
*
* @method applyForce
*/
Goblin.DragForce.prototype.applyForce = function() {
	if ( !this.enabled ) {
		return;
	}

	var i, affected_count, object, drag,
		force = _tmp_vec3_1;

	for ( i = 0, affected_count = this.affected.length; i < affected_count; i++ ) {
		object = this.affected[i];

		force.copy( object.linear_velocity );

		// Calculate the total drag coefficient.
		drag = force.length();
		drag = ( this.drag_coefficient * drag ) + ( this.squared_drag_coefficient * drag * drag );

		// Calculate the final force and apply it.
		force.normalize();
		force.scale( -drag );
		object.applyForce( force  );
	}
};
Goblin.RayIntersection = function() {
	this.object = null;
	this.point = new Goblin.Vector3();
	this.t = null;
    this.normal = new Goblin.Vector3();
};
/**
 * Extends a given shape by sweeping a line around it
 *
 * @class LineSweptShape
 * @param start {Vector3} starting point of the line
 * @param end {Vector3} line's end point
 * @param shape any Goblin shape object
 * @constructor
 */
Goblin.LineSweptShape = function( start, end, shape ) {
	/**
	 * starting point of the line
	 *
	 * @property start
	 * @type {Vector3}
	 */
	this.start = start;

	/**
	 * line's end point
	 *
	 * @property end
	 * @type {Vector3}
	 */
	this.end = end;

	/**
	 * shape being swept
	 *
	 * @property shape
	 */
	this.shape = shape;

	/**
	 * unit direction of the line
	 *
	 * @property direction
	 * @type {Vector3}
	 */
	this.direction = new Goblin.Vector3();
	this.direction.subtractVectors( end, start );

	/**
	 * length of the line
	 *
	 * @property length
	 * @type {Number}
	 */
	this.length = this.direction.length();
	this.direction.normalize();

	/**
	 * axis-aligned bounding box of this shape
	 *
	 * @property aabb
	 * @type {AABB}
	 */
	this.aabb = new Goblin.AABB();
	this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.LineSweptShape.prototype.calculateLocalAABB = function( aabb ) {
	this.shape.calculateLocalAABB( aabb );

	aabb.min.x = Math.min( aabb.min.x + this.start.x, aabb.min.x + this.end.x );
	aabb.min.y = Math.min( aabb.min.y + this.start.y, aabb.min.y + this.end.y );
	aabb.min.z = Math.min( aabb.min.z + this.start.z, aabb.min.z + this.end.z );

	aabb.max.x = Math.max( aabb.max.x + this.start.x, aabb.max.x + this.end.x );
	aabb.max.y = Math.max( aabb.max.y + this.start.y, aabb.max.y + this.end.y );
	aabb.max.z = Math.max( aabb.max.z + this.start.z, aabb.max.z + this.end.z );
};

Goblin.LineSweptShape.prototype.getInertiaTensor = function( mass ) {
	// this is wrong, but currently not used for anything
	return this.shape.getInertiaTensor( mass );
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.LineSweptShape.prototype.findSupportPoint = function( direction, support_point ) {
	this.shape.findSupportPoint( direction, support_point );

	// Add whichever point of this line lies in `direction`
	var dot = this.direction.dot( direction );

	if ( dot < 0 ) {
		support_point.add( this.start );
	} else {
		support_point.add( this.end );
	}
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3} end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.LineSweptShape.prototype.rayIntersect = function(){
	return null;
};
/**
 * @class BoxShape
 * @param half_width {Number} half width of the cube ( X axis )
 * @param half_height {Number} half height of the cube ( Y axis )
 * @param half_depth {Number} half depth of the cube ( Z axis )
 * @constructor
 */
Goblin.BoxShape = function( half_width, half_height, half_depth ) {
	/**
	 * Half width of the cube ( X axis )
	 *
	 * @property half_width
	 * @type {Number}
	 */
	this.half_width = half_width;

	/**
	 * Half height of the cube ( Y axis )
	 *
	 * @property half_height
	 * @type {Number}
	 */
	this.half_height = half_height;

	/**
	 * Half width of the cube ( Z axis )
	 *
	 * @property half_height
	 * @type {Number}
	 */
	this.half_depth = half_depth;

    this.aabb = new Goblin.AABB();
    this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.BoxShape.prototype.calculateLocalAABB = function( aabb ) {
    aabb.min.x = -this.half_width;
    aabb.min.y = -this.half_height;
    aabb.min.z = -this.half_depth;

    aabb.max.x = this.half_width;
    aabb.max.y = this.half_height;
    aabb.max.z = this.half_depth;
};

Goblin.BoxShape.prototype.getInertiaTensor = function( mass ) {
	var height_squared = this.half_height * this.half_height * 4,
		width_squared = this.half_width * this.half_width * 4,
		depth_squared = this.half_depth * this.half_depth * 4,
		element = 0.0833 * mass;
	return new Goblin.Matrix3(
		element * ( height_squared + depth_squared ), 0, 0,
		0, element * ( width_squared + depth_squared ), 0,
		0, 0, element * ( height_squared + width_squared )
	);
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.BoxShape.prototype.findSupportPoint = function( direction, support_point ) {
	/*
	support_point = [
		sign( direction.x ) * half_width,
		sign( direction.y ) * half_height,
		sign( direction.z ) * half_depth
	]
	*/

	// Calculate the support point in the local frame
	if ( direction.x < 0 ) {
		support_point.x = -this.half_width;
	} else {
		support_point.x = this.half_width;
	}

	if ( direction.y < 0 ) {
		support_point.y = -this.half_height;
	} else {
		support_point.y = this.half_height;
	}

	if ( direction.z < 0 ) {
		support_point.z = -this.half_depth;
	} else {
		support_point.z = this.half_depth;
	}
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3} end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.BoxShape.prototype.rayIntersect = (function(){
	var direction = new Goblin.Vector3(),
		tmin, tmax,
		axis, ood, t1, t2, extent;

	return function( start, end ) {
		tmin = 0;

		direction.subtractVectors( end, start );
		tmax = direction.length();
		direction.scale( 1 / tmax ); // normalize direction

		for ( var i = 0; i < 3; i++ ) {
			axis = i === 0 ? 'x' : ( i === 1 ? 'y' : 'z' );
			extent = ( i === 0 ? this.half_width : (  i === 1 ? this.half_height : this.half_depth ) );

			if ( Math.abs( direction[axis] ) < Goblin.EPSILON ) {
				// Ray is parallel to axis
				if ( start[axis] < -extent || start[axis] > extent ) {
					return null;
				}
			}

            ood = 1 / direction[axis];
            t1 = ( -extent - start[axis] ) * ood;
            t2 = ( extent - start[axis] ) * ood;
            if ( t1 > t2  ) {
                ood = t1; // ood is a convenient temp variable as it's not used again
                t1 = t2;
                t2 = ood;
            }

            // Find intersection intervals
            tmin = Math.max( tmin, t1 );
            tmax = Math.min( tmax, t2 );

            if ( tmin > tmax ) {
                return null;
            }
		}

		var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
		intersection.object = this;
		intersection.t = tmin;
		intersection.point.scaleVector( direction, tmin );
		intersection.point.add( start );

		// Find face normal
        var max = Infinity;
		for ( i = 0; i < 3; i++ ) {
			axis = i === 0 ? 'x' : ( i === 1 ? 'y' : 'z' );
			extent = ( i === 0 ? this.half_width : (  i === 1 ? this.half_height : this.half_depth ) );
			if ( extent - Math.abs( intersection.point[axis] ) < max ) {
				intersection.normal.x = intersection.normal.y = intersection.normal.z = 0;
				intersection.normal[axis] = intersection.point[axis] < 0 ? -1 : 1;
				max = extent - Math.abs( intersection.point[axis] );
			}
		}

		return intersection;
	};
})();
/**
 * A capsule shape consisting of a cylinder with hemispheres at both ends
 * 
 * @class CapsuleShape
 * @param radius {Number} radius of both the cylinder portion and hemisphere caps
 * @param total_height {Number} total height of the capsule including both hemisphere caps
 * @constructor
 */
Goblin.CapsuleShape = function(radius, total_height) {
    /**
     * radius of both the cylinder and hemisphere caps
     * 
     * @property radius
     * @type {Number}
     */
    this.radius = radius;

    /**
     * total height of the capsule including hemisphere caps
     * 
     * @property total_height
     * @type {Number}
     */
    this.total_height = total_height;

    /**
     * half of the total capsule height
     * 
     * @property half_height
     * @type {Number}
     */
    this.half_height = total_height * 0.5;

    /**
     * height of just the cylinder portion (excluding hemispheres)
     * 
     * @property cylinder_height
     * @type {Number}
     */
    this.cylinder_height = total_height - (2 * radius);

    /**
     * half height of just the cylinder portion
     * 
     * @property cylinder_half_height
     * @type {Number}
     */
    this.cylinder_half_height = this.cylinder_height * 0.5;

    // Validate the shape is possible
    if (this.cylinder_height < 0) {
        throw new Error("Total height must be greater than 2 * radius");
    }

    this.aabb = new Goblin.AABB();
    this.calculateLocalAABB(this.aabb);
};

/**
 * Calculates this shape's local AABB (Axis-Aligned Bounding Box) and stores it in the passed AABB object
 * 
 * @method calculateLocalAABB
 * @param aabb {AABB} AABB object to store the results
 */
Goblin.CapsuleShape.prototype.calculateLocalAABB = function(aabb) {
    aabb.min.x = aabb.min.z = -this.radius;
    aabb.min.y = -this.half_height;

    aabb.max.x = aabb.max.z = this.radius;
    aabb.max.y = this.half_height;
};

/**
 * Returns this shape's local-space "rest axis" - the line along which its barrel surface actually
 * touches a flat plane when resting on its side, as two local-space endpoints. Only the straight
 * barrel section contacts a flat plane (the hemisphere caps only touch if standing on an end), so
 * this uses cylinder_half_height, not the capsule's total half_height.
 *
 * @method getRestAxis
 * @param localNormal {Vector3} the contact normal, in this shape's local space
 * @return {Array} [Vector3, Vector3] two local-space points defining the rest line
 */
Goblin.CapsuleShape.prototype.getRestAxis = function( localNormal ) {
    var rx = localNormal.x, rz = localNormal.z;
    var sigma = Math.sqrt( rx * rx + rz * rz );
    if ( sigma < 1e-6 ) { rx = 1; rz = 0; sigma = 1; }
    rx /= sigma; rz /= sigma;
    return [
        new Goblin.Vector3( rx * this.radius, -this.cylinder_half_height, rz * this.radius ),
        new Goblin.Vector3( rx * this.radius, this.cylinder_half_height, rz * this.radius )
    ];
};

/**
 * Calculates and returns the inertia tensor for the capsule
 * Combines cylinder and sphere inertia based on their respective volumes and mass distribution
 *
 * @method getInertiaTensor
 * @param mass {Number} total mass of the capsule
 * @return {Matrix3} 3x3 matrix representing the inertia tensor
 */
Goblin.CapsuleShape.prototype.getInertiaTensor = function(mass) {
    // Calculate volumes for mass distribution
    var cylinder_volume = Math.PI * this.radius * this.radius * this.cylinder_height;
    var sphere_volume = (4/3) * Math.PI * this.radius * this.radius * this.radius;
    var total_volume = cylinder_volume + sphere_volume;

    // Distribute mass proportionally based on volume
    var cylinder_mass = mass * (cylinder_volume / total_volume);
    var sphere_mass = mass * (sphere_volume / total_volume);

    // Calculate cylinder contribution to inertia
    var cylinder_x = (1/12) * cylinder_mass * (3 * this.radius * this.radius + this.cylinder_height * this.cylinder_height);
    var cylinder_y = 0.5 * cylinder_mass * this.radius * this.radius;

    // Sphere (both hemisphere caps combined) contribution. The caps sit offset from the capsule's
    // center of mass by cylinder_half_height, so the parallel-axis theorem ( I = I_local + m*d^2 )
    // adds mass*offset^2 to the two axes perpendicular to the barrel (x and z). The barrel axis (y) is
    // unaffected, its offset being along that axis.
    var sphere_element = (2/5) * sphere_mass * this.radius * this.radius;
    var sphere_offset = this.cylinder_half_height;
    var sphere_perp = sphere_element + sphere_mass * sphere_offset * sphere_offset;

    // Combine inertias into final tensor
    return new Goblin.Matrix3(
        cylinder_x + sphere_perp, 0, 0,
        0, cylinder_y + sphere_element, 0,
        0, 0, cylinder_x + sphere_perp
    );
};

/**
 * Given a direction, finds the point in this capsule which is the most extreme in that direction.
 * This support point is calculated in local coordinates and stored in the second parameter
 * Used primarily in collision detection algorithms like GJK
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.CapsuleShape.prototype.findSupportPoint = function(direction, support_point) {
    // A capsule is the Minkowski sum of a line segment (the barrel axis, from -cylinder_half_height
    // to +cylinder_half_height along local Y) and a sphere of `radius`. Its support point is the
    // segment endpoint chosen by the sign of direction.y, plus radius * normalize(direction). This
    // holds for the caps as well as the barrel - a capsule has no flat end disk, so (unlike the
    // cylinder) there is no separate full-radius case.
    // Segment endpoint contribution: sign(direction.y) * cylinder_half_height. This MUST be a three-way
    // sign — when direction.y is exactly 0 the support lies on the barrel equator and the segment adds 0.
    // A two-way branch (y < 0 ? -h : +h) maps y == 0 to +h, snapping every equatorial support to the TOP
    // cap ring, so all horizontally-sampled support points become coplanar (y = +h). GJK then builds a
    // flat tetrahedron and EPA gets a degenerate simplex (NaN face normals) — a crash for any horizontal
    // capsule query.
    // A zero-length direction has no "most extreme" point — every point is equally valid. Return the
    // barrel-center point (radius term contributes nothing) instead of dividing by zero and returning NaN,
    // which would poison the GJK simplex. (SphereShape does the same, returning the origin.)
    var dlen = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    var inv = dlen > 0 ? this.radius / dlen : 0;
    var segY = direction.y > 0 ? this.cylinder_half_height : ( direction.y < 0 ? -this.cylinder_half_height : 0 );
    support_point.x = inv * direction.x;
    support_point.y = segY + inv * direction.y;
    support_point.z = inv * direction.z;
};

/**
 * Helper method that checks if a ray segment intersects with a sphere.
 * Used by rayIntersect to handle the capsule's hemispherical caps.
 * 
 * @method sphereIntersect
 * @param start {vec3} start point of the ray segment
 * @param end {vec3} end point of the ray segment
 * @param radius {Number} radius of the sphere to check intersection with
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else null
 * @private
 */
Goblin.CapsuleShape.prototype.sphereIntersect = function(start, end, radius) {
    var direction = new Goblin.Vector3();
    direction.subtractVectors(end, start);
    var length = direction.length();
    direction.scale(1 / length); // normalize

    var a = start.dot(direction);
    var b = start.dot(start) - radius * radius;

    // Exit early if ray starts outside sphere and points away
    if (a >= 0 && b >= 0) {
        return null;
    }

    var discr = a * a - b;
    // Check for ray miss
    if (discr < 0) {
        return null;
    }

    // Calculate intersection point
    var discr_sqrt = Math.sqrt(discr);
    var t = -a - discr_sqrt;
    if (t < 0) {
        t = -a + discr_sqrt;
    }

    // Verify intersection is within segment length
    if (t > length) {
        return null;
    }

    var intersection = Goblin.ObjectPool.getObject('RayIntersection');
    intersection.point.scaleVector(direction, t);
    intersection.t = t;
    intersection.point.add(start);
    return intersection;
};

/**
 * Checks if a ray segment intersects with the capsule shape.
 * Performs intersection tests against both the cylindrical portion and hemispherical caps,
 * returning the closest intersection point if any exists.
 *
 * @method rayIntersect
 * @param start {vec3} start point of the ray segment
 * @param end {vec3} end point of the ray segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else null
 */
Goblin.CapsuleShape.prototype.rayIntersect = (function(){
    var p = new Goblin.Vector3(),
        q = new Goblin.Vector3(),
        temp = new Goblin.Vector3();

    return function(start, end) {
        // Test cylinder intersection first
        p.y = this.cylinder_half_height;  // Top of cylinder
        q.y = -this.cylinder_half_height; // Bottom of cylinder

        // Calculate ray properties relative to cylinder
        var d = new Goblin.Vector3();
        d.subtractVectors(q, p);          // Cylinder axis vector

        var m = new Goblin.Vector3();
        m.subtractVectors(start, p);      // Vector from cylinder top to ray start

        var n = new Goblin.Vector3();
        n.subtractVectors(end, start);    // Ray direction vector

        // Compute intermediate values for intersection test
        var md = m.dot(d),
            nd = n.dot(d),
            dd = d.dot(d);

        var nn = n.dot(n),
            mn = m.dot(n),
            a = dd * nn - nd * nd,
            k = m.dot(m) - this.radius * this.radius,
            c = dd * k - md * md,
            cylinder_intersection = null;
        var t;

        // Handle ray parallel to cylinder axis
        if (Math.abs(a) < Goblin.EPSILON) {
            if (c > 0) {
                cylinder_intersection = null;
            } else {
                if (md < 0) {
                    t = -mn / nn;         // Intersect with p endcap
                } else if (md > dd) {
                    t = (nd - mn) / nn;   // Intersect with q endcap
                } else {
                    t = 0;                // Ray starts inside cylinder
                }
                
                if (t >= 0 && t <= 1) {
                    cylinder_intersection = Goblin.ObjectPool.getObject('RayIntersection');
                    cylinder_intersection.t = t * n.length();
                    cylinder_intersection.point.scaleVector(n, t);
                    cylinder_intersection.point.add(start);
                }
            }
        } else {
            // Standard cylinder intersection test
            var b = dd * mn - nd * md,
                discr = b * b - a * c;

            if (discr >= 0) {
                t = (-b - Math.sqrt(discr)) / a;
                if (t >= 0 && t <= 1) {
                    var hit_y = md + t * nd;
                    if (hit_y >= 0 && hit_y <= dd) {
                        cylinder_intersection = Goblin.ObjectPool.getObject('RayIntersection');
                        cylinder_intersection.t = t * n.length();
                        cylinder_intersection.point.scaleVector(n, t);
                        cylinder_intersection.point.add(start);
                    }
                }
            }
        }

        // Now test hemisphere intersections
        var sphere_intersection = null;
        
        // Test top hemisphere
        temp.copy(start);
        temp.y -= this.cylinder_half_height;
        var top_intersection = this.sphereIntersect(temp, end, this.radius);
        if (top_intersection) {
            top_intersection.point.y += this.cylinder_half_height;
            sphere_intersection = top_intersection;
        }

        // Test bottom hemisphere
        temp.copy(start);
        temp.y += this.cylinder_half_height;
        var bottom_intersection = this.sphereIntersect(temp, end, this.radius);
        if (bottom_intersection) {
            bottom_intersection.point.y -= this.cylinder_half_height;
            if (!sphere_intersection || bottom_intersection.t < sphere_intersection.t) {
                sphere_intersection = bottom_intersection;
            }
        }

        // Return the closest intersection between cylinder and hemispheres
        var intersection = null;
        if (cylinder_intersection && sphere_intersection) {
            intersection = cylinder_intersection.t < sphere_intersection.t ? 
                         cylinder_intersection : sphere_intersection;
        } else {
            intersection = cylinder_intersection || sphere_intersection;
        }

        if (intersection) {
            intersection.object = this;
            // Calculate surface normal at intersection point
            if (Math.abs(intersection.point.y) >= this.cylinder_half_height) {
                // Point is on hemisphere cap
                temp.copy(intersection.point);
                temp.y += intersection.point.y > 0 ? -this.cylinder_half_height : this.cylinder_half_height;
                intersection.normal.normalizeVector(temp);
            } else {
                // Point is on cylinder wall
                intersection.normal.x = intersection.point.x;
                intersection.normal.y = 0;
                intersection.normal.z = intersection.point.z;
                intersection.normal.scale(1 / this.radius);
            }
        }

        return intersection;
    };
})();
/**
 * @class CompoundShape
 * @constructor
 */
Goblin.CompoundShape = function() {
	this.child_shapes = [];

	this.aabb = new Goblin.AABB();
	this.calculateLocalAABB( this.aabb );
};

/**
 * Adds the child shape at `position` and `rotation` relative to the compound shape
 *
 * @method addChildShape
 * @param shape
 * @param position
 * @param rotation
 */
Goblin.CompoundShape.prototype.addChildShape = function( shape, position, rotation ) {
	this.child_shapes.push( new Goblin.CompoundShapeChild( shape, position, rotation ) );
	this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.CompoundShape.prototype.calculateLocalAABB = function( aabb ) {
	aabb.min.x = aabb.min.y = aabb.min.z = Infinity;
	aabb.max.x = aabb.max.y = aabb.max.z = -Infinity;

	var i, shape;

	for ( i = 0; i < this.child_shapes.length; i++ ) {
		shape = this.child_shapes[i];

		aabb.min.x = Math.min( aabb.min.x, shape.aabb.min.x );
		aabb.min.y = Math.min( aabb.min.y, shape.aabb.min.y );
		aabb.min.z = Math.min( aabb.min.z, shape.aabb.min.z );

		aabb.max.x = Math.max( aabb.max.x, shape.aabb.max.x );
		aabb.max.y = Math.max( aabb.max.y, shape.aabb.max.y );
		aabb.max.z = Math.max( aabb.max.z, shape.aabb.max.z );
	}
};

Goblin.CompoundShape.prototype.getInertiaTensor = function( mass ) {
	var tensor = new Goblin.Matrix3(),
		j = new Goblin.Matrix3(),
		i,
		child,
		child_tensor;

	mass /= this.child_shapes.length;

	// Holds center of current tensor
	_tmp_vec3_1.x = _tmp_vec3_1.y = _tmp_vec3_1.z = 0;

	for ( i = 0; i < this.child_shapes.length; i++ ) {
		child = this.child_shapes[i];

		_tmp_vec3_1.subtract( child.position );

		j.e00 = mass * -( _tmp_vec3_1.y * _tmp_vec3_1.y + _tmp_vec3_1.z * _tmp_vec3_1.z );
		j.e10 = mass * _tmp_vec3_1.x * _tmp_vec3_1.y;
		j.e20 = mass * _tmp_vec3_1.x * _tmp_vec3_1.z;

		j.e01 = mass * _tmp_vec3_1.x * _tmp_vec3_1.y;
		j.e11 = mass * -( _tmp_vec3_1.x * _tmp_vec3_1.x + _tmp_vec3_1.z * _tmp_vec3_1.z );
		j.e21 = mass * _tmp_vec3_1.y * _tmp_vec3_1.z;

		j.e02 = mass * _tmp_vec3_1.x * _tmp_vec3_1.z;
		j.e12 = mass * _tmp_vec3_1.y * _tmp_vec3_1.z;
		j.e22 = mass * -( _tmp_vec3_1.x * _tmp_vec3_1.x + _tmp_vec3_1.y * _tmp_vec3_1.y );

		_tmp_mat3_1.fromMatrix4( child.transform );
		child_tensor = child.shape.getInertiaTensor( mass );
		_tmp_mat3_1.transposeInto( _tmp_mat3_2 );
		_tmp_mat3_1.multiply( child_tensor );
		_tmp_mat3_1.multiply( _tmp_mat3_2 );

		tensor.e00 += _tmp_mat3_1.e00 + j.e00;
		tensor.e10 += _tmp_mat3_1.e10 + j.e10;
		tensor.e20 += _tmp_mat3_1.e20 + j.e20;
		tensor.e01 += _tmp_mat3_1.e01 + j.e01;
		tensor.e11 += _tmp_mat3_1.e11 + j.e11;
		tensor.e21 += _tmp_mat3_1.e21 + j.e21;
		tensor.e02 += _tmp_mat3_1.e02 + j.e02;
		tensor.e12 += _tmp_mat3_1.e12 + j.e12;
		tensor.e22 += _tmp_mat3_1.e22 + j.e22;
	}

	return tensor;
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property ray_start {vec3} start point of the segment
 * @property ray_end {vec3} end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.CompoundShape.prototype.rayIntersect = (function(){
	var tSort = function( a, b ) {
		if ( a.t < b.t ) {
			return -1;
		} else if ( a.t > b.t ) {
			return 1;
		} else {
			return 0;
		}
	};
	return function( ray_start, ray_end ) {
		var intersections = [],
			local_start = new Goblin.Vector3(),
			local_end = new Goblin.Vector3(),
			intersection,
			i, child;

		for ( i = 0; i < this.child_shapes.length; i++ ) {
			child = this.child_shapes[i];

			child.transform_inverse.transformVector3Into( ray_start, local_start );
			child.transform_inverse.transformVector3Into( ray_end, local_end );

			intersection = child.shape.rayIntersect( local_start, local_end );
			if ( intersection != null ) {
				intersection.object = this; // change from the shape to the body
				child.transform.transformVector3( intersection.point ); // transform child's local coordinates to the compound's coordinates
				intersections.push( intersection );
			}
		}

		intersections.sort( tSort );
		return intersections[0] || null;
	};
})();
/**
 * @class CompoundShapeChild
 * @constructor
 */
Goblin.CompoundShapeChild = function( shape, position, rotation ) {
	this.shape = shape;

	this.position = new Goblin.Vector3( position.x, position.y, position.z );
	this.rotation = new Goblin.Quaternion( rotation.x, rotation.y, rotation.z, rotation.w );

	this.transform = new Goblin.Matrix4();
	this.transform_inverse = new Goblin.Matrix4();
	this.transform.makeTransform( this.rotation, this.position );
	this.transform.invertInto( this.transform_inverse );

	this.aabb = new Goblin.AABB();
	this.aabb.transform( this.shape.aabb, this.transform );
};
/**
 * @class ConeShape
 * @param radius {Number} radius of the cylinder
 * @param half_height {Number} half height of the cylinder
 * @constructor
 *
 * A near-disc cone ( radius greater than about its height ) dropped nearly flat rocks on its wide rim
 * for a long time before settling, like a spun coin. Use a CylinderShape for disc-like silhouettes;
 * cones with height on the order of the radius or taller settle cleanly at any orientation.
 */
Goblin.ConeShape = function( radius, half_height ) {
	/**
	 * radius of the cylinder
	 *
	 * @property radius
	 * @type {Number}
	 */
	this.radius = radius;

	/**
	 * half height of the cylinder
	 *
	 * @property half_height
	 * @type {Number}
	 */
	this.half_height = half_height;

    this.aabb = new Goblin.AABB();
    this.calculateLocalAABB( this.aabb );

    /**
     * sin of the cone's angle
     *
     * @property _sinagle
     * @type {Number}
     * @private
     */
	this._sinangle = this.radius / Math.sqrt( this.radius * this.radius + Math.pow( 2 * this.half_height, 2 ) );

    /**
     * cos of the cone's angle
     *
     * @property _cosangle
     * @type {Number}
     * @private
     */
    this._cosangle = Math.cos( Math.asin( this._sinangle ) );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.ConeShape.prototype.calculateLocalAABB = function( aabb ) {
    aabb.min.x = aabb.min.z = -this.radius;
    aabb.min.y = -this.half_height;

    aabb.max.x = aabb.max.z = this.radius;
    aabb.max.y = this.half_height;
};

/**
 * Returns this shape's local-space rest axis: the line along which the cone touches a flat plane when
 * lying on its side, as two local-space endpoints. A cone tapers, so this line is not centered under
 * the centroid - it runs from the apex to a single point on the base rim.
 *
 * @method getRestAxis
 * @param localNormal {Vector3} the contact normal, in this shape's local space
 * @return {Array} [Vector3, Vector3] two local-space points defining the rest line: apex, then base rim
 */
Goblin.ConeShape.prototype.getRestAxis = function( localNormal ) {
	// The touching rim point is on the side the cone leans toward, i.e. opposite the outward contact
	// normal, so the radial direction is taken from -localNormal.
	var rx = -localNormal.x, rz = -localNormal.z;
	var sigma = Math.sqrt( rx * rx + rz * rz );
	if ( sigma < 1e-6 ) { rx = 1; rz = 0; sigma = 1; }
	rx /= sigma; rz /= sigma;
	return [
		new Goblin.Vector3( 0, this.half_height, 0 ),                                 // apex
		new Goblin.Vector3( rx * this.radius, -this.half_height, rz * this.radius )   // base rim point (contact side)
	];
};
Goblin.ConeShape.prototype.getInertiaTensor = function( mass ) {
	var element = 0.1 * mass * Math.pow( this.half_height * 2, 2 ) + 0.15 * mass * this.radius * this.radius;

	return new Goblin.Matrix3(
		element, 0, 0,
		0, 0.3 * mass * this.radius * this.radius, 0,
		0, 0, element
	);
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.ConeShape.prototype.findSupportPoint = function( direction, support_point ) {
	// Calculate the support point in the local frame
	//var w = direction - ( direction.y )
	var sigma = Math.sqrt( direction.x * direction.x + direction.z * direction.z );

	if ( direction.y > direction.length() * this._sinangle ) {
		support_point.x = support_point.z = 0;
		support_point.y = this.half_height;
	} else if ( sigma > 0 ) {
		var r_s = this.radius / sigma;
		support_point.x = r_s * direction.x;
		support_point.y = -this.half_height;
		support_point.z = r_s * direction.z;
	} else {
		support_point.x = support_point.z = 0;
		support_point.y = -this.half_height;
	}
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.ConeShape.prototype.rayIntersect = (function(){
    var direction = new Goblin.Vector3(),
        length,
        p1 = new Goblin.Vector3(),
        p2 = new Goblin.Vector3(),
		normal1 = new Goblin.Vector3(),
		normal2 = new Goblin.Vector3();

    return function( start, end ) {
        direction.subtractVectors( end, start );
        length = direction.length();
        direction.scale( 1 / length  ); // normalize direction

        var t1, t2;

        // Check for intersection with cone base
		p1.x = p1.y = p1.z = 0;
        t1 = this._rayIntersectBase( start, end, p1, normal1 );

        // Check for intersection with cone shape
		p2.x = p2.y = p2.z = 0;
        t2 = this._rayIntersectCone( start, direction, length, p2, normal2 );

        var intersection;

        if ( !t1 && !t2 ) {
            return null;
        } else if ( !t2 || ( t1 &&  t1 < t2 ) ) {
            intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
            intersection.object = this;
			intersection.t = t1;
            intersection.point.copy( p1 );
			intersection.normal.copy( normal1 );
            return intersection;
        } else if ( !t1 || ( t2 && t2 < t1 ) ) {
            intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
            intersection.object = this;
			intersection.t = t2;
            intersection.point.copy( p2 );
			intersection.normal.copy( normal2 );
            return intersection;
        }

        return null;
    };
})();

Goblin.ConeShape.prototype._rayIntersectBase = (function(){
    var _normal = new Goblin.Vector3( 0, -1, 0 ),
        ab = new Goblin.Vector3(),
        _start = new Goblin.Vector3(),
        _end = new Goblin.Vector3(),
        t;

    return function( start, end, point, normal ) {
        _start.x = start.x;
        _start.y = start.y + this.half_height;
        _start.z = start.z;

        _end.x = end.x;
        _end.y = end.y + this.half_height;
        _end.z = end.z;

        ab.subtractVectors( _end, _start );
        t = -_normal.dot( _start ) / _normal.dot( ab );

        if ( t < 0 || t > 1 ) {
            return null;
        }

        point.scaleVector( ab, t );
        point.add( start );

        if ( point.x * point.x + point.z * point.z > this.radius * this.radius ) {
            return null;
        }

		normal.x = normal.z = 0;
		normal.y = -1;

        return t * ab.length();
    };
})();

/**
 * Checks if a ray segment intersects with the cone definition
 *
 * @method _rayIntersectCone
 * @property start {vec3} start point of the segment
 * @property direction {vec3} normalized direction vector of the segment, from `start`
 * @property length {Number} segment length
 * @property point {vec3} (out) location of intersection
 * @private
 * @return {vec3|null} if the segment intersects, point where the segment intersects the cone, else `null`
 */
Goblin.ConeShape.prototype._rayIntersectCone = (function(){
    var _point = new Goblin.Vector3();

    return function( start, direction, length, point, normal ) {
        var A = new Goblin.Vector3( 0, -1, 0 );

        var AdD = A.dot( direction ),
            cosSqr = this._cosangle * this._cosangle;

        var E = new Goblin.Vector3();
        E.x = start.x;
        E.y = start.y - this.half_height;
        E.z = start.z;

        var AdE = A.dot( E ),
            DdE = direction.dot( E ),
            EdE = E.dot( E ),
            c2 = AdD * AdD - cosSqr,
            c1 = AdD * AdE - cosSqr * DdE,
            c0 = AdE * AdE - cosSqr * EdE,
            dot, t, tmin = null;

        if ( Math.abs( c2 ) >= Goblin.EPSILON ) {
            var discr = c1 * c1 - c0 * c2;
			if ( discr < -Goblin.EPSILON ) {
                return null;
            } else if ( discr > Goblin.EPSILON ) {
                var root = Math.sqrt( discr ),
                    invC2 = 1 / c2;

                t = ( -c1 - root ) * invC2;
                if ( t >= 0 && t <= length ) {
                    _point.scaleVector( direction, t );
                    _point.add( start );
                    E.y = _point.y - this.half_height;
                    dot = E.dot( A );
                    if ( dot >= 0 ) {
                        tmin = t;
                        point.copy( _point );
                    }
                }

                t = ( -c1 + root ) * invC2;
                if ( t >= 0 && t <= length ) {
                    if ( tmin == null || t < tmin ) {
                        _point.scaleVector( direction, t );
                        _point.add( start );
                        E.y = _point.y - this.half_height;
                        dot = E.dot( A );
                        if ( dot >= 0 ) {
                            tmin = t;
                            point.copy( _point );
                        }
                    }
                }

                if ( tmin == null ) {
                    return null;
                }
                tmin /= length;
            } else {
                t = -c1 / c2;
                _point.scaleVector( direction, t );
                _point.add( start );
                E.y = _point.y - this.half_height;
                dot = E.dot( A );
                if ( dot < 0 ) {
                    return null;
                }

                // Verify segment reaches _point
                _tmp_vec3_1.subtractVectors( _point, start );
                if ( _tmp_vec3_1.lengthSquared() > length * length ) {
                    return null;
                }

                tmin = t / length;
                point.copy( _point );
            }
        } else if ( Math.abs( c1 ) >= Goblin.EPSILON ) {
            t = 0.5 * c0 / c1;
            _point.scaleVector( direction, t );
            _point.add( start );
            E.y = _point.y - this.half_height;
            dot = E.dot( A );
            if ( dot < 0 ) {
                return null;
            }
            tmin = t;
            point.copy( _point );
        } else {
            return null;
        }

        if ( point.y < -this.half_height ) {
            return null;
        }

		// Compute normal
		normal.x = point.x;
		normal.y = 0;
		normal.z = point.z;
		normal.normalize();

		normal.x *= ( this.half_height * 2 ) / this.radius;
		normal.y = this.radius / ( this.half_height * 2 );
		normal.z *= ( this.half_height * 2 ) / this.radius;
		normal.normalize();

        return tmin * length;
    };
})();
/**
 * @class ConvexShape
 * @param vertices {Array<vec3>} array of vertices composing the convex hull
 * @constructor
 */
Goblin.ConvexShape = function( vertices ) {
	/**
	 * vertices composing the convex hull
	 *
	 * @property vertices
	 * @type {Array<vec3>}
	 */
	this.vertices = [];

	/**
	 * faces composing the convex hull
	 *
	 * @property faces
	 * @type {Array}
	 */
	this.faces = [];

	/**
	 * the convex hull's volume
	 * @property volume
	 * @type {number}
	 */
	this.volume = 0;

	/**
	 * coordinates of the hull's COM
	 * @property center_of_mass
	 * @type {vec3}
	 */
	this.center_of_mass = new Goblin.Vector3();

	/**
	 * used in computing the convex hull's center of mass & volume
	 * @property _intergral
	 * @type {Float32Array}
	 * @private
	 */
	this._integral = new Float32Array( 10 );

	this.process( vertices );

	this.aabb = new Goblin.AABB();
	this.calculateLocalAABB( this.aabb );
};

Goblin.ConvexShape.prototype.process = function( vertices ) {
	// Find two points furthest apart on X axis
	var candidates = vertices.slice(),
		min_point = null,
		max_point = null;

	for ( var i = 0; i < candidates.length; i++ ) {
		var vertex = candidates[i];

		if ( min_point == null || min_point.x > vertex.x ) {
			min_point = vertex;
		}
		if ( max_point == null || max_point.x > vertex.x ) {
			max_point = vertex;
		}
	}
	if ( min_point === max_point ) {
		max_point = vertices[0] === min_point ? vertices[1] : vertices[0];
	}

	// Initial 1-simplex
	var point_a = min_point,
		point_b = max_point;
	candidates.splice( candidates.indexOf( point_a ), 1 );
	candidates.splice( candidates.indexOf( point_b ), 1 );

	// Find the point most distant from the line to construct the 2-simplex
	var distance = -Infinity,
		furthest_idx = null,
		candidate, candidate_distance;

	for ( i = 0; i < candidates.length; i++ ) {
		candidate = candidates[i];
		candidate_distance = Goblin.GeometryMethods.findSquaredDistanceFromSegment( candidate, point_a, point_b );
		if ( candidate_distance > distance ) {
			distance = candidate_distance;
			furthest_idx = i;
		}
	}
	var point_c = candidates[furthest_idx];
	candidates.splice( furthest_idx, 1 );

	// Fourth point of the 3-simplex is the one furthest away from the 2-simplex
	_tmp_vec3_1.subtractVectors( point_b, point_a );
	_tmp_vec3_2.subtractVectors( point_c, point_a );
	_tmp_vec3_1.cross( _tmp_vec3_2 ); // _tmp_vec3_1 is the normal of the 2-simplex

	distance = -Infinity;
	furthest_idx = null;

	for ( i = 0; i < candidates.length; i++ ) {
		candidate = candidates[i];
		candidate_distance = Math.abs( _tmp_vec3_1.dot( candidate ) );
		if ( candidate_distance > distance ) {
			distance = candidate_distance;
			furthest_idx = i;
		}
	}
	var point_d = candidates[furthest_idx];
	candidates.splice( furthest_idx, 1 );

	// If `point_d` is on the front side of `abc` then flip to `cba`
	if ( _tmp_vec3_1.dot( point_d ) > 0 ) {
		var tmp_point = point_a;
		point_a = point_c;
		point_c = tmp_point;
	}

	// We have our starting tetrahedron, rejoice
	// Now turn that into a polyhedron
	var polyhedron = new Goblin.GjkEpa.Polyhedron({ points:[
		{ point: point_c }, { point: point_b }, { point: point_a }, { point: point_d }
	]});

	// Add the rest of the points
	for ( i = 0; i < candidates.length; i++ ) {
		// We are going to lie and tell the polyhedron that its closest face is any of the faces which can see the candidate
		polyhedron.closest_face = null;
		for ( var j = 0; j < polyhedron.faces.length; j++ ) {
			if ( polyhedron.faces[j].active === true && polyhedron.faces[j].classifyVertex( { point: candidates[i] } ) > 0 ) {
				polyhedron.closest_face = j;
				break;
			}
		}
		if ( polyhedron.closest_face == null ) {
			// This vertex is already contained by the existing hull, ignore
			continue;
		}
		polyhedron.addVertex( { point: candidates[i] } );
	}

	this.faces = polyhedron.faces.filter(function( face ){
		return face.active;
	});

	// find all the vertices & edges which make up the convex hull
	var convexshape = this;
	
	this.faces.forEach(function( face ){
		// If we haven't already seen these vertices then include them
		var a = face.a.point,
			b = face.b.point,
			c = face.c.point,
			ai = convexshape.vertices.indexOf( a ),
			bi = convexshape.vertices.indexOf( b ),
			ci = convexshape.vertices.indexOf( c );

		// Include vertices if they are new
		if ( ai === -1 ) {
			convexshape.vertices.push( a );
		}
		if ( bi === -1 ) {
			convexshape.vertices.push( b );
		}
		if ( ci === -1 ) {
			convexshape.vertices.push( c );
		}
	});

	this.computeVolume( this.faces );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.ConvexShape.prototype.calculateLocalAABB = function( aabb ) {
	aabb.min.x = aabb.min.y = aabb.min.z = 0;
	aabb.max.x = aabb.max.y = aabb.max.z = 0;

	for ( var i = 0; i < this.vertices.length; i++ ) {
		aabb.min.x = Math.min( aabb.min.x, this.vertices[i].x );
		aabb.min.y = Math.min( aabb.min.y, this.vertices[i].y );
		aabb.min.z = Math.min( aabb.min.z, this.vertices[i].z );

		aabb.max.x = Math.max( aabb.max.x, this.vertices[i].x );
		aabb.max.y = Math.max( aabb.max.y, this.vertices[i].y );
		aabb.max.z = Math.max( aabb.max.z, this.vertices[i].z );
	}
};

Goblin.ConvexShape.prototype.computeVolume = (function(){
	var origin = { point: new Goblin.Vector3() },
		output = new Float32Array( 6 ),
		macro = function( a, b, c ) {
			var temp0 = a + b,
				temp1 = a * a,
				temp2 = temp1 + b * temp0;

			output[0] = temp0 + c;
			output[1] = temp2 + c * output[0];
			output[2] = a * temp1 + b * temp2 + c * output[1];
			output[3] = output[1] + a * ( output[0] + a );
			output[4] = output[1] + b * ( output[0] + b );
			output[5] = output[1] + c * ( output[0] + c );
		};

	return function( faces ) {
		for ( var i = 0; i < faces.length; i++ ) {
			var face = faces[i],
				v0 = face.a.point,
				v1 = face.b.point,
				v2 = face.c.point;

			var a1 = v1.x - v0.x,
				b1 = v1.y - v0.y,
				c1 = v1.z - v0.z,
				a2 = v2.x - v0.x,
				b2 = v2.y - v0.y,
				c2 = v2.z - v0.z,
				d0 = b1 * c2 - b2 * c1,
				d1 = a2 * c1 - a1 * c2,
				d2 = a1 * b2 - a2 * b1;

			macro( v0.x, v1.x, v2.x );
			var f1x = output[0],
				f2x = output[1],
				f3x = output[2],
				g0x = output[3],
				g1x = output[4],
				g2x = output[5];

			macro( v0.y, v1.y, v2.y );
			var f1y = output[0],
				f2y = output[1],
				f3y = output[2],
				g0y = output[3],
				g1y = output[4],
				g2y = output[5];

			macro( v0.z, v1.z, v2.z );
			var f1z = output[0],
				f2z = output[1],
				f3z = output[2],
				g0z = output[3],
				g1z = output[4],
				g2z = output[5];

			var contributor = face.classifyVertex( origin ) > 0 ? -1 : 1;

			this._integral[0] += contributor * d0 * f1x;
			this._integral[1] += contributor * d0 * f2x;
			this._integral[2] += contributor * d1 * f2y;
			this._integral[3] += contributor * d2 * f2z;
			this._integral[4] += contributor * d0 * f3x;
			this._integral[5] += contributor * d1 * f3y;
			this._integral[6] += contributor * d2 * f3z;
			this._integral[7] += contributor * d0 * ( v0.y * g0x + v1.y * g1x + v2.y * g2x );
			this._integral[8] += contributor * d1 * ( v0.z * g0y + v1.z * g1y + v2.z * g2y );
			this._integral[9] += contributor * d2 * ( v0.x * g0z + v1.x * g1z + v2.x * g2z );
		}

		this._integral[0] *= 1 / 6;
		this._integral[1] *= 1 / 24;
		this._integral[2] *= 1 / 24;
		this._integral[3] *= 1 / 24;
		this._integral[4] *= 1 / 60;
		this._integral[5] *= 1 / 60;
		this._integral[6] *= 1 / 60;
		this._integral[7] *= 1 / 120;
		this._integral[8] *= 1 / 120;
		this._integral[9] *= 1 / 120;

		this.volume = this._integral[0];

		this.center_of_mass.x = this._integral[1] / this.volume;
		this.center_of_mass.y = this._integral[2] / this.volume;
		this.center_of_mass.z = this._integral[3] / this.volume;
	};
})();

Goblin.ConvexShape.prototype.getInertiaTensor = (function(){
	return function( mass ) {
		var	inertia_tensor = new Goblin.Matrix3();
		mass /= this.volume;

		inertia_tensor.e00 = ( this._integral[5] + this._integral[6] ) * mass;
		inertia_tensor.e11 = ( this._integral[4] + this._integral[6] ) * mass;
		inertia_tensor.e22 = ( this._integral[4] + this._integral[5] ) * mass;
		inertia_tensor.e10 = inertia_tensor.e01 = -this._integral[7] * mass; //xy
		inertia_tensor.e21 = inertia_tensor.e12 = -this._integral[8] * mass; //yz
		inertia_tensor.e20 = inertia_tensor.e02 = -this._integral[9] * mass; //xz

		inertia_tensor.e00 -= mass * ( this.center_of_mass.y * this.center_of_mass.y + this.center_of_mass.z * this.center_of_mass.z );
		inertia_tensor.e11 -= mass * ( this.center_of_mass.x * this.center_of_mass.x + this.center_of_mass.z * this.center_of_mass.z );
		inertia_tensor.e22 -= mass * ( this.center_of_mass.x * this.center_of_mass.x + this.center_of_mass.y * this.center_of_mass.y );

		inertia_tensor.e10 += mass * this.center_of_mass.x * this.center_of_mass.y;
		inertia_tensor.e01 += mass * this.center_of_mass.x * this.center_of_mass.y;

		inertia_tensor.e21 += mass * this.center_of_mass.y * this.center_of_mass.z;
		inertia_tensor.e12 += mass * this.center_of_mass.y * this.center_of_mass.z;

		inertia_tensor.e20 += mass * this.center_of_mass.x * this.center_of_mass.z;
		inertia_tensor.e02 += mass * this.center_of_mass.x * this.center_of_mass.z;

		return inertia_tensor;
	};
})();

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.ConvexShape.prototype.findSupportPoint = function( direction, support_point ) {
	var best,
		best_dot = -Infinity,
		dot;

	for ( var i = 0; i < this.vertices.length; i++ ) {
		dot = this.vertices[i].dot( direction );
		if ( dot > best_dot ) {
			best_dot = dot;
			best = i;
		}
	}

	support_point.copy( this.vertices[best] );
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.ConvexShape.prototype.rayIntersect = (function(){
	var direction = new Goblin.Vector3(),
		ab = new Goblin.Vector3(),
		ac = new Goblin.Vector3(),
		q = new Goblin.Vector3(),
		s = new Goblin.Vector3(),
		r = new Goblin.Vector3(),
		b = new Goblin.Vector3(),
		u = new Goblin.Vector3(),
		tmin, tmax;

	return function( start, end ) {
		tmin = 0;

		direction.subtractVectors( end, start );
		tmax = direction.length();
		direction.scale( 1 / tmax ); // normalize direction

		for ( var i = 0; i < this.faces.length; i++  ) {
			var face = this.faces[i];

			ab.subtractVectors( face.b.point, face.a.point );
			ac.subtractVectors( face.c.point, face.a.point );
			q.crossVectors( direction, ac );
			var a = ab.dot( q );

			if ( a < Goblin.EPSILON ) {
				// Ray does not point at face
				continue;
			}

			var f = 1 / a;
			s.subtractVectors( start, face.a.point );

			var u = f * s.dot( q );
			if ( u < 0 ) {
				// Ray does not intersect face
				continue;
			}

			r.crossVectors( s, ab );
			var v = f * direction.dot( r );
			if ( v < 0 || u + v > 1 ) {
				// Ray does not intersect face
				continue;
			}

			var t = f * ac.dot( r );
			if ( t < tmin || t > tmax ) {
				// ray segment does not intersect face
				continue;
			}

			// Segment intersects the face, find from `t`
			var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
			intersection.object = this;
			intersection.t = t;
			intersection.point.scaleVector( direction, t );
			intersection.point.add( start );
			intersection.normal.copy( face.normal );

			// A convex object can have only one intersection with a line, we're done
			return intersection;
		}

		// No intersection found
		return null;
	};
})();
/**
 * @class CylinderShape
 * @param radius {Number} radius of the cylinder
 * @param half_height {Number} half height of the cylinder
 * @constructor
 */
Goblin.CylinderShape = function( radius, half_height ) {
	/**
	 * radius of the cylinder
	 *
	 * @property radius
	 * @type {Number}
	 */
	this.radius = radius;

	/**
	 * half height of the cylinder
	 *
	 * @property half_height
	 * @type {Number}
	 */
	this.half_height = half_height;

    this.aabb = new Goblin.AABB();
    this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.CylinderShape.prototype.calculateLocalAABB = function( aabb ) {
    aabb.min.x = aabb.min.z = -this.radius;
    aabb.min.y = -this.half_height;

    aabb.max.x = aabb.max.z = this.radius;
    aabb.max.y = this.half_height;
};

/**
 * Returns this shape's local-space "rest axis" - the line along which its barrel surface actually
 * touches a flat plane when resting on its side, as two local-space endpoints. Unlike the cone,
 * the cylinder/capsule barrel is symmetric about the Y axis, so the radial direction of the
 * contact line depends on which way the (local-space) contact normal points; pass it in.
 *
 * @method getRestAxis
 * @param localNormal {Vector3} the contact normal, in this shape's local space
 * @return {Array} [Vector3, Vector3] two local-space points defining the rest line
 */
Goblin.CylinderShape.prototype.getRestAxis = function( localNormal ) {
	var rx = localNormal.x, rz = localNormal.z;
	var sigma = Math.sqrt( rx * rx + rz * rz );
	if ( sigma < 1e-6 ) { rx = 1; rz = 0; sigma = 1; }
	rx /= sigma; rz /= sigma;
	return [
		new Goblin.Vector3( rx * this.radius, -this.half_height, rz * this.radius ),
		new Goblin.Vector3( rx * this.radius, this.half_height, rz * this.radius )
	];
};

Goblin.CylinderShape.prototype.getInertiaTensor = function( mass ) {
	var element = 0.0833 * mass * ( 3 * this.radius * this.radius + ( this.half_height + this.half_height ) * ( this.half_height + this.half_height ) );

	return new Goblin.Matrix3(
		element, 0, 0,
		0, 0.5 * mass * this.radius * this.radius, 0,
		0, 0, element
	);
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.CylinderShape.prototype.findSupportPoint = function( direction, support_point ) {
	// Calculate the support point in the local frame
	if ( direction.y < 0 ) {
		support_point.y = -this.half_height;
	} else {
		support_point.y = this.half_height;
	}

	if ( direction.x === 0 && direction.z === 0 ) {
		support_point.x = support_point.z = 0;
	} else {
		var sigma = Math.sqrt( direction.x * direction.x + direction.z * direction.z ),
			r_s = this.radius / sigma;
		support_point.x = r_s * direction.x;
		support_point.z = r_s * direction.z;
	}
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.CylinderShape.prototype.rayIntersect = (function(){
	var p = new Goblin.Vector3(),
		q = new Goblin.Vector3();

	return function ( start, end ) {
		p.y = this.half_height;
		q.y = -this.half_height;

		var d = new Goblin.Vector3();
		d.subtractVectors( q, p );

		var m = new Goblin.Vector3();
		m.subtractVectors( start, p );

		var n = new Goblin.Vector3();
		n.subtractVectors( end, start );

		var md = m.dot( d ),
			nd = n.dot( d ),
			dd = d.dot( d );

		// Test if segment fully outside either endcap of cylinder
		if ( md < 0 && md + nd < 0 ) {
			return null; // Segment outside 'p' side of cylinder
		}
		if ( md > dd && md + nd > dd ) {
			return null; // Segment outside 'q' side of cylinder
		}

		var nn = n.dot( n ),
			mn = m.dot( n ),
			a = dd * nn - nd * nd,
			k = m.dot( m ) - this.radius * this.radius,
			c = dd * k - md * md,
			t, t0;

		if ( Math.abs( a ) < Goblin.EPSILON ) {
			// Segment runs parallel to cylinder axis
			if ( c > 0 ) {
				return null; // 'a' and thus the segment lie outside cylinder
			}

			// Now known that segment intersects cylinder; figure out how it intersects
			if ( md < 0 ) {
				t = -mn / nn; // Intersect segment against 'p' endcap
			} else if ( md > dd ) {
				t = (nd - mn) / nn; // Intersect segment against 'q' endcap
			} else {
				t = 0; // 'a' lies inside cylinder
			}
		} else {
			var b = dd * mn - nd * md,
				discr = b * b - a * c;

			if ( discr < 0 ) {
				return null; // No real roots; no intersection
			}

			t0 = t = ( -b - Math.sqrt( discr ) ) / a;

			if ( md + t * nd < 0 ) {
				// Intersection outside cylinder on 'p' side
				if ( nd <= 0 ) {
					return null; // Segment pointing away from endcap
				}
				t = -md / nd;
				// Keep intersection if Dot(S(t) - p, S(t) - p) <= r^2
				if ( k + t * ( 2 * mn + t * nn ) <= 0 ) {
					t0 = t;
				} else {
					return null;
				}
			} else if ( md + t * nd > dd ) {
				// Intersection outside cylinder on 'q' side
				if ( nd >= 0 ) {
					return null; // Segment pointing away from endcap
				}
				t = ( dd - md ) / nd;
				// Keep intersection if Dot(S(t) - q, S(t) - q) <= r^2
				if ( k + dd - 2 * md + t * ( 2 * ( mn - nd ) + t * nn ) <= 0 ) {
					t0 = t;
				} else {
					return null;
				}
			}
			t = t0;

			// Intersection if segment intersects cylinder between the end-caps
			if ( t < 0 || t > 1 ) {
				return null;
			}
		}

		// Segment intersects cylinder between the endcaps; t is correct
		var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
		intersection.object = this;
		intersection.t = t * n.length();
		intersection.point.scaleVector( n, t );
		intersection.point.add( start );

		if ( Math.abs( intersection.point.y - this.half_height ) <= Goblin.EPSILON ) {
			intersection.normal.x = intersection.normal.z = 0;
			intersection.normal.y = intersection.point.y < 0 ? -1 : 1;
		} else {
			intersection.normal.y = 0;
			intersection.normal.x = intersection.point.x;
			intersection.normal.z = intersection.point.z;
			intersection.normal.scale( 1 / this.radius );
		}

		return intersection;
	};
})( );
/**
 * @class MeshShape
 * @param vertices {Array<Vector3>} vertices comprising the mesh
 * @param faces {Array<Number>} array of indices indicating which vertices compose a face; faces[0..2] represent the first face, faces[3..5] are the second, etc
 * @constructor
 */
Goblin.MeshShape = function( vertices, faces ) {
	this.vertices = vertices;

	this.triangles = [];
	for ( var i = 0; i < faces.length; i += 3 ) {
		this.triangles.push( new Goblin.TriangleShape( vertices[faces[i]], vertices[faces[i+1]], vertices[faces[i+2]] ) );
	}

	/**
	 * the convex mesh's volume
	 * @property volume
	 * @type {number}
	 */
	this.volume = 0;

	/**
	 * coordinates of the mesh's COM
	 * @property center_of_mass
	 * @type {vec3}
	 */
	this.center_of_mass = new Goblin.Vector3();

	/**
	 * used in computing the mesh's center of mass & volume
	 * @property _intergral
	 * @type {Float32Array}
	 * @private
	 */
	this._integral = new Float32Array( 10 );

	this.hierarchy = new Goblin.BVH( this.triangles ).tree;

	var polygon_faces = this.triangles.map(
		function( triangle ) {
			return new Goblin.GjkEpa.Face(
				null,
				{ point: triangle.a },
				{ point: triangle.b },
				{ point: triangle.c }
			);
		}
	);

	Goblin.ConvexShape.prototype.computeVolume.call( this, polygon_faces );

	this.aabb = new Goblin.AABB();
	this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.MeshShape.prototype.calculateLocalAABB = function( aabb ) {
	aabb.min.x = aabb.min.y = aabb.min.z = 0;
	aabb.max.x = aabb.max.y = aabb.max.z = 0;

	for ( var i = 0; i < this.vertices.length; i++ ) {
		aabb.min.x = Math.min( aabb.min.x, this.vertices[i].x );
		aabb.min.y = Math.min( aabb.min.y, this.vertices[i].y );
		aabb.min.z = Math.min( aabb.min.z, this.vertices[i].z );

		aabb.max.x = Math.max( aabb.max.x, this.vertices[i].x );
		aabb.max.y = Math.max( aabb.max.y, this.vertices[i].y );
		aabb.max.z = Math.max( aabb.max.z, this.vertices[i].z );
	}
};

Goblin.MeshShape.prototype.getInertiaTensor = function( mass ) {
	return Goblin.ConvexShape.prototype.getInertiaTensor.call( this, mass );
};

/**
 * noop
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.MeshShape.prototype.findSupportPoint = function( direction, support_point ) {
	return; // MeshShape isn't convex so it cannot be used directly in GJK
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3} end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.MeshShape.prototype.rayIntersect = (function(){
	var intersections = [],
		tSort = function( a, b ) {
			if ( a.t < b.t ) {
				return -1;
			} else if ( a.t > b.t ) {
				return 1;
			} else {
				return 0;
			}
		};

	return function( start, end ) {
		// Traverse the BVH and return the closest point of contact, if any
		var nodes = [ this.hierarchy ],
			node;
		intersections.length = 0;

		var count = 0;
		while ( nodes.length > 0 ) {
			count++;
			node = nodes.shift();

			if ( node.aabb.testRayIntersect( start, end ) ) {
				// Ray intersects this node's AABB
				if ( node.isLeaf() ) {
					var intersection = node.object.rayIntersect( start, end );
					if ( intersection != null ) {
						intersections.push( intersection );
					}
				} else {
					nodes.push( node.left, node.right );
				}
			}
		}

		intersections.sort( tSort );
		return intersections[0] || null;
	};
})();
/**
 * @class PlaneShape
 * @param orientation {Number} index of axis which is the plane's normal ( 0 = X, 1 = Y, 2 = Z )
 * @param half_width {Number} half width of the plane
 * @param half_length {Number} half height of the plane
 * @constructor
 */
Goblin.PlaneShape = function( orientation, half_width, half_length ) {
	/**
	 * index of axis which is the plane's normal ( 0 = X, 1 = Y, 2 = Z )
	 * when 0, width is Y and length is Z
	 * when 1, width is X and length is Z
	 * when 2, width is X and length is Y
	 *
	 * @property half_width
	 * @type {Number}
	 */
	this.orientation = orientation;

	/**
	 * half width of the plane
	 *
	 * @property half_height
	 * @type {Number}
	 */
	this.half_width = half_width;

	/**
	 * half length of the plane
	 *
	 * @property half_length
	 * @type {Number}
	 */
	this.half_length = half_length;

    this.aabb = new Goblin.AABB();
    this.calculateLocalAABB( this.aabb );


	if ( this.orientation === 0 ) {
		this._half_width = 0;
		this._half_height = this.half_width;
		this._half_depth = this.half_length;
	} else if ( this.orientation === 1 ) {
		this._half_width = this.half_width;
		this._half_height = 0;
		this._half_depth = this.half_length;
	} else {
		this._half_width = this.half_width;
		this._half_height = this.half_length;
		this._half_depth = 0;
	}
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.PlaneShape.prototype.calculateLocalAABB = function( aabb ) {
    if ( this.orientation === 0 ) {
        this._half_width = 0;
        this._half_height = this.half_width;
        this._half_depth = this.half_length;

        aabb.min.x = 0;
        aabb.min.y = -this.half_width;
        aabb.min.z = -this.half_length;

        aabb.max.x = 0;
        aabb.max.y = this.half_width;
        aabb.max.z = this.half_length;
    } else if ( this.orientation === 1 ) {
        this._half_width = this.half_width;
        this._half_height = 0;
        this._half_depth = this.half_length;

        aabb.min.x = -this.half_width;
        aabb.min.y = 0;
        aabb.min.z = -this.half_length;

        aabb.max.x = this.half_width;
        aabb.max.y = 0;
        aabb.max.z = this.half_length;
    } else {
        this._half_width = this.half_width;
        this._half_height = this.half_length;
        this._half_depth = 0;

        aabb.min.x = -this.half_width;
        aabb.min.y = -this.half_length;
        aabb.min.z = 0;

        aabb.max.x = this.half_width;
        aabb.max.y = this.half_length;
        aabb.max.z = 0;
    }
};

Goblin.PlaneShape.prototype.getInertiaTensor = function( mass ) {
	var width_squared = this.half_width * this.half_width * 4,
		length_squared = this.half_length * this.half_length * 4,
		element = 0.0833 * mass,

		x = element * length_squared,
		y = element * ( width_squared + length_squared ),
		z = element * width_squared;

	if ( this.orientation === 0 ) {
		return new Goblin.Matrix3(
			y, 0, 0,
			0, x, 0,
			0, 0, z
		);
	} else if ( this.orientation === 1 ) {
		return new Goblin.Matrix3(
			x, 0, 0,
			0, y, 0,
			0, 0, z
		);
	} else {
		return new Goblin.Matrix3(
			y, 0, 0,
			0, z, 0,
			0, 0, x
		);
	}
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.PlaneShape.prototype.findSupportPoint = function( direction, support_point ) {
	/*
	 support_point = [
	 sign( direction.x ) * _half_width,
	 sign( direction.y ) * _half_height,
	 sign( direction.z ) * _half_depth
	 ]
	 */

	// Calculate the support point in the local frame
	if ( direction.x < 0 ) {
		support_point.x = -this._half_width;
	} else {
		support_point.x = this._half_width;
	}

	if ( direction.y < 0 ) {
		support_point.y = -this._half_height;
	} else {
		support_point.y = this._half_height;
	}

	if ( direction.z < 0 ) {
		support_point.z = -this._half_depth;
	} else {
		support_point.z = this._half_depth;
	}
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.PlaneShape.prototype.rayIntersect = (function(){
	var normal = new Goblin.Vector3(),
		ab = new Goblin.Vector3(),
		point = new Goblin.Vector3(),
		t;

	return function( start, end ) {
		if ( this.orientation === 0 ) {
			normal.x = 1;
			normal.y = normal.z = 0;
		} else if ( this.orientation === 1 ) {
			normal.y = 1;
			normal.x = normal.z = 0;
		} else {
			normal.z = 1;
			normal.x = normal.y = 0;
		}

		ab.subtractVectors( end, start );
		t = -normal.dot( start ) / normal.dot( ab );

		if ( t < 0 || t > 1 ) {
			return null;
		}

		point.scaleVector( ab, t );
		point.add( start );

		if ( point.x < -this._half_width || point.x > this._half_width ) {
			return null;
		}

		if ( point.y < -this._half_height || point.y > this._half_height ) {
			return null;
		}

		if ( point.z < -this._half_depth || point.z > this._half_depth ) {
			return null;
		}

		var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
		intersection.object = this;
		intersection.t = t * ab.length();
		intersection.point.copy( point );
		intersection.normal.copy( normal );

		return intersection;
	};
})();
/**
 * @class SphereShape
 * @param radius {Number} sphere radius
 * @constructor
 */
Goblin.SphereShape = function( radius ) {
	this.radius = radius;

	this.aabb = new Goblin.AABB();
	this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.SphereShape.prototype.calculateLocalAABB = function( aabb ) {
	aabb.min.x = aabb.min.y = aabb.min.z = -this.radius;
	aabb.max.x = aabb.max.y = aabb.max.z = this.radius;
};

Goblin.SphereShape.prototype.getInertiaTensor = function( mass ) {
	var element = 0.4 * mass * this.radius * this.radius;
	return new Goblin.Matrix3(
		element, 0, 0,
		0, element, 0,
		0, 0, element
	);
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in local coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.SphereShape.prototype.findSupportPoint = (function(){
	var temp = new Goblin.Vector3();
	return function( direction, support_point ) {
		temp.normalizeVector( direction );
		support_point.scaleVector( temp, this.radius );
	};
})();

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.SphereShape.prototype.rayIntersect = (function(){
	var direction = new Goblin.Vector3(),
		length;

	return function( start, end ) {
		direction.subtractVectors( end, start );
		length = direction.length();
		direction.scale( 1 / length  ); // normalize direction

		var a = start.dot( direction ),
			b = start.dot( start ) - this.radius * this.radius;

		// if ray starts outside of sphere and points away, exit
		if ( a >= 0 && b >= 0 ) {
			return null;
		}

		var discr = a * a - b;

		// Check for ray miss
		if ( discr < 0 ) {
			return null;
		}

		// ray intersects, find closest intersection point
		var discr_sqrt = Math.sqrt( discr ),
			t = -a - discr_sqrt;
		if ( t < 0 ) {
			t = -a + discr_sqrt;
		}

		// verify the segment intersects
		if ( t > length ) {
			return null;
		}

		var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
		intersection.object = this;
		intersection.point.scaleVector( direction, t );
		intersection.t = t;
		intersection.point.add( start );

        intersection.normal.normalizeVector( intersection.point );

		return intersection;
	};
})();
/**
 * @class TriangleShape
 * @param vertex_a {Vector3} first vertex
 * @param vertex_b {Vector3} second vertex
 * @param vertex_c {Vector3} third vertex
 * @constructor
 */
Goblin.TriangleShape = function( vertex_a, vertex_b, vertex_c ) {
	/**
	 * first vertex of the triangle
	 *
	 * @property a
	 * @type {Vector3}
	 */
	this.a = vertex_a;

	/**
	 * second vertex of the triangle
	 *
	 * @property b
	 * @type {Vector3}
	 */
	this.b = vertex_b;

	/**
	 * third vertex of the triangle
	 *
	 * @property c
	 * @type {Vector3}
	 */
	this.c = vertex_c;

	/**
	 * normal vector of the triangle
	 *
	 * @property normal
	 * @type {Goblin.Vector3}
	 */
	this.normal = new Goblin.Vector3();
	_tmp_vec3_1.subtractVectors( this.b, this.a );
	_tmp_vec3_2.subtractVectors( this.c, this.a );
	this.normal.crossVectors( _tmp_vec3_1, _tmp_vec3_2 );

	/**
	 * area of the triangle
	 *
	 * @property volume
	 * @type {Number}
	 */
	this.volume = this.normal.length() / 2;

	this.normal.normalize();

	this.aabb = new Goblin.AABB();
	this.calculateLocalAABB( this.aabb );
};

/**
 * Calculates this shape's local AABB and stores it in the passed AABB object
 *
 * @method calculateLocalAABB
 * @param aabb {AABB}
 */
Goblin.TriangleShape.prototype.calculateLocalAABB = function( aabb ) {
	aabb.min.x = Math.min( this.a.x, this.b.x, this.c.x );
	aabb.min.y = Math.min( this.a.y, this.b.y, this.c.y );
	aabb.min.z = Math.min( this.a.z, this.b.z, this.c.z );

	aabb.max.x = Math.max( this.a.x, this.b.x, this.c.x );
	aabb.max.y = Math.max( this.a.y, this.b.y, this.c.y );
	aabb.max.z = Math.max( this.a.z, this.b.z, this.c.z );
};

Goblin.TriangleShape.prototype.getInertiaTensor = function( mass ) {
	// @TODO http://www.efunda.com/math/areas/triangle.cfm
	return new Goblin.Matrix3(
		0, 0, 0,
		0, 0, 0,
		0, 0, 0
	);
};

Goblin.TriangleShape.prototype.classifyVertex = function( vertex ) {
	var w = this.normal.dot( this.a );
	return this.normal.dot( vertex ) - w;
};

/**
 * Given `direction`, find the point in this body which is the most extreme in that direction.
 * This support point is calculated in world coordinates and stored in the second parameter `support_point`
 *
 * @method findSupportPoint
 * @param direction {vec3} direction to use in finding the support point
 * @param support_point {vec3} vec3 variable which will contain the supporting point after calling this method
 */
Goblin.TriangleShape.prototype.findSupportPoint = function( direction, support_point ) {
	var dot, best_dot = -Infinity;

	dot = direction.dot( this.a );
	if ( dot > best_dot ) {
		support_point.copy( this.a );
		best_dot = dot;
	}

	dot = direction.dot( this.b );
	if ( dot > best_dot ) {
		support_point.copy( this.b );
		best_dot = dot;
	}

	dot = direction.dot( this.c );
	if ( dot > best_dot ) {
		support_point.copy( this.c );
	}
};

/**
 * Checks if a ray segment intersects with the shape
 *
 * @method rayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {RayIntersection|null} if the segment intersects, a RayIntersection is returned, else `null`
 */
Goblin.TriangleShape.prototype.rayIntersect = (function(){
	var d1 = new Goblin.Vector3(),
		d2 = new Goblin.Vector3(),
		n = new Goblin.Vector3(),
		segment = new Goblin.Vector3(),
		b = new Goblin.Vector3(),
		u = new Goblin.Vector3();

	return function( start, end ) {
		d1.subtractVectors( this.b, this.a );
		d2.subtractVectors( this.c, this.a );
		n.crossVectors( d1, d2 );

		segment.subtractVectors( end, start );
		var det = -segment.dot( n );

		if ( det <= 0 ) {
			// Ray is parallel to triangle or triangle's normal points away from ray
			return null;
		}

		b.subtractVectors( start, this.a );

		var t = b.dot( n ) / det;
		if ( 0 > t || t > 1 ) {
			// Ray doesn't intersect the triangle's plane
			return null;
		}

		u.crossVectors( b, segment );
		var u1 = d2.dot( u ) / det,
			u2 = -d1.dot( u ) / det;

		if ( u1 + u2 > 1 || u1 < 0 || u2 < 0 ) {
			// segment does not intersect triangle
			return null;
		}

		var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
		intersection.object = this;
		intersection.t = t * segment.length();
		intersection.point.scaleVector( segment, t );
		intersection.point.add( start );
		intersection.normal.copy( this.normal );

		return intersection;
	};
})();
Goblin.CollisionUtils = {};

Goblin.CollisionUtils.canBodiesCollide = function( object_a, object_b ) {
	if ( object_a._mass === Infinity && object_b._mass === Infinity ) {
		// Two static objects aren't considered to be in contact
		return false;
	}

	// Check collision masks
	if ( object_a.collision_mask !== 0 ) {
		if ( ( object_a.collision_mask & 1 ) === 0 ) {
			// object_b must not be in a matching group
			if ( ( object_a.collision_mask & object_b.collision_groups ) !== 0 ) {
				return false;
			}
		} else {
			// object_b must be in a matching group
			if ( ( object_a.collision_mask & object_b.collision_groups ) === 0 ) {
				return false;
			}
		}
	}
	if ( object_b.collision_mask !== 0 ) {
		if ( ( object_b.collision_mask & 1 ) === 0 ) {
			// object_a must not be in a matching group
			if ( ( object_b.collision_mask & object_a.collision_groups ) !== 0 ) {
				return false;
			}
		} else {
			// object_a must be in a matching group
			if ( ( object_b.collision_mask & object_a.collision_groups ) === 0 ) {
				return false;
			}
		}
	}

	return true;
};
/**
 * Provides methods useful for working with various types of geometries
 *
 * @class GeometryMethods
 * @static
 */
Goblin.GeometryMethods = {
	/**
	 * determines the location in a triangle closest to a given point
	 *
	 * @method findClosestPointInTriangle
	 * @param {vec3} p point
	 * @param {vec3} a first triangle vertex
	 * @param {vec3} b second triangle vertex
	 * @param {vec3} c third triangle vertex
	 * @param {vec3} out vector where the result will be stored
	 */
	findClosestPointInTriangle: (function() {
		var ab = new Goblin.Vector3(),
			ac = new Goblin.Vector3(),
			_vec = new Goblin.Vector3();

		return function( p, a, b, c, out ) {
			var v;

			// Check if P in vertex region outside A
			ab.subtractVectors( b, a );
			ac.subtractVectors( c, a );
			_vec.subtractVectors( p, a );
			var d1 = ab.dot( _vec ),
				d2 = ac.dot( _vec );
			if ( d1 <= 0 && d2 <= 0 ) {
				out.copy( a );
				return;
			}

			// Check if P in vertex region outside B
			_vec.subtractVectors( p, b );
			var d3 = ab.dot( _vec ),
				d4 = ac.dot( _vec );
			if ( d3 >= 0 && d4 <= d3 ) {
				out.copy( b );
				return;
			}

			// Check if P in edge region of AB
			var vc = d1*d4 - d3*d2;
			if ( vc <= 0 && d1 >= 0 && d3 <= 0 ) {
				v = d1 / ( d1 - d3 );
				out.scaleVector( ab, v );
				out.add( a );
				return;
			}

			// Check if P in vertex region outside C
			_vec.subtractVectors( p, c );
			var d5 = ab.dot( _vec ),
				d6 = ac.dot( _vec );
			if ( d6 >= 0 && d5 <= d6 ) {
				out.copy( c );
				return;
			}

			// Check if P in edge region of AC
			var vb = d5*d2 - d1*d6,
				w;
			if ( vb <= 0 && d2 >= 0 && d6 <= 0 ) {
				w = d2 / ( d2 - d6 );
				out.scaleVector( ac, w );
				out.add( a );
				return;
			}

			// Check if P in edge region of BC
			var va = d3*d6 - d5*d4;
			if ( va <= 0 && d4-d3 >= 0 && d5-d6 >= 0 ) {
				w = (d4 - d3) / ( (d4-d3) + (d5-d6) );
				out.subtractVectors( c, b );
				out.scale( w );
				out.add( b );
				return;
			}

			// P inside face region
			var denom = 1 / ( va + vb + vc );
			v = vb * denom;
			w = vc * denom;


			// At this point `ab` and `ac` can be recycled and lose meaning to their nomenclature

			ab.scale( v );
			ab.add( a );

			ac.scale( w );

			out.addVectors( ab, ac );
		};
	})(),

	/**
	 * Finds the Barycentric coordinates of point `p` in the triangle `a`, `b`, `c`
	 *
	 * @method findBarycentricCoordinates
	 * @param p {vec3} point to calculate coordinates of
	 * @param a {vec3} first point in the triangle
	 * @param b {vec3} second point in the triangle
	 * @param c {vec3} third point in the triangle
	 * @param out {vec3} resulting Barycentric coordinates of point `p`
	 */
	findBarycentricCoordinates: function( p, a, b, c, out ) {

		var v0 = new Goblin.Vector3(),
			v1 = new Goblin.Vector3(),
			v2 = new Goblin.Vector3();

		v0.subtractVectors( b, a );
		v1.subtractVectors( c, a );
		v2.subtractVectors( p, a );

		var d00 = v0.dot( v0 ),
			d01 = v0.dot( v1 ),
			d11 = v1.dot( v1 ),
			d20 = v2.dot( v0 ),
			d21 = v2.dot( v1 ),
			denom = d00 * d11 - d01 * d01;

		out.y = ( d11 * d20 - d01 * d21 ) / denom;
		out.z = ( d00 * d21 - d01 * d20 ) / denom;
		out.x = 1 - out.y - out.z;
	},

	/**
	 * Calculates the distance from point `p` to line `ab`
	 *
	 * @method findSquaredDistanceFromSegment
	 * @param p {vec3} point to calculate distance to
	 * @param a {vec3} first point in line
	 * @param b {vec3} second point in line
	 * @return {Number}
	 */
	findSquaredDistanceFromSegment: (function(){
		var ab = new Goblin.Vector3(),
			ap = new Goblin.Vector3(),
			bp = new Goblin.Vector3();

		return function( p, a, b ) {
			ab.subtractVectors( a, b );
			ap.subtractVectors( a, p );
			bp.subtractVectors( b, p );

			var e = ap.dot( ab );
			if ( e <= 0 ) {
				return ap.dot( ap );
			}

			var f = ab.dot( ab );
			if ( e >= f ) {
				return bp.dot( bp );
			}

			return ap.dot( ap ) - e * e / f;
		};
	})(),

	findClosestPointsOnSegments: (function(){
		var d1 = new Goblin.Vector3(),
			d2 = new Goblin.Vector3(),
			r = new Goblin.Vector3(),
			clamp = function( x, min, max ) {
				return Math.min( Math.max( x, min ), max );
			};

		return function( aa, ab, ba, bb, p1, p2 ) {
			d1.subtractVectors( ab, aa );
			d2.subtractVectors( bb, ba );
			r.subtractVectors( aa, ba );

			var a = d1.dot( d1 ),
				e = d2.dot( d2 ),
				f = d2.dot( r );

			var s, t;

			if ( a <= Goblin.EPSILON && e <= Goblin.EPSILON ) {
				// Both segments are degenerate
				s = t = 0;
				p1.copy( aa );
				p2.copy( ba );
				_tmp_vec3_1.subtractVectors( p1, p2 );
				return _tmp_vec3_1.dot( _tmp_vec3_1 );
			}

			if ( a <= Goblin.EPSILON ) {
				// Only first segment is degenerate
				s = 0;
				t = f / e;
				t = clamp( t, 0, 1 );
			} else {
				var c = d1.dot( r );
				if ( e <= Goblin.EPSILON ) {
					// Second segment is degenerate
					t = 0;
					s = clamp( -c / a, 0, 1 );
				} else {
					// Neither segment is degenerate
					var b = d1.dot( d2 ),
						denom = a * e - b * b;

					if ( denom !== 0 ) {
						// Segments aren't parallel
						s = clamp( ( b * f - c * e ) / denom, 0, 1 );
					} else {
						s = 0;
					}

					// find point on segment2 closest to segment1(s)
					t = ( b * s + f ) / e;

					// validate t, if it needs clamping then clamp and recompute s
					if ( t < 0 ) {
						t = 0;
						s = clamp( -c / a, 0, 1 );
					} else if ( t > 1 ) {
						t = 1;
						s = clamp( ( b - c ) / a, 0, 1 );
					}
				}
			}

			p1.scaleVector( d1, s );
			p1.add( aa );

			p2.scaleVector( d2, t );
			p2.add( ba );

			_tmp_vec3_1.subtractVectors( p1, p2 );
			return _tmp_vec3_1.dot( _tmp_vec3_1 );
		};
	})()
};
(function(){
	Goblin.MinHeap = function( array ) {
		this.heap = array == null ? [] : array.slice();

		if ( this.heap.length > 0 ) {
			this.heapify();
		}
	};
	Goblin.MinHeap.prototype = {
		heapify: function() {
			var start = ~~( ( this.heap.length - 2 ) / 2 );
			while ( start >= 0 ) {
				this.siftUp( start, this.heap.length - 1 );
				start--;
			}
		},
		siftUp: function( start, end ) {
			var root = start;

			while ( root * 2 + 1 <= end ) {
				var child = root * 2 + 1;

				if ( child + 1 <= end && this.heap[child + 1].valueOf() < this.heap[child].valueOf() ) {
					child++;
				}

				if ( this.heap[child].valueOf() < this.heap[root].valueOf() ) {
					var tmp = this.heap[child];
					this.heap[child] = this.heap[root];
					this.heap[root] = tmp;
					root = child;
				} else {
					return;
				}
			}
		},
		push: function( item ) {
			this.heap.push( item );

			var root = this.heap.length - 1;
			while ( root !== 0 ) {
				var parent = ~~( ( root - 1 ) / 2 );

				if ( this.heap[parent].valueOf() > this.heap[root].valueOf() ) {
					var tmp = this.heap[parent];
					this.heap[parent] = this.heap[root];
					this.heap[root] = tmp;
				}

				root = parent;
			}
		},
		peek: function() {
			return this.heap.length > 0 ? this.heap[0] : null;
		},
		pop: function() {
			var entry = this.heap[0];
			this.heap[0] = this.heap[this.heap.length - 1];
			this.heap.length = this.heap.length - 1;
			this.siftUp( 0, this.heap.length - 1 );

			return entry;
		}
	};
})();
Goblin.Utility = {
	getUid: (function() {
		var uid = 0;
		return function() {
			return uid++;
		};
	})()
};
/**
 * Engine-agnostic, reusable first-person character controller built directly on Goblin
 * (NOT `Goblin.CharacterController` — that's a separate, spring-based capsule controller; this
 * one is a kinematic box mover with its own ground/wall/slope/ghost handling). Uses a BOX
 * collider that is angular-locked so it can never tip. Grounding, slopes, walls and resting are
 * handled by hand-written raycast/sweep probes each tick, not by the physics solver — the
 * controller does NOT hard-teleport the body to the ground every frame (that fights the solver
 * and jitters). It only:
 *   - sets HORIZONTAL velocity from input each step (snappy, no momentum fighting),
 *   - projects that velocity along the ground plane (no sliding on slopes) and off walls
 *     (smooth move-and-slide, so we never ram the solver), and
 *   - applies targeted raycast assists for STEP-UP and STEP-DOWN, which the solver can't
 *     do with a box collider.
 * Vertical motion (gravity, landing) is left to the solver; only jump / jetpack thrust write
 * the vertical velocity directly.
 *
 * Also handles two further movement states parallel to ground/air: climbing a body tagged
 * isLadder (see _updateLadder), and riding a body tagged isPlatform via base-velocity inheritance
 * (see _baseVelocity in the constructor, and beginStep/endStep/_updateVertical) — jumping off a
 * rising platform adds its velocity into the jump.
 *
 * DESIGN SEAMS:
 *   The controller never reads input directly. Gameplay samples an input command (pure data, so
 *   any caller can run remote characters' commands through the exact same path) and feeds it in,
 *   bracketing a single Goblin world step:
 *       const cmd = mySampleInput(input);       // input mapping is policy, lives outside this class
 *       controller.beginStep(cmd, dt);           // pre-physics: velocity + assists
 *       world.step(dt);                          // ONE world step (all bodies)
 *       controller.endStep(dt);                  // post-physics: grounded + step-down
 *
 * EXTENSIBILITY:
 *   This base IS the default "kit" (instantiate it directly). A game adds an alternate kit by
 *   subclassing and overriding `_updateVertical` (jump/gravity) and/or `_getMoveSpeed` without
 *   touching ground/step/wall logic.
 *
 * Units: METERS (gravity -9.81 by default); defaults are in meters (a ~1.8m human ≈ 1.8 units
 * tall). Use `scale` to resize the whole character.
 *
 * @class FPSCharacterController
 * @constructor
 * @param {Goblin.World} world - The physics world this controller's body/ghost live in.
 * @param {Object} [options] - See FPS_CONTROLLER_DEFAULTS (FPSControllerConstants.js) for every
 *   tunable default and its meaning; each `options.X` below overrides that default per-instance.
 * @param {Goblin.Vector3} [options.position] - Spawn position (body center). Default (0,20,0).
 * @param {Number} [options.scale=1] - Uniform size multiplier for the whole character.
 * @param {Number} [options.width] - Collider width (x) before scale.
 * @param {Number} [options.depth] - Collider depth (z) before scale.
 * @param {Number} [options.height] - Collider height (y) before scale.
 * @param {Number} [options.mass] - Body mass before scale.
 * @param {Number} [options.eyeHeight] - Eye offset above body CENTER before scale.
 * @param {Number} [options.walkSpeed] - Held-walk gait speed before scale (slower than run).
 * @param {Number} [options.moveSpeed] - RUN speed (the default no-modifier gait) before scale.
 * @param {Number} [options.sprintSpeed] - Sprint move speed before scale.
 * @param {Number} [options.crouchSpeedMult] - Multiplier on the active gait while crouched.
 * @param {Number} [options.sprintDecay] - Rate (units/sec) the sprint boost fades after release.
 * @param {Number} [options.groundStopDecel] - Deceleration (units/sec) on releasing all move keys.
 * @param {Number} [options.airControl] - 0..1 horizontal steering authority per step while airborne.
 * @param {Number} [options.jumpSpeed] - Jump velocity before scale.
 * @param {Number} [options.friction] - Body friction (0 keeps wall-slides clean; kinematic
 *   grounding holds slopes without relying on solver friction).
 * @param {Number} [options.stepHeight] - Max step-UP height before scale.
 * @param {Number} [options.stepDownDist] - Max step-DOWN snap before scale.
 * @param {Number} [options.coyoteTime] - Seconds after leaving a ledge you can still jump (0=off).
 * @param {Number} [options.jumpBuffer] - Seconds before landing a jump press is remembered (0=off).
 * @param {Boolean} [options.slideEnabled=true] - Enable crouch-at-speed sliding.
 * @param {Boolean} [options.slideRequiresMoveInput=true] - Require a movement key held to START a slide (exit never requires it).
 * @param {Boolean} [options.slideAllowLandingWithoutInput=true] - Waive the movement-key requirement on the landing frame, so an impact-slide can start from crouch + speed alone.
 * @param {Number} [options.slideMinSpeed] - Min along-ground speed (pre-scale) to start a slide.
 * @param {Number} [options.slideEndSpeed] - Flat slide ends below this speed (pre-scale).
 * @param {Number} [options.slideFriction] - Speed bled per second on flat ground (pre-scale).
 * @param {Number} [options.slideBoost] - Launch speed multiplier at slide entry.
 * @param {Number} [options.slideControl] - 0..1 carve authority while sliding (speed-preserving).
 * @param {Number} [options.slideSlopeAccel] - Gravity-along-slope multiplier while sliding.
 * @param {Number} [options.slideSlopeMin] - Min slope (sin of angle) that sustains a slide via gravity.
 * @param {Number} [options.slideSlopeFriction] - Cross-slope bleed per second on a sustaining slope.
 * @param {Number} [options.slideReversalBrakeMult] - Multiplier on slideSlopeFriction for how hard a
 *   deliberate on-slope reversal (wish opposing current slide direction) brakes before the carve
 *   steering picks the new heading back up.
 * @param {Boolean} [options.receivePush=true] - Enable object-to-character knockback via the ghost body.
 * @param {Number} [options.receiveMaxSpeed] - Cap on how fast a single object hit can knock the character.
 * @param {Number} [options.receiveKnockbackFraction] - Fraction of the ghost's contact velocity transferred.
 * @param {Number} [options.maxSlopeAngle] - Max standable slope in degrees (90+ disables the limit).
 * @param {Boolean} [options.visible=false] - Whether a consumer should treat the collider as drawable
 *   (this controller does no rendering itself — see `object.isVisible`).
 * @param {String} [options.color] - Cosmetic color tag, opaque to this class.
 * @param {Number} [options.skin] - Contact/sweep tolerance override (see FPSC.SKIN).
 */
Goblin.FPSCharacterController = function(world, options) {
    this.world = world;
    var o = options || {};

    var D = Goblin.FPS_CONTROLLER_DEFAULTS;
    var dim = D.dimensions, mv = D.movement, jmp = D.jump, slp = D.slopes, sld = D.slide,
        gh = D.ghost, kb = D.knockback, net = D.netcode, vw = D.view, rnd = D.render, msc = D.misc,
        lad = D.ladder, man = D.mantle;

    // Base (pre-scale) values.
    this._baseWidth = o.width !== undefined ? o.width : dim.width;
    this._baseDepth = o.depth !== undefined ? o.depth : dim.depth;
    this._baseHeight = o.height !== undefined ? o.height : dim.height;
    this._baseMass = o.mass !== undefined ? o.mass : dim.mass;
    this._baseEyeHeight = o.eyeHeight !== undefined ? o.eyeHeight : this._baseHeight * dim.eyeHeightRatio;

    this._baseWalkSpeed = o.walkSpeed !== undefined ? o.walkSpeed : mv.walkSpeed;
    this._baseMoveSpeed = o.moveSpeed !== undefined ? o.moveSpeed : mv.moveSpeed;
    this._baseSprintSpeed = o.sprintSpeed !== undefined ? o.sprintSpeed : mv.sprintSpeed;
    this.crouchSpeedMult = o.crouchSpeedMult !== undefined ? o.crouchSpeedMult : mv.crouchSpeedMult;
    this._baseSprintDecay = o.sprintDecay !== undefined ? o.sprintDecay : mv.sprintDecay;
    this._baseGroundStopDecel = o.groundStopDecel !== undefined ? o.groundStopDecel : mv.groundStopDecel;
    this._baseJumpSpeed = o.jumpSpeed !== undefined ? o.jumpSpeed : jmp.jumpSpeed;
    this._baseStepHeight = o.stepHeight !== undefined ? o.stepHeight : jmp.stepHeight;
    this._baseStepDownDist = o.stepDownDist !== undefined ? o.stepDownDist : jmp.stepDownDist;
    // Contact/sweep tolerance. A per-instance override (not just FPSC.SKIN) lets a project tune this
    // for a specific character without touching the shared engine default.
    this._baseSkin = o.skin !== undefined ? o.skin : Goblin.FPSCharacterController.FPSC.SKIN;

    // Jump-off-a-platform base-velocity behavior — see _updateVertical. Two independent axes, opposite
    // defaults: VERTICAL fling (jumping off a rising elevator flings you higher) defaults ON — it's the
    // established, expected platforming feel and existing tests (PL3) depend on it. HORIZONTAL carry
    // (jumping off a moving/rotating platform keeps its sideways speed) defaults OFF — carrying a fast
    // platform's horizontal speed into a jump (especially a spinning platform's tangential speed) reads
    // as an unwanted "fling" rather than a clean jump; a project that wants the classic
    // conveyor-belt-momentum feel can opt back in per-instance.
    this._jumpKeepsVerticalBaseVelocity = o.jumpKeepsVerticalBaseVelocity !== undefined ? o.jumpKeepsVerticalBaseVelocity !== false : true;
    this._jumpKeepsHorizontalBaseVelocity = o.jumpKeepsHorizontalBaseVelocity === true;
    // A jump is the player's WISH to leave the surface — that wish should only ever be HELPED by the
    // platform's current vertical motion, never fought. Default true (opt-out): a platform descending
    // at jump time contributes nothing negative to the launch, only a rising one still flings higher
    // (via jumpKeepsVerticalBaseVelocity above). Scoped to the jump moment only — normal ground-follow
    // on a descending platform when NOT jumping is unaffected, still correctly rides it down.
    this._jumpIgnoresDescendingBaseVelocity = o.jumpIgnoresDescendingBaseVelocity !== undefined ? o.jumpIgnoresDescendingBaseVelocity !== false : true;

    // Object interaction (push and be pushed) runs through the ghost body (see _buildGhost / _readGhostKnockback).
    this._receivePush = o.receivePush !== undefined ? o.receivePush !== false : kb.receivePush;
    // Speed-like (a velocity cap), so it must scale with character size the same way sprintSpeed
    // does — stored as a BASE here and scaled in _applyScale, not a fixed literal, so a 2x
    // character's (faster, harder-hitting) knockback is judged against a 2x cap, not the 1x default.
    this._baseReceiveMaxSpeed = o.receiveMaxSpeed !== undefined ? o.receiveMaxSpeed : kb.maxSpeed;
    this._receiveKnockbackFraction = o.receiveKnockbackFraction !== undefined ? o.receiveKnockbackFraction : kb.knockbackFraction;
    this._receiveSelfPush = o.receiveSelfPush !== undefined ? o.receiveSelfPush === true : kb.selfPush;
    // Ghost body's physics material — read once here so _buildGhost (called on every rebuild:
    // crouch, setScale, respawn) doesn't need its own access to Goblin.FPS_CONTROLLER_DEFAULTS.
    this._ghostMaterial = o.ghostMaterial || gh.material;
    this._driveGhostDuringResim = o.driveGhostDuringResim !== undefined ? o.driveGhostDuringResim !== false : net.driveGhostDuringResim;
    this._hardsnapGhostOnReconcile = o.hardsnapGhostOnReconcile !== undefined ? o.hardsnapGhostOnReconcile !== false : net.hardsnapGhostOnReconcile;
    this._pushMassLimitOverride = o.pushMassLimit;
    this._pushMassBaseMult = gh.pushMassBaseMult;

    this.airControl = o.airControl !== undefined ? o.airControl : mv.airControl;
    this.friction = o.friction !== undefined ? o.friction : mv.friction;

    this.coyoteTime = o.coyoteTime !== undefined ? o.coyoteTime : jmp.coyoteTime;
    this.jumpBuffer = o.jumpBuffer !== undefined ? o.jumpBuffer : jmp.jumpBuffer;
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;

    // Max standable slope, in degrees. Stored as the cosine (_minStandableNormalY) since that's
    // what the per-tick ground-normal check compares against. 90 (or more) disables the limit.
    this.maxSlopeAngle = o.maxSlopeAngle !== undefined ? o.maxSlopeAngle : slp.maxSlopeAngle;
    this._minStandableNormalY = Math.cos(Math.min(90, this.maxSlopeAngle) * Math.PI / 180);
    this.climbSteepSlopes = o.climbSteepSlopes !== undefined ? o.climbSteepSlopes === true : slp.climbSteepSlopes;

    // Slide (crouch-at-speed). slide* tuning values only take effect once sliding.
    this.slideEnabled = o.slideEnabled !== undefined ? o.slideEnabled !== false : sld.enabled;
    this.slideRequiresMoveInput = o.slideRequiresMoveInput !== undefined ? !!o.slideRequiresMoveInput : sld.requiresMoveInput;
    this.slideAllowLandingWithoutInput = o.slideAllowLandingWithoutInput !== undefined ? !!o.slideAllowLandingWithoutInput : sld.allowLandingWithoutInput;
    this._baseSlideMinSpeed = o.slideMinSpeed !== undefined ? o.slideMinSpeed : sld.minSpeed;
    this._baseSlideEndSpeed = o.slideEndSpeed !== undefined ? o.slideEndSpeed : sld.endSpeed;
    this._baseSlideFriction = o.slideFriction !== undefined ? o.slideFriction : sld.friction;
    this.slideBoost = o.slideBoost !== undefined ? o.slideBoost : sld.boost;
    this.slideControl = o.slideControl !== undefined ? o.slideControl : sld.control;
    this.slideSlopeAccel = o.slideSlopeAccel !== undefined ? o.slideSlopeAccel : sld.slopeAccel;
    this.slideSlopeMin = o.slideSlopeMin !== undefined ? o.slideSlopeMin : sld.slopeMin;
    this._baseSlideSlopeFriction = o.slideSlopeFriction !== undefined ? o.slideSlopeFriction : sld.slopeFriction;
    // Reversal brake rate, as a multiplier on slideSlopeFriction — how hard a deliberate reversal
    // (wish opposing current slide direction, see FPSC.SLIDE_REVERSAL_DOT) bleeds speed before the
    // ordinary carve blend picks the new heading back up.
    this.slideReversalBrakeMult = o.slideReversalBrakeMult !== undefined ? o.slideReversalBrakeMult : sld.reversalBrakeMult;
    // Authoritative movement state — see the "Movement state machine" comment above endStep. Starts
    // AIRBORNE; the first tick's endStep probe corrects it (e.g. to WALK if spawned on the ground).
    this._moveState = Goblin.FPSCharacterController.FPSC.MOVE_AIRBORNE;
    this._slipJustEntered = false; // gates the SLIP branch's one-time velocity projection; set by endStep
    this._wantCrouch = false; // this tick's crouch intent, stashed by beginStep for endStep to read
    this._hasMoveInput = false; // this tick's movement input, stashed by beginStep for endStep to read
    this._prevCrouch = false;

    // Ladders (see _updateLadder). base* values scale with the character like every other speed.
    this._baseLadderClimbSpeed = o.ladderClimbSpeed !== undefined ? o.ladderClimbSpeed : lad.climbSpeed;
    this._baseLadderStrafeSpeed = o.ladderStrafeSpeed !== undefined ? o.ladderStrafeSpeed : lad.strafeSpeed;
    this._baseLadderMountReach = o.ladderMountReach !== undefined ? o.ladderMountReach : lad.mountReach;
    this._baseLadderDismountPushSpeed = o.ladderDismountPushSpeed !== undefined ? o.ladderDismountPushSpeed : lad.dismountPushSpeed;
    this._onLadder = false;
    this._ladderNormal = new Goblin.Vector3(0, 0, 1); // points OUT of the ladder face, toward the character

    // Mantle (ledge grab + pull-up arc, see _updateMantle / Movement/Mantle.js).
    var man = D.mantle;
    this._baseMantleHeight = o.mantleHeight !== undefined ? o.mantleHeight : man.height;
    this._baseMantleReach = o.mantleReach !== undefined ? o.mantleReach : man.reach;
    this._baseMantleSpeed = o.mantleSpeed !== undefined ? o.mantleSpeed : man.speed;
    this.mantleDuration = o.mantleDuration !== undefined ? o.mantleDuration : man.duration;
    this.mantleLiftFrac = o.mantleLiftFrac !== undefined ? o.mantleLiftFrac : man.liftFrac;
    this._mantleActive = false;
    this._mantleTimer = 0;
    // Arc anchors: body-center start (X/Y/Z), body-center Y once feet clear the ledge top, and the
    // XZ landing point past the ledge edge — all captured once at commit time (see _updateMantle's
    // detection block) so the arc interpolates position directly instead of driving velocity
    // through _collideAndSlide, which would treat the ledge face as a blocking wall.
    this._mantleStartX = 0;
    this._mantleStartY = 0;
    this._mantleStartZ = 0;
    this._mantleTopBodyY = 0;
    this._mantleLandX = 0;
    this._mantleLandZ = 0;

    // Moving platforms (see endStep's acquire + beginStep's apply). A body tagged isPlatform=true,
    // when it's what the ground probe is currently resting on, has its linear_velocity read into
    // this vector once per endStep. beginStep adds it into the horizontal move so collide-and-slide
    // carries the rider through real swept collision; it stays baked into gb.x/z afterward (position
    // integrates from gb on a LATER, separate world step, so subtracting it back out first would
    // discard the ride). _ownVelocityX/Z tracks the character's OWN horizontal velocity separately, so
    // endStep's groundStopDecel (and the sprint-decay branch) decay the character's momentum without
    // also decaying the platform's contribution. The vertical component is folded into a jump's
    // velocity ASSIGNMENT additively (not overwritten) in _updateVertical.
    this._baseVelocity = new Goblin.Vector3(0, 0, 0);
    this._ownVelocityX = 0;
    this._ownVelocityZ = 0;

    var g = world.gravity || { y: -9.81 };
    this._gravityVec = new Goblin.Vector3(0, g.y, 0);
    this._groundSuppress = 0;
    this._jumpRising = false; // see _updateVertical's jump branch + endStep's `suppressed`
    this._prevTopCandidateY = null; // last tick's highest ground candidate — see the slide-launch gate in endStep
    this._slideLaunched = false; // latched true the tick a slide apex launch fires; see endStep

    this._color = o.color || msc.color;
    this._visible = o.visible !== undefined ? o.visible === true : msc.visible;
    this._bodyName = o.bodyName || msc.bodyName;

    this.yaw = o.yaw !== undefined ? o.yaw : vw.yaw;
    this.pitch = o.pitch !== undefined ? o.pitch : vw.pitch;
    this.maxPitch = o.maxPitch !== undefined ? o.maxPitch : vw.maxPitch;

    // Live, render-only aim set per frame via aim(). Separate from yaw/pitch (the commanded,
    // networked, fixed-tick facing) so the view can update every frame without touching the
    // simulation. Falls back to yaw/pitch until aim() is called. See getLiveAimDirection().
    this._liveYaw = this.yaw;
    this._livePitch = this.pitch;
    this._liveAimSet = false;

    // Render interpolation: the body steps at the fixed tick but the screen draws at display
    // refresh. captureRenderState() stashes the last two fixed-tick eyes; renderEye(alpha) lerps
    // them for the draw. _renderSnapDist2 is the squared per-tick eye jump above which the
    // interpolation snaps instead of sliding (teleport/respawn).
    this._prevEye = null;
    this._currEye = null;
    // Base (scale-1) interp snap distance. The SQUARED, scale-adjusted value used at the compare site
    // is (re)derived in _applyScale — a scaled character legitimately moves the eye N× farther per tick,
    // so a fixed 1× threshold would read normal motion as a teleport and snap every tick (killing the
    // sub-tick smoothing → jitter at high scale).
    this._baseRenderSnapDist = o.renderSnapDist !== undefined ? o.renderSnapDist : rnd.snapDist;
    this._renderSnapDist2 = this._baseRenderSnapDist * this._baseRenderSnapDist;
    this._renderProxy = null;

    this.grounded = false;
    this.groundNormal = new Goblin.Vector3(0, 1, 0);
    this.velocityY = 0;
    // Vertical eye displacement this controller applied via the ground-clamp/crouch/scale snaps
    // (not from velocity integration). Render-only; a camera consumes it to smooth those snaps.
    this._viewDisplacementY = 0;
    // True while the caller is resimulating already-run commands (see beginResim/endResim).
    // View-displacement is suppressed during resim so re-derived state doesn't double-count.
    this._resimulating = false;

    // Crouch is an instant collider-height swap. crouchRatio is the fraction of standing
    // height when crouched.
    this.crouchRatio = o.crouchRatio !== undefined ? o.crouchRatio : dim.crouchRatio;
    this.crouching = false;

    // Opaque consumer payload; the controller never reads inside it. Rides the same
    // command->state->snapshot path as crouch/scale.
    this.userData = null;

    this.scale = 1;
    var spawnOpt = o.position;
    var spawn = spawnOpt ? new Goblin.Vector3(spawnOpt.x, spawnOpt.y, spawnOpt.z)
        : new Goblin.Vector3(msc.spawn.x, msc.spawn.y, msc.spawn.z);
    this._applyScale(o.scale !== undefined ? o.scale : msc.scale);
    this._buildBody(spawn);
};

var proto = Goblin.FPSCharacterController.prototype;

// Resolve scaled dimensions/speeds from the base values.
proto._applyScale = function(scale) {
    this.scale = scale;
    this.width = this._baseWidth * scale;
    this.depth = this._baseDepth * scale;
    // Standing dimensions, then the active height/eye reflect the crouch state.
    this.standHeight = this._baseHeight * scale;
    this.standEye = this._baseEyeHeight * scale;
    this.height = this.crouching ? this.standHeight * this.crouchRatio : this.standHeight;
    this.eyeHeight = this.crouching ? this.standEye * this.crouchRatio : this.standEye;
    this.mass = this._baseMass * scale * scale * scale; // volume scaling
    this.walkSpeed = this._baseWalkSpeed * scale;
    this.moveSpeed = this._baseMoveSpeed * scale;
    this.sprintSpeed = this._baseSprintSpeed * scale;
    this.sprintDecay = this._baseSprintDecay * scale; // excess-speed bleed rate (Infinity = instant)
    this.groundStopDecel = this._baseGroundStopDecel * scale; // idle ground stop rate (Infinity = instant hard-stop)
    this.slideMinSpeed = this._baseSlideMinSpeed * scale;
    this.slideEndSpeed = this._baseSlideEndSpeed * scale;
    this.slideFriction = this._baseSlideFriction * scale;
    this.slideSlopeFriction = this._baseSlideSlopeFriction * scale;
    this.jumpSpeed = this._baseJumpSpeed * Math.sqrt(scale); // jump height scales ~linearly
    this.stepHeight = this._baseStepHeight * scale;
    this.stepDownDist = this._baseStepDownDist * scale;
    this.ladderClimbSpeed = this._baseLadderClimbSpeed * scale;
    this.ladderStrafeSpeed = this._baseLadderStrafeSpeed * scale;
    this.ladderMountReach = this._baseLadderMountReach * scale;
    this.ladderDismountPushSpeed = this._baseLadderDismountPushSpeed * scale;
    this.mantleHeight = this._baseMantleHeight * scale;
    this.mantleReach = this._baseMantleReach * scale;
    this.mantleSpeed = this._baseMantleSpeed * scale;
    this._skin = this._baseSkin * scale; // contact tolerance
    this._groundTol = Goblin.FPSCharacterController.FPSC.GROUND_TOL * scale; // how close feet must be to count as grounded
    // Terminal fall speed. Also keeps per-step fall distance < ground-probe reach so
    // the raycast ground clamp can't be tunneled through on big drops.
    this._maxFall = 22 * scale;
    // Render interp snap threshold scales with the body: a 4x character sprints ~4x faster, so its eye
    // legitimately jumps ~4x farther per tick. Without this, that normal motion trips the teleport-snap
    // and the sub-tick smoother snaps every tick instead of easing — the high-scale render jitter.
    var rs = (this._baseRenderSnapDist || 0.8) * scale;
    this._renderSnapDist2 = rs * rs;
    // Push-mass eligibility limit scales with the character, mass-like (volume, scale^3).
    this._pushMassLimit = this._pushMassLimitOverride !== undefined ?
        this._pushMassLimitOverride : this._baseMass * scale * scale * scale * this._pushMassBaseMult;
    this._receiveMaxSpeed = this._baseReceiveMaxSpeed * scale;
};

/**
 * Resize the whole character at runtime (rebuilds the collider, feet planted).
 * @method setScale
 * @param {Number} scale
 */
proto.setScale = function(scale) {
    var p = this.body.position;
    var eyeBefore = p.y + this.eyeHeight;
    var feetY = p.y - this.height / 2;
    this._applyScale(scale);
    this._buildBody(new Goblin.Vector3(p.x, feetY + this.height / 2, p.z));
    if (!this._resimulating) { this._viewDisplacementY += this.body.position.y + this.eyeHeight - eyeBefore; } // eye jump from the resize
};

// Instantly enter/leave crouch by rebuilding the collider at the new height. Grounded: feet
// planted, top comes down. Airborne: top planted, feet rise up (crouch-jump clearance aid).
proto._setCrouch = function(want) {
    if (want === this.crouching) { return; }
    var p = this.body.position;
    var eyeBefore = p.y + this.eyeHeight;
    var feetY = p.y - this.height / 2;
    var headY = p.y + this.height / 2;
    this.crouching = want;
    this._applyScale(this.scale); // recompute height/eye for the new crouch state
    var newCenterY = this.grounded ? (feetY + this.height / 2) : (headY - this.height / 2);
    this._buildBody(new Goblin.Vector3(p.x, newCenterY, p.z));
    if (!this._resimulating) { this._viewDisplacementY += this.body.position.y + this.eyeHeight - eyeBefore; } // eye jump from the crouch swap
};

/**
 * Add a velocity impulse and force the character airborne (explosions / knockback / rocket-jumping).
 * @method applyKnockback
 */
proto.applyKnockback = function(vx, vy, vz) {
    var gb = this.body.linear_velocity;
    gb.x += vx;
    gb.y += vy;
    gb.z += vz;
    this.grounded = false;
    this._moveState = Goblin.FPSCharacterController.FPSC.MOVE_AIRBORNE;
    this._groundSuppress = 10;
    this.velocityY = gb.y;
};

// ---- Lifecycle ---------------------------------------------------------

/**
 * @method setPosition
 * @param {Goblin.Vector3} pos
 */
proto.setPosition = function(pos) {
    this.body.position.set(pos.x, pos.y, pos.z);
    this.body.updateDerived();
    this.body.linear_velocity.set(0, 0, 0);
    this.grounded = false;
    this._moveState = Goblin.FPSCharacterController.FPSC.MOVE_AIRBORNE;
    if (this._ghost) {
        var inset = this._ghostGroundInset || 0;
        this._ghost.position.set(pos.x, pos.y + inset / 2, pos.z);
        this._ghost.linear_velocity.set(0, 0, 0);
    }
};

/**
 * @method destroy
 */
proto.destroy = function() {
    this.world.removeRigidBody(this.body);
    this._destroyGhost();
};

// Internal statics for FPSCharacterController: algorithm constants (FPSC) and the private raycast
// helper. LOAD ORDER REQUIREMENT: this file must load AFTER FPSCharacterController.js (which defines
// `Goblin.FPSCharacterController` as the constructor function) — these assignments attach static
// properties onto that function object, so the function must already exist. Nothing at module-load
// time in any other file reads FPSC/`_raycast` before first use (only inside function bodies invoked
// later, e.g. at `new Goblin.FPSCharacterController(...)` time), so this ordering is safe. See
// gulpfile.js's buildOrder comment for the explicit ordering this depends on.

// Internal algorithm constants — the thresholds/epsilons/factors baked into the controller's collision,
// grounding, slope and ghost math. These are NOT caller-facing feel knobs (those live in
// FPS_CONTROLLER_DEFAULTS); they are implementation tolerances kept named here so nothing is a bare literal
// at a use site. Changing them changes solver behavior — treat as internals, not tuning.
Goblin.FPSCharacterController.FPSC = {
    // Contact tolerances (metres, multiplied by the character scale where used).
    SKIN: 0.01,               // sweep/contact skin width
    GROUND_TOL: 0.1,          // how close the feet must be to a surface to count as grounded
    GHOST_GROUND_INSET: 0.25, // fraction of height the ghost's bottom is lifted above the feet

    // "Effectively zero" epsilons — vector/speed magnitudes below which we treat a quantity as null.
    EPS_LEN: 1e-4,            // general length/normal guard
    EPS_DIR: 1e-5,            // direction-normalisation guard
    EPS_SPD: 1e-6,            // speed-normalisation guard
    EPS_INPUT2: 1e-10,        // squared move-input threshold (has-input test)
    EPS_SPEED_MARGIN: 1e-3,   // speed must exceed a target by this to count as "above" it

    // Ground-normal.y classifiers (a surface normal's up-component; 1 = flat floor, 0 = vertical wall).
    NY_CEILING: -0.4,         // normal.y ABOVE this is not a ceiling (must face downward to be one)
    NY_STEEP_MIN: 0.3,        // steep-but-not-wall floor-like face lower bound
    NY_GROUNDISH: 0.5,        // normal.y at/above this is walkable-ish ground (skip as a wall/step)
    NY_FLOORLIKE: 0.1,        // normal.y above this tilts up (floor-like), below is a vertical wall
    N_DEGENERATE: 0.5,        // reject a contact normal whose length is below this (bad EPA result)
    TOE_BAND_FRAC: 0.6,       // a too-steep floor-like contact only blocks as a slope-toe within this
                              // fraction of body height above the feet; higher is an overhang (headroom
                              // gate's job), not a wall to clip horizontal velocity against

    // Slide reversal (see _updateSlide's onSlope steering). Below this dot product between wish and
    // current slide direction, wish counts as a deliberate reversal (brake) rather than a carve.
    SLIDE_REVERSAL_DOT: -0.5,

    // MOVEMENT STATE — one flat enum, mutually exclusive, decided ONCE per tick by endStep (the only
    // place with a fresh ground probe) and read everywhere else (beginStep dispatches on it verbatim;
    // nothing re-derives it from other flags). See the "Movement state machine" comment above endStep
    // for the full design and why it replaced the old grounded+sliding+wishSlide flag soup.
    //   LADDER   = mounted on a ladder; _updateLadder owns velocity fully.
    //   AIRBORNE = no ground contact; gravity + air control own velocity.
    //   WALK     = grounded, standable surface, not sliding: ordinary input-driven movement.
    //   SLIP     = grounded, too-steep surface, not sliding: gravity-fed slip, weak air-control.
    //   SLIDE    = grounded, crouch-at-speed slide: _updateSlide's surface-tracking model owns velocity.
    MOVE_LADDER: 'ladder',
    MOVE_AIRBORNE: 'airborne',
    MOVE_WALK: 'walk',
    MOVE_SLIP: 'slip',
    MOVE_SLIDE: 'slide',
    MOVE_MANTLE: 'mantle',

    // Mantle: a grounded (flat-footed) mantle tap is only allowed up to this fraction of standHeight
    // (roughly chest height) — anything taller needs a running jump first (see _updateMantle).
    MANTLE_CHEST_HEIGHT_FRAC: 0.77,

    // Knockback gating (see _readGhostKnockback).
    KB_CLOSING_MIN: 0.5,      // object must close on the character faster than this (units/s) to knock back
    KB_MIN: 0.05,             // ignore a computed knockback smaller than this

    // Ground-suppress frame counts — ticks the ground clamp is held off after an event.
    GROUND_SUPPRESS_KB: 5,    // after taking knockback
    GROUND_SUPPRESS_JUMP: 8,  // after jumping

    // Sweep sub-stepping + wall interaction.
    SUBSTEP_FRAC: 0.5,        // sub-step length as a fraction of the smallest half-extent
    NEAR_CENTER_FRAC: 0.4,    // "hit near my centre" band as a fraction of width
    PUSH_INTO_MIN: 0.5,       // dot(vel, toHit) above this = actively moving into a contact

    // Wall clip / step-up / depenetration.
    KEEP_BLOCKED: 0.01,       // keep-fraction below this = a non-yielding wall (fully blocks / triggers step-up)
    NY_NEAR_VERTICAL: 0.2,    // |normal.y| below this = a near-vertical face (steppable candidate)
    // Depenetration back-probe step, as a fraction of the character's own half-width — independent of
    // skin (skin is a contact/tunneling tolerance, not a "how fast should a buried body recover" rate;
    // coupling the two meant shrinking skin for tunneling reasons silently crippled buried-recovery speed).
    BACKPROBE_WIDTH_FRAC: 0.1,
    // Climbable-slope look-ahead sample points, as multiples of the character's DEPTH past the footprint
    // edge (so the probe reaches the same RELATIVE forward zone at any scale — a fixed-meter reach would
    // under-reach a big character and over-reach a small one, breaking steep-slope walk off default scale).
    CLIMB_PROBE_DEPTH_MULTS: [0, 0.5, 1.0, 1.67],

    // Render.
    VIEW_DISP_SNAP: 0.01,     // pending view-displacement above which eye interpolation snaps (crouch/step)
};

/**
 * Cast a ray from start to end in the physics world, kept private since nothing outside the
 * CharacterController subsystem needs it. Returns the first valid hit (nearest first, skipping
 * anything named in `ignoreObjects`), or null.
 *
 * @method _raycast
 * @private
 * @static
 * @param {Goblin.World} world
 * @param {Goblin.Vector3} start
 * @param {Goblin.Vector3} end
 * @param {String[]} [ignoreObjects] - body `.name` values to skip
 * @return {Object|null} { object, point:Vector3, normal:Vector3, t:Number } or null
 */
Goblin.FPSCharacterController._raycast = function(world, start, end, ignoreObjects) {
    var hits = world.rayIntersect(start, end);
    if (!hits || hits.length === 0) { return null; }
    for (var i = 0; i < hits.length; i++) {
        var hit = hits[i];
        if (hit.object && hit.object.name && ignoreObjects &&
            ignoreObjects.indexOf(hit.object.name) !== -1) { continue; }
        return hit;
    }
    return null;
};

// Character body lifecycle: creates/recreates the kinematic box collider the character controller
// drives (see _buildBody), and the shared material-application helper used by both the character
// body and its ghost (see Ghost.js).
var proto = Goblin.FPSCharacterController.prototype;

/**
 * Apply this controller's material/behavior defaults + explicit overrides to a freshly created body.
 * Shared by the character's own body (Body.js) and its ghost (Ghost.js).
 *
 * @method _applyMaterial
 * @private
 * @static
 * @param {Goblin.RigidBody} body
 * @param {Object} [opts]
 * @param {Number} [opts.friction=3.0]
 * @param {Number} [opts.restitution=0.33]
 * @param {Number} [opts.linearDamping=0.1]
 * @param {Number} [opts.angularDamping=0.9]
 * @param {Goblin.Vector3} [opts.gravity] - if set, overrides the body's gravity via setGravity.
 */
Goblin.FPSCharacterController._applyMaterial = function(body, opts) {
    opts = opts || {};
    body.friction = opts.friction !== undefined ? opts.friction : 3.0;
    body.restitution = opts.restitution !== undefined ? opts.restitution : 0.33;
    body.linear_damping = opts.linearDamping !== undefined ? opts.linearDamping : 0.1;
    body.angular_damping = opts.angularDamping !== undefined ? opts.angularDamping : 0.9;
    if (opts.gravity) { body.setGravity(opts.gravity.x, opts.gravity.y, opts.gravity.z); }
};

/**
 * (Re)create the box body at a position, preserving look + velocity where possible.
 * @method _buildBody
 * @private
 * @param {Goblin.Vector3} position
 */
proto._buildBody = function(position) {
    var carriedVel = null;
    if (this.body) {
        var v = this.body.linear_velocity;
        carriedVel = { x: v.x, y: v.y, z: v.z };
        this.world.removeRigidBody(this.body);
    }
    this._destroyGhost();

    var shape = new Goblin.BoxShape(this.width / 2, this.height / 2, this.depth / 2);
    this.body = new Goblin.RigidBody(shape, this.mass);
    Goblin.FPSCharacterController._applyMaterial(this.body, {});
    this.body.position.copy(position);
    this.body.updateDerived();
    // `object` is the lightweight cosmetic handle a consumer (renderer) can use to decide whether/how
    // to draw the collider. This controller never renders anything itself.
    this.object = { body: this.body, isVisible: this._visible };

    // Never tip; resting/slopes/walls handled by the solver (gravity + friction).
    this.body.angular_factor.set(0, 0, 0);
    this.body.friction = this.friction;
    this.body.restitution = 0;
    this.body.linear_damping = 0;
    this.body.angular_damping = 0;

    // Tag our physics body so raycasts can ignore ourselves. Also ignore the ghost's name so the
    // kinematic body's own probing raycasts never treat its own trailing ghost as a wall.
    this.body.name = this._bodyName;
    this._ignoreSelf = [this._bodyName, this._bodyName + "_ghost"];
    // Mark this as a kinematic character body so OTHER characters' receive-push pass skips it
    // (character-vs-character is already handled by collide-and-slide treating each other as walls;
    // the body-push coupling is only meant for free dynamic objects).
    this.body.isKinematicCharacter = true;

    // Exclude the character from ALL solver contacts (mask bit 1 = only collide with bodies sharing a
    // matching group; world geometry is group 0). The body still integrates and is still
    // raycast-queryable. Collision is done entirely via raycasts (ground clamp + collide-and-slide),
    // so the solver can never fight the control loop.
    this.body.collision_mask = 1;

    if (carriedVel) { this.body.linear_velocity.set(carriedVel.x, carriedVel.y, carriedVel.z); }

    this.world.addRigidBody(this.body);
    this._buildGhost(position, carriedVel);
};

// Ghost body lifecycle: a solver-participating dynamic body that trails the kinematic character for
// object-contact purposes. The character's own body is excluded from solver contacts (collision_mask
// 1); the ghost is its stand-in for object contact. Control is one-way: character position -> ghost
// target. The ghost's position never writes back to the character; only contact-derived knockback
// flows back (_syncGhost / _readGhostKnockback), as a velocity nudge. See _syncGhost.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * GHOST: a solver-participating dynamic body that trails the kinematic character. The character's own
 * body is excluded from solver contacts (collision_mask 1); the ghost is its stand-in for object
 * contact. Control is one-way: character position -> ghost target. The ghost's position never writes
 * back to the character; only contact-derived knockback flows back (_syncGhost), as a velocity nudge.
 *
 * @method _buildGhost
 * @private
 * @param {Goblin.Vector3} position - the character body's current position.
 * @param {Object} [carriedVel] - {x,y,z} velocity to seed the ghost with (carried over a rebuild).
 */
proto._buildGhost = function(position, carriedVel) {
    // Ghost bottom is inset above the character's feet so it doesn't overlap a surface the character is
    // standing on (that's _probeGround's job). Top is unchanged, so head-height contact is unaffected.
    var groundInset = this.height * FPSC.GHOST_GROUND_INSET;
    var ghostHeight = this.height - groundInset;
    var ghostPos = new Goblin.Vector3(position.x, position.y + groundInset / 2, position.z);
    var ghostShape = new Goblin.BoxShape(this.width / 2, ghostHeight / 2, this.depth / 2);
    this._ghost = new Goblin.RigidBody(ghostShape, this.mass);
    Goblin.FPSCharacterController._applyMaterial(this._ghost, {
        friction: this._ghostMaterial.friction,
        restitution: this._ghostMaterial.restitution,
        linearDamping: this._ghostMaterial.linearDamping,
        angularDamping: this._ghostMaterial.angularDamping,
        gravity: new Goblin.Vector3(0, 0, 0)
    });
    this._ghost.position.copy(ghostPos);
    this._ghost.updateDerived();
    this._ghostObject = { body: this._ghost, isVisible: false };
    this._ghostCommandedVel = null;
    this._ghost.name = this._bodyName + "_ghost";
    this._ghost.angular_factor.set(0, 0, 0);
    this._ghost.isKinematicCharacter = true;
    // Distinguishes this body from a real character body for OTHER controllers' sweeps: their own
    // kinematic body is never a wall (it has no mass to yield against), but this ghost IS a real
    // solver-participating mass and should block/get pushed like any other object.
    this._ghost.isCharacterGhost = true;
    this._ghostGroundInset = groundInset;
    if (carriedVel) { this._ghost.linear_velocity.set(carriedVel.x, carriedVel.y, carriedVel.z); }
    this.world.addRigidBody(this._ghost);
};

/**
 * Remove and clear the ghost body, if any (called before every rebuild + on destroy()).
 * @method _destroyGhost
 * @private
 */
proto._destroyGhost = function() {
    if (this._ghostObject) {
        this.world.removeRigidBody(this._ghost);
        this._ghostObject = null;
        this._ghost = null;
    }
};

/**
 * Drive the ghost toward the character each tick and read back contact-driven knockback. Called once
 * per endStep, after the character's position is settled.
 *
 * @method _syncGhost
 * @private
 * @param {Number} dt
 */
proto._syncGhost = function(dt) {
    if (!this._ghost) { return; }
    var p = this.body.position;
    var cv = this.body.linear_velocity;
    var gp = this._ghost.position;
    // Target where the character WILL BE at the end of this tick (p + v*dt), not where it is right
    // now — closing "the gap as of the start of the tick" is already stale by the time it's applied,
    // since the character moves by v*dt over that same tick. Without this the ghost permanently lags
    // by ~one tick's worth of the character's own motion, growing with speed, even at constant
    // velocity (no acceleration needed to produce it).
    var targetX = p.x + cv.x * dt;
    var targetY = p.y + cv.y * dt + (this._ghostGroundInset || 0) / 2;
    var targetZ = p.z + cv.z * dt;
    var dx = targetX - gp.x, dy = targetY - gp.y, dz = targetZ - gp.z;
    var gap = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var gv = this._ghost.linear_velocity;

    // A gap this large is a rebuild/respawn/teleport: beam the ghost to the character instead of chasing.
    var teleportDist = Math.max(this.width, this.height) * 2;
    if (gap > teleportDist) {
        this._ghost.position.set(p.x, p.y + (this._ghostGroundInset || 0) / 2, p.z);
        gv.set(0, 0, 0);
        this._ghostCommandedVel = { x: 0, y: 0, z: 0 };
        return;
    }

    // Knockback signal = (ghost's actual velocity) - (velocity the drive commanded last tick). This
    // runs during resim too: an authority that never resims applies knockback in its own live step, so
    // skipping it here while resimulating would reconcile the character's velocity to a value that
    // permanently disagrees with authority by the knockback amount. It only needs to be deterministic
    // run-to-run (it is — the read is a pure function of the current contact state).
    this._readGhostKnockback();

    // Drive the ghost directly at the velocity that closes the (predicted) gap this tick. No cap:
    // any cap below the gap-closing speed just reintroduces a residual gap on fast motion — the
    // predicted-target math above already keeps this bounded and small under normal conditions.
    gv.x = dx / dt; gv.y = dy / dt; gv.z = dz / dt;

    // Clip the ghost's horizontal velocity through the same swept collide-and-slide the character uses.
    var clip = this._sweptCollideAndSlide({
        position: new Goblin.Vector3(gp.x, gp.y, gp.z),
        width: this.width, depth: this.depth, height: this.height - (this._ghostGroundInset || 0),
        skin: this._skin, mass: this.mass, stepHeight: 0,
        selfBody: this._ghost, otherSelfBody: this.body,
        climbSteepSlopes: false,
        vx: gv.x, vz: gv.z, dt: dt,
    });
    gv.x = clip.x; gv.z = clip.z;
    if (clip.depenX !== 0 || clip.depenZ !== 0) {
        this._ghost.position.set(gp.x + clip.depenX, gp.y, gp.z + clip.depenZ);
    }

    this._ghostCommandedVel = { x: gv.x, y: gv.y, z: gv.z }; // baseline for next tick's (actual - commanded) knockback read
};

/**
 * Knockback speed = mass ratio (objectMass/(objectMass+playerMass)) x the object's closing speed
 * onto the character, gated to only apply when the object is moving into the character above a small
 * momentum floor. Horizontal only; never moves position, only velocity.
 *
 * @method _readGhostKnockback
 * @private
 */
proto._readGhostKnockback = function() {
    if (!this._receivePush) { return; }
    var world = this.world;
    if (!world || !world.narrowphase) { return; }
    var ghostBody = this._ghost;
    var pb = this.body.linear_velocity;
    var mP = this.mass;

    var manifold = world.narrowphase.contact_manifolds.first;
    while (manifold) {
        var other =
            manifold.object_a === ghostBody ? manifold.object_b :
            manifold.object_b === ghostBody ? manifold.object_a : null;
        // A player is a wall, not a pushable object — no knockback from another player's ghost.
        if (other && other._mass !== Infinity && other._mass > 0 && !other.isKinematicCharacter) {
            var mB = other._mass;
            var ov = other.linear_velocity;
            var nx = this._ghost.position.x - other.position.x;
            var nz = this._ghost.position.z - other.position.z;
            var nlen = Math.sqrt(nx * nx + nz * nz);
            if (nlen > FPSC.EPS_LEN) { nx /= nlen; nz /= nlen; } else { nx = 0; nz = 0; }
            // n points box->character. The knockback should trigger on how fast the BOX is coming at you
            // (ov.n), NOT the relative closing speed (ov-pb).n. Using the relative speed folds in YOUR
            // OWN approach velocity (-pb.n > 0 when you walk into the box), so pushing a box knocked you
            // backward every tick — you push, it shoves you back, you re-approach: a limit cycle that
            // renders as the box micro-oscillating toward/away from you at close range. Gating on the
            // box's own inbound speed means a box only knocks you when IT carries momentum at you
            // (someone else shoved it, an explosion) — your own push no longer bounces back. Opt-out via
            // receiveSelfPush to restore the old relative-speed behavior.
            var closing = this._receiveSelfPush ?
                (ov.x - pb.x) * nx + (ov.z - pb.z) * nz :   // legacy: relative closing (self-push included)
                ov.x * nx + ov.z * nz;                      // box's own inbound speed only
            if (closing > FPSC.KB_CLOSING_MIN) {
                var massRatio = mB / (mB + mP);
                var kbv = massRatio * closing;
                if (kbv > this._receiveMaxSpeed) { kbv = this._receiveMaxSpeed; }
                kbv *= this._receiveKnockbackFraction;
                // Cap the RESULTING along-n speed, not just this tick's increment: clamping only kb
                // bounds each tick's contribution but not the running total, so sustained contact (a
                // heavy object pressed against the character for many ticks) adds another kb-worth of speed
                // every tick and blows straight past receiveMaxSpeed. Clamp what the character's velocity
                // ALONG n would become after this tick's push to receiveMaxSpeed instead — a fresh hit
                // (little/no existing along-n speed) still gets up to the full kb, but once already at
                // the cap from prior contact, further ticks add nothing more.
                var alongN = pb.x * nx + pb.z * nz;
                var room = this._receiveMaxSpeed - alongN;
                if (room > 0) { kbv = Math.min(kbv, room); } else { kbv = 0; }
                if (kbv > FPSC.KB_MIN) {
                    pb.x += nx * kbv;
                    pb.z += nz * kbv;
                    this.grounded = false;
                    // This runs mid-tick, inside beginStep's ghost sync — the movement-state dispatch
                    // for THIS tick already ran (it's earlier in beginStep), so this can't retroactively
                    // change what velocity model owned this tick's motion. It CAN and must fix what the
                    // NEXT tick sees: without this, next tick's dispatch would read the stale grounded
                    // sub-state (WALK) and immediately re-clamp the character back onto the ground via
                    // WALK's kinematic model, killing the knockback before it ever got airborne.
                    this._moveState = FPSC.MOVE_AIRBORNE;
                    if (this._groundSuppress < FPSC.GROUND_SUPPRESS_KB) { this._groundSuppress = FPSC.GROUND_SUPPRESS_KB; }
                }
            }
            break;
        }
        manifold = manifold.next_manifold;
    }
};

// Ground/ceiling/ladder raycast probes: the hand-written spatial queries beginStep/endStep read each
// tick to decide grounding, standable-slope classification, headroom, and ladder mounting. No probe
// here writes any sim state itself — each one just reports what's in the world.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;
var raycast = Goblin.FPSCharacterController._raycast;

/**
 * Multi-point ground probe (center + four edge midpoints). Returns ALL floor-like hits, highest
 * first — NOT collapsed to a single "best" here, because the caller needs to fall back to a
 * lower (but valid) hit when the highest one is rejected as too tall to step onto (e.g. one edge
 * ray grazing a box pushed against the footprint, while the other four rays are still squarely
 * over real floor). Collapsing to one hit here would throw the floor away before the caller ever
 * gets a chance to prefer it.
 * @method _probeGroundCandidates
 * @private
 * @param {Number} maxSnap - max downward reach (below the feet) to probe, before scale/skin margins.
 * @return {Object[]} floor-like raycast hits, sorted highest point.y first.
 */
proto._probeGroundCandidates = function(maxSnap) {
    var half = this.height / 2;
    var p = this.body.position;
    // Cast from the higher of this tick's start position and the current position, so a fast
    // descent that penetrated the floor this tick doesn't miss it.
    var topY = Math.max(this._prevY !== undefined ? this._prevY : p.y, p.y) + this._skin;
    var bottomY = p.y - (half + maxSnap + this._skin);
    var ix = this.width / 2 - this._skin;
    var iz = this.depth / 2 - this._skin;
    var offsets = [[0, 0], [ix, 0], [-ix, 0], [0, iz], [0, -iz]];

    var candidates = [];
    for (var i = 0; i < offsets.length; i++) {
        var ox = offsets[i][0];
        var oz = offsets[i][1];
        var start = new Goblin.Vector3(p.x + ox, topY, p.z + oz);
        var end = new Goblin.Vector3(p.x + ox, bottomY, p.z + oz);
        var hit = raycast(this.world, start, end, this._ignoreSelf);
        if (!hit || hit.normal.y < FPSC.NY_FLOORLIKE) { continue; }
        // Exclude a pushable object as ground only when walking INTO its side (pushing it), not
        // when it's roughly under our own center (standing on it).
        var gm = hit.object && hit.object._mass;
        var isPushable = gm !== undefined && gm !== Infinity && gm > 0 && isFinite(gm) && gm <= this._pushMassLimit;
        if (isPushable) {
            var gv = this.body.linear_velocity;
            var toHitX = hit.point.x - p.x, toHitZ = hit.point.z - p.z;
            var towardLen = Math.sqrt(toHitX * toHitX + toHitZ * toHitZ);
            var movingIntoIt = towardLen > FPSC.EPS_LEN &&
                (gv.x * toHitX + gv.z * toHitZ) / towardLen > FPSC.PUSH_INTO_MIN;
            var nearCenter = towardLen < this.width * FPSC.NEAR_CENTER_FRAC;
            if (movingIntoIt && !nearCenter) { continue; }
        }
        candidates.push(hit);
    }
    candidates.sort(function(a, b) { return b.point.y - a.point.y; });
    return candidates;
};

/**
 * Multi-ray UP probe across the footprint. Returns the LOWEST ceiling (down-facing
 * surface) within `reachAboveFeet` of the feet, or null. Mirror of _probeGround; covers
 * sloped overhead geometry (e.g. a ramp underside) that forward rays can't see.
 *
 * @method _probeCeiling
 * @private
 * @param {Number} reachAboveFeet - how far above the feet to scan.
 * @return {Object|null} the lowest down-facing hit within reach, or null.
 */
proto._probeCeiling = function(reachAboveFeet) {
    var p = this.body.position;
    var feetY = p.y - this.height / 2;
    var startY = feetY + this._skin;
    var endY = feetY + reachAboveFeet + this._skin;
    var ix = this.width / 2 - this._skin;
    var iz = this.depth / 2 - this._skin;
    var offsets = [[0, 0], [ix, 0], [-ix, 0], [0, iz], [0, -iz]];
    var best = null;
    for (var i = 0; i < offsets.length; i++) {
        var ox = offsets[i][0];
        var oz = offsets[i][1];
        var hit = this._raycastSkipPlatforms(
            new Goblin.Vector3(p.x + ox, startY, p.z + oz),
            new Goblin.Vector3(p.x + ox, endY, p.z + oz)
        );
        if (!hit || hit.normal.y > FPSC.NY_CEILING) { continue; } // not a ceiling (must face downward)
        if (!best || hit.point.y < best.point.y) { best = hit; }
    }
    return best;
};

/**
 * Same contract as the private _raycast helper (skips this._ignoreSelf by .name, returns the first
 * remaining hit), but ALSO skips any hit body tagged isPlatform. A scripted moving platform is
 * deliberately excluded from the solver's own contact resolution (see _baseVelocity's constructor
 * comment / platform()'s collision_mask) so a rider is carried via scripted base-velocity, never a
 * real physical shove — but a raw raycast doesn't consult collision_mask at all, so without this a
 * fast-rising platform that catches back up to a character mid-jump gets misread as a solid ceiling
 * overhead by _ceilingSlide, capping the jump's vertical velocity and killing it a few ticks after
 * liftoff, even though no real contact manifold ever forms between the two bodies (the phantom
 * ceiling is a pure raycast/collision_mask mismatch, not a real collision). Used ONLY by
 * _probeCeiling — _probeGround intentionally still sees platforms (that's how riding one works at
 * all), and ordinary walls/ramps/props aren't tagged isPlatform so they're unaffected.
 * @method _raycastSkipPlatforms
 * @private
 * @param {Goblin.Vector3} start
 * @param {Goblin.Vector3} end
 * @return {Object|null} the first non-self, non-platform hit, or null.
 */
proto._raycastSkipPlatforms = function(start, end) {
    var hits = this.world.rayIntersect(start, end);
    if (!hits || hits.length === 0) { return null; }
    for (var i = 0; i < hits.length; i++) {
        var hit = hits[i];
        if (hit.object) {
            if (hit.object.isPlatform) { continue; }
            if (hit.object.name && this._ignoreSelf && this._ignoreSelf.indexOf(hit.object.name) !== -1) { continue; }
        }
        return hit;
    }
    return null;
};

/**
 * Is there room to stand up? (No ceiling within standHeight of the feet.)
 * @method _canStand
 * @private
 * @return {Boolean}
 */
proto._canStand = function() {
    var feetY = this.body.position.y - this.height / 2;
    var ceil = this._probeCeiling(this.standHeight);
    return !ceil || ceil.point.y - feetY >= this.standHeight - this._skin;
};

/**
 * Single ray probe for a ladder ahead, along `dir` (horizontal, need not be unit length). Placed
 * halfway between the feet and stepHeight above them rather than the body center. Returns the raw
 * hit `{object, point, normal, t}` with the normal flipped to point OUT of the face (toward the
 * caller), or null.
 *
 * @method _findLadderAhead
 * @private
 * @param {Goblin.Vector3} dir
 * @return {Object|null}
 */
proto._findLadderAhead = function(dir) {
    var p = this.body.position;
    var dlen = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
    if (dlen < FPSC.EPS_LEN) { return null; }
    var dx = dir.x / dlen, dz = dir.z / dlen;
    var reach = this.width / 2 + this.ladderMountReach;
    var feetY = p.y - this.height / 2;
    var probeY = feetY + this.stepHeight / 2;
    var hit = raycast(this.world,
        new Goblin.Vector3(p.x, probeY, p.z),
        new Goblin.Vector3(p.x + dx * reach, probeY, p.z + dz * reach),
        this._ignoreSelf);
    if (!hit || !hit.object || !hit.object.isLadder) { return null; }
    return hit;
};

/**
 * Is there a too-steep-but-climbable slope surface rising just ahead of the move? Used only when
 * climbSteepSlopes is on. Casts down-rays a short distance ahead and looks for an upward-tilted,
 * too-steep-to-stand hit that is still a real slope (not flat floor, not a vertical wall).
 * @method _climbableSlopeAhead
 * @private
 * @param {Goblin.Vector3} start
 * @param {Number} dx - unit-ish horizontal direction x
 * @param {Number} dz - unit-ish horizontal direction z
 * @return {Boolean}
 */
proto._climbableSlopeAhead = function(start, dx, dz) {
    if (dx === 0 && dz === 0) { return false; }
    var feetY = this.body.position.y - this.height / 2;
    var base = this.depth / 2 + this._skin; // footprint edge (both scale with the character)
    for (var mi = 0; mi < FPSC.CLIMB_PROBE_DEPTH_MULTS.length; mi++) {
        var m = FPSC.CLIMB_PROBE_DEPTH_MULTS[mi];
        var ahead = base + m * this.depth; // reach past the footprint in units of depth (scale-invariant)
        var ax = start.x + dx * ahead;
        var az = start.z + dz * ahead;
        var hit = raycast(this.world,
            new Goblin.Vector3(ax, feetY + this.stepHeight + this._skin, az),
            new Goblin.Vector3(ax, feetY - this.stepHeight, az),
            this._ignoreSelf);
        if (hit && hit.normal.y > FPSC.NY_STEEP_MIN && hit.normal.y < this._minStandableNormalY) { return true; }
    }
    return false;
};

/**
 * Lowest ceiling clearance over the footprint centered at (cx,cz). Infinity if nothing overhead.
 * @method _ceilingClearanceAt
 * @private
 * @param {Number} cx
 * @param {Number} cz
 * @param {Number} feetY
 * @return {Number} clearance in units above feetY, or Infinity.
 */
proto._ceilingClearanceAt = function(cx, cz, feetY) {
    // Start above step-up height so a steppable obstacle (stair/low box) doesn't register as a
    // low ceiling; anything below feet+stepHeight is the ground clamp's job, not the gate's.
    var startY = feetY + this.stepHeight + this._skin;
    var endY = feetY + this.standHeight + this._skin;
    var ix = this.width / 2 - this._skin;
    var iz = this.depth / 2 - this._skin;
    var offsets = [[0, 0], [ix, 0], [-ix, 0], [0, iz], [0, -iz]];
    var lowest = Infinity;
    for (var i = 0; i < offsets.length; i++) {
        var ox = offsets[i][0];
        var oz = offsets[i][1];
        var hit = raycast(this.world,
            new Goblin.Vector3(cx + ox, startY, cz + oz),
            new Goblin.Vector3(cx + ox, endY, cz + oz),
            this._ignoreSelf);
        if (!hit || hit.normal.y > FPSC.NY_CEILING) { continue; } // not a ceiling (must face downward)
        // A dynamic/pushable object is never a "ceiling" — it's something the swept mover + push handle,
        // not the headroom gate. Without this, an object being actively shoved forward can wobble a few
        // degrees off-axis from contact torque, and its top face intermittently pokes above the
        // stepHeight cutoff below on some ticks but not others, flickering the character's forward
        // velocity to zero and back as the box jitters. Only STATIC geometry (mass===Infinity) counts
        // as an overhang.
        if (hit.object && hit.object._mass !== Infinity) { continue; }
        var clr = hit.point.y - feetY;
        // A "ceiling" clearance at or below step height is NOT an overhang — it's a low obstacle at
        // shin/waist level that the swept mover + push handle, not the headroom gate. Without this, a
        // low stepHeight drops the ray start (feetY+stepHeight) INTO a waist-high object ahead, and the
        // ray reports a bogus ~stepHeight-clearance "ceiling", so the gate walls the character in open
        // space in front of a pushable box (worse the lower stepHeight is). Only count genuine overhangs
        // — clearance meaningfully above the step line — as ceilings.
        if (clr <= this.stepHeight + this._skin) { continue; }
        if (clr < lowest) { lowest = clr; }
    }
    return lowest;
};

/**
 * The "too steep to stand on" rule — a floor whose normal tilts below the standable limit gives no
 * footing (MOVE_SLIP). climbSteepSlopes opts out.
 * @method _isSlipSurface
 * @private
 * @param {Object} normal - a surface normal (uses .y)
 * @return {Boolean}
 */
proto._isSlipSurface = function(normal) {
    return !this.climbSteepSlopes && normal.y < this._minStandableNormalY;
};

// Kinematic wall/step collision: the character is excluded from the solver's own contact resolution
// (collision_mask 1), so this file is what actually stops the character at walls, lets it climb steps,
// and depenetrates it out of geometry it sank into. Shared by both the character body and its ghost
// via _sweptCollideAndSlide.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * Kinematic collide-and-slide. The character is excluded from the solver, so we stop
 * ourselves at walls and slide along them here. For the current horizontal velocity
 * we cast a fan of rays (across the footprint width, at a few heights) in the move
 * direction; if a vertical wall is within the box's reach this step we remove the
 * into-wall velocity component and re-test, so corners stop on both walls. Floors and
 * ramps (normal.y >= 0.5) are ignored — those are handled by the ground clamp.
 *
 * @method _collideAndSlide
 * @private
 * @param {Number} vx - incoming horizontal velocity, x.
 * @param {Number} vz - incoming horizontal velocity, z.
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.x - clipped horizontal velocity, x.
 * @return {Number} result.z - clipped horizontal velocity, z.
 */
proto._collideAndSlide = function(vx, vz, dt) {
    var res = this._sweptCollideAndSlide({
        position: this.body.position,
        width: this.width, depth: this.depth, height: this.height,
        skin: this._skin, mass: this.mass, stepHeight: this.stepHeight,
        selfBody: this.body, otherSelfBody: this._ghost || null,
        // A SLIDE is exempt from the too-steep-can't-move-up block (the slide IS the climb — momentum,
        // not input, is what carries it up). This must hold while AIRBORNE-sliding too: an airborne
        // slide sweeping into a steep face otherwise wall-clips to zero speed mid-air, which kills the
        // slide before it ever lands on the surface. _climbableSlopeAhead inside still tells real
        // slopes from vertical walls, so walls keep stopping a slide. this._moveState is already
        // MOVE_SLIDE on the true first-contact tick too — endStep decides movement state (including
        // slide entry) BEFORE this function runs later in the same beginStep, so there's no
        // "one tick behind" gap here to patch around.
        climbSteepSlopes: this.climbSteepSlopes || this._moveState === FPSC.MOVE_SLIDE,
        vx: vx, vz: vz, dt: dt,
    });
    // Depenetration is a horizontal position correction out of a wall, separate from the velocity move.
    if (res.depenX !== 0 || res.depenZ !== 0) {
        var bp = this.body.position;
        this.body.position.set(bp.x + res.depenX, bp.y, bp.z + res.depenZ);
        this.body.updateDerived();
    }
    return { x: res.x, z: res.z };
};

/**
 * Sweeps an inset box along a horizontal velocity and clips it against blocking contacts,
 * sub-stepped so long sweeps can't return a wrong-axis normal. Shared by the character body
 * and its ghost so both get identical wall/mass-yield behavior from one implementation.
 *
 * @method _sweptCollideAndSlide
 * @private
 * @param {Object} opts
 * @param {Goblin.Vector3} opts.position - Sweep origin (box center).
 * @param {Number} opts.width - Box width (x), pre-inset.
 * @param {Number} opts.depth - Box depth (z), pre-inset.
 * @param {Number} opts.height - Box height (y), pre-inset.
 * @param {Number} opts.skin - Contact/sweep tolerance subtracted from each half-extent.
 * @param {Number} opts.mass - Sweeping body's mass, used for the push mass-yield ratio.
 * @param {Number} [opts.stepHeight=0] - Step-up height; 0 disables step-up entirely.
 * @param {Goblin.RigidBody} opts.selfBody - Body to exclude from its own sweep hits.
 * @param {Goblin.RigidBody} [opts.otherSelfBody] - A second body to exclude (e.g. the character
 *   excludes its ghost, and vice versa).
 * @param {Boolean} [opts.climbSteepSlopes=false] - Exempt too-steep floor-like faces that have a
 *   climbable slope ahead from the wall-block rule.
 * @param {Number} opts.vx - Incoming horizontal velocity, x.
 * @param {Number} opts.vz - Incoming horizontal velocity, z.
 * @param {Number} opts.dt - Tick duration in seconds.
 * @return {Object} result
 * @return {Number} result.x - Clipped horizontal velocity, x.
 * @return {Number} result.z - Clipped horizontal velocity, z.
 * @return {Number} result.depenX - Position correction out of a penetrated wall, x (0 if none).
 * @return {Number} result.depenZ - Position correction out of a penetrated wall, z (0 if none).
 */
proto._sweptCollideAndSlide = function(opts) {
    var vx = opts.vx, vz = opts.vz;
    var position = opts.position, width = opts.width, depth = opts.depth, height = opts.height,
        skin = opts.skin, mass = opts.mass, dt = opts.dt, selfBody = opts.selfBody, otherSelfBody = opts.otherSelfBody;
    var stepHeight = opts.stepHeight || 0;
    var climbSteepSlopes = !!opts.climbSteepSlopes;
    var world = this.world;
    if (!world || typeof world.shapeIntersect !== "function") { return { x: vx, z: vz, depenX: 0, depenZ: 0 }; }

    // Original move heading, before any clipping this tick — used by the climb-slope-ahead probe
    // so a mid-loop velocity clip doesn't collapse the probe direction.
    var moveLen0 = Math.sqrt(vx * vx + vz * vz);
    var mdx0 = moveLen0 > FPSC.EPS_DIR ? vx / moveLen0 : 0;
    var mdz0 = moveLen0 > FPSC.EPS_DIR ? vz / moveLen0 : 0;

    // Swept-box collide-and-slide: sweep an inset box along the move each tick and clip velocity
    // against the real contact plane.
    var p = position;
    var halfW = width / 2 - skin;
    var halfD = depth / 2 - skin;
    // Lift the swept box a small amount off the feet so it doesn't graze the floor slab's top
    // edge (which returns a degenerate near-vertical normal and fakes a wall), while staying low
    // enough to still catch a steep ramp's toe.
    var lift = skin * 2;
    var halfH = Math.max(0.05, height / 2 - lift / 2);
    var yOffset = lift / 2;
    // Cache the swept probe box per caller (different callers may have different dimensions).
    var cacheKey = selfBody === this.body ? "_sweepBox" : "_altSweepBox";
    if (!this[cacheKey] || this[cacheKey + "W"] !== halfW || this[cacheKey + "H"] !== halfH || this[cacheKey + "D"] !== halfD) {
        this[cacheKey] = new Goblin.BoxShape(halfW, halfH, halfD);
        this[cacheKey + "W"] = halfW; this[cacheKey + "H"] = halfH; this[cacheKey + "D"] = halfD;
    }
    var boxShape = this[cacheKey];
    var minStandableNy = this._minStandableNormalY;

    // Sub-step so each swept chunk stays well under the smallest half-extent (a long sweep can
    // return a wrong-axis normal from EPA).
    var chunkLen = Math.min(halfW, halfD) * FPSC.SUBSTEP_FRAC;
    var full = Math.sqrt(vx * vx + vz * vz) * dt;
    var nSub = Math.max(1, Math.ceil(full / Math.max(chunkLen, FPSC.EPS_LEN)));
    var sdt = dt / nSub;

    // shapeIntersect's contact normal points FROM the swept box TOWARD the other object (into the
    // wall). "Heading into this face" is v.n > 0; pushing out of penetration moves along -n.
    //
    // Nearest valid blocking contact for a sweep, or null. { n, pen, keep }.
    var self_ = this;
    function findBlock(start, end) {
        var hits = world.shapeIntersect(boxShape, start, end);
        for (var hi = 0; hi < hits.length; hi++) {
            var h = hits[hi];
            var b0 = h.object;
            // A raw kinematic character body is never a wall (no mass to yield against — its ghost
            // is the real solver stand-in for it). A ghost belonging to ANOTHER controller, though,
            // is a genuine mass and should block/yield like any pushable object.
            if (b0 === selfBody || b0 === otherSelfBody || (b0 && b0.isKinematicCharacter && !b0.isCharacterGhost)) { continue; }
            var n = h.normal;
            if (!n || !isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) { continue; }
            var nlen = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
            if (nlen < FPSC.N_DEGENERATE) { continue; }
            if (Math.abs(n.y) >= minStandableNy) { continue; }
            // Vertical wall: normal horizontal, points character->object; heading in is v.n > 0.
            // Too-steep floor-like face (0.1 < n.y < cutoff): normal tilts up-and-back, so heading
            // in is v.(n.x,n.z) < 0 — sign flipped below.
            var floorLike = n.y > FPSC.NY_FLOORLIKE;
            // A floor-like too-steep face is only a legitimate "slope ahead" block near the feet
            // (walking into a ramp's toe). The same face type contacted up near head height is an
            // OVERHANG (ramp underside above a wedged character), not a slope to stop forward
            // progress on — treating it as a wall-slide clip can zero velocity in every direction,
            // including retreat, trapping the character. Overhead clearance is the headroom gate's
            // job; skip it here so a sideways/backward escape isn't blocked by the same contact.
            if (floorLike && h.point && (h.point.y - (p.y - height / 2)) > height * FPSC.TOE_BAND_FRAC) { continue; }
            if (climbSteepSlopes && self_._climbableSlopeAhead(start, mdx0, mdz0)) { continue; }
            var into = floorLike ? -(vx * n.x + vz * n.z) : (vx * n.x + vz * n.z);
            if (into <= 0) { continue; }
            var keep = 0;
            var b = h.object;
            // Platforms never yield like a pushable object — they're scripted geometry. Another
            // player's ghost is a full body-block too — a player is a wall, not a pushable box.
            if (b && !b.isPlatform && !b.isCharacterGhost && b._mass !== Infinity && b._mass > 0 && isFinite(b._mass) &&
                b._mass <= self_._pushMassLimit) {
                keep = mass / (mass + b._mass);
            }
            return { n: n, pen: h.penetration || 0, keep: keep };
        }
        return null;
    }

    // Contact test with no directional gate (unlike findBlock). Used by the recovery back-probe,
    // since after velocity is clipped the body is no longer "moving into" the wall.
    function contactAt(x, y, z) {
        var hits = world.shapeIntersect(boxShape, new Goblin.Vector3(x, y, z), new Goblin.Vector3(x, y, z));
        for (var hi = 0; hi < hits.length; hi++) {
            var h = hits[hi];
            var b0 = h.object;
            if (b0 === selfBody || b0 === otherSelfBody || (b0 && b0.isKinematicCharacter && !b0.isCharacterGhost)) { continue; }
            var n = h.normal;
            if (!n || !isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) { continue; }
            if (Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) < FPSC.N_DEGENERATE) { continue; }
            if (Math.abs(n.y) >= minStandableNy) { continue; } // walkable ground/ramp — not a wall
            return true;
        }
        return false;
    }

    var sy = p.y + yOffset;

    // CLIP velocity against walls the move would hit this tick, and DEPENETRATE out of any wall
    // sunk into (push along -n by overlap+skin so it rests just clear — the swept cast is
    // penetration-based, so without this a fast move ends up inside and sticks). Velocity-only for
    // the move; position correction only for depenetration. Sub-stepped for reliable normals.
    var cx = p.x, cz = p.z;
    var depenX = 0, depenZ = 0;
    for (var s = 0; s < nSub; s++) {
        for (var iter = 0; iter < 4; iter++) {
            var speed = Math.sqrt(vx * vx + vz * vz);
            if (speed < FPSC.EPS_DIR) { break; }
            var start = new Goblin.Vector3(cx, sy, cz);
            var end = new Goblin.Vector3(cx + vx * sdt, sy, cz + vz * sdt);
            var blk = findBlock(start, end);
            if (!blk) { break; }
            // Step-up: before walling a near-vertical, non-yielding face, test if it's clear when
            // swept raised by stepHeight — if so it's steppable, let the move through.
            if (blk.keep < FPSC.KEEP_BLOCKED && Math.abs(blk.n.y) < FPSC.NY_NEAR_VERTICAL && stepHeight > 0) {
                var upStart = new Goblin.Vector3(cx, sy + stepHeight, cz);
                var upEnd = new Goblin.Vector3(cx + vx * sdt, sy + stepHeight, cz + vz * sdt);
                if (!findBlock(upStart, upEnd)) { break; }
            }
            var n = blk.n, keep = blk.keep;
            // Clip the into-face velocity using the horizontal blocking direction (never inject
            // vertical; the ground clamp owns y).
            var floorLike = n.y > FPSC.NY_FLOORLIKE;
            var bx = floorLike ? -n.x : n.x, bz = floorLike ? -n.z : n.z;
            var blen = Math.sqrt(bx * bx + bz * bz);
            if (blen < FPSC.EPS_SPD) { break; }
            bx /= blen; bz /= blen;
            var dot = vx * bx + vz * bz;
            if (dot > 0) {
                vx -= dot * bx * (1 - keep);
                vz -= dot * bz * (1 - keep);
            }
            // Depenetration is recovery-only: detect BURIED vs GRAZING with a back-probe (sweep one
            // fixed small step along -n; if still in contact there, nudge out by that step), rather
            // than trusting the reported penetration depth directly. Vertical walls only; a
            // floor-like too-steep toe is owned by the clamp / steep-slope path.
            if (!floorLike && keep < FPSC.KEEP_BLOCKED && blk.pen > 0) {
                var step = Math.min(width, depth) * FPSC.BACKPROBE_WIDTH_FRAC;
                if (contactAt(cx - n.x * step, sy, cz - n.z * step)) {
                    depenX -= n.x * step; depenZ -= n.z * step;
                    cx -= n.x * step; cz -= n.z * step;
                }
            }
            if (keep > FPSC.KEEP_BLOCKED) { break; }
        }
        cx += vx * sdt;
        cz += vz * sdt;
    }
    return { x: vx, z: vz, depenX: depenX, depenZ: depenZ };
};

// Vertical motion: jump + gravity/landing hook. Gravity/landing itself is left to the solver; only
// jump/jetpack thrust writes vertical velocity directly (see _updateVertical). Also the overridable
// gait-speed hook (_getMoveSpeed), kept here since jump/speed are the two "kit" hooks a subclass
// typically overrides together.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

// ---- Overridable kit hooks --------------------------------------------

/**
 * Gait selection: sprint > walk > run, scaled by crouch. Override to change gait rules without
 * touching ground/step/wall logic.
 * @method _getMoveSpeed
 * @protected
 * @param {Object} cmd
 * @return {Number} target horizontal speed for this tick.
 */
proto._getMoveSpeed = function(cmd) {
    // Gait priority: sprint > walk > run. Crouch scales the chosen gait.
    var gait = cmd.sprint ? this.sprintSpeed : cmd.walk ? this.walkSpeed : this.moveSpeed;
    return cmd.crouch ? gait * this.crouchSpeedMult : gait;
};

/**
 * Vertical hook. Base = grounded jump only (gravity/landing handled by the solver). A jump adds
 * platform base velocity's Y component additively, not an overwrite — jumping off a rising
 * platform flings the character higher than jumpSpeed alone would.
 * @method _updateVertical
 * @protected
 * @param {Object} cmd
 * @param {Number} dt
 */
proto._updateVertical = function(cmd, dt) {
    var canJump = this.grounded || this._coyoteTimer > 0;
    var wantJump = cmd.jumpPressed || this._jumpBufferTimer > 0;
    if (canJump && wantJump) {
        // VERTICAL: additive, not a bare overwrite — jumping off a platform that's currently rising
        // carries its vertical base velocity into the jump (a "fling"), on top of whatever base
        // velocity the character already had that tick. Gated by _jumpKeepsVerticalBaseVelocity
        // (default true — the established, expected platforming feel; PL3 depends on it).
        var vBase = this._jumpKeepsVerticalBaseVelocity ? this._baseVelocity.y : 0;
        // The player's jump is a WISH to leave the surface — that wish should only ever be helped by
        // the platform's current motion, never fought. A platform still RISING adds free height (the
        // fling above, working as intended); a platform DESCENDING must not subtract from the jump —
        // ignore negative vBase at the moment of jumping (default on; a project that wants a
        // descending platform to actively suppress a jump can opt out). This is deliberately scoped to
        // the JUMP MOMENT only, not standing/riding in general — normal ground-follow on a descending
        // platform (not jumping) is unaffected and still correctly rides it down; only the instant the
        // player presses jump does their intent take priority over the platform's own motion.
        if (this._jumpIgnoresDescendingBaseVelocity && vBase < 0) { vBase = 0; }
        this.body.linear_velocity.y = this.jumpSpeed + vBase;
        // HORIZONTAL: gated by _jumpKeepsHorizontalBaseVelocity (default FALSE — opposite default from
        // vertical). Applies to ANY platform's horizontal base velocity, linear or rotating alike —
        // left alone, a jump off a fast-moving/spinning platform launches the rider sideways at
        // whatever speed the platform was imparting, since nothing decays it once airborne. Needs BOTH
        // zeroed when opted out, not just one:
        //   - this.body.linear_velocity.x/z (= gb, a live alias set up earlier in beginStep): the
        //     AIRBORNE movement-state dispatch that runs right after this call reads gb.x/z DIRECTLY as
        //     its base velocity (`var cur = gb`) when there's no move input — zeroing only
        //     _baseVelocity below does nothing for that path, gb itself must be clean.
        //   - this._baseVelocity.x/z: also read a few lines later in the SAME beginStep call (the
        //     dispatch's own bvx/bvz, added into the swept move regardless of movement state) — leaving
        //     it non-zero re-adds the platform's speed right back even after gb is cleared above.
        if (!this._jumpKeepsHorizontalBaseVelocity) {
            this.body.linear_velocity.x = this._ownVelocityX;
            this.body.linear_velocity.z = this._ownVelocityZ;
            this._baseVelocity.x = 0;
            this._baseVelocity.z = 0;
        }
        this.grounded = false;
        // beginStep's movement-state dispatch runs right after this call, on the SAME tick — must
        // see AIRBORNE now, not whatever grounded sub-state was true a moment ago.
        this._moveState = FPSC.MOVE_AIRBORNE;
        this._groundSuppress = FPSC.GROUND_SUPPRESS_JUMP;
        // See endStep's `suppressed` — a FIXED tick count alone isn't enough here: it doesn't know
        // how far the character actually needs to climb to clear the surface they jumped off. A
        // still-rising surface underfoot (a platform still climbing, or a ramp whose OWN surface
        // keeps rising ahead of a character sprinting up it) can have gb.y still healthily positive
        // well past GROUND_SUPPRESS_JUMP's fixed window, and would otherwise get back in ground-clamp
        // snap range the instant the countdown lapses, re-catching the jump before it ever really
        // left. This flag extends suppression for as long as gb.y stays genuinely positive (checked
        // in endStep), on top of (not instead of) the fixed countdown — so a jump still can't
        // suppress forever if something keeps gb.y positive indefinitely (a runaway edge case), but a
        // normal jump's natural gravity decay is what ends it, not an arbitrary tick count picked for
        // a flat floor.
        this._jumpRising = true;
        this._coyoteTimer = 0;
        this._jumpBufferTimer = 0;
    } else if (cmd.jumpPressed) {
        this._jumpBufferTimer = this.jumpBuffer;
    }
};

// Crouch-at-speed slide: the per-tick velocity evolver for an active slide (slope acceleration,
// friction, steering). Entry/exit decisions themselves live in endStep's "MOVEMENT STATE DECISION"
// block (Movement/Step.js) — this file only advances an already-active slide by one tick.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * Slide velocity EVOLVER — advances one tick of the slide's surface-tracking model (slope accel,
 * friction, steering). Pure: only called from beginStep's MOVE_SLIDE branch, which is only reached
 * when endStep has ALREADY decided this tick is a slide (see the "MOVEMENT STATE DECISION" block
 * in endStep) and has already written the correct starting tangential velocity into gb — including
 * the one-time entry boost (slideBoost), applied there rather than here so it lands on the exact
 * tick the state transition itself is observable, not one tick later. This function does not
 * decide whether to slide — it has no entry gate, no exit gate, no stored flag. It reads gb (this
 * tick's starting velocity, already tangent to groundNormal), advances it one tick, and returns
 * the result.
 *
 * @method _updateSlide
 * @private
 * @param {Object} cmd
 * @param {Number} wishX - desired horizontal velocity x from input (unsteered).
 * @param {Number} wishZ - desired horizontal velocity z from input (unsteered).
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.vx - this tick's slide velocity, x.
 * @return {Number} result.vy - this tick's slide velocity, y (surface-follow component).
 * @return {Number} result.vz - this tick's slide velocity, z.
 */
proto._updateSlide = function(cmd, wishX, wishZ, dt) {
    // _ownVelocityX/Z, NOT gb.x/z — gb carries the platform's base velocity baked in (see the
    // constructor's _baseVelocity comment). Evolving the raw gb value would re-seed the slide's own
    // momentum with the platform's speed already added, which then compounds every tick instead of
    // properly decaying (the platform reads as if its own speed were the character's own build-up —
    // a "boost pad" while sliding on a moving platform).
    var vx = this._ownVelocityX;
    var vz = this._ownVelocityZ;
    var sp = Math.sqrt(vx * vx + vz * vz);

    var n = this.groundNormal;
    var slopeMag = Math.sqrt(n.x * n.x + n.z * n.z);
    var gy = this._gravityVec.y;
    var onSlope = slopeMag >= this.slideSlopeMin;
    // Downhill fall-line unit vector, used both by the slope-accel step below and by the reversal
    // brake's uphill test further down. Only meaningful when onSlope; 0 otherwise (unused there).
    var dx = onSlope ? n.x / slopeMag : 0;
    var dz = onSlope ? n.z / slopeMag : 0;

    if (onSlope) {
        // Gravity accelerates the fall-line (downhill) component; the cross-slope (sideways)
        // part bleeds lightly. Returned as full 3D so the grounded branch doesn't re-project it.
        var along = vx * dx + vz * dz;
        var crossX = vx - along * dx;
        var crossZ = vz - along * dz;
        // Along-slope gravitational accel is g*sin(theta) — slopeMag alone (sin of the tilt from
        // horizontal). An extra n.y (cos theta) factor here would be wrong: sin(theta)*cos(theta)
        // PEAKS at 45° and falls back off toward vertical, so a 55°+ face would decelerate barely
        // harder than a 20° one, and a near-vertical wall almost not at all — backwards from real
        // physics, where steeper always means more deceleration, up to g at 90°.
        along += -gy * slopeMag * this.slideSlopeAccel * dt;
        var cs = Math.sqrt(crossX * crossX + crossZ * crossZ);
        var cn = Math.max(0, cs - this.slideSlopeFriction * dt);
        var cf = cs > FPSC.EPS_DIR ? cn / cs : 0;
        crossX *= cf;
        crossZ *= cf;
        vx = along * dx + crossX;
        vz = along * dz + crossZ;
        sp = Math.sqrt(vx * vx + vz * vz);
    } else {
        var next = Math.max(0, sp - this.slideFriction * dt);
        var f = sp > FPSC.EPS_DIR ? next / sp : 0;
        vx *= f;
        vz *= f;
        sp = next;
    }

    // Rotate the slide heading toward input without adding speed (renormalize to sp).
    var wl = Math.sqrt(wishX * wishX + wishZ * wishZ);
    if (this.slideControl > 0 && wl > FPSC.EPS_DIR && sp > FPSC.EPS_DIR) {
        var wnx = wishX / wl, wnz = wishZ / wl;
        // Wish opposing current motion (e.g. holding backward mid-slide) is a deliberate reversal,
        // not a carve — the ordinary partial blend below would slowly rotate the heading through an
        // arc instead of braking straight back. Detect that case (wish nearly opposite current
        // velocity) and brake toward zero along the CURRENT heading instead of blending toward
        // wish; once speed has bled down, the same blend below is what picks the (now-reversed)
        // heading back up, so the reversal itself still ends up sliding in the wish direction — it
        // just brakes-then-goes instead of curving through it. Applies on flat ground too: without
        // this, flat sliding's own friction decay would bleed speed down to the slideEndSpeed exit
        // threshold WHILE the un-braked blend was arcing the heading toward wish, so a backward
        // hold curved through a U-turn on its way out instead of braking straight.
        var brakeRate = onSlope ? this.slideSlopeFriction * this.slideReversalBrakeMult
            : this.slideFriction * this.slideReversalBrakeMult;
        var vnx = vx / sp, vnz = vz / sp;
        var facing = wnx * vnx + wnz * vnz; // 1 = same direction, -1 = dead opposite
        // ANGLE-BLIND: on ANY slope, gravity always wins the fall-line — you can't carve a slide uphill
        // against it, only brake. A wish with any uphill component (against the downhill fall-line
        // dx/dz) must BRAKE toward a stop, not carve; otherwise the carve below redirects the blocked
        // uphill momentum into a cross-slope skid off the side. On flat there's no fall-line to fight,
        // so only a near-opposite wish counts as a reversal there (unchanged).
        var uphillOnSlope = onSlope && (wnx * dx + wnz * dz) < 0;
        if (uphillOnSlope || facing < FPSC.SLIDE_REVERSAL_DOT) {
            var braked = Math.max(0, sp - brakeRate * dt);
            var bf = sp > FPSC.EPS_DIR ? braked / sp : 0;
            vx *= bf;
            vz *= bf;
        } else {
            var tx = vx + (wnx * sp - vx) * this.slideControl;
            var tz = vz + (wnz * sp - vz) * this.slideControl;
            var tl = Math.sqrt(tx * tx + tz * tz) || 1;
            vx = (tx / tl) * sp;
            vz = (tz / tl) * sp;
        }
    }

    var vy = 0;
    if (onSlope) {
        var inv2 = 1 / slopeMag;
        var alongOut = vx * (n.x * inv2) + vz * (n.z * inv2);
        vy = -alongOut * slopeMag / Math.max(n.y, 0.1);
        // The velocity returned here is already tangent to the surface — including on a TOO-STEEP slope.
        // The too-steep-can't-move-up rules don't re-clip it: an active slide is exempt everywhere they
        // apply (see _collideAndSlide's climbSteepSlopes opt) — the slide IS the climb.
    }
    // Flat ground (!onSlope): groundNormal.y is ~1, so gb.y should stay ~0 — the caller (beginStep's
    // ground clamp path, same as WALK) doesn't need a nonzero vy to track a surface that's already
    // level. vy=0 here is that "no vertical correction needed" case, not a special flat-only shape.
    return { vx: vx, vy: vy, vz: vz };
};

// Ladder climbing: a fourth movement state alongside grounded/slip/airborne/slide, resolved once per
// beginStep before the main movement dispatch runs (see _updateLadder's call site in Step.js).
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * Ladder state transitions + climb velocity. A fourth movement state alongside grounded /
 * noTraction / airborne, resolved once per beginStep before that branch runs. The ladder body is
 * never excluded from collision — _collideAndSlide still runs afterward on whatever velocity this
 * writes, so ordinary contact resolution is what holds the character against the face tick over tick.
 *
 * Mount requires movement intent toward the ladder (wishdir), not mere proximity — probing along
 * the current input direction rather than scanning all directions means jumping away from a ladder
 * and holding the opposite key back toward it, or passing a ladder mid-air, can't remount it a
 * frame later while disconnected from it.
 *
 * Forward/back and strafe contributions to climb velocity are summed independently, without
 * normalizing the combined wish vector — holding both diagonally into the face climbs strictly
 * faster than either alone. Look pitch steers climb direction: the forward axis is the full
 * pitched look direction, not flattened, so holding forward while looking down descends.
 *
 * Jump dismounts with a purely horizontal shove away from the face — no vertical component.
 *
 * @method _updateLadder
 * @private
 * @param {Object} cmd
 * @param {Number} moveYaw
 * @param {Number} movePitch
 * @param {Number} dt
 * @return {Boolean} true if this tick's velocity is fully owned by the ladder branch
 */
proto._updateLadder = function(cmd, moveYaw, movePitch, dt) {
    var gb = this.body.linear_velocity;

    var hit;
    if (this._onLadder) {
        var probeDir = new Goblin.Vector3(-this._ladderNormal.x, 0, -this._ladderNormal.z);
        hit = this._findLadderAhead(probeDir);
    } else {
        var fwdH = this.getForwardHorizontal(moveYaw);
        var rgtH = this.getRightHorizontal(moveYaw);
        var cmdF0 = cmd.forward || 0;
        var cmdR0 = cmd.right || 0;
        var wishdir = new Goblin.Vector3(
            fwdH.x * cmdF0 + rgtH.x * cmdR0, 0, fwdH.z * cmdF0 + rgtH.z * cmdR0
        );
        hit = this._findLadderAhead(wishdir);
    }

    if (cmd.jumpPressed && this._onLadder) {
        var n0 = this._ladderNormal;
        gb.x = n0.x * this.ladderDismountPushSpeed;
        gb.z = n0.z * this.ladderDismountPushSpeed;
        gb.y = 0;
        this._onLadder = false;
        // The push flings the character off the ladder into the air — next tick's beginStep
        // dispatch (before endStep gets a chance to re-probe) must see AIRBORNE, not whatever
        // ground state was true before this ladder mount.
        this._moveState = FPSC.MOVE_AIRBORNE;
        this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
        return true;
    }

    if (!hit) {
        this._onLadder = false;
        this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
        return false;
    }

    var hasMoveInput = (cmd.forward || 0) !== 0 || (cmd.right || 0) !== 0;
    if (!this._onLadder && !hasMoveInput) { return false; }

    this._onLadder = true;
    this.grounded = false;
    // Mounting owns movement now — any grounded state carried in from the tick before must not read
    // as still active while climbing (or linger stale after a later dismount): beginStep's dispatch
    // only reads this._moveState when NOT on a ladder, so nothing else would ever clear this.
    this._moveState = FPSC.MOVE_LADDER;
    this._ladderNormal.set(hit.normal.x, 0, hit.normal.z);
    var nl = Math.sqrt(this._ladderNormal.x * this._ladderNormal.x + this._ladderNormal.z * this._ladderNormal.z);
    if (nl > FPSC.EPS_LEN) { this._ladderNormal.x /= nl; this._ladderNormal.z /= nl; }

    this.body.setGravity(0, 0, 0);
    if (!hasMoveInput) { gb.x = 0; gb.y = 0; gb.z = 0; return true; }

    var cp = Math.cos(movePitch);
    var fwd = new Goblin.Vector3(Math.sin(moveYaw) * cp, Math.sin(movePitch), Math.cos(moveYaw) * cp);
    var rgt = this.getRightHorizontal(moveYaw);
    var cmdF = cmd.forward || 0;
    var cmdR = cmd.right || 0;

    var velX = fwd.x * cmdF * this.ladderClimbSpeed + rgt.x * cmdR * this.ladderStrafeSpeed;
    var velY = fwd.y * cmdF * this.ladderClimbSpeed;
    var velZ = fwd.z * cmdF * this.ladderClimbSpeed + rgt.z * cmdR * this.ladderStrafeSpeed;

    var n = this._ladderNormal;
    var out = velX * n.x + velZ * n.z;
    gb.x = velX - out * n.x;
    gb.z = velZ - out * n.z;
    gb.y = velY - out;

    // Descent is blocked against solid ground here (rather than in endStep's ground clamp, which is
    // skipped while mounted so it doesn't re-snap the character onto the floor near the ladder's base
    // even while climbing up). Uses the same _probeGroundCandidates primitive endStep itself uses.
    if (gb.y < 0) {
        var half = this.height / 2;
        var reach2 = -gb.y * dt + this._skin;
        var ground = this._probeGroundCandidates(reach2)[0];
        if (ground) {
            var feetGap = this.body.position.y - half - ground.point.y;
            if (feetGap <= reach2) {
                var clampedY = ground.point.y + half;
                if (!this._resimulating) { this._viewDisplacementY += clampedY - this.body.position.y; }
                this.body.position.set(this.body.position.x, clampedY, this.body.position.z);
                this.body.updateDerived();
                gb.y = 0;
                this.grounded = true;
                // Still LADDER for as long as _onLadder stays true this tick (movement is fully
                // owned above) — this only matters for the tick AFTER dismounting, so beginStep's
                // dispatch sees WALK rather than a stale pre-mount state.
                this._moveState = FPSC.MOVE_WALK;
                this.groundNormal.set(ground.normal.x, ground.normal.y, ground.normal.z);
            }
        }
    }
    return true;
};

// Mantle: two-phase kinematic arc (lift, then vault) onto a ledge too tall to step onto.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;
var raycast = Goblin.FPSCharacterController._raycast;

/**
 * Probe forward for a near-vertical face, then down from the hit for its top surface.
 * @method _probeLedgeAhead
 * @private
 * @param {Number} dx
 * @param {Number} dz
 * @return {Object|null} { faceNormal, topPoint, topNormal, probeDx, probeDz }
 */
proto._probeLedgeAhead = function(dx, dz) {
    var dlen = Math.sqrt(dx * dx + dz * dz);
    if (dlen < FPSC.EPS_LEN) { return null; }
    dx /= dlen; dz /= dlen;

    var p = this.body.position;
    var feetY = p.y - this.height / 2;
    var headY = p.y + this.height / 2;

    var reach = this.width / 2 + this.mantleReach;
    // Probe at several heights so a ledge is found whether level, jumped above, or low.
    var probeHeights = [feetY + this.mantleHeight, p.y, feetY + this.stepHeight];

    for (var hi = 0; hi < probeHeights.length; hi++) {
        var probeY = probeHeights[hi];
        var fwdHit = raycast(
            this.world,
            new Goblin.Vector3(p.x, probeY, p.z),
            new Goblin.Vector3(p.x + dx * reach, probeY, p.z + dz * reach),
            this._ignoreSelf
        );
        if (!fwdHit) { continue; }
        if (Math.abs(fwdHit.normal.y) > FPSC.NY_GROUNDISH) { continue; } // not a near-vertical face

        var topProbeX = fwdHit.point.x + dx * this._skin;
        var topProbeZ = fwdHit.point.z + dz * this._skin;
        var scanTop = feetY + this.mantleHeight + this._skin;
        var scanBot = feetY + this.stepHeight + this._skin;
        if (scanTop <= scanBot) { continue; }

        // Walk every hit along the down-probe (not just the nearest) for one belonging to the
        // SAME object as the grabbed face — otherwise a disconnected surface further up the
        // column (e.g. a ceiling) can be misread as this ledge's top.
        var downHits = this.world.rayIntersect(
            new Goblin.Vector3(topProbeX, scanTop, topProbeZ),
            new Goblin.Vector3(topProbeX, scanBot, topProbeZ)
        );
        var downHit = null;
        if (downHits) {
            for (var di = 0; di < downHits.length; di++) {
                var dh = downHits[di];
                if (dh.object === fwdHit.object && dh.normal.y >= FPSC.NY_FLOORLIKE) { downHit = dh; break; }
            }
        }
        if (!downHit) { continue; }

        return {
            faceNormal: fwdHit.normal,
            topPoint: downHit.point,
            topNormal: downHit.normal,
            probeDx: dx,
            probeDz: dz
        };
    }
    return null;
};

/**
 * Mantle state machine, mirrors _updateLadder's contract. Called once per beginStep before the
 * main dispatch; returns true while the arc owns the tick.
 * @method _updateMantle
 * @private
 * @param {Object} cmd
 * @param {Number} moveYaw
 * @param {Number} dt
 * @return {Boolean}
 */
proto._updateMantle = function(cmd, moveYaw, dt) {
    var gb = this.body.linear_velocity;
    var p = this.body.position;

    // Active arc: drives position directly (bypasses _collideAndSlide, which would otherwise
    // treat the grabbed face as a blocking wall).
    if (this._mantleActive) {
        this._mantleTimer += dt;
        var total = this.mantleDuration;
        var liftEnd = total * this.mantleLiftFrac;
        var frac = Math.min(1, this._mantleTimer / total);

        var newX, newY, newZ;
        if (this._mantleTimer <= liftEnd) {
            var liftFrac = Math.min(1, this._mantleTimer / Math.max(liftEnd, FPSC.EPS_LEN));
            newX = this._mantleStartX;
            newZ = this._mantleStartZ;
            newY = this._mantleStartY + (this._mantleTopBodyY - this._mantleStartY) * liftFrac;
        } else {
            var vaultFrac = Math.min(1, (this._mantleTimer - liftEnd) / Math.max(total - liftEnd, FPSC.EPS_LEN));
            newX = this._mantleStartX + (this._mantleLandX - this._mantleStartX) * vaultFrac;
            newZ = this._mantleStartZ + (this._mantleLandZ - this._mantleStartZ) * vaultFrac;
            newY = this._mantleTopBodyY;
        }

        gb.x = 0; gb.y = 0; gb.z = 0;
        this.body.position.set(newX, newY, newZ);
        this.body.updateDerived();

        var done = frac >= 1;
        if (done) {
            this._mantleActive = false;
            this._mantleTimer = 0;
            this._moveState = FPSC.MOVE_AIRBORNE;
            this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
            gb.x = 0; gb.y = 0; gb.z = 0;
            return false; // release to normal dispatch this tick so endStep can land us
        }

        return true;
    }

    // Detection: only on an explicit tap.
    if (!cmd.mantle) { return false; }

    var fwd = this.getForwardHorizontal(moveYaw);
    var ledge = this._probeLedgeAhead(fwd.x, fwd.z);
    if (!ledge) { return false; }

    var feetY = p.y - this.height / 2;
    var rise = ledge.topPoint.y - feetY;

    if (rise <= this.stepHeight + this._skin) { return false; } // step-up handles it
    if (rise > this.mantleHeight) { return false; } // out of reach
    // Above chest height, a grounded tap is refused — must already be airborne to grab it.
    var chestHeight = this.standHeight * FPSC.MANTLE_CHEST_HEIGHT_FRAC;
    if (rise > chestHeight && this.grounded) { return false; }

    // Landing point: advance from the grab point past the face by the character's own depth,
    // stepping back toward the face if that overshoots a shallow ledge, until solid standable
    // ground is found.
    var dx = ledge.probeDx, dz = ledge.probeDz;
    var topBodyY = ledge.topPoint.y + this.height / 2;
    var desiredAdvance = this.depth;
    var landX = p.x, landZ = p.z, landFound = false;
    var steps = 4;
    for (var s = steps; s >= 1; s--) {
        var advance = desiredAdvance * (s / steps);
        var tryX = ledge.topPoint.x + dx * advance;
        var tryZ = ledge.topPoint.z + dz * advance;
        var landHit = raycast(
            this.world,
            new Goblin.Vector3(tryX, topBodyY, tryZ),
            new Goblin.Vector3(tryX, ledge.topPoint.y - this._skin - this.mantleHeight, tryZ),
            this._ignoreSelf
        );
        if (landHit && landHit.normal.y >= FPSC.NY_FLOORLIKE &&
            Math.abs(landHit.point.y - ledge.topPoint.y) < this.stepHeight + this._skin) {
            landX = tryX; landZ = tryZ; landFound = true;
            break;
        }
    }
    if (!landFound) { return false; }

    // The arc drives position directly, so nothing else checks headroom along the way — verify
    // both the grab point and the landing point can stand up.
    var clearanceAtGrab = this._ceilingClearanceAt(p.x, p.z, ledge.topPoint.y);
    if (clearanceAtGrab < this.standHeight - this._skin) { return false; }
    var clearanceAtLand = this._ceilingClearanceAt(landX, landZ, ledge.topPoint.y);
    if (clearanceAtLand < this.standHeight - this._skin) { return false; }

    this._mantleActive = true;
    this._mantleTimer = 0;
    this._mantleStartX = p.x;
    this._mantleStartY = p.y;
    this._mantleStartZ = p.z;
    this._mantleTopBodyY = topBodyY;
    this._mantleLandX = landX;
    this._mantleLandZ = landZ;

    this._moveState = FPSC.MOVE_MANTLE;
    this.grounded = false;
    this._groundSuppress = FPSC.GROUND_SUPPRESS_JUMP;
    this._jumpRising = true;
    this.body.setGravity(0, 0, 0);
    gb.x = 0; gb.y = 0; gb.z = 0;

    return true;
};

// Airborne assists: deflecting velocity off a ceiling on the way up (_ceilingSlide), and gating
// horizontal advance into an overhang too low to fit under (_headroomGate). Neither owns a movement
// state by itself — both act as filters on whatever velocity the active state produced this tick.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * Deflect velocity along an overhead surface we're about to contact, instead of capping the
 * rise to zero — a hard cap leaves no velocity to escape and glues us to ceilings, flat AND
 * sloped. Projects out the into-surface component using the ceiling's own normal: v -= (v.n) n.
 * A flat underside (n straight down) zeroes only the vertical, so horizontal motion survives; a
 * sloped underside redirects the upward motion down-and-along the slope, sliding us out. Only
 * acts when actually rising toward a ceiling within this tick's reach.
 *
 * @method _ceilingSlide
 * @private
 * @param {Number} vx
 * @param {Number} vy
 * @param {Number} vz
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.vx
 * @return {Number} result.vy
 * @return {Number} result.vz
 */
proto._ceilingSlide = function(vx, vy, vz, dt) {
    if (vy <= 0) { return { vx: vx, vy: vy, vz: vz }; } // not rising -> nothing overhead to resolve
    var reach = this.height + vy * dt + this._skin;
    var ceil = this._probeCeiling(reach);
    if (!ceil) { return { vx: vx, vy: vy, vz: vz }; }
    var gap = ceil.point.y - (this.body.position.y + this.height / 2);
    if (gap > vy * dt + this._skin) { return { vx: vx, vy: vy, vz: vz }; } // won't reach it this tick
    var n = ceil.normal; // down-facing (n.y < 0)
    var dot = vx * n.x + vy * n.y + vz * n.z;
    if (dot < 0) {
        // Heading into the surface: remove that component, leaving motion tangent to it.
        vx -= dot * n.x;
        vy -= dot * n.y;
        vz -= dot * n.z;
    }
    return { vx: vx, vy: vy, vz: vz };
};

/**
 * Treat insufficient headroom as a virtual wall: gate on ceiling clearance ahead (rather than
 * surface normal, which a near-horizontal ramp underside can't provide) and slide along the
 * horizontal gradient of increasing clearance.
 * @method _headroomGate
 * @private
 * @param {Number} vx
 * @param {Number} vz
 * @param {Number} dt
 * @return {Object} result
 * @return {Number} result.x - gated horizontal velocity, x.
 * @return {Number} result.z - gated horizontal velocity, z.
 */
proto._headroomGate = function(vx, vz, dt) {
    var speed = Math.sqrt(vx * vx + vz * vz);
    if (speed < FPSC.EPS_DIR) { return { x: vx, z: vz }; }

    if (this.climbSteepSlopes && this._climbableSlopeAhead(this.body.position, vx / speed, vz / speed)) {
        return { x: vx, z: vz };
    }

    var p = this.body.position;
    var feetY = p.y - this.height / 2;
    var need = this.height + this._skin;
    var halfDiag = Math.sqrt((this.width / 2) * (this.width / 2) + (this.depth / 2) * (this.depth / 2));

    // Check clearance centered at the CURRENT position, not a forward-projected point — _ceilingClearanceAt
    // already samples +-(width/2-skin) / +-(depth/2-skin) around its center argument, which is the box's own
    // full footprint including its leading edge. Projecting a "reach" forward on top of that double-counts.
    // The footprint offsets ARE the reach.
    if (this._ceilingClearanceAt(p.x, p.z, feetY) >= need) { return { x: vx, z: vz }; }

    var eps = halfDiag + this._skin;
    var cR = this._ceilingClearanceAt(p.x + eps, p.z, feetY);
    var cL = this._ceilingClearanceAt(p.x - eps, p.z, feetY);
    var cF = this._ceilingClearanceAt(p.x, p.z + eps, feetY);
    var cB = this._ceilingClearanceAt(p.x, p.z - eps, feetY);

    var cap = this.standHeight + this._skin;
    function fin(c) { return isFinite(c) ? c : cap; }
    var gx = fin(cR) - fin(cL);
    var gz = fin(cF) - fin(cB);
    var glen = Math.sqrt(gx * gx + gz * gz);
    if (glen < FPSC.EPS_DIR) {
        // Grounded: stop (forces a crouch). Airborne: let horizontal flow, ceiling slide owns vertical.
        return this.grounded ? { x: 0, z: 0 } : { x: vx, z: vz };
    }
    gx /= glen;
    gz /= glen;

    var into = vx * gx + vz * gz;
    if (into < 0) {
        vx -= into * gx;
        vz -= into * gz;
    }
    return { x: vx, z: vz };
};

// Movement state machine core: beginStep (pre-physics velocity + assists) and endStep (post-physics
// grounding + state decision) bracket a single Goblin world step. See the class doc on
// FPSCharacterController.js for the beginStep/world.step/endStep contract, and the "MOVEMENT STATE
// DECISION" comment inside endStep below for the full state-machine design.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * PRE-physics: set this tick's horizontal velocity (slope/wall projected) + assists.
 *
 * Aim/sim separation: the movement basis comes from the COMMAND's yaw (`cmd.yaw`) — a per-tick
 * input — not from any persistent "live aim". The live aim belongs to the caller (a camera reads
 * it, never the sim), so replaying commands during reconciliation can't drag the view backward.
 * We record the commanded yaw/pitch as this entity's facing (for getState/avatars) only when the
 * command carries them; a caller that never sets yaw keeps driving facing via look() instead.
 *
 * Also applies platform base velocity into the horizontal move (see the constructor's
 * _baseVelocity comment) immediately before collide-and-slide, so a rider is carried through real
 * swept motion rather than a position teleport.
 *
 * @method beginStep
 * @param {Object} command - pure-data input command struct; any field may be absent
 * @param {Number} dt
 */
proto.beginStep = function(command, dt) {
    var cmd = command || {};

    if (this._jumpBufferTimer > 0) { this._jumpBufferTimer = Math.max(0, this._jumpBufferTimer - dt); }

    if (cmd.scale !== undefined && Math.abs(cmd.scale - this.scale) > FPSC.EPS_LEN) { this.setScale(cmd.scale); }
    // Steep-slope walk intent from the command. Applying it immediately lets local prediction climb
    // right away; if an authority later overrules it, setState corrects the flag from the snapshot.
    // Read live per-tick, so a plain assignment is enough.
    if (cmd.climb !== undefined) { this.climbSteepSlopes = !!cmd.climb; }
    var wantCrouch = !!cmd.crouch || (this.crouching && !this._canStand());
    if (wantCrouch !== this.crouching) { this._setCrouch(wantCrouch); }

    if (cmd.userData !== undefined) { this.userData = cmd.userData; }

    var gb = this.body.linear_velocity;

    this._prevY = this.body.position.y;

    var moveYaw = cmd.yaw !== undefined ? cmd.yaw : this.yaw;
    var movePitch = cmd.pitch !== undefined ? cmd.pitch : this.pitch;
    if (cmd.yaw !== undefined) { this.yaw = cmd.yaw; }
    if (cmd.pitch !== undefined) { this.pitch = cmd.pitch; }

    var fwd = this.getForwardHorizontal(moveYaw);
    var rgt = this.getRightHorizontal(moveYaw);
    var cmdF = cmd.forward || 0;
    var cmdR = cmd.right || 0;
    var dirX = fwd.x * cmdF + rgt.x * cmdR;
    var dirZ = fwd.z * cmdF + rgt.z * cmdR;
    var dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
    var hasInput = dirLen > FPSC.EPS_DIR;
    this._cmdIdle = !hasInput;
    var speed = this._getMoveSpeed(cmd);
    var wishX = 0;
    var wishZ = 0;
    if (hasInput) {
        wishX = (dirX / dirLen) * speed;
        wishZ = (dirZ / dirLen) * speed;
    }

    // Stashed for endStep (this same tick, after world.step) to use when it decides this tick's
    // movement state from the fresh ground probe — see the "MOVEMENT STATE DECISION" block there.
    this._wantCrouch = wantCrouch;
    this._hasMoveInput = hasInput;

    var onMantleThisTick = this._updateMantle(cmd, moveYaw, dt);

    // _updateLadder mounts/dismounts and, while mounted, owns velocity fully — checked first since
    // it can override every other state this tick (a ladder grab works even mid-air or mid-slide).
    var onLadderThisTick = !onMantleThisTick && this._updateLadder(cmd, moveYaw, movePitch, dt);

    var vx, vz;
    if (onLadderThisTick || onMantleThisTick) {
        // LADDER / MANTLE: the hook already wrote gb.x/y/z; velocity is fully its.
        vx = gb.x;
        vz = gb.z;
    } else {
        // A jump flips grounded→airborne HERE, before the dispatch below reads this._moveState —
        // _updateVertical updates this._moveState directly on a jump so the same-tick dispatch
        // correctly takes the AIRBORNE branch instead of the stale GROUNDED one.
        this._updateVertical(cmd, dt);

        // ================================================================================
        // MOVEMENT STATE DISPATCH — reads this._moveState, set authoritatively by LAST tick's
        // endStep (or by _updateVertical just above, on a jump this tick). Never re-derives the
        // state from other flags; each branch below is a fully self-contained velocity model for
        // that one state, duplicated rather than shared, so there is exactly one thing to read
        // (this._moveState) to know which branch is live and exactly one place per state that
        // decides its velocity. See the "Movement state machine" comment above endStep.
        // ================================================================================
        if (this._moveState === FPSC.MOVE_SLIDE && this.grounded) {
            // SLIDE, GROUNDED: crouch-at-speed, owns velocity via _updateSlide's surface-tracking
            // model. _updateSlide is a pure per-tick evolver here — it does NOT decide entry/exit
            // anymore (endStep already decided this tick IS a slide); it only advances the
            // slide's velocity one tick (slope accel, friction, steering) from gb, which endStep
            // already set to the correct tangential speed for this tick.
            var slideResult = this._updateSlide(cmd, wishX, wishZ, dt);
            vx = slideResult.vx;
            vz = slideResult.vz;
            gb.y = slideResult.vy;
        } else if (this._moveState === FPSC.MOVE_SLIDE && !this.grounded) {
            // SLIDE, AIRBORNE: a slide that left the ground (ramp lip, drop-off) — see endStep's
            // "genuinely airborne" branch for the condition that keeps this state through the
            // launch. Carried ballistically (gravity, no air-control degradation, no slope model —
            // there's no surface under the character to track) until it lands or slows below
            // slideEndSpeed, at which point endStep drops it to AIRBORNE.
            this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
            if (gb.y < -this._maxFall) { gb.y = -this._maxFall; }
            vx = gb.x;
            vz = gb.z;
        } else if (this._moveState === FPSC.MOVE_SLIP) {
            // SLIP: too-steep surface, gravity-fed, weak air-control.
            this.body.setGravity(0, 0, 0);
            var n = this.groundNormal;
            var slopeMag = Math.sqrt(n.x * n.x + n.z * n.z);
            var dxu = slopeMag > FPSC.EPS_LEN ? n.x / slopeMag : 0;
            var dzu = slopeMag > FPSC.EPS_LEN ? n.z / slopeMag : 0;
            var g = -this._gravityVec.y;
            // Project the incoming 3D velocity onto the plane ONLY on the tick contact is new
            // (endStep left gb.y raw, non-zero, from the fall/toss, on that one tick — see the
            // "MOVEMENT STATE DECISION" comment in endStep). On every later slip tick, endStep
            // zeroes gb.y (the kinematic model owns vertical here, not the solver), so gb.x/gb.z
            // are ALREADY the correctly-accumulated tangential speed from the previous tick's
            // formula below — re-projecting again would read that zeroed gb.y as "no vertical
            // motion yet" and subtract a spurious correction, fighting the accumulation into a
            // false plateau instead of letting speed build tick over tick.
            var gbx = gb.x, gbz = gb.z;
            if (this._slipJustEntered) {
                var dot0 = gb.x * n.x + gb.y * n.y + gb.z * n.z;
                gbx = gb.x - dot0 * n.x;
                gbz = gb.z - dot0 * n.z;
                this._slipJustEntered = false;
            }
            vx = gbx + dxu * g * slopeMag * dt;
            vz = gbz + dzu * g * slopeMag * dt;
            if (hasInput) {
                var twx = wishX, twz = wishZ;
                var up = -(twx * dxu + twz * dzu);
                if (up > 0) { twx += dxu * up; twz += dzu * up; }
                vx += (twx - vx) * this.airControl;
                vz += (twz - vz) * this.airControl;
                var along2 = vx * dxu + vz * dzu;
                if (along2 < 0) { vx -= dxu * along2; vz -= dzu * along2; }
            }
            var alongOut = vx * dxu + vz * dzu;
            gb.y = -alongOut * slopeMag / Math.max(n.y, 0.1);
        } else if (this._moveState === FPSC.MOVE_WALK) {
            // WALK: ordinary input-driven ground movement, projected tangent to groundNormal.
            // KINEMATIC GROUND: gravity off; endStep clamps the feet to the surface. Fully
            // deterministic, doesn't rely on the solver to hold us on a slope (which jittered).
            this.body.setGravity(0, 0, 0);
            var n2 = this.groundNormal;
            var mx, mz;
            if (hasInput) {
                // When slowing while still moving, bleed excess speed at sprintDecay instead of
                // snapping to the lower target speed. _ownVelocityX/Z, not gb.x/z — gb may
                // already carry a platform's base velocity baked in (see the constructor
                // comment); reading it here would re-seed "current speed" with the platform's
                // own speed already added, which then gets base velocity added AGAIN below
                // every tick instead of decaying.
                var cvx = this._ownVelocityX;
                var cvz = this._ownVelocityZ;
                var curSp = Math.sqrt(cvx * cvx + cvz * cvz);
                var wishSp = Math.sqrt(wishX * wishX + wishZ * wishZ);
                if (curSp > wishSp + FPSC.EPS_LEN) {
                    var target = Math.max(wishSp, curSp - this.sprintDecay * dt);
                    var kf = curSp > FPSC.EPS_DIR ? target / curSp : 0;
                    mx = cvx * kf;
                    mz = cvz * kf;
                } else {
                    mx = wishX;
                    mz = wishZ;
                }
            } else {
                // Carry current ground velocity; endStep's groundStopDecel is the sole stop
                // authority. _ownVelocityX/Z, NOT gb.x/z — same reasoning as above.
                mx = this._ownVelocityX;
                mz = this._ownVelocityZ;
            }
            var dot = mx * n2.x + mz * n2.z;
            vx = mx - dot * n2.x;
            vz = mz - dot * n2.z;
            gb.y = -dot * n2.y;
        } else {
            // AIRBORNE: gravity + air control own velocity.
            this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z);
            var cur = gb;
            if (cur.y < -this._maxFall) { gb.y = -this._maxFall; }
            var curSp2 = Math.sqrt(cur.x * cur.x + cur.z * cur.z);
            var wishSp2 = Math.sqrt(wishX * wishX + wishZ * wishZ);
            if (hasInput) {
                if (wishSp2 >= curSp2) {
                    vx = cur.x + (wishX - cur.x) * this.airControl;
                    vz = cur.z + (wishZ - cur.z) * this.airControl;
                } else {
                    // Steer heading toward wish at the same magnitude, without bleeding speed.
                    var wl = wishSp2 || 1;
                    var tx = (wishX / wl) * curSp2;
                    var tz = (wishZ / wl) * curSp2;
                    vx = cur.x + (tx - cur.x) * this.airControl;
                    vz = cur.z + (tz - cur.z) * this.airControl;
                }
            } else {
                vx = cur.x;
                vz = cur.z;
            }
        }
    }

    if (!onLadderThisTick && !onMantleThisTick) {
        var cs = this._ceilingSlide(vx, gb.y, vz, dt);
        vx = cs.vx;
        vz = cs.vz;
        gb.y = cs.vy;
    }

    // Headroom gate: stop us advancing into an overhang too low to fit under (a ramp
    // underside closing onto the floor). A near-horizontal overhang has almost no
    // horizontal surface normal, so collide-and-slide can't see it — we gate on
    // ceiling CLEARANCE instead. Runs before collide-and-slide so walls act on the
    // already-gated velocity.
    var gated = this._headroomGate(vx, vz, dt);

    // Platform base velocity: added in immediately before the swept move so a rider is carried
    // through the SAME collide-and-slide every other velocity goes through (real swept motion, not
    // a position teleport). Stays in gb.x/z afterward — see the constructor's comment for why.
    var bvx = (onLadderThisTick || onMantleThisTick) ? 0 : this._baseVelocity.x;
    var bvz = (onLadderThisTick || onMantleThisTick) ? 0 : this._baseVelocity.z;

    // Step-up/step-down are emergent: collide-and-slide ignores anything shorter than
    // stepHeight, and the ground clamp in endStep raises/lowers us onto it. _collideAndSlide reads
    // this._moveState itself (see its own comment) to exempt an active slide from the too-steep
    // wall rule.
    var slid = this._collideAndSlide(gated.x + bvx, gated.z + bvz, dt);
    gb.x = slid.x;
    gb.z = slid.z;
    this._ownVelocityX = slid.x - bvx;
    this._ownVelocityZ = slid.z - bvz;

    this._prevCrouch = !!cmd.crouch;
};

/**
 * POST-physics: decide grounded and clamp the feet to the ground surface. Also acquires this
 * tick's platform base velocity (see the constructor's _baseVelocity comment) from whatever
 * isPlatform-tagged body the ground probe lands on, read fresh every tick.
 * @method endStep
 * @param {Number} dt
 */
proto.endStep = function(dt) {
    var gb = this.body.linear_velocity;

    // While mounted on a ladder or mid-mantle arc, skip the ground clamp — it would otherwise
    // re-snap the character onto the floor every tick while being carried upward.
    if (this._onLadder || this._mantleActive) {
        this.velocityY = gb.y;
        if (!this._resimulating || this._driveGhostDuringResim) { this._syncGhost(dt); }
        return;
    }

    if (this._groundSuppress > 0) { this._groundSuppress--; }
    // Only suppress grounding while rising (just jumped/thrust); while falling the ground
    // catch must stay live or the body tunnels through the floor. _jumpRising extends this past the
    // fixed countdown for as long as the character is STILL genuinely ascending — see its own
    // comment at the jump site for why a flat tick count alone isn't enough (a still-rising surface
    // underfoot, platform or ramp, can re-enter snap range before the countdown's fixed window would
    // ever expect it to). Cleared the moment gb.y decays past the threshold, so this can't suppress
    // indefinitely — ordinary gravity decay is what ends it.
    if (this._jumpRising && gb.y <= 1) { this._jumpRising = false; }
    var suppressed = this._groundSuppress > 0 && gb.y > 1;

    var half = this.height / 2;
    var maxStick = this.grounded ? this.stepDownDist + this._skin : this._groundTol;

    // Walk candidates highest-first and take the first that ISN'T too tall to step onto (relative
    // to current feet, only while already grounded — see tooHighToStep below). Falling through to
    // a lower, valid candidate keeps grounding honest when a taller obstacle (e.g. a box shoved
    // against the footprint) is also in reach.
    var candidates = this._probeGroundCandidates(this.stepDownDist);
    // Slide launch off a ramp apex — only while SLIDING and rising (walking off the same edge just
    // follows the ground down). ANGLE-BLIND: a slide treats every slope identically regardless of
    // steepness, so this gate never asks "is this too steep" — only "is this still the surface I'm
    // riding." Two ways the true edge shows up in the probe, both handled here:
    //   1. The highest surface RECEDES: the ramp face we were climbing runs out ahead, so the highest
    //      remaining ramp hit drops vs last tick. Clamping to it would hug us down a one-tick dip.
    //   2. A MISMATCHED face (e.g. the ramp's own end-cap) becomes the highest candidate: taller than
    //      the ramp face but not the surface we're riding (normal meaningfully off groundNormal). It can
    //      mask signal #1 by sitting on top, so we test it independently — riding a ramp, the candidate
    //      still ON that same face keeps matching every tick and never trips this; only a genuinely
    //      different face (the real edge) does.
    var topCandidate = candidates.length > 0 ? candidates[0] : null;
    var topCandidateY = topCandidate ? topCandidate.point.y : null;
    var wasSliding = this._moveState === FPSC.MOVE_SLIDE;
    if (this.grounded && wasSliding && gb.y > FPSC.EPS_LEN && topCandidate !== null) {
        var receded = this._prevTopCandidateY !== null && topCandidateY < this._prevTopCandidateY - FPSC.EPS_LEN;
        var normalDot = topCandidate.normal.x * this.groundNormal.x +
            topCandidate.normal.y * this.groundNormal.y +
            topCandidate.normal.z * this.groundNormal.z;
        var mismatched = normalDot < this._minStandableNormalY;
        if (receded || mismatched) { candidates = []; this._slideLaunched = true; }
    }
    // A slide apex launch is latched, not a one-tick decision: the tick it fires, grounded flips false
    // immediately, so the gate above (which requires it true) can never re-arm to catch a second graze
    // later in the same arc. Without this latch, a low/shallow launch that skims just above the ramp's
    // tail gets ground-clamped straight back down the very next tick the probe happens to reach it — a
    // one-tick "dip" mid-arc. Sliding off an apex must NEVER re-hug the geometry, full stop, so once
    // latched we force every candidate away regardless of what the probe finds, for as long as the arc
    // is still rising. The latch clears once gb.y stops climbing (the arc has peaked and started to
    // fall) — from that point a real landing is legitimate and ground detection must resume normally.
    if (this._slideLaunched) {
        if (gb.y > FPSC.EPS_LEN) { candidates = []; }
        else { this._slideLaunched = false; }
    }
    this._prevTopCandidateY = topCandidateY;
    var probe = null, tooHighToStep = false;
    for (var ci = 0; ci < candidates.length; ci++) {
        var c = candidates[ci];
        var rise = (c.point.y + half) - this.body.position.y;
        var tooHigh = this.grounded && rise > this.stepHeight + this._skin;
        if (!tooHigh) { probe = c; tooHighToStep = false; break; }
        if (!probe) { probe = c; tooHighToStep = true; } // keep the highest as a fallback reference
    }

    // feetGap > 0 = feet above ground; < 0 = penetrating (always clamp back out).
    var feetGap = probe ? this.body.position.y - half - probe.point.y : Infinity;

    if (!suppressed && probe && feetGap <= maxStick && !tooHighToStep) {
        var p = this.body.position;
        var clampedY = probe.point.y + half;
        if (!this._resimulating) { this._viewDisplacementY += clampedY - p.y; }
        this.body.position.set(p.x, clampedY, p.z);
        this.body.updateDerived();

        // Save the OUTGOING base velocity before overwriting it below — gb (about to be split into
        // own-vs-base components further down) was built by LAST tick's beginStep using THIS old
        // value, not the new one we're about to acquire. Splitting gb against the NEW value instead
        // manufactures a one-tick phantom "own velocity" spike whenever the platform's velocity
        // changes abruptly between ticks (a reversing elevator/shuttle, or a rotating platform
        // changing direction each tick): gb still reflects the old speed, so subtracting the new
        // speed leaves a large bogus residual that then has to visibly bleed off via the idle
        // ground-stop decay below. Using the OLD value here keeps the split correct for the
        // tick gb was actually built on; the NEW value (acquired below) still lands in
        // this._baseVelocity for beginStep to pick up fresh next tick, same as always.
        var outgoingBaseVelocityX = this._baseVelocity.x, outgoingBaseVelocityZ = this._baseVelocity.z;
        var standingOn = probe.object;
        if (standingOn && standingOn.isPlatform) {
            var pv = standingOn.linear_velocity;
            var bvx = pv.x, bvy = pv.y, bvz = pv.z;
            // Rotating platform: carry the character along the platform's own EXACT arc this tick,
            // Y-axis spin only (the only axis a standable platform can usefully spin on). Recomputed
            // fresh every tick from the CURRENT offset (not cached), so as the character walks
            // toward/away from the pivot the imparted speed tracks the true radius, and so it decays
            // to zero at the pivot itself.
            //
            // NOT a naive omega x r tangential velocity: that's only the arc's INSTANTANEOUS tangent,
            // and applying it as a straight line for a full tick always overshoots the true curve —
            // every tick's move ends up very slightly outside the circle, and next tick's tangent is
            // computed from that already-drifted position, so the error compounds tick over tick into
            // an outward spiral (visible at high spin rates as being "flung off the platform"). Fix:
            // compute the CHORD velocity instead — the constant velocity that carries the rider from
            // its current offset to the offset EXACTLY rotated by theta=omegaY*dt, i.e.
            // (rotated - current) / dt. This reproduces the platform's real circular motion exactly
            // regardless of angular speed, instead of approximating it.
            if (standingOn.isRotatingPlatform && standingOn.angular_velocity) {
                var omegaY = standingOn.angular_velocity.y;
                if (omegaY && dt > 0) {
                    var center = standingOn.position;
                    var rx = this.body.position.x - center.x;
                    var rz = this.body.position.z - center.z;
                    var theta = omegaY * dt;
                    var cosT = Math.cos(theta), sinT = Math.sin(theta);
                    // Matches Goblin's own rotation convention (verified against RigidBody's quaternion
                    // integration directly, not assumed): for omegaY > 0, the rotated offset is
                    // (rx*cos+rz*sin, rz*cos-rx*sin) — the same sense that produced the correct
                    // (omegaY*rz, -omegaY*rx) instantaneous tangent this replaces.
                    var rxRot = rx * cosT + rz * sinT;
                    var rzRot = rz * cosT - rx * sinT;
                    bvx += (rxRot - rx) / dt;
                    bvz += (rzRot - rz) / dt;
                }
            }
            this._baseVelocity.set(bvx, bvy, bvz);
        } else {
            this._baseVelocity.set(0, 0, 0);
        }

        // ================================================================================
        // MOVEMENT STATE DECISION — the ONE place per tick this is decided, from the ONE real
        // ground probe this tick has. beginStep (next tick) only ever reads this._moveState; it
        // never re-derives sliding/slipping/walking from other flags.
        // ================================================================================
        var pn = probe.normal;
        var probeSlope = Math.sqrt(pn.x * pn.x + pn.z * pn.z);

        // Project the incoming 3D velocity onto the surface plane ONCE, here, on every grounding
        // tick — not just the first-contact tick. (v -= (v·n)n): removes the into-surface
        // component, keeps the along-surface (tangential) component. On a tick where the body was
        // already resting on this same surface last tick too, this is a no-op (gb is already
        // tangent), so it's safe to always run — no separate "first contact only" special case.
        var vdotn = gb.x * pn.x + gb.y * pn.y + gb.z * pn.z;
        var tangentX = gb.x - vdotn * pn.x;
        var tangentZ = gb.z - vdotn * pn.z;
        var horizTangentSpeed = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ);

        // TRUE along-the-ground speed, for the slide entry/sustain SPEED test only (tangentX/Z above,
        // which DOES include platform velocity, is what actually gets written to gb). Platform
        // velocity is excluded from this speed reading — otherwise a fast rotating platform's own
        // tangential speed alone can exceed moveSpeed with zero player effort, launching an unwanted
        // slide on crouch while just riding. Reconstructs true 3D along-surface speed the same way a
        // slope converts fall speed to horizontal (divide the along-slope component by ny).
        var vdotnOwn = (gb.x - outgoingBaseVelocityX) * pn.x + gb.y * pn.y + (gb.z - outgoingBaseVelocityZ) * pn.z;
        var tangentOwnX = (gb.x - outgoingBaseVelocityX) - vdotnOwn * pn.x;
        var tangentOwnZ = (gb.z - outgoingBaseVelocityZ) - vdotnOwn * pn.z;
        var horizTangentOwnSpeed = Math.sqrt(tangentOwnX * tangentOwnX + tangentOwnZ * tangentOwnZ);

        var slopeMag0 = probeSlope;
        var ny0 = Math.max(pn.y, 0.1);
        var groundSp;
        if (slopeMag0 > FPSC.EPS_LEN) {
            var dxu0 = pn.x / slopeMag0, dzu0 = pn.z / slopeMag0;
            var alongH = tangentOwnX * dxu0 + tangentOwnZ * dzu0;
            var crossSq = Math.max(0, horizTangentOwnSpeed * horizTangentOwnSpeed - alongH * alongH);
            var surfFall = alongH / ny0;
            groundSp = Math.sqrt(surfFall * surfFall + crossSq);
        } else {
            groundSp = horizTangentOwnSpeed;
        }
        var tangentSpeed = groundSp;

        var isSlipSurface = this._isSlipSurface(pn);
        // Slide ENTRY/SUSTAIN uses the SAME rule regardless of whether this is the first contact
        // tick or the 500th tick of an already-active slide: crouch held, and (on a slope, ride
        // until crouch releases; on flat, need speed above slideEndSpeed to keep going / above
        // moveSpeed to start). This mirrors _updateSlide's old entry/sustain split, but evaluated
        // ONCE, with this tick's own fresh probe normal and true tangential speed — not the
        // previous tick's groundNormal, not a landing-only special case.
        var slopeSlideEligible = probeSlope >= this.slideSlopeMin;
        var hasMoveInputThisTick = this._hasMoveInput;
        var slideInputOk = !this.slideRequiresMoveInput || hasMoveInputThisTick ||
            (this.slideAllowLandingWithoutInput && !this.grounded);
        var slideSustainOk = slopeSlideEligible || tangentSpeed >= this.slideEndSpeed;
        var slideEntryOk = slideInputOk && tangentSpeed > this.moveSpeed + FPSC.EPS_SPEED_MARGIN;
        var wantsSlide = !!this._wantCrouch && (wasSliding ? slideSustainOk : slideEntryOk);

        if (wantsSlide) {
            this._moveState = FPSC.MOVE_SLIDE;
            var enteringSlide = !wasSliding;
            // slideBoost applied HERE, on the exact entry tick, directly to the velocity endStep is
            // about to commit — not inside _updateSlide (which only runs the FOLLOWING tick, in
            // beginStep). Applying it there would show the boost one tick later than the state
            // transition itself, which is observably wrong (a caller reading "just started
            // sliding" this tick would see un-boosted speed).
            var boostedX = tangentX, boostedZ = tangentZ;
            if (enteringSlide && this.slideBoost !== 1) {
                boostedX *= this.slideBoost;
                boostedZ *= this.slideBoost;
            }
            gb.x = boostedX;
            gb.z = boostedZ;
            // gb.y is left for _updateSlide's onSlope solve to derive from the tangential speed
            // above — writing a raw projected vertical here overshoots the surface-follow value
            // and skips the character off the ramp for a tick (a bounce).
            gb.y = 0;
        } else if (isSlipSurface) {
            // Entry edge: this tick starts a NEW slip iff last tick wasn't already one. beginStep's
            // SLIP branch only re-projects gb onto
            // groundNormal on that one entry tick (see its own comment) — every later tick, gb.y
            // is already 0 (set below) and gb.x/gb.z already hold the correctly-accumulated
            // tangential speed from beginStep's own per-tick formula, so re-projecting again would
            // corrupt that accumulation into a false plateau.
            var enteringSlip = this._moveState !== FPSC.MOVE_SLIP;
            this._slipJustEntered = enteringSlip;
            this._moveState = FPSC.MOVE_SLIP;
            // Keep the RAW incoming gb.x/gb.z/gb.y (NOT the tangential projection) on the entry
            // tick — beginStep's SLIP branch does its own plane projection from this.groundNormal
            // next tick, gated to _slipJustEntered, and needs gb.y to still be the real incoming
            // fall speed to project. From the SECOND slip tick on, gb.y is zeroed here as usual —
            // beginStep's per-tick formula derives its own vy from there on, and leaving a stale
            // gb.y would double-count it.
            if (!enteringSlip) { gb.y = 0; }
        } else {
            this._moveState = FPSC.MOVE_WALK;
            gb.x = tangentX;
            gb.z = tangentZ;
            gb.y = 0;
        }
        // Split against the OUTGOING (pre-acquire) base velocity, not the freshly-acquired one — see
        // the comment above outgoingBaseVelocityX/Z's declaration for why.
        this._ownVelocityX = gb.x - outgoingBaseVelocityX;
        this._ownVelocityZ = gb.z - outgoingBaseVelocityZ;

        // Idle ground-stop: WALK only. Bleeds horizontal speed toward zero at groundStopDecel.
        // Reads/writes _ownVelocityX/Z (the character's OWN component), NOT gb.x/z directly — gb
        // may already carry a platform's base velocity baked in, and decaying THAT would fight
        // the ride. The decayed own-component is added back onto base velocity so gb ends up
        // carrying: decayed own motion + full undecayed platform motion.
        if (this._cmdIdle && this._moveState === FPSC.MOVE_WALK) {
            var cvx = this._ownVelocityX || 0;
            var cvz = this._ownVelocityZ || 0;
            var sp = Math.sqrt(cvx * cvx + cvz * cvz);
            var target = Math.max(0, sp - this.groundStopDecel * dt);
            var kf = sp > FPSC.EPS_SPD ? target / sp : 0;
            this._ownVelocityX = cvx * kf;
            this._ownVelocityZ = cvz * kf;
            gb.x = this._ownVelocityX + this._baseVelocity.x;
            gb.z = this._ownVelocityZ + this._baseVelocity.z;
        }

        this.grounded = true;
        this.groundNormal.set(probe.normal.x, probe.normal.y, probe.normal.z);
    } else if (tooHighToStep) {
        // Refusing to climb something too tall (e.g. a box shoved into the footprint) must NOT be
        // treated as leaving the ground: the feet haven't moved, there's no gap, no fall — the
        // character is exactly where it was a moment ago, still resting on whatever it was resting
        // on. Staying grounded on rejection keeps the height-limit check
        // (this.grounded && rise > stepHeight) honest on the next tick too.
        gb.y = 0;
        // Movement state is UNCHANGED here on purpose: the character is exactly where it was,
        // still resting on whatever it was resting on, so whatever state that was is still true.
    } else {
        this.grounded = false;
        // A slide that leaves the ground (ramp lip, drop-off) stays MOVE_SLIDE through the airborne
        // arc — carried mostly ballistically rather than air-controlled — as long as horizontal
        // speed is still above slideEndSpeed (the same floor flat sliding itself uses to decide
        // "still going") and crouch is still held. beginStep's SLIDE branch has its own airborne vs.
        // grounded sub-cases for exactly this reason. Landing re-enters the ordinary MOVEMENT STATE
        // DECISION above on the fresh probe normal, so it naturally continues sliding (onto a ramp)
        // or drops to WALK/SLIP there — no separate landing special-case needed here.
        var wasSlideBeforeLoss = this._moveState === FPSC.MOVE_SLIDE;
        var stillFastEnough = Math.sqrt(gb.x * gb.x + gb.z * gb.z) >= this.slideEndSpeed;
        if (wasSlideBeforeLoss && this._wantCrouch && stillFastEnough) {
            this._moveState = FPSC.MOVE_SLIDE;
        } else {
            this._moveState = FPSC.MOVE_AIRBORNE;
        }
        // Genuinely airborne — no ground entity to inherit velocity from. A jump already captured
        // baseVelocity.y additively the tick it fired (_updateVertical); clearing here only stops
        // FUTURE ticks from reading a stale platform velocity while falling free.
        this._baseVelocity.set(0, 0, 0);
    }

    // Coyote window: refill while grounded, bleed down once airborne. No-op when coyoteTime=0.
    if (this.grounded) { this._coyoteTimer = this.coyoteTime; }
    else if (this._coyoteTimer > 0) { this._coyoteTimer = Math.max(0, this._coyoteTimer - dt); }

    this.velocityY = gb.y;

    // Drive the ghost every tick, INCLUDING during resim: the ghost is how the character pushes objects,
    // and object pushes must be reproduced when already-run commands get rolled back and resimulated
    // (otherwise a pushed object is predicted live but snaps back every snapshot — rubber-banding). The
    // ghost drive is deterministic given the character's state. What must NOT run during resim is the
    // knockback READBACK from the ghost into the character (see _syncGhost / _readGhostKnockback): feeding
    // a solver body's contact velocity back into the character mid-rollback is what injects non-determinism
    // into the reconciled character path. That readback is gated inside _syncGhost.
    // Opt-out (driveGhostDuringResim=false): freeze the ghost during resim (older behavior).
    if (!this._resimulating || this._driveGhostDuringResim) { this._syncGhost(dt); }
};

// View/aim/render-interpolation surface, plus the small read-only state accessors a caller polls
// every frame (sliding, moveState, bodyId, raycastIgnore). None of this touches simulation state
// except look()/setLook()/aim(), which are the caller's own facing/aim writes.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * True while a slide is active this tick. Reads the single authoritative _moveState field that
 * endStep sets — see the "Movement state machine" comment above endStep (Movement/Step.js).
 * @property sliding
 * @type {Boolean}
 * @readOnly
 */
Object.defineProperty(proto, 'sliding', { get: function() { return this._moveState === FPSC.MOVE_SLIDE; } });

/**
 * This tick's movement state: one of FPSC.MOVE_LADDER / MOVE_AIRBORNE / MOVE_WALK / MOVE_SLIP /
 * MOVE_SLIDE. Set exactly once per tick, by endStep, from a fresh ground probe — beginStep (which
 * runs BEFORE endStep, on the state endStep decided last tick) only ever READS this, never
 * re-derives it. See the "Movement state machine" comment above endStep for the full design.
 * @property moveState
 * @type {String}
 * @readOnly
 */
Object.defineProperty(proto, 'moveState', { get: function() { return this._moveState; } });

/**
 * This controller's physics-body name (the value raycasts exclude to avoid self-hits).
 * @property bodyId
 * @type {String}
 * @readOnly
 */
Object.defineProperty(proto, 'bodyId', { get: function() { return this._bodyName; } });

/**
 * The body-name list this controller's own probes ignore — pass to a game's own raycasts
 * (weapons, line-of-sight) so a shooter's cast doesn't hit itself.
 * @property raycastIgnore
 * @type {String[]}
 * @readOnly
 */
Object.defineProperty(proto, 'raycastIgnore', { get: function() { return this._ignoreSelf; } });

// ---- Look --------------------------------------------------------------

/**
 * @method look
 * @param {Number} deltaYaw
 * @param {Number} deltaPitch
 */
proto.look = function(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch += deltaPitch;
    if (this.pitch > this.maxPitch) { this.pitch = this.maxPitch; }
    if (this.pitch < -this.maxPitch) { this.pitch = -this.maxPitch; }
};

/**
 * @method setLook
 * @param {Number} yaw
 * @param {Number} pitch
 */
proto.setLook = function(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = pitch;
};

/**
 * Full 3D look direction (includes pitch).
 * @method getLookDirection
 * @return {Goblin.Vector3}
 */
proto.getLookDirection = function() {
    var cp = Math.cos(this.pitch);
    return new Goblin.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
};

/**
 * Set the LIVE, caller-owned aim — call once per render frame from your mouse-look. Render-only:
 * this NEVER enters the simulation (it doesn't touch yaw/pitch, the command, or movement), it just
 * keeps a viewmodel/camera glued to the present view instead of the 60Hz sim yaw — fixing the
 * between-tick "dangle" in every mode.
 *
 * @method aim
 * @param {Number} yaw
 * @param {Number} pitch
 */
proto.aim = function(yaw, pitch) {
    this._liveYaw = yaw;
    this._livePitch = pitch;
    this._liveAimSet = true;
};

/**
 * The live aim's full 3D direction (render-only; from aim()). Falls back to the sim look.
 * @method getLiveAimDirection
 * @return {Goblin.Vector3}
 */
proto.getLiveAimDirection = function() {
    if (!this._liveAimSet) { return this.getLookDirection(); }
    var cp = Math.cos(this._livePitch);
    return new Goblin.Vector3(Math.sin(this._liveYaw) * cp, Math.sin(this._livePitch), Math.cos(this._liveYaw) * cp);
};

/**
 * Horizontal forward for a given yaw (defaults to current facing).
 * @method getForwardHorizontal
 * @param {Number} [yaw]
 * @return {Goblin.Vector3}
 */
proto.getForwardHorizontal = function(yaw) {
    if (yaw === undefined) { yaw = this.yaw; }
    return new Goblin.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
};

/**
 * Horizontal right for a given yaw (defaults to current facing). Negated to match a
 * left-handed view convention so DirRight strafes to the character's visual right.
 * @method getRightHorizontal
 * @param {Number} [yaw]
 * @return {Goblin.Vector3}
 */
proto.getRightHorizontal = function(yaw) {
    if (yaw === undefined) { yaw = this.yaw; }
    return new Goblin.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
};

/**
 * World-space eye position (camera goes here).
 * @method getEyePosition
 * @return {Goblin.Vector3}
 */
proto.getEyePosition = function() {
    var p = this.body.position;
    return new Goblin.Vector3(p.x, p.y + this.eyeHeight, p.z);
};

/**
 * Return the artificial vertical eye displacement accumulated since the last call (step/landing
 * snaps + crouch/scale swaps) and reset it. A camera folds this into a decaying offset so it
 * eases over those discontinuities. Call once per render frame. Render-only — does not affect sim.
 * @method consumeViewDisplacementY
 * @return {Number}
 */
proto.consumeViewDisplacementY = function() {
    var d = this._viewDisplacementY;
    this._viewDisplacementY = 0;
    return d;
};

/**
 * Peek at the pending vertical eye displacement WITHOUT consuming it. A render-side smoother
 * consumes (consumeViewDisplacementY); a caller that only wants to DETECT a discontinuity this
 * frame (e.g. to snap interpolation instead of sliding the eye) reads this and leaves the value
 * for the smoother. Read-only — never mutates sim or render state.
 * @method peekViewDisplacementY
 * @return {Number}
 */
proto.peekViewDisplacementY = function() {
    return this._viewDisplacementY;
};

/**
 * Stash this fixed tick's eye for sub-tick render interpolation. Call ONCE per REAL fixed step,
 * right after the step settles. A teleport-sized jump (respawn / kill-plane / hard resync) or an
 * artificial step/crouch eye snap snaps the interpolation — prev := curr — so the eye doesn't
 * smear across the discontinuity.
 *
 * @method captureRenderState
 */
proto.captureRenderState = function() {
    var e = this.getEyePosition();
    var snap = !this._currEye;
    if (this._currEye) {
        var dx = e.x - this._currEye.x, dy = e.y - this._currEye.y, dz = e.z - this._currEye.z;
        if (dx * dx + dy * dy + dz * dz > this._renderSnapDist2) { snap = true; } // teleport-sized
    }
    if (Math.abs(this.peekViewDisplacementY()) > FPSC.VIEW_DISP_SNAP) { snap = true; }
    this._prevEye = snap ? e : this._currEye;
    this._currEye = e;
};

/**
 * The render-only eye position: the last two captured fixed-tick eyes lerped by the sub-tick factor
 * `alpha` (0..1, the fraction into the current fixed step the renderer hands the draw call). Falls
 * back to the live physics eye until two ticks have been captured.
 *
 * @method renderEye
 * @param {Number} alpha
 * @return {Goblin.Vector3}
 */
proto.renderEye = function(alpha) {
    if (!this._prevEye || !this._currEye) { return this.getEyePosition(); }
    var a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    var ex = this._prevEye.x + (this._currEye.x - this._prevEye.x) * a;
    var ey = this._prevEye.y + (this._currEye.y - this._prevEye.y) * a;
    var ez = this._prevEye.z + (this._currEye.z - this._prevEye.z) * a;
    return new Goblin.Vector3(ex, ey, ez);
};

// Entity interface (authoritative snapshots / reconciliation). beginStep/endStep (Movement/Step.js)
// are the sim; getState/setState complete the duck-typed entity contract
// {beginStep, endStep, getState, setState} an external framework can drive, and
// beginResim/endResim bracket a rollback-and-resim of already-run commands.
var proto = Goblin.FPSCharacterController.prototype;
var FPSC = Goblin.FPSCharacterController.FPSC;

/**
 * Reconciliation hooks (opt-in, called by the caller around a ROLLBACK-AND-RESIM of already-run
 * commands — distinct from a game "replay"). During resim the controller re-derives already-
 * perceived state, so its step/crouch snaps must NOT feed a render smoother (that double-counts
 * every step until the resim catches back up). Live ticks are unaffected.
 * @method beginResim
 */
proto.beginResim = function() { this._resimulating = true; };
/**
 * @method endResim
 */
proto.endResim = function() { this._resimulating = false; };

/**
 * Snapshot this controller's authoritative state for the network.
 * @method getState
 * @return {Object} state
 * @return {Number} state.x - body position x.
 * @return {Number} state.y - body position y.
 * @return {Number} state.z - body position z.
 * @return {Number} state.vx - body linear velocity x.
 * @return {Number} state.vy - body linear velocity y.
 * @return {Number} state.vz - body linear velocity z.
 * @return {Number} state.yaw - commanded facing yaw.
 * @return {Number} state.pitch - commanded facing pitch.
 * @return {Boolean} state.grounded
 * @return {Number} state.w - collider width.
 * @return {Number} state.h - collider height (reflects crouch).
 * @return {String} state.moveState - one of FPSC.MOVE_LADDER/MOVE_AIRBORNE/MOVE_WALK/MOVE_SLIP/MOVE_SLIDE;
 *   see the "Movement state machine" comment above endStep — serialized so resim re-adopts the exact
 *   state live prediction was in, not a re-derived guess.
 * @return {Boolean} state.sliding - plain boolean convenience view of moveState === MOVE_SLIDE, for
 *   snapshot consumers that only care about this one bit (e.g. a body model tilting while sliding).
 * @return {Number} state.gs - ground-suppress tick counter (see endStep's `suppressed`).
 * @return {Number} state.ct - coyote-time timer remaining.
 * @return {Number} state.jb - jump-buffer timer remaining.
 * @return {Number} state.gnx - ground normal x.
 * @return {Number} state.gny - ground normal y.
 * @return {Number} state.gnz - ground normal z.
 * @return {Boolean} state.climb - steep-slope walk allowance (can be granted/refused by an authority
 *   outside this controller; serialized so prediction + resim read the authoritative value).
 * @return {Boolean} state.onLadder - ladder mount state.
 * @return {Number} state.lnx - ladder face normal x (points OUT of the ladder face).
 * @return {Number} state.lnz - ladder face normal z.
 * @return {*} state.userData - opaque consumer payload, passed through unexamined.
 *
 * NB: the ghost (the body that pushes objects) is deliberately NOT serialized. It's a local
 * follow-the-character construct; setState re-derives it locally by snapping it to the
 * authoritative character. Serializing it added bandwidth for identical results.
 */
proto.getState = function() {
    var p = this.body.position;
    var v = this.body.linear_velocity;
    return {
        x: p.x, y: p.y, z: p.z,
        vx: v.x, vy: v.y, vz: v.z,
        yaw: this.yaw, pitch: this.pitch,
        grounded: this.grounded,
        w: this.width, h: this.height,
        moveState: this._moveState,
        sliding: this._moveState === FPSC.MOVE_SLIDE,
        gs: this._groundSuppress,
        ct: this._coyoteTimer,
        jb: this._jumpBufferTimer,
        gnx: this.groundNormal.x, gny: this.groundNormal.y, gnz: this.groundNormal.z,
        climb: this.climbSteepSlopes,
        onLadder: this._onLadder,
        lnx: this._ladderNormal.x, lnz: this._ladderNormal.z,
        mantleActive: this._mantleActive,
        mantleTimer: this._mantleTimer,
        mantleSX: this._mantleStartX, mantleSY: this._mantleStartY, mantleSZ: this._mantleStartZ,
        mantleTopY: this._mantleTopBodyY,
        mantleLX: this._mantleLandX, mantleLZ: this._mantleLandZ,
        userData: this.userData
    };
};

/**
 * Apply an authoritative state (from a snapshot). Sets position, velocity and grounded; does not
 * touch yaw/pitch. Used for reconciliation before replaying already-run commands.
 * @method setState
 * @param {Object} s - a snapshot as produced by getState.
 * @param {Number} s.x
 * @param {Number} s.y
 * @param {Number} s.z
 * @param {Number} s.vx
 * @param {Number} s.vy
 * @param {Number} s.vz
 * @param {Boolean} [s.grounded]
 * @param {Number} [s.h] - collider height; a mismatch vs the current height rebuilds the collider
 *   (and re-derives crouching) before position is adopted.
 * @param {String} [s.moveState]
 * @param {Number} [s.gs]
 * @param {Number} [s.ct]
 * @param {Number} [s.jb]
 * @param {Number} [s.gnx]
 * @param {Number} [s.gny]
 * @param {Number} [s.gnz]
 * @param {Boolean} [s.climb]
 * @param {Boolean} [s.onLadder]
 * @param {Number} [s.lnx]
 * @param {Number} [s.lnz]
 * @param {*} [s.userData]
 */
proto.setState = function(s) {
    // Rebuild the collider at the authoritative center/height before adopting position, so the
    // geometry matches the snapshot's before replay (a height mismatch would re-plant crouch from
    // the wrong baseline every snapshot).
    if (s.h !== undefined && Math.abs(s.h - this.height) > FPSC.EPS_SPEED_MARGIN) {
        this.crouching = s.h < this.standHeight - FPSC.EPS_SPEED_MARGIN;
        this.height = s.h;
        this.eyeHeight = this.crouching ? this.standEye * this.crouchRatio : this.standEye;
        this._buildBody(new Goblin.Vector3(s.x, s.y, s.z));
    }
    this.body.position.set(s.x, s.y, s.z);
    this.body.updateDerived();
    var v = this.body.linear_velocity;
    v.x = s.vx;
    v.y = s.vy;
    v.z = s.vz;
    this.velocityY = s.vy;
    // _ownVelocityX/Z aren't snapshot fields — re-derive them from gb so they don't go stale (see
    // constructor comment).
    this._ownVelocityX = v.x - this._baseVelocity.x;
    this._ownVelocityZ = v.z - this._baseVelocity.z;
    if (s.grounded !== undefined) { this.grounded = s.grounded; }
    // Adopt the authoritative movement state directly — resim then starts from exactly the state
    // live prediction was in (WALK/SLIP/SLIDE/AIRBORNE/LADDER), not a locally re-derived guess.
    if (s.moveState !== undefined) { this._moveState = s.moveState; }
    if (s.gs !== undefined) { this._groundSuppress = s.gs; }
    if (s.ct !== undefined) { this._coyoteTimer = s.ct; }
    if (s.jb !== undefined) { this._jumpBufferTimer = s.jb; }
    if (s.gnx !== undefined) { this.groundNormal.set(s.gnx, s.gny, s.gnz); }
    // Adopt the authoritative steep-slope allowance. This is the ONLY place the live flag is written
    // from outside — a command only sets INTENT, an authority grants/refuses it, and the truth comes
    // back here. Read live each tick by the mover/grounding, so no rebuild is needed.
    if (s.climb !== undefined) { this.climbSteepSlopes = s.climb; }
    if (s.onLadder !== undefined) { this._onLadder = s.onLadder; }
    if (s.lnx !== undefined) { this._ladderNormal.set(s.lnx, 0, s.lnz); }
    if (s.mantleActive !== undefined) { this._mantleActive = s.mantleActive; }
    if (s.mantleTimer !== undefined) { this._mantleTimer = s.mantleTimer; }
    if (s.mantleSX !== undefined) {
        this._mantleStartX = s.mantleSX; this._mantleStartY = s.mantleSY; this._mantleStartZ = s.mantleSZ;
    }
    if (s.mantleTopY !== undefined) { this._mantleTopBodyY = s.mantleTopY; }
    if (s.mantleLX !== undefined) { this._mantleLandX = s.mantleLX; this._mantleLandZ = s.mantleLZ; }
    // Restore gravity if mantling — _updateMantle zeroes it on entry but setState re-adopts the
    // arc mid-flight without re-running the entry code.
    if (this._mantleActive) { this.body.setGravity(0, 0, 0); }
    else { this.body.setGravity(this._gravityVec.x, this._gravityVec.y, this._gravityVec.z); }
    // Re-baseline the ghost LOCALLY (not from the snapshot — the ghost isn't serialized). Snap it onto
    // the just-adopted authoritative character, moving at the character's velocity, so every resim starts
    // from the same consistent ghost state and re-pushes objects identically each time.
    // Opt-out (hardsnapGhostOnReconcile=false): leave the ghost drifted.
    if (this._ghost && this._hardsnapGhostOnReconcile) {
        var bp = this.body.position, pv = this.body.linear_velocity;
        this._ghost.position.set(bp.x, bp.y + (this._ghostGroundInset || 0) / 2, bp.z);
        this._ghost.linear_velocity.set(pv.x, pv.y, pv.z);
        this._ghostCommandedVel = { x: pv.x, y: pv.y, z: pv.z };
    }
    this._prevCrouch = this.crouching;
    if (s.userData !== undefined) { this.userData = s.userData; }
};

/**
 * Every tunable default for FPSCharacterController, in ONE place, grouped by subsystem. The
 * controller reads each default from here (constructor: `o.walkSpeed !== undefined ?
 * o.walkSpeed : Goblin.FPS_CONTROLLER_DEFAULTS.movement.walkSpeed`), so a caller can still
 * override any single value per-instance via the options object — this is only the fallback.
 *
 * What is NOT here (on purpose): algorithm-internal epsilons/thresholds inside the collision +
 * slope math (1e-4 guards, normal.y classifications, sub-step fractions) — those are
 * implementation details, not feel knobs, and stay at their use site in
 * CharacterController/Constants.js (the FPSC object).
 *
 * @class FPS_CONTROLLER_DEFAULTS
 * @static
 */
Goblin.FPS_CONTROLLER_DEFAULTS = {
    // ---- Collider dimensions + mass (pre-scale "base" values; _applyScale multiplies at runtime) ----
    dimensions: {
        width: 0.6,
        depth: 0.6,
        height: 1.8,
        mass: 10,
        eyeHeightRatio: 0.42, // eyeHeight default = height * this (overridable directly via o.eyeHeight)
        crouchRatio: 0.55,    // crouched collider height as a fraction of standing height
    },

    // ---- Ground movement. Three gaits: walk (held modifier) < move/run (default) < sprint. ----
    movement: {
        walkSpeed: 3.8,        // deliberate slow gait (held walk modifier)
        moveSpeed: 7,          // RUN speed — the no-modifier default
        sprintSpeed: 11.5,     // top gait
        crouchSpeedMult: 0.5,  // multiplies whichever gait is active while crouched (unitless)
        sprintDecay: 10,       // units/sec bleed of excess speed after releasing sprint (Infinity = instant)
        groundStopDecel: 80,   // units/sec decel when all move keys released (idle stop)
        airControl: 0.12,      // steering authority while airborne (0..1)
        friction: 0,           // body friction (0 keeps wall-slides clean; kinematic grounding holds slopes)
    },

    // ---- Jump + forgiveness windows ----
    jump: {
        jumpSpeed: 4.6,
        stepHeight: 0.4,       // max ledge height the mover steps up onto (base/1x; scales linearly with player scale)
        stepDownDist: 0.5,     // max drop the mover snaps down to keep grounded
        coyoteTime: 0.1,       // sec after leaving a ledge a jump still registers
        jumpBuffer: 0.12,      // sec before landing a jump press is remembered and fires on touchdown
    },

    // ---- Slopes ----
    slopes: {
        maxSlopeAngle: 45.57,  // max standable slope, degrees (>=90 disables the limit)
        climbSteepSlopes: false, // can the player ascend a too-steep slope by walking into it
    },

    // ---- Slide (crouch-at-speed) ----
    slide: {
        enabled: true,
        requiresMoveInput: true,  // ENTRY requires a movement key held (not crouch alone); exit does not
        allowLandingWithoutInput: true, // ...EXCEPT on the landing frame, where crouch + speed alone can start a slide
        minSpeed: 7.8,         // speed at/above which a crouch launches a slide
        endSpeed: 1,           // slide ends when speed bleeds below this
        friction: 6,           // flat-ground slide friction
        boost: 1.3,            // launch speed multiplier
        control: 0.14,         // steering authority while sliding (0..1)
        slopeAccel: 1.5,       // downhill acceleration factor while sliding
        slopeMin: 0.2,         // sin(angle) at/above which the slide is gravity-governed (Infinity disables)
        slopeFriction: 1.5,    // cross-slope friction while gravity-sliding
        reversalBrakeMult: 4,  // multiplier on slopeFriction for how hard a deliberate reversal brakes
    },

    // ---- Ladders (see _updateLadder) ----
    ladder: {
        climbSpeed: 2.5,        // vertical speed while climbing (pre-scale)
        strafeSpeed: 2.5,       // lateral speed along the ladder's face while climbing (pre-scale)
        // Forward/back and strafe contributions are summed WITHOUT normalizing the combined wish
        // vector, unlike ground movement — holding both diagonally into a ladder climbs strictly
        // faster than either alone. Intentional.
        mountReach: 0.2,        // reach (pre-scale) past the collider's own half-width for the mount probe
        dismountPushSpeed: 7.0, // horizontal shove speed away from the face on a jump-off dismount (pre-scale)
    },

    // ---- Ghost: the solver body that trails the player and pushes objects (see _syncGhost) ----
    ghost: {
        pushMassBaseMult: 35,  // objects heavier than mass * this block like a wall; lighter yield proportionally
        // Physics material of the ghost body itself (not the chase drive, which targets the
        // character's predicted end-of-tick position directly). Zero friction/restitution/
        // linearDamping so the chase-drive velocity is never fought by the solver; high
        // angularDamping keeps contact torque from spinning it up while it shoves objects.
        material: {
            friction: 0,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0.9,
        },
    },

    // ---- Knockback: how the player RECEIVES a push from an object (see _readGhostKnockback) ----
    knockback: {
        receivePush: true,        // gate the whole knockback path
        maxSpeed: 16,             // cap on received knockback speed
        knockbackFraction: 1.0,   // scale received knockback
        selfPush: false,          // false = only an object with its OWN inbound momentum knocks you (no self-push
                                  //         oscillation); true = legacy relative-closing gate (oscillates)
    },

    // ---- Netcode / prediction behavior for the ghost (both default ON; false reverts to older behavior) ----
    netcode: {
        driveGhostDuringResim: true,    // run the ghost drive during rollback resim (off = objects rubber-band)
        hardsnapGhostOnReconcile: true, // snap ghost onto authority on setState (off = objects oscillate)
    },

    // ---- View / aim ----
    view: {
        yaw: 0,
        pitch: 0,
        maxPitch: 1.5,         // clamp, radians
    },

    // ---- Render (sub-tick eye interpolation) ----
    render: {
        snapDist: 0.8,         // per-tick eye jump (units) above which the interp snaps instead of sliding
    },

    // ---- Mantle (ledge grab + pull-up arc) ----
    mantle: {
        height: 2.2,        // max rise (feet to ledge top) that can be mantled (pre-scale); above this = too tall
        reach: 0.25,        // extra reach past the collider's half-width for the forward ledge probe (pre-scale)
        duration: 0.35,     // total arc time in seconds (lift + vault)
        liftFrac: 0.6,      // fraction of duration spent in the lift phase; remainder is the vault
        speed: 6.0,         // drive speed for both lift and vault phases (pre-scale, units/sec)
    },

    // ---- Misc identity defaults (not feel knobs, but kept here so nothing is scattered) ----
    misc: {
        color: "#cc4444",
        visible: false,        // the collider body is invisible by default (a model/render layer draws the player)
        bodyName: "fpsControllerBody",
        scale: 1,              // 1 = no scaling
        spawn: { x: 0, y: 2, z: 0 }, // fallback spawn when no position is passed
    },
};

/**
 * @class AABB
 * @param [min] {vec3}
 * @param [max] {vec3}
 * @constructor
 */
Goblin.AABB = function( min, max ) {
	/**
	 * @property min
	 * @type {vec3}
	 */
	this.min = min || new Goblin.Vector3();

	/**
	 * @property max
	 * @type {vec3}
	 */
	this.max = max || new Goblin.Vector3();
};

Goblin.AABB.prototype.copy = function( aabb ) {
	this.min.x = aabb.min.x;
	this.min.y = aabb.min.y;
	this.min.z = aabb.min.z;

	this.max.x = aabb.max.x;
	this.max.y = aabb.max.y;
	this.max.z = aabb.max.z;
};

Goblin.AABB.prototype.combineAABBs = function( a, b ) {
	this.min.x = Math.min( a.min.x, b.min.x );
	this.min.y = Math.min( a.min.y, b.min.y );
	this.min.z = Math.min( a.min.z, b.min.z );

	this.max.x = Math.max( a.max.x, b.max.x );
	this.max.y = Math.max( a.max.y, b.max.y );
	this.max.z = Math.max( a.max.z, b.max.z );
};

Goblin.AABB.prototype.transform = (function(){
	var local_half_extents = new Goblin.Vector3(),
		local_center = new Goblin.Vector3(),
		center = new Goblin.Vector3(),
		extents = new Goblin.Vector3(),
		abs = new Goblin.Matrix3();

	return function( local_aabb, matrix ) {
		local_half_extents.subtractVectors( local_aabb.max, local_aabb.min );
		local_half_extents.scale( 0.5  );

		local_center.addVectors( local_aabb.max, local_aabb.min );
		local_center.scale( 0.5  );

		matrix.transformVector3Into( local_center, center );

		// Extract the absolute rotation matrix
		abs.e00 = Math.abs( matrix.e00 );
		abs.e01 = Math.abs( matrix.e01 );
		abs.e02 = Math.abs( matrix.e02 );
		abs.e10 = Math.abs( matrix.e10 );
		abs.e11 = Math.abs( matrix.e11 );
		abs.e12 = Math.abs( matrix.e12 );
		abs.e20 = Math.abs( matrix.e20 );
		abs.e21 = Math.abs( matrix.e21 );
		abs.e22 = Math.abs( matrix.e22 );

		_tmp_vec3_1.x = abs.e00;
		_tmp_vec3_1.y = abs.e10;
		_tmp_vec3_1.z = abs.e20;
		extents.x = local_half_extents.dot( _tmp_vec3_1 );

		_tmp_vec3_1.x = abs.e01;
		_tmp_vec3_1.y = abs.e11;
		_tmp_vec3_1.z = abs.e21;
		extents.y = local_half_extents.dot( _tmp_vec3_1 );

		_tmp_vec3_1.x = abs.e02;
		_tmp_vec3_1.y = abs.e12;
		_tmp_vec3_1.z = abs.e22;
		extents.z = local_half_extents.dot( _tmp_vec3_1 );

		this.min.subtractVectors( center, extents );
		this.max.addVectors( center, extents );
	};
})();

Goblin.AABB.prototype.intersects = function( aabb ) {
    if (
        this.max.x < aabb.min.x ||
        this.max.y < aabb.min.y ||
        this.max.z < aabb.min.z ||
        this.min.x > aabb.max.x ||
        this.min.y > aabb.max.y ||
        this.min.z > aabb.max.z
    )
    {
        return false;
    }

    return true;
};

/**
 * Checks if a ray segment intersects with this AABB
 *
 * @method testRayIntersect
 * @property start {vec3} start point of the segment
 * @property end {vec3{ end point of the segment
 * @return {boolean}
 */
Goblin.AABB.prototype.testRayIntersect = (function(){
	var direction = new Goblin.Vector3(),
		tmin, tmax,
		ood, t1, t2;

	return function AABB_testRayIntersect( start, end ) {
		tmin = 0;

		direction.subtractVectors( end, start );
		tmax = direction.length();
		direction.scale( 1 / tmax ); // normalize direction

		var extent_min, extent_max;

        // Check X axis
        extent_min = this.min.x;
        extent_max = this.max.x;
        if ( Math.abs( direction.x ) < Goblin.EPSILON ) {
            // Ray is parallel to axis
            if ( start.x < extent_min || start.x > extent_max ) {
                return false;
            }
        } else {
            ood = 1 / direction.x;
            t1 = ( extent_min - start.x ) * ood;
            t2 = ( extent_max - start.x ) * ood;
            if ( t1 > t2 ) {
                ood = t1; // ood is a convenient temp variable as it's not used again
                t1 = t2;
                t2 = ood;
            }

            // Find intersection intervals
            tmin = Math.max( tmin, t1 );
            tmax = Math.min( tmax, t2 );

            if ( tmin > tmax ) {
                return false;
            }
        }

        // Check Y axis
        extent_min = this.min.y;
        extent_max = this.max.y;
        if ( Math.abs( direction.y ) < Goblin.EPSILON ) {
            // Ray is parallel to axis
            if ( start.y < extent_min || start.y > extent_max ) {
                return false;
            }
        } else {
            ood = 1 / direction.y;
            t1 = ( extent_min - start.y ) * ood;
            t2 = ( extent_max - start.y ) * ood;
            if ( t1 > t2 ) {
                ood = t1; // ood is a convenient temp variable as it's not used again
                t1 = t2;
                t2 = ood;
            }

            // Find intersection intervals
            tmin = Math.max( tmin, t1 );
            tmax = Math.min( tmax, t2 );

            if ( tmin > tmax ) {
                return false;
            }
        }

        // Check Z axis
        extent_min = this.min.z;
        extent_max = this.max.z;
        if ( Math.abs( direction.z ) < Goblin.EPSILON ) {
            // Ray is parallel to axis
            if ( start.z < extent_min || start.z > extent_max ) {
                return false;
            }
        } else {
            ood = 1 / direction.z;
            t1 = ( extent_min - start.z ) * ood;
            t2 = ( extent_max - start.z ) * ood;
            if ( t1 > t2 ) {
                ood = t1; // ood is a convenient temp variable as it's not used again
                t1 = t2;
                t2 = ood;
            }

            // Find intersection intervals
            tmin = Math.max( tmin, t1 );
            tmax = Math.min( tmax, t2 );

            if ( tmin > tmax ) {
                return false;
            }
        }

		return true;
	};
})();
(function(){
	function getSurfaceArea( aabb ) {
		var x = aabb.max.x - aabb.min.x,
			y = aabb.max.y - aabb.min.y,
			z = aabb.max.z - aabb.min.z;
		return x * ( y + z ) + y * z;
	}

	/**
	 * Tree node for a BVH
	 *
	 * @class BVHNode
	 * @param [object] {Object} leaf object in the BVH tree
	 * @constructor
	 * @private
	 */
	var BVHNode = function( object ) {
		this.aabb = new Goblin.AABB();
		this.area = 0;

		this.parent = null;
		this.left = null;
		this.right = null;

		this.morton = null;

		this.object = object || null;
	};
	BVHNode.prototype = {
		isLeaf: function() {
			return this.object != null;
		},

		computeBounds: function( global_aabb ) {
			if ( this.isLeaf() ) {
				this.aabb.copy( this.object.aabb );
			} else {
				this.aabb.combineAABBs( this.left.aabb, this.right.aabb );
			}

			this.area = getSurfaceArea( this.aabb );
		},

		valueOf: function() {
			return this.area;
		}
	};

	/**
	 * Bottom-up BVH construction based on "Efficient BVH Construction via Approximate Agglomerative Clustering", Yan Gu 2013
	 *
	 * @Class AAC
	 * @static
	 * @private
	 */
	var AAC = (function(){
		function part1By2( n ) {
			n = ( n ^ ( n << 16 ) ) & 0xff0000ff;
			n = ( n ^ ( n << 8 ) ) & 0x0300f00f;
			n = ( n ^ ( n << 4 ) ) & 0x030c30c3;
			n = ( n ^ ( n << 2 ) ) & 0x09249249;
			return n;
		}
		function morton( x, y, z ) {
			return ( part1By2( z ) << 2 ) + ( part1By2( y ) << 1 ) + part1By2( x );
		}

		var _tmp_aabb = new Goblin.AABB();

		var AAC = function( global_aabb, leaves ) {
			var global_width = global_aabb.max.x - global_aabb.min.x,
				global_height = global_aabb.max.y - global_aabb.min.y,
				global_depth = global_aabb.max.z - global_aabb.min.z,
				max_value = 1 << 9,
				scale_x = max_value / global_width,
				scale_y = max_value / global_height,
				scale_z = max_value / global_depth;

			// Compute the morton code for each leaf
			for ( var i = 0; i < leaves.length; i++ ) {
				var leaf = leaves[i],
					// find center of aabb
					x = ( leaf.aabb.max.x - leaf.aabb.min.x ) / 2 + leaf.aabb.min.x,
					y = ( leaf.aabb.max.y - leaf.aabb.min.y ) / 2 + leaf.aabb.min.y,
					z = ( leaf.aabb.max.z - leaf.aabb.min.z ) / 2 + leaf.aabb.min.z;

				leaf.morton = morton(
					( x + global_aabb.min.x ) * scale_x,
					( y + global_aabb.min.y ) * scale_y,
					( z + global_aabb.min.z ) * scale_z
				);
			}

			// Sort leaves based on morton code
			leaves.sort( AAC.mortonSort );
			var tree = AAC.buildTree( leaves, 29 ); // @TODO smaller starting bit, log4N or log2N or log10N ?
			//var tree = AAC.buildTree( leaves, 20 ); // @TODO smaller starting bit, log4N or log2N or log10N ?
			AAC.combineCluster( tree, 1 );
			return tree;
		};
		AAC.mortonSort = function( a, b ) {
			if ( a.morton < b.morton ) {
				return -1;
			} else if ( a.morton > b.morton ) {
				return 1;
			} else {
				return 0;
			}
		};
		AAC.clusterReductionCount = function( cluster_size ) {
			var c = Math.pow( cluster_size, 0.5 ) / 2,
				a = 0.5;
			return Math.max( c * Math.pow( cluster_size, a ), 1 );
		};
		AAC.buildTree = function( nodes, bit ) {
			var cluster = [];

			if ( nodes.length < AAC.max_bucket_size ) {
				cluster.push.apply( cluster, nodes );
				AAC.combineCluster( cluster, AAC.clusterReductionCount( AAC.max_bucket_size ) );
			} else {
				var left = [],
					right = [];

				if ( bit < 1 ) {
					// no more bits, just cut bucket in half
					left = nodes.slice( 0, nodes.length / 2 );
					right = nodes.slice( nodes.length / 2 );
				} else {
					var bit_value = 1 << bit;
					for ( var i = 0; i < nodes.length; i++ ) {
						var node = nodes[i];
						if ( node.morton & bit_value ) {
							right.push( node );
						} else {
							left.push( node );
						}
					}
				}
				cluster.push.apply( cluster, AAC.buildTree( left, bit - 1 ) );
				cluster.push.apply( cluster, AAC.buildTree( right, bit - 1 ) );
				AAC.combineCluster( cluster, AAC.clusterReductionCount( cluster.length ) );
			}

			return cluster;
		};
		AAC.combineCluster = function( cluster, max_clusters ) {
			if ( cluster.length <= 1 ) {
				return cluster;
			}

			// find the best match for each object
			var merge_queue = new Goblin.MinHeap(),
				merged_node;
			for ( var i = 0; i < cluster.length; i++ ) {
				merged_node = new BVHNode();
				merged_node.left = cluster[i];
				merged_node.right = AAC.findBestMatch( cluster, cluster[i] );
				merged_node.computeBounds();
				merge_queue.push( merged_node );
			}

			var best_cluster;
			while( cluster.length > max_clusters ) {
				best_cluster = merge_queue.pop();
				cluster.splice( cluster.indexOf( best_cluster.left ), 1 );
				cluster.splice( cluster.indexOf( best_cluster.right ), 1 );
				cluster.push( best_cluster );

				// update the merge queue
				// @TODO don't clear the whole heap every time, only need to update any nodes which touched best_cluster.left / best_cluster.right
				merge_queue.heap.length = 0;
				for ( i = 0; i < cluster.length; i++ ) {
					merged_node = new BVHNode();
					merged_node.left = cluster[i];
					merged_node.right = AAC.findBestMatch( cluster, cluster[i] );
					merged_node.computeBounds();
					merge_queue.push( merged_node );
				}
			}
		};
		AAC.findBestMatch = function( cluster, object ) {
			var area,
				best_area = Infinity,
				best_idx = 0;
			for ( var i = 0; i < cluster.length; i++ ) {
				if ( cluster[i] === object ) {
					continue;
				}
				_tmp_aabb.combineAABBs( object.aabb, cluster[i].aabb );
				area = getSurfaceArea( _tmp_aabb );

				if ( area < best_area ) {
					best_area = area;
					best_idx = i;
				}
			}

			return cluster[best_idx];
		};
		AAC.max_bucket_size = 20;
		return AAC;
	})();

	/**
	 * Creates a bounding volume hierarchy around a group of objects which have AABBs
	 *
	 * @class BVH
	 * @param bounded_objects {Array} group of objects to be hierarchized
	 * @constructor
	 */
	Goblin.BVH = function( bounded_objects ) {
		// Create a node for each object
		var leaves = [],
			global_aabb = new Goblin.AABB();

		for ( var i = 0; i < bounded_objects.length; i++ ) {
			global_aabb.combineAABBs( global_aabb, bounded_objects[i].aabb );
			var leaf = new BVHNode( bounded_objects[i] );
			leaf.computeBounds();
			leaves.push( leaf );
		}

		this.tree = AAC( global_aabb, leaves )[0];
	};

	Goblin.BVH.AAC = AAC;
})();
/**
 * Spring-based character controller with advanced slope handling, movement projection, and state management.
 *
 * @class CharacterController
 * @constructor
 * @param {Goblin.World} world - Physics world instance
 * @param {Object} [options] - Configuration options
 * @param {Number} [options.width=1] - Character width in meters
 * @param {Number} [options.height=2] - Character height in meters
 * @param {Number} [options.depth=1] - Character depth in meters 
 * @param {Number} [options.mass=1] - Character mass in kg
 * @param {Number} [options.moveSpeed=5] - Base movement speed
 * @param {Number} [options.airAccleration=0.3] - How quickly to acclerate horizontally in air
 * * @param {Number} [options.groundAccleration=0.3] - How quickly to acclerate horizontally on ground
 * @param {Boolean} [options.allowYRotation=true] - Whether character can rotate around Y axis
 */
Goblin.CharacterController = function(world, options) {
    if (!world.broadphase) {
        throw new Error("CharacterController requires a GoblinPhysics world with a broadphase!");
    }

    this.world = world;
    options = options || {};

    // Create capsule shape
    var radius = options.radius || 2;
    var totalHeight = options.height || 6;
    this.shape = new Goblin.CapsuleShape(radius, totalHeight);
    this.body = new Goblin.RigidBody(this.shape, options.mass || 1);

    // Configure rotation
    if (options.allowYRotation === true) {
        this.body.angular_factor = new Goblin.Vector3(0, 1, 0);
    } else {
        this.body.angular_factor = new Goblin.Vector3(0, 0, 0);
    }

    // Movement configuration
    this.moveSpeed = options.moveSpeed || 50;
    this.maxSpeed = options.maxSpeed || 50;
    this.stopFactor = options.stopFactor || 0.9;
    this.stoppingThreshold = options.stoppingThreshold || 0.1;
    this.jumpForce = options.jumpForce || 60;
    this.airAcceleration = options.airAccleration || 0.3;
    this.groundAcceleration = options.groundAccleration || 0.3;
    // Input handling
    this._inputDirection = new Goblin.Vector3();
    this._hasInputThisFrame = false;

    // Initialize working vectors
    this.contactNormal = new Goblin.Vector3(0, 1, 0);
    this.tempVector = new Goblin.Vector3();
    this.moveVector = new Goblin.Vector3();
    this.projectedMove = new Goblin.Vector3();

    // Ground spring config
    this.rideHeight = options.rideHeight || 4;
    this.rayLength = options.rayLength || this.body.shape.half_height * 2;
    this.springStrength = options.springStrength || 10;
    this.springDamping = options.springDamping || 0.3;
    
    // State management
    this.states = {};
    this.currentState = null;
    this._lastStateChange = {
        from: null,
        to: null,
        time: Date.now()
    };

    // Debug tracking
    this._lastGroundHit = null;
    this._lastHeightError = null;
    this._lastSpringForce = null;
    this._lastMoveDelta = new Goblin.Vector3();
    this._lastProjectedMove = new Goblin.Vector3();

    // Initialize states and start in falling
    this._initializeStates();
    this.changeState('falling');
};

/**
 * Initializes all available character states and their behaviors
 *
 * @method _initializeStates
 * @private
 */
Goblin.CharacterController.prototype._initializeStates = function() {
    var self = this;  // Store reference to controller

    // Falling state
    this.states.falling = {
        name: 'falling',
        
        enter: function() {
            // Currently no special falling entry behavior
        }.bind(this),
        
        update: function(deltaTime) {
            this.updateGroundSpring();
            
            if (this._hasInputThisFrame) {
                this.move(this._inputDirection, deltaTime);
            }
            
            if (this._lastGroundHit) {
                return 'grounded';
            }
        }.bind(this),
        
        exit: function() {
            // Currently no special falling exit behavior
        }.bind(this)
    };

    this.states.grounded = {
        name: 'grounded',
        
        enter: function() {
            // No special entry behavior
        }.bind(this),
        
        update: function(deltaTime) {
            this.updateGroundSpring();
            
            // Handle jump input here - you'll need to add this input to your input system
            if (this._jumpRequested) {
                this._jumpRequested = false;  // Clear the request
                return 'jumping';
            }
            
            if (this._hasInputThisFrame) {
                this.move(this._inputDirection, deltaTime);
            } else {
                var currentHorizontalSpeed = Math.sqrt(
                    this.body.linear_velocity.x * this.body.linear_velocity.x +
                    this.body.linear_velocity.z * this.body.linear_velocity.z
                );

                if (currentHorizontalSpeed > this.stoppingThreshold) {
                    this.body.linear_velocity.x *= this.stopFactor;
                    this.body.linear_velocity.z *= this.stopFactor;
                } else {
                    this.body.linear_velocity.x = 0;
                    this.body.linear_velocity.z = 0;
                }
            }
            
            if (!this._lastGroundHit) {
                return 'falling';
            }
        }.bind(this),
        
        exit: function() {
            // No special exit behavior
        }.bind(this)
    };
    
    this.states.jumping = {
        name: 'jumping',
        
        enter: function() {
            // Zero out vertical velocity before jumping
            this.body.linear_velocity.y = 0;
            // Apply initial jump force
            this.body.linear_velocity.y = this.jumpForce;
        }.bind(this),
        
        update: function(deltaTime) {
            // Handle movement while jumping
            if (this._hasInputThisFrame) {
                this.move(this._inputDirection, deltaTime);
            }
            
            // Check for transition to falling
            if (this.body.linear_velocity.y <= 0) {
                return 'falling';
            }
        }.bind(this),
        
        exit: function() {
            // No special cleanup needed
        }.bind(this)
    };

};

/**
 * Requests a jump to be processed on next update
 *
 * @method wishJump
 */
Goblin.CharacterController.prototype.wishJump = function() {
    if (this.currentState && this.currentState.name === 'grounded') {
        this._jumpRequested = true;
    }
};

/**
 * Changes the current state of the character
 *
 * @method changeState
 * @param {String} newStateName - Name of state to transition to
 */
Goblin.CharacterController.prototype.changeState = function(newStateName) {
    var newState = this.states[newStateName];
    
    if (!newState) {
        throw new Error('Invalid state: ' + newStateName);
    }
    
    // Exit current state
    if (this.currentState) {
        this.currentState.exit.call(this);
    }
    
    // Record state change
    this._lastStateChange = {
        from: this.currentState ? this.currentState.name : null,
        to: newState.name,
        time: Date.now()
    };
    
    // Enter new state
    this.currentState = newState;
    this.currentState.enter.call(this);
};

/**
 * Stores input direction for processing during update
 *
 * @method handleInput
 * @param {Goblin.Vector3} direction - Normalized input direction
 */
Goblin.CharacterController.prototype.handleInput = function(direction) {
    if (direction && direction.lengthSquared() > 0) {
        this._inputDirection.copy(direction);
        this._hasInputThisFrame = true;
    } else {
        this._inputDirection.set(0, 0, 0);
        this._hasInputThisFrame = false;
    }
};

/**
 * Updates character physics and state
 * Should be called each frame after handleInput
 *
 * @method update
 * @param {Number} deltaTime - Time step in seconds
 */
Goblin.CharacterController.prototype.update = function(deltaTime) {
    if (this.currentState) {
        var nextState = this.currentState.update.call(this, deltaTime);
        if (nextState && nextState !== this.currentState.name) {
            this.changeState(nextState);
        }
    }
    
    // Clear input after update
    this._hasInputThisFrame = false;
};

/**
 * Updates ground spring forces to maintain ride height
 * Should be called each physics step while in FALLING or GROUNDED states
 *
 * @method updateGroundSpring
 * @private
 */
Goblin.CharacterController.prototype.updateGroundSpring = function() {
    var rayStart = new Goblin.Vector3(
        this.body.position.x,
        this.body.position.y - this.body.shape.half_height - 0.00001,
        this.body.position.z
    );

    var rayEnd = new Goblin.Vector3(
        rayStart.x, 
        rayStart.y - this.rayLength,
        rayStart.z
    );

    var hits = this.world.broadphase.rayIntersect(rayStart, rayEnd);

    if (hits.length > 0) {
        var hit = hits[0];
        this._lastGroundHit = hit;
        this.contactNormal.copy(hit.normal);

        var heightError = this.rideHeight - hit.t;
        var verticalVelocity = this.body.linear_velocity.y;
        
        var springForce = (heightError * this.springStrength) - 
                         (verticalVelocity * this.springDamping);

        this._lastHeightError = heightError;
        this._lastSpringForce = springForce;

        this.body.applyForce(new Goblin.Vector3(0, springForce, 0));

        for (var i = 0; i < hits.length; i++) {
            Goblin.ObjectPool.freeObject("RayIntersection", hits[i]);
        }
    } else {
        this._lastGroundHit = null;
        this._lastHeightError = null;
        this._lastSpringForce = null;
        this.contactNormal.set(0, 1, 0);
    }
};

/**
 * Projects and applies movement forces to the character, handling slopes
 *
 * @method move
 * @param {Goblin.Vector3} direction - Normalized input direction
 * @param {Number} deltaTime - Time step in seconds
 * @private
 */
Goblin.CharacterController.prototype.move = function(direction, deltaTime) {
    // Convert input to desired velocity
    // Convert input to desired velocity
    this.moveVector.copy(direction);
    this.moveVector.scale(this.moveSpeed);
    this._lastMoveDelta.copy(this.moveVector);

    if (this.currentState.name === 'falling' || this.currentState.name === 'jumping') {
        // In air - only affect horizontal velocity
        var currentY = this.body.linear_velocity.y;
        
        // Interpolate to target velocity
        this.body.linear_velocity.x += (this.moveVector.x - this.body.linear_velocity.x) * this.airAcceleration;
        this.body.linear_velocity.z += (this.moveVector.z - this.body.linear_velocity.z) * this.airAcceleration;
        this.body.linear_velocity.y = currentY;
    } else {
        // On ground - project along surface
        var dot = this.moveVector.dot(this.contactNormal);
        this.projectedMove.copy(this.moveVector);
        this.tempVector.copy(this.contactNormal);
        this.tempVector.scale(dot);
        this.projectedMove.subtract(this.tempVector);
        this._lastProjectedMove.copy(this.projectedMove);
        
        // Interpolate to target velocity
        this.body.linear_velocity.x += (this.projectedMove.x - this.body.linear_velocity.x) * this.groundAcceleration;
        this.body.linear_velocity.z += (this.projectedMove.z - this.body.linear_velocity.z) * this.groundAcceleration;
    }
    
    // Speed limit check as before
    var currentSpeed = Math.sqrt(
        this.body.linear_velocity.x * this.body.linear_velocity.x + 
        this.body.linear_velocity.z * this.body.linear_velocity.z
    );
    if (currentSpeed > this.maxSpeed) {
        var scale = this.maxSpeed / currentSpeed;
        this.body.linear_velocity.x *= scale;
        this.body.linear_velocity.z *= scale;
    }
};

/**
 * Gets comprehensive debug information about current movement state
 *
 * @method getDebugInfo
 * @return {Object} Debug state information including forces and contacts
 */
Goblin.CharacterController.prototype.getDebugInfo = function() {
    var physics = {
        position: {
            x: this.body.position.x,
            y: this.body.position.y,
            z: this.body.position.z
        },
        velocity: {
            x: this.body.linear_velocity.x,
            y: this.body.linear_velocity.y,
            z: this.body.linear_velocity.z
        }
    };

    var movement = {
        input_direction: this._hasInputThisFrame ? {
            x: this._inputDirection.x,
            y: this._inputDirection.y,
            z: this._inputDirection.z
        } : null,
        raw_move: {
            x: this._lastMoveDelta.x,
            y: this._lastMoveDelta.y,
            z: this._lastMoveDelta.z
        },
        projected_move: {
            x: this._lastProjectedMove.x,
            y: this._lastProjectedMove.y,
            z: this._lastProjectedMove.z
        },
        applied_force: this._lastAppliedForce ? {
            x: this._lastAppliedForce.x,
            y: this._lastAppliedForce.y,
            z: this._lastAppliedForce.z
        } : null
    };

    var spring = {
        hit_distance: this._lastGroundHit ? this._lastGroundHit.t : null,
        height_error: this._lastHeightError,
        spring_force: this._lastSpringForce,
        target_height: this.rideHeight,
        spring_strength: this.springStrength,
        spring_damping: this.springDamping,
        ray_start: {
            x: this.body.position.x,
            y: this.body.position.y - this.body.shape.half_height,
            z: this.body.position.z
        },
        ray_end: {
            x: this.body.position.x,
            y: (this.body.position.y - this.body.shape.half_height) - this.rayLength,
            z: this.body.position.z
        }
    };
    
    var contact = {
        normal: {
            x: this.contactNormal.x,
            y: this.contactNormal.y,
            z: this.contactNormal.z
        },
        hit: this._lastGroundHit ? {
            point: this._lastGroundHit.point,
            normal: this._lastGroundHit.normal,
            distance: this._lastGroundHit.t
        } : null
    };

    var state = {
        current: this.currentState ? this.currentState.name : null,
        lastTransition: this._lastStateChange
    };

    return {
        physics: physics,
        movement: movement,
        spring: spring,
        state: state,
        contact: contact
    };
};

Goblin.EventEmitter.apply(Goblin.CharacterController);
/**
 * Structure which holds information about a contact between two objects
 *
 * @Class ContactDetails
 * @constructor
 */
Goblin.ContactDetails = function() {
	this.uid = Goblin.Utility.getUid();

	/**
	 * first body in the  contact
	 *
	 * @property object_a
	 * @type {Goblin.RigidBody}
	 */
	this.object_a = null;

	/**
	 * second body in the  contact
	 *
	 * @property object_b
	 * @type {Goblin.RigidBody}
	 */
	this.object_b = null;

	/**
	 * point of contact in world coordinates
	 *
	 * @property contact_point
	 * @type {vec3}
	 */
	this.contact_point = new Goblin.Vector3();

	/**
	 * contact point in local frame of `object_a`
	 *
	 * @property contact_point_in_a
	 * @type {vec3}
	 */
	this.contact_point_in_a = new Goblin.Vector3();

	/**
	 * contact point in local frame of `object_b`
	 *
	 * @property contact_point_in_b
	 * @type {vec3}
	 */
	this.contact_point_in_b = new Goblin.Vector3();

	/**
	 * normal vector, in world coordinates, of the contact
	 *
	 * @property contact_normal
	 * @type {vec3}
	 */
	this.contact_normal = new Goblin.Vector3();

	/**
	 * how far the objects are penetrated at the point of contact
	 *
	 * @property penetration_depth
	 * @type {Number}
	 */
	this.penetration_depth = 0;

	/**
	 * amount of restitution between the objects in contact
	 *
	 * @property restitution
	 * @type {Number}
	 */
	this.restitution = 0;

	/**
	 * amount of friction between the objects in contact
	 *
	 * @property friction
	 * @type {*}
	 */
	this.friction = 0;

	this.listeners = {};
};
Goblin.EventEmitter.apply( Goblin.ContactDetails );

Goblin.ContactDetails.prototype.destroy = function() {
	this.emit( 'destroy' );
	Goblin.ObjectPool.freeObject( 'ContactDetails', this );
};
/**
 * Structure which holds information about the contact points between two objects
 *
 * @Class ContactManifold
 * @constructor
 */
Goblin.ContactManifold = function() {
	/**
	 * first body in the contact
	 *
	 * @property object_a
	 * @type {RigidBody}
	 */
	this.object_a = null;

	/**
	 * second body in the contact
	 *
	 * @property object_b
	 * @type {RigidBody}
	 */
	this.object_b = null;

	/**
	 * array of the active contact points for this manifold
	 *
	 * @property points
	 * @type {Array}
	 */
	this.points = [];

	/**
	 * reference to the next `ContactManifold` in the list
	 *
	 * @property next_manifold
	 * @type {ContactManifold}
	 */
	this.next_manifold = null;
};

/**
 * Determines which cached contact should be replaced with the new contact
 *
 * @method findWeakestContact
 * @param {ContactDetails} new_contact
 */
Goblin.ContactManifold.prototype.findWeakestContact = function( new_contact ) {
	// Find which of the current contacts has the deepest penetration
	var max_penetration_index = -1,
		max_penetration = new_contact.penetration_depth,
		i,
		contact;
	for ( i = 0; i < 4; i++ ) {
		contact = this.points[i];
		if ( contact.penetration_depth > max_penetration ) {
			max_penetration = contact.penetration_depth;
			max_penetration_index = i;
		}
	}

	// Estimate contact areas
	var res0 = 0,
		res1 = 0,
		res2 = 0,
		res3 = 0;
	if ( max_penetration_index !== 0 ) {
		_tmp_vec3_1.subtractVectors( new_contact.contact_point_in_a, this.points[1].contact_point_in_a );
		_tmp_vec3_2.subtractVectors( this.points[3].contact_point_in_a, this.points[2].contact_point_in_a );
		_tmp_vec3_1.cross( _tmp_vec3_2 );
		res0 = _tmp_vec3_1.lengthSquared();
	}
	if ( max_penetration_index !== 1 ) {
		_tmp_vec3_1.subtractVectors( new_contact.contact_point_in_a, this.points[0].contact_point_in_a );
		_tmp_vec3_2.subtractVectors( this.points[3].contact_point_in_a, this.points[2].contact_point_in_a );
		_tmp_vec3_1.cross( _tmp_vec3_2 );
		res1 = _tmp_vec3_1.lengthSquared();
	}
	if ( max_penetration_index !== 2 ) {
		_tmp_vec3_1.subtractVectors( new_contact.contact_point_in_a, this.points[0].contact_point_in_a );
		_tmp_vec3_2.subtractVectors( this.points[3].contact_point_in_a, this.points[1].contact_point_in_a );
		_tmp_vec3_1.cross( _tmp_vec3_2 );
		res2 = _tmp_vec3_1.lengthSquared();
	}
	if ( max_penetration_index !== 3 ) {
		_tmp_vec3_1.subtractVectors( new_contact.contact_point_in_a, this.points[0].contact_point_in_a );
		_tmp_vec3_2.subtractVectors( this.points[2].contact_point_in_a, this.points[1].contact_point_in_a );
		_tmp_vec3_1.cross( _tmp_vec3_2 );
		res3 = _tmp_vec3_1.lengthSquared();
	}

	var max_index = 0,
		max_val = res0;
	if ( res1 > max_val ) {
		max_index = 1;
		max_val = res1;
	}
	if ( res2 > max_val ) {
		max_index = 2;
		max_val = res2;
	}
	if ( res3 > max_val ) {
		max_index = 3;
	}

	return max_index;
};

/**
 * Adds a contact point to the manifold
 *
 * @method addContact
 * @param contact {ContactDetails} the contact to add
 */
Goblin.ContactManifold.prototype.addContact = function( contact ) {
	//@TODO add feature-ids to detect duplicate contacts
	var i;
	var is_sphere_contact = contact.object_a.shape instanceof Goblin.SphereShape ||
		contact.object_b.shape instanceof Goblin.SphereShape;
	for ( i = 0; i < this.points.length; i++ ) {
		if ( this.points[i].contact_point.distanceTo( contact.contact_point ) <= 0.02 ) {
			if ( is_sphere_contact ) {
				// A sphere touches at a single analytic point recomputed every frame; the fresh
				// contact carries the true penetration, so it replaces the cached duplicate rather
				// than being dropped (cached points re-derive penetration from anchors, which a
				// rolling sphere invalidates).
				this.points[i].destroy();
				this.points.splice( i, 1 );
				break;
			}
			contact.destroy();
			return;
		}
	}

	var use_contact = false;
	if ( contact != null ) {
		use_contact = contact.object_a.emit( 'speculativeContact', contact.object_b, contact );
		if ( use_contact !== false ) {
			use_contact = contact.object_b.emit( 'speculativeContact', contact.object_a, contact );
		}

		if ( use_contact === false ) {
			contact.destroy();
			return;
		} else {
			contact.object_a.emit( 'contact', contact.object_b, contact );
			contact.object_b.emit( 'contact', contact.object_a, contact );
		}
	}

	// Add contact if we don't have enough points yet
	if ( this.points.length < 4 ) {
		this.points.push( contact );
	} else {
		var replace_index = this.findWeakestContact( contact );
		this.points[replace_index].destroy();
		this.points[replace_index] = contact;
	}
};

/**
 * Updates all of this manifold's ContactDetails with the correct contact location & penetration depth
 *
 * @method update
 */
Goblin.ContactManifold.prototype.update = function() {
	// Update positions / depths of contacts
	var i,
		j,
		point,
		object_a_world_coords = new Goblin.Vector3(),
		object_b_world_coords = new Goblin.Vector3(),
		vector_difference = new Goblin.Vector3(),
		starting_points_length = this.points.length;

	for ( i = 0; i < this.points.length; i++ ) {
		point = this.points[i];

		// Convert the local contact points into world coordinates
		point.object_a.transform.transformVector3Into( point.contact_point_in_a, object_a_world_coords );
		point.object_b.transform.transformVector3Into( point.contact_point_in_b, object_b_world_coords );

		// Find new world contact point
		point.contact_point.addVectors( object_a_world_coords, object_b_world_coords );
		point.contact_point.scale( 0.5  );

		// Find the new penetration depth
		vector_difference.subtractVectors( object_a_world_coords, object_b_world_coords );
		point.penetration_depth = vector_difference.dot( point.contact_normal );

		// If distance from contact is too great remove this contact point
		if ( point.penetration_depth < -0.02 ) {
			// Points are too far away along the contact normal
			point.destroy();
			for ( j = i; j < this.points.length; j++ ) {
				this.points[j] = this.points[j + 1];
			}
			this.points.length = this.points.length - 1;
			this.object_a.emit( 'endContact', this.object_b );
			this.object_b.emit( 'endContact', this.object_a );
		} else {
			// Check if points are too far away orthogonally
			_tmp_vec3_1.scaleVector( point.contact_normal, point.penetration_depth );
			_tmp_vec3_1.subtractVectors( object_a_world_coords, _tmp_vec3_1 );

			_tmp_vec3_1.subtractVectors( object_b_world_coords, _tmp_vec3_1 );
			var distance = _tmp_vec3_1.lengthSquared();
			if ( distance > 0.2 * 0.2 ) {
				// Points are indeed too far away
				point.destroy();
				for ( j = i; j < this.points.length; j++ ) {
					this.points[j] = this.points[j + 1];
				}
				this.points.length = this.points.length - 1;
				this.object_a.emit( 'endContact', this.object_b );
				this.object_b.emit( 'endContact', this.object_a );
			}
		}
	}

	if (starting_points_length > 0 && this.points.length === 0) {
		// this update removed all contact points
		this.object_a.emit( 'endAllContact', this.object_b );
		this.object_b.emit( 'endAllContact', this.object_a );
	}
};
/**
 * List/Manager of ContactManifolds
 *
 * @Class ContactManifoldList
 * @constructor
 */
Goblin.ContactManifoldList = function() {
	/**
	 * The first ContactManifold in the list
	 *
	 * @property first
	 * @type {ContactManifold}
	 */
	this.first = null;
};

/**
 * Inserts a ContactManifold into the list
 *
 * @method insert
 * @param {ContactManifold} contact_manifold contact manifold to insert into the list
 */
Goblin.ContactManifoldList.prototype.insert = function( contact_manifold ) {
	// The list is completely unordered, throw the manifold at the beginning
	contact_manifold.next_manifold = this.first;
	this.first = contact_manifold;
};

/**
 * Returns (and possibly creates) a ContactManifold for the two rigid bodies
 *
 * @method getManifoldForObjects
 * @param object_a {RigidBody} first body
 * @param object_b {RigidBody} second body
 * @return {ContactManifold}
 */
Goblin.ContactManifoldList.prototype.getManifoldForObjects = function( object_a, object_b ) {
	var manifold = null;
	if ( this.first !== null ) {
		var current = this.first;
		while ( current !== null ) {
			if (
				current.object_a === object_a && current.object_b === object_b ||
				current.object_a === object_b && current.object_b === object_a
			) {
				manifold = current;
				break;
			}
			current = current.next_manifold;
		}
	}

	if ( manifold === null ) {
		// A manifold for these two objects does not exist, create one
		manifold = Goblin.ObjectPool.getObject( 'ContactManifold' );
		manifold.object_a = object_a;
		manifold.object_b = object_b;
		this.insert( manifold );
	}

	return manifold;
};
Goblin.GhostBody = function( shape ) {
    Goblin.RigidBody.call( this, shape, Infinity );

    this.contacts = [];
    this.tick_contacts = [];

    this.addListener( 'speculativeContact', Goblin.GhostBody.prototype.onSpeculativeContact );
};

Goblin.GhostBody.prototype = Object.create( Goblin.RigidBody.prototype );

Goblin.GhostBody.prototype.onSpeculativeContact = function( object_b, contact ) {
    this.tick_contacts.push( object_b );
    if ( this.contacts.indexOf( object_b ) === -1 ) {
        this.contacts.push( object_b );
        this.emit( 'contactStart', object_b, contact );
        object_b.emit( 'contactStart', this, contact );
    } else {
        this.emit( 'contactContinue', object_b, contact );
        object_b.emit( 'contactContinue', this, contact );
    }

    return false;
};

Goblin.GhostBody.prototype.checkForEndedContacts = function() {
    for ( var i = 0; i < this.contacts.length; i++ ) {
        if ( this.tick_contacts.indexOf( this.contacts[i] ) === -1 ) {
            this.emit( 'contactEnd', this.contacts[i] );
            this.contacts.splice( i, 1 );
            i -= 1;
        }
    }
    this.tick_contacts.length = 0;
};
/**
 * Adapted from BulletPhysics's btIterativeSolver
 *
 * @class IterativeSolver
 * @constructor
 */
Goblin.IterativeSolver = function() {
	this.existing_contact_ids = {};

	/**
	 * Holds contact constraints generated from contact manifolds
	 *
	 * @property contact_constraints
	 * @type {Array}
	 */
	this.contact_constraints = [];

	/**
	 * Holds friction constraints generated from contact manifolds
	 *
	 * @property friction_constraints
	 * @type {Array}
	 */
	this.friction_constraints = [];

	/**
	 * array of all constraints being solved
	 *
	 * @property all_constraints
	 * @type {Array}
	 */
	this.all_constraints = [];

	/**
	 * array of constraints on the system, excluding contact & friction
	 *
	 * @property constraints
	 * @type {Array}
	 */
	this.constraints = [];

	/**
	 * maximum solver iterations per time step
	 *
	 * @property max_iterations
	 * @type {number}
	 */
	this.max_iterations = 10;

	/**
	 * maximum solver iterations per time step to resolve contacts
	 *
	 * @property penetrations_max_iterations
	 * @type {number}
	 */
	this.penetrations_max_iterations = 5;

	/**
	 * used to relax the contact position solver, 0 is no position correction and 1 is full correction
	 *
	 * @property relaxation
	 * @type {number}
	 * @default 0.9
	 */
	this.relaxation = 0.9;

	/**
	 * weighting used in the Gauss-Seidel successive over-relaxation solver
	 *
	 * @property sor_weight
	 * @type {number}
	 */
	this.sor_weight = 0.85;

	/**
	 * how much of the solution to start with on the next solver pass
	 *
	 * @property warmstarting_factor
	 * @type {number}
	 */
	this.warmstarting_factor = 0.95;


	var solver = this;
	/**
	 * used to remove contact constraints from the system when their contacts are destroyed
	 *
	 * @method onContactDeactivate
	 * @private
	 */
	this.onContactDeactivate = function() {
		this.removeListener( 'deactivate', solver.onContactDeactivate );

		var idx = solver.contact_constraints.indexOf( this );
		solver.contact_constraints.splice( idx, 1 );

		delete solver.existing_contact_ids[ this.contact.uid ];
	};
	/**
	 * used to remove friction constraints from the system when their contacts are destroyed
	 *
	 * @method onFrictionDeactivate
	 * @private
	 */
	this.onFrictionDeactivate = function() {
		this.removeListener( 'deactivate', solver.onFrictionDeactivate );

		var idx = solver.friction_constraints.indexOf( this );
		solver.friction_constraints.splice( idx, 1 );
	};
};

/**
 * adds a constraint to the solver
 *
 * @method addConstraint
 * @param constraint {Goblin.Constraint} constraint to be added
 */
Goblin.IterativeSolver.prototype.addConstraint = function( constraint ) {
	if ( this.constraints.indexOf( constraint ) === -1 ) {
		this.constraints.push( constraint );
	}
};

/**
 * removes a constraint from the solver
 *
 * @method removeConstraint
 * @param constraint {Goblin.Constraint} constraint to be removed
 */
Goblin.IterativeSolver.prototype.removeConstraint = function( constraint ) {
	var idx = this.constraints.indexOf( constraint );
	if ( idx !== -1 ) {
		this.constraints.splice( idx, 1 );
	}
};

/**
 * Converts contact manifolds into contact constraints
 *
 * @method processContactManifolds
 * @param contact_manifolds {Array} contact manifolds to process
 */
Goblin.IterativeSolver.prototype.processContactManifolds = function( contact_manifolds ) {
	var i, j,
		manifold,
		contacts_length,
		contact,
		constraint;

	manifold = contact_manifolds.first;

	while( manifold ) {
		contacts_length = manifold.points.length;

		for ( i = 0; i < contacts_length; i++ ) {
			contact = manifold.points[i];

			var existing_constraint = this.existing_contact_ids.hasOwnProperty( contact.uid );

			if ( !existing_constraint ) {
				this.existing_contact_ids[contact.uid] = true;

				// Build contact constraint
				constraint = Goblin.ObjectPool.getObject( 'ContactConstraint' );
				constraint.buildFromContact( contact );
				this.contact_constraints.push( constraint );
				constraint.addListener( 'deactivate', this.onContactDeactivate );

				// Build friction constraint
				constraint = Goblin.ObjectPool.getObject( 'FrictionConstraint' );
				constraint.buildFromContact( contact );
				this.friction_constraints.push( constraint );
				constraint.addListener( 'deactivate', this.onFrictionDeactivate );
			}
		}

		manifold = manifold.next_manifold;
	}

	// @TODO just for now
	this.all_constraints.length = 0;
	Array.prototype.push.apply( this.all_constraints, this.friction_constraints );
	Array.prototype.push.apply( this.all_constraints, this.constraints );
	Array.prototype.push.apply( this.all_constraints, this.contact_constraints );
};

Goblin.IterativeSolver.prototype.prepareConstraints = function( time_delta ) {
	var num_constraints = this.all_constraints.length,
		constraint,
		row,
		i, j;

	for ( i = 0; i < num_constraints; i++ ) {
		constraint = this.all_constraints[i];
		if ( constraint.active === false ) {
			continue;
		}

		constraint.update( time_delta );
		for ( j = 0; j < constraint.rows.length; j++ ) {
			row = constraint.rows[j];
			row.multiplier = 0;
			row.computeB( constraint ); // Objects' inverted mass & inertia tensors & Jacobian
			row.computeD();
			row.computeEta( constraint, time_delta ); // Amount of work needed for the constraint
		}
	}
};

Goblin.IterativeSolver.prototype.resolveContacts = function() {
	var iteration,
		constraint,
		jdot, row, i,
		delta_lambda,
		max_impulse = 0,
		invmass;

	// Solve penetrations
	for ( iteration = 0; iteration < this.penetrations_max_iterations; iteration++ ) {
		max_impulse = 0;
		for ( i = 0; i < this.contact_constraints.length; i++ ) {
			constraint = this.contact_constraints[i];
			row = constraint.rows[0];

			jdot = 0;
			if ( constraint.object_a != null && constraint.object_a._mass !== Infinity ) {
				jdot += (
					row.jacobian[0] * constraint.object_a.linear_factor.x * constraint.object_a.push_velocity.x +
					row.jacobian[1] * constraint.object_a.linear_factor.y * constraint.object_a.push_velocity.y +
					row.jacobian[2] * constraint.object_a.linear_factor.z * constraint.object_a.push_velocity.z +
					row.jacobian[3] * constraint.object_a.angular_factor.x * constraint.object_a.turn_velocity.x +
					row.jacobian[4] * constraint.object_a.angular_factor.y * constraint.object_a.turn_velocity.y +
					row.jacobian[5] * constraint.object_a.angular_factor.z * constraint.object_a.turn_velocity.z
				);
			}
			if ( constraint.object_b != null && constraint.object_b._mass !== Infinity ) {
				jdot += (
					row.jacobian[6] * constraint.object_b.linear_factor.x * constraint.object_b.push_velocity.x +
					row.jacobian[7] * constraint.object_b.linear_factor.y * constraint.object_b.push_velocity.y +
					row.jacobian[8] * constraint.object_b.linear_factor.z * constraint.object_b.push_velocity.z +
					row.jacobian[9] * constraint.object_b.angular_factor.x * constraint.object_b.turn_velocity.x +
					row.jacobian[10] * constraint.object_b.angular_factor.y * constraint.object_b.turn_velocity.y +
					row.jacobian[11] * constraint.object_b.angular_factor.z * constraint.object_b.turn_velocity.z
				);
			}

			delta_lambda = ( constraint.contact.penetration_depth - jdot ) / row.D || 0;
			var cache = row.multiplier;
			row.multiplier = Math.max(
				row.lower_limit,
				Math.min(
					cache + delta_lambda,
					row.upper_limit
				)
			);
			delta_lambda = row.multiplier - cache;
			max_impulse = Math.max( max_impulse, delta_lambda );

			if ( constraint.object_a && constraint.object_a._mass !== Infinity ) {
				constraint.object_a.push_velocity.x += delta_lambda * row.B[0];
				constraint.object_a.push_velocity.y += delta_lambda * row.B[1];
				constraint.object_a.push_velocity.z += delta_lambda * row.B[2];

				constraint.object_a.turn_velocity.x += delta_lambda * row.B[3];
				constraint.object_a.turn_velocity.y += delta_lambda * row.B[4];
				constraint.object_a.turn_velocity.z += delta_lambda * row.B[5];
			}
			if ( constraint.object_b && constraint.object_b._mass !== Infinity ) {
				constraint.object_b.push_velocity.x += delta_lambda * row.B[6];
				constraint.object_b.push_velocity.y += delta_lambda * row.B[7];
				constraint.object_b.push_velocity.z += delta_lambda * row.B[8];

				constraint.object_b.turn_velocity.x += delta_lambda * row.B[9];
				constraint.object_b.turn_velocity.y += delta_lambda * row.B[10];
				constraint.object_b.turn_velocity.z += delta_lambda * row.B[11];
			}
		}

		if ( max_impulse >= -Goblin.EPSILON && max_impulse <= Goblin.EPSILON ) {
			break;
		}
	}

	// Apply position/rotation solver
	for ( i = 0; i < this.contact_constraints.length; i++ ) {
		constraint = this.contact_constraints[i];
		row = constraint.rows[0];

		if ( constraint.object_a != null && constraint.object_a._mass !== Infinity ) {
			invmass = constraint.object_a._mass_inverted;
			constraint.object_a.position.x += invmass * row.jacobian[0] * constraint.object_a.linear_factor.x * row.multiplier * this.relaxation;
			constraint.object_a.position.y += invmass * row.jacobian[1] * constraint.object_a.linear_factor.y * row.multiplier * this.relaxation;
			constraint.object_a.position.z += invmass * row.jacobian[2] * constraint.object_a.linear_factor.z * row.multiplier * this.relaxation;

			_tmp_vec3_1.x = row.jacobian[3] * constraint.object_a.angular_factor.x * row.multiplier * this.relaxation;
			_tmp_vec3_1.y = row.jacobian[4] * constraint.object_a.angular_factor.y * row.multiplier * this.relaxation;
			_tmp_vec3_1.z = row.jacobian[5] * constraint.object_a.angular_factor.z * row.multiplier * this.relaxation;
			constraint.object_a.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );

			_tmp_quat4_1.x = _tmp_vec3_1.x;
			_tmp_quat4_1.y = _tmp_vec3_1.y;
			_tmp_quat4_1.z = _tmp_vec3_1.z;
			_tmp_quat4_1.w = 0;
			_tmp_quat4_1.multiply( constraint.object_a.rotation );

			constraint.object_a.rotation.x += 0.5 * _tmp_quat4_1.x;
			constraint.object_a.rotation.y += 0.5 * _tmp_quat4_1.y;
			constraint.object_a.rotation.z += 0.5 * _tmp_quat4_1.z;
			constraint.object_a.rotation.w += 0.5 * _tmp_quat4_1.w;
			constraint.object_a.rotation.normalize();
		}

		if ( constraint.object_b != null && constraint.object_b._mass !== Infinity ) {
			invmass = constraint.object_b._mass_inverted;
			constraint.object_b.position.x += invmass * row.jacobian[6] * constraint.object_b.linear_factor.x * row.multiplier * this.relaxation;
			constraint.object_b.position.y += invmass * row.jacobian[7] * constraint.object_b.linear_factor.y * row.multiplier * this.relaxation;
			constraint.object_b.position.z += invmass * row.jacobian[8] * constraint.object_b.linear_factor.z * row.multiplier * this.relaxation;

			_tmp_vec3_1.x = row.jacobian[9] * constraint.object_b.angular_factor.x * row.multiplier * this.relaxation;
			_tmp_vec3_1.y = row.jacobian[10] * constraint.object_b.angular_factor.y * row.multiplier * this.relaxation;
			_tmp_vec3_1.z = row.jacobian[11] * constraint.object_b.angular_factor.z * row.multiplier * this.relaxation;
			constraint.object_b.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );

			_tmp_quat4_1.x = _tmp_vec3_1.x;
			_tmp_quat4_1.y = _tmp_vec3_1.y;
			_tmp_quat4_1.z = _tmp_vec3_1.z;
			_tmp_quat4_1.w = 0;
			_tmp_quat4_1.multiply( constraint.object_b.rotation );

			constraint.object_b.rotation.x += 0.5 * _tmp_quat4_1.x;
			constraint.object_b.rotation.y += 0.5 * _tmp_quat4_1.y;
			constraint.object_b.rotation.z += 0.5 * _tmp_quat4_1.z;
			constraint.object_b.rotation.w += 0.5 * _tmp_quat4_1.w;
			constraint.object_b.rotation.normalize();
		}

		row.multiplier = 0;
	}
};

Goblin.IterativeSolver.prototype.solveConstraints = function() {
	var num_constraints = this.all_constraints.length,
		constraint,
		num_rows,
		row,
		warmth,
		i, j;

	var iteration,
		delta_lambda,
		max_impulse = 0, // Track the largest impulse per iteration; if the impulse is <= EPSILON then early out
		jdot;

	// Warm starting
	for ( i = 0; i < num_constraints; i++ ) {
		constraint = this.all_constraints[i];
		if ( constraint.active === false ) {
			continue;
		}

		for ( j = 0; j < constraint.rows.length; j++ ) {
			row = constraint.rows[j];
			warmth = row.multiplier_cached * this.warmstarting_factor;
			row.multiplier = warmth;

			if ( constraint.object_a && constraint.object_a._mass !== Infinity ) {
				constraint.object_a.solver_impulse[0] += warmth * row.B[0];
				constraint.object_a.solver_impulse[1] += warmth * row.B[1];
				constraint.object_a.solver_impulse[2] += warmth * row.B[2];

				constraint.object_a.solver_impulse[3] += warmth * row.B[3];
				constraint.object_a.solver_impulse[4] += warmth * row.B[4];
				constraint.object_a.solver_impulse[5] += warmth * row.B[5];
			}
			if ( constraint.object_b && constraint.object_b._mass !== Infinity ) {
				constraint.object_b.solver_impulse[0] += warmth * row.B[6];
				constraint.object_b.solver_impulse[1] += warmth * row.B[7];
				constraint.object_b.solver_impulse[2] += warmth * row.B[8];

				constraint.object_b.solver_impulse[3] += warmth * row.B[9];
				constraint.object_b.solver_impulse[4] += warmth * row.B[10];
				constraint.object_b.solver_impulse[5] += warmth * row.B[11];
			}
		}
	}

	for ( iteration = 0; iteration < this.max_iterations; iteration++ ) {
		max_impulse = 0;
		for ( i = 0; i < num_constraints; i++ ) {
			constraint = this.all_constraints[i];
			if ( constraint.active === false ) {
				continue;
			}
			num_rows = constraint.rows.length;

			for ( j = 0; j < num_rows; j++ ) {
				row = constraint.rows[j];

				jdot = 0;
				if ( constraint.object_a != null && constraint.object_a._mass !== Infinity ) {
					jdot += (
						row.jacobian[0] * constraint.object_a.linear_factor.x * constraint.object_a.solver_impulse[0] +
						row.jacobian[1] * constraint.object_a.linear_factor.y * constraint.object_a.solver_impulse[1] +
						row.jacobian[2] * constraint.object_a.linear_factor.z * constraint.object_a.solver_impulse[2] +
						row.jacobian[3] * constraint.object_a.angular_factor.x * constraint.object_a.solver_impulse[3] +
						row.jacobian[4] * constraint.object_a.angular_factor.y * constraint.object_a.solver_impulse[4] +
						row.jacobian[5] * constraint.object_a.angular_factor.z * constraint.object_a.solver_impulse[5]
						);
				}
				if ( constraint.object_b != null && constraint.object_b._mass !== Infinity ) {
					jdot += (
						row.jacobian[6] * constraint.object_b.linear_factor.x * constraint.object_b.solver_impulse[0] +
						row.jacobian[7] * constraint.object_b.linear_factor.y * constraint.object_b.solver_impulse[1] +
						row.jacobian[8] * constraint.object_b.linear_factor.z * constraint.object_b.solver_impulse[2] +
						row.jacobian[9] * constraint.object_b.angular_factor.x * constraint.object_b.solver_impulse[3] +
						row.jacobian[10] * constraint.object_b.angular_factor.y * constraint.object_b.solver_impulse[4] +
						row.jacobian[11] * constraint.object_b.angular_factor.z * constraint.object_b.solver_impulse[5]
					);
				}

				delta_lambda = ( ( row.eta - jdot ) / row.D || 0) * constraint.factor;
				var cache = row.multiplier,
					multiplier_target = cache + delta_lambda;


				// successive over-relaxation
				multiplier_target = this.sor_weight * multiplier_target + ( 1 - this.sor_weight ) * cache;

				// Clamp to row constraints
				row.multiplier = Math.max(
					row.lower_limit,
					Math.min(
						multiplier_target,
						row.upper_limit
					)
				);

				// Find final `delta_lambda`
				delta_lambda = row.multiplier - cache;

				var total_mass = ( constraint.object_a && constraint.object_a._mass !== Infinity ? constraint.object_a._mass : 0 ) +
					( constraint.object_b && constraint.object_b._mass !== Infinity ? constraint.object_b._mass : 0 );
				max_impulse = Math.max( max_impulse, Math.abs( delta_lambda ) / total_mass );

				if ( constraint.object_a && constraint.object_a._mass !== Infinity ) {
					constraint.object_a.solver_impulse[0] += delta_lambda * row.B[0];
					constraint.object_a.solver_impulse[1] += delta_lambda * row.B[1];
					constraint.object_a.solver_impulse[2] += delta_lambda * row.B[2];

					constraint.object_a.solver_impulse[3] += delta_lambda * row.B[3];
					constraint.object_a.solver_impulse[4] += delta_lambda * row.B[4];
					constraint.object_a.solver_impulse[5] += delta_lambda * row.B[5];
				}
				if ( constraint.object_b && constraint.object_b._mass !== Infinity ) {
					constraint.object_b.solver_impulse[0] += delta_lambda * row.B[6];
					constraint.object_b.solver_impulse[1] += delta_lambda * row.B[7];
					constraint.object_b.solver_impulse[2] += delta_lambda * row.B[8];

					constraint.object_b.solver_impulse[3] += delta_lambda * row.B[9];
					constraint.object_b.solver_impulse[4] += delta_lambda * row.B[10];
					constraint.object_b.solver_impulse[5] += delta_lambda * row.B[11];
				}
			}
		}

		// Block-solve paired normal contacts (2-point manifolds) as a coupled 2x2 each sweep.
		// See solveNormalBlocks: sequential Gauss-Seidel on two one-sided normal constraints of the
		// same body leaves an antisymmetric impulse residual = a phantom torque, which spins a
		// resting cylinder/capsule up from nothing. This re-couples them.
		this.solveNormalBlocks();

		if ( max_impulse <= 0.1 ) {
			break;
		}
	}
};

/**
 * Block-solves the normal rows of a 2-point contact manifold as a coupled 2x2 LCP (Catto/Box2D
 * style). Two normal ContactConstraints on the same body pair are the ends of one resting manifold;
 * solved sequentially, each one's impulse applies a torque that violates the other, leaving an
 * antisymmetric residual that spins a low-inertia body up from rest and that more iterations only
 * worsen. Solving both normals together, with the [0, inf] one-sided limit enumerated over four
 * cases, cancels the cross-coupling in one shot. Runs each sweep over the shared solver_impulse and
 * row.multiplier state; friction rows stay 1x1.
 *
 * @method solveNormalBlocks
 */
Goblin.IterativeSolver.prototype.solveNormalBlocks = function() {
	var cc = this.contact_constraints;
	var n = cc.length;
	for ( var a = 0; a < n; a++ ) {
		var c1 = cc[a];
		if ( c1.active === false || c1._blockPaired ) {
			continue;
		}
		var c2 = null;
		for ( var b = a + 1; b < n; b++ ) {
			var cand = cc[b];
			if ( cand.active === false || cand._blockPaired ) {
				continue;
			}
			if ( cand.object_a === c1.object_a && cand.object_b === c1.object_b ) { c2 = cand; break; }
		}
		if ( c2 === null ) {
			continue;
		}

		var r1 = c1.rows[0], r2 = c2.rows[0];

		var jdot1 = Goblin.IterativeSolver._rowJdot( c1, r1 );
		var jdot2 = Goblin.IterativeSolver._rowJdot( c2, r2 );

		var K11 = r1.D, K22 = r2.D;
		var K12 = Goblin.IterativeSolver._rowCross( r1, r2 );
		if ( K11 <= 0 || K22 <= 0 ) {
			continue;
		}

		var x1 = r1.multiplier, x2 = r2.multiplier;
		// "velocity if these two rows' impulses were zero"
		var a1 = jdot1 - ( K11 * x1 + K12 * x2 );
		var a2 = jdot2 - ( K12 * x1 + K22 * x2 );
		// want A x' + a = eta  ->  A x' = (eta - a)
		var rhs1 = r1.eta - a1;
		var rhs2 = r2.eta - a2;

		var nx1, nx2;
		var det = K11 * K22 - K12 * K12;

		// Case 1: both active
		if ( Math.abs( det ) > 1e-12 ) {
			nx1 = ( rhs1 * K22 - rhs2 * K12 ) / det;
			nx2 = ( rhs2 * K11 - rhs1 * K12 ) / det;
			if ( nx1 >= 0 && nx2 >= 0 ) {
				this._applyBlock( c1, r1, nx1 - x1 );
				this._applyBlock( c2, r2, nx2 - x2 );
				r1.multiplier = nx1; r2.multiplier = nx2;
				c1._blockPaired = c2._blockPaired = true;
				continue;
			}
		}
		// Case 2: only point 1
		nx1 = rhs1 / K11;
		if ( nx1 >= 0 && ( K12 * nx1 + a2 ) >= r2.eta ) {
			this._applyBlock( c1, r1, nx1 - x1 );
			this._applyBlock( c2, r2, 0 - x2 );
			r1.multiplier = nx1; r2.multiplier = 0;
			c1._blockPaired = c2._blockPaired = true;
			continue;
		}
		// Case 3: only point 2
		nx2 = rhs2 / K22;
		if ( nx2 >= 0 && ( K12 * nx2 + a1 ) >= r1.eta ) {
			this._applyBlock( c1, r1, 0 - x1 );
			this._applyBlock( c2, r2, nx2 - x2 );
			r1.multiplier = 0; r2.multiplier = nx2;
			c1._blockPaired = c2._blockPaired = true;
			continue;
		}
		// Case 4: neither
		if ( a1 >= r1.eta && a2 >= r2.eta ) {
			this._applyBlock( c1, r1, 0 - x1 );
			this._applyBlock( c2, r2, 0 - x2 );
			r1.multiplier = 0; r2.multiplier = 0;
			c1._blockPaired = c2._blockPaired = true;
		}
	}
	for ( var k = 0; k < n; k++ ) {
		cc[k]._blockPaired = false;
	}
};

Goblin.IterativeSolver.prototype._applyBlock = function( constraint, row, delta_lambda ) {
	if ( delta_lambda === 0 ) {
		return;
	}
	if ( constraint.object_a && constraint.object_a._mass !== Infinity ) {
		constraint.object_a.solver_impulse[0] += delta_lambda * row.B[0];
		constraint.object_a.solver_impulse[1] += delta_lambda * row.B[1];
		constraint.object_a.solver_impulse[2] += delta_lambda * row.B[2];
		constraint.object_a.solver_impulse[3] += delta_lambda * row.B[3];
		constraint.object_a.solver_impulse[4] += delta_lambda * row.B[4];
		constraint.object_a.solver_impulse[5] += delta_lambda * row.B[5];
	}
	if ( constraint.object_b && constraint.object_b._mass !== Infinity ) {
		constraint.object_b.solver_impulse[0] += delta_lambda * row.B[6];
		constraint.object_b.solver_impulse[1] += delta_lambda * row.B[7];
		constraint.object_b.solver_impulse[2] += delta_lambda * row.B[8];
		constraint.object_b.solver_impulse[3] += delta_lambda * row.B[9];
		constraint.object_b.solver_impulse[4] += delta_lambda * row.B[10];
		constraint.object_b.solver_impulse[5] += delta_lambda * row.B[11];
	}
};

Goblin.IterativeSolver._rowJdot = function( constraint, row ) {
	var jdot = 0;
	if ( constraint.object_a != null && constraint.object_a._mass !== Infinity ) {
		jdot += (
			row.jacobian[0] * constraint.object_a.linear_factor.x * constraint.object_a.solver_impulse[0] +
			row.jacobian[1] * constraint.object_a.linear_factor.y * constraint.object_a.solver_impulse[1] +
			row.jacobian[2] * constraint.object_a.linear_factor.z * constraint.object_a.solver_impulse[2] +
			row.jacobian[3] * constraint.object_a.angular_factor.x * constraint.object_a.solver_impulse[3] +
			row.jacobian[4] * constraint.object_a.angular_factor.y * constraint.object_a.solver_impulse[4] +
			row.jacobian[5] * constraint.object_a.angular_factor.z * constraint.object_a.solver_impulse[5]
		);
	}
	if ( constraint.object_b != null && constraint.object_b._mass !== Infinity ) {
		jdot += (
			row.jacobian[6] * constraint.object_b.linear_factor.x * constraint.object_b.solver_impulse[0] +
			row.jacobian[7] * constraint.object_b.linear_factor.y * constraint.object_b.solver_impulse[1] +
			row.jacobian[8] * constraint.object_b.linear_factor.z * constraint.object_b.solver_impulse[2] +
			row.jacobian[9] * constraint.object_b.angular_factor.x * constraint.object_b.solver_impulse[3] +
			row.jacobian[10] * constraint.object_b.angular_factor.y * constraint.object_b.solver_impulse[4] +
			row.jacobian[11] * constraint.object_b.angular_factor.z * constraint.object_b.solver_impulse[5]
		);
	}
	return jdot;
};

Goblin.IterativeSolver._rowCross = function( rowA, rowB ) {
	return (
		rowA.jacobian[0] * rowB.B[0] + rowA.jacobian[1] * rowB.B[1] + rowA.jacobian[2] * rowB.B[2] +
		rowA.jacobian[3] * rowB.B[3] + rowA.jacobian[4] * rowB.B[4] + rowA.jacobian[5] * rowB.B[5] +
		rowA.jacobian[6] * rowB.B[6] + rowA.jacobian[7] * rowB.B[7] + rowA.jacobian[8] * rowB.B[8] +
		rowA.jacobian[9] * rowB.B[9] + rowA.jacobian[10] * rowB.B[10] + rowA.jacobian[11] * rowB.B[11]
	);
};

Goblin.IterativeSolver.prototype.applyConstraints = function( time_delta ) {
	var num_constraints = this.all_constraints.length,
		constraint,
		num_rows,
		row,
		i, j,
		invmass;

	for ( i = 0; i < num_constraints; i++ ) {
		constraint = this.all_constraints[i];
		if ( constraint.active === false ) {
			continue;
		}
		num_rows = constraint.rows.length;

		constraint.last_impulse.x = constraint.last_impulse.y = constraint.last_impulse.z = 0;

		for ( j = 0; j < num_rows; j++ ) {
			row = constraint.rows[j];
			row.multiplier_cached = row.multiplier;

			if ( constraint.object_a != null && constraint.object_a._mass !== Infinity ) {
				invmass = constraint.object_a._mass_inverted;
				_tmp_vec3_2.x = invmass * time_delta * row.jacobian[0] * constraint.object_a.linear_factor.x * row.multiplier;
				_tmp_vec3_2.y = invmass * time_delta * row.jacobian[1] * constraint.object_a.linear_factor.y * row.multiplier;
				_tmp_vec3_2.z = invmass * time_delta * row.jacobian[2] * constraint.object_a.linear_factor.z * row.multiplier;
				constraint.object_a.linear_velocity.add( _tmp_vec3_2 );
				constraint.last_impulse.add( _tmp_vec3_2 );

				_tmp_vec3_1.x = time_delta * row.jacobian[3] * constraint.object_a.angular_factor.x * row.multiplier;
				_tmp_vec3_1.y = time_delta * row.jacobian[4] * constraint.object_a.angular_factor.y * row.multiplier;
				_tmp_vec3_1.z = time_delta * row.jacobian[5] * constraint.object_a.angular_factor.z * row.multiplier;
				constraint.object_a.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );
				constraint.object_a.angular_velocity.add( _tmp_vec3_1 );
				constraint.last_impulse.add( _tmp_vec3_1 );
			}

			if ( constraint.object_b != null && constraint.object_b._mass !== Infinity ) {
				invmass = constraint.object_b._mass_inverted;
				_tmp_vec3_2.x = invmass * time_delta * row.jacobian[6] * constraint.object_b.linear_factor.x * row.multiplier;
				_tmp_vec3_2.y = invmass * time_delta * row.jacobian[7] * constraint.object_b.linear_factor.y * row.multiplier;
				_tmp_vec3_2.z = invmass * time_delta * row.jacobian[8] * constraint.object_b.linear_factor.z * row.multiplier;
				constraint.object_b.linear_velocity.add(_tmp_vec3_2 );
				constraint.last_impulse.add( _tmp_vec3_2 );

				_tmp_vec3_1.x = time_delta * row.jacobian[9] * constraint.object_b.angular_factor.x * row.multiplier;
				_tmp_vec3_1.y = time_delta * row.jacobian[10] * constraint.object_b.angular_factor.y * row.multiplier;
				_tmp_vec3_1.z = time_delta * row.jacobian[11] * constraint.object_b.angular_factor.z * row.multiplier;
				constraint.object_b.inverseInertiaTensorWorldFrame.transformVector3( _tmp_vec3_1 );
				constraint.object_b.angular_velocity.add( _tmp_vec3_1 );
				constraint.last_impulse.add( _tmp_vec3_1 );
			}
		}

		if ( constraint.breaking_threshold > 0 ) {
			if ( constraint.last_impulse.lengthSquared() >= constraint.breaking_threshold * constraint.breaking_threshold ) {
				constraint.active = false;
			}
		}
	}

	// Kill the resting-contact residual "buzz": a body settled on a contact keeps a small standing linear
	// velocity that never damps to zero (an equilibrium artifact) and leaks into anything resting on it.
	// Only a body slow (tiny linear AND angular velocity) for several consecutive frames is zeroed, so the
	// active settling transient and any rolling/spinning body are never touched.
	var BUZZ_LIN = 0.08, BUZZ_ANG = 0.08, BUZZ_FRAMES = 8;
	for ( i = 0; i < this.contact_constraints.length; i++ ) {
		constraint = this.contact_constraints[i];
		if ( constraint.active === false ) { continue; }
		var pair = [ constraint.object_a, constraint.object_b ];
		for ( var pi = 0; pi < 2; pi++ ) {
			var bod = pair[pi];
			if ( bod == null || bod._mass === Infinity ) { continue; }
			if ( bod.linear_velocity.lengthSquared() < BUZZ_LIN * BUZZ_LIN &&
				bod.angular_velocity.lengthSquared() < BUZZ_ANG * BUZZ_ANG ) {
				bod._buzzSlowFrames = ( bod._buzzSlowFrames || 0 ) + 1;
				if ( bod._buzzSlowFrames >= BUZZ_FRAMES ) {
					bod.linear_velocity.x = bod.linear_velocity.y = bod.linear_velocity.z = 0;
				}
			} else {
				bod._buzzSlowFrames = 0;
			}
		}
	}
};
/**
 * Takes possible contacts found by a broad phase and determines if they are legitimate contacts
 *
 * @class NarrowPhase
 * @constructor
 */
Goblin.NarrowPhase = function() {
	/**
	 * holds all contacts which currently exist in the scene
	 *
	 * @property contact_manifolds
	 * @type Goblin.ContactManifoldList
	 */
	this.contact_manifolds = new Goblin.ContactManifoldList();
};

/**
 * Iterates over all contact manifolds, updating penetration depth & contact locations
 *
 * @method updateContactManifolds
 */
Goblin.NarrowPhase.prototype.updateContactManifolds = function() {
	var current = this.contact_manifolds.first,
		prev = null;

	while ( current !== null ) {
		current.update();

		if ( current.points.length === 0 ) {
			Goblin.ObjectPool.freeObject( 'ContactManifold', current );
			if ( prev == null ) {
				this.contact_manifolds.first = current.next_manifold;
			} else {
				prev.next_manifold = current.next_manifold;
			}
			current = current.next_manifold;
		} else {
			prev = current;
			current = current.next_manifold;
		}
	}
};

Goblin.NarrowPhase.prototype.midPhase = function( object_a, object_b ) {
	var compound,
		other;

	if ( object_a.shape instanceof Goblin.CompoundShape ) {
		compound = object_a;
		other = object_b;
	} else {
		compound = object_b;
		other = object_a;
	}

	var proxy = Goblin.ObjectPool.getObject( 'RigidBodyProxy' ),
		child_shape, contact;
	for ( var i = 0; i < compound.shape.child_shapes.length; i++ ) {
		child_shape = compound.shape.child_shapes[i];
		proxy.setFrom( compound, child_shape );

		if ( proxy.shape instanceof Goblin.CompoundShape || other.shape instanceof Goblin.CompoundShape ) {
			this.midPhase( proxy, other );
		} else {
			contact = this.getContact( proxy, other );
			if ( contact != null ) {
				var parent_a, parent_b;
				if ( contact.object_a === proxy ) {
					contact.object_a = compound;
					parent_a = proxy;
					parent_b = other;
				} else {
					contact.object_b = compound;
					parent_a = other;
					parent_b = proxy;
				}

				if ( parent_a instanceof Goblin.RigidBodyProxy ) {
					while ( parent_a.parent ) {
						if ( parent_a instanceof Goblin.RigidBodyProxy ) {
							parent_a.shape_data.transform.transformVector3( contact.contact_point_in_a );
						}
						parent_a = parent_a.parent;
					}
				}

				if ( parent_b instanceof Goblin.RigidBodyProxy ) {
					while ( parent_b.parent ) {
						if ( parent_b instanceof Goblin.RigidBodyProxy ) {
							parent_b.shape_data.transform.transformVector3( contact.contact_point_in_b );
						}
						parent_b = parent_b.parent;
					}
				}

				contact.object_a = parent_a;
				contact.object_b = parent_b;
				this.addContact( parent_a, parent_b, contact );
			}
		}
	}
	Goblin.ObjectPool.freeObject( 'RigidBodyProxy', proxy );
};

Goblin.NarrowPhase.prototype.meshCollision = (function(){
	var b_to_a = new Goblin.Matrix4(),
		tri_b = new Goblin.TriangleShape( new Goblin.Vector3(), new Goblin.Vector3(), new Goblin.Vector3() ),
		b_aabb = new Goblin.AABB(),
		b_right_aabb = new Goblin.AABB(),
		b_left_aabb = new Goblin.AABB();

	function meshMesh( object_a, object_b, addContact ) {
		// get matrix which converts from object_b's space to object_a
		b_to_a.copy( object_a.transform_inverse );
		b_to_a.multiply( object_b.transform );

		// traverse both objects' AABBs while they overlap, if two overlapping leaves are found then perform Triangle/Triangle intersection test
		var nodes = [ object_a.shape.hierarchy, object_b.shape.hierarchy ];
		//debugger;
		while ( nodes.length ) {
			var a_node = nodes.shift(),
				b_node = nodes.shift();

			if ( a_node.isLeaf() && b_node.isLeaf() ) {
				// Both sides are triangles, do intersection test
                // convert node_b's triangle into node_a's frame
                b_to_a.transformVector3Into( b_node.object.a, tri_b.a );
                b_to_a.transformVector3Into( b_node.object.b, tri_b.b );
                b_to_a.transformVector3Into( b_node.object.c, tri_b.c );
                _tmp_vec3_1.subtractVectors( tri_b.b, tri_b.a );
                _tmp_vec3_2.subtractVectors( tri_b.c, tri_b.a );
                tri_b.normal.crossVectors( _tmp_vec3_1, _tmp_vec3_2 );
                tri_b.normal.normalize();

				var contact = Goblin.TriangleTriangle( a_node.object, tri_b );
                if ( contact != null ) {
					object_a.transform.rotateVector3( contact.contact_normal );

                    object_a.transform.transformVector3( contact.contact_point );

                    object_a.transform.transformVector3( contact.contact_point_in_b );
                    object_b.transform_inverse.transformVector3( contact.contact_point_in_b );

                    contact.object_a = object_a;
                    contact.object_b = object_b;

                    contact.restitution = ( object_a.restitution + object_b.restitution ) / 2;
                    contact.friction = ( object_a.friction + object_b.friction ) / 2;
                    /*console.log( contact );
                    debugger;*/

                    addContact( object_a, object_b, contact );
                }
			} else if ( a_node.isLeaf() ) {
				// just a_node is a leaf
				b_left_aabb.transform( b_node.left.aabb, b_to_a );
				if ( a_node.aabb.intersects( b_left_aabb ) ) {
					nodes.push( a_node, b_node.left );
				}
				b_right_aabb.transform( b_node.right.aabb, b_to_a );
				if ( a_node.aabb.intersects( b_right_aabb ) ) {
					nodes.push( a_node, b_node.right );
				}
			} else if ( b_node.isLeaf() ) {
				// just b_node is a leaf
				b_aabb.transform( b_node.aabb, b_to_a );
				if ( b_aabb.intersects( a_node.left.aabb ) ) {
					nodes.push( a_node.left, b_node );
				}
				if ( b_aabb.intersects( a_node.right.aabb ) ) {
					nodes.push( a_node.right, b_node );
				}
			} else {
				// neither node is a branch
				b_left_aabb.transform( b_node.left.aabb, b_to_a );
				b_right_aabb.transform( b_node.right.aabb, b_to_a );
				if ( a_node.left.aabb.intersects( b_left_aabb ) ) {
					nodes.push( a_node.left, b_node.left );
				}
				if ( a_node.left.aabb.intersects( b_right_aabb ) ) {
					nodes.push( a_node.left, b_node.right );
				}
				if ( a_node.right.aabb.intersects( b_left_aabb ) ) {
					nodes.push( a_node.right, b_node.left );
				}
				if ( a_node.right.aabb.intersects( b_right_aabb ) ) {
					nodes.push( a_node.right, b_node.right );
				}
			}
		}
	}

	function triangleConvex( triangle, mesh, convex ) {
		// Create proxy to convert convex into mesh's space
		var proxy = Goblin.ObjectPool.getObject( 'RigidBodyProxy' );

		var child_shape = new Goblin.CompoundShapeChild( triangle, new Goblin.Vector3(), new Goblin.Quaternion() );
		proxy.setFrom( mesh, child_shape );

		var simplex = Goblin.GjkEpa.GJK( proxy, convex ),
			contact;
		if ( Goblin.GjkEpa.result != null ) {
			contact = Goblin.GjkEpa.result;
		} else if ( simplex != null ) {
			contact = Goblin.GjkEpa.EPA( simplex );
		}

		Goblin.ObjectPool.freeObject( 'RigidBodyProxy', proxy );

		return contact;
	}

	var meshConvex = (function(){
		var convex_to_mesh = new Goblin.Matrix4(),
			convex_aabb_in_mesh = new Goblin.AABB();

		return function meshConvex( mesh, convex, addContact ) {
			// Find matrix that converts convex into mesh space
			convex_to_mesh.copy( convex.transform );
			convex_to_mesh.multiply( mesh.transform_inverse );

			convex_aabb_in_mesh.transform( convex.aabb, mesh.transform_inverse );

			// Traverse the BHV in mesh
			var pending_nodes = [ mesh.shape.hierarchy ],
				node;
			while ( ( node = pending_nodes.shift() ) ) {
				if ( node.aabb.intersects( convex_aabb_in_mesh ) ) {
					if ( node.isLeaf() ) {
						// Check node for collision
						var contact = triangleConvex( node.object, mesh, convex );
						if ( contact != null ) {
							var _mesh = mesh;
							while ( _mesh.parent != null ) {
								_mesh = _mesh.parent;
							}
							// Resolve convex up to its real body too (it is a proxy when the partner is a compound child)
							var _convex = convex;
							while ( _convex.parent != null ) {
								if ( _convex instanceof Goblin.RigidBodyProxy ) {
									_convex.shape_data.transform.transformVector3( contact.contact_point_in_b );
								}
								_convex = _convex.parent;
							}
							contact.object_a = _mesh;
							contact.object_b = _convex;
							addContact( _mesh, _convex, contact );
						}
					} else {
						pending_nodes.push( node.left, node.right );
					}
				}
			}
		};
	})();

	return function meshCollision( object_a, object_b ) {
		var a_is_mesh = object_a.shape instanceof Goblin.MeshShape,
			b_is_mesh = object_b.shape instanceof Goblin.MeshShape;

		if ( a_is_mesh && b_is_mesh ) {
			meshMesh( object_a, object_b, this.addContact.bind( this ) );
		} else {
			if ( a_is_mesh ) {
				meshConvex( object_a, object_b, this.addContact.bind( this ) );
			} else {
				meshConvex( object_b, object_a, this.addContact.bind( this ) );
			}
		}
	};
})();

/**
 * Tests two objects for contact
 *
 * @method getContact
 * @param {RigidBody} object_a
 * @param {RigidBody} object_b
 */
Goblin.NarrowPhase.prototype.getContact = function( object_a, object_b ) {
	if ( object_a.shape instanceof Goblin.CompoundShape || object_b.shape instanceof Goblin.CompoundShape ) {
		this.midPhase( object_a, object_b );
		return;
	}

	if ( object_a.shape instanceof Goblin.MeshShape || object_b.shape instanceof Goblin.MeshShape ) {
		this.meshCollision( object_a, object_b );
		return;
	}

	var contact;

	if ( object_a.shape instanceof Goblin.SphereShape && object_b.shape instanceof Goblin.SphereShape ) {
		// Sphere - Sphere contact check
		contact = Goblin.SphereSphere( object_a, object_b );
	} else if (
		object_a.shape instanceof Goblin.SphereShape && object_b.shape instanceof Goblin.BoxShape ||
		object_a.shape instanceof Goblin.BoxShape && object_b.shape instanceof Goblin.SphereShape
	) {
		// Sphere - Box contact check
		contact = Goblin.BoxSphere( object_a, object_b );
	} else {
		// contact check based on GJK
		var simplex = Goblin.GjkEpa.GJK( object_a, object_b );
		if ( Goblin.GjkEpa.result != null ) {
			contact = Goblin.GjkEpa.result;
		} else if ( simplex != null ) {
			contact = Goblin.GjkEpa.EPA( simplex );
		}
	}

	return contact;
};

Goblin.NarrowPhase.prototype.addContact = function( object_a, object_b, contact ) {
	this.contact_manifolds.getManifoldForObjects( object_a, object_b ).addContact( contact );
};

/**
 * Loops over the passed array of object pairs which may be in contact
 * valid contacts are put in this object's `contacts` property
 *
 * @method generateContacts
 * @param possible_contacts {Array}
 */
Goblin.NarrowPhase.prototype.generateContacts = function( possible_contacts ) {
	var i,
		contact,
		possible_contacts_length = possible_contacts.length;

	// Make sure all of the manifolds are up to date
	this.updateContactManifolds();

	for ( i = 0; i < possible_contacts_length; i++ ) {
		contact = this.getContact( possible_contacts[i][0], possible_contacts[i][1] );
		if ( contact != null ) {
			this.addContact( possible_contacts[i][0], possible_contacts[i][1], contact );
		}
	}

	this.symmetrizeRoundContacts();
	this.collapseSphereContacts();
};

/**
 * Collapses any sphere manifold to a single contact point under the sphere's center. A sphere touches
 * a surface at exactly one point along the contact normal, but the persistent ContactManifold caches
 * up to four points, each recomputed from a local anchor fixed on the sphere surface. As the sphere
 * rolls those anchors rotate with it, so cached points trail behind the true bottom while still
 * shallowly penetrating, forming an off-center cluster whose lever arm under the vertical normal is a
 * phantom torque that pumps the sphere's spin and keeps it rolling. This keeps the single deepest
 * point, re-places it (and its local anchors) at the sphere center projected onto the surface along
 * the normal, so it is recomputed from the center each frame and rolling cannot smear it.
 *
 * @method collapseSphereContacts
 */
Goblin.NarrowPhase.prototype.collapseSphereContacts = function() {
	var manifold = this.contact_manifolds.first;
	while ( manifold ) {
		var hasSphere = manifold.object_a.shape instanceof Goblin.SphereShape ||
			manifold.object_b.shape instanceof Goblin.SphereShape;

		if ( hasSphere && manifold.points.length > 0 ) {
			// Keep the single deepest-penetrating point (the real current contact); destroy the rest.
			var deepest = 0;
			for ( var i = 1; i < manifold.points.length; i++ ) {
				if ( manifold.points[i].penetration_depth > manifold.points[deepest].penetration_depth ) {
					deepest = i;
				}
			}
			for ( i = manifold.points.length - 1; i >= 0; i-- ) {
				if ( i !== deepest ) {
					manifold.points[i].destroy();
					manifold.points.splice( i, 1 );
				}
			}

			var p = manifold.points[0];
			// The contact's own object ordering is authoritative — a manifold matches its body pair
			// in either order, so its object_a may be the contact's object_b (see BoxSphere, which
			// always makes the sphere its contact's object_a).
			var sphereIsA = p.object_a.shape instanceof Goblin.SphereShape;
			var sphereObj = sphereIsA ? p.object_a : p.object_b;
			var r = sphereObj.shape.radius;
			// Contact normal points from A to B. The point on the sphere surface that is in contact is
			// the sphere center moved by radius along the normal toward the OTHER body.
			var sign = sphereIsA ? 1 : -1;   // toward the other body from the sphere's center
			var nx = p.contact_normal.x * sign, ny = p.contact_normal.y * sign, nz = p.contact_normal.z * sign;

			// True world contact point: on the sphere surface, directly along the normal from center.
			// Split the small penetration so the point sits midway in the overlap, matching the
			// engine's convention (see BoxSphere / ContactManifold.update midpoint).
			var half_pen = p.penetration_depth * 0.5;
			p.contact_point.x = sphereObj.position.x + nx * ( r - half_pen );
			p.contact_point.y = sphereObj.position.y + ny * ( r - half_pen );
			p.contact_point.z = sphereObj.position.z + nz * ( r - half_pen );

			// Re-anchor only the sphere's own local point at its true surface point along the normal, so
			// a rolling sphere's anchor can't trail the true bottom and pump phantom torque.
			_tmp_vec3_1.set(
				sphereObj.position.x + nx * r,
				sphereObj.position.y + ny * r,
				sphereObj.position.z + nz * r
			);
			sphereObj.transform_inverse.transformVector3Into( _tmp_vec3_1, sphereIsA ? p.contact_point_in_a : p.contact_point_in_b );
			// Leave the other body's anchor where narrowphase planted it. Re-fabricating it from the
			// sphere center co-locates both anchors so they translate rigidly with the sphere, blinding
			// ContactManifold.update's staleness checks — the contact never dies and the sphere stays
			// glued to the body it has left (entanglement).
		}

		manifold = manifold.next_manifold;
	}
};

/**
 * Snaps a round or tapered body's side-rest contact points onto its true line contact. A cylinder,
 * capsule, or cone lying on its side touches a flat surface along a line fixed by the shape's own
 * geometry (see each shape's `getRestAxis`), but GJK/EPA place their points off that line; any such
 * point applies a torque about the line every step, spinning the body up into an endless roll. For any
 * shape exposing `getRestAxis(localNormal)` this transforms that rest line into world space and
 * re-projects each contact point onto it (clamped to the segment), correcting only the in-plane
 * component and leaving the along-normal penetration untouched. Guarded to the genuine side-rest case:
 * at least two points sharing a near-identical normal, with that normal roughly perpendicular to the
 * body's own axis; anything else is left as EPA produced it.
 *
 * @method symmetrizeRoundContacts
 */
Goblin.NarrowPhase.prototype.symmetrizeRoundContacts = function() {
	var manifold = this.contact_manifolds.first;
	var local_n = new Goblin.Vector3(),
		axis_local_0 = new Goblin.Vector3(), axis_local_1 = new Goblin.Vector3(),
		axis_world_0 = new Goblin.Vector3(), axis_world_1 = new Goblin.Vector3();

	while ( manifold ) {
		var round = null;
		if ( typeof manifold.object_a.shape.getRestAxis === 'function' ) {
			round = manifold.object_a;
		} else if ( typeof manifold.object_b.shape.getRestAxis === 'function' ) {
			round = manifold.object_b;
		}

		if ( round !== null && manifold.points.length >= 2 ) {
			var points = manifold.points;
			var n0 = points[0].contact_normal;

			// All normals must point essentially the same way (a single flat contact face, not
			// several faces of a corner/wedge).
			var consistent = true;
			for ( var i = 1; i < points.length; i++ ) {
				var ni = points[i].contact_normal;
				var ndot = n0.x * ni.x + n0.y * ni.y + n0.z * ni.z;
				if ( ndot <= 0.999 ) { consistent = false; break; }
			}

			// Normal in the round body's local space, to pick the radial direction for shapes whose
			// rest axis depends on which way is down locally, and to detect orientation. The barrel
			// line is valid only for a genuine side rest (local normal roughly perpendicular to the
			// body's own axis); a body standing on its flat end has a near-axial local normal and a
			// rim-circle of points that this line logic must not touch. Require |local_n.y| small.
			round.transform_inverse.rotateVector3Into( n0, local_n );
			var isSideRest = Math.abs( local_n.y ) < 0.7;

			if ( consistent && isSideRest ) {
				var axis = round.shape.getRestAxis( local_n );
				axis_local_0.x = axis[0].x; axis_local_0.y = axis[0].y; axis_local_0.z = axis[0].z;
				axis_local_1.x = axis[1].x; axis_local_1.y = axis[1].y; axis_local_1.z = axis[1].z;
				round.transform.transformVector3Into( axis_local_0, axis_world_0 );
				round.transform.transformVector3Into( axis_local_1, axis_world_1 );

				var ax = axis_world_1.x - axis_world_0.x,
					ay = axis_world_1.y - axis_world_0.y,
					az = axis_world_1.z - axis_world_0.z;
				var axisLenSq = ax * ax + ay * ay + az * az;

				for ( i = 0; i < points.length; i++ ) {
					var p = points[i];
					var n = p.contact_normal;

					// Project the point onto the true rest line, clamped to the segment.
					var t = 0;
					if ( axisLenSq > 1e-9 ) {
						t = ( ( p.contact_point.x - axis_world_0.x ) * ax +
							( p.contact_point.y - axis_world_0.y ) * ay +
							( p.contact_point.z - axis_world_0.z ) * az ) / axisLenSq;
						if ( t < 0 ) {
							t = 0;
						} else if ( t > 1 ) {
							t = 1;
						}
					}
					var targetX = axis_world_0.x + ax * t,
						targetY = axis_world_0.y + ay * t,
						targetZ = axis_world_0.z + az * t;

					// Only correct the in-plane (perpendicular-to-normal) component; leave the
					// along-normal (penetration) component exactly as EPA computed it, so we don't
					// fight the height/penetration solve.
					var dx = targetX - p.contact_point.x,
						dy = targetY - p.contact_point.y,
						dz = targetZ - p.contact_point.z;
					var dn = dx * n.x + dy * n.y + dz * n.z;
					dx -= dn * n.x; dy -= dn * n.y; dz -= dn * n.z;

					// Shift only the world-space contact point the jacobians are built from this step.
					// The local anchors contact_point_in_a/_in_b are left alone: they drive next
					// step's penetration/height computation, and rewriting them from the tangentially
					// shifted point corrupts the height solve. Leaving them makes this a per-step
					// correction, re-applied fresh from EPA's latest points rather than a persistent edit.
					p.contact_point.x += dx; p.contact_point.y += dy; p.contact_point.z += dz;
				}
			}
		}

		manifold = manifold.next_manifold;
	}
};

Goblin.NarrowPhase.prototype.removeBody = function( body ) {
	var manifold = this.contact_manifolds.first;

	while ( manifold != null ) {
		if ( manifold.object_a === body || manifold.object_b === body ) {
			for ( var i = 0; i < manifold.points.length; i++ ) {
				manifold.points[i].destroy();
			}
			manifold.points.length = 0;
		}

		manifold = manifold.next;
	}
};
/**
 * Manages pools for various types of objects, provides methods for creating and freeing pooled objects
 *
 * @class ObjectPool
 * @static
 */
Goblin.ObjectPool = {
	/**
	 * key/value map of registered types
	 *
	 * @property types
	 * @private
	 */
	types: {},

	/**
	 * key/pool map of object type - to - object pool
	 *
	 * @property pools
	 * @private
	 */
	pools: {},

	/**
	 * registers a type of object to be available in pools
	 *
	 * @method registerType
	 * @param key {String} key associated with the object to register
	 * @param constructing_function {Function} function which will return a new object
	 */
	registerType: function( key, constructing_function ) {
		this.types[ key ] = constructing_function;
		this.pools[ key ] = [];
	},

	/**
	 * retrieve a free object from the specified pool, or creates a new object if one is not available
	 *
	 * @method getObject
	 * @param key {String} key of the object type to retrieve
	 * @return {Mixed} object of the type asked for, when done release it with `ObjectPool.freeObject`
	 */
	getObject: function( key ) {
		var pool = this.pools[ key ];

		if ( pool.length !== 0 ) {
			return pool.pop();
		} else {
			return this.types[ key ]();
		}
	},

	/**
	 * adds on object to the object pool so it can be reused
	 *
	 * @method freeObject
	 * @param key {String} type of the object being freed, matching the key given to `registerType`
	 * @param object {Mixed} object to release into the pool
	 */
	freeObject: function( key, object ) {
		if ( object.removeAllListeners != null ) {
			object.removeAllListeners();
		}
		this.pools[ key ].push( object );
	}
};

// register the objects used in Goblin
Goblin.ObjectPool.registerType( 'ContactDetails', function() { return new Goblin.ContactDetails(); } );
Goblin.ObjectPool.registerType( 'ContactManifold', function() { return new Goblin.ContactManifold(); } );
Goblin.ObjectPool.registerType( 'GJK2SupportPoint', function() { return new Goblin.GjkEpa.SupportPoint( new Goblin.Vector3(), new Goblin.Vector3(), new Goblin.Vector3() ); } );
Goblin.ObjectPool.registerType( 'ConstraintRow', function() { return new Goblin.ConstraintRow(); } );
Goblin.ObjectPool.registerType( 'ContactConstraint', function() { return new Goblin.ContactConstraint(); } );
Goblin.ObjectPool.registerType( 'FrictionConstraint', function() { return new Goblin.FrictionConstraint(); } );
Goblin.ObjectPool.registerType( 'RayIntersection', function() { return new Goblin.RayIntersection(); } );
Goblin.ObjectPool.registerType( 'RigidBodyProxy', function() { return new Goblin.RigidBodyProxy(); } );
Goblin.RigidBodyProxy = function() {
	this.parent = null;
	this.id = null;

	this.shape = null;

	this.aabb = new Goblin.AABB();

	this._mass = null;
	this._mass_inverted = null;

	this.position = new Goblin.Vector3();
	this.rotation = new Goblin.Quaternion();

	this.transform = new Goblin.Matrix4();
	this.transform_inverse = new Goblin.Matrix4();

	this.restitution = null;
	this.friction = null;
};

Object.defineProperty(
	Goblin.RigidBodyProxy.prototype,
	'mass',
	{
		get: function() {
			return this._mass;
		},
		set: function( n ) {
			this._mass = n;
			this._mass_inverted = 1 / n;
			this.inertiaTensor = this.shape.getInertiaTensor( n );
		}
	}
);

Goblin.RigidBodyProxy.prototype.setFrom = function( parent, shape_data ) {
	this.parent = parent;

	this.id = parent.id;

	this.shape = shape_data.shape;
	this.shape_data = shape_data;

	this._mass = parent._mass;

	parent.transform.transformVector3Into( shape_data.position, this.position );
	this.rotation.multiplyQuaternions( parent.rotation, shape_data.rotation );

	this.transform.makeTransform( this.rotation, this.position );
	this.transform.invertInto( this.transform_inverse );

	this.aabb.transform( this.shape.aabb, this.transform );

	this.restitution = parent.restitution;
	this.friction = parent.friction;
};

Goblin.RigidBodyProxy.prototype.findSupportPoint = Goblin.RigidBody.prototype.findSupportPoint;

Goblin.RigidBodyProxy.prototype.getRigidBody = function() {
	var body = this.parent;
	while ( body.parent ) {
		body = this.parent;
	}
	return body;
};
/**
 * Manages the physics simulation
 *
 * @class World
 * @param broadphase {Goblin.Broadphase} the broadphase used by the world to find possible contacts
 * @param narrowphase {Goblin.NarrowPhase} the narrowphase used by the world to generate valid contacts
 * @constructor
 */
Goblin.World = function( broadphase, narrowphase, solver ) {
	/**
	 * How many time steps have been simulated. If the steps are always the same length then total simulation time = world.ticks * time_step
	 *
	 * @property ticks
	 * @type {number}
	 */
	this.ticks = 0;

	/**
	 * The broadphase used by the world to find possible contacts
	 *
	 * @property broadphase
	 * @type {Goblin.Broadphase}
	 */
	this.broadphase = broadphase;

	/**
	 * The narrowphase used by the world to generate valid contacts
	 *
	 * @property narrowphasee
	 * @type {Goblin.NarrowPhase}
	 */
	this.narrowphase = narrowphase;

	/**
	 * The contact solver used by the world to calculate and apply impulses resulting from contacts
	 *
	 * @property solver
	 */
	this.solver = solver;
	solver.world = this;

	/**
	 * Array of rigid bodies in the world
	 *
	 * @property rigid_bodies
	 * @type {Array}
	 * @default []
	 * @private
	 */
	this.rigid_bodies = [];

	/**
	 * Array of ghost bodies in the world
	 *
	 * @property ghost_bodies
	 * @type {Array}
	 * @default []
	 * @private
	 */
	this.ghost_bodies = [];

	/**
	* the world's gravity, applied by default to all objects in the world
	*
	* @property gravity
	* @type {vec3}
	* @default [ 0, -9.8, 0 ]
	*/
	this.gravity = new Goblin.Vector3( 0, -9.8, 0 );

	/**
	 * array of force generators in the world
	 *
	 * @property force_generators
	 * @type {Array}
	 * @default []
	 * @private
	 */
	this.force_generators = [];

	this.listeners = {};
};
Goblin.EventEmitter.apply( Goblin.World );

/**
* Steps the physics simulation according to the time delta
*
* @method step
* @param time_delta {Number} amount of time to simulate, in seconds
* @param [max_step] {Number} maximum time step size, in seconds
*/
Goblin.World.prototype.step = function( time_delta, max_step ) {
    max_step = max_step || time_delta;

	var x, delta, time_loops,
        i, loop_count, body;

    time_loops = time_delta / max_step;
    for ( x = 0; x < time_loops; x++ ) {
		this.ticks++;
        delta = Math.min( max_step, time_delta );
        time_delta -= max_step;

		this.emit( 'stepStart', this.ticks, delta );

		// Apply gravity
        for ( i = 0, loop_count = this.rigid_bodies.length; i < loop_count; i++ ) {
            body = this.rigid_bodies[i];

            // Objects of infinite mass don't move
            if ( body._mass !== Infinity ) {
				_tmp_vec3_1.scaleVector( body.gravity || this.gravity, body._mass * delta );
                body.accumulated_force.add( _tmp_vec3_1 );
            }
        }

        // Apply force generators
        for ( i = 0, loop_count = this.force_generators.length; i < loop_count; i++ ) {
            this.force_generators[i].applyForce();
        }

		// Integrate rigid bodies
		for ( i = 0, loop_count = this.rigid_bodies.length; i < loop_count; i++ ) {
			body = this.rigid_bodies[i];
			body.integrate( delta );
		}

		for ( i = 0, loop_count = this.rigid_bodies.length; i < loop_count; i++ ) {
			this.rigid_bodies[i].updateDerived();
		}

        // Check for contacts, broadphase
        this.broadphase.update();

        // Find valid contacts, narrowphase
        this.narrowphase.generateContacts( this.broadphase.collision_pairs );

        // Process contact manifolds into contact and friction constraints
        this.solver.processContactManifolds( this.narrowphase.contact_manifolds );

        // Prepare the constraints by precomputing some values
        this.solver.prepareConstraints( delta );

        // Resolve contacts
        this.solver.resolveContacts();

        // Run the constraint solver
        this.solver.solveConstraints();

        // Apply the constraints
        this.solver.applyConstraints( delta );

		// Uppdate ghost bodies
		for ( i = 0; i < this.ghost_bodies.length; i++ ) {
			body = this.ghost_bodies[i];
			body.checkForEndedContacts();
		}

		this.emit( 'stepEnd', this.ticks, delta );
    }
};

/**
 * Adds a rigid body to the world
 *
 * @method addRigidBody
 * @param rigid_body {Goblin.RigidBody} rigid body to add to the world
 */
Goblin.World.prototype.addRigidBody = function( rigid_body ) {
	rigid_body.world = this;
	rigid_body.updateDerived();
	this.rigid_bodies.push( rigid_body );
	this.broadphase.addBody( rigid_body );
};

/**
 * Removes a rigid body from the world
 *
 * @method removeRigidBody
 * @param rigid_body {Goblin.RigidBody} rigid body to remove from the world
 */
Goblin.World.prototype.removeRigidBody = function( rigid_body ) {
	var i;

	for ( i = 0; i < this.rigid_bodies.length; i++ ) {
		if ( this.rigid_bodies[i] === rigid_body ) {
			this.rigid_bodies.splice( i, 1 );
			this.broadphase.removeBody( rigid_body );
			break;
		}
	}

	// remove any contact & friction constraints associated with this body
	// this calls contact.destroy() for all relevant contacts
	// which in turn cleans up the iterative solver
	this.narrowphase.removeBody( rigid_body );
};

/**
 * Adds a ghost body to the world
 *
 * @method addGhostBody
 * @param ghost_body {Goblin.GhostBody} ghost body to add to the world
 */
Goblin.World.prototype.addGhostBody = function( ghost_body ) {
	ghost_body.world = this;
	ghost_body.updateDerived();
	this.ghost_bodies.push( ghost_body );
	this.broadphase.addBody( ghost_body );
};

/**
 * Removes a ghost body from the world
 *
 * @method removeGhostBody
 * @param ghost_body {Goblin.GhostBody} ghost body to remove from the world
 */
Goblin.World.prototype.removeGhostBody = function( ghost_body ) {
	for ( var i = 0; i < this.ghost_bodies.length; i++ ) {
		if ( this.ghost_bodies[i] === ghost_body ) {
			this.ghost_bodies.splice( i, 1 );
			this.broadphase.removeBody( ghost_body );
			break;
		}
	}
};

/**
 * Adds a force generator to the world
 *
 * @method addForceGenerator
 * @param force_generator {Goblin.ForceGenerator} force generator object to be added
 */
Goblin.World.prototype.addForceGenerator = function( force_generator ) {
	var i, force_generators_count;
	// Make sure this generator isn't already in the world
	for ( i = 0, force_generators_count = this.force_generators.length; i < force_generators_count; i++ ) {
		if ( this.force_generators[i] === force_generator ) {
			return;
		}
	}

	this.force_generators.push( force_generator );
};

/**
 * removes a force generator from the world
 *
 * @method removeForceGenerator
 * @param force_generatorv {Goblin.ForceGenerator} force generator object to be removed
 */
Goblin.World.prototype.removeForceGenerator = function( force_generator ) {
	var i, force_generators_count;
	for ( i = 0, force_generators_count = this.force_generators.length; i < force_generators_count; i++ ) {
		if ( this.force_generators[i] === force_generator ) {
			this.force_generators.splice( i, 1 );
			return;
		}
	}
};

/**
 * adds a constraint to the world
 *
 * @method addConstraint
 * @param constraint {Goblin.Constraint} constraint to be added
 */
Goblin.World.prototype.addConstraint = function( constraint ) {
	this.solver.addConstraint( constraint );
};

/**
 * removes a constraint from the world
 *
 * @method removeConstraint
 * @param constraint {Goblin.Constraint} constraint to be removed
 */
Goblin.World.prototype.removeConstraint = function( constraint ) {
	this.solver.removeConstraint( constraint );
};

(function(){
	var tSort = function( a, b ) {
		if ( a.t < b.t ) {
			return -1;
		} else if ( a.t > b.t ) {
			return 1;
		} else {
			return 0;
		}
	};

	/**
	 * Checks if a ray segment intersects with objects in the world
	 *
	 * @method rayIntersect
	 * @property start {vec3} start point of the segment
	 * @property end {vec3{ end point of the segment
	 * @return {Array<RayIntersection>} an array of intersections, sorted by distance from `start`
	 */
	Goblin.World.prototype.rayIntersect = function( start, end ) {
		var intersections = this.broadphase.rayIntersect( start, end );
		intersections.sort( tSort );
		return intersections;
	};

	Goblin.World.prototype.shapeIntersect = function( shape, start, end ){
		var swept_shape = new Goblin.LineSweptShape( start, end, shape ),
			swept_body = new Goblin.RigidBody( swept_shape, 0 );
		swept_body.updateDerived();

		// broadphase tracks only bodies added to the world; swept_body is transient, so scan directly
		var possibilities = [];
		for ( var pi = 0; pi < this.rigid_bodies.length; pi++ ) {
			var candidate = this.rigid_bodies[ pi ];
			if ( candidate === swept_body ) { continue; }
			if ( swept_body.aabb.intersects( candidate.aabb ) ) { possibilities.push( candidate ); }
		}

		var intersections = [];

		// Turn one ContactDetails into a RayIntersection. `hitBody` is the non-swept world body this
		// contact is against; normalize so intersection.object is that body and the normal points the
		// same way the direct-return path does (as if hitBody were object_b). MeshShape/CompoundShape
		// paths emit contacts with hitBody as object_a, so flip the normal in that case.
		var self = this;
		function pushIntersection( contact, hitBody ) {
			var flip = ( contact.object_a === hitBody );
			var nx = flip ? -contact.contact_normal.x : contact.contact_normal.x;
			var ny = flip ? -contact.contact_normal.y : contact.contact_normal.y;
			var nz = flip ? -contact.contact_normal.z : contact.contact_normal.z;

			var intersection = Goblin.ObjectPool.getObject( 'RayIntersection' );
			intersection.object = hitBody;
			intersection.normal.set( nx, ny, nz );
			intersection.penetration = contact.penetration_depth; // expose depth for depenetration

			intersection.point.scaleVector( intersection.normal, -contact.penetration_depth );
			intersection.point.add( contact.contact_point );

			intersection.t = intersection.point.distanceTo( start );
			intersections.push( intersection );
		}

		// MeshShape/CompoundShape don't RETURN a contact from getContact — they route contacts through
		// narrowphase.addContact instead (built for the solver's manifolds). A swept query against a mesh
		// would otherwise see nothing, so a swept body would pass through static meshes undetected. So
		// intercept addContact for the duration of each getContact call below and collect whatever it
		// emits, alongside the direct return used by primitive-vs-primitive. Declared once outside the
		// loop (not a fresh closure per iteration) and reset via `captured.length = 0` each pass.
		var captured = [];
		var origAddContact = this.narrowphase.addContact;
		this.narrowphase.addContact = function ( object_a, object_b, contact ) {
			captured.push( contact );
			// Do NOT forward to the real solver manifold — this is a transient query, not a sim step.
		};

		try {
			for ( var i = 0; i < possibilities.length; i++ ) {
				var target = possibilities[i];

				captured.length = 0;
				var contact = this.narrowphase.getContact( swept_body, target );

				if ( contact != null ) {
					pushIntersection( contact, target );
				}
				for ( var ci = 0; ci < captured.length; ci++ ) {
					pushIntersection( captured[ci], target );
				}
			}
		} finally {
			this.narrowphase.addContact = origAddContact;
		}

		intersections.sort( tSort );
		return intersections;
	};
})();
	if ( typeof window !== 'undefined' ) window.Goblin = Goblin;
	if ( typeof self !== 'undefined' ) self.Goblin = Goblin;
	if ( typeof module !== 'undefined' ) module.exports = Goblin;
})();
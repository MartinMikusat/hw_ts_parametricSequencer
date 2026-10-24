/**
 * Quaternion helper functions. Plain objects {x, y, z, w} only; no classes.
 */

export type type_quat = { x: number; y: number; z: number; w: number };

/** Euler angles {x, y, z} in radians. */
export type type_euler = { x: number; y: number; z: number };

export type EulerOrder = 'XYZ' | 'YZX' | 'ZXY' | 'XZY' | 'YXZ' | 'ZYX';

/**
 * Creates quaternion from Euler angles in radians.
 */
export function quat_fromEuler(
	x: number,
	y: number,
	z: number,
	order: EulerOrder = 'XYZ'
): type_quat {
	const c1 = Math.cos(x / 2);
	const c2 = Math.cos(y / 2);
	const c3 = Math.cos(z / 2);
	const s1 = Math.sin(x / 2);
	const s2 = Math.sin(y / 2);
	const s3 = Math.sin(z / 2);

	let qx: number;
	let qy: number;
	let qz: number;
	let qw: number;

	switch (order) {
		case 'XYZ':
			qx = s1 * c2 * c3 + c1 * s2 * s3;
			qy = c1 * s2 * c3 - s1 * c2 * s3;
			qz = c1 * c2 * s3 + s1 * s2 * c3;
			qw = c1 * c2 * c3 - s1 * s2 * s3;
			break;
		case 'YXZ':
			qx = s1 * c2 * c3 + c1 * s2 * s3;
			qy = c1 * s2 * c3 - s1 * c2 * s3;
			qz = c1 * c2 * s3 - s1 * s2 * c3;
			qw = c1 * c2 * c3 + s1 * s2 * s3;
			break;
		case 'ZXY':
			qx = s1 * c2 * c3 - c1 * s2 * s3;
			qy = c1 * s2 * c3 + s1 * c2 * s3;
			qz = c1 * c2 * s3 + s1 * s2 * c3;
			qw = c1 * c2 * c3 - s1 * s2 * s3;
			break;
		case 'ZYX':
			qx = s1 * c2 * c3 - c1 * s2 * s3;
			qy = c1 * s2 * c3 + s1 * c2 * s3;
			qz = c1 * c2 * s3 - s1 * s2 * c3;
			qw = c1 * c2 * c3 + s1 * s2 * s3;
			break;
		case 'YZX':
			qx = s1 * c2 * c3 + c1 * s2 * s3;
			qy = c1 * s2 * c3 + s1 * c2 * s3;
			qz = c1 * c2 * s3 - s1 * s2 * c3;
			qw = c1 * c2 * c3 - s1 * s2 * s3;
			break;
		case 'XZY':
			qx = s1 * c2 * c3 - c1 * s2 * s3;
			qy = c1 * s2 * c3 - s1 * c2 * s3;
			qz = c1 * c2 * s3 + s1 * s2 * c3;
			qw = c1 * c2 * c3 + s1 * s2 * s3;
			break;
		default:
			qx = s1 * c2 * c3 + c1 * s2 * s3;
			qy = c1 * s2 * c3 - s1 * c2 * s3;
			qz = c1 * c2 * s3 + s1 * s2 * c3;
			qw = c1 * c2 * c3 - s1 * s2 * s3;
	}
	return { x: qx, y: qy, z: qz, w: qw };
}

/**
 * Spherical linear interpolation. t=0 returns a, t=1 returns b.
 */
export function quat_slerp(a: type_quat, b: type_quat, t: number): type_quat {
	if (t === 0) return { ...a };
	if (t === 1) return { ...b };

	let qb = b;
	let cosHalfTheta = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;

	if (cosHalfTheta < 0) {
		qb = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
		cosHalfTheta = -cosHalfTheta;
	}

	if (cosHalfTheta >= 1.0) {
		return { ...a };
	}

	const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

	if (Math.abs(sinHalfTheta) < 0.001) {
		return {
			x: 0.5 * (a.x + qb.x),
			y: 0.5 * (a.y + qb.y),
			z: 0.5 * (a.z + qb.z),
			w: 0.5 * (a.w + qb.w)
		};
	}

	const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
	const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
	const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

	return {
		x: a.x * ratioA + qb.x * ratioB,
		y: a.y * ratioA + qb.y * ratioB,
		z: a.z * ratioA + qb.z * ratioB,
		w: a.w * ratioA + qb.w * ratioB
	};
}

/**
 * Multiplies quaternions. Result = a * b (apply b after a).
 */
export function quat_multiply(a: type_quat, b: type_quat): type_quat {
	const qax = a.x;
	const qay = a.y;
	const qaz = a.z;
	const qaw = a.w;
	const qbx = b.x;
	const qby = b.y;
	const qbz = b.z;
	const qbw = b.w;

	return {
		x: qax * qbw + qaw * qbx + qay * qbz - qaz * qby,
		y: qay * qbw + qaw * qby + qaz * qbx - qax * qbz,
		z: qaz * qbw + qaw * qbz + qax * qby - qay * qbx,
		w: qaw * qbw - qax * qbx - qay * qby - qaz * qbz
	};
}

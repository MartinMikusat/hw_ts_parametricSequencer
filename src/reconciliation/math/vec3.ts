/**
 * Vec3 helper functions. Plain objects {x, y, z} only; no classes.
 */

export type type_vec3 = { x: number; y: number; z: number };

/**
 * Normalizes input to {x, y, z}. Accepts {x,y,z} or [x,y,z].
 */
export function vec3_from(v: type_vec3 | [number, number, number]): type_vec3 {
	if (Array.isArray(v)) {
		return { x: v[0], y: v[1], z: v[2] };
	}
	return { x: v.x, y: v.y, z: v.z };
}

/**
 * Component-wise addition. Returns new object.
 */
export function vec3_add(a: type_vec3, b: type_vec3): type_vec3 {
	return {
		x: a.x + b.x,
		y: a.y + b.y,
		z: a.z + b.z
	};
}

/**
 * Linear interpolation between a and b. t=0 returns a, t=1 returns b.
 */
export function vec3_lerp(a: type_vec3, b: type_vec3, t: number): type_vec3 {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		z: a.z + (b.z - a.z) * t
	};
}

/**
 * Rotates vector v by quaternion q. Returns new object.
 */
export function vec3_applyQuaternion(
	v: type_vec3,
	q: { x: number; y: number; z: number; w: number }
): type_vec3 {
	const x = v.x;
	const y = v.y;
	const z = v.z;
	const qx = q.x;
	const qy = q.y;
	const qz = q.z;
	const qw = q.w;

	const ix = qw * x + qy * z - qz * y;
	const iy = qw * y + qz * x - qx * z;
	const iz = qw * z + qx * y - qy * x;
	const iw = -qx * x - qy * y - qz * z;

	return {
		x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
		y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
		z: iz * qw + iw * -qz + ix * -qy - iy * -qx
	};
}

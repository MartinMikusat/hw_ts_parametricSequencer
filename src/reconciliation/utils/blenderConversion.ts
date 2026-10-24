import { quat_fromEuler } from '../math';

/**
 * Converts a position from Blender's coordinate system to the library's coordinate system.
 *
 * Blender uses a different coordinate system (Y-up, Z-forward) compared to many 3D engines.
 * This function converts Blender coordinates (x, y, z) to library coordinates.
 *
 * @param x - X coordinate in Blender space.
 * @param y - Y coordinate in Blender space.
 * @param z - Z coordinate in Blender space.
 * @returns An object with converted x, y, z coordinates.
 *
 * @remarks
 * Conversion: (x, y, z) → (x, z, -y)
 */
export const generatePositionFromBlender = (x: number, y: number, z: number) => {
	return {
		x,
		y: z,
		z: -y
	};
};

/**
 * Converts a position from Blender's coordinate system to an array format.
 *
 * @param x - X coordinate in Blender space.
 * @param y - Y coordinate in Blender space.
 * @param z - Z coordinate in Blender space.
 * @returns A tuple [x, z, -y] representing the converted position.
 */
export const generatePositionFromBlenderArray = (
	x: number,
	y: number,
	z: number
): [number, number, number] => {
	return [x, z, -y];
};

/**
 * Converts a rotation from Blender's coordinate system to the library's coordinate system.
 *
 * Returns rotation angles in degrees (matching the library's public API contract).
 *
 * @param x - X rotation in Blender space (degrees).
 * @param y - Y rotation in Blender space (degrees).
 * @param z - Z rotation in Blender space (degrees).
 * @returns An object with converted x, y, z rotation angles in degrees.
 *
 * @remarks
 * Conversion: (x, y, z) → (x, z, -y)
 */
export const generateRotationFromBlender = (
	x: number,
	y: number,
	z: number
): {
	x: number;
	y: number;
	z: number;
} => {
	// Return DEGREES to align with the library-wide contract
	return {
		x,
		y: z,
		z: -y
	};
};

/**
 * Converts a rotation from Blender's coordinate system to an array format.
 *
 * @param x - X rotation in Blender space (degrees).
 * @param y - Y rotation in Blender space (degrees).
 * @param z - Z rotation in Blender space (degrees).
 * @returns A tuple [x, z, -y] representing the converted rotation in degrees.
 */
export const generateRotationFromBlenderArray = (
	x: number,
	y: number,
	z: number
): [number, number, number] => {
	return [x, z, -y];
};

/**
 * Converts a rotation from Blender's coordinate system to an array format (degrees).
 *
 * Alias for generateRotationFromBlenderArray for clarity.
 *
 * @param x - X rotation in Blender space (degrees).
 * @param y - Y rotation in Blender space (degrees).
 * @param z - Z rotation in Blender space (degrees).
 * @returns A tuple [x, z, -y] representing the converted rotation in degrees.
 */
export const generateRotationFromBlenderArrayDegrees = (
	x: number,
	y: number,
	z: number
): [number, number, number] => {
	return [x, z, -y];
};

/**
 * Converts a quaternion from Blender's format to the library's format.
 *
 * Blender stores quaternions as (w, x, y, z), while the library uses (x, y, z, w).
 *
 * @param w - W component in Blender format.
 * @param x - X component in Blender format.
 * @param y - Y component in Blender format.
 * @param z - Z component in Blender format.
 * @returns A tuple [x, y, z, w] in library format.
 */
export const generateQuaternionFromBlenderArray = (
	w: number,
	x: number,
	y: number,
	z: number
): [number, number, number, number] => {
	return [x, y, z, w];
};

/**
 * Creates a quaternion from Blender Euler angles.
 *
 * Converts Blender Euler angles (in degrees) to a quaternion (plain object),
 * applying the necessary coordinate system conversion.
 *
 * @param rotation - Tuple [x, y, z] representing Euler angles in degrees in Blender space.
 * @returns A quaternion { x, y, z, w } representing the rotation.
 *
 * @example
 * ```typescript
 * const quat = quaternionFromBlenderEulerAngles([90, 0, 0]);
 * ```
 */
export const quaternionFromBlenderEulerAngles = (
	rotation: [number, number, number]
): { x: number; y: number; z: number; w: number } => {
	const [rx, ry, rz] = generateRotationFromBlenderArrayDegrees(...rotation);
	const xRad = (rx * Math.PI) / 180;
	const yRad = (ry * Math.PI) / 180;
	const zRad = (rz * Math.PI) / 180;
	return quat_fromEuler(xRad, yRad, zRad);
};

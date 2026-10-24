import {
	vec3_from,
	vec3_add,
	vec3_lerp,
	vec3_applyQuaternion,
	quat_fromEuler,
	quat_slerp,
	quat_multiply
} from '../math';
import type { type_vec3, type_quat } from '../math';
import type {
	type_keyframes_reconciledTimeExtended_camera,
	type_keyframes_reconciledTimeExtended_model,
	type_keyframes_reconciledTimeExtended_light
} from '../keyframes/02_reconcileKeyframes_expandTime';
import type {
	type_separatedKeyframes_extended,
	type_keyframe_camera,
	type_keyframe_camera_spring,
	type_keyframe_model,
	type_keyframe_material,
	type_keyframe_light,
	type_lightConfig,
	type_customProperty_interpolation,
	type_keyframe_easing,
	type_transparency_mode
} from '../keyframes/types';
import type { type_scene_zeroCamera } from '../../types/types_sceneObjects';
import { CONST_DEFAULT_SCENE_ZERO_CAMERA } from '../../const_parametricSequencer';
import type {
	type_marker_position_value,
	type_sceneObject_marker
} from '../types/types_sceneModel';
import { reconciliation_baselineCameraFromZero } from './reconciliation_baselineCameraFromZero';
import {
	helper_easing_ease,
	helper_easing_easeIn,
	helper_easing_easeInOut,
	helper_easing_easeOut,
	helper_easing_linear
} from '../../helper_easing_bezier';
import { reconcileGltfAnimationForObject } from './reconcile_gltfAnimation';

// Constant for float comparisons
const EPSILON = 1e-6;

/** Degrees to radians. Keyframe rotation values use degrees. */
const DEG2RAD = Math.PI / 180;

/**
 * Represents the animation state of a single 3D model at a specific point in time.
 *
 * @remarks
 * This state is calculated by interpolating between keyframes based on the current time.
 * All values are interpolated smoothly using linear interpolation for positions/opacity/custom properties
 * and spherical linear interpolation (SLERP) for rotations.
 */
export interface ModelAnimationState3D {
	/**
	 * The opacity of the model, ranging from 0 (fully transparent) to 1 (fully opaque).
	 * Defaults to 1 if not specified in any keyframe.
	 */
	opacity: number;

	/** True when pointer picking can resolve this model. */
	pickable: boolean;

	/** The requested transparency algorithm. */
	transparencyMode: type_transparency_mode;

	/**
	 * Material properties interpolated from keyframes.
	 * Includes color (RGB), emissive (RGB + intensity), roughness, metalness, envMapIntensity.
	 */
	material?: type_keyframe_material;

	/**
	 * The 3D position of the model in world space.
	 * This is the interpolated position based on position keyframes.
	 */
	position: type_vec3;

	/**
	 * The rotation of the model as a quaternion.
	 * This is interpolated using SLERP for smooth rotation transitions.
	 */
	rotation: type_quat;

	/**
	 * The cumulative rotation of the model, including all relative rotations.
	 * This is used internally for marker-based positioning calculations.
	 *
	 * @internal
	 */
	cumulativeModelRotation: type_quat;

	/**
	 * Custom animated properties defined by the user.
	 * Each property is interpolated according to its specified interpolation method (linear or step).
	 * Properties persist across keyframes until explicitly changed.
	 *
	 * @example
	 * ```typescript
	 * // Access custom properties from animation state
	 * const brightness = modelState.custom.brightness ?? 1.0;
	 * const intensity = modelState.custom.intensity ?? 0.5;
	 * ```
	 */
	custom: Record<string, number>;

	/**
	 * Parent sceneObjectID when position is from a marker. Used for opacity inheritance.
	 * When set, model opacity is multiplied by parent opacity.
	 * @internal
	 */
	markerParentID?: string;

	/**
	 * Active GLTF clip name from reconciliation, or null when none.
	 */
	gltfClip: string | null;

	/**
	 * Normalized GLTF animation progress 0–1. Maps to clip time at runtime.
	 */
	gltfProgress: number;
}

/**
 * Represents the animation state of the camera at a specific point in time.
 *
 * @remarks
 * The camera state controls the viewport transformation in 3D space.
 * All values are interpolated linearly between keyframes.
 */
export interface CameraAnimationState3D {
	/**
	 * The rotation angle around the X-axis in degrees.
	 * Positive values rotate upward (pitch).
	 *
	 * @defaultValue 0
	 */
	rotationX: number;

	/**
	 * The rotation angle around the Y-axis in degrees.
	 * Positive values rotate to the right (yaw).
	 *
	 * @defaultValue 0
	 */
	rotationY: number;

	/**
	 * The target point that the camera is looking at in 3D space.
	 * This is the center point of the camera's view.
	 *
	 * @defaultValue { x: 0, y: 0, z: 0 }
	 */
	target: type_vec3;

	/**
	 * The zoom level of the camera.
	 * Values greater than 1 zoom in, values less than 1 zoom out.
	 *
	 * @defaultValue 1.0
	 */
	zoom: number;

	/** Optional spring config for camera transition (from target keyframe). */
	spring?: type_keyframe_camera_spring;
}

/**
 * Represents the animation state of a single light at a specific point in time.
 * Same model as camera: target + rotationX + rotationY + zoom.
 */
export interface LightAnimationState3D {
	target: type_vec3;
	rotationX: number;
	rotationY: number;
	zoom: number;
	width: number;
	height: number;
	intensity: number;
	color: string;
	shadowBias: number;
	shadowNormalBias: number;
}

/**
 * Complete animation state snapshot at a specific point in time.
 *
 * Contains the interpolated state of all models and the camera for a given time.
 * This is the primary output of the animation system and is used to update
 * the visual representation of the scene.
 *
 * @example
 * ```typescript
 * const snapshot = sequencer.getAnimationState();
 * if (snapshot) {
 *   // Update all models
 *   snapshot.models.forEach((modelState, modelID) => {
 *     updateModel(modelID, {
 *       position: modelState.position,
 *       rotation: modelState.rotation,
 *       opacity: modelState.opacity,
 *       brightness: modelState.custom.brightness ?? 1.0
 *     });
 *   });
 *
 *   // Update camera
 *   updateCamera({
 *     rotationX: snapshot.camera.rotationX,
 *     rotationY: snapshot.camera.rotationY,
 *     target: snapshot.camera.target,
 *     zoom: snapshot.camera.zoom
 *   });
 * }
 * ```
 */
export interface AnimationSnapshot3D {
	/**
	 * Map of all model states, keyed by sceneObjectID.
	 * Only objects that have been referenced in the scene definition are included.
	 */
	models: Map<string, ModelAnimationState3D>;

	/**
	 * The current camera state.
	 * Always present, defaults to initial values if no camera keyframes exist.
	 */
	camera: CameraAnimationState3D;

	/**
	 * Map of light states keyed by lightId.
	 * Present when scene defines lights and lightKeyframes; empty Map otherwise.
	 */
	lights: Map<string, LightAnimationState3D>;
}

/**
 * Resolves camera baseline from scene zeroCamera or code default.
 * Motivation: per-scene framing before the first camera keyframe without hardcoding in callers.
 */
export function reconciliation_resolveCameraBaseline(
	zeroCamera?: type_scene_zeroCamera
): CameraAnimationState3D {
	if (zeroCamera) {
		return reconciliation_baselineCameraFromZero(zeroCamera);
	}
	return reconciliation_baselineCameraFromZero(CONST_DEFAULT_SCENE_ZERO_CAMERA);
}

/**
 * Simple linear interpolation between two values
 */
const lerp = (start: number, end: number, t: number): number => {
	return start + (end - start) * t;
};

/**
 * Returns the easing function for a keyframe. When easing is undefined or 'ease', uses cubic (CSS ease) as default.
 */
function getEasingFn(easing?: type_keyframe_easing): (x: number) => number {
	switch (easing) {
		case 'linear':
			return helper_easing_linear;
		case 'ease-in':
			return helper_easing_easeIn;
		case 'ease-out':
			return helper_easing_easeOut;
		case 'ease-in-out':
			return helper_easing_easeInOut;
		case 'ease':
		default:
			return helper_easing_ease;
	}
}

/**
 * Interpolates a custom property value based on the specified interpolation method.
 *
 * @param previousValue The current value of the property
 * @param targetValue The target value to interpolate towards
 * @param progression The interpolation progress (0 to 1)
 * @param interpolation The interpolation method to use ('linear' or 'step')
 * @returns The interpolated value
 *
 * @remarks
 * - 'linear': Smoothly interpolates between previous and target values
 * - 'step': Returns previous value until progression reaches 1.0, then returns target value
 *
 * @internal
 */
const interpolateCustomProperty = (
	previousValue: number,
	targetValue: number,
	progression: number,
	interpolation: type_customProperty_interpolation = 'linear'
): number => {
	if (interpolation === 'step') {
		return progression >= 1.0 ? targetValue : previousValue;
	}
	// linear (default)
	return lerp(previousValue, targetValue, progression);
};

/**
 * Creates type_vec3 from either an array or an object with x, y, z properties.
 */
const createVec3FromInput = (input: type_vec3 | [number, number, number]): type_vec3 => {
	return vec3_from(input);
};

/**
 * Creates quaternion from rotation values. Expects degrees for keyframe values.
 */
const createQuatFromEulerDegrees = (
	rotValues: number[] | { x: number; y: number; z: number }
): type_quat => {
	const { x, y, z } = Array.isArray(rotValues)
		? { x: Number(rotValues[0]), y: Number(rotValues[1]), z: Number(rotValues[2]) }
		: rotValues;
	const xRad = x * DEG2RAD;
	const yRad = y * DEG2RAD;
	const zRad = z * DEG2RAD;
	return quat_fromEuler(xRad, yRad, zRad);
};

/**
 * Creates quaternion from Euler in radians (e.g. marker rotation from loadSceneFromJson).
 */
const createQuatFromEulerRadians = (e: { x: number; y: number; z: number }): type_quat => {
	return quat_fromEuler(e.x, e.y, e.z);
};

/**
 * Helper to get string ID from sceneObject
 */
const getObjectIDFromKeyframe = (modelKeyframe: type_keyframe_model): string => {
	if (modelKeyframe.sceneObject && modelKeyframe.sceneObject.sceneObjectID) {
		return modelKeyframe.sceneObject.sceneObjectID;
	}
	throw new Error(
		`Cannot determine SceneObject ID from keyframe. ` +
			`This indicates a bug in the keyframe structure or type definitions.`
	);
};

/**
 * Helper to convert keyframe camera state to local CameraAnimationState3D.
 * Includes spring config from keyframe when present.
 */
const cameraStateFromKeyframe = (keyframe: type_keyframe_camera): CameraAnimationState3D => {
	const state: CameraAnimationState3D = {
		rotationX: keyframe.rotationX,
		rotationY: keyframe.rotationY,
		target: createVec3FromInput(keyframe.target),
		zoom: keyframe.zoom
	};
	if (keyframe.spring) {
		state.spring = keyframe.spring;
	}
	return state;
};

/**
 * Processes rotation based on type (absolute, relative, worldSpace)
 */
const processRotation = (
	rotationInfo: { type: string; value: { x: number; y: number; z: number } },
	previousRotation: type_quat,
	previousCumulativeRotation: type_quat,
	progression: number
): { nextRotation: type_quat; nextCumulativeRotation: type_quat } => {
	let targetRotation: type_quat;
	let targetCumulative: type_quat;
	let nextRotation: type_quat;
	let nextCumulativeRotation: type_quat;

	switch (rotationInfo.type) {
		case 'absolute': {
			const baseQuat = createQuatFromEulerDegrees(rotationInfo.value);
			targetRotation = baseQuat;
			targetCumulative = baseQuat;
			nextRotation = quat_slerp(previousRotation, targetRotation, progression);
			nextCumulativeRotation = quat_slerp(
				previousCumulativeRotation,
				targetCumulative,
				progression
			);
			break;
		}
		case 'relative': {
			const relativeQuat = createQuatFromEulerDegrees(rotationInfo.value);
			targetRotation = quat_multiply(previousRotation, relativeQuat);
			targetCumulative = quat_multiply(previousCumulativeRotation, relativeQuat);
			nextRotation = quat_slerp(previousRotation, targetRotation, progression);
			nextCumulativeRotation = quat_slerp(
				previousCumulativeRotation,
				targetCumulative,
				progression
			);
			break;
		}
		case 'worldSpace': {
			const worldQuat = createQuatFromEulerDegrees(rotationInfo.value);
			targetRotation = quat_multiply(worldQuat, previousRotation);
			targetCumulative = { ...previousCumulativeRotation };
			nextRotation = quat_slerp(previousRotation, targetRotation, progression);
			nextCumulativeRotation = targetCumulative;
			break;
		}
		default:
			return { nextRotation: previousRotation, nextCumulativeRotation: previousCumulativeRotation };
	}

	return { nextRotation, nextCumulativeRotation };
};

/**
 * Processes position based on type (absolute, relative)
 */
const processPosition = (
	positionInfo: { type: string; value: type_vec3 },
	previousPosition: type_vec3,
	progression: number
): type_vec3 => {
	let targetPosition: type_vec3;

	switch (positionInfo.type) {
		case 'relative': {
			const relativeMove = createVec3FromInput(positionInfo.value);
			targetPosition = vec3_add(previousPosition, relativeMove);
			break;
		}
		case 'absolute': {
			targetPosition = createVec3FromInput(positionInfo.value);
			break;
		}
		default:
			return { ...previousPosition };
	}

	return vec3_lerp(previousPosition, targetPosition, progression);
};

/**
 * Resolves the marker definition for marker-based positioning.
 */
const _getMarkerDefinition = (markerData: type_marker_position_value): type_sceneObject_marker => {
	const marker = markerData.parent.markers[markerData.markerID];
	if (!marker) {
		throw new Error(
			`Marker ${markerData.markerID} not found on parent ${markerData.parent.sceneObjectID}`
		);
	}
	return marker;
};

/**
 * Marker orientation in parent local space (marker rotation × optional rotationOffset).
 */
const _markerBaseQuaternion = (markerData: type_marker_position_value): type_quat => {
	const marker = _getMarkerDefinition(markerData);
	let markerBaseQuat = createQuatFromEulerRadians(marker.rotation);
	if (markerData.rotationOffset) {
		const rotOffQuat = createQuatFromEulerRadians(markerData.rotationOffset);
		markerBaseQuat = quat_multiply(markerBaseQuat, rotOffQuat);
	}
	return markerBaseQuat;
};

/**
 * Applies marker-derived rotation using the same accumulation pattern as `processRotation`:
 * each step slerps from the accumulated rotation toward a target orientation.
 * Target is parent cumulative rotation × marker orientation (relative in parent space).
 */
const processMarkerRotation = (
	markerData: type_marker_position_value,
	parentState: ModelAnimationState3D,
	previousRotation: type_quat,
	previousCumulativeRotation: type_quat,
	progression: number
): { nextRotation: type_quat; nextCumulativeRotation: type_quat } => {
	const markerBaseQuat = _markerBaseQuaternion(markerData);
	const targetRotation = quat_multiply(parentState.cumulativeModelRotation, markerBaseQuat);
	const targetCumulative = targetRotation;
	return {
		nextRotation: quat_slerp(previousRotation, targetRotation, progression),
		nextCumulativeRotation: quat_slerp(previousCumulativeRotation, targetCumulative, progression)
	};
};

/**
 * Calculates world position and inherited opacity for a model attached to a marker.
 * Rotation is handled separately via `processMarkerRotation` so it chains with explicit rotation keyframes.
 */
const _calculateMarkerPositionAndOpacity = (
	markerData: type_marker_position_value,
	parentState: ModelAnimationState3D,
	previousPosition: type_vec3,
	childOpacity: number,
	progression: number
): { finalPosition: type_vec3; finalOpacity: number } => {
	const marker = _getMarkerDefinition(markerData);
	const parentPosition = parentState.position;
	const parentRotation = parentState.cumulativeModelRotation;
	const parentOpacity = parentState.opacity;

	// Effective marker position in parent local space (offset in marker local space if present)
	let markerPosInParent = marker.position;
	if (markerData.offset) {
		const markerQuat = createQuatFromEulerRadians(marker.rotation);
		const offsetInParent = vec3_applyQuaternion(markerData.offset, markerQuat);
		markerPosInParent = vec3_add(marker.position, offsetInParent);
	}
	const markerWorldOffset = vec3_applyQuaternion(markerPosInParent, parentRotation);
	const endPositionWorld = vec3_add(parentPosition, markerWorldOffset);
	const finalPosition = vec3_lerp(previousPosition, endPositionWorld, progression);
	const finalOpacity = childOpacity * parentOpacity;

	return { finalPosition, finalOpacity };
};

/**
 * Reconciles the state of all models based on typed model keyframes and current time.
 */
const _reconcileModelStates = (
	keyframes: Array<type_keyframes_reconciledTimeExtended_model>,
	currentTime: number
): Map<string, ModelAnimationState3D> => {
	const modelStates = new Map<string, ModelAnimationState3D>();
	const interactionStateAtTime = new Map<
		string,
		{ pickable?: boolean; transparencyMode?: type_transparency_mode }
	>();
	for (const extendedKeyframe of keyframes) {
		const sceneObjectID = getObjectIDFromKeyframe(extendedKeyframe.keyframe);
		const key = `${sceneObjectID}:${extendedKeyframe.reconciled.startTime}`;
		const previous = interactionStateAtTime.get(key);
		const current = extendedKeyframe.keyframe;
		if (
			previous &&
			((previous.pickable !== undefined &&
				current.pickable !== undefined &&
				previous.pickable !== current.pickable) ||
				(previous.transparencyMode !== undefined &&
					current.transparencyMode !== undefined &&
					previous.transparencyMode !== current.transparencyMode))
		) {
			throw new Error(
				`Conflicting pick or transparency state for ${sceneObjectID} at the same time`
			);
		}
		interactionStateAtTime.set(key, {
			pickable: current.pickable ?? previous?.pickable,
			transparencyMode: current.transparencyMode ?? previous?.transparencyMode
		});
	}

	// --- Model State Initialization ---
	const identityQuat: type_quat = { x: 0, y: 0, z: 0, w: 1 };
	keyframes.forEach((extendedKeyframe) => {
		const modelKeyframe = extendedKeyframe.keyframe;
		const sceneObjectID = getObjectIDFromKeyframe(modelKeyframe);
		if (!modelStates.has(sceneObjectID)) {
			modelStates.set(sceneObjectID, {
				opacity: 0.0,
				pickable: true,
				transparencyMode: 'auto',
				position: { x: 0, y: 0, z: 0 },
				rotation: identityQuat,
				cumulativeModelRotation: identityQuat,
				custom: {},
				gltfClip: null,
				gltfProgress: 0
			});
		}
	});

	// --- Model Reconciliation Loop ---
	keyframes.forEach((extendedKeyframe) => {
		const modelKeyframe = extendedKeyframe.keyframe;
		const timeStart = extendedKeyframe.reconciled.startTime;
		const timeEnd = extendedKeyframe.extended.endTime;
		const duration = timeEnd - timeStart;
		const sceneObjectID = getObjectIDFromKeyframe(modelKeyframe);
		const previousState = modelStates.get(sceneObjectID);

		if (!previousState) {
			throw new Error(
				`Model state not found during reconciliation for ID: ${sceneObjectID}. ` +
					`This indicates a bug in the reconciliation pipeline - all models must be initialized before processing their keyframes.`
			);
		}

		const currentKeyframeTime = currentTime - timeStart;
		const keyframeProgression = duration <= EPSILON ? 1.0 : currentKeyframeTime / duration;
		const clampedKeyframeProgression = Math.min(Math.max(keyframeProgression, 0.0), 1.0);
		const easingFn = getEasingFn(modelKeyframe.easing);
		const easedProgression = easingFn(clampedKeyframeProgression);

		// --- Calculate Next State Values (Opacity, Material, Rotation) ---
		let nextOpacity = previousState.opacity;
		if (modelKeyframe.opacity !== undefined && modelKeyframe.opacity !== null) {
			nextOpacity = lerp(previousState.opacity, modelKeyframe.opacity, easedProgression);
		}

		let nextMaterial: type_keyframe_material | undefined = previousState.material;
		if (modelKeyframe.material && Object.keys(modelKeyframe.material).length > 0) {
			const prev = previousState.material;
			const target = modelKeyframe.material;
			const t = easedProgression;
			const lerpNum = (a: number, b: number) => (prev !== undefined ? lerp(a, b, t) : b);
			const base: type_keyframe_material = prev ?? {
				roughness: target.roughness ?? 0.5,
				metalness: target.metalness ?? 0.5,
				colorR: target.colorR ?? 128,
				colorG: target.colorG ?? 128,
				colorB: target.colorB ?? 128,
				emissiveR: target.emissiveR ?? 255,
				emissiveG: target.emissiveG ?? 255,
				emissiveB: target.emissiveB ?? 255,
				emissiveIntensity: target.emissiveIntensity ?? 0,
				envMapIntensity: target.envMapIntensity ?? 1
			};
			nextMaterial = { ...base };
			const rgbKeys = new Set<keyof type_keyframe_material>([
				'colorR',
				'colorG',
				'colorB',
				'emissiveR',
				'emissiveG',
				'emissiveB'
			]);
			for (const key of Object.keys(target) as (keyof type_keyframe_material)[]) {
				const targetVal = target[key];
				if (targetVal === undefined) continue;
				const prevVal = base[key] ?? targetVal;
				nextMaterial[key] = rgbKeys.has(key)
					? Math.round(lerpNum(prevVal, targetVal))
					: lerpNum(prevVal, targetVal);
			}
		}

		// --- Process Custom Properties ---
		const nextCustom = { ...previousState.custom };
		if (modelKeyframe.custom) {
			Object.entries(modelKeyframe.custom).forEach(([key, definition]) => {
				const previousValue = previousState.custom[key] ?? 0; // Default to 0 if not set
				const targetValue = definition.value;
				const interpolation = definition.interpolation ?? 'linear';
				nextCustom[key] = interpolateCustomProperty(
					previousValue,
					targetValue,
					easedProgression,
					interpolation
				);
			});
		}

		// --- Rotation: marker orientation then explicit rotation (same accumulation as overlapping keyframes) ---
		let workingRotation: type_quat = { ...previousState.rotation };
		let workingCumulativeRotation: type_quat = { ...previousState.cumulativeModelRotation };

		// --- Calculate Final Position, considering Markers ---
		let finalPosition: type_vec3 = { ...previousState.position };
		let finalOpacity = nextOpacity;
		let nextMarkerParentID: string | undefined;

		if (modelKeyframe.position) {
			const positionInfo = modelKeyframe.position;

			if (positionInfo.type === 'marker') {
				const keyframeMarkerData = positionInfo.value;
				const parentSceneObjectID = keyframeMarkerData.parent.sceneObjectID;
				const parentState = modelStates.get(parentSceneObjectID);

				if (!parentState) {
					throw new Error(
						`Parent model not found for marker positioning. ` +
							`This indicates a bug in the scene definition - parent models must be processed before children that depend on them.`
					);
				}

				const markerPosition = _calculateMarkerPositionAndOpacity(
					keyframeMarkerData,
					parentState,
					previousState.position,
					nextOpacity,
					easedProgression
				);
				finalPosition = markerPosition.finalPosition;
				finalOpacity = markerPosition.finalOpacity;
				nextMarkerParentID = parentSceneObjectID;

				const markerRotation = processMarkerRotation(
					keyframeMarkerData,
					parentState,
					workingRotation,
					workingCumulativeRotation,
					easedProgression
				);
				workingRotation = markerRotation.nextRotation;
				workingCumulativeRotation = markerRotation.nextCumulativeRotation;
			} else {
				// Handle absolute and relative positions
				finalPosition = processPosition(positionInfo, previousState.position, easedProgression);
				nextMarkerParentID = undefined;
			}
		} else {
			// No position in keyframe: keep marker parent from previous state
			nextMarkerParentID = previousState.markerParentID;
			// Apply parent opacity only when keyframe defines opacity (nextOpacity is base from keyframe).
			// When keyframe has no opacity, nextOpacity = previousState.opacity which is already effective.
			if (
				nextMarkerParentID &&
				modelKeyframe.opacity !== undefined &&
				modelKeyframe.opacity !== null
			) {
				const parentState = modelStates.get(nextMarkerParentID);
				if (parentState) {
					finalOpacity *= parentState.opacity;
				}
			}
		}

		if (modelKeyframe.rotation) {
			const rotationResult = processRotation(
				modelKeyframe.rotation,
				workingRotation,
				workingCumulativeRotation,
				easedProgression
			);
			workingRotation = rotationResult.nextRotation;
			workingCumulativeRotation = rotationResult.nextCumulativeRotation;
		}

		const finalRotation = workingRotation;
		const finalCumulativeRotation = workingCumulativeRotation;

		// --- Update State Dictionary ---
		const nextState: ModelAnimationState3D = {
			opacity: finalOpacity,
			pickable:
				currentTime >= timeStart && modelKeyframe.pickable !== undefined
					? modelKeyframe.pickable
					: previousState.pickable,
			transparencyMode:
				currentTime >= timeStart && modelKeyframe.transparencyMode !== undefined
					? modelKeyframe.transparencyMode
					: previousState.transparencyMode,
			material: nextMaterial,
			position: finalPosition,
			rotation: finalRotation,
			cumulativeModelRotation: finalCumulativeRotation,
			custom: nextCustom,
			markerParentID: nextMarkerParentID,
			gltfClip: previousState.gltfClip,
			gltfProgress: previousState.gltfProgress
		};
		modelStates.set(sceneObjectID, nextState);
	});

	for (const sceneObjectID of modelStates.keys()) {
		const gltfState = reconcileGltfAnimationForObject(keyframes, sceneObjectID, currentTime);
		const state = modelStates.get(sceneObjectID);
		if (state) {
			state.gltfClip = gltfState.gltfClip;
			state.gltfProgress = gltfState.gltfProgress;
		}
	}

	return modelStates;
};

/**
 * Reconciles the camera state based on typed camera keyframes and current time.
 * Uses the same accumulation pattern as model keyframes: each keyframe contributes
 * based on its progression within its duration. Overlapping keyframes are blended
 * in order—each keyframe lerps from the accumulated state toward its target.
 */
const _reconcileCameraState = (
	keyframes: Array<type_keyframes_reconciledTimeExtended_camera>,
	currentTime: number,
	baseline: CameraAnimationState3D
): CameraAnimationState3D => {
	const sortedKeyframes = [...keyframes].sort(
		(a, b) => a.reconciled.startTime - b.reconciled.startTime
	);

	if (sortedKeyframes.length === 0) {
		return baseline;
	}

	// Before the first keyframe: use scene zero camera or code default
	if (currentTime < sortedKeyframes[0].reconciled.startTime) {
		return baseline;
	}

	let state: CameraAnimationState3D = { ...baseline };
	let lastSpringKeyframe: type_keyframe_camera | undefined;

	for (const extended of sortedKeyframes) {
		const start = extended.reconciled.startTime;
		const end = extended.extended.endTime;
		const duration = end - start;
		const currentKeyframeTime = currentTime - start;
		/** Duration-0 (instant) keyframes: use progression 1.0 so target fully applies; otherwise base config would show. */
		const progression =
			duration <= EPSILON ? 1.0 : Math.min(Math.max(currentKeyframeTime / duration, 0.0), 1.0);
		const easingFn = getEasingFn(extended.keyframe.easing);
		const easedProgression = easingFn(progression);

		const targetState = cameraStateFromKeyframe(extended.keyframe);

		state = {
			rotationX: lerp(state.rotationX, targetState.rotationX, easedProgression),
			rotationY: lerp(state.rotationY, targetState.rotationY, easedProgression),
			zoom: lerp(state.zoom, targetState.zoom, easedProgression),
			target: vec3_lerp(state.target, targetState.target, easedProgression)
		};

		if (extended.keyframe.spring && progression > 0) {
			lastSpringKeyframe = extended.keyframe;
		}
	}

	if (lastSpringKeyframe?.spring) {
		state.spring = lastSpringKeyframe.spring;
	}

	return state;
};

/**
 * Converts base light config to LightAnimationState3D.
 */
export const reconciliation_lightStateFromConfig = (
	base: type_lightConfig
): LightAnimationState3D => ({
	target: createVec3FromInput(base.target),
	rotationX: base.rotationX,
	rotationY: base.rotationY,
	zoom: base.zoom,
	width: base.width,
	height: base.height,
	intensity: base.intensity,
	color: base.color,
	shadowBias: base.shadowBias ?? -0.0001,
	shadowNormalBias: base.shadowNormalBias ?? 0.02
});

/**
 * Converts light keyframe to target state, merging optional fields from base.
 */
const lightStateFromKeyframe = (
	keyframe: type_keyframe_light,
	base: type_lightConfig
): LightAnimationState3D => ({
	target: createVec3FromInput(keyframe.target),
	rotationX: keyframe.rotationX,
	rotationY: keyframe.rotationY,
	zoom: keyframe.zoom,
	width: keyframe.width ?? base.width,
	height: keyframe.height ?? base.height,
	intensity: keyframe.intensity ?? base.intensity,
	color: keyframe.color ?? base.color,
	shadowBias: keyframe.shadowBias ?? base.shadowBias ?? -0.0001,
	shadowNormalBias: keyframe.shadowNormalBias ?? base.shadowNormalBias ?? 0.02
});

/**
 * Reconciles light states per lightId. Uses same accumulation pattern as camera.
 * Before first keyframe: use base config. After: interpolate from keyframes.
 * @throws Error if any lightKeyframe references a lightId not in baseLights.
 */
const _reconcileLightStates = (
	baseLights: type_lightConfig[],
	keyframes: Array<type_keyframes_reconciledTimeExtended_light>,
	currentTime: number
): Map<string, LightAnimationState3D> => {
	const baseById = new Map(baseLights.map((l) => [l.id, l]));

	const invalidLightIds = [...new Set(keyframes.map((kf) => kf.keyframe.lightId))].filter(
		(id) => !baseById.has(id)
	);
	if (invalidLightIds.length > 0) {
		const validIds = baseLights.map((l) => l.id).join(', ');
		throw new Error(
			`Light keyframe references unknown lightId: ${invalidLightIds.join(', ')}. Valid lightIds: ${validIds}`
		);
	}

	const lightStates = new Map<string, LightAnimationState3D>();

	for (const base of baseLights) {
		const lightKeyframes = keyframes
			.filter((kf) => kf.keyframe.lightId === base.id)
			.sort((a, b) => a.reconciled.startTime - b.reconciled.startTime);

		let state: LightAnimationState3D = reconciliation_lightStateFromConfig(base);

		if (lightKeyframes.length > 0 && currentTime >= lightKeyframes[0].reconciled.startTime) {
			for (const extended of lightKeyframes) {
				const start = extended.reconciled.startTime;
				const end = extended.extended.endTime;
				const duration = end - start;
				const currentKeyframeTime = currentTime - start;
				/** Duration-0 (instant) keyframes: use progression 1.0 so target fully applies; otherwise base config would show. */
				const progression =
					duration <= EPSILON ? 1.0 : Math.min(Math.max(currentKeyframeTime / duration, 0.0), 1.0);
				const easingFn = getEasingFn(extended.keyframe.easing);
				const easedProgression = easingFn(progression);

				const targetState = lightStateFromKeyframe(extended.keyframe, base);

				state = {
					target: vec3_lerp(state.target, targetState.target, easedProgression),
					rotationX: lerp(state.rotationX, targetState.rotationX, easedProgression),
					rotationY: lerp(state.rotationY, targetState.rotationY, easedProgression),
					zoom: lerp(state.zoom, targetState.zoom, easedProgression),
					width: lerp(state.width, targetState.width, easedProgression),
					height: lerp(state.height, targetState.height, easedProgression),
					intensity: lerp(state.intensity, targetState.intensity, easedProgression),
					color: extended.keyframe.color !== undefined ? targetState.color : state.color,
					shadowBias: lerp(state.shadowBias, targetState.shadowBias, easedProgression),
					shadowNormalBias: lerp(
						state.shadowNormalBias,
						targetState.shadowNormalBias,
						easedProgression
					)
				};
			}
		}

		lightStates.set(base.id, state);
	}

	return lightStates;
};

/**
 * Calculates the interpolated animation state for all models and the camera at `currentTime`.
 * Uses the efficient separated keyframe pipeline for optimal performance.
 * @param separatedKeyframes Object containing separated model and camera keyframe arrays.
 * @param currentTime The current time in the animation timeline.
 * @returns An AnimationSnapshot3D containing the state of all models and the camera.
 */
export const reconcile_animationState = (
	separatedKeyframes: type_separatedKeyframes_extended,
	currentTime: number
): AnimationSnapshot3D => {
	const modelStates = _reconcileModelStates(separatedKeyframes.modelKeyframes, currentTime);
	const cameraBaseline = reconciliation_resolveCameraBaseline(separatedKeyframes.zeroCamera);
	const cameraState = _reconcileCameraState(
		separatedKeyframes.cameraKeyframes,
		currentTime,
		cameraBaseline
	);

	const baseLights = separatedKeyframes.lights ?? [];
	const lightStates =
		baseLights.length > 0 && separatedKeyframes.lightKeyframes.length > 0
			? _reconcileLightStates(baseLights, separatedKeyframes.lightKeyframes, currentTime)
			: new Map<string, LightAnimationState3D>();

	return {
		models: modelStates,
		camera: cameraState,
		lights: lightStates
	};
};

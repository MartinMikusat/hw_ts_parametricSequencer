import { reconcileKeyframes } from './keyframes/reconcileKeyframes';
import { keyframes_getSceneDuration } from './keyframes/keyframes_getSceneDuration';
import type {
	type_separatedKeyframes_extended,
	type_sceneDefinition_keyframes
} from './keyframes/types';
import type { SceneObject } from './types/types_sceneModel';

/**
 * Definition of a 3D animation scene as raw keyframes.
 * No Node classes.
 *
 * @example
 * ```typescript
 * const scene: SceneDefinition3D = {
 *   modelKeyframes: [
 *     {
 *       id: 'model1-move',
 *       sceneObject: sceneObject_model1,
 *       time: { type: 'absolute', value: 0 },
 *       duration: 2,
 *       position: { type: 'absolute', value: new Vector3(1, 0, 0) },
 *       chapter: 'intro',
 *     },
 *   ],
 *   cameraKeyframes: [
 *     {
 *       id: 'camera-rotate',
 *       chapter: 'intro',
 *       time: { type: 'relative', value: { offset: 0.5, side: 'Start', parentID: 'model1-move' } },
 *       duration: 1.5,
 *       rotationX: 45,
 *       rotationY: -30,
 *       target: new Vector3(0, 0, 0),
 *       zoom: 1,
 *     },
 *   ],
 * };
 * ```
 */
export type SceneDefinition3D = type_sceneDefinition_keyframes;

/**
 * Result of reconciling a 3D scene definition.
 * Contains the reconciled keyframes, scene objects, and calculated duration.
 */
export interface ReconciledScene3D extends type_separatedKeyframes_extended {
	/** Set of all SceneObject instances referenced in the scene */
	sceneObjects: Set<SceneObject>;
	/** Total duration of the scene in seconds */
	duration: number;
}

/**
 * Reconciles a 3D scene definition and calculates its duration.
 *
 * This is a convenience function that combines `reconcileKeyframes` and
 * `keyframes_getSceneDuration` into a single call. It processes all nodes
 * in the scene, resolves timing dependencies, and prepares the scene for
 * state calculation at any point in time.
 *
 * @param scene - Raw keyframe arrays (modelKeyframes, cameraKeyframes)
 * @returns Reconciled scene with keyframes, scene objects, and duration
 *
 * @remarks
 * The reconciliation process:
 * 1. Resolves relative timing dependencies
 * 2. Extends keyframe durations to fill gaps
 * 3. Sorts keyframes for marker-based positioning
 * 4. Calculates the total scene duration
 *
 * After reconciliation, you can use `reconcile_animationState()` to get
 * the animation state at any point in time.
 *
 * @example
 * ```typescript
 * const scene: SceneDefinition3D = {
 *   modelKeyframes: [{ id: 'move-model', sceneObject: myObject, time: { type: 'absolute', value: 0 }, duration: 2, ... }],
 *   cameraKeyframes: [],
 * };
 * const reconciled = reconcileScene(scene);
 * const state = reconcile_animationState(reconciled, 1.5);
 * ```
 */
export function reconcileScene(scene: SceneDefinition3D): ReconciledScene3D {
	const reconciled = reconcileKeyframes(scene);
	const duration = keyframes_getSceneDuration(reconciled);
	return {
		...reconciled,
		duration
	};
}

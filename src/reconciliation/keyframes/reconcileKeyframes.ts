import type { SceneObject } from '../types/types_sceneModel';
import { reconcileKeyframesTime } from './01_reconcileKeyframes_time';
import { extendTimeOfKeyframes } from './02_reconcileKeyframes_expandTime';
import { sortKeyframesForMarkerPositions } from './03_reconcileKeyframes_sortForMarkerPositions';
import type { type_separatedKeyframes_extended, type_sceneDefinition_keyframes } from './types';

/**
 * Extracts SceneObject instances from model keyframes.
 */
function extractSceneObjects(
	modelKeyframes: Array<{ sceneObject: SceneObject }>
): Set<SceneObject> {
	const sceneObjects = new Set<SceneObject>();
	modelKeyframes.forEach((kf) => sceneObjects.add(kf.sceneObject));
	return sceneObjects;
}

/**
 * Reconciles keyframes using the efficient separated pipeline.
 * Accepts raw keyframe arrays (no Node classes).
 * audioKeyframes default to [] when omitted.
 */
export const reconcileKeyframes = (
	scene: type_sceneDefinition_keyframes
): type_separatedKeyframes_extended & { sceneObjects: Set<SceneObject> } => {
	const separatedKeyframes = {
		modelKeyframes: scene.modelKeyframes,
		cameraKeyframes: scene.cameraKeyframes,
		audioKeyframes: scene.audioKeyframes ?? [],
		lightKeyframes: scene.lightKeyframes ?? []
	};
	const keyframes_reconciledTime = reconcileKeyframesTime(separatedKeyframes);
	const keyframes_extendedTime = extendTimeOfKeyframes(keyframes_reconciledTime);
	const keyframes_withSceneMeta = {
		...keyframes_extendedTime,
		lights: scene.lights ?? [],
		zeroCamera: scene.zeroCamera
	};
	const keyframes_sorted = sortKeyframesForMarkerPositions(keyframes_withSceneMeta);
	const sceneObjects = extractSceneObjects(scene.modelKeyframes);

	return {
		modelKeyframes: keyframes_sorted.modelKeyframes,
		cameraKeyframes: keyframes_sorted.cameraKeyframes,
		audioKeyframes: keyframes_sorted.audioKeyframes,
		lightKeyframes: keyframes_sorted.lightKeyframes,
		lights: keyframes_sorted.lights ?? [],
		zeroCamera: keyframes_sorted.zeroCamera,
		sceneObjects
	};
};

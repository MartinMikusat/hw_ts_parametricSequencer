import type { type_scene_zeroCamera } from '../../types/types_sceneObjects';
import { vec3_from } from '../math';
import type { CameraAnimationState3D } from './reconcile_animationState';

/**
 * Converts scene definition zero camera to reconciliation baseline state.
 * Motivation: authors set framing in the editor; playback uses it before the first camera keyframe.
 *
 * @param zeroCamera - Pose from scenes.definition.zeroCamera
 * @returns Camera state without spring (baseline is not a keyframe)
 */
export function reconciliation_baselineCameraFromZero(
	zeroCamera: type_scene_zeroCamera
): CameraAnimationState3D {
	return {
		rotationX: zeroCamera.rotationX,
		rotationY: zeroCamera.rotationY,
		target: vec3_from(zeroCamera.target),
		zoom: zeroCamera.zoom
	};
}

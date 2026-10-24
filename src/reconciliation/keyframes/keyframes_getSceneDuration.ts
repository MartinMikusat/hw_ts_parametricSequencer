import type { type_separatedKeyframes_extended } from './types';

export const keyframes_getSceneDuration = (keyframes: type_separatedKeyframes_extended) => {
	let duration = 0;
	keyframes.cameraKeyframes.forEach((keyframe) => {
		if (keyframe.reconciled.endTime > duration) {
			duration = keyframe.reconciled.endTime;
		}
	});

	keyframes.modelKeyframes.forEach((keyframe) => {
		if (keyframe.reconciled.endTime > duration) {
			duration = keyframe.reconciled.endTime;
		}
	});

	keyframes.audioKeyframes.forEach((keyframe) => {
		if (keyframe.reconciled.endTime > duration) {
			duration = keyframe.reconciled.endTime;
		}
	});

	keyframes.lightKeyframes.forEach((keyframe) => {
		if (keyframe.reconciled.endTime > duration) {
			duration = keyframe.reconciled.endTime;
		}
	});

	return duration;
};

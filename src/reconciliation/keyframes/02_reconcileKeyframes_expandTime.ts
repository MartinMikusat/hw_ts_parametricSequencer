import type {
	type_separatedKeyframes_reconciled,
	type_separatedKeyframes_extended,
	type_keyframe_model,
	type_keyframe_camera,
	type_keyframe_audio,
	type_keyframe_light
} from './types';

// Typed versions for separated keyframes
export type type_keyframes_reconciledTimeExtended_model = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	extended: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_model;
};

export type type_keyframes_reconciledTimeExtended_camera = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	extended: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_camera;
};

export type type_keyframes_reconciledTimeExtended_audio = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	extended: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_audio;
};

export type type_keyframes_reconciledTimeExtended_light = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	extended: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_light;
};

/**
 * Checks if a time value is valid (not NaN, finite)
 */
function isValidTime(time: number): boolean {
	return typeof time === 'number' && !isNaN(time) && isFinite(time);
}

// Helper function to extend time for individual keyframes
const extendSingleKeyframe = (startTime: number, endTime: number, keyframeId: string) => {
	// Sanity check for invalid time values
	if (!isValidTime(startTime) || !isValidTime(endTime)) {
		console.warn(
			`Keyframe ${keyframeId} has invalid time values: startTime=${startTime}, endTime=${endTime}`
		);
		// Use 0 as fallback for invalid values
		const safeStartTime = isValidTime(startTime) ? startTime : 0;
		const safeEndTime = isValidTime(endTime) ? endTime : Math.max(safeStartTime, 0);

		return {
			startTime: safeStartTime,
			endTime: safeEndTime
		};
	}

	// Ensure endTime is not before startTime
	const extendedStartTime = startTime;
	const extendedEndTime = Math.max(startTime, endTime);

	// Log when time correction is needed
	if (endTime < startTime) {
		console.warn(
			`Keyframe ${keyframeId} has endTime (${endTime}) before startTime (${startTime}). Adjusting endTime to match startTime.`
		);
	}

	return {
		startTime: extendedStartTime,
		endTime: extendedEndTime
	};
};

/**
 * Extends the time for separated keyframes, ensuring endTime is not less than startTime.
 *
 * @param separatedKeyframes Object containing separated model and camera keyframe arrays with reconciled times
 * @returns Object containing separated arrays of keyframes with extended times
 */
export const extendTimeOfKeyframes = (
	separatedKeyframes: type_separatedKeyframes_reconciled
): type_separatedKeyframes_extended => {
	// Process model keyframes
	const modelKeyframes = separatedKeyframes.modelKeyframes.map((kf) => {
		const { startTime, endTime } = kf.reconciled;
		const extended = extendSingleKeyframe(startTime, endTime, kf.keyframe.id);

		return {
			...kf,
			extended
		} as type_keyframes_reconciledTimeExtended_model;
	});

	// Process camera keyframes
	const cameraKeyframes = separatedKeyframes.cameraKeyframes.map((kf) => {
		const { startTime, endTime } = kf.reconciled;
		const extended = extendSingleKeyframe(startTime, endTime, kf.keyframe.id);

		return {
			...kf,
			extended
		} as type_keyframes_reconciledTimeExtended_camera;
	});

	// Process audio keyframes (same as camera – no marker dependencies)
	const audioKeyframes = separatedKeyframes.audioKeyframes.map((kf) => {
		const { startTime, endTime } = kf.reconciled;
		const extended = extendSingleKeyframe(startTime, endTime, kf.keyframe.id);

		return {
			...kf,
			extended
		} as type_keyframes_reconciledTimeExtended_audio;
	});

	// Process light keyframes (no marker dependencies)
	const lightKeyframes = separatedKeyframes.lightKeyframes.map((kf) => {
		const { startTime, endTime } = kf.reconciled;
		const extended = extendSingleKeyframe(startTime, endTime, kf.keyframe.id);

		return {
			...kf,
			extended
		} as type_keyframes_reconciledTimeExtended_light;
	});

	return {
		modelKeyframes,
		cameraKeyframes,
		audioKeyframes,
		lightKeyframes
	};
};

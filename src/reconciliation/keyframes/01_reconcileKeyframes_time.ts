import type {
	type_separatedKeyframes,
	type_separatedKeyframes_reconciled,
	type_keyframe_model,
	type_keyframe_camera,
	type_keyframe_audio,
	type_keyframe_light,
	type_time
} from './types';
import {
	validateKeyframeTiming,
	type type_reconciliation_keyframe
} from './validate_keyframeTiming';

/**
 * Represents a keyframe with reconciled absolute start and end times
 */
type type_keyframes_reconciledTime = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_reconciliation_keyframe;
};

/**
 * Represents a model keyframe with reconciled absolute start and end times
 */
type type_keyframes_reconciledTime_model = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_model;
};

/**
 * Represents a camera keyframe with reconciled absolute start and end times
 */
type type_keyframes_reconciledTime_camera = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_camera;
};

/**
 * Represents an audio keyframe with reconciled absolute start and end times
 */
type type_keyframes_reconciledTime_audio = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_audio;
};

/**
 * Represents a light keyframe with reconciled absolute start and end times
 */
type type_keyframes_reconciledTime_light = {
	reconciled: {
		startTime: number;
		endTime: number;
	};
	keyframe: type_keyframe_light;
};

/**
 * Type guard for absolute time keyframes
 */
function isAbsoluteKeyframe(
	kf: type_reconciliation_keyframe
): kf is type_reconciliation_keyframe & { time: { type: 'absolute'; value: number } } {
	return kf.time.type === 'absolute';
}

/**
 * Type guard for relative or multiple time keyframes
 */
function isRelativeOrMultipleKeyframe(
	kf: type_reconciliation_keyframe
): kf is type_reconciliation_keyframe & {
	time: Extract<type_time, { type: 'relative' | 'multiple' }>;
} {
	return kf.time.type === 'relative' || kf.time.type === 'multiple';
}

/**
 * Type guard: duration is a number (not relative).
 */
function isDurationNumeric(duration: type_reconciliation_keyframe['duration']): duration is number {
	return typeof duration === 'number';
}

/**
 * Type guard: duration is relative to another keyframe.
 */
function isDurationRelative(duration: type_reconciliation_keyframe['duration']): duration is {
	type: 'relative';
	value: { parentID: string; side: 'Start' | 'End'; offset?: number };
} {
	return typeof duration === 'object' && duration !== null && duration.type === 'relative';
}

/**
 * Creates a reconciled keyframe with calculated start and end times.
 * @param startTime - Resolved start time
 * @param durationSeconds - Resolved duration in seconds (from numeric or resolved relative)
 */
function createReconciledKeyframe(
	startTime: number,
	durationSeconds: number,
	keyframe: type_reconciliation_keyframe
): type_keyframes_reconciledTime {
	return {
		reconciled: {
			startTime,
			endTime: startTime + durationSeconds
		},
		keyframe
	};
}

/**
 * Attempts to resolve a keyframe's duration.
 * For numeric duration, returns it. For relative duration, computes from parent.
 * When side is 'Start', uses startTimeMap (parent's startTime from phase 1).
 * When side is 'End', requires parent in resolvedMap (parent's endTime).
 * @returns Resolved duration in seconds, or null if parent not yet available
 */
function tryResolveDuration(
	keyframe: type_reconciliation_keyframe,
	startTime: number,
	resolvedMap: Map<string, type_keyframes_reconciledTime>,
	startTimeMap: Map<string, number>
): number | null {
	if (isDurationNumeric(keyframe.duration)) {
		return keyframe.duration;
	}
	if (!isDurationRelative(keyframe.duration)) {
		return null;
	}
	const { parentID, side, offset = 0 } = keyframe.duration.value;
	let targetTime: number;
	if (side === 'Start') {
		const parentStart = startTimeMap.get(parentID);
		if (parentStart === undefined) return null;
		targetTime = parentStart + offset;
	} else {
		const parentKf = resolvedMap.get(parentID);
		if (!parentKf) return null;
		targetTime = parentKf.reconciled.endTime + offset;
	}
	const duration = targetTime - startTime;
	if (duration < 0) {
		throw new Error(
			`Keyframe "${keyframe.id}" has invalid relative duration: target end time ${targetTime.toFixed(2)}s is before start time ${startTime.toFixed(2)}s. ` +
				`Check duration parent (${parentID} ${side}) and offset.`
		);
	}
	return duration;
}

/**
 * Attempts to resolve a keyframe's start time based on its dependencies.
 * For side: 'Start', uses startTimeMap (parent's startTime from phase 1) so children can resolve
 * even when the parent has a relative duration that is still pending.
 * For side: 'End', requires parent in resolvedMap (parent's endTime).
 */
function tryResolveKeyframeTime(
	keyframe: type_reconciliation_keyframe,
	resolvedMap: Map<string, type_keyframes_reconciledTime>,
	startTimeMap: Map<string, number>
): { resolved: boolean; startTime: number } {
	// Handle absolute time keyframes
	if (keyframe.time.type === 'absolute') {
		return { resolved: true, startTime: keyframe.time.value };
	}

	// Handle relative time keyframes
	if (keyframe.time.type === 'relative') {
		const { parentID, side, offset = 0 } = keyframe.time.value;
		let parentTime: number;

		if (side === 'Start') {
			const parentStart = startTimeMap.get(parentID);
			if (parentStart === undefined) return { resolved: false, startTime: -1 };
			parentTime = parentStart + offset;
		} else {
			const parentKf = resolvedMap.get(parentID);
			if (!parentKf) return { resolved: false, startTime: -1 };
			parentTime = parentKf.reconciled.endTime + offset;
		}

		return { resolved: true, startTime: parentTime };
	}

	// Handle multiple dependencies
	if (keyframe.time.type === 'multiple') {
		let latestParentTime = -Infinity;

		for (const parentInfo of keyframe.time.values) {
			const parentOffset = parentInfo.offset ?? 0;
			let parentTime: number;

			if (parentInfo.side === 'Start') {
				const parentStart = startTimeMap.get(parentInfo.parentID);
				if (parentStart === undefined) return { resolved: false, startTime: -1 };
				parentTime = parentStart + parentOffset;
			} else {
				const parentKf = resolvedMap.get(parentInfo.parentID);
				if (!parentKf) return { resolved: false, startTime: -1 };
				parentTime = parentKf.reconciled.endTime + parentOffset;
			}

			latestParentTime = Math.max(latestParentTime, parentTime);
		}

		return { resolved: true, startTime: latestParentTime };
	}

	// Unhandled time type
	return { resolved: false, startTime: -1 };
}

// Internal function to reconcile timing - used by the separated version
const reconcileKeyframesTimeInternal = (
	keyframes: Array<type_reconciliation_keyframe>
): Array<type_keyframes_reconciledTime> => {
	if (keyframes.length === 0) {
		return [];
	}

	const validation = validateKeyframeTiming(keyframes);
	if (!validation.ok) {
		throw new Error(validation.issues[0].message);
	}

	const validKeyframes = keyframes;

	// Phase 1: Resolve start times. startTimeMap tracks all resolved start times for duration resolution (side: 'Start').
	const absoluteKeyframes = validKeyframes.filter(isAbsoluteKeyframe);
	let unresolvedTimeKeyframes = validKeyframes.filter(isRelativeOrMultipleKeyframe);
	const resolvedMap = new Map<string, type_keyframes_reconciledTime>();
	const startTimeMap = new Map<string, number>();
	const reconciledResult: Array<type_keyframes_reconciledTime> = [];
	const pendingDurationKeyframes: Array<{
		startTime: number;
		keyframe: type_reconciliation_keyframe;
	}> = [];

	// Process absolute time keyframes first
	absoluteKeyframes.forEach((keyframe) => {
		const startTime = keyframe.time.value;
		startTimeMap.set(keyframe.id, startTime);
		const duration = tryResolveDuration(keyframe, startTime, resolvedMap, startTimeMap);
		if (duration !== null) {
			const reconciledKf = createReconciledKeyframe(startTime, duration, keyframe);
			resolvedMap.set(keyframe.id, reconciledKf);
			reconciledResult.push(reconciledKf);
		} else {
			pendingDurationKeyframes.push({ startTime, keyframe });
		}
	});

	// Resolve relative/multiple time keyframes iteratively
	const MAX_ITERATIONS = 100;
	for (
		let iteration = 0;
		iteration < MAX_ITERATIONS && unresolvedTimeKeyframes.length > 0;
		iteration++
	) {
		const newlyResolved: Array<type_keyframes_reconciledTime> = [];
		const stillUnresolved: typeof unresolvedTimeKeyframes = [];
		let madeProgress = false;

		for (const keyframe of unresolvedTimeKeyframes) {
			const { resolved, startTime } = tryResolveKeyframeTime(keyframe, resolvedMap, startTimeMap);
			if (!resolved) {
				stillUnresolved.push(keyframe);
				continue;
			}
			startTimeMap.set(keyframe.id, startTime);
			const duration = tryResolveDuration(keyframe, startTime, resolvedMap, startTimeMap);
			if (duration !== null) {
				const reconciledKf = createReconciledKeyframe(startTime, duration, keyframe);
				newlyResolved.push(reconciledKf);
				resolvedMap.set(keyframe.id, reconciledKf);
				madeProgress = true;
			} else {
				pendingDurationKeyframes.push({ startTime, keyframe });
				madeProgress = true; // start time resolved, will retry duration in phase 2
			}
		}

		reconciledResult.push(...newlyResolved);
		unresolvedTimeKeyframes = stillUnresolved;
		if (!madeProgress) break;
	}

	if (unresolvedTimeKeyframes.length > 0) {
		const unresolvedDetails = unresolvedTimeKeyframes.map((kf) => {
			if (kf.time.type === 'relative') {
				return `${kf.id} (depends on: ${kf.time.value.parentID})`;
			}
			if (kf.time.type === 'multiple') {
				const deps = kf.time.values.map((v) => v.parentID).join(', ');
				return `${kf.id} (depends on: ${deps})`;
			}
			return kf.id;
		});
		throw new Error(
			`Keyframe time reconciliation failed with ${unresolvedTimeKeyframes.length} unresolved keyframes. ` +
				`This indicates a bug in the scene definition - all dependencies must be resolvable.\n` +
				`Unresolved keyframes: ${unresolvedDetails.join(', ')}`
		);
	}

	// Phase 2: Resolve pending relative durations iteratively
	for (
		let iteration = 0;
		iteration < MAX_ITERATIONS && pendingDurationKeyframes.length > 0;
		iteration++
	) {
		let madeProgress = false;
		const stillPending: typeof pendingDurationKeyframes = [];

		for (const { startTime, keyframe } of pendingDurationKeyframes) {
			const duration = tryResolveDuration(keyframe, startTime, resolvedMap, startTimeMap);
			if (duration !== null) {
				const reconciledKf = createReconciledKeyframe(startTime, duration, keyframe);
				resolvedMap.set(keyframe.id, reconciledKf);
				reconciledResult.push(reconciledKf);
				madeProgress = true;
			} else {
				stillPending.push({ startTime, keyframe });
			}
		}

		pendingDurationKeyframes.length = 0;
		pendingDurationKeyframes.push(...stillPending);
		if (!madeProgress) {
			const pendingIds = pendingDurationKeyframes.map((p) => p.keyframe.id).join(', ');
			throw new Error(
				`Keyframe duration reconciliation failed. Unresolved duration dependencies (circular or missing parent): ${pendingIds}`
			);
		}
	}

	return reconciledResult;
};

/**
 * Reconciles the timing of separated keyframes, converting relative and multiple-dependency times
 * into absolute start and end times based on their dependencies.
 *
 * Note: Keyframe order in the returned arrays is not guaranteed (phase 2 appends resolved keyframes
 * after phase 1). Downstream sortKeyframesForMarkerPositions sorts by startTime/dependencies.
 *
 * @param separatedKeyframes Object containing separated model and camera keyframe arrays
 * @returns Object containing separated arrays of keyframes with reconciled absolute timing
 */
/** Type guard: keyframe is an audio keyframe. */
function isAudioKeyframe(kf: type_reconciliation_keyframe): kf is type_keyframe_audio {
	return 'audio' in kf && typeof (kf as type_keyframe_audio).audio === 'string';
}

/** Type guard: keyframe is a light keyframe. */
function isLightKeyframe(kf: type_reconciliation_keyframe): kf is type_keyframe_light {
	return 'lightId' in kf && typeof (kf as type_keyframe_light).lightId === 'string';
}

export const reconcileKeyframesTime = (
	separatedKeyframes: type_separatedKeyframes
): type_separatedKeyframes_reconciled => {
	// Process model, camera, audio, and light keyframes together to resolve cross-dependencies
	const allKeyframes = [
		...separatedKeyframes.modelKeyframes,
		...separatedKeyframes.cameraKeyframes,
		...(separatedKeyframes.audioKeyframes ?? []),
		...(separatedKeyframes.lightKeyframes ?? [])
	];
	const reconciledAll = reconcileKeyframesTimeInternal(allKeyframes);

	// Separate the reconciled keyframes back into model, camera, audio, and light arrays
	const modelKeyframes: type_keyframes_reconciledTime_model[] = [];
	const cameraKeyframes: type_keyframes_reconciledTime_camera[] = [];
	const audioKeyframes: type_keyframes_reconciledTime_audio[] = [];
	const lightKeyframes: type_keyframes_reconciledTime_light[] = [];

	reconciledAll.forEach((reconciled) => {
		if (isAudioKeyframe(reconciled.keyframe)) {
			audioKeyframes.push(reconciled as type_keyframes_reconciledTime_audio);
		} else if ('sceneObject' in reconciled.keyframe) {
			modelKeyframes.push(reconciled as type_keyframes_reconciledTime_model);
		} else if (isLightKeyframe(reconciled.keyframe)) {
			lightKeyframes.push(reconciled as type_keyframes_reconciledTime_light);
		} else {
			cameraKeyframes.push(reconciled as type_keyframes_reconciledTime_camera);
		}
	});

	return {
		modelKeyframes,
		cameraKeyframes,
		audioKeyframes,
		lightKeyframes
	};
};

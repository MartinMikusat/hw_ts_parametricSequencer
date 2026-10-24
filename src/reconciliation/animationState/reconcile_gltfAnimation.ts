import type { type_keyframes_reconciledTimeExtended_model } from '../keyframes/02_reconcileKeyframes_expandTime';
import type { type_keyframe_easing, type_keyframe_model } from '../keyframes/types';
import {
	helper_easing_ease,
	helper_easing_easeIn,
	helper_easing_easeInOut,
	helper_easing_easeOut,
	helper_easing_linear
} from '../../helper_easing_bezier';

const EPSILON = 1e-6;

/** @param value - Number to clamp */
function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** @param a - Start @param b - End @param t - Interpolation factor */
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Returns easing function for keyframe animation curves.
 * @param easing - Optional easing name from keyframe
 */
function getEasingFn(easing?: type_keyframe_easing): (t: number) => number {
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
 * Whether a model keyframe defines GLTF clip and/or progress animation.
 * @param keyframe - Model keyframe
 */
function hasGltfAnimation(keyframe: type_keyframe_model): boolean {
	const ga = keyframe.gltfAnimation;
	if (!ga) return false;
	return ga.clip !== undefined || ga.progress !== undefined;
}

/**
 * Resolves clip name from keyframe when explicitly set.
 * @param keyframe - Model keyframe
 */
function getClipFromKeyframe(keyframe: type_keyframe_model): string | undefined {
	return keyframe.gltfAnimation?.clip;
}

/**
 * Resolves active clip for the winning keyframe, inheriting from earlier clip keyframes.
 * @param winner - Winning extended keyframe
 * @param allGltfKfs - All gltf keyframes for this scene object
 */
function resolveClipAtKeyframe(
	winner: type_keyframes_reconciledTimeExtended_model,
	allGltfKfs: type_keyframes_reconciledTimeExtended_model[]
): string | null {
	const direct = getClipFromKeyframe(winner.keyframe);
	if (direct) return direct;

	const winnerStart = winner.reconciled.startTime;
	const earlierWithClip = allGltfKfs
		.filter(function filterEarlierWithClip(k) {
			return k.reconciled.startTime < winnerStart && !!getClipFromKeyframe(k.keyframe);
		})
		.sort(function sortByStartDesc(a, b) {
			return b.reconciled.startTime - a.reconciled.startTime;
		});

	const inherited = earlierWithClip[0]
		? getClipFromKeyframe(earlierWithClip[0].keyframe)
		: undefined;
	return inherited ?? null;
}

/**
 * True when the winning keyframe started while another gltf keyframe was still active.
 * @param winner - Winning keyframe
 * @param allGltfKfs - All gltf keyframes for scene object
 */
function wasOverlapTakeover(
	winner: type_keyframes_reconciledTimeExtended_model,
	allGltfKfs: type_keyframes_reconciledTimeExtended_model[]
): boolean {
	const segmentStart = winner.reconciled.startTime;
	return allGltfKfs.some(function otherStillActive(k) {
		return (
			k !== winner && k.reconciled.startTime < segmentStart && segmentStart <= k.extended.endTime
		);
	});
}

/**
 * Samples progress within the winning keyframe segment.
 * @param winner - Winning extended keyframe
 * @param allGltfKfs - All gltf keyframes for scene object
 * @param allModelKeyframes - Full model keyframe list for recursive segment-start lookup
 * @param sceneObjectID - Scene object id
 * @param sampleTime - Time to sample within segment
 */
function sampleWinnerProgress(
	winner: type_keyframes_reconciledTimeExtended_model,
	allGltfKfs: type_keyframes_reconciledTimeExtended_model[],
	allModelKeyframes: type_keyframes_reconciledTimeExtended_model[],
	sceneObjectID: string,
	sampleTime: number
): number {
	const start = winner.reconciled.startTime;
	const end = winner.extended.endTime;
	const duration = end - start;
	const progression = duration <= EPSILON ? 1 : clamp01((sampleTime - start) / duration);
	const eased = getEasingFn(winner.keyframe.easing)(progression);

	let startProgress = 0;
	if (!wasOverlapTakeover(winner, allGltfKfs) && start > EPSILON) {
		startProgress = reconcileGltfAnimationForObject(
			allModelKeyframes,
			sceneObjectID,
			start - EPSILON
		).gltfProgress;
	}

	const targetProgress = winner.keyframe.gltfAnimation?.progress ?? startProgress;
	return clamp01(lerp(startProgress, targetProgress, eased));
}

export type type_gltfAnimationState = {
	gltfClip: string | null;
	gltfProgress: number;
};

/**
 * Resolves GLTF clip + progress for one scene object at currentTime.
 * Latest-wins overlap: among keyframes active at currentTime, the one with the latest
 * startTime drives clip and progress. Progress lerps within that segment.
 *
 * @param keyframes - Reconciled extended model keyframes
 * @param sceneObjectID - Scene object instance id
 * @param currentTime - Timeline time in seconds
 */
export function reconcileGltfAnimationForObject(
	keyframes: type_keyframes_reconciledTimeExtended_model[],
	sceneObjectID: string,
	currentTime: number
): type_gltfAnimationState {
	const gltfKfs = keyframes.filter(function filterGltfKfs(k) {
		return k.keyframe.sceneObject.sceneObjectID === sceneObjectID && hasGltfAnimation(k.keyframe);
	});

	if (gltfKfs.length === 0) {
		return { gltfClip: null, gltfProgress: 0 };
	}

	const started = gltfKfs.filter(function filterStarted(k) {
		return k.reconciled.startTime <= currentTime;
	});
	if (started.length === 0) {
		return { gltfClip: null, gltfProgress: 0 };
	}

	const winner = started.reduce(function pickLatestStart(a, b) {
		return a.reconciled.startTime >= b.reconciled.startTime ? a : b;
	});

	const sampleTime = Math.min(currentTime, winner.extended.endTime);
	const gltfClip = resolveClipAtKeyframe(winner, gltfKfs);
	const gltfProgress = sampleWinnerProgress(winner, gltfKfs, keyframes, sceneObjectID, sampleTime);

	return { gltfClip, gltfProgress };
}

import type { type_separatedKeyframes_extended } from './types';
import { getTimingParentIds } from './validate_keyframeTiming';

type type_entityModelKeyframe = type_separatedKeyframes_extended['modelKeyframes'][number];

/** One stop when Shift+wheel stepping through a SceneObject's keyframes in the editor preview. */
export type type_entityKeyframeScrollStep = {
	time: number;
	keyframeId: string;
	/** Order among entity keyframes in timing-parent list (topological; siblings by start time). */
	sortIndex: number;
	edge: 'start' | 'end';
};

/** Minimal track shape for resolving a keyframe id at a boundary time in the editor timeline. */
export type type_entityBoundaryTrack = {
	entityId: string;
	type: 'model' | 'camera' | 'audio' | 'light';
	laneIndex: number;
	keyframes: ReadonlyArray<{
		id: string;
		startTime: number;
		endTime: number;
	}>;
};

const TIME_EPSILON = 1e-6;

/**
 * Returns true when two keyframe boundary times should be treated as the same instant.
 * Motivation: reconciled times are floats; dedupe avoids duplicate playhead stops.
 */
function timesAreEqual(a: number, b: number): boolean {
	return Math.abs(a - b) <= TIME_EPSILON;
}

/**
 * Collects unique reconciled start/end times from all keyframe types, sorted ascending.
 * Used by the editor to step the playhead between keyframe boundaries.
 *
 * @param reconciled - Extended reconciled keyframes from `reconcileScene`
 * @returns Sorted unique boundary times in seconds
 *
 * @example
 * ```ts
 * const boundaries = helper_keyframes_reconciledBoundaryTimes(reconciledScene);
 * // [0, 2, 5, 5, 10] → deduped to [0, 2, 5, 10]
 * ```
 */
export function helper_keyframes_reconciledBoundaryTimes(
	reconciled: type_separatedKeyframes_extended
): number[] {
	const raw: number[] = [];

	for (const kf of reconciled.modelKeyframes) {
		raw.push(kf.reconciled.startTime, kf.reconciled.endTime);
	}
	for (const kf of reconciled.cameraKeyframes) {
		raw.push(kf.reconciled.startTime, kf.reconciled.endTime);
	}
	for (const kf of reconciled.audioKeyframes) {
		raw.push(kf.reconciled.startTime, kf.reconciled.endTime);
	}
	for (const kf of reconciled.lightKeyframes) {
		raw.push(kf.reconciled.startTime, kf.reconciled.endTime);
	}

	raw.sort(function sortAscending(a, b) {
		return a - b;
	});

	const unique: number[] = [];
	for (const time of raw) {
		const last = unique[unique.length - 1];
		if (last === undefined || !timesAreEqual(last, time)) {
			unique.push(time);
		}
	}

	return unique;
}

/**
 * Finds the next or previous reconciled keyframe boundary relative to the current playhead.
 * Right returns the first boundary strictly after current time; Left returns the last strictly before.
 *
 * @param boundaries - Sorted unique boundary times from `helper_keyframes_reconciledBoundaryTimes`
 * @param currentTime - Current playhead time in seconds
 * @param direction - `-1` for previous boundary, `1` for next
 * @returns Target boundary time, or null when none exists in that direction
 *
 * @example
 * ```ts
 * const target = helper_keyframes_adjacentBoundaryTime([0, 2, 5], 2.5, 1);
 * // Returns 5
 * ```
 */
export function helper_keyframes_adjacentBoundaryTime(
	boundaries: readonly number[],
	currentTime: number,
	direction: -1 | 1
): number | null {
	if (boundaries.length === 0) return null;

	if (direction === 1) {
		for (const time of boundaries) {
			if (time > currentTime + TIME_EPSILON) return time;
		}
		return null;
	}

	for (let index = boundaries.length - 1; index >= 0; index--) {
		const time = boundaries[index];
		if (time !== undefined && time < currentTime - TIME_EPSILON) return time;
	}
	return null;
}

/**
 * Collects unique reconciled start/end times for one SceneObject instance only.
 * Motivation: preview Shift+wheel steps keyframes that directly animate the selected model,
 * not parent or other-entity keyframes.
 *
 * @param reconciled - Extended reconciled keyframes from `reconcileScene`
 * @param sceneObjectId - SceneObject instance id (timeline entity id for model tracks)
 * @returns Sorted unique boundary times in seconds for that instance
 *
 * @example
 * ```ts
 * const boundaries = helper_keyframes_entityReconciledBoundaryTimes(reconciled, 'screw-1');
 * ```
 */
export function helper_keyframes_entityReconciledBoundaryTimes(
	reconciled: type_separatedKeyframes_extended,
	sceneObjectId: string
): number[] {
	const raw: number[] = [];

	for (const kf of reconciled.modelKeyframes) {
		if (kf.keyframe.sceneObject.sceneObjectID !== sceneObjectId) continue;
		raw.push(kf.reconciled.startTime, kf.reconciled.endTime);
	}

	raw.sort(function sortAscending(a, b) {
		return a - b;
	});

	const unique: number[] = [];
	for (const time of raw) {
		const last = unique[unique.length - 1];
		if (last === undefined || !timesAreEqual(last, time)) {
			unique.push(time);
		}
	}

	return unique;
}

/**
 * Finds the keyframe id on a model entity track whose start or end matches a boundary time.
 * Prefers lowest lane on ties; when start and end match different keyframes at the same instant,
 * prefers the keyframe that starts there.
 *
 * @param tracks - Editor timeline tracks (display lanes included)
 * @param sceneObjectId - SceneObject instance id
 * @param time - Reconciled boundary time in seconds
 * @returns Keyframe id, or null when none matches
 *
 * @example
 * ```ts
 * const id = helper_keyframes_entityKeyframeIdAtBoundary(tracks, 'screw-1', 2);
 * ```
 */
export function helper_keyframes_entityKeyframeIdAtBoundary(
	tracks: readonly type_entityBoundaryTrack[],
	sceneObjectId: string,
	time: number
): string | null {
	type Match = { id: string; laneIndex: number; isStart: boolean };

	const matches: Match[] = [];

	for (const track of tracks) {
		if (track.type !== 'model' || track.entityId !== sceneObjectId) continue;

		for (const kf of track.keyframes) {
			if (timesAreEqual(kf.startTime, time)) {
				matches.push({ id: kf.id, laneIndex: track.laneIndex, isStart: true });
			} else if (timesAreEqual(kf.endTime, time)) {
				matches.push({ id: kf.id, laneIndex: track.laneIndex, isStart: false });
			}
		}
	}

	if (matches.length === 0) return null;

	matches.sort(function preferStartThenLowestLane(a, b) {
		if (a.isStart !== b.isStart) return a.isStart ? -1 : 1;
		return a.laneIndex - b.laneIndex;
	});

	return matches[0]?.id ?? null;
}

function compareEntityModelKeyframesByStartTimeThenId(
	a: type_entityModelKeyframe,
	b: type_entityModelKeyframe
): number {
	const startDelta = a.reconciled.startTime - b.reconciled.startTime;
	if (Math.abs(startDelta) > TIME_EPSILON) return startDelta;
	return a.keyframe.id.localeCompare(b.keyframe.id);
}

/**
 * Sorts one SceneObject's model keyframes for Shift+wheel: timing parents before dependents
 * (using in-entity start/duration parent links), with reconciled start time then id among siblings.
 *
 * @param entityKeyframes - Reconciled model keyframes for a single SceneObject instance
 * @returns Keyframes in scroll order (roots and external-parent children first among peers by start time)
 */
export function helper_keyframes_entityKeyframesInTimingParentOrder(
	entityKeyframes: readonly type_entityModelKeyframe[]
): type_entityModelKeyframe[] {
	if (entityKeyframes.length <= 1) return [...entityKeyframes];

	const byId = new Map(
		entityKeyframes.map(function toEntry(kf) {
			return [kf.keyframe.id, kf] as const;
		})
	);
	const entityIds = new Set(byId.keys());
	const inDegree = new Map<string, number>();
	const childrenByParent = new Map<string, string[]>();

	for (const id of entityIds) {
		inDegree.set(id, 0);
	}

	for (const kf of entityKeyframes) {
		const parentIds = getTimingParentIds(kf.keyframe).filter(function inEntity(parentId) {
			return entityIds.has(parentId);
		});
		inDegree.set(kf.keyframe.id, parentIds.length);

		for (const parentId of parentIds) {
			const children = childrenByParent.get(parentId) ?? [];
			children.push(kf.keyframe.id);
			childrenByParent.set(parentId, children);
		}
	}

	const sorted: type_entityModelKeyframe[] = [];
	const sortedIds = new Set<string>();

	const ready = entityKeyframes
		.filter(function isRoot(kf) {
			return (inDegree.get(kf.keyframe.id) ?? 0) === 0;
		})
		.sort(compareEntityModelKeyframesByStartTimeThenId);

	while (ready.length > 0) {
		const next = ready.shift();
		if (!next) break;

		sorted.push(next);
		sortedIds.add(next.keyframe.id);

		for (const childId of childrenByParent.get(next.keyframe.id) ?? []) {
			const nextDegree = (inDegree.get(childId) ?? 0) - 1;
			inDegree.set(childId, nextDegree);
			if (nextDegree !== 0) continue;

			const childKf = byId.get(childId);
			if (!childKf) continue;

			ready.push(childKf);
			ready.sort(compareEntityModelKeyframesByStartTimeThenId);
		}
	}

	if (sorted.length < entityKeyframes.length) {
		const remaining = entityKeyframes
			.filter(function notYetSorted(kf) {
				return !sortedIds.has(kf.keyframe.id);
			})
			.sort(compareEntityModelKeyframesByStartTimeThenId);
		sorted.push(...remaining);
	}

	return sorted;
}

/**
 * Builds ordered Shift+wheel steps for one SceneObject: keyframes in timing-parent order,
 * each visited as start then end (distinct pairs, not re-sorted by reconciled time).
 *
 * @param reconciled - Extended reconciled keyframes from `reconcileScene`
 * @param sceneObjectId - SceneObject instance id
 * @returns Linear list: kf1 start, kf1 end, kf2 start, kf2 end, …
 *
 * @example
 * ```ts
 * const steps = helper_keyframes_entityKeyframeScrollSteps(reconciled, 'screw-1');
 * ```
 */
export function helper_keyframes_entityKeyframeScrollSteps(
	reconciled: type_separatedKeyframes_extended,
	sceneObjectId: string
): type_entityKeyframeScrollStep[] {
	const entityKeyframes = reconciled.modelKeyframes.filter(function keyframeForObject(kf) {
		return kf.keyframe.sceneObject.sceneObjectID === sceneObjectId;
	});

	const orderedKeyframes = helper_keyframes_entityKeyframesInTimingParentOrder(entityKeyframes);

	const steps: type_entityKeyframeScrollStep[] = [];

	orderedKeyframes.forEach(function appendSteps(kf, sortIndex) {
		steps.push({
			time: kf.reconciled.startTime,
			keyframeId: kf.keyframe.id,
			sortIndex,
			edge: 'start'
		});
		if (!timesAreEqual(kf.reconciled.startTime, kf.reconciled.endTime)) {
			steps.push({
				time: kf.reconciled.endTime,
				keyframeId: kf.keyframe.id,
				sortIndex,
				edge: 'end'
			});
		}
	});

	return steps;
}

/** Index of the step matching playhead + selection, or inside the selected keyframe span. */
function findEntityKeyframeScrollStepIndex(
	steps: readonly type_entityKeyframeScrollStep[],
	currentTime: number,
	selectedKeyframeId: string | null
): number {
	if (selectedKeyframeId) {
		for (let index = 0; index < steps.length; index++) {
			const step = steps[index];
			if (step.keyframeId === selectedKeyframeId && timesAreEqual(step.time, currentTime)) {
				return index;
			}
		}

		let startIndex = -1;
		let endIndex = -1;
		for (let index = 0; index < steps.length; index++) {
			const step = steps[index];
			if (step.keyframeId !== selectedKeyframeId) continue;
			if (step.edge === 'start') startIndex = index;
			if (step.edge === 'end') endIndex = index;
		}

		if (startIndex === -1) return -1;

		const startStep = steps[startIndex];
		const endStep = endIndex >= 0 ? steps[endIndex] : startStep;
		if (startStep === undefined || endStep === undefined) return -1;

		const spanEndTime = endStep.time;
		if (currentTime >= startStep.time - TIME_EPSILON && currentTime <= spanEndTime + TIME_EPSILON) {
			if (endIndex >= 0 && currentTime >= endStep.time - TIME_EPSILON) {
				return endIndex;
			}
			return startIndex;
		}
	}

	return -1;
}

/**
 * Finds the next or previous Shift+wheel step walking keyframe pairs in list order.
 *
 * @param steps - From `helper_keyframes_entityKeyframeScrollSteps`
 * @param currentTime - Current playhead time in seconds
 * @param selectedKeyframeId - Currently selected keyframe id, if any
 * @param direction - `-1` for previous step, `1` for next
 * @returns Target step, or null when none exists in that direction
 */
export function helper_keyframes_adjacentEntityKeyframeScrollStep(
	steps: readonly type_entityKeyframeScrollStep[],
	currentTime: number,
	selectedKeyframeId: string | null,
	direction: -1 | 1
): type_entityKeyframeScrollStep | null {
	if (steps.length === 0) return null;

	const currentIndex = findEntityKeyframeScrollStepIndex(steps, currentTime, selectedKeyframeId);

	if (direction === 1) {
		if (currentIndex >= 0) {
			return steps[currentIndex + 1] ?? null;
		}

		for (const step of steps) {
			if (step.time > currentTime + TIME_EPSILON) return step;
			if (timesAreEqual(step.time, currentTime)) return step;
		}

		return null;
	}

	if (currentIndex >= 0) {
		return steps[currentIndex - 1] ?? null;
	}

	for (let index = steps.length - 1; index >= 0; index--) {
		const step = steps[index];
		if (step !== undefined && step.time < currentTime - TIME_EPSILON) return step;
	}

	return null;
}

import type {
	type_duration,
	type_keyframe_audio,
	type_keyframe_camera,
	type_keyframe_light,
	type_keyframe_model,
	type_time
} from './types';

/** Union of model, camera, audio, and light keyframes for timing validation. */
export type type_reconciliation_keyframe =
	| type_keyframe_model
	| type_keyframe_camera
	| type_keyframe_audio
	| type_keyframe_light;

export type TimingValidationIssueCode =
	| 'duplicate_id'
	| 'missing_parent'
	| 'self_reference'
	| 'start_time_cycle'
	| 'duration_cycle'
	| 'unresolved_start'
	| 'negative_duration'
	| 'invalid_field';

export type TimingValidationIssue = {
	code: TimingValidationIssueCode;
	keyframeIds: string[];
	message: string;
};

export type TimingValidationResult = { ok: true } | { ok: false; issues: TimingValidationIssue[] };

interface TimeWithType {
	type: string;
	value?: { parentID?: string; side?: string; offset?: number };
	values?: Array<{ parentID?: string; side?: string; offset?: number }>;
}

interface DurationWithType {
	type?: string;
	value?: { parentID?: string; side?: string; offset?: number };
}

function isDurationRelative(duration: type_duration): duration is {
	type: 'relative';
	value: { parentID: string; side: 'Start' | 'End'; offset?: number };
} {
	return typeof duration === 'object' && duration !== null && duration.type === 'relative';
}

/**
 * Collects parent IDs referenced by a keyframe's start time and duration.
 * Used for missing-parent and self-reference checks.
 */
function collectTimingParentIds(kf: type_reconciliation_keyframe): string[] {
	const parentIds: string[] = [];

	if (kf.time.type === 'relative') {
		parentIds.push(kf.time.value.parentID);
	} else if (kf.time.type === 'multiple') {
		for (const val of kf.time.values) {
			parentIds.push(val.parentID);
		}
	}

	if (isDurationRelative(kf.duration)) {
		parentIds.push(kf.duration.value.parentID);
	}

	return parentIds;
}

/**
 * Returns unique timing parent IDs for a keyframe in navigation order: start deps first
 * (multiple entries in array order), then duration parent. Used by Shift+Up parent selection.
 */
export function getTimingParentIds(kf: type_reconciliation_keyframe): string[] {
	const seen = new Set<string>();
	return collectTimingParentIds(kf).filter(function keepFirstOccurrence(parentId) {
		if (seen.has(parentId)) return false;
		seen.add(parentId);
		return true;
	});
}

/**
 * First timing parent for keyboard navigation (Shift+Up). Matches pick-mode start-parent priority.
 */
export function getPrimaryTimingParentId(kf: type_reconciliation_keyframe): string | null {
	return getTimingParentIds(kf)[0] ?? null;
}

/**
 * Builds start-time dependency graph: edge child → parent means child's start depends on parent.
 */
export function buildStartTimeDependencyGraph(
	keyframes: type_reconciliation_keyframe[]
): Map<string, Set<string>> {
	const graph = new Map<string, Set<string>>();

	for (const kf of keyframes) {
		if (kf.time.type === 'relative') {
			const parentID = kf.time.value.parentID;
			if (!graph.has(kf.id)) graph.set(kf.id, new Set());
			graph.get(kf.id)!.add(parentID);
		} else if (kf.time.type === 'multiple') {
			if (!graph.has(kf.id)) graph.set(kf.id, new Set());
			for (const val of kf.time.values) {
				graph.get(kf.id)!.add(val.parentID);
			}
		}
	}

	return graph;
}

/**
 * Builds duration dependency graph for relative duration with side End.
 * Edge A → B means A's duration depends on B's end time.
 */
export function buildDurationDependencyGraph(
	keyframes: type_reconciliation_keyframe[]
): Map<string, Set<string>> {
	const graph = new Map<string, Set<string>>();

	for (const kf of keyframes) {
		if (!isDurationRelative(kf.duration) || kf.duration.value.side !== 'End') {
			continue;
		}
		const parentID = kf.duration.value.parentID;
		if (!graph.has(kf.id)) graph.set(kf.id, new Set());
		graph.get(kf.id)!.add(parentID);
	}

	return graph;
}

/**
 * Detects cycles in a dependency graph using DFS.
 * Returns array of cycles; each cycle is an array of keyframe IDs.
 */
export function detectDependencyCycles(dependencyGraph: Map<string, Set<string>>): string[][] {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const path: string[] = [];
	const pathIndex = new Map<string, number>();

	function visit(nodeID: string): void {
		visited.add(nodeID);
		inStack.add(nodeID);
		const idx = path.length;
		path.push(nodeID);
		pathIndex.set(nodeID, idx);

		const deps = dependencyGraph.get(nodeID);
		if (deps) {
			for (const depID of deps) {
				if (!visited.has(depID)) {
					visit(depID);
				} else if (inStack.has(depID)) {
					const cycleStart = pathIndex.get(depID)!;
					cycles.push(Array.from(path.slice(cycleStart)).concat(depID));
				}
			}
		}

		path.pop();
		pathIndex.delete(nodeID);
		inStack.delete(nodeID);
	}

	for (const nodeID of dependencyGraph.keys()) {
		if (!visited.has(nodeID)) {
			visit(nodeID);
		}
	}

	return cycles;
}

function validateKeyframeFields(kf: type_reconciliation_keyframe): TimingValidationIssue[] {
	const issues: TimingValidationIssue[] = [];

	if (!kf.id || typeof kf.id !== 'string') {
		issues.push({
			code: 'invalid_field',
			keyframeIds: [''],
			message: 'Keyframe is missing a valid ID.'
		});
		return issues;
	}

	const id = kf.id;

	if (typeof kf.duration === 'number') {
		if (isNaN(kf.duration) || !isFinite(kf.duration) || kf.duration < 0) {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" has invalid numeric duration.`
			});
		}
	} else if (typeof kf.duration === 'object' && kf.duration !== null) {
		const dur = kf.duration as DurationWithType;
		if (dur.type !== 'relative' || !dur.value) {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" has invalid duration type.`
			});
		} else {
			if (typeof dur.value.parentID !== 'string') {
				issues.push({
					code: 'invalid_field',
					keyframeIds: [id],
					message: `Keyframe "${id}" relative duration is missing parentID.`
				});
			}
			if (dur.value.side !== 'Start' && dur.value.side !== 'End') {
				issues.push({
					code: 'invalid_field',
					keyframeIds: [id],
					message: `Keyframe "${id}" relative duration has invalid side.`
				});
			}
			if (
				dur.value.offset !== undefined &&
				(typeof dur.value.offset !== 'number' ||
					isNaN(dur.value.offset) ||
					!isFinite(dur.value.offset))
			) {
				issues.push({
					code: 'invalid_field',
					keyframeIds: [id],
					message: `Keyframe "${id}" relative duration has invalid offset.`
				});
			}
		}
	} else {
		issues.push({
			code: 'invalid_field',
			keyframeIds: [id],
			message: `Keyframe "${id}" has invalid duration.`
		});
	}

	if (!kf.time || typeof kf.time !== 'object') {
		issues.push({
			code: 'invalid_field',
			keyframeIds: [id],
			message: `Keyframe "${id}" is missing time property.`
		});
		return issues;
	}

	const timeObj = kf.time as TimeWithType;
	if (typeof timeObj.type !== 'string') {
		issues.push({
			code: 'invalid_field',
			keyframeIds: [id],
			message: `Keyframe "${id}" has invalid time type.`
		});
		return issues;
	}

	if (timeObj.type === 'absolute') {
		if (typeof timeObj.value !== 'number' || isNaN(timeObj.value) || !isFinite(timeObj.value)) {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" has invalid absolute time value.`
			});
		}
	} else if (timeObj.type === 'relative') {
		if (!timeObj.value || typeof timeObj.value.parentID !== 'string') {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" relative time is missing parentID.`
			});
		}
		const offset = timeObj.value?.offset ?? 0;
		if (typeof offset !== 'number' || isNaN(offset) || !isFinite(offset)) {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" relative time has invalid offset.`
			});
		}
		if (timeObj.value?.side !== 'Start' && timeObj.value?.side !== 'End') {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" relative time has invalid side.`
			});
		}
	} else if (timeObj.type === 'multiple') {
		if (!Array.isArray(timeObj.values) || timeObj.values.length === 0) {
			issues.push({
				code: 'invalid_field',
				keyframeIds: [id],
				message: `Keyframe "${id}" multiple time has empty values array.`
			});
		} else {
			for (const val of timeObj.values) {
				if (!val || typeof val.parentID !== 'string') {
					issues.push({
						code: 'invalid_field',
						keyframeIds: [id],
						message: `Keyframe "${id}" multiple time entry missing parentID.`
					});
				}
				const valOffset = val?.offset ?? 0;
				if (typeof valOffset !== 'number' || isNaN(valOffset) || !isFinite(valOffset)) {
					issues.push({
						code: 'invalid_field',
						keyframeIds: [id],
						message: `Keyframe "${id}" multiple time entry has invalid offset.`
					});
				}
				if (val?.side !== 'Start' && val?.side !== 'End') {
					issues.push({
						code: 'invalid_field',
						keyframeIds: [id],
						message: `Keyframe "${id}" multiple time entry has invalid side.`
					});
				}
			}
		}
	} else {
		issues.push({
			code: 'invalid_field',
			keyframeIds: [id],
			message: `Keyframe "${id}" has unknown time type "${timeObj.type}".`
		});
	}

	return issues;
}

/**
 * Non-throwing validation for keyframe timing graphs.
 * Checks structure, references, cycles, and dry-runs reconciliation for resolve errors.
 */
export function validateKeyframeTiming(
	keyframes: type_reconciliation_keyframe[]
): TimingValidationResult {
	if (!Array.isArray(keyframes)) {
		return {
			ok: false,
			issues: [
				{
					code: 'invalid_field',
					keyframeIds: [],
					message: 'Keyframes input must be an array.'
				}
			]
		};
	}

	const issues: TimingValidationIssue[] = [];

	const idSet = new Set<string>();
	const duplicateIds: string[] = [];
	for (const kf of keyframes) {
		if (idSet.has(kf.id)) {
			duplicateIds.push(kf.id);
		} else {
			idSet.add(kf.id);
		}
	}
	if (duplicateIds.length > 0) {
		issues.push({
			code: 'duplicate_id',
			keyframeIds: [...new Set(duplicateIds)],
			message: `Duplicate keyframe IDs: ${[...new Set(duplicateIds)].join(', ')}.`
		});
	}

	for (const kf of keyframes) {
		issues.push(...validateKeyframeFields(kf));
	}

	if (issues.length > 0) {
		return { ok: false, issues };
	}

	const allIds = new Set(keyframes.map((kf) => kf.id));

	for (const kf of keyframes) {
		for (const parentID of collectTimingParentIds(kf)) {
			if (parentID === kf.id) {
				issues.push({
					code: 'self_reference',
					keyframeIds: [kf.id],
					message: `Keyframe "${kf.id}" references itself as a timing parent.`
				});
			} else if (!allIds.has(parentID)) {
				issues.push({
					code: 'missing_parent',
					keyframeIds: [kf.id],
					message: `Keyframe "${kf.id}" references unknown parent "${parentID}".`
				});
			}
		}
	}

	const startCycles = detectDependencyCycles(buildStartTimeDependencyGraph(keyframes));
	if (startCycles.length > 0) {
		const cycleIds = startCycles[0];
		issues.push({
			code: 'start_time_cycle',
			keyframeIds: [...new Set(cycleIds)],
			message: `Circular start-time dependency: ${cycleIds.join(' → ')}.`
		});
	}

	const durationCycles = detectDependencyCycles(buildDurationDependencyGraph(keyframes));
	if (durationCycles.length > 0) {
		const cycleIds = durationCycles[0];
		const keyframeById = new Map(keyframes.map((kf) => [kf.id, kf]));
		const cycleDetails = cycleIds
			.map(function formatCycleId(id) {
				const kf = keyframeById.get(id);
				if (kf && isDurationRelative(kf.duration) && kf.duration.value.side === 'End') {
					return `${id} (ends when ${kf.duration.value.parentID} ends)`;
				}
				return id;
			})
			.join(', ');
		issues.push({
			code: 'duration_cycle',
			keyframeIds: [...new Set(cycleIds)],
			message: `Circular duration dependency: ${cycleIds.join(' → ')}. Keyframes: ${cycleDetails}.`
		});
	}

	if (issues.length > 0) {
		return { ok: false, issues };
	}

	/** Dry-run reconciliation to catch unresolved start order and negative duration. */
	try {
		dryRunReconcileTiming(keyframes);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('invalid relative duration')) {
			const match = message.match(/Keyframe "([^"]+)"/);
			issues.push({
				code: 'negative_duration',
				keyframeIds: match ? [match[1]] : [],
				message
			});
		} else if (message.includes('unresolved keyframes')) {
			const ids = keyframes
				.filter(function hasRelativeTime(kf) {
					return kf.time.type === 'relative' || kf.time.type === 'multiple';
				})
				.map(function toId(kf) {
					return kf.id;
				});
			issues.push({
				code: 'unresolved_start',
				keyframeIds: ids,
				message
			});
		} else if (message.includes('duration reconciliation failed')) {
			const pendingMatch = message.match(/: (.+)$/);
			const pendingIds = pendingMatch ? pendingMatch[1].split(', ') : [];
			issues.push({
				code: 'unresolved_start',
				keyframeIds: pendingIds,
				message
			});
		} else {
			issues.push({
				code: 'unresolved_start',
				keyframeIds: [],
				message
			});
		}
	}

	if (issues.length > 0) {
		return { ok: false, issues };
	}

	return { ok: true };
}

/**
 * Returns true if applying proposed timing to keyframeId would fail validation.
 * Used by the sidebar parent picker to disable options that would create a cycle.
 */
export function wouldCreateTimingCycle(
	keyframeId: string,
	proposedTime: type_time,
	proposedDuration: type_duration,
	allKeyframes: type_reconciliation_keyframe[]
): boolean {
	const patched = allKeyframes.map(function patchKeyframe(kf) {
		if (kf.id !== keyframeId) return kf;
		return { ...kf, time: proposedTime, duration: proposedDuration };
	});
	return !validateKeyframeTiming(patched).ok;
}

/**
 * Lists keyframe IDs that reference `targetId` as a timing parent (start or duration).
 */
export function getTimingDependents(
	targetId: string,
	keyframes: type_reconciliation_keyframe[]
): string[] {
	const dependents: string[] = [];
	for (const kf of keyframes) {
		for (const parentID of collectTimingParentIds(kf)) {
			if (parentID === targetId && !dependents.includes(kf.id)) {
				dependents.push(kf.id);
			}
		}
	}
	return dependents;
}

/**
 * First keyframe that references `targetId` as a timing parent, in flatten order.
 * Used by Shift+Down dependent selection when multiple children exist.
 */
export function getPrimaryTimingDependentId(
	targetId: string,
	keyframes: type_reconciliation_keyframe[]
): string | null {
	return getTimingDependents(targetId, keyframes)[0] ?? null;
}

/* ───── Dry-run reconcile (mirrors 01_reconcileKeyframes_time logic) ───── */

type ReconciledEntry = {
	reconciled: { startTime: number; endTime: number };
	keyframe: type_reconciliation_keyframe;
};

function isAbsoluteKeyframe(
	kf: type_reconciliation_keyframe
): kf is type_reconciliation_keyframe & { time: { type: 'absolute'; value: number } } {
	return kf.time.type === 'absolute';
}

function isRelativeOrMultipleKeyframe(kf: type_reconciliation_keyframe): boolean {
	return kf.time.type === 'relative' || kf.time.type === 'multiple';
}

function tryResolveDurationDry(
	keyframe: type_reconciliation_keyframe,
	startTime: number,
	resolvedMap: Map<string, ReconciledEntry>,
	startTimeMap: Map<string, number>
): number | null {
	if (typeof keyframe.duration === 'number') {
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
			`Keyframe "${keyframe.id}" has invalid relative duration: target end time ${targetTime.toFixed(2)}s is before start time ${startTime.toFixed(2)}s.`
		);
	}
	return duration;
}

function tryResolveKeyframeTimeDry(
	keyframe: type_reconciliation_keyframe,
	resolvedMap: Map<string, ReconciledEntry>,
	startTimeMap: Map<string, number>
): { resolved: boolean; startTime: number } {
	if (keyframe.time.type === 'absolute') {
		return { resolved: true, startTime: keyframe.time.value };
	}

	if (keyframe.time.type === 'relative') {
		const { parentID, side, offset = 0 } = keyframe.time.value;
		if (side === 'Start') {
			const parentStart = startTimeMap.get(parentID);
			if (parentStart === undefined) return { resolved: false, startTime: -1 };
			return { resolved: true, startTime: parentStart + offset };
		}
		const parentKf = resolvedMap.get(parentID);
		if (!parentKf) return { resolved: false, startTime: -1 };
		return { resolved: true, startTime: parentKf.reconciled.endTime + offset };
	}

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

	return { resolved: false, startTime: -1 };
}

function dryRunReconcileTiming(keyframes: type_reconciliation_keyframe[]): void {
	const absoluteKeyframes = keyframes.filter(isAbsoluteKeyframe);
	let unresolvedTimeKeyframes = keyframes.filter(isRelativeOrMultipleKeyframe);
	const resolvedMap = new Map<string, ReconciledEntry>();
	const startTimeMap = new Map<string, number>();
	const pendingDurationKeyframes: Array<{
		startTime: number;
		keyframe: type_reconciliation_keyframe;
	}> = [];

	for (const keyframe of absoluteKeyframes) {
		const startTime = keyframe.time.value;
		startTimeMap.set(keyframe.id, startTime);
		const duration = tryResolveDurationDry(keyframe, startTime, resolvedMap, startTimeMap);
		if (duration !== null) {
			resolvedMap.set(keyframe.id, {
				reconciled: { startTime, endTime: startTime + duration },
				keyframe
			});
		} else {
			pendingDurationKeyframes.push({ startTime, keyframe });
		}
	}

	const MAX_ITERATIONS = 100;
	for (
		let iteration = 0;
		iteration < MAX_ITERATIONS && unresolvedTimeKeyframes.length > 0;
		iteration++
	) {
		const stillUnresolved: typeof unresolvedTimeKeyframes = [];
		let madeProgress = false;

		for (const keyframe of unresolvedTimeKeyframes) {
			const { resolved, startTime } = tryResolveKeyframeTimeDry(
				keyframe,
				resolvedMap,
				startTimeMap
			);
			if (!resolved) {
				stillUnresolved.push(keyframe);
				continue;
			}
			startTimeMap.set(keyframe.id, startTime);
			const duration = tryResolveDurationDry(keyframe, startTime, resolvedMap, startTimeMap);
			if (duration !== null) {
				resolvedMap.set(keyframe.id, {
					reconciled: { startTime, endTime: startTime + duration },
					keyframe
				});
				madeProgress = true;
			} else {
				pendingDurationKeyframes.push({ startTime, keyframe });
				madeProgress = true;
			}
		}

		unresolvedTimeKeyframes = stillUnresolved;
		if (!madeProgress) break;
	}

	if (unresolvedTimeKeyframes.length > 0) {
		const unresolvedDetails = unresolvedTimeKeyframes.map(function formatUnresolved(kf) {
			if (kf.time.type === 'relative') {
				return `${kf.id} (depends on: ${kf.time.value.parentID})`;
			}
			if (kf.time.type === 'multiple') {
				return `${kf.id} (depends on: ${kf.time.values.map((v) => v.parentID).join(', ')})`;
			}
			return kf.id;
		});
		throw new Error(
			`Keyframe time reconciliation failed with ${unresolvedTimeKeyframes.length} unresolved keyframes.\n` +
				`Unresolved keyframes: ${unresolvedDetails.join(', ')}`
		);
	}

	for (
		let iteration = 0;
		iteration < MAX_ITERATIONS && pendingDurationKeyframes.length > 0;
		iteration++
	) {
		let madeProgress = false;
		const stillPending: typeof pendingDurationKeyframes = [];

		for (const { startTime, keyframe } of pendingDurationKeyframes) {
			const duration = tryResolveDurationDry(keyframe, startTime, resolvedMap, startTimeMap);
			if (duration !== null) {
				resolvedMap.set(keyframe.id, {
					reconciled: { startTime, endTime: startTime + duration },
					keyframe
				});
				madeProgress = true;
			} else {
				stillPending.push({ startTime, keyframe });
			}
		}

		pendingDurationKeyframes.length = 0;
		pendingDurationKeyframes.push(...stillPending);
		if (!madeProgress) {
			const pendingIds = stillPending.map(function toId(p) {
				return p.keyframe.id;
			});
			throw new Error(
				`Keyframe duration reconciliation failed. Unresolved duration dependencies: ${pendingIds.join(', ')}`
			);
		}
	}
}

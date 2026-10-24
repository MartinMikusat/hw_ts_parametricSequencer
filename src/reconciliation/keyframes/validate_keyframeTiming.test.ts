import { describe, it, expect } from 'vitest';
import {
	validateKeyframeTiming,
	wouldCreateTimingCycle,
	getTimingDependents,
	getTimingParentIds,
	getPrimaryTimingParentId,
	getPrimaryTimingDependentId
} from './validate_keyframeTiming';
import type { type_separatedKeyframes } from './types';
import { SceneObject } from '../types/types_sceneModel';

function mockSceneObject(id: string): SceneObject {
	return { sceneObjectID: id, markers: {} } as SceneObject;
}

function flattenKeyframes(separated: type_separatedKeyframes) {
	return [
		...separated.modelKeyframes,
		...separated.cameraKeyframes,
		...(separated.audioKeyframes ?? []),
		...(separated.lightKeyframes ?? [])
	];
}

describe('validateKeyframeTiming', () => {
	it('returns ok for valid relative duration chain', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'absolute', value: 0 },
					duration: 5,
					opacity: 1
				},
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 2 },
					duration: { type: 'relative', value: { parentID: 'B', side: 'End' } },
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(validateKeyframeTiming(keyframes)).toEqual({ ok: true });
	});

	it('detects duplicate IDs', () => {
		const obj = mockSceneObject('obj');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'dup',
					sceneObject: obj,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'dup',
					sceneObject: obj,
					time: { type: 'absolute', value: 1 },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const result = validateKeyframeTiming(keyframes);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues[0].code).toBe('duplicate_id');
		}
	});

	it('detects missing parent', () => {
		const obj = mockSceneObject('obj');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: obj,
					time: { type: 'relative', value: { parentID: 'missing', side: 'Start', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const result = validateKeyframeTiming(keyframes);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.some((i) => i.code === 'missing_parent')).toBe(true);
		}
	});

	it('detects self-reference', () => {
		const obj = mockSceneObject('obj');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: obj,
					time: { type: 'relative', value: { parentID: 'A', side: 'Start', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const result = validateKeyframeTiming(keyframes);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.some((i) => i.code === 'self_reference')).toBe(true);
		}
	});

	it('detects duration cycle', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: { type: 'relative', value: { parentID: 'B', side: 'End' } },
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'absolute', value: 0 },
					duration: { type: 'relative', value: { parentID: 'A', side: 'End' } },
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const result = validateKeyframeTiming(keyframes);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.some((i) => i.code === 'duration_cycle')).toBe(true);
		}
	});

	it('detects start-time cycle', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'relative', value: { parentID: 'B', side: 'End', offset: 0 } },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'relative', value: { parentID: 'A', side: 'End', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const result = validateKeyframeTiming(keyframes);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.some((i) => i.code === 'start_time_cycle')).toBe(true);
		}
	});

	it('detects negative relative duration', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'absolute', value: 0 },
					duration: 2,
					opacity: 1
				},
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 5 },
					duration: { type: 'relative', value: { parentID: 'B', side: 'End' } },
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const result = validateKeyframeTiming(keyframes);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.some((i) => i.code === 'negative_duration')).toBe(true);
		}
	});
});

describe('wouldCreateTimingCycle', () => {
	it('returns true when selecting a parent would create a cycle', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'relative', value: { parentID: 'A', side: 'Start', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		const wouldCycle = wouldCreateTimingCycle(
			'A',
			{ type: 'relative', value: { parentID: 'B', side: 'Start', offset: 0 } },
			1,
			keyframes
		);
		expect(wouldCycle).toBe(true);
	});
});

describe('getTimingDependents', () => {
	it('lists keyframes that reference target as timing parent', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'relative', value: { parentID: 'A', side: 'Start', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(getTimingDependents('A', keyframes)).toEqual(['B']);
	});
});

describe('getTimingParentIds', () => {
	it('returns relative start parent', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'relative', value: { parentID: 'A', side: 'Start', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(getTimingParentIds(keyframes[1]!)).toEqual(['A']);
		expect(getPrimaryTimingParentId(keyframes[1]!)).toBe('A');
	});

	it('returns duration parent when start is absolute', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'absolute', value: 2 },
					duration: {
						type: 'relative',
						value: { parentID: 'A', side: 'End', offset: 0 }
					},
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(getTimingParentIds(keyframes[1]!)).toEqual(['A']);
		expect(getPrimaryTimingParentId(keyframes[1]!)).toBe('A');
	});

	it('prefers first multiple start dependency', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const objC = mockSceneObject('objC');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'absolute', value: 1 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'C',
					sceneObject: objC,
					time: {
						type: 'multiple',
						values: [
							{ parentID: 'A', side: 'Start', offset: 0 },
							{ parentID: 'B', side: 'End', offset: 0 }
						]
					},
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(getTimingParentIds(keyframes[2]!)).toEqual(['A', 'B']);
		expect(getPrimaryTimingParentId(keyframes[2]!)).toBe('A');
	});

	it('dedupes duplicate parent references', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: {
						type: 'multiple',
						values: [
							{ parentID: 'A', side: 'Start', offset: 0 },
							{ parentID: 'A', side: 'End', offset: 0 }
						]
					},
					duration: {
						type: 'relative',
						value: { parentID: 'A', side: 'End', offset: 0 }
					},
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(getTimingParentIds(keyframes[1]!)).toEqual(['A']);
	});
});

describe('getPrimaryTimingDependentId', () => {
	it('returns first dependent in flatten order', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const objC = mockSceneObject('objC');
		const keyframes = flattenKeyframes({
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: 1,
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'relative', value: { parentID: 'A', side: 'Start', offset: 0 } },
					duration: 1,
					opacity: 1
				},
				{
					id: 'C',
					sceneObject: objC,
					time: { type: 'relative', value: { parentID: 'A', side: 'End', offset: 0 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		});
		expect(getPrimaryTimingDependentId('A', keyframes)).toBe('B');
	});
});

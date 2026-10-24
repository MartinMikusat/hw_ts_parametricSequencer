import { describe, it, expect } from 'vitest';
import { reconcileKeyframesTime } from './01_reconcileKeyframes_time';
import type { type_separatedKeyframes } from './types';
import { SceneObject } from '../types/types_sceneModel';

/** Minimal mock SceneObject for tests. */
function mockSceneObject(id: string): SceneObject {
	return { sceneObjectID: id, markers: {} } as SceneObject;
}

describe('reconcileKeyframesTime', () => {
	it('resolves relative duration: A ends when B ends', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes: type_separatedKeyframes = {
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
		};
		const result = reconcileKeyframesTime(keyframes);
		const kfA = result.modelKeyframes.find((k) => k.keyframe.id === 'A');
		const kfB = result.modelKeyframes.find((k) => k.keyframe.id === 'B');
		expect(kfB?.reconciled.endTime).toBe(5);
		expect(kfA?.reconciled.startTime).toBe(2);
		expect(kfA?.reconciled.endTime).toBe(5); // A ends when B ends
	});

	it('resolves relative duration with offset', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes: type_separatedKeyframes = {
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
					time: { type: 'absolute', value: 0 },
					duration: { type: 'relative', value: { parentID: 'B', side: 'End', offset: 0.5 } },
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};
		const result = reconcileKeyframesTime(keyframes);
		const kfA = result.modelKeyframes.find((k) => k.keyframe.id === 'A');
		expect(kfA?.reconciled.endTime).toBe(5.5); // B ends at 5, +0.5 offset
	});

	it('throws when relative duration resolves to negative (target end before start)', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes: type_separatedKeyframes = {
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
		};
		expect(() => reconcileKeyframesTime(keyframes)).toThrow(/invalid relative duration/);
	});

	it('throws on circular duration dependency (A ends when B ends, B ends when A ends)', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes: type_separatedKeyframes = {
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
		};
		expect(() => reconcileKeyframesTime(keyframes)).toThrow(/Circular duration dependency/);
	});

	it('resolves child start relative to parent start while parent duration is pending', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const objC = mockSceneObject('objC');
		const keyframes: type_separatedKeyframes = {
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
					time: { type: 'absolute', value: 5 },
					duration: 2,
					opacity: 1
				},
				{
					id: 'C',
					sceneObject: objC,
					time: { type: 'relative', value: { parentID: 'A', side: 'Start', offset: 1 } },
					duration: 1,
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};
		const result = reconcileKeyframesTime(keyframes);
		const kfC = result.modelKeyframes.find((k) => k.keyframe.id === 'C');
		expect(kfC?.reconciled.startTime).toBe(1); // A starts at 0, C starts at 0 + 1
	});

	it('resolves valid cross-reference: A ends at B Start, B ends at A End', () => {
		const objA = mockSceneObject('objA');
		const objB = mockSceneObject('objB');
		const keyframes: type_separatedKeyframes = {
			modelKeyframes: [
				{
					id: 'A',
					sceneObject: objA,
					time: { type: 'absolute', value: 0 },
					duration: { type: 'relative', value: { parentID: 'B', side: 'Start' } },
					opacity: 1
				},
				{
					id: 'B',
					sceneObject: objB,
					time: { type: 'absolute', value: 5 },
					duration: { type: 'relative', value: { parentID: 'A', side: 'End' } },
					opacity: 1
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};
		const result = reconcileKeyframesTime(keyframes);
		const kfA = result.modelKeyframes.find((k) => k.keyframe.id === 'A');
		const kfB = result.modelKeyframes.find((k) => k.keyframe.id === 'B');
		// A ends at B's start = 5. So A: 0-5, duration 5.
		expect(kfA?.reconciled.startTime).toBe(0);
		expect(kfA?.reconciled.endTime).toBe(5);
		// B ends at A's end = 5. So B: 5-5, duration 0.
		expect(kfB?.reconciled.startTime).toBe(5);
		expect(kfB?.reconciled.endTime).toBe(5);
	});
});

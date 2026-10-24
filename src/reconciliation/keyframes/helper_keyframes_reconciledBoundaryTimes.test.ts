import { describe, it, expect } from 'vitest';
import {
	helper_keyframes_adjacentBoundaryTime,
	helper_keyframes_adjacentEntityKeyframeScrollStep,
	helper_keyframes_entityKeyframeIdAtBoundary,
	helper_keyframes_entityKeyframesInTimingParentOrder,
	helper_keyframes_entityKeyframeScrollSteps,
	helper_keyframes_entityReconciledBoundaryTimes,
	helper_keyframes_reconciledBoundaryTimes,
	type type_entityBoundaryTrack
} from './helper_keyframes_reconciledBoundaryTimes';
import type { type_duration, type_separatedKeyframes_extended, type_time } from './types';

function mockExtendedKeyframe<T>(
	keyframe: T,
	startTime: number,
	endTime: number
): {
	keyframe: T;
	reconciled: { startTime: number; endTime: number };
	extended: { startTime: number; endTime: number };
} {
	return {
		keyframe,
		reconciled: { startTime, endTime },
		extended: { startTime, endTime }
	};
}

function mockReconciledKeyframe(
	id: string,
	startTime: number,
	endTime: number,
	sceneObjectId = 'part-a',
	timing?: {
		time?: type_time;
		duration?: type_duration;
	}
): type_separatedKeyframes_extended['modelKeyframes'][number] {
	return {
		keyframe: {
			id,
			sceneObject: { sceneObjectID: sceneObjectId },
			time: timing?.time ?? { type: 'absolute', value: startTime },
			duration: timing?.duration ?? endTime - startTime
		} as type_separatedKeyframes_extended['modelKeyframes'][number]['keyframe'],
		reconciled: { startTime, endTime },
		extended: { startTime, endTime }
	};
}

function mockReconciled(
	modelKeyframes: type_separatedKeyframes_extended['modelKeyframes']
): type_separatedKeyframes_extended {
	return {
		modelKeyframes,
		cameraKeyframes: [],
		audioKeyframes: [],
		lightKeyframes: []
	};
}

describe('helper_keyframes_reconciledBoundaryTimes', () => {
	it('collects, sorts, and dedupes reconciled start/end times', () => {
		const reconciled = mockReconciled([
			mockReconciledKeyframe('a', 5, 10),
			mockReconciledKeyframe('b', 0, 2),
			mockReconciledKeyframe('c', 2, 2)
		]);

		expect(helper_keyframes_reconciledBoundaryTimes(reconciled)).toEqual([0, 2, 5, 10]);
	});

	it('includes boundaries from all keyframe types', () => {
		const reconciled: type_separatedKeyframes_extended = {
			modelKeyframes: [mockReconciledKeyframe('m', 1, 3)],
			cameraKeyframes: [
				mockExtendedKeyframe(
					{
						id: 'c',
						chapter: 'test',
						time: { type: 'absolute', value: 4 },
						duration: 2,
						rotationX: 0,
						rotationY: 0,
						target: { x: 0, y: 0, z: 0 },
						zoom: 100
					},
					4,
					6
				)
			],
			audioKeyframes: [
				mockExtendedKeyframe(
					{
						id: 'a',
						time: { type: 'absolute', value: 7 },
						duration: 1,
						audio: 'clip'
					},
					7,
					8
				)
			],
			lightKeyframes: [
				mockExtendedKeyframe(
					{
						id: 'l',
						lightId: 'key',
						time: { type: 'absolute', value: 9 },
						duration: 1,
						rotationX: 0,
						rotationY: 0,
						target: { x: 0, y: 0, z: 0 },
						zoom: 100
					},
					9,
					10
				)
			]
		};

		expect(helper_keyframes_reconciledBoundaryTimes(reconciled)).toEqual([1, 3, 4, 6, 7, 8, 9, 10]);
	});
});

describe('helper_keyframes_adjacentBoundaryTime', () => {
	const boundaries = [0, 2, 5, 10];

	it('returns the next boundary strictly after current time', () => {
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 2, 1)).toBe(5);
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 2.5, 1)).toBe(5);
	});

	it('returns the previous boundary strictly before current time', () => {
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 5, -1)).toBe(2);
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 4.9, -1)).toBe(2);
	});

	it('skips staying on the current boundary when stepping right or left', () => {
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 5, 1)).toBe(10);
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 5, -1)).toBe(2);
	});

	it('returns null at the ends of the boundary list', () => {
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 10, 1)).toBeNull();
		expect(helper_keyframes_adjacentBoundaryTime(boundaries, 0, -1)).toBeNull();
	});

	it('returns null for empty boundaries', () => {
		expect(helper_keyframes_adjacentBoundaryTime([], 1, 1)).toBeNull();
	});
});

describe('helper_keyframes_entityReconciledBoundaryTimes', () => {
	it('returns boundaries for one SceneObject only', () => {
		const reconciled = mockReconciled([
			mockReconciledKeyframe('a', 0, 2, 'part-a'),
			mockReconciledKeyframe('b', 5, 10, 'part-b'),
			mockReconciledKeyframe('c', 2, 5, 'part-a')
		]);

		expect(helper_keyframes_entityReconciledBoundaryTimes(reconciled, 'part-a')).toEqual([0, 2, 5]);
		expect(helper_keyframes_entityReconciledBoundaryTimes(reconciled, 'part-b')).toEqual([5, 10]);
	});

	it('returns empty array when the instance has no keyframes', () => {
		const reconciled = mockReconciled([mockReconciledKeyframe('a', 0, 2, 'part-a')]);
		expect(helper_keyframes_entityReconciledBoundaryTimes(reconciled, 'missing')).toEqual([]);
	});
});

describe('helper_keyframes_entityKeyframeIdAtBoundary', () => {
	const tracks: type_entityBoundaryTrack[] = [
		{
			entityId: 'part-a',
			type: 'model',
			laneIndex: 0,
			keyframes: [
				{ id: 'kf-a', startTime: 0, endTime: 2 },
				{ id: 'kf-b', startTime: 2, endTime: 5 }
			]
		},
		{
			entityId: 'part-a',
			type: 'model',
			laneIndex: 1,
			keyframes: [{ id: 'kf-overlap', startTime: 1, endTime: 3 }]
		},
		{
			entityId: 'part-b',
			type: 'model',
			laneIndex: 0,
			keyframes: [{ id: 'kf-other', startTime: 2, endTime: 4 }]
		}
	];

	it('prefers the keyframe starting at the boundary over one ending there', () => {
		expect(helper_keyframes_entityKeyframeIdAtBoundary(tracks, 'part-a', 2)).toBe('kf-b');
	});

	it('prefers lowest lane when multiple keyframes match', () => {
		expect(helper_keyframes_entityKeyframeIdAtBoundary(tracks, 'part-a', 1)).toBe('kf-overlap');
	});

	it('ignores other entities', () => {
		expect(helper_keyframes_entityKeyframeIdAtBoundary(tracks, 'part-a', 4)).toBeNull();
	});
});

describe('helper_keyframes_entityKeyframesInTimingParentOrder', () => {
	it('places timing parents before dependents regardless of reconciled start time', () => {
		const keyframes = [
			mockReconciledKeyframe('child', 0, 3, 'part-a', {
				time: { type: 'relative', value: { parentID: 'parent', side: 'Start', offset: 0 } }
			}),
			mockReconciledKeyframe('parent', 0, 2, 'part-a')
		];

		expect(
			helper_keyframes_entityKeyframesInTimingParentOrder(keyframes).map((kf) => kf.keyframe.id)
		).toEqual(['parent', 'child']);
	});

	it('sorts sibling roots by reconciled start time', () => {
		const keyframes = [
			mockReconciledKeyframe('later', 5, 8, 'part-a'),
			mockReconciledKeyframe('earlier', 1, 3, 'part-a')
		];

		expect(
			helper_keyframes_entityKeyframesInTimingParentOrder(keyframes).map((kf) => kf.keyframe.id)
		).toEqual(['earlier', 'later']);
	});
});

describe('helper_keyframes_entityKeyframeScrollSteps', () => {
	it('orders start then end per keyframe without interleaving by time', () => {
		const reconciled = mockReconciled([
			mockReconciledKeyframe('kf-a', 2, 5, 'part-a'),
			mockReconciledKeyframe('kf-b', 2, 4, 'part-a')
		]);

		expect(helper_keyframes_entityKeyframeScrollSteps(reconciled, 'part-a')).toEqual([
			{ time: 2, keyframeId: 'kf-a', sortIndex: 0, edge: 'start' },
			{ time: 5, keyframeId: 'kf-a', sortIndex: 0, edge: 'end' },
			{ time: 2, keyframeId: 'kf-b', sortIndex: 1, edge: 'start' },
			{ time: 4, keyframeId: 'kf-b', sortIndex: 1, edge: 'end' }
		]);
	});

	it('orders keyframes by timing parent chain before start/end pairs', () => {
		const reconciled = mockReconciled([
			mockReconciledKeyframe('child', 0, 4, 'part-a', {
				time: { type: 'relative', value: { parentID: 'parent', side: 'Start', offset: 0 } }
			}),
			mockReconciledKeyframe('parent', 0, 2, 'part-a')
		]);

		expect(
			helper_keyframes_entityKeyframeScrollSteps(reconciled, 'part-a').map(
				(step) => step.keyframeId
			)
		).toEqual(['parent', 'parent', 'child', 'child']);
	});

	it('includes both start and end for each keyframe when they differ', () => {
		const reconciled = mockReconciled([mockReconciledKeyframe('kf-a', 0, 2, 'part-a')]);
		expect(helper_keyframes_entityKeyframeScrollSteps(reconciled, 'part-a')).toEqual([
			{ time: 0, keyframeId: 'kf-a', sortIndex: 0, edge: 'start' },
			{ time: 2, keyframeId: 'kf-a', sortIndex: 0, edge: 'end' }
		]);
	});
});

describe('helper_keyframes_adjacentEntityKeyframeScrollStep', () => {
	const reconciled = mockReconciled([
		mockReconciledKeyframe('kf-a', 2, 5, 'part-a'),
		mockReconciledKeyframe('kf-b', 2, 4, 'part-a')
	]);
	const steps = helper_keyframes_entityKeyframeScrollSteps(reconciled, 'part-a');

	it('walks start then end of each keyframe before the next keyframe', () => {
		expect(helper_keyframes_adjacentEntityKeyframeScrollStep(steps, 2, 'kf-a', 1)).toEqual({
			time: 5,
			keyframeId: 'kf-a',
			sortIndex: 0,
			edge: 'end'
		});
		expect(helper_keyframes_adjacentEntityKeyframeScrollStep(steps, 5, 'kf-a', 1)).toEqual({
			time: 2,
			keyframeId: 'kf-b',
			sortIndex: 1,
			edge: 'start'
		});
	});

	it('steps from end of one keyframe back to its start', () => {
		expect(helper_keyframes_adjacentEntityKeyframeScrollStep(steps, 5, 'kf-a', -1)).toEqual({
			time: 2,
			keyframeId: 'kf-a',
			sortIndex: 0,
			edge: 'start'
		});
	});
});

import { describe, expect, it } from 'vitest';
import { SceneObject } from '../types/types_sceneModel';
import type { type_keyframe_model } from '../keyframes/types';
import { reconcileGltfAnimationForObject } from './reconcile_gltfAnimation';

function mockSceneObject(id: string): SceneObject {
	return new SceneObject(id, {});
}

function modelKf(
	id: string,
	sceneObjectID: string,
	start: number,
	duration: number,
	gltfAnimation: type_keyframe_model['gltfAnimation']
): Parameters<typeof reconcileGltfAnimationForObject>[0][number] {
	return {
		keyframe: {
			id,
			sceneObject: mockSceneObject(sceneObjectID),
			time: { type: 'absolute', value: start },
			duration,
			easing: 'linear',
			gltfAnimation
		},
		reconciled: { startTime: start, endTime: start + duration },
		extended: { startTime: start, endTime: start + duration }
	};
}

describe('reconcileGltfAnimationForObject', () => {
	it('lerps progress 0 to 0.5 over 2s', () => {
		const keyframes = [modelKf('a', 'cable', 0, 2, { clip: 'route', progress: 0.5 })];
		const mid = reconcileGltfAnimationForObject(keyframes, 'cable', 1);
		expect(mid.gltfClip).toBe('route');
		expect(mid.gltfProgress).toBeCloseTo(0.25, 2);
	});

	it('latest startTime wins during overlap', () => {
		const keyframes = [
			modelKf('a', 'cable', 0, 2, { clip: 'route', progress: 1 }),
			modelKf('b', 'cable', 0.5, 2, { clip: 'unroute', progress: 1 })
		];
		const at075 = reconcileGltfAnimationForObject(keyframes, 'cable', 0.75);
		expect(at075.gltfClip).toBe('unroute');
		expect(at075.gltfProgress).toBeCloseTo(0.125, 2);
	});
});

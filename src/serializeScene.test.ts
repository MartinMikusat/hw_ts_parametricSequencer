import { describe, expect, it } from 'vitest';
import { SceneObject } from './reconciliation/types/types_sceneModel';
import { hydrateScene, serializeScene } from './serializeScene';

describe('scene interaction-state serialization', () => {
	it('round-trips optional pickability and transparency state', () => {
		const part = new SceneObject('part');
		const serialized = serializeScene({
			modelKeyframes: [
				{
					id: 'interaction',
					sceneObject: part,
					time: { type: 'absolute', value: 0 },
					duration: 0,
					pickable: false,
					transparencyMode: 'blue-noise'
				}
			],
			cameraKeyframes: [],
			audioKeyframes: []
		});
		expect(serialized.modelKeyframes[0]).toMatchObject({
			pickable: false,
			transparencyMode: 'blue-noise'
		});
		expect(hydrateScene(serialized, new Map([['part', part]])).modelKeyframes[0]).toMatchObject({
			pickable: false,
			transparencyMode: 'blue-noise'
		});
	});
});

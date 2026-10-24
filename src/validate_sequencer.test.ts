import { describe, expect, it } from 'vitest';
import { serializableSceneDefinitionSchema } from './validate_sequencer';

const base = {
	cameraKeyframes: [],
	audioKeyframes: []
};

describe('sequencer interaction-state validation', () => {
	it('accepts optional pickability and transparency mode', () => {
		expect(
			serializableSceneDefinitionSchema.safeParse({
				...base,
				modelKeyframes: [
					{
						id: 'state',
						sceneObjectID: 'part',
						time: { type: 'absolute', value: 1 },
						duration: 0,
						pickable: false,
						transparencyMode: 'blue-noise'
					}
				]
			}).success
		).toBe(true);
	});

	it('rejects conflicting values for one instance at one time', () => {
		const result = serializableSceneDefinitionSchema.safeParse({
			...base,
			modelKeyframes: [
				{
					id: 'first',
					sceneObjectID: 'part',
					time: { type: 'absolute', value: 1 },
					duration: 0,
					pickable: true
				},
				{
					id: 'second',
					sceneObjectID: 'part',
					time: { type: 'absolute', value: 1 },
					duration: 0,
					pickable: false
				}
			]
		});
		expect(result.success).toBe(false);
	});
});

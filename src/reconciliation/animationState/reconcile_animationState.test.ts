import { describe, it, expect } from 'vitest';
import { reconcile_animationState } from './reconcile_animationState';
import type { type_separatedKeyframes_extended } from '../keyframes/types';
import { SceneObject } from '../types/types_sceneModel';

describe('reconcile_animationState', () => {
	it('should interpolate position linearly', () => {
		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'kf1',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: { sceneObjectID: 'model1' } as any,
						position: { type: 'absolute', value: { x: 0, y: 0, z: 0 } },
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				},
				{
					keyframe: {
						id: 'kf2',
						duration: 2,
						time: { type: 'absolute', value: 2 },
						sceneObject: { sceneObjectID: 'model1' } as any,
						position: { type: 'absolute', value: { x: 10, y: 0, z: 0 } },
						easing: 'linear'
					},
					reconciled: { startTime: 2, endTime: 4 },
					extended: { startTime: 2, endTime: 4 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		// At time 1 (midpoint of first keyframe), position should be halfway to next keyframe?
		// Wait, the logic is: keyframe defines target state at end of duration?
		// Or keyframe defines state during its duration?
		// Let's check the logic in reconcile_animationState.ts
		// "processPosition... lerp(targetPosition, progression)"
		// It seems it interpolates FROM previous state TO current keyframe target state over duration.

		// Initial state is 0,0,0.
		// First keyframe: duration 2, target 0,0,0. So it stays at 0,0,0.

		const state1 = reconcile_animationState(mockKeyframes, 1);
		const model1 = state1.models.get('model1');
		expect(model1).toBeDefined();
		expect(model1?.position.x).toBeCloseTo(0);

		// Second keyframe: starts at 2, ends at 4. Target 10,0,0.
		// At time 3 (midpoint), it should be at 5,0,0 (lerp from 0 to 10).
		const state2 = reconcile_animationState(mockKeyframes, 3);
		const model2 = state2.models.get('model1');
		expect(model2?.position.x).toBeCloseTo(5);
	});

	it('should handle marker positioning', () => {
		const parentModel = new SceneObject('parent', {
			'marker-offset': { position: { x: 0, y: 5, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
		});
		const childModel = { sceneObjectID: 'child' };

		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				// Parent moves to (10, 0, 0) from t=0 to t=2
				{
					keyframe: {
						id: 'parent-move',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: parentModel as any,
						position: { type: 'absolute', value: { x: 10, y: 0, z: 0 } },
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				},
				// Child attached to marker on parent from t=0 to t=2
				{
					keyframe: {
						id: 'child-attach',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: childModel as any,
						position: {
							type: 'marker',
							value: {
								parent: parentModel,
								markerID: 'marker-offset',
								offset: { x: 0, y: 0, z: 0 }
							}
						},
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		// At t=2, parent is at (10, 0, 0).
		// Child should be at parent position + offset = (10, 5, 0).
		const state = reconcile_animationState(mockKeyframes, 2);

		const parentState = state.models.get('parent');
		expect(parentState?.position.x).toBeCloseTo(10);
		expect(parentState?.position.y).toBeCloseTo(0);

		const childState = state.models.get('child');
		expect(childState?.position.x).toBeCloseTo(10);
		expect(childState?.position.y).toBeCloseTo(5);
	});

	it('should interpolate material between keyframes', () => {
		const baseMaterial = {
			roughness: 0.8,
			metalness: 0,
			colorR: 61,
			colorG: 15,
			colorB: 15,
			emissiveR: 255,
			emissiveG: 255,
			emissiveB: 255,
			emissiveIntensity: 0,
			envMapIntensity: 1
		};
		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'kf1',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: { sceneObjectID: 'model1' } as any,
						material: { ...baseMaterial, emissiveIntensity: 0 },
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				},
				{
					keyframe: {
						id: 'kf2',
						duration: 2,
						time: { type: 'absolute', value: 2 },
						sceneObject: { sceneObjectID: 'model1' } as any,
						material: { ...baseMaterial, emissiveIntensity: 0.6 },
						easing: 'linear'
					},
					reconciled: { startTime: 2, endTime: 4 },
					extended: { startTime: 2, endTime: 4 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		const stateAt1 = reconcile_animationState(mockKeyframes, 1);
		const modelAt1 = stateAt1.models.get('model1');
		expect(modelAt1?.material?.emissiveIntensity).toBeCloseTo(0); // kf1 target is 0, at t=1 still interpolating toward 0

		const stateAt3 = reconcile_animationState(mockKeyframes, 3);
		const modelAt3 = stateAt3.models.get('model1');
		// At t=3: in kf2 (start 2, end 4), progression 0.5. Prev from kf1 end had emissiveIntensity 0. Target 0.6. lerp(0, 0.6, 0.5) = 0.3
		expect(modelAt3?.material?.emissiveIntensity).toBeCloseTo(0.3);
	});

	it('should compose marker rotation with explicit relative rotation on the same keyframe', () => {
		const parentModel = new SceneObject('parent', {
			slot: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
		});
		const childModel = { sceneObjectID: 'child' };

		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'parent-hold',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: parentModel as any,
						opacity: 1,
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				},
				{
					keyframe: {
						id: 'child-slot',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: childModel as any,
						position: {
							type: 'marker',
							value: { parent: parentModel, markerID: 'slot' }
						},
						rotation: { type: 'relative', value: { x: 90, y: 0, z: 0 } },
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		const stateAtEnd = reconcile_animationState(mockKeyframes, 2);
		const childAtEnd = stateAtEnd.models.get('child');
		expect(childAtEnd).toBeDefined();
		// Marker identity + 90° X relative: w ≈ cos(45°), x ≈ sin(45°)
		expect(childAtEnd?.rotation.w).toBeCloseTo(Math.cos(Math.PI / 4), 2);
		expect(childAtEnd?.rotation.x).toBeCloseTo(Math.sin(Math.PI / 4), 2);
	});

	it('should blend overlapping marker and relative rotation keyframes in order', () => {
		const parentModel = new SceneObject('parent', {
			slot: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
		});
		const childModel = { sceneObjectID: 'child' };

		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'parent-hold',
						duration: 6,
						time: { type: 'absolute', value: 0 },
						sceneObject: parentModel as any,
						opacity: 1,
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 6 },
					extended: { startTime: 0, endTime: 6 }
				},
				{
					keyframe: {
						id: 'child-marker',
						duration: 4,
						time: { type: 'absolute', value: 0 },
						sceneObject: childModel as any,
						position: {
							type: 'marker',
							value: { parent: parentModel, markerID: 'slot' }
						},
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 4 },
					extended: { startTime: 0, endTime: 4 }
				},
				{
					keyframe: {
						id: 'child-spin',
						duration: 4,
						time: { type: 'absolute', value: 2 },
						sceneObject: childModel as any,
						rotation: { type: 'relative', value: { x: 90, y: 0, z: 0 } },
						easing: 'linear'
					},
					reconciled: { startTime: 2, endTime: 6 },
					extended: { startTime: 2, endTime: 6 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		const stateAt3 = reconcile_animationState(mockKeyframes, 3);
		const childAt3 = stateAt3.models.get('child');
		expect(childAt3).toBeDefined();
		// Marker at t=3: progression 0.75. Spin at t=3: progression 0.25 toward +90° X on marker result.
		expect(childAt3?.rotation.w).toBeGreaterThan(0.9);
		expect(childAt3?.rotation.x).toBeGreaterThan(0);
		expect(childAt3?.rotation.x).toBeLessThan(Math.sin(Math.PI / 4));
	});

	it('should multiply child opacity by parent opacity when child is at marker position', () => {
		const parentModel = new SceneObject('parent', {
			'marker-a': { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
		});
		const childModel = { sceneObjectID: 'child' };

		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				// Parent: reveal (opacity 1) at t=0-1
				{
					keyframe: {
						id: 'parent-reveal',
						duration: 1,
						time: { type: 'absolute', value: 0 },
						sceneObject: parentModel as any,
						opacity: 1,
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 1 },
					extended: { startTime: 0, endTime: 1 }
				},
				// Parent: fade out (opacity 0) at t=1-3
				{
					keyframe: {
						id: 'parent-fade',
						duration: 2,
						time: { type: 'absolute', value: 1 },
						sceneObject: parentModel as any,
						opacity: 0,
						easing: 'linear'
					},
					reconciled: { startTime: 1, endTime: 3 },
					extended: { startTime: 1, endTime: 3 }
				},
				// Child: at marker on parent, opacity 1, at t=1-3
				{
					keyframe: {
						id: 'child-slot-in',
						duration: 2,
						time: { type: 'absolute', value: 1 },
						sceneObject: childModel as any,
						opacity: 1,
						position: {
							type: 'marker',
							value: { parent: parentModel, markerID: 'marker-a' }
						},
						easing: 'linear'
					},
					reconciled: { startTime: 1, endTime: 3 },
					extended: { startTime: 1, endTime: 3 }
				},
				// Child: no position (material-only), at t=3-5 - tests markerParentID persistence
				{
					keyframe: {
						id: 'child-emissive-off',
						duration: 2,
						time: { type: 'absolute', value: 3 },
						sceneObject: childModel as any,
						easing: 'linear',
						material: {
							roughness: 0.3,
							metalness: 0.9,
							colorR: 181,
							colorG: 166,
							colorB: 66,
							emissiveR: 255,
							emissiveG: 255,
							emissiveB: 255,
							emissiveIntensity: 0,
							envMapIntensity: 1
						}
					},
					reconciled: { startTime: 3, endTime: 5 },
					extended: { startTime: 3, endTime: 5 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		// At t=2: parent in fade (progression 0.5), parent opacity = 0.5. Child in slot-in (progression 0.5), base opacity = 0.5, effective = 0.5 * 0.5 = 0.25
		const stateAt2 = reconcile_animationState(mockKeyframes, 2);
		expect(stateAt2.models.get('parent')?.opacity).toBeCloseTo(0.5);
		expect(stateAt2.models.get('child')?.opacity).toBeCloseTo(0.25);

		// At t=4: parent fade ended at t=3, parent holds opacity 0. Child in emissive-off (no position), markerParentID from slot-in, opacity = 1 * 0 = 0
		const stateAt4 = reconcile_animationState(mockKeyframes, 4);
		expect(stateAt4.models.get('parent')?.opacity).toBeCloseTo(0);
		expect(stateAt4.models.get('child')?.opacity).toBeCloseTo(0);
	});

	it('should blend overlapping camera keyframes by each keyframe progression', () => {
		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [],
			cameraKeyframes: [
				{
					keyframe: {
						id: 'camera-a',
						chapter: 'intro',
						duration: 5,
						time: { type: 'absolute', value: 0 },
						rotationX: 0,
						rotationY: 0,
						target: { x: 0, y: 1, z: 0 },
						zoom: 100,
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 5 },
					extended: { startTime: 0, endTime: 5 }
				},
				{
					keyframe: {
						id: 'camera-b',
						chapter: 'intro',
						duration: 5,
						time: { type: 'absolute', value: 2 },
						rotationX: 0,
						rotationY: 0,
						target: { x: 0, y: 2, z: 0 },
						zoom: 100,
						easing: 'linear'
					},
					reconciled: { startTime: 2, endTime: 7 },
					extended: { startTime: 2, endTime: 7 }
				}
			],
			audioKeyframes: [],
			lightKeyframes: []
		};

		// At t=3: both keyframes overlap. A: progression 3/5=0.6. B: progression 1/5=0.2 (1s into B's 5s duration).
		// Default: target (0,0,0), zoom 135.
		// After A: target = lerp((0,0,0), (0,1,0), 0.6) = (0, 0.6, 0). zoom = lerp(135, 100, 0.6) = 114.
		// After B: target = lerp((0,0.6,0), (0,2,0), 0.2) = (0, 0.88, 0). zoom = lerp(114, 100, 0.2) = 111.2.
		const state = reconcile_animationState(mockKeyframes, 3);
		expect(state.camera.target.y).toBeCloseTo(0.88);
		expect(state.camera.zoom).toBeCloseTo(111.2);

		// At t=1: only A overlaps. A: progression 1/5=0.2. target = lerp((0,0,0), (0,1,0), 0.2) = (0, 0.2, 0).
		const stateAt1 = reconcile_animationState(mockKeyframes, 1);
		expect(stateAt1.camera.target.y).toBeCloseTo(0.2);

		// At t=6: A past (prog=1), B in progress. A: full apply -> target (0,1,0). B: progression 4/5=0.8, target = lerp((0,1,0), (0,2,0), 0.8) = (0, 1.8, 0).
		const stateAt6 = reconcile_animationState(mockKeyframes, 6);
		expect(stateAt6.camera.target.y).toBeCloseTo(1.8);
	});

	it('should use scene zeroCamera as baseline before the first camera keyframe', () => {
		const mockKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [],
			cameraKeyframes: [
				{
					keyframe: {
						id: 'camera-late',
						chapter: 'intro',
						duration: 2,
						time: { type: 'absolute', value: 5 },
						rotationX: 10,
						rotationY: 20,
						target: { x: 1, y: 2, z: 3 },
						zoom: 80
					},
					reconciled: { startTime: 5, endTime: 7 },
					extended: { startTime: 5, endTime: 7 }
				}
			],
			audioKeyframes: [],
			lightKeyframes: [],
			zeroCamera: {
				target: { x: 10, y: 20, z: 30 },
				rotationX: 1,
				rotationY: 2,
				zoom: 200
			}
		};

		const stateBefore = reconcile_animationState(mockKeyframes, 2);
		expect(stateBefore.camera.target.x).toBeCloseTo(10);
		expect(stateBefore.camera.target.y).toBeCloseTo(20);
		expect(stateBefore.camera.zoom).toBeCloseTo(200);
		expect(stateBefore.camera.rotationX).toBeCloseTo(1);
	});

	it('should apply easing curve when keyframe has easing', () => {
		// Single keyframe 0-2, target x=10. At t=1 (midpoint), linear gives x=5, ease gives different value.
		const linearKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'linear',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: { sceneObjectID: 'm1' } as any,
						position: { type: 'absolute', value: { x: 10, y: 0, z: 0 } },
						easing: 'linear'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};
		const easeKeyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'ease',
						duration: 2,
						time: { type: 'absolute', value: 0 },
						sceneObject: { sceneObjectID: 'm1' } as any,
						position: { type: 'absolute', value: { x: 10, y: 0, z: 0 } },
						easing: 'ease'
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		const stateLinear = reconcile_animationState(linearKeyframes, 1);
		const stateEase = reconcile_animationState(easeKeyframes, 1);

		expect(stateLinear.models.get('m1')?.position.x).toBeCloseTo(5); // linear at 50% = 5
		expect(stateEase.models.get('m1')?.position.x).not.toBeCloseTo(5); // ease at 50% != 5 (ease accelerates then decelerates)
		expect(stateEase.models.get('m1')?.position.x).toBeGreaterThan(0);
		expect(stateEase.models.get('m1')?.position.x).toBeLessThan(10);
	});

	it('throws when lightKeyframe references unknown lightId', () => {
		const keyframesWithInvalidLightId: type_separatedKeyframes_extended = {
			modelKeyframes: [],
			cameraKeyframes: [],
			audioKeyframes: [],
			lights: [
				{
					id: 'light-1',
					target: [0, 0, 0],
					rotationX: 20,
					rotationY: 25,
					zoom: 100,
					width: 10,
					height: 10,
					intensity: 500,
					color: '#ffffff'
				}
			],
			lightKeyframes: [
				{
					keyframe: {
						id: 'light-kf',
						lightId: 'typo-light',
						time: { type: 'absolute', value: 0 },
						duration: 2,
						target: [0, 5, 0],
						rotationX: 20,
						rotationY: 25,
						zoom: 100
					},
					reconciled: { startTime: 0, endTime: 2 },
					extended: { startTime: 0, endTime: 2 }
				}
			]
		};

		expect(() => reconcile_animationState(keyframesWithInvalidLightId, 1)).toThrow(
			/Light keyframe references unknown lightId: typo-light\. Valid lightIds: light-1/
		);
	});

	it('switches pick and transparency state at keyframe starts and persists it', () => {
		const model = { sceneObjectID: 'part' } as any;
		const keyframes: type_separatedKeyframes_extended = {
			modelKeyframes: [
				{
					keyframe: {
						id: 'disable-picking',
						sceneObject: model,
						time: { type: 'absolute', value: 5 },
						duration: 0,
						pickable: false,
						transparencyMode: 'blue-noise'
					},
					reconciled: { startTime: 5, endTime: 5 },
					extended: { startTime: 5, endTime: 5 }
				},
				{
					keyframe: {
						id: 'restore-auto',
						sceneObject: model,
						time: { type: 'absolute', value: 7 },
						duration: 0,
						transparencyMode: 'auto'
					},
					reconciled: { startTime: 7, endTime: 7 },
					extended: { startTime: 7, endTime: 7 }
				}
			],
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		};

		expect(reconcile_animationState(keyframes, 4).models.get('part')).toMatchObject({
			pickable: true,
			transparencyMode: 'auto'
		});
		expect(reconcile_animationState(keyframes, 6).models.get('part')).toMatchObject({
			pickable: false,
			transparencyMode: 'blue-noise'
		});
		expect(reconcile_animationState(keyframes, 8).models.get('part')).toMatchObject({
			pickable: false,
			transparencyMode: 'auto'
		});
	});

	it('rejects conflicting interaction state at one reconciled time', () => {
		const model = { sceneObjectID: 'part' } as any;
		const keyframes = {
			modelKeyframes: [true, false].map((pickable, index) => ({
				keyframe: {
					id: `pick-${index}`,
					sceneObject: model,
					time: { type: 'absolute' as const, value: 1 },
					duration: 0,
					pickable
				},
				reconciled: { startTime: 1, endTime: 1 },
				extended: { startTime: 1, endTime: 1 }
			})),
			cameraKeyframes: [],
			audioKeyframes: [],
			lightKeyframes: []
		} satisfies type_separatedKeyframes_extended;
		expect(() => reconcile_animationState(keyframes, 1)).toThrow(
			/Conflicting pick or transparency state/
		);
	});
});

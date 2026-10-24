import type { OracleCaseInput, OracleSceneObject } from '../src/oracle';
import type { SerializableSceneDefinition } from '../src/serializeScene';

type Def = SerializableSceneDefinition;
type Model = Def['modelKeyframes'][number];
type Camera = Def['cameraKeyframes'][number];
type Light = NonNullable<Def['lightKeyframes']>[number];

const abs = (value: number) => ({ type: 'absolute' as const, value });
const rel = (parentID: string, side: 'Start' | 'End', offset = 0) => ({
	type: 'relative' as const,
	value: { parentID, side, offset }
});
const relDur = (parentID: string, side: 'Start' | 'End', offset?: number) => ({
	type: 'relative' as const,
	value: offset === undefined ? { parentID, side } : { parentID, side, offset }
});
const v3 = (x: number, y: number, z: number) => ({ x, y, z });

function object(id: string, markers: OracleSceneObject['markers'] = {}): OracleSceneObject {
	return { instanceID: id, markers };
}

function model(id: string, sceneObjectID: string, fields: Partial<Model> = {}): Model {
	return { id, sceneObjectID, time: abs(0), duration: 1, ...fields };
}

function camera(id: string, fields: Partial<Camera> = {}): Camera {
	return {
		id,
		chapter: 'c',
		time: abs(0),
		duration: 1,
		target: v3(0, 0, 0),
		rotationX: 0,
		rotationY: 0,
		zoom: 100,
		...fields
	};
}

function light(id: string, lightId: string, fields: Partial<Light> = {}): Light {
	return {
		id,
		lightId,
		time: abs(0),
		duration: 1,
		target: v3(0, 0, 0),
		rotationX: 0,
		rotationY: 0,
		zoom: 100,
		...fields
	};
}

function scene(objects: OracleSceneObject[], definition: Partial<Def>): OracleCaseInput {
	return {
		sceneObjects: objects,
		definition: { modelKeyframes: [], cameraKeyframes: [], audioKeyframes: [], ...definition }
	};
}

const MARKERS = {
	top: { position: v3(0, 10, 0), rotation: v3(0, Math.PI / 2, 0) },
	side: { position: v3(5, 0, -2), rotation: v3(0.3, 0, 0.1) }
};

const BASE_LIGHT = {
	id: 'key',
	target: v3(1, 2, 3),
	rotationX: 35,
	rotationY: 35,
	zoom: 100,
	width: 40,
	height: 40,
	intensity: 80,
	color: '#ffffff'
};

export const SYNTHETIC_CASES: Record<string, OracleCaseInput> = {
	time_resolution: scene([object('a'), object('b')], {
		modelKeyframes: [
			model('a.move', 'a', { duration: 2, position: { type: 'absolute', value: v3(1, 0, 0) } }),
			model('b.after', 'b', {
				time: rel('a.move', 'End', 0.5),
				duration: relDur('a.move', 'End', 3),
				opacity: 1
			}),
			model('b.join', 'b', {
				time: {
					type: 'multiple',
					values: [
						{ parentID: 'a.move', side: 'Start', offset: 0.25 },
						{ parentID: 'b.after', side: 'End', offset: -1 }
					]
				},
				duration: relDur('cam.1', 'Start', 4),
				position: { type: 'relative', value: v3(0, 2, 0) }
			})
		],
		cameraKeyframes: [
			camera('cam.1', { time: rel('b.after', 'Start', 1), duration: 0.5, rotationX: 30 }),
			camera('cam.0', { time: abs(0.2), duration: relDur('a.move', 'End'), rotationY: 90 })
		]
	}),
	rotation_modes: scene([object('p'), object('q')], {
		modelKeyframes: [
			model('p.abs', 'p', {
				duration: 2,
				opacity: 1,
				rotation: { type: 'absolute', value: v3(10, 20, 30) },
				easing: 'linear'
			}),
			model('p.rel', 'p', {
				time: rel('p.abs', 'End'),
				duration: 2,
				rotation: { type: 'relative', value: v3(45, 0, 90) },
				position: { type: 'absolute', value: v3(2, 3, 4) },
				easing: 'ease-in'
			}),
			model('p.world', 'p', {
				time: rel('p.rel', 'End', 0.25),
				duration: 1.5,
				rotation: { type: 'worldSpace', value: v3(0, 120, 0) },
				position: { type: 'relative', value: v3(-1, 0.5, 0) },
				easing: 'ease-out'
			}),
			model('p.flip', 'p', {
				time: rel('p.world', 'End'),
				duration: 1,
				rotation: { type: 'absolute', value: v3(0, 0, 200) },
				opacity: 0.25
			}),
			model('q.fade', 'q', { duration: 0, opacity: 0.5, easing: 'ease-in-out' }),
			model('q.zero', 'q', { time: abs(3), duration: 0, opacity: 1, position: { type: 'absolute', value: v3(9, 9, 9) } })
		]
	}),
	markers: scene(
		[object('parent', MARKERS), object('child', MARKERS), object('grand'), object('free')],
		{
			modelKeyframes: [
				model('grand.attach', 'grand', {
					time: rel('child.attach', 'End'),
					duration: 1,
					opacity: 1,
					position: { type: 'marker', value: { parentID: 'child', markerID: 'side' } }
				}),
				model('child.attach', 'child', {
					time: rel('parent.in', 'End'),
					duration: 2,
					opacity: 1,
					position: {
						type: 'marker',
						value: {
							parentID: 'parent',
							markerID: 'top',
							offset: v3(1, 2, 3),
							rotationOffset: v3(0.1, 0.2, 0.3)
						}
					}
				}),
				model('child.fade', 'child', {
					time: rel('child.attach', 'End'),
					duration: 1,
					opacity: 0.5
				}),
				model('parent.in', 'parent', {
					duration: 2,
					opacity: 0.8,
					rotation: { type: 'absolute', value: v3(0, 90, 0) },
					position: { type: 'absolute', value: v3(5, 0, 5) }
				}),
				model('parent.turn', 'parent', {
					time: rel('parent.in', 'End', 1),
					duration: 2,
					rotation: { type: 'relative', value: v3(30, 0, 0) },
					position: { type: 'relative', value: v3(1, 1, 1) }
				}),
				model('free.move', 'free', { duration: 4, position: { type: 'absolute', value: v3(1, 1, 1) } })
			]
		}
	),
	material_custom: scene([object('m')], {
		modelKeyframes: [
			model('m.first', 'm', {
				duration: 2,
				opacity: 1,
				material: { roughness: 0.2, colorR: 10.4, colorG: 200.5 },
				custom: { glow: { value: 1.5 }, temp: { value: 100, interpolation: 'step' } }
			}),
			model('m.second', 'm', {
				time: rel('m.first', 'End'),
				duration: 2,
				material: { roughness: 0.9, colorR: 250.6, emissiveIntensity: 2, envMapIntensity: 0.1 },
				custom: { glow: { value: -0.5, interpolation: 'linear' }, extra: { value: 4 } },
				easing: 'ease-out'
			}),
			model('m.third', 'm', {
				time: rel('m.second', 'End'),
				duration: 1,
				material: { metalness: 1, emissiveR: 3.5, emissiveG: 2.5, emissiveB: -0.5 },
				custom: { temp: { value: 0, interpolation: 'step' } }
			})
		]
	}),
	gltf_animation: scene([object('g'), object('h')], {
		modelKeyframes: [
			model('g.play', 'g', { duration: 2, gltfAnimation: { clip: 'open', progress: 1 } }),
			model('g.hold', 'g', { time: rel('g.play', 'End'), duration: 1, gltfAnimation: { progress: 0.25 } }),
			model('g.overlap', 'g', {
				time: abs(3.5),
				duration: 3,
				gltfAnimation: { clip: 'close', progress: 0.75 },
				easing: 'linear'
			}),
			model('g.takeover', 'g', { time: abs(4), duration: 1, gltfAnimation: { progress: 0 } }),
			model('h.play', 'h', { time: abs(1), duration: 0, gltfAnimation: { clip: 'spin', progress: 0.5 } }),
			model('h.move', 'h', { duration: 5, position: { type: 'absolute', value: v3(1, 2, 3) } })
		]
	}),
	camera_lights: scene([object('a')], {
		modelKeyframes: [model('a.move', 'a', { duration: 3, opacity: 1 })],
		cameraKeyframes: [
			camera('cam.b', {
				time: abs(2),
				duration: 1,
				zoom: 50,
				rotationX: 80,
				spring: { stiffness: 0.5 },
				easing: 'ease-in'
			}),
			camera('cam.a', {
				time: abs(0.5),
				duration: 1,
				zoom: 200,
				target: v3(1, 2, 3),
				spring: { instant: true, damping: 0.5 }
			}),
			camera('cam.c', { time: abs(4), duration: 0, rotationY: -45, easing: 'linear' })
		],
		lights: [BASE_LIGHT, { ...BASE_LIGHT, id: 'fill', color: '#aabbcc', shadowBias: -0.001, shadowNormalBias: 0.5 }],
		lightKeyframes: [
			light('l.key2', 'key', { time: abs(2), duration: 1, intensity: 10, color: '#112233', rotationX: 10 }),
			light('l.key1', 'key', { time: abs(1), duration: 0.5, width: 5, shadowBias: 0.01, easing: 'ease-out' }),
			light('l.fill', 'fill', { time: abs(0), duration: 2, height: 90, shadowNormalBias: 0.1 })
		],
		zeroCamera: { target: v3(1, 1, 1), rotationX: 10, rotationY: 20, zoom: 33 }
	}),
	interaction_state: scene([object('a'), object('b')], {
		modelKeyframes: [
			model('a.hide', 'a', { duration: 1, pickable: false }),
			model('a.mode', 'a', { time: abs(0), duration: 2, transparencyMode: 'blue-noise', opacity: 0.5 }),
			model('a.show', 'a', { time: abs(2), duration: 1, pickable: true, transparencyMode: 'auto' }),
			model('b.tie', 'b', { time: abs(1), duration: 1, opacity: 1 }),
			model('b.tie2', 'b', { time: abs(1), duration: 2, position: { type: 'absolute', value: v3(1, 1, 1) } })
		]
	}),
	error_duplicate_id: scene([object('a')], {
		modelKeyframes: [model('dup', 'a'), model('dup', 'a', { time: abs(1) })]
	}),
	error_missing_parent: scene([object('a')], {
		modelKeyframes: [model('a.1', 'a', { time: rel('ghost', 'End') })]
	}),
	error_self_reference: scene([object('a')], {
		modelKeyframes: [model('a.1', 'a', { time: rel('a.1', 'Start') })]
	}),
	error_start_cycle: scene([object('a')], {
		modelKeyframes: [
			model('a.1', 'a', { time: rel('a.2', 'End') }),
			model('a.2', 'a', { time: rel('a.1', 'End') })
		]
	}),
	error_duration_cycle: scene([object('a')], {
		modelKeyframes: [
			model('a.1', 'a', { duration: relDur('a.2', 'End') }),
			model('a.2', 'a', { duration: relDur('a.1', 'End') })
		]
	}),
	error_negative_duration: scene([object('a')], {
		modelKeyframes: [
			model('a.1', 'a', { time: abs(5), duration: 1 }),
			model('a.2', 'a', { time: abs(6), duration: relDur('a.1', 'Start', 0.5) })
		]
	}),
	error_unresolved_start: scene([object('a')], {
		modelKeyframes: [
			model('a.1', 'a', { duration: relDur('a.2', 'End') }),
			model('a.2', 'a', { time: rel('a.1', 'End') })
		]
	}),
	error_model_cycle: scene([object('a', MARKERS), object('b', MARKERS)], {
		modelKeyframes: [
			model('a.1', 'a', { position: { type: 'marker', value: { parentID: 'b', markerID: 'top' } } }),
			model('b.1', 'b', { position: { type: 'marker', value: { parentID: 'a', markerID: 'top' } } })
		]
	}),
	error_model_unresolved: scene([object('a'), object('b', MARKERS)], {
		modelKeyframes: [
			model('a.1', 'a', { position: { type: 'marker', value: { parentID: 'b', markerID: 'top' } } })
		]
	}),
	error_unknown_light: scene([object('a')], {
		modelKeyframes: [model('a.1', 'a')],
		lights: [BASE_LIGHT],
		lightKeyframes: [light('l.1', 'missing')]
	}),
	error_conflicting_interaction: scene([object('a')], {
		modelKeyframes: [
			model('a.1', 'a', { time: abs(1), pickable: true }),
			model('a.2', 'a', { time: abs(1), pickable: false })
		]
	}),
	empty_scene: scene([], {})
};

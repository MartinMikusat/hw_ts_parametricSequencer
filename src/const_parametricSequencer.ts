import type {
	type_modelLibrary_detailView,
	type_modelLibrary_detailViewCamera,
	type_scene_zeroCamera
} from './types/types_sceneObjects';
import type {
	type_keyframe_light,
	type_keyframe_material,
	type_lightConfig
} from './reconciliation/keyframes/types';

/**
 * Semantic compiler implementation contract required by manual source.
 * Motivation: compiler behavior changes invalidate generated scenes and review evidence even when source JSON is unchanged.
 */
export const CONST_SEQUENCER_AUTHORING_COMPILER_VERSION = '1.27.0';

/**
 * Default zero camera for new scenes (matches reconcile_animationState fallback).
 * Motivation: new scenes get an explicit editable baseline instead of relying on code defaults only.
 */
export const CONST_DEFAULT_SCENE_ZERO_CAMERA: type_scene_zeroCamera = {
	target: { x: 0, y: 0, z: 0 },
	rotationX: 0,
	rotationY: 0,
	zoom: 135
};

/**
 * Default 3-light rig for new scenes (matches clockwork2 seed layout).
 * Motivation: authors start with a usable lighting setup when creating a scene.
 */
export const CONST_DEFAULT_SCENE_LIGHTS: type_lightConfig[] = [
	{
		id: 'light-1',
		target: [0, 0, 0],
		rotationX: 26,
		rotationY: -157,
		zoom: 65,
		width: 10,
		height: 10,
		intensity: 1,
		color: '#ffe0e0',
		shadowBias: 0.005,
		shadowNormalBias: -0.07
	},
	{
		id: 'light-2',
		target: [0, 0, 0],
		rotationX: -65,
		rotationY: 104,
		zoom: 120,
		width: 20,
		height: 20,
		intensity: 1,
		color: '#ffffff',
		shadowBias: 0.006,
		shadowNormalBias: -0.52
	},
	{
		id: 'light-3',
		target: [0, 0, 0],
		rotationX: -18,
		rotationY: 90,
		zoom: 70,
		width: 10,
		height: 10,
		intensity: 4,
		color: '#ffc96b',
		shadowBias: -0.01,
		shadowNormalBias: 0.02
	}
];

/**
 * Instant t=0 keyframes mirroring each default light (duration 0).
 * Motivation: new scenes have lights applied at timeline start; chapter is omitted for later assignment.
 */
export const CONST_DEFAULT_SCENE_LIGHT_KEYFRAMES: type_keyframe_light[] =
	CONST_DEFAULT_SCENE_LIGHTS.map(function buildInitialLightKeyframe(light) {
		return {
			id: `initial-light-${light.id}`,
			lightId: light.id,
			time: { type: 'absolute' as const, value: 0 },
			duration: 0,
			target: Array.isArray(light.target)
				? light.target
				: [light.target.x, light.target.y, light.target.z],
			rotationX: light.rotationX,
			rotationY: light.rotationY,
			zoom: light.zoom,
			width: light.width,
			height: light.height,
			intensity: light.intensity,
			color: light.color,
			shadowBias: light.shadowBias,
			shadowNormalBias: light.shadowNormalBias
		};
	});

/** Default detail preview camera when model_library.detail_view.camera is missing. */
export const CONST_DEFAULT_MODEL_DETAIL_CAMERA: type_modelLibrary_detailViewCamera = {
	target: [0, 0, 0],
	rotationX: 0,
	rotationY: 0,
	zoom: 135
};

/** Fixed ids for the three library detail preview lights. */
export const CONST_LIBRARY_DETAIL_LIGHT_IDS = [
	'detail-light-1',
	'detail-light-2',
	'detail-light-3'
] as const;

/**
 * Default detail preview rig when model_library.detail_view is null.
 * Motivation: clones the scene default 3-light layout with detail-specific ids.
 */
export const CONST_DEFAULT_MODEL_DETAIL_VIEW: type_modelLibrary_detailView = {
	lights: CONST_DEFAULT_SCENE_LIGHTS.map(function mapDefaultDetailLight(light, index) {
		return {
			...light,
			id: CONST_LIBRARY_DETAIL_LIGHT_IDS[index]
		};
	}),
	camera: CONST_DEFAULT_MODEL_DETAIL_CAMERA
};

/** Default material when a keyframe does not define one. Gray, neutral. */
export const CONST_DEFAULT_MATERIAL: type_keyframe_material = {
	roughness: 0.5,
	metalness: 0.5,
	colorR: 128,
	colorG: 128,
	colorB: 128,
	emissiveR: 255,
	emissiveG: 255,
	emissiveB: 255,
	emissiveIntensity: 0,
	envMapIntensity: 1
};

/** Synthetic instance id for isolated library detail preview rendering. */
export const CONST_LIBRARY_PREVIEW_INSTANCE_ID = '__library_preview__';

/** Default exported model-library thumbnail edge length in pixels. */
export const CONST_LIBRARY_THUMBNAIL_OUTPUT_SIZE = 512;

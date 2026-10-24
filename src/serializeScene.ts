/**
 * Serialization layer for parametric sequencer scenes.
 *
 * Converts between SceneDefinition3D (with runtime SceneObject references)
 * and a JSON-serializable format for git compiled manuals.
 *
 * Runtime references replaced with string IDs:
 *   - type_keyframe_model.sceneObject → sceneObjectID
 *   - type_marker_position_value.parent → parentID
 */

import type {
	type_keyframe_camera,
	type_keyframe_light,
	type_keyframe_material,
	type_keyframe_model,
	type_time,
	type_duration,
	type_keyframe_rotation,
	type_keyframe_easing,
	type_custom,
	type_keyframe_gltfAnimation,
	type_transparency_mode,
	type_lightConfig
} from './reconciliation/keyframes/types';
import type { type_vec3, type_euler } from './reconciliation/math';
import type { SceneObject } from './reconciliation/types/types_sceneModel';
import type { type_scene_zeroCamera } from './types/types_sceneObjects';
import type { SceneDefinition3D } from './reconciliation/reconcileScene';

/* ───── Serializable types (JSONB-safe) ───── */

export type SerializableMarkerPosition = {
	parentID: string;
	markerID: string;
	offset?: type_vec3;
	rotationOffset?: type_euler;
};

export type SerializablePosition =
	| { type: 'absolute'; value: type_vec3 }
	| { type: 'relative'; value: type_vec3 }
	| { type: 'marker'; value: SerializableMarkerPosition };

export type SerializableModelKeyframe = {
	id: string;
	sceneObjectID: string;
	time: type_time;
	duration: type_duration;
	chapter?: string;
	chapter_ignoreForMovementVector?: boolean;
	material?: Partial<type_keyframe_material>;
	opacity?: number;
	pickable?: boolean;
	transparencyMode?: type_transparency_mode;
	position?: SerializablePosition;
	rotation?: type_keyframe_rotation;
	custom?: type_custom;
	gltfAnimation?: type_keyframe_gltfAnimation;
	easing?: type_keyframe_easing;
};

export type SerializableCameraKeyframe = type_keyframe_camera;

export type SerializableAudioKeyframe = {
	id: string;
	time: type_time;
	duration: type_duration;
	audioClipID: string;
	chapter?: string;
};

export type SerializableLightKeyframe = type_keyframe_light;

export type SerializableSceneDefinition = {
	modelKeyframes: SerializableModelKeyframe[];
	cameraKeyframes: SerializableCameraKeyframe[];
	audioKeyframes: SerializableAudioKeyframe[];
	lights?: type_lightConfig[];
	lightKeyframes?: SerializableLightKeyframe[];
	zeroCamera?: type_scene_zeroCamera;
};

/* ───── Serialize: SceneDefinition3D → JSONB ───── */

function serializePosition(pos: type_keyframe_model['position']): SerializablePosition | undefined {
	if (!pos) return undefined;
	if (pos.type === 'marker') {
		return {
			type: 'marker',
			value: {
				parentID: pos.value.parent.sceneObjectID,
				markerID: pos.value.markerID,
				offset: pos.value.offset,
				rotationOffset: pos.value.rotationOffset
			}
		};
	}
	return pos;
}

export function serializeScene(scene: SceneDefinition3D): SerializableSceneDefinition {
	const out: SerializableSceneDefinition = {
		modelKeyframes: scene.modelKeyframes.map((kf) => ({
			id: kf.id,
			sceneObjectID: kf.sceneObject.sceneObjectID,
			time: kf.time,
			duration: kf.duration,
			chapter: kf.chapter,
			chapter_ignoreForMovementVector: kf.chapter_ignoreForMovementVector,
			material: kf.material,
			opacity: kf.opacity,
			pickable: kf.pickable,
			transparencyMode: kf.transparencyMode,
			position: serializePosition(kf.position),
			rotation: kf.rotation,
			custom: kf.custom,
			gltfAnimation: kf.gltfAnimation,
			easing: kf.easing
		})),
		cameraKeyframes: scene.cameraKeyframes,
		audioKeyframes: (scene.audioKeyframes ?? []).map((kf) => ({
			id: kf.id,
			time: kf.time,
			duration: kf.duration,
			audioClipID: kf.audio,
			chapter: kf.chapter
		})),
		lights: scene.lights,
		lightKeyframes: scene.lightKeyframes,
		zeroCamera: scene.zeroCamera
	};
	return out;
}

/* ───── Hydrate: JSONB → SceneDefinition3D ───── */

function hydratePosition(
	pos: SerializablePosition | undefined,
	sceneObjectMap: Map<string, SceneObject>
): type_keyframe_model['position'] | undefined {
	if (!pos) return undefined;
	if (pos.type === 'marker') {
		const parent = sceneObjectMap.get(pos.value.parentID);
		if (!parent) {
			console.warn(
				`[hydrateScene] SceneObject "${pos.value.parentID}" not found for marker "${pos.value.markerID}"`
			);
			return undefined;
		}
		if (!parent.markers[pos.value.markerID]) {
			const available = Object.keys(parent.markers).join(', ') || '(none)';
			console.warn(
				`[hydrateScene] Marker "${pos.value.markerID}" not found on parent "${pos.value.parentID}". ` +
					`Available markers: ${available}`
			);
			return undefined;
		}
		return {
			type: 'marker',
			value: {
				parent,
				markerID: pos.value.markerID,
				offset: pos.value.offset,
				rotationOffset: pos.value.rotationOffset
			}
		};
	}
	return pos;
}

export function hydrateScene(
	data: SerializableSceneDefinition,
	sceneObjectMap: Map<string, SceneObject>
): SceneDefinition3D {
	return {
		modelKeyframes: data.modelKeyframes
			.map((skf) => {
				const sceneObject = sceneObjectMap.get(skf.sceneObjectID);
				if (!sceneObject) {
					console.warn(
						`[hydrateScene] Skipping model keyframe "${skf.id}": SceneObject "${skf.sceneObjectID}" not found`
					);
					return null;
				}
				return {
					id: skf.id,
					sceneObject,
					time: skf.time,
					duration: skf.duration,
					chapter: skf.chapter,
					chapter_ignoreForMovementVector: skf.chapter_ignoreForMovementVector,
					material: skf.material,
					opacity: skf.opacity,
					pickable: skf.pickable,
					transparencyMode: skf.transparencyMode,
					position: hydratePosition(skf.position, sceneObjectMap),
					rotation: skf.rotation,
					custom: skf.custom,
					gltfAnimation: skf.gltfAnimation,
					easing: skf.easing
				};
			})
			.filter((kf): kf is NonNullable<typeof kf> => kf !== null),
		cameraKeyframes: data.cameraKeyframes,
		audioKeyframes: data.audioKeyframes.map((kf) => ({
			id: kf.id,
			time: kf.time,
			duration: kf.duration,
			audio: kf.audioClipID,
			chapter: kf.chapter
		})),
		lights: data.lights,
		lightKeyframes: data.lightKeyframes,
		zeroCamera: data.zeroCamera
	};
}

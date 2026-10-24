import type { type_scene_zeroCamera } from '../../types/types_sceneObjects';
import type { type_vec3, type_euler } from '../math';
import type { type_marker_position_value, SceneObject } from '../types/types_sceneModel';

export type type_keyframe_position =
	| {
			type: 'absolute';
			value: type_vec3;
	  }
	| {
			type: 'relative';
			value: type_vec3;
	  }
	| {
			type: 'marker';
			value: type_marker_position_value;
	  };

export type type_keyframe_rotation =
	| {
			type: 'absolute';
			value: type_euler;
	  }
	| {
			type: 'relative';
			value: type_euler;
	  }
	| {
			type: 'worldSpace';
			value: type_euler;
	  };

type type_time_relative = {
	offset: number;
	side: 'Start' | 'End';
	parentID: string;
};

/**
 * Relative duration: end when another keyframe's Start or End occurs (+ optional offset).
 * Used when a keyframe's end time should align with another keyframe.
 */
export type type_duration_relative = {
	parentID: string;
	side: 'Start' | 'End';
	/** Seconds to add to the referenced time. Default 0. */
	offset?: number;
};

/**
 * Duration can be a fixed number (seconds) or relative to another keyframe's Start/End.
 */
export type type_duration =
	| number
	| {
			type: 'relative';
			value: type_duration_relative;
	  };

export type type_time =
	| {
			type: 'absolute';
			value: number;
	  }
	| {
			type: 'relative';
			value: type_time_relative;
	  }
	| {
			type: 'multiple';
			values: type_time_relative[];
	  };

/**
 * Interpolation method for custom properties.
 *
 * - `'linear'`: Smooth linear interpolation between values (default)
 * - `'step'`: Instant change at the end of the keyframe duration
 */
export type type_customProperty_interpolation = 'linear' | 'step';

/**
 * Animation curve (easing) for keyframe interpolation.
 * When omitted, defaults to 'ease' (cubic Bezier, CSS ease).
 *
 * - `'linear'`: Constant speed, no acceleration
 * - `'ease'`: Smooth acceleration and deceleration (default)
 * - `'ease-in'`: Slow start, fast end
 * - `'ease-out'`: Fast start, slow end
 * - `'ease-in-out'`: Slow start and end, fast middle
 */
export type type_keyframe_easing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

/**
 * Definition for a single custom property value.
 *
 * Custom properties allow animating arbitrary numeric values (e.g., brightness, intensity, temperature).
 * Each property can specify its own interpolation method.
 *
 * @example
 * ```typescript
 * {
 *   value: 1.5,
 *   interpolation: 'linear'
 * }
 * ```
 */
export type type_customProperty_definition = {
	/**
	 * The target value for this custom property.
	 * The animation system will interpolate from the previous value to this target.
	 */
	value: number;

	/**
	 * The interpolation method to use for this property.
	 * Defaults to 'linear' if not specified.
	 */
	interpolation?: type_customProperty_interpolation;
};

/**
 * Map of custom property names to their definitions.
 *
 * Allows animating arbitrary numeric properties beyond the built-in properties (opacity, position, rotation).
 * Each property name is a string identifier (e.g., "brightness", "intensity", "temperature").
 *
 * @example
 * ```typescript
 * {
 *   brightness: { value: 1.5, interpolation: 'linear' },
 *   intensity: { value: 0.8 },
 *   temperature: { value: 100, interpolation: 'step' }
 * }
 * ```
 */
export type type_custom = Record<string, type_customProperty_definition>;

/**
 * Material properties for a keyframe. All values are interpolated between keyframes.
 * Color and emissive stored as R,G,B (0–255); combined to hex when applying to Three.js.
 */
/**
 * GLTF clip animation on a model keyframe. Progress (0–1) remaps clip time to sequencer timing.
 * Clip step-switches when set; progress lerps within the winning keyframe segment.
 */
export type type_keyframe_gltfAnimation = {
	/** GLTF clip name from model_library metadata / GLB. */
	clip?: string;
	/** Normalized animation progress 0–1, lerped over keyframe duration. */
	progress?: number;
};

export type type_transparency_mode = 'auto' | 'blue-noise';

export type type_keyframe_material = {
	roughness: number;
	metalness: number;
	colorR: number;
	colorG: number;
	colorB: number;
	emissiveR: number;
	emissiveG: number;
	emissiveB: number;
	emissiveIntensity: number;
	envMapIntensity: number;
};

export type type_keyframe_model = {
	chapter?: string;
	/** When true, this keyframe is excluded when computing chapter movement vectors. Use for fade-in/out keyframes whose position movement is art-direction only. */
	chapter_ignoreForMovementVector?: boolean;
	duration: type_duration;
	id: string;
	/** Material properties. Interpolated between keyframes. Emissive intensity is inside material. Only keys present on the keyframe are animated. */
	material?: Partial<type_keyframe_material>;
	opacity?: number;
	/** Switches pointer picking at the keyframe start and persists until changed. */
	pickable?: boolean;
	/** Switches the renderer transparency algorithm at the keyframe start. */
	transparencyMode?: type_transparency_mode;
	position?: type_keyframe_position;
	rotation?: type_keyframe_rotation;
	/**
	 * Optional custom properties to animate.
	 * Allows animating arbitrary numeric values beyond built-in properties.
	 * Each property can specify its own interpolation method (linear or step).
	 * Properties persist across keyframes until explicitly changed.
	 *
	 * @example
	 * ```typescript
	 * custom: {
	 *   brightness: { value: 1.5, interpolation: 'linear' },
	 *   intensity: { value: 0.8 }
	 * }
	 * ```
	 */
	custom?: type_custom;
	/** Optional GLTF skeletal/morph clip with remapped progress (0–1). */
	gltfAnimation?: type_keyframe_gltfAnimation;
	/** Optional easing curve for interpolation. Defaults to 'ease' (cubic) when omitted. */
	easing?: type_keyframe_easing;
	sceneObject: SceneObject;
	time: type_time;
};

/**
 * Optional spring configuration for camera keyframe transitions.
 * Controls how the camera animates toward this keyframe's position.
 */
export type type_keyframe_camera_spring = {
	/** Spring stiffness (default 0.2). Higher = faster. */
	stiffness?: number;
	/** Spring damping (default 0.9). Higher = less bounce. */
	damping?: number;
	/** Instant transition: no spring smoothing, jump immediately. */
	instant?: boolean;
};

export type type_keyframe_camera = {
	chapter: string;
	duration: type_duration;
	id: string;
	rotationX: number;
	rotationY: number;
	target: type_vec3;
	time: type_time;
	zoom: number;
	/** Optional spring config for transition into this keyframe. */
	spring?: type_keyframe_camera_spring;
	/** Optional easing curve for interpolation. Defaults to 'ease' (cubic) when omitted. */
	easing?: type_keyframe_easing;
};

export type type_keyframes = type_keyframe_model | type_keyframe_camera;

/**
 * Audio keyframe: plays an audio clip during a time range.
 * Uses same time/duration types as model and camera keyframes.
 * The `audio` field is the clip suffix after `{sceneName}-` (e.g. `main-body-intro`
 * for storage file `{sceneName}/clockwork2-main-body-intro.mp3` under static/scene-audio).
 */
export type type_keyframe_audio = {
	chapter?: string;
	duration: type_duration;
	id: string;
	/** Clip suffix; resolved via helper_audio_resolveFilename + helper_audio_clipPublicUrl. */
	audio: string;
	time: type_time;
};

/**
 * Base light config for scene definition.
 * Same model as AnimatedCamera: target + rotationX + rotationY + zoom.
 */
export type type_lightConfig = {
	id: string;
	target: type_vec3 | [number, number, number];
	rotationX: number;
	rotationY: number;
	zoom: number;
	width: number;
	height: number;
	intensity: number;
	color: string;
	/** PointLight shadow bias. Default -0.0001 when omitted. */
	shadowBias?: number;
	/** PointLight shadow normalBias. Default 0.02 when omitted. */
	shadowNormalBias?: number;
};

/**
 * Light keyframe: animates a light over time.
 * References light by lightId (must exist in scene.lights).
 * Optional width, height, intensity, color inherit from base light when omitted.
 */
export type type_keyframe_light = {
	id: string;
	/** References light in scene.lights array. */
	lightId: string;
	time: type_time;
	duration: type_duration;
	chapter?: string;
	target: type_vec3 | [number, number, number];
	rotationX: number;
	rotationY: number;
	zoom: number;
	/** Optional. When omitted, use base light value. */
	width?: number;
	height?: number;
	intensity?: number;
	color?: string;
	/** Optional. When omitted, use base light value. */
	shadowBias?: number;
	/** Optional. When omitted, use base light value. */
	shadowNormalBias?: number;
	easing?: type_keyframe_easing;
};

// Separated keyframe arrays for pipeline processing
export interface type_separatedKeyframes {
	modelKeyframes: type_keyframe_model[];
	cameraKeyframes: type_keyframe_camera[];
	audioKeyframes: type_keyframe_audio[];
	lightKeyframes: type_keyframe_light[];
}

// Reconciled time structure (matching what's in reconcileKeyframesTime)
export interface type_time_reconciled {
	startTime: number;
	endTime: number;
}

// Extended time structure (matching what's in extendTimeOfKeyframes)
export interface type_time_extended {
	startTime: number;
	endTime: number;
}

// Separated reconciled keyframes
export interface type_separatedKeyframes_reconciled {
	modelKeyframes: Array<{
		keyframe: type_keyframe_model;
		reconciled: type_time_reconciled;
	}>;
	cameraKeyframes: Array<{
		keyframe: type_keyframe_camera;
		reconciled: type_time_reconciled;
	}>;
	audioKeyframes: Array<{
		keyframe: type_keyframe_audio;
		reconciled: type_time_reconciled;
	}>;
	lightKeyframes: Array<{
		keyframe: type_keyframe_light;
		reconciled: type_time_reconciled;
	}>;
}

/**
 * Scene definition as raw keyframes. No Node classes.
 * Used as the input format for reconcileScene.
 * Material properties are defined per keyframe via material.
 */
export interface type_sceneDefinition_keyframes {
	modelKeyframes: type_keyframe_model[];
	cameraKeyframes: type_keyframe_camera[];
	/** Optional. When omitted or empty, no audio plays. Excluded from reconciliation when useAudio is false. */
	audioKeyframes?: type_keyframe_audio[];
	/** Optional base light configs. Required when using lightKeyframes. */
	lights?: type_lightConfig[];
	/** Optional light keyframes for animating lights over time. */
	lightKeyframes?: type_keyframe_light[];
	/** Optional baseline camera before the first camera keyframe; code fallback when omitted. */
	zeroCamera?: type_scene_zeroCamera;
}

// Separated extended keyframes
export interface type_separatedKeyframes_extended {
	modelKeyframes: Array<{
		keyframe: type_keyframe_model;
		reconciled: type_time_reconciled;
		extended: type_time_extended;
	}>;
	cameraKeyframes: Array<{
		keyframe: type_keyframe_camera;
		reconciled: type_time_reconciled;
		extended: type_time_extended;
	}>;
	audioKeyframes: Array<{
		keyframe: type_keyframe_audio;
		reconciled: type_time_reconciled;
		extended: type_time_extended;
	}>;
	lightKeyframes: Array<{
		keyframe: type_keyframe_light;
		reconciled: type_time_reconciled;
		extended: type_time_extended;
	}>;
	/** Base light configs from scene. Populated by reconcileKeyframes when scene has lights. */
	lights?: type_lightConfig[];
	/** Baseline camera from scene definition. Populated by reconcileKeyframes when scene has zeroCamera. */
	zeroCamera?: type_scene_zeroCamera;
}

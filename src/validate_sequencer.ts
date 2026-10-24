/**
 * Validation for parametric sequencer data.
 * Validates Blender-exported scene JSON (voron-clockwork2, hardware, etc.).
 */

import * as z from 'zod';

/** Zod schema for JSON marker (location/rotation in degrees). */
const jsonMarkerSchema = z.object({
	location: z.object({ x: z.number(), y: z.number(), z: z.number() }),
	rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional()
});

/** Zod schema for GLTF animation clip metadata from Blender export. */
const jsonGltfAnimationClipSchema = z.object({
	name: z.string(),
	duration: z.number()
});

const jsonRenderingSchema = z.object({
	bevel: z.object({
		enabled: z.boolean(),
		radiusMm: z.number().min(0),
		autoAngleDegrees: z.number().min(0).max(180)
	})
});

/** Zod schema for JSON model entry. */
const jsonModelSchema = z.object({
	lods: z.array(z.string()).optional(),
	modelPath: z.string().optional(),
	markers: z.record(z.string(), jsonMarkerSchema).optional(),
	/** GLTF clip names and durations (highest LOD, opt-in animated models). */
	animations: z.array(jsonGltfAnimationClipSchema).optional(),
	rendering: jsonRenderingSchema.optional()
});

/** Zod schema for JSON scene format. */
const jsonSceneSchema = z.object({
	version: z.string().optional(),
	source: z.string().optional(),
	modelFolder: z.string().optional(),
	models: z.record(z.string(), jsonModelSchema),
	markers: z
		.array(z.object({ id: z.string(), markers: z.record(z.string(), jsonMarkerSchema).optional() }))
		.optional()
});

/** JSON marker format from Blender export (location/rotation in degrees). */
export type JsonMarker = z.infer<typeof jsonMarkerSchema>;

/** JSON model entry from Blender export. */
export type JsonModel = z.infer<typeof jsonModelSchema>;

/** GLTF animation clip metadata from Blender export. */
export type JsonGltfAnimationClip = z.infer<typeof jsonGltfAnimationClipSchema>;

/** JSON scene format from Blender export. */
export type JsonScene = z.infer<typeof jsonSceneSchema>;

/**
 * Validates and parses unknown data as JsonScene.
 * @throws ZodError if validation fails
 */
export function parseSceneJson(data: unknown): JsonScene {
	return jsonSceneSchema.parse(data);
}

/** Zod schema for model upload metadata in the editor. */
const modelUploadMetadataSchema = z.object({
	modelKey: z
		.string()
		.min(1)
		.regex(/^[a-z0-9][a-z0-9-]*$/, 'Model key must be lowercase kebab-case'),
	label: z.string().min(1)
});

/** Zod schema for scene object instance config. */
const sceneObjectConfigSchema = z.object({
	instanceID: z.string().min(1),
	modelKey: z.string().min(1)
});

/**
 * Validates model upload metadata from the editor.
 */
export function parseModelUploadMetadata(data: unknown) {
	return modelUploadMetadataSchema.parse(data);
}

/**
 * Validates scene object instance config array.
 */
export function parseSceneObjectConfig(data: unknown) {
	return z.array(sceneObjectConfigSchema).parse(data);
}

const vec3Schema = z.union([
	z.object({ x: z.number(), y: z.number(), z: z.number() }),
	z.tuple([z.number(), z.number(), z.number()])
]);

/** Zod schema for a library detail preview light (same pose model as scene lights). */
const modelLibraryDetailLightSchema = z.object({
	id: z.string().min(1),
	target: vec3Schema,
	rotationX: z.number(),
	rotationY: z.number(),
	zoom: z.number(),
	width: z.number(),
	height: z.number(),
	intensity: z.number(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
	shadowBias: z.number().optional(),
	shadowNormalBias: z.number().optional()
});

/** Zod schema for library detail preview camera (same pose model as scene camera keyframes). */
export const sceneZeroCameraSchema = z.object({
	target: vec3Schema,
	rotationX: z.number(),
	rotationY: z.number(),
	zoom: z.number()
});

/** @deprecated Use sceneZeroCameraSchema — kept as alias for detail_view camera shape. */
const modelLibraryDetailCameraSchema = sceneZeroCameraSchema;

const modelLibraryDetailViewSchema = z.object({
	lights: z
		.array(modelLibraryDetailLightSchema)
		.length(3)
		.refine(
			function hasExpectedLightIds(lights) {
				const ids = lights.map(function getId(light) {
					return light.id;
				});
				return (
					ids[0] === 'detail-light-1' && ids[1] === 'detail-light-2' && ids[2] === 'detail-light-3'
				);
			},
			{ message: 'detail_view lights must use ids detail-light-1..3' }
		),
	camera: modelLibraryDetailCameraSchema.optional()
});

export type ModelLibraryDetailView = z.infer<typeof modelLibraryDetailViewSchema>;

/**
 * Validates persisted model_library.detail_view JSON.
 * Motivation: keep preview rig shape stable across editor sessions and public reads.
 */
export function parseModelLibraryDetailView(data: unknown): ModelLibraryDetailView {
	return modelLibraryDetailViewSchema.parse(data);
}

export type SceneZeroCamera = z.infer<typeof sceneZeroCameraSchema>;

/**
 * Validates scene definition zero camera pose from the editor modal.
 * Motivation: persist a stable baseline before the first camera keyframe.
 */
export function parseSceneZeroCamera(data: unknown): SceneZeroCamera {
	return sceneZeroCameraSchema.parse(data);
}

/*
 * ** Offline authoring bundle **
 *
 * These schemas validate the JSONB boundary before runtime references are hydrated. This prevents
 * missing objects and markers from being silently dropped by the legacy hydration path.
 */
const timeRelativeSchema = z.object({
	offset: z.number(),
	side: z.enum(['Start', 'End']),
	parentID: z.string().min(1)
});

const keyframeTimeSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('absolute'), value: z.number().nonnegative() }),
	z.object({ type: z.literal('relative'), value: timeRelativeSchema }),
	z.object({ type: z.literal('multiple'), values: z.array(timeRelativeSchema).min(1) })
]);

const keyframeDurationSchema = z.union([
	z.number().nonnegative(),
	z.object({
		type: z.literal('relative'),
		value: z.object({
			parentID: z.string().min(1),
			side: z.enum(['Start', 'End']),
			offset: z.number().optional()
		})
	})
]);

const objectVec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
const easingSchema = z.enum(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);
const rotationSchema = z.object({
	type: z.enum(['absolute', 'relative', 'worldSpace']),
	value: objectVec3Schema
});
const materialSchema = z
	.object({
		roughness: z.number(),
		metalness: z.number(),
		colorR: z.number(),
		colorG: z.number(),
		colorB: z.number(),
		emissiveR: z.number(),
		emissiveG: z.number(),
		emissiveB: z.number(),
		emissiveIntensity: z.number(),
		envMapIntensity: z.number()
	})
	.partial();
const positionSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('absolute'), value: objectVec3Schema }),
	z.object({ type: z.literal('relative'), value: objectVec3Schema }),
	z.object({
		type: z.literal('marker'),
		value: z.object({
			parentID: z.string().min(1),
			markerID: z.string().min(1),
			offset: objectVec3Schema.optional(),
			rotationOffset: objectVec3Schema.optional()
		})
	})
]);
const modelKeyframeSchema = z.object({
	id: z.string().min(1),
	sceneObjectID: z.string().min(1),
	time: keyframeTimeSchema,
	duration: keyframeDurationSchema,
	chapter: z.string().optional(),
	chapter_ignoreForMovementVector: z.boolean().optional(),
	material: materialSchema.optional(),
	opacity: z.number().optional(),
	pickable: z.boolean().optional(),
	transparencyMode: z.enum(['auto', 'blue-noise']).optional(),
	position: positionSchema.optional(),
	rotation: rotationSchema.optional(),
	custom: z
		.record(
			z.string(),
			z.object({ value: z.number(), interpolation: z.enum(['linear', 'step']).optional() })
		)
		.optional(),
	gltfAnimation: z
		.object({ clip: z.string().optional(), progress: z.number().min(0).max(1).optional() })
		.optional(),
	easing: easingSchema.optional()
});
const cameraKeyframeSchema = z.object({
	id: z.string().min(1),
	chapter: z.string(),
	time: keyframeTimeSchema,
	duration: keyframeDurationSchema,
	target: objectVec3Schema,
	rotationX: z.number(),
	rotationY: z.number(),
	zoom: z.number(),
	spring: z
		.object({
			stiffness: z.number().optional(),
			damping: z.number().optional(),
			instant: z.boolean().optional()
		})
		.optional(),
	easing: easingSchema.optional()
});
const audioKeyframeSchema = z.object({
	id: z.string().min(1),
	time: keyframeTimeSchema,
	duration: keyframeDurationSchema,
	audioClipID: z.string().min(1),
	chapter: z.string().optional()
});
const lightSchema = z.object({
	id: z.string().min(1),
	target: vec3Schema,
	rotationX: z.number(),
	rotationY: z.number(),
	zoom: z.number(),
	width: z.number(),
	height: z.number(),
	intensity: z.number(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
	shadowBias: z.number().optional(),
	shadowNormalBias: z.number().optional()
});
const lightKeyframeSchema = lightSchema
	.omit({ width: true, height: true, intensity: true, color: true })
	.extend({
		lightId: z.string().min(1),
		time: keyframeTimeSchema,
		duration: keyframeDurationSchema,
		chapter: z.string().optional(),
		width: z.number().optional(),
		height: z.number().optional(),
		intensity: z.number().optional(),
		color: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.optional(),
		easing: easingSchema.optional()
	});

export const serializableSceneDefinitionSchema = z.object({
	modelKeyframes: z.array(modelKeyframeSchema).superRefine((keyframes, context) => {
		const values = new Map<string, { pickable?: boolean; transparencyMode?: string }>();
		for (const [index, keyframe] of keyframes.entries()) {
			const key = `${keyframe.sceneObjectID}:${JSON.stringify(keyframe.time)}`;
			const previous = values.get(key);
			if (
				previous &&
				((previous.pickable !== undefined &&
					keyframe.pickable !== undefined &&
					previous.pickable !== keyframe.pickable) ||
					(previous.transparencyMode !== undefined &&
						keyframe.transparencyMode !== undefined &&
						previous.transparencyMode !== keyframe.transparencyMode))
			) {
				context.addIssue({
					code: 'custom',
					path: [index],
					message: `Conflicting pick or transparency state for ${keyframe.sceneObjectID} at the same time`
				});
			}
			values.set(key, {
				pickable: keyframe.pickable ?? previous?.pickable,
				transparencyMode: keyframe.transparencyMode ?? previous?.transparencyMode
			});
		}
	}),
	cameraKeyframes: z.array(cameraKeyframeSchema),
	audioKeyframes: z.array(audioKeyframeSchema),
	lights: z.array(lightSchema).optional(),
	lightKeyframes: z.array(lightKeyframeSchema).optional(),
	zeroCamera: sceneZeroCameraSchema.optional()
});

const modelLibraryRowSchema = z.object({
	model_key: z.string().min(1),
	label: z.string().min(1),
	model_path: z.string().min(1),
	lods: z.array(z.string()),
	markers: z.record(z.string(), jsonMarkerSchema),
	metadata: z.record(z.string(), z.unknown()),
	detail_view: modelLibraryDetailViewSchema.nullable(),
	thumbnail_path: z.string().nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
});

export const sceneBundleSchema = z.object({
	schemaVersion: z.literal(1),
	scene: z.object({
		name: z.string().min(1),
		label: z.string().min(1),
		description: z.string().nullable(),
		metadata: z.record(z.string(), z.unknown()),
		modelReferences: z.array(z.string()),
		sceneObjects: z.array(sceneObjectConfigSchema),
		definition: serializableSceneDefinitionSchema,
		createdAt: z.string().nullable(),
		updatedAt: z.string().nullable()
	}),
	models: z.array(modelLibraryRowSchema),
	audioClips: z.array(
		z.object({
			id: z.string().min(1),
			scene_name: z.string().min(1),
			label: z.string().min(1),
			filename: z.string().min(1),
			duration: z.number().nullable(),
			metadata: z.unknown().nullable(),
			created_at: z.string().nullable()
		})
	)
});

export type SceneBundle = z.infer<typeof sceneBundleSchema>;

/** Validates a complete Git-readable scene bundle before offline hydration. */
export function parseSceneBundle(data: unknown): SceneBundle {
	return sceneBundleSchema.parse(data);
}
/* End of offline authoring bundle */

/**
 * Shared types for SceneObject instance config in compiled git manuals.
 */

import type { JsonMarker } from '../validate_sequencer';
import type { type_lightConfig } from '../reconciliation/keyframes/types';
import type { type_vec3 } from '../reconciliation/math';

/** Default markers on a model_library row (degrees, Blender export format). */
export type type_modelLibrary_markers = Record<string, JsonMarker>;

/** A SceneObject instance in a scene: instanceID mapped to a model from model_library. */
export type type_sceneObjectConfig = {
	instanceID: string;
	modelKey: string;
};

/** Camera framing for library detail preview (same pose model as scene camera keyframes). */
export type type_modelLibrary_detailViewCamera = {
	target: type_vec3 | [number, number, number];
	rotationX: number;
	rotationY: number;
	zoom: number;
};

/** Scene baseline camera before the first camera keyframe (stored in scenes.definition.zeroCamera). */
export type type_scene_zeroCamera = type_modelLibrary_detailViewCamera;

/** Lights + camera preview rig stored on model_library.detail_view. */
export type type_modelLibrary_detailView = {
	lights: type_lightConfig[];
	camera: type_modelLibrary_detailViewCamera;
};

/** Row shape from model_library table. */
export type type_modelLibraryRow = {
	model_key: string;
	label: string;
	model_path: string;
	lods: string[];
	markers: type_modelLibrary_markers;
	metadata: Record<string, unknown>;
	detail_view: type_modelLibrary_detailView | null;
	thumbnail_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

/** Metadata for uploading a new model via the editor. */
export type type_modelUploadMetadata = {
	modelKey: string;
	label: string;
};

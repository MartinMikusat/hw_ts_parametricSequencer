/**
 * Loads SceneModel and SceneObject instances from a model library and instance config.
 */

import type { JsonScene } from './validate_sequencer';
import { SceneObject } from './reconciliation/types/types_sceneModel';
import { SceneModel } from './types/types_sceneModel';
import { buildSceneObjects } from './buildSceneObjects';
import type { type_sceneObjectConfig } from './types/types_sceneObjects';

/** Re-export JsonScene for consumers that need the type. */
export type { JsonScene } from './validate_sequencer';

export type LoadSceneResult = {
	sceneModelMap: Map<string, SceneModel>;
	sceneObjects: Record<string, SceneObject>;
};

/**
 * Merges multiple scene JSONs. Later entries override earlier for same model key.
 */
function mergeScenes(scenes: JsonScene[]): Record<string, JsonScene['models'][string]> {
	const models: Record<string, JsonScene['models'][string]> = {};
	for (const scene of scenes) {
		for (const [key, val] of Object.entries(scene.models)) {
			models[key] = { ...models[key], ...val };
		}
	}
	return models;
}

/**
 * Builds SceneObject and SceneModel maps from merged Blender JSON and instance config.
 *
 * @param scenes - One or more parsed Blender scene JSON files
 * @param instanceConfig - List of { instanceID, modelKey }
 */
export function loadSceneFromJson(
	scenes: JsonScene[],
	instanceConfig: type_sceneObjectConfig[]
): LoadSceneResult {
	const mergedModels = mergeScenes(scenes);
	const modelLibrary = new Map(Object.entries(mergedModels));
	const { sceneModelMap, sceneObjectMap } = buildSceneObjects(modelLibrary, instanceConfig);

	return {
		sceneModelMap,
		sceneObjects: Object.fromEntries(sceneObjectMap)
	};
}

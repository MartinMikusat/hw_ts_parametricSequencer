/**
 * Builds SceneObject and SceneModel maps from model library + instance config.
 *
 * Markers come from the frozen model catalog.
 */

import type { JsonMarker, JsonModel } from './validate_sequencer';
import type { type_sceneObjectConfig } from './types/types_sceneObjects';
import { SceneModel } from './types/types_sceneModel';
import { SceneObject } from './reconciliation/types/types_sceneModel';
import type { type_sceneObject_marker } from './reconciliation/types/types_sceneModel';
import type { type_sceneModel_marker } from './types/types_sceneModel';
import { resolveModelStorageUrl } from './helper_storage_modelLibraryBucket';

/** Re-export for consumers that resolve model URLs. */
export { resolveModelStorageUrl } from './helper_storage_modelLibraryBucket';

/** Degrees to radians. Stored markers use degrees. */
const DEG2RAD = Math.PI / 180;

export type BuildSceneObjectsResult = {
	sceneModelMap: Map<string, SceneModel>;
	sceneObjectMap: Map<string, SceneObject>;
};

/**
 * Converts a JSON marker (degrees) to sequencer format (radians).
 */
export function convertJsonMarker(
	json: JsonMarker
): type_sceneModel_marker & type_sceneObject_marker {
	const pos = json.location;
	const rot = json.rotation ?? { x: 0, y: 0, z: 0 };
	return {
		position: { x: pos.x, y: pos.y, z: pos.z },
		rotation: {
			x: rot.x * DEG2RAD,
			y: rot.y * DEG2RAD,
			z: rot.z * DEG2RAD
		}
	};
}

/**
 * Converts JSON markers record to sequencer format.
 */
export function convertJsonMarkers(
	jsonMarkers: Record<string, JsonMarker> | undefined
): Record<string, type_sceneModel_marker & type_sceneObject_marker> {
	if (!jsonMarkers) return {};
	const result: Record<string, type_sceneModel_marker & type_sceneObject_marker> = {};
	for (const [name, m] of Object.entries(jsonMarkers)) {
		result[name] = convertJsonMarker(m);
	}
	return result;
}

/**
 * Builds SceneObject and SceneModel maps from a model library and instance config.
 */
export function buildSceneObjects(
	modelLibrary: Map<string, JsonModel & { modelPath?: string }>,
	instanceConfig: type_sceneObjectConfig[]
): BuildSceneObjectsResult {
	const sceneModelMap = new Map<string, SceneModel>();
	const sceneObjectMap = new Map<string, SceneObject>();

	for (const { instanceID, modelKey } of instanceConfig) {
		const modelData = modelLibrary.get(modelKey);
		if (!modelData) {
			console.warn(`buildSceneObjects: model "${modelKey}" not found for instance "${instanceID}"`);
			continue;
		}

		const markers = convertJsonMarkers(modelData.markers);

		const modelPath = modelData.modelPath ? resolveModelStorageUrl(modelData.modelPath) : undefined;

		const modelDef = {
			name: instanceID,
			modelPath,
			modelKey,
			animations: modelData.animations
		};

		const sceneModel = new SceneModel(modelDef, instanceID, markers);
		const sceneObject = new SceneObject(instanceID, markers);

		sceneModelMap.set(instanceID, sceneModel);
		sceneObjectMap.set(instanceID, sceneObject);
	}

	return { sceneModelMap, sceneObjectMap };
}

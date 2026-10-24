import type { type_vec3, type_euler } from '../reconciliation/math';

/**
 * Interface for model definition.
 * modelKey groups instances of the same physical part for chapter parts display.
 */
export type type_modelDefinition = {
	name: string;
	modelPath?: string;
	/** Published LOD assets with optional maximum object-space deviation. */
	lods?: Array<{ level: string; path: string; geometricError?: number }>;
	/** Key for grouping instances (e.g. 'hardware-threaded-insert-m3'). Same modelKey = same part type. */
	modelKey?: string;
	/** GLTF animation clip metadata from model_library.metadata.animations */
	animations?: Array<{ name: string; duration: number }>;
	/** Optional model-owned shading settings from the Blender manifest. */
	rendering?: {
		bevel: { enabled: boolean; radiusMm: number; autoAngleDegrees: number };
	};
};

/**
 * Interface for marker definition. Plain objects for position and rotation.
 */
export type type_sceneModel_marker = {
	position: type_vec3;
	rotation: type_euler;
};

export type type_sceneModel_marker_withParent = type_sceneModel_marker & {
	parent: SceneModel;
};

/**
 * A class that encapsulates both scene model and marker functionality
 * This is a wrapper around the sequencer's SceneObject that includes model data
 */
export class SceneModel {
	/** The scene model data */
	model: type_modelDefinition;
	/** Unique identifier for this model */
	sceneModelID: string;
	/** Collection of markers associated with this model */
	markers: Record<string, type_sceneModel_marker>;

	/**
	 * Create a new SceneModelWithMarkers
	 * @param model The 3D model data
	 * @param sceneModelID Unique identifier for this model
	 * @param markers Record of marker IDs to their definitions
	 */
	constructor(
		model: type_modelDefinition,
		sceneModelID: string,
		markers: Record<string, type_sceneModel_marker> = {}
	) {
		this.model = model;
		this.sceneModelID = sceneModelID;
		this.markers = markers;
	}

	/**
	 * Get all marker IDs available for this model
	 * @returns Array of marker IDs
	 */
	getMarkerIDs(): string[] {
		return Object.keys(this.markers);
	}

	/**
	 * Get a specific marker by ID
	 * @param markerID The marker identifier
	 * @returns The marker
	 * @throws Error if marker is not found
	 */
	getMarker<T extends keyof typeof this.markers>(markerID: T): type_sceneModel_marker_withParent {
		const marker = this.markers[markerID];
		if (!marker) {
			throw new Error(`Marker ${markerID} not found for model ${this.sceneModelID}`);
		}
		return {
			...marker,
			parent: this
		};
	}
}

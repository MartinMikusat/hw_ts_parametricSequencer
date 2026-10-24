/**
 * Local static URLs for GLB models in the model library.
 * Files live under `static/model-library/` and are served from the site origin.
 */

/** Storage / static directory id for reusable 3D models (GLB/GLTF). */
export const MODEL_LIBRARY_BUCKET = 'model-library';

/**
 * Public base path for model files.
 */
export function getModelLibraryStorageBaseUrl(): string {
	return `/${MODEL_LIBRARY_BUCKET}`;
}

/**
 * Resolves a storage-relative model path to a same-origin URL.
 *
 * @param modelPath - Path within the library, e.g. `main-body/high/<hash>.glb`
 */
export function resolveModelStorageUrl(modelPath: string): string {
	if (/^(?:https?:)?\/\//i.test(modelPath) || modelPath.startsWith('/')) return modelPath;
	return `${getModelLibraryStorageBaseUrl()}/${modelPath}`;
}

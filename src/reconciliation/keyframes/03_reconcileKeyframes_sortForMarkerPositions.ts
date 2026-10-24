import type {
	type_keyframes_reconciledTimeExtended_camera,
	type_keyframes_reconciledTimeExtended_model,
	type_keyframes_reconciledTimeExtended_audio,
	type_keyframes_reconciledTimeExtended_light
} from './02_reconcileKeyframes_expandTime';
import type { type_separatedKeyframes_extended } from './types';

// Legacy functions removed - only separated pipeline is used now

/**
 * Detects cycles in a dependency graph of keyframes using depth-first search.
 * A cycle occurs when keyframes have circular dependencies (e.g. A depends on B, B depends on C, C depends on A)
 * @param dependencyGraph Map where keys are keyframe IDs and values are Sets of IDs they depend on
 * @returns Array of cycles found, where each cycle is an array of keyframe IDs in the dependency loop
 */
function detectCycles(dependencyGraph: Map<string, Set<string>>): string[][] {
	// Tracks nodes we've completely finished processing
	const visited = new Set<string>();
	// Tracks nodes currently being processed in the current DFS path
	const inProgress = new Set<string>();
	// Stores all found cycles
	const cycles: string[][] = [];

	/**
	 * Recursive depth-first search to detect cycles
	 * @param nodeID Current keyframe ID being processed
	 * @param path Array tracking the current DFS path (used to reconstruct cycles)
	 */
	function dfs(nodeID: string, path: string[] = []) {
		// If we encounter a node already in the current path, we've found a cycle
		if (inProgress.has(nodeID)) {
			// Find where the cycle starts in the current path
			const cycleStart = path.indexOf(nodeID);
			if (cycleStart !== -1) {
				// Slice the path from cycle start to end and add the node again to complete the loop
				const cycle = path.slice(cycleStart).concat(nodeID);
				cycles.push(cycle);
				console.group('Cycle detected in keyframe dependencies:');
				console.log('Cycle path:', cycle.join(' → '));
				console.log('Full dependency path:', path.concat(nodeID).join(' → '));
				console.groupEnd();
			}
			return;
		}

		// Skip if we've already fully processed this node
		if (visited.has(nodeID)) {
			return;
		}

		// Mark as being processed and add to current path
		inProgress.add(nodeID);
		path.push(nodeID);

		// Recursively process all dependencies
		const dependencies = dependencyGraph.get(nodeID);
		if (dependencies) {
			dependencies.forEach((depID) => {
				dfs(depID, [...path]);
			});
		}

		// Done processing this node
		inProgress.delete(nodeID);
		visited.add(nodeID);
	}

	// Start DFS from each unvisited node in the graph
	console.group('Starting cycle detection in keyframe dependencies');
	Array.from(dependencyGraph.keys()).forEach((nodeID) => {
		if (!visited.has(nodeID)) {
			dfs(nodeID);
		}
	});
	console.groupEnd();

	if (cycles.length > 0) {
		console.group('Summary of detected cycles');
		cycles.forEach((cycle, i) => {
			console.log(`Cycle ${i + 1}: ${cycle.join(' → ')}`);
		});
		console.groupEnd();
	}

	return cycles;
}

/**
 * Sorts only the time for camera keyframes (they don't have marker dependencies)
 */
const sortCameraKeyframesByTime = (
	keyframes: Array<type_keyframes_reconciledTimeExtended_camera>
): Array<type_keyframes_reconciledTimeExtended_camera> => {
	return [...keyframes].sort((a, b) => a.extended.startTime - b.extended.startTime);
};

/**
 * Sorts audio keyframes by start time (no marker dependencies)
 */
const sortAudioKeyframesByTime = (
	keyframes: Array<type_keyframes_reconciledTimeExtended_audio>
): Array<type_keyframes_reconciledTimeExtended_audio> => {
	return [...keyframes].sort((a, b) => a.extended.startTime - b.extended.startTime);
};

/**
 * Sorts light keyframes by start time (no marker dependencies)
 */
const sortLightKeyframesByTime = (
	keyframes: Array<type_keyframes_reconciledTimeExtended_light>
): Array<type_keyframes_reconciledTimeExtended_light> => {
	return [...keyframes].sort((a, b) => a.extended.startTime - b.extended.startTime);
};

/**
 * Gets the SceneObject ID from a model keyframe
 */
const getObjectIDFromModelKeyframe = (
	keyframe: type_keyframes_reconciledTimeExtended_model
): string => {
	if (typeof keyframe.keyframe.sceneObject === 'object' && keyframe.keyframe.sceneObject !== null) {
		// Access sceneObjectID directly from the object
		const object = keyframe.keyframe.sceneObject;
		if (object.sceneObjectID) {
			return object.sceneObjectID;
		}
	}
	console.error(
		'Invalid sceneObject structure in keyframe - missing sceneObjectID property',
		keyframe.keyframe.sceneObject
	);
	return String(keyframe.keyframe.sceneObject);
};

/**
 * Checks if a model keyframe has a Marker position
 */
const modelKeyframeHasMarkerPosition = (
	keyframe: type_keyframes_reconciledTimeExtended_model
): boolean => {
	return keyframe.keyframe.position?.type === 'marker';
};

/**
 * Gets parent SceneObject IDs for a Marker position model keyframe
 */
const getParentObjectIDsFromModelKeyframe = (
	keyframe: type_keyframes_reconciledTimeExtended_model
): string[] => {
	if (keyframe.keyframe.position?.type === 'marker') {
		const markerValue = keyframe.keyframe.position.value;

		// Handle marker with parent reference
		if (
			markerValue &&
			typeof markerValue === 'object' &&
			'parent' in markerValue &&
			markerValue.parent
		) {
			const parent = markerValue.parent;
			if (parent && typeof parent === 'object' && parent.sceneObjectID) {
				return [parent.sceneObjectID];
			}
			console.error('Marker parent reference missing sceneObjectID property', parent);
			return [];
		}

		console.error('Marker position without proper parent reference', markerValue);
		return [];
	}
	return [];
};

/**
 * Sorts separated keyframes efficiently. Model keyframes are sorted by marker dependencies
 * and time, while camera keyframes are only sorted by time.
 *
 * @param separatedKeyframes Object containing separated model and camera keyframe arrays
 * @returns Object containing sorted separated keyframe arrays
 */
export const sortKeyframesForMarkerPositions = (
	separatedKeyframes: type_separatedKeyframes_extended
): type_separatedKeyframes_extended => {
	// Camera keyframes only need time sorting (no marker dependencies)
	const sortedCameraKeyframes = sortCameraKeyframesByTime(separatedKeyframes.cameraKeyframes);

	// Audio keyframes only need time sorting (no marker dependencies)
	const sortedAudioKeyframes = sortAudioKeyframesByTime(separatedKeyframes.audioKeyframes);

	// Light keyframes only need time sorting (no marker dependencies)
	const sortedLightKeyframes = sortLightKeyframesByTime(separatedKeyframes.lightKeyframes);

	// Model keyframes need dependency and time sorting
	const modelKeyframes = separatedKeyframes.modelKeyframes;

	if (modelKeyframes.length === 0) {
		return {
			modelKeyframes: [],
			cameraKeyframes: sortedCameraKeyframes,
			audioKeyframes: sortedAudioKeyframes,
			lightKeyframes: sortedLightKeyframes,
			lights: separatedKeyframes.lights
		};
	}

	// Group keyframes by SceneObject ID
	const modelKeyframesByObjectID = new Map<string, type_keyframes_reconciledTimeExtended_model[]>();
	const initialObjectIDs = new Set<string>();

	modelKeyframes.forEach((kf) => {
		const objectID = getObjectIDFromModelKeyframe(kf);
		if (!modelKeyframesByObjectID.has(objectID)) {
			modelKeyframesByObjectID.set(objectID, []);
		}
		modelKeyframesByObjectID.get(objectID)!.push(kf);
		initialObjectIDs.add(objectID);
	});

	const sortedObjectIDs: string[] = [];
	const remainingObjectIDs = new Set(initialObjectIDs);

	// Track dependency relationships for error reporting
	const dependsOn = new Map<string, Set<string>>();
	// Build dependency graph
	remainingObjectIDs.forEach((objectID) => {
		const modelKeyframes = modelKeyframesByObjectID.get(objectID) || [];
		const markerDependencyKeyframes = modelKeyframes.filter(modelKeyframeHasMarkerPosition);

		if (markerDependencyKeyframes.length > 0) {
			if (!dependsOn.has(objectID)) {
				dependsOn.set(objectID, new Set());
			}

			markerDependencyKeyframes.forEach((kf) => {
				getParentObjectIDsFromModelKeyframe(kf).forEach((parentID) => {
					dependsOn.get(objectID)?.add(parentID);
				});
			});
		}
	});

	// Iteratively sort objects based on dependencies (Topological Sort)
	let iterations = 0;
	const maxIterations = initialObjectIDs.size + 10; // Safety break slightly larger than needed

	while (remainingObjectIDs.size > 0 && iterations < maxIterations) {
		iterations++;
		const newlySortedThisPass: string[] = [];

		remainingObjectIDs.forEach((objectID) => {
			const modelKeyframes = modelKeyframesByObjectID.get(objectID) || [];
			const markerDependencyKeyframes = modelKeyframes.filter(modelKeyframeHasMarkerPosition);

			let canSort = true;
			if (markerDependencyKeyframes.length > 0) {
				const parentIDs = new Set<string>();
				markerDependencyKeyframes.forEach((kf) => {
					getParentObjectIDsFromModelKeyframe(kf).forEach((id) => parentIDs.add(id));
				});

				// Check if all parents are already sorted (either in previous or current pass)
				for (const parentID of parentIDs) {
					if (!sortedObjectIDs.includes(parentID) && !newlySortedThisPass.includes(parentID)) {
						// Dependency not met yet
						canSort = false;
						break;
					}
				}
			}

			if (canSort) {
				newlySortedThisPass.push(objectID);
			}
		});

		// Update state for next iteration
		if (newlySortedThisPass.length === 0) {
			// No progress made, indicates a cycle or missing dependency
			// Find and report specific cycles
			const cycles = detectCycles(dependsOn);

			if (cycles.length > 0) {
				const cycleDetails = cycles
					.map((cycle, i) => `  Cycle ${i + 1}: ${cycle.join(' → ')}`)
					.join('\n');
				throw new Error(
					`Circular dependencies detected in model keyframes - this will prevent proper animation sorting.\n\n` +
						`DETECTED CYCLES:\n${cycleDetails}`
				);
			} else {
				// Build detailed error message showing unresolved dependencies
				const unresolvedDetails: string[] = [];
				remainingObjectIDs.forEach((objectID) => {
					const deps = dependsOn.get(objectID);
					if (deps && deps.size > 0) {
						unresolvedDetails.push(`${objectID} (depends on: ${Array.from(deps).join(', ')})`);
					} else {
						unresolvedDetails.push(objectID);
					}
				});

				const dependencyAnalysis =
					remainingObjectIDs.size <= 5
						? unresolvedDetails.map((detail) => `  - ${detail}`).join('\n')
						: `  - ${Array.from(remainingObjectIDs).slice(0, 5).join(', ')} (and ${remainingObjectIDs.size - 5} more)`;

				throw new Error(
					`Failed to sort model keyframes due to unresolved dependencies - animation will not work correctly.\n\n` +
						`UNSORTED OBJECTS:\n${dependencyAnalysis}`
				);
			}
		} else {
			newlySortedThisPass.forEach((objectID) => {
				sortedObjectIDs.push(objectID);
				remainingObjectIDs.delete(objectID);
			});
		}
	}

	if (iterations >= maxIterations && remainingObjectIDs.size > 0) {
		throw new Error(
			`Exceeded maximum iterations (${maxIterations}) while sorting model keyframes - algorithm safety limit reached.`
		);
	}

	// Construct the final sorted array
	const finalSortedModelKeyframes: type_keyframes_reconciledTimeExtended_model[] = [];

	// Add sorted model keyframes (sorting by time within each object)
	sortedObjectIDs.forEach((objectID) => {
		const keyframesForObject = modelKeyframesByObjectID.get(objectID) || [];
		// Sort keyframes for this object by time
		const sortedKeyframesForObject = [...keyframesForObject].sort(
			(a, b) => a.extended.startTime - b.extended.startTime
		);
		finalSortedModelKeyframes.push(...sortedKeyframesForObject);
	});

	return {
		modelKeyframes: finalSortedModelKeyframes,
		cameraKeyframes: sortedCameraKeyframes,
		audioKeyframes: sortedAudioKeyframes,
		lightKeyframes: sortedLightKeyframes,
		lights: separatedKeyframes.lights,
		zeroCamera: separatedKeyframes.zeroCamera
	};
};

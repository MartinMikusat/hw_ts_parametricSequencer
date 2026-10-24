import { reconcileScene, type ReconciledScene3D } from './reconciliation/reconcileScene';
import { reconcile_animationState } from './reconciliation/animationState/reconcile_animationState';
import { SceneObject, type type_sceneObject_marker } from './reconciliation/types/types_sceneModel';
import { hydrateScene, type SerializableSceneDefinition } from './serializeScene';

/**
 * Equivalence oracle for the Odin backend. A case is a scene definition plus the marker frames of
 * its scene objects; the expected record holds the reconciled keyframe times and animation
 * snapshots at deterministic sample times, so another implementation can be compared field by field.
 */

export type OracleSceneObject = {
	instanceID: string;
	markers: Record<string, type_sceneObject_marker>;
};

export type OracleCaseInput = {
	sceneObjects: OracleSceneObject[];
	definition: SerializableSceneDefinition;
};

export type OracleErrorCode =
	| 'duplicate_id'
	| 'self_reference'
	| 'missing_parent'
	| 'start_time_cycle'
	| 'duration_cycle'
	| 'negative_duration'
	| 'unresolved_start'
	| 'model_cycle'
	| 'model_unresolved'
	| 'unknown_light'
	| 'conflicting_interaction_state';

export type OracleExpected =
	| {
			ok: true;
			duration: number;
			keyframes: Record<'model' | 'camera' | 'audio' | 'light', OracleKeyframeTimes[]>;
			samples: OracleSample[];
	  }
	| { ok: false; stage: 'reconcile' | 'sample'; code: OracleErrorCode };

type OracleKeyframeTimes = { id: string; start: number; end: number; extendedEnd: number };
type Vec3Tuple = [number, number, number];
type QuatTuple = [number, number, number, number];

export type OracleSample = {
	time: number;
	models: Array<{
		id: string;
		opacity: number;
		pickable: boolean;
		transparencyMode: string;
		material?: Record<string, number>;
		position: Vec3Tuple;
		rotation: QuatTuple;
		cumulativeRotation: QuatTuple;
		custom: Record<string, number>;
		markerParentID?: string;
		gltfClip: string | null;
		gltfProgress: number;
	}>;
	camera: {
		rotationX: number;
		rotationY: number;
		target: Vec3Tuple;
		zoom: number;
		spring?: { stiffness?: number; damping?: number; instant?: boolean };
	};
	lights: Array<{
		id: string;
		target: Vec3Tuple;
		rotationX: number;
		rotationY: number;
		zoom: number;
		width: number;
		height: number;
		intensity: number;
		color: string;
		shadowBias: number;
		shadowNormalBias: number;
	}>;
};

const UNIFORM_SAMPLES = 100;
const BOUNDARY_SAMPLES_MAX = 400;

const ERROR_PATTERNS: Array<[string, OracleErrorCode]> = [
	['Duplicate keyframe IDs', 'duplicate_id'],
	['references itself', 'self_reference'],
	['references unknown parent', 'missing_parent'],
	['Circular start-time dependency', 'start_time_cycle'],
	['Circular duration dependency', 'duration_cycle'],
	['invalid relative duration', 'negative_duration'],
	['unresolved keyframes', 'unresolved_start'],
	['duration reconciliation failed', 'unresolved_start'],
	['Circular dependencies detected in model keyframes', 'model_cycle'],
	['Failed to sort model keyframes', 'model_unresolved'],
	['Light keyframe references unknown lightId', 'unknown_light'],
	['Conflicting pick or transparency state', 'conflicting_interaction_state']
];

function classifyError(error: unknown): OracleErrorCode {
	const message = error instanceof Error ? error.message : String(error);
	for (const [needle, code] of ERROR_PATTERNS) {
		if (message.includes(needle)) return code;
	}
	throw new Error(`Unclassified reconciliation error: ${message}`);
}

function vec(v: { x: number; y: number; z: number }): Vec3Tuple {
	return [v.x, v.y, v.z];
}

function quat(q: { x: number; y: number; z: number; w: number }): QuatTuple {
	return [q.x, q.y, q.z, q.w];
}

function keyframeTimes(
	entries: ReconciledScene3D['modelKeyframes' | 'cameraKeyframes' | 'audioKeyframes' | 'lightKeyframes']
): OracleKeyframeTimes[] {
	return entries.map((entry) => ({
		id: entry.keyframe.id,
		start: entry.reconciled.startTime,
		end: entry.reconciled.endTime,
		extendedEnd: entry.extended.endTime
	}));
}

function sampleTimes(reconciled: ReconciledScene3D): number[] {
	const { duration } = reconciled;
	const uniform = new Set<number>([-1, 0, duration, duration + 1]);
	for (let i = 1; i < UNIFORM_SAMPLES; i++) uniform.add((duration * i) / UNIFORM_SAMPLES);
	const boundary = new Set<number>();
	const all = [
		...reconciled.modelKeyframes,
		...reconciled.cameraKeyframes,
		...reconciled.audioKeyframes,
		...reconciled.lightKeyframes
	];
	for (const entry of all) {
		const { startTime, endTime } = entry.reconciled;
		for (const t of [startTime, endTime, startTime + (endTime - startTime) / 2]) {
			if (!uniform.has(t)) boundary.add(t);
		}
	}
	const sortedBoundary = [...boundary].sort((a, b) => a - b);
	const stride = Math.max(1, Math.ceil(sortedBoundary.length / BOUNDARY_SAMPLES_MAX));
	const kept = sortedBoundary.filter((_, index) => index % stride === 0);
	return [...uniform, ...kept].sort((a, b) => a - b);
}

function snapshotAt(reconciled: ReconciledScene3D, time: number): OracleSample {
	const snapshot = reconcile_animationState(reconciled, time);
	const models = [...snapshot.models.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([id, state]) => ({
			id,
			opacity: state.opacity,
			pickable: state.pickable,
			transparencyMode: state.transparencyMode,
			material: state.material ? { ...state.material } : undefined,
			position: vec(state.position),
			rotation: quat(state.rotation),
			cumulativeRotation: quat(state.cumulativeModelRotation),
			custom: { ...state.custom },
			markerParentID: state.markerParentID,
			gltfClip: state.gltfClip,
			gltfProgress: state.gltfProgress
		}));
	const camera = snapshot.camera;
	const lights = [...snapshot.lights.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([id, light]) => ({
			id,
			target: vec(light.target),
			rotationX: light.rotationX,
			rotationY: light.rotationY,
			zoom: light.zoom,
			width: light.width,
			height: light.height,
			intensity: light.intensity,
			color: light.color,
			shadowBias: light.shadowBias,
			shadowNormalBias: light.shadowNormalBias
		}));
	return {
		time,
		models,
		camera: {
			rotationX: camera.rotationX,
			rotationY: camera.rotationY,
			target: vec(camera.target),
			zoom: camera.zoom,
			spring: camera.spring ? { ...camera.spring } : undefined
		},
		lights
	};
}

function hydrate(input: OracleCaseInput) {
	const objects = new Map(
		input.sceneObjects.map((item) => [item.instanceID, new SceneObject(item.instanceID, item.markers)])
	);
	const originalCounts = input.definition.modelKeyframes.length;
	const scene = hydrateScene(input.definition, objects);
	if (scene.modelKeyframes.length !== originalCounts) {
		throw new Error('Oracle case references a missing scene object; hydration would drop keyframes.');
	}
	return scene;
}

export function runOracleCase(input: OracleCaseInput): OracleExpected {
	const scene = hydrate(input);
	let reconciled: ReconciledScene3D;
	try {
		reconciled = reconcileScene(scene);
	} catch (error) {
		return { ok: false, stage: 'reconcile', code: classifyError(error) };
	}
	try {
		const samples = sampleTimes(reconciled).map((time) => snapshotAt(reconciled, time));
		return {
			ok: true,
			duration: reconciled.duration,
			keyframes: {
				model: keyframeTimes(reconciled.modelKeyframes),
				camera: keyframeTimes(reconciled.cameraKeyframes),
				audio: keyframeTimes(reconciled.audioKeyframes),
				light: keyframeTimes(reconciled.lightKeyframes)
			},
			samples
		};
	} catch (error) {
		return { ok: false, stage: 'sample', code: classifyError(error) };
	}
}

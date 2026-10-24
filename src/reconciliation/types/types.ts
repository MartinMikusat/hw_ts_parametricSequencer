import type { type_vec3, type_quat } from '../math';

// --------------------------------------------
// 3D models ----------------------------------
export type type_markerSceneObjectID = string;

// 3D models ----------------------------------
// --------------------------------------------

// --------------------------------------------
// Animations ---------------------------------
export type type_digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type type_componentState = {
	opacity: number;
	position: [number, number, number];
	rotation: [number, number, number];
};

export type type_keyframeCurve = {
	leftHandle: [number, number];
	rightHandle: [number, number];
};
export type type_keyframeCurveHandles = keyof type_keyframeCurve;
export type type_keyframeSide = 'Left' | 'Right';

export type type_sceneAssembly = {
	name: string;
	options?: string[];
	configurationKey?: string;
};
// Animations ---------------------------------
// --------------------------------------------

// --------------------------------------------
// Animation states ---------------------------
export type type_modelAnimationState = {
	opacity: number;
	position: type_vec3;
	rotation: type_quat;
	cumulativeModelRotation: type_quat;
};
// Animation states ---------------------------
// --------------------------------------------

// --------------------------------------------
// Playback -----------------------------------
export type type_availableScenes = 'Eva' | 'Clockwork 2';
export type type_playbackTimes = { [sceneName: string]: number };
export type type_playbackPlayStates = { [sceneName: string]: boolean };
// Playback -----------------------------------
// --------------------------------------------

// --------------------------------------------
// Chapters -----------------------------------
export type type_getChapterTitle = (chapter: string | undefined) => string;
export type type_getChapterText = (
	chapter: string | undefined
) => [string | string[], string, string];
// Chapters -----------------------------------
// --------------------------------------------

// Chapter assembly
export type type_chapterAssembly = {
	assembly: string;
	description: string;
	chapter: string;
};

/**
 * Cubic Bezier easing functions for animations and transitions.
 *
 * Port of bezier-easing: https://github.com/gre/bezier-easing
 * BezierEasing - use bezier curve for transition easing function
 * by Gaëtan Renaudeau 2014 - 2015 – MIT License
 *
 * Refactored to idiomatic TypeScript. Generic helpers usable for any
 * animation, UI transition, or progress interpolation.
 */

// --- Constants for Numerical Methods ---

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;

const K_SPLINE_TABLE_SIZE = 11;
const K_SAMPLE_STEP_SIZE = 1.0 / (K_SPLINE_TABLE_SIZE - 1.0);

// --- Bezier Curve Math Helpers ---

/** Calculates coefficient 'a' based on control points P1 and P2. */
const a = (aA1: number, aA2: number): number => 1.0 - 3.0 * aA2 + 3.0 * aA1;
/** Calculates coefficient 'b' based on control points P1 and P2. */
const b = (aA1: number, aA2: number): number => 3.0 * aA2 - 6.0 * aA1;
/** Calculates coefficient 'c' based on control point P1. */
const c = (aA1: number): number => 3.0 * aA1;

/**
 * Returns x(t) given t, x1 (mX1), and x2 (mX2), or y(t) given t, y1 (mY1), and y2 (mY2).
 * This is the cubic Bezier polynomial rearranged for efficiency: a*t^3 + b*t^2 + c*t
 */
const calcBezier = (t: number, p1: number, p2: number): number =>
	((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;

/**
 * Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
 * This is the derivative of the Bezier polynomial: 3*a*t^2 + 2*b*t + c
 */
const getSlope = (t: number, p1: number, p2: number): number =>
	3.0 * a(p1, p2) * t * t + 2.0 * b(p1, p2) * t + c(p1);

// --- Root-Finding Algorithms ---

/**
 * Uses binary subdivision to find the root 't' for a given 'x'.
 * @param aX - The target x value.
 * @param mX1 - Control point 1 x-coordinate.
 * @param mX2 - Control point 2 x-coordinate.
 * @returns The approximate 't' value.
 */
function binarySubdivide(aX: number, mX1: number, mX2: number): number {
	let currentA = 0.0;
	let currentB = 1.0;
	let currentT = currentA + (currentB - currentA) / 2.0;
	let currentX = 0.0;
	let iterations = 0;

	while (iterations < SUBDIVISION_MAX_ITERATIONS) {
		currentT = currentA + (currentB - currentA) / 2.0;
		currentX = calcBezier(currentT, mX1, mX2) - aX;
		if (Math.abs(currentX) <= SUBDIVISION_PRECISION) {
			return currentT; // Precision met
		}
		if (currentX > 0.0) {
			currentB = currentT;
		} else {
			currentA = currentT;
		}
		iterations++;
	}
	return currentT; // Return best guess after max iterations
}

/**
 * Uses the Newton-Raphson method to refine the guess for 't'.
 * @param aX - The target x value.
 * @param mX1 - Control point 1 x-coordinate.
 * @param mX2 - Control point 2 x-coordinate.
 * @param guessT - Initial guess for 't'.
 * @returns The refined 't' value.
 */
function newtonRaphsonIterate(aX: number, mX1: number, mX2: number, guessT: number): number {
	let currentGuessT = guessT;
	for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
		const currentSlope = getSlope(currentGuessT, mX1, mX2);
		if (currentSlope === 0.0) {
			return currentGuessT; // Slope is zero, cannot proceed
		}
		const currentX = calcBezier(currentGuessT, mX1, mX2) - aX;
		currentGuessT -= currentX / currentSlope;
	}
	return currentGuessT;
}

// --- Easing Function Implementation ---

/** A linear easing function (no easing). */
const linearEasing = (x: number): number => x;

/**
 * Creates a cubic bezier easing function.
 *
 * @param mX1 - Control point 1 x-coordinate (0-1).
 * @param mY1 - Control point 1 y-coordinate.
 * @param mX2 - Control point 2 x-coordinate (0-1).
 * @param mY2 - Control point 2 y-coordinate.
 * @returns An easing function that takes a progress value (0-1) and returns an eased value.
 * @throws {Error} If control points are outside the [0, 1] range.
 *
 * @example
 * ```ts
 * const customEase = helper_easing_bezier(0.25, 0.1, 0.25, 1.0);
 * customEase(0.5); // Returns eased value at 50% progress
 * ```
 */
export function helper_easing_bezier(
	mX1: number,
	mY1: number,
	mX2: number,
	mY2: number
): (x: number) => number {
	// Input validation
	if (!(mX1 >= 0 && mX1 <= 1 && mX2 >= 0 && mX2 <= 1)) {
		throw new Error('Bezier x control points must be in [0, 1] range');
	}
	// Optimization for linear easing
	if (mX1 === mY1 && mX2 === mY2) {
		return linearEasing;
	}

	// Precompute sample values table
	const sampleValues = new Float32Array(K_SPLINE_TABLE_SIZE);
	for (let i = 0; i < K_SPLINE_TABLE_SIZE; ++i) {
		sampleValues[i] = calcBezier(i * K_SAMPLE_STEP_SIZE, mX1, mX2);
	}

	// Find the parameter 't' for a given input progress 'x' (aX)
	const getTForX = (aX: number): number => {
		let intervalStart = 0.0;
		let currentSample = 1;
		const lastSample = K_SPLINE_TABLE_SIZE - 1;

		// Find the interval where aX falls
		while (currentSample !== lastSample && sampleValues[currentSample] <= aX) {
			intervalStart += K_SAMPLE_STEP_SIZE;
			++currentSample;
		}
		--currentSample; // Backtrack to the start of the interval

		const valAtIndex = sampleValues[currentSample];
		const valAtNextIndex = sampleValues[currentSample + 1];
		const dist = (aX - valAtIndex) / (valAtNextIndex - valAtIndex);

		// Linearly interpolate for an initial guess
		const guessForT = intervalStart + dist * K_SAMPLE_STEP_SIZE;
		const initialSlope = getSlope(guessForT, mX1, mX2);

		// Choose the appropriate root-finding method
		if (initialSlope >= NEWTON_MIN_SLOPE) {
			return newtonRaphsonIterate(aX, mX1, mX2, guessForT);
		} else if (initialSlope === 0.0) {
			return guessForT; // Slope is zero, return the guess
		} else {
			return binarySubdivide(aX, mX1, mX2);
		}
	};

	// Define and return the final easing function
	return (x: number): number => {
		// Handle edge cases
		if (x === 0.0) {
			return 0.0;
		}
		if (x === 1.0) {
			return 1.0;
		}
		// Calculate y using the corresponding t for x
		return calcBezier(getTForX(x), mY1, mY2);
	};
}

// --- Common Easing Functions ---

/**
 * Standard ease easing function.
 * Provides a smooth acceleration and deceleration curve.
 * Equivalent to CSS `ease` timing function.
 *
 * @example
 * ```ts
 * helper_easing_ease(0.5) // Standard ease at 50% progress
 * ```
 */
export const helper_easing_ease = helper_easing_bezier(0.25, 0.1, 0.25, 1.0);

/**
 * Ease-in easing function.
 * Starts slow and accelerates. Equivalent to CSS `ease-in` timing function.
 *
 * @example
 * ```ts
 * helper_easing_easeIn(0.5) // Ease-in at 50% progress
 * ```
 */
export const helper_easing_easeIn = helper_easing_bezier(0.42, 0.0, 1.0, 1.0);

/**
 * Ease-out easing function.
 * Starts fast and decelerates. Equivalent to CSS `ease-out` timing function.
 *
 * @example
 * ```ts
 * helper_easing_easeOut(0.5) // Ease-out at 50% progress
 * ```
 */
export const helper_easing_easeOut = helper_easing_bezier(0.0, 0.0, 0.58, 1.0);

/**
 * Ease-in-out easing function.
 * Starts slow, accelerates in the middle, then decelerates.
 * Equivalent to CSS `ease-in-out` timing function.
 *
 * @example
 * ```ts
 * helper_easing_easeInOut(0.5) // Ease-in-out at 50% progress
 * ```
 */
export const helper_easing_easeInOut = helper_easing_bezier(0.42, 0.0, 0.58, 1.0);

/**
 * Linear easing function.
 * Constant speed with no acceleration or deceleration.
 * Equivalent to CSS `linear` timing function.
 *
 * @example
 * ```ts
 * helper_easing_linear(0.5) // Linear (no easing) at 50% progress
 * ```
 */
export const helper_easing_linear = linearEasing;

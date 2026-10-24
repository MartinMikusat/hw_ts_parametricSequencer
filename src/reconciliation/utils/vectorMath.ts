export const addVector3AsArray = (
	vectorA: [number, number, number],
	vectorB: [number, number, number]
): [number, number, number] => {
	return vectorA.map((value, index) => value + vectorB[index]) as [number, number, number];
};

export const subVector3AsArray = (
	vectorA: [number, number, number],
	vectorB: [number, number, number]
): [number, number, number] => {
	return vectorA.map((value, index) => value - vectorB[index]) as [number, number, number];
};

export const multiplyVector3AsArrayByScalar = (
	vector: [number, number, number],
	scalar: number
) => {
	return vector.map((value) => value * scalar) as [number, number, number];
};

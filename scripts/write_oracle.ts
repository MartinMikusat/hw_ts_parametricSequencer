import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runOracleCase, type OracleCaseInput } from '../src/oracle';
import { SYNTHETIC_CASES } from './synthetic_cases';

/**
 * Usage: write_oracle <fixtures-dir>
 * Writes the synthetic `<name>.input.json` cases, then regenerates `<name>.expected.json` for every
 * `*.input.json` in the directory, so externally exported scenes share the same oracle.
 */
const directory = process.argv[2];
if (!directory) {
	console.error('usage: write_oracle <fixtures-dir>');
	process.exit(2);
}
mkdirSync(directory, { recursive: true });
for (const [name, input] of Object.entries(SYNTHETIC_CASES)) {
	writeFileSync(join(directory, `${name}.input.json`), JSON.stringify(input, null, 1) + '\n');
}
let count = 0;
for (const file of readdirSync(directory).sort()) {
	if (!file.endsWith('.input.json')) continue;
	const input = JSON.parse(readFileSync(join(directory, file), 'utf8')) as OracleCaseInput;
	const expected = runOracleCase(input);
	writeFileSync(join(directory, file.replace('.input.json', '.expected.json')), JSON.stringify(expected) + '\n');
	count++;
}
console.log(`wrote ${count} oracle cases to ${directory}`);

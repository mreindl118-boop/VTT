// Check an encounter pack (the DM's prepared fights, kept outside the repo) against this build of the app.
//   npm run encounters:check -- path/to/encounters.json
// Prints what will be skipped (errors) and what will stage differently than written (warnings); exit 1 on errors.
import { readFileSync } from 'node:fs';
import { validatePack } from '../../app/src/core/encounterPack.ts';
import { repoContext } from './context.ts';

const file = process.argv[2];
if (!file) { console.error('usage: npm run encounters:check -- <pack.json>'); process.exit(2); }
const { pack, problems } = validatePack(JSON.parse(readFileSync(file, 'utf8')), repoContext());
for (const p of problems) console.log(`${p.level === 'error' ? 'ERROR' : 'warn '} ${p.encounter ?? '(pack)'}: ${p.text}`);
const errors = problems.filter((p) => p.level === 'error').length;
console.log(`${pack.encounters.length} encounters load · ${errors} errors · ${problems.length - errors} warnings`);
process.exit(errors ? 1 : 0);

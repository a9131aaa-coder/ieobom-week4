// Compatibility with the old week-4 command: all endpoints now use real Next.js.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'dev'],{cwd:root,stdio:'inherit'});
process.exit(result.status??1);

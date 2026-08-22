import { parseHermesModule, writeHermesModule } from "decompiler";
import { formatSizeUnit, mapValues } from "../utils/index.ts";
import { measureProfile } from "./profiling.ts";
import { readFile } from "node:fs/promises";

await using profile = await measureProfile("./test/profile.cpuprofile");
void profile;

const buffer = (await readFile("./discord/bundle.hbc")).buffer;
const origHash = new Uint8Array(buffer, buffer.byteLength - 20);

console.time("parse");
const module = parseHermesModule(buffer);
console.timeEnd("parse");

console.time("write");
const patched = writeHermesModule(module);
console.timeEnd("write");

const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", patched.subarray(0, patched.byteLength - 20)));

if (hash.some((x, i) => origHash[i] !== x)) {
    console.log(`Original: ${buffer.byteLength}`);
    console.log(`Patched:  ${patched.byteLength}`);

    const data = new Uint8Array(buffer);

    for (let i = 128; i < data.length; i++) {
        if (data[i] !== patched[i]) {
            console.warn(`File differs after byte ${i}`);
            break;
        }
    }

    throw Error(`Hash mismatch: ${Array.from(hash, x => x.toString(16).padStart(2, "0")).join("")}`);
}

console.log(mapValues(process.memoryUsage(), formatSizeUnit));

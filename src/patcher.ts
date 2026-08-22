import { Disassembler, encodeInstructions, HermesModule, Instruction, parseHermesModule, parseObjectKeys, writeHermesModule } from "decompiler";
import { ModulePatcher } from "decompiler/mutable";
import { Opcode } from "decompiler/opcodes";
import type { ModuleFunction } from "decompiler/types";
import { readFile, writeFile } from "fs/promises";

import { PatchContext, type PatchDef } from "#api/patches.ts";

import { formatSizeUnit, mapValues } from "../utils/index.ts";
import experiments from "./plugins/experiments/index.ts";

const plugins = [experiments];

for (const bundle of ["discord/android.hbc", "discord/apple.hbc"]) {
    let buffer;

    try {
        buffer = (await readFile(bundle)).buffer;
    } catch {
        continue;
    }

    const output = bundle.replace(/\.hbc$/, ".patched.hbc");

    console.log("Patching", bundle);

    const module = parseHermesModule(buffer);
    const patched = writeHermesModule(patchModule(module));

    await writeFile("./discord/patched.hbc", patched);

    console.log(bundle, "=>", output);
}

console.log(mapValues(process.memoryUsage(), formatSizeUnit));

function patchModule(module: HermesModule) {
    const dis = new Disassembler(module);
    const patcher = new ModulePatcher(module);
    runPatches(plugins.flatMap(plugin => plugin.patches), module.functions);

    if (process.argv.includes("--dump")) {
        for (const dirty of patcher.dirtyFunctions.values()) {
            console.log(dis.diffMutable(dirty));
        }
    }

    patcher.modifyFunctions();

    return module;

    type CompiledPatch = PatchDef & {
        matchedId?: number;
        closureIds?: number[];
        identifierId?: number;
        stringIds?: number[];
    };

    type PendingPatch = CompiledPatch & { matchedId: number; closureIds: number[] };

    function runPatches(patches: PatchDef[], functions: ModuleFunction[]) {
        const compiled = compilePatches(patches);
        const pending = scanPatches(compiled, functions);

        for (const failed of compiled.filter(p => p.matchedId == null)) {
            console.warn("Patch did not match anything", failed);
        }

        for (const p of pending) {
            if ("patches" in p) {
                runPatches(
                    Array.isArray(p.patches) ? p.patches : [p.patches],
                    p.closureIds.map(i => module.functions[i]),
                );

                continue;
            }

            const mut = patcher.getMutable(p.matchedId);
            const ctx = new PatchContext(mut);

            if ("apply" in p) {
                try {
                    p.apply(ctx);
                } catch (err) {
                    console.warn("Patch `apply` failed", p, err);
                }

                continue;
            }

            mut.replace(0, mut.bytecode.length, encodeInstructions(p.replace));
        }
    }

    function compilePatches(patches: PatchDef[]): CompiledPatch[] {
        const getStr = (str: string) => patcher.findString(str)?.index;
        const getPartialStr = (str: string) => patcher.findPartialString(str)?.index;

        return patches.map(def => {
            let identifierId;
            let stringIds;

            if (def.identifier != null) {
                identifierId = assert(getStr(def.identifier), `Couldn't find identifier ${def.identifier}`);
            }

            if (def.strings != null) {
                stringIds = def.strings.map(str => assert(getPartialStr(str), f`Couldn't find string ${str}`));
            }

            return { ...def, identifierId, stringIds };
        });
    }

    function scanPatches(patches: CompiledPatch[], functions: ModuleFunction[]) {
        const pending: PendingPatch[] = [];

        for (const func of functions) {
            const fp = fingerprintFunction(func);

            for (const patch of patches) {
                if (!matchFingerprint(fp, patch)) continue;
                if (!matchExtraFingerprint(func, patch)) continue;

                if (patch.matchedId != null) {
                    console.warn("Patch is not unique", patch);
                    continue;
                }

                patch.matchedId = func.id;
                patch.closureIds = [...fp.closureIds];

                pending.push(patch as PendingPatch);
            }
        }

        return pending;
    }

    function matchFingerprint(fp: ReturnType<typeof fingerprintFunction>, patch: CompiledPatch) {
        if (patch.identifierId != null && patch.identifierId !== fp.identifierId) return false;
        if (patch.opcodes && patch.opcodes.some(op => !fp.opcodes.has(op))) return false;
        if (patch.stringIds && patch.stringIds.some(id => !fp.stringIds.has(id))) return false;

        return true;
    }

    function matchExtraFingerprint(func: ModuleFunction, patch: CompiledPatch) {
        if (patch.objectKeys) {
            const unseen = new Set(patch.objectKeys);

            for (const instr of Instruction.iterate(func.bytecode.opcodes)) {
                if (
                    instr.opcode === Opcode.NewObjectWithBuffer
                    || instr.opcode === Opcode.NewObjectWithBufferLong
                ) {
                    const shapeIdx = instr.getOperand(1);

                    for (const key of parseObjectKeys(module, shapeIdx)) {
                        unseen.delete(key as any);
                    }
                }
            }

            if (unseen.size) return false;
        }

        return true;
    }

    function fingerprintFunction(func: ModuleFunction) {
        const identifierId = func.header.functionName;
        const opcodes = new Set<Opcode>();
        const stringIds = new Set<number>();
        const closureIds = new Set<number>();

        for (const instr of Instruction.iterate(func.bytecode.opcodes)) {
            opcodes.add(instr.opcode);
            instr.stringOperands()?.forEach(op => stringIds.add(instr.getOperand(op)));
            instr.functionOperands()?.forEach(op => closureIds.add(instr.getOperand(op)));
        }

        return { identifierId, opcodes, stringIds, closureIds };
    }
}

function assert<T>(value: T | undefined, err: string): T {
    if (!value) throw Error(err);
    return value;
}

function f(args: TemplateStringsArray, ...values: any[]) {
    return String.raw({ raw: args }, ...values.map(v => {
        if (typeof v == "number") {
            return v.toLocaleString("fr", { maximumSignificantDigits: 3 }).replace(",", ".");
        }
        if (typeof v == "string") {
            return JSON.stringify(v);
        }

        return v;
    }));
}

import { Instruction, parseArrayValues, parseHermesModule } from "decompiler";
import { canonicalOpcodes, Opcode, opcodeNames } from "decompiler/opcodes";
import { readFile } from "node:fs/promises";

const hermes = parseHermesModule((await readFile("./discord/android.hbc")).buffer);
const global = hermes.functions[hermes.globalCodeIndex];

let state = 0;

const depGraph = new Map<number, [number, number[]]>();
const registers = new Map<number, any>();

// yanderedevmaxxing
for (const instr of Instruction.iterate(global.bytecode.opcodes)) try {
    const opcode = canonicalOpcodes[instr.opcode];

    if (state === 0) {
        if (opcode === Opcode.TryGetById &&
            hermes.strings.get(instr.getOperand(3)) === "__d") {
            state = 1;
        } else if (opcode === Opcode.LoadConstUInt8) {
            registers.set(instr.getOperand(0), instr.getOperand(1));
        } else if (opcode === Opcode.LoadConstZero) {
            registers.set(instr.getOperand(0), 0);
        }
        continue;
    }

    if (state === 1 && (opcode === Opcode.LoadConstUInt8 || opcode === Opcode.LoadConstInt)) {
        registers.set(instr.getOperand(0), instr.getOperand(1));
        state = 2;
        continue;
    }

    if ((state === 1 || state === 2) && opcode === Opcode.NewArrayWithBuffer) {
        registers.set(instr.getOperand(0), parseArrayValues(hermes, instr.getOperand(3), instr.getOperand(2)));
        state = 3;
        continue;
    }

    if ((state === 1 || state === 2) && opcode === Opcode.NewArray) {
        registers.set(instr.getOperand(0), new Array(instr.getOperand(1)));
        state = 3;
        continue;
    }

    if (state === 3 && opcode === Opcode.CreateClosure) {
        registers.set(instr.getOperand(0), { closure: instr.getOperand(2) });
        state = 4;
        continue;
    }

    if (state === 4 && opcode === Opcode.Call4) {
        const [,,, closureReg, modIdReg, depsReg] = instr.operands();

        const closure = registers.get(closureReg)!;
        const modId = registers.get(modIdReg);
        const deps = registers.get(depsReg);

        if (depGraph.has(modId)) throw "fish";

        depGraph.set(modId, [closure, deps]);

        state = 5;
        continue;
    }

    if (state === 5 && opcode === Opcode.TryGetById) {
        state = 1;
        continue;
    }

    break;
} catch {
    console.log(depGraph);
    console.log(state);
    console.log(opcodeNames[instr.opcode], ...instr.operands());
    break;
}

console.log(depGraph);

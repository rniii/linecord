// Emits pseudo-JavaScript that is possibly more readable than the raw disassembly.

import { readFile } from "node:fs/promises";

import { HermesModule, Instruction, parseHermesModule, parseObjectKeys, parseObjectValues } from "decompiler";
import { ArgType, canonicalOpcodes, Opcode, opcodeNames, opcodeTypes, stringOperands } from "decompiler/opcodes";
import type { Literal, ModuleFunction } from "decompiler/types";

async function main() {
    const hermes = parseHermesModule((await readFile("./discord/android.hbc")).buffer);
    const target = hermes.functions[+process.argv[2] || hermes.globalCodeIndex];

    decompileFunction(hermes, target);
}

const Semantic = {
    Invalid: 0,
    // Move: 1,
    Branch: 2,
    Return: 3,
    Assign: 4,
    None: 5,
} as const;

type Semantic = typeof Semantic[keyof typeof Semantic];

const semanticMap = {} as Record<Opcode, Semantic>;

([
    [Opcode.Unreachable,            Semantic.Invalid],
    [Opcode.NewObjectWithBuffer,    Semantic.Assign],
    [Opcode.FastArrayStore,         Semantic.None],
    [Opcode.CacheNewObject,         Semantic.Assign],
    // [Opcode.Mov,                    Semantic.Move],
    // [Opcode.Negate,                 Semantic.Assign],
    [Opcode.StoreToEnvironment,     Semantic.None],
    [Opcode.LoadFromEnvironment,    Semantic.Assign],
    [Opcode.DeclareGlobalVar,       Semantic.None],
    [Opcode.GetByIdShort,           Semantic.Assign],
    [Opcode.PutByIdLoose,           Semantic.None],
    [Opcode.GetByVal,               Semantic.Assign],
    [Opcode.PutByValLoose,          Semantic.None],
    [Opcode.GetPNameList,           Semantic.Assign],
    [Opcode.Ret,                    Semantic.Return],
    [Opcode.Catch,                  Semantic.Assign],
    [Opcode.Throw,                  Semantic.Return],
    [Opcode.CreateBaseClass,        Semantic.Assign],
    [Opcode.UIntSwitchImm,          Semantic.Branch],
    [Opcode.CreateGenerator,        Semantic.Assign],
    [Opcode.Jmp,                    Semantic.Branch],
    [256,                           Semantic.Invalid],
] as const).reduce(([start, value], next) => {
    while (start < next[0]) {
        semanticMap[start++ as Opcode] = value;
    }

    return next;
});

function decompileFunction(hermes: HermesModule, target: ModuleFunction) {
    const block = {
        variableCounts: {} as Record<string, number>,
        registers: {} as Record<number, string>,
        body: [] as IrInstr<Opcode>[],
    };

    for (const instr of Instruction.iterate(target.bytecode.opcodes)) {
        const semantic = semanticMap[instr.opcode];

        switch (semantic) {
            case Semantic.Invalid:
                throw Error();
            case Semantic.Branch:
                throw "todo";
            case Semantic.Return: {
                const [operand] = getOperands(instr, semantic);
                emit({ return: instr.opcode, operand });
                continue;
            }
            case Semantic.Assign: {
                const operands = getOperands(instr, semantic);
                const destination = getDestination(instr); // must be after
                emit({ assign: instr.opcode, destination, operands });
                continue;
            }
            case Semantic.None:
                emit({ call: instr.opcode, operands: getOperands(instr, semantic) });
                continue;
            default:
                throw semantic satisfies never;
        }
    }

    for (const instr of block.body) {
        let text = "";
        let opcode, operands;
        if ("return" in instr) {
            opcode = Opcode.Ret;
            operands = [instr.operand];
        } else if ("branch" in instr) {
            continue;
        } else if ("assign" in instr) {
            text += `${formatValue(instr.destination)} \x1b[1;36m=\x1b[m `;
            opcode = instr.assign;
            operands = instr.operands;
        } else {
            opcode = instr.call;
            operands = instr.operands;
        }

        text += `\x1b[90m[${formatOpcode(opcode)}\x1b[m`
        text += `${formatOperands(opcode, operands)}\x1b[90m]\x1b[m`;
        console.log(text);
    }

    function formatOpcode(opcode: Opcode) {
        return opcodeNames[canonicalOpcodes[opcode]];
    }

    function formatOperands(opcode: Opcode, operands: IrValue[]) {
        switch (opcode) {
            case Opcode.PutByIdLoose:
            case Opcode.PutByIdStrict: {
                const [dest, value, cacheIdx, key] = operands.map(formatValue);

                return ` ${dest}[${key} @${cacheIdx}] = ${value}`;
            }
            case Opcode.Call1:
            case Opcode.Call2:
            case Opcode.Call3:
            case Opcode.Call4: {
                const [func, ...args] = operands.map(formatValue);

                return ` ${func}(this: ${args.join(",\n    ")})`;
            }
            default:
                if (operands.length) {
                    return " " + operands.map(formatValue).join(", ");
                }

                return "";
        }
    }

    function formatValue(value: IrValue) {
        if ("variable" in value) return `${value.variable}`;
        if ("immediate" in value) return `\x1b[33m${value.immediate}\x1b[m`;
        if ("string" in value) return formatLiteral(value.string);

        const { keys, values } = value;

        return `{ ${keys.map((k, i) =>
            `${formatKey(k)}: ${formatLiteral(values[i])}`).join(", ")} }`;
    }

    function formatLiteral(literal: Literal) {
        switch (typeof literal) {
            case "string":
                return `\x1b[32m${JSON.stringify(literal)}\x1b[m`;
            case "number":
                return `\x1b[33m${literal}\x1b[m`;
            case "undefined":
                return "undefined";
            default:
                return JSON.stringify(literal);
        }
    }

    function formatKey(literal: Literal) {
        return formatIdentifierOr(literal, formatLiteral);
    }

    function formatIdentifierOr(literal: Literal, fallback: (literal: Literal) => string) {
        if (typeof literal === "string" && /^[A-Za-z_$][0-9\w$]/.test(literal)) {
            return literal;
        }

        return fallback(literal);
    }

    function emit(instr: IrInstr<Opcode>) {
        block.body.push(instr);
    }

    function allocateVariable(instr: Instruction, register: number) {
        return block.registers[register] = generateVariable(instr);
    }

    function generateVariable(instr: Instruction) {
        const opcode = canonicalOpcodes[instr.opcode];

        let prefix;

        switch (opcode) {
            case Opcode.GetGlobalObject:
                return "global";
            case Opcode.LoadParam:
                return `param${instr.getOperand(1)}`;
            case Opcode.LoadConstUndefined:
                return `undefined`;
            case Opcode.GetById:
            case Opcode.TryGetById:
                prefix = hermes.strings.get(instr.getOperand(3));
                break;
            default:
                prefix = genericPrefix(opcode);
                break;
        }

        const number = block.variableCounts[prefix] ??= 0;
        block.variableCounts[prefix]++;

        return prefix + number;
    }

    function genericPrefix(opcode: Opcode) {
        switch (opcode) {
            case Opcode.NewObjectWithBuffer:
            case Opcode.NewObjectWithBufferAndParent:
            case Opcode.NewObject:
            case Opcode.NewObjectWithParent:
                return "object";
            case Opcode.NewArrayWithBuffer:
            case Opcode.NewArray:
                return "array";
            case Opcode.NewFastArray:
                return "farray";
            case Opcode.CacheNewObject:
                return "this"; // ?
            case Opcode.CreateFunctionEnvironment:
                return "environment";
            case Opcode.LoadConstString:
                return "string";
            default:
                return "value";
        }
    }

    function getDestination(instr: Instruction) {
        return { variable: allocateVariable(instr, instr.getOperand(0)) };
    }

    function getOperands(instr: Instruction, semantic: Semantic): IrValue[] {
        if (canonicalOpcodes[instr.opcode] === Opcode.NewObjectWithBuffer) {
            const [, shapeIdx, valIdx] = instr.operands();

            const keys = parseObjectKeys(hermes, shapeIdx);
            const values = parseObjectValues(hermes, shapeIdx, valIdx);

            return [{ keys, values }];
        }

        return instr.operands().map((value, idx) => {
            if (stringOperands[instr.opcode]?.includes(idx)) {
                return { string: hermes.strings.get(value) };
            }

            switch (opcodeTypes[instr.opcode][idx]) {
                case ArgType.Reg8:
                case ArgType.Reg32:
                    return { variable: block.registers[value] };
                default:
                    return { immediate: value };
            }
        }).drop(semantic === Semantic.Assign ? 1 : 0).toArray();
    }
}

type IrValue =
    | { variable: string }
    | { immediate: number }
    | { string: string }
    | { keys: Literal[]; values: Literal[] };

type IrInstr<O extends Opcode> =
    | { branch: O }
    | { return: O; operand: any }
    | { assign: O; destination: any; operands: IrValue[] }
    | { call: O; operands: IrValue[] };

await main();

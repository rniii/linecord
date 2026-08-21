export { Disassembler } from "./disassembler.ts";
export { encodeInstructions } from "./instruction.ts";
export { Instruction, isValidOpcode } from "./instruction.ts";
export { parseArrayValues, parseLiterals, parseObjectKeys, parseObjectValues } from "./literalParser.ts";
export { parseHermesModule } from "./module.ts";
export { BigIntTable, HermesModule, RegExpTable, StringTable } from "./module.ts";
export { writeHermesModule } from "./moduleWriter.ts";

export type ExceptionHandler = [number, number, number];
export type DebugOffsets = [number, number, number];

export interface PartialFunctionHeader {
    paramCount: number;
    functionName: number;
}

export interface ModuleBytecode {
    opcodes: Uint8Array;
    jumpTables?: Uint8Array;
}

export interface ModuleFunction {
    id: number;
    header: PartialFunctionHeader;
    bytecode: ModuleBytecode;
    exceptionHandlers: ExceptionHandler[] | undefined;
    debugOffsets: DebugOffsets | undefined;
}

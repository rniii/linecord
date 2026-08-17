export type ExceptionHandler = [number, number, number];
export type DebugOffsets = [number, number, number];

export interface PartialFunctionHeader {
    paramCount: number;
    functionName: number;
    /** Register count[?] */
    frameSize: number;
    /** Size of `CreateEnvironment` slots */
    environmentSize: number;
    /** Highest slot used in `GetById`-family opcodes */
    highestReadCacheIndex: number;
    /** Highest slot used in `PutById`-family opcodes */
    highestWriteCacheIndex: number;
    /** Prohibits calling without new (0), with new (1), or not at all (2) */
    prohibitInvoke: number;
    /** Set to 1 if `"use strict";` applies to this function */
    strictMode: number;
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

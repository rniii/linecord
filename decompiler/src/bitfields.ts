import { Bitfield, type ParsedBitfield } from "./Bitfield.ts";

const functionHeaderFlagFields = {
    prohibitInvoke: 2,
    strictMode: 1,
    hasExceptionHandler: 1,
    hasDebugInfo: 1,
    overflowed: 1,
    kind: 2,
};

export const smallFunctionHeader = new Bitfield({
    offset: 25,
    paramCount: 5,
    loopDepth: 2,
    bytecodeSizeInBytes: 14,
    functionName: 8,
    numberRegCount: 5,
    nonPtrRegCount: 5,
    frameSize: 8,
    readCacheSize: 8,
    writeCacheSize: 6,
    numCacheNewObject: 1,
    privateNameCacheSize: 1,

    ...functionHeaderFlagFields,
});

export const largeFunctionHeader = new Bitfield({
    offset: 32,
    paramCount: 32,
    loopDepth: 32,
    bytecodeSizeInBytes: 32,
    functionName: 32,
    numberRegCount: 32,
    nonPtrRegCount: 32,
    frameSize: 32,
    readCacheSize: 8,
    writeCacheSize: 8,
    numCacheNewObject: 8,
    privateNameCacheSize: 8,

    ...functionHeaderFlagFields,
});

export type FunctionHeader = ParsedBitfield<typeof largeFunctionHeader>;

export function getLargeOffset(smallHeader: FunctionHeader) {
    return ((smallHeader.functionName << 24) | smallHeader.offset) >>> 0;
}

export const stringKind = new Bitfield({
    count: 31,
    kind: 1,
});

export type StringKind = ParsedBitfield<typeof stringKind>;

export const identifierHash = new Bitfield({
    hash: 32,
});

export type IdentifierHash = ParsedBitfield<typeof identifierHash>;

export const stringTableEntry = new Bitfield({
    isUtf16: 1,
    offset: 23,
    length: 8,
});

export type StringTableEntry = ParsedBitfield<typeof stringTableEntry>;

export const offsetLengthPair = new Bitfield({
    offset: 32,
    length: 32,
});

export type OffsetLengthPair = ParsedBitfield<typeof offsetLengthPair>;

export const shapeTableEntry = new Bitfield({
    keyBufferOffset: 32,
    numProps: 32,
});

export type ShapeTableEntry = ParsedBitfield<typeof shapeTableEntry>;

export const functionSourceEntry = new Bitfield({
    functionId: 32,
    stringId: 32,
});

export type FunctionSourceEntry = ParsedBitfield<typeof functionSourceEntry>;

export const exceptionHandlerInfo = new Bitfield({
    start: 32,
    end: 32,
    target: 32,
});

export type ExceptionHandlerInfo = ParsedBitfield<typeof exceptionHandlerInfo>;

export const debugOffsets = new Bitfield({
    sourceLocations: 32,
});

export type DebugOffsets = ParsedBitfield<typeof debugOffsets>;

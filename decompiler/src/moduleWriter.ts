import {
    debugOffsets,
    exceptionHandlerInfo,
    type FunctionHeader,
    identifierHash,
    largeFunctionHeader,
    offsetLengthPair,
    shapeTableEntry,
    smallFunctionHeader,
    stringKind,
    stringTableEntry,
} from "./bitfields.ts";
import type { ModuleBytecode } from "./function.ts";
import { type Header, HERMES_SIGNATURE, HERMES_VERSION, HermesModule, segmentModule } from "./module.ts";
import { entries, padSize } from "./utils.ts";

export function writeHermesModule(module: HermesModule) {
    const header: Header = {
        version: HERMES_VERSION,
        hash: module.sourceHash,
        fileLength: 0, // to be filled
        globalCodeIndex: module.globalCodeIndex,
        functionCount: module.functions.length,
        stringKindCount: module.strings.kinds.length,
        identifierCount: module.identifierHashes.byteLength / identifierHash.byteSize,
        stringCount: module.strings.length,
        overflowStringCount: module.strings.overflowEntries.length,
        stringStorageSize: module.strings.storage.byteLength,
        bigIntCount: module.bigInts.length,
        bigIntStorageSize: module.bigInts.storage.byteLength,
        regExpCount: module.regExps.length,
        regExpStorageSize: module.regExps.storage.byteLength,
        literalValueBufferSize: module.literalValueBuffer.byteLength,
        objKeyBufferSize: module.objectKeyBuffer.byteLength,
        objShapeTableCount: module.objectShapes.length,
        numStringSwitchImms: module.numStringSwitchImms,
        segmentID: module.segmentID,
        cjsModuleCount: module.cjsModuleTable.byteLength / offsetLengthPair.byteSize,
        functionSourceCount: module.functionSourceTable.byteLength / offsetLengthPair.byteSize,
        debugInfoOffset: 0, // to be filled
        options: module.options,
    };

    const segments = segmentModule(header);

    let offset = segments.bytecodeAndFunctionInfo[0];

    const bcMap = new Map<ModuleBytecode, number>();

    for (const bytecode of module.bytecode) {
        bcMap.set(bytecode, offset);

        offset += bytecode.opcodes.byteLength;
        if (bytecode.jumpTables) {
            offset = padSize(offset);
            offset += bytecode.jumpTables.byteLength;
        }
    }

    const funcHeaders: FunctionHeader[] = module.functions.map(func => ({
        ...func.header,
        offset: bcMap.get(func.bytecode)!,
        bytecodeSizeInBytes: func.bytecode.opcodes.byteLength,
        hasExceptionHandler: +!!func.exceptionTable,
        hasDebugInfo: +!!func.debugOffsets,
        overflowed: 0,
    }));

    offset = padSize(offset);

    const smallHeaders: FunctionHeader[] = module.functions.map((func, i) => {
        const small = getSmallHeader(funcHeaders[i], offset);

        if (small.overflowed) {
            offset += largeFunctionHeader.byteSize;
            if (func.exceptionTable) {
                offset += 4;
                offset += func.exceptionTable.length * exceptionHandlerInfo.byteSize;
            }
            if (func.debugOffsets) {
                offset += debugOffsets.byteSize;
            }
        }

        return small;
    });

    if (module.debugInfo) {
        header.debugInfoOffset = offset;
        offset += module.debugInfo.byteLength;
    }

    const fileLength = header.fileLength = offset + 20;

    // everything up until now is only to calculate the correct offsets within the file :D
    // worth it for only doing a single allocation B)

    const buffer = new ArrayBuffer(fileLength);
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    view.setBigUint64(0, HERMES_SIGNATURE, true);

    offset = 8;
    for (const [field, value] of entries(header)) {
        if (field === "hash") {
            data.set(value as Uint8Array, offset);
            offset += 20;
        } else {
            view.setUint32(offset, value as number, true);
            offset += 4;
        }
    }

    smallFunctionHeader.writeItems(view, segments.functionHeaders[0], smallHeaders);
    stringKind.writeItems(view, segments.stringKinds[0], module.strings.kinds);
    data.set(module.identifierHashes, segments.identifierHashes[0]);
    stringTableEntry.writeItems(view, segments.stringTable[0], module.strings.entries);
    offsetLengthPair.writeItems(view, segments.overflowStringTable[0], module.strings.overflowEntries);
    data.set(module.strings.storage, segments.stringStorage[0]);
    data.set(module.literalValueBuffer, segments.literalValueBuffer[0]);
    data.set(module.objectKeyBuffer, segments.objectKeyBuffer[0]);
    shapeTableEntry.writeItems(view, segments.objectShapeTable[0], module.objectShapes);
    offsetLengthPair.writeItems(view, segments.bigIntTable[0], module.bigInts.entries);
    data.set(module.bigInts.storage, segments.bigIntStorage[0]);
    offsetLengthPair.writeItems(view, segments.regExpTable[0], module.regExps.entries);
    data.set(module.regExps.storage, segments.regExpStorage[0]);
    data.set(module.cjsModuleTable, segments.cjsModuleTable[0]);
    data.set(module.functionSourceTable, segments.functionSourceTable[0]);

    offset = segments.bytecodeAndFunctionInfo[0];

    for (const bytecode of module.bytecode) {
        data.set(bytecode.opcodes, offset);
        offset += bytecode.opcodes.byteLength;

        if (bytecode.jumpTables) {
            offset = padSize(offset);
            data.set(bytecode.jumpTables, offset);
            offset += bytecode.jumpTables.byteLength;
        }
    }

    offset = padSize(offset);

    for (const [i, func] of module.functions.entries()) {
        const header = funcHeaders[i];
        const smallHeader = smallHeaders[i];

        if (smallHeader.overflowed) {
            largeFunctionHeader.write(view, offset, header);
            offset += largeFunctionHeader.byteSize;

            if (func.exceptionTable) {
                view.setUint32(offset, func.exceptionTable.length, true);
                offset += 4;
                exceptionHandlerInfo.writeItems(view, offset, func.exceptionTable);
                offset += exceptionHandlerInfo.byteSize * func.exceptionTable.length;
            }
            if (func.debugOffsets) {
                debugOffsets.write(view, offset, func.debugOffsets);
                offset += debugOffsets.byteSize;
            }
        }
    }

    if (module.debugInfo) data.set(module.debugInfo, header.debugInfoOffset);

    return data;
}

function getSmallHeader(funcHeader: FunctionHeader, infoOffset: number) {
    if (
        funcHeader.hasExceptionHandler || funcHeader.hasDebugInfo
        || smallFunctionHeader.segments.some(([field, { mask }]) => funcHeader[field] > mask)
    ) {
        return {
            ...Object.fromEntries(smallFunctionHeader.segments.map(([field]) => [field, 0])),
            offset: infoOffset & 0xff_ffff,
            functionName: (infoOffset >> 24) & 0xff,
            overflowed: 1,
        } as FunctionHeader;
    }

    return funcHeader;
}

import { bisect, fromEntries, mapValues, padSize, toBigInt } from "../../utils/index.ts";
import {
    functionSourceEntry,
    getLargeOffset,
    identifierHash,
    largeFunctionHeader,
    offsetLengthPair,
    smallFunctionHeader,
    type StringKind,
    stringKind,
    type StringTableEntry,
    stringTableEntry,
} from "./bitfields.ts";
import { ModuleBytecode, ModuleFunction } from "./function.ts";

// https://github.com/facebook/hermes/blob/hermes-v250829098.0.14/include/hermes/BCGen/HBC/BytecodeVersion.h#L23
export const HERMES_VERSION = 98;

// https://github.com/facebook/hermes/blob/v0.13.0/include/hermes/BCGen/HBC/BytecodeFileFormat.h#L27
export const HERMES_SIGNATURE = 0x1F1903C103BC1FC6n;

// From now on also reference:
// https://github.com/facebook/hermes/blob/v0.13.0/lib/BCGen/HBC/BytecodeStream.cpp
//
// Some assumptions are made about the file layout based on Hermes' own serializer. This means that
// while *technically* you could create a file which runs on Hermes but can't be parsed here, their
// compiler would never output bytecode which violates this layout.

export type Entry = { offset: number; length: number };

export abstract class DataTable<T> {
    storage: Uint8Array;
    entries: Entry[];
    length: number;

    constructor(storage: Uint8Array, entries: Entry[]) {
        this.storage = storage;
        this.entries = entries;
        this.length = entries.length;
    }

    abstract get(index: number): T;

    *[Symbol.iterator]() {
        let i = 0;
        while (i < this.entries.length) {
            yield this.get(i++);
        }
    }
}

const Utf8D = new TextDecoder("utf-8");
const Utf16D = new TextDecoder("utf-16");

export class StringTable extends DataTable<string> {
    declare entries: StringTableEntry[];
    overflowEntries: Entry[];
    kinds: StringKind[];

    constructor(
        storage: Uint8Array,
        entries: StringTableEntry[],
        overflowEntries: Entry[],
        kinds: StringKind[],
    ) {
        super(storage, entries);
        this.overflowEntries = overflowEntries;
        this.kinds = kinds;
    }

    get(index: number) {
        const entry = this.entries[index];

        const { isUtf16 } = entry;
        const { length, offset } = entry.length === 0xff
            ? this.overflowEntries[entry.offset]
            : entry;

        const bytes = this.storage.subarray(offset, offset + length * (isUtf16 ? 2 : 1));

        return isUtf16 ? Utf16D.decode(bytes) : Utf8D.decode(bytes);
    }
}

export class BigIntTable extends DataTable<bigint> {
    get(index: number) {
        const { offset, length } = this.entries[index];

        return toBigInt(this.storage.subarray(offset, offset + length));
    }
}

export class RegExpTable extends DataTable<never> {
    get(): never {
        throw Error("Not implemented");
    }
}

export class ObjectTable extends DataTable<never> {
    get(): never {
        throw "fish";
    }
}

export class HermesModule {
    sourceHash: Uint8Array;
    globalCodeIndex: number;
    segmentID: number;
    numStringSwitchImms: number;
    options: number;

    // some segments which are not parsed, but are written back to patched files
    identifierHashes: Uint8Array;
    cjsModuleTable: Uint8Array;
    functionSourceTable: Uint8Array;
    debugInfo?: Uint8Array;

    literalValueBuffer: Uint8Array;
    objectKeyBuffer: Uint8Array;

    strings: StringTable;
    bigInts: BigIntTable;
    regExps: RegExpTable;
    objects: ObjectTable;

    bytecode: ModuleBytecode[];
    functions: ModuleFunction[];

    constructor(
        header: Header,
        segments: Record<Segment, Uint8Array>,
        buffer: ArrayBuffer,
    ) {
        this.sourceHash = header.hash;
        this.globalCodeIndex = header.globalCodeIndex;
        this.segmentID = header.segmentID;
        this.numStringSwitchImms = header.numStringSwitchImms;
        this.options = header.options;

        this.identifierHashes = segments.identifierHashes;
        this.cjsModuleTable = segments.cjsModuleTable;
        this.functionSourceTable = segments.functionSourceTable;

        this.literalValueBuffer = segments.literalValueBuffer;
        this.objectKeyBuffer = segments.objectKeyBuffer;

        if (header.debugInfoOffset) {
            // debug info is followed by a 20 byte SHA-1 hash, which we don't check
            this.debugInfo = new Uint8Array(
                buffer,
                header.debugInfoOffset,
                buffer.byteLength - header.debugInfoOffset - 20,
            );
        }

        this.strings = new StringTable(
            segments.stringStorage,
            stringTableEntry.parseArray(segments.stringTable),
            offsetLengthPair.parseArray(segments.overflowStringTable),
            stringKind.parseArray(segments.stringKinds),
        );
        this.bigInts = new BigIntTable(
            segments.bigIntStorage,
            offsetLengthPair.parseArray(segments.bigIntTable),
        );
        this.regExps = new RegExpTable(
            segments.regExpStorage,
            offsetLengthPair.parseArray(segments.regExpTable),
        );
        this.objects = new ObjectTable(
            segments.objectShapeTable,
            offsetLengthPair.parseArray(segments.objectShapeTable),
        );

        [this.bytecode, this.functions] = parseFunctions(segments, buffer);
    }
}

export function parseHermesModule(buffer: ArrayBuffer) {
    const header = parseHeader(buffer);
    const segments = mapValues(segmentModule(header), p => new Uint8Array(buffer, ...p));

    return new HermesModule(header, segments, buffer);
}

function parseFunctions(
    segments: Record<Segment, Uint8Array>,
    buffer: ArrayBuffer,
): [ModuleBytecode[], ModuleFunction[]] {
    const view = new DataView(buffer);

    let bytecodeEnd = 0;

    const smallHeaders = smallFunctionHeader.parseArray(segments.functionHeaders);
    const functionHeaders = smallHeaders.map(header => {
        if (header.overflowed) {
            const offset = getLargeOffset(header);
            header = largeFunctionHeader.parse(view, offset);

            if (!bytecodeEnd) bytecodeEnd = offset; // overflowed headers start after bytecode
        }

        return header;
    });

    bytecodeEnd ||= segments.debugInfo[0];

    const bytecodeOffsets: number[] = [];
    const bytecodeLengths: number[] = [];
    const bytecodeIndex: number[] = [];

    for (const header of functionHeaders) {
        let idx = bisect(bytecodeOffsets, header.offset);

        if (bytecodeOffsets[idx] !== header.offset) {
            bytecodeOffsets.splice(idx, 0, header.offset);
            bytecodeLengths.splice(idx, 0, header.bytecodeSizeInBytes);
        } else if (bytecodeLengths[idx] !== header.bytecodeSizeInBytes) {
            if (bytecodeLengths[idx] === 0) {
                idx++;
                bytecodeOffsets.splice(idx, 0, header.offset);
                bytecodeLengths.splice(idx, 0, header.bytecodeSizeInBytes);
            } else {
                throw Error("what?");
            }
        }

        bytecodeIndex.push(idx);
    }

    if (bytecodeOffsets[0] !== segments.bytecodeAndFunctionInfo.byteOffset) {
        throw Error(`Earliest bytecode is ${bytecodeOffsets[0]} after ${segments.bytecodeAndFunctionInfo[0]}`);
    }

    const bytecode = bytecodeOffsets.map((offset, idx) => new ModuleBytecode(
        buffer,
        offset,
        bytecodeLengths[idx],
        bytecodeOffsets[idx + 1] ?? bytecodeEnd,
    ));

    const functions = functionHeaders.map((header, id) => new ModuleFunction(
        id,
        header,
        smallHeaders[id],
        bytecode[bytecodeIndex[id]],
        buffer,
    ));

    return [bytecode, functions];
}

export type Segment = keyof ReturnType<typeof segmentModule>;

export function segmentModule(header: Header) {
    let offset = 128;

    return {
        ...mapValues({
            functionHeaders: header.functionCount * smallFunctionHeader.byteSize,
            stringKinds: header.stringKindCount * stringKind.byteSize,
            identifierHashes: header.identifierCount * identifierHash.byteSize,
            stringTable: header.stringCount * stringTableEntry.byteSize,
            overflowStringTable: header.overflowStringCount * offsetLengthPair.byteSize,
            stringStorage: header.stringStorageSize,
            literalValueBuffer: header.literalValueBufferSize,
            objectKeyBuffer: header.objKeyBufferSize,
            objectShapeTable: header.objShapeTableCount * offsetLengthPair.byteSize,
            bigIntTable: header.bigIntCount * offsetLengthPair.byteSize,
            bigIntStorage: header.bigIntStorageSize,
            regExpTable: header.regExpCount * offsetLengthPair.byteSize,
            regExpStorage: header.regExpStorageSize,
            cjsModuleTable: header.cjsModuleCount * offsetLengthPair.byteSize,
            functionSourceTable: header.functionSourceCount * functionSourceEntry.byteSize,
        }, size => {
            const start = offset;
            offset += padSize(size);
            return [start, size];
        }),
        bytecodeAndFunctionInfo: [offset, header.debugInfoOffset - offset],
        debugInfo: [header.debugInfoOffset, header.fileLength - header.debugInfoOffset],
    } satisfies Record<string, [number, number]>;
}

export type Header = ReturnType<typeof parseHeader>;

export function parseHeader(buffer: ArrayBuffer) {
    const view = new DataView(buffer);

    if (view.getBigUint64(0, true) !== HERMES_SIGNATURE) {
        throw Error("Not a Hermes bytecode file");
    }

    const version = view.getUint32(8, true);

    if (version !== HERMES_VERSION) {
        console.warn(`Hermes file has version ${version}, expected ${HERMES_VERSION}`);
    }

    return {
        version,
        hash: new Uint8Array(view.buffer, 12, 20).slice() as Uint8Array,
        ...fromEntries(([
            "fileLength",
            "globalCodeIndex",
            "functionCount",
            "stringKindCount",
            "identifierCount",
            "stringCount",
            "overflowStringCount",
            "stringStorageSize",
            "bigIntCount",
            "bigIntStorageSize",
            "regExpCount",
            "regExpStorageSize",
            "literalValueBufferSize",
            "objKeyBufferSize",
            "objShapeTableCount",
            "numStringSwitchImms",
            "segmentID",
            "cjsModuleCount",
            "functionSourceCount",
            "debugInfoOffset",
            "options",
        ] as const).map((k, i) => [k, view.getUint32(32 + i * 4, true)])),
    };
}

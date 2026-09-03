import { type DebugOffsets, debugOffsets, type ExceptionHandlerInfo, exceptionHandlerInfo, type FunctionHeader, getLargeOffset, largeFunctionHeader } from "./bitfields.ts";
import { padSize } from "./utils.ts";

export class ModuleBytecode {
    opcodes: Uint8Array;
    jumpTables?: Uint8Array;

    constructor(
        buffer: ArrayBuffer,
        offset: number,
        length: number,
        nextOffset: number,
    ) {
        this.opcodes = new Uint8Array(buffer, offset, length);

        if (offset + length < nextOffset) {
            offset = padSize(offset + length);

            this.jumpTables = new Uint8Array(buffer.slice(offset, nextOffset));
        }
    }
}

export type PartialFunctionHeader = Record<Exclude<
    keyof FunctionHeader,
    | "offset"
    | "bytecodeSizeInBytes"
    | "hasExceptionHandler"
    | "hasDebugInfo"
    | "overflowed"
>, number>;

export class ModuleFunction {
    id: number;
    header: PartialFunctionHeader;
    bytecode: ModuleBytecode;
    exceptionTable?: ExceptionHandlerInfo[];
    debugOffsets?: DebugOffsets;

    constructor(
        id: number,
        header: FunctionHeader,
        smallHeader: FunctionHeader,
        bytecode: ModuleBytecode,
        buffer: ArrayBuffer,
    ) {
        this.id = id;
        this.header = header;
        this.bytecode = bytecode;

        if ((header.hasExceptionHandler || header.hasDebugInfo)) {
            if (!smallHeader.overflowed) throw Error("Function missing info offset");

            let offset = padSize(getLargeOffset(smallHeader)) + largeFunctionHeader.byteSize;
            const view = new DataView(buffer);

            if (header.hasExceptionHandler) {
                const count = view.getUint32(offset, true);

                this.exceptionTable = exceptionHandlerInfo.parseArray(new Uint8Array(buffer.slice(
                    offset += 4,
                    offset += exceptionHandlerInfo.byteSize * count,
                )));
            }

            if (header.hasDebugInfo) {
                this.debugOffsets = debugOffsets.parse(view, offset);
            }
        }
    }
}

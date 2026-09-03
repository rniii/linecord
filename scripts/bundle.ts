import { readFile } from "node:fs/promises";

async function main() {
    const axml = (await readFile("AndroidManifest.xml")).buffer;
    const view = seekable(offset => new DataView(axml, offset));

    console.log(axml);
    console.log((Chunk.create(view) as Xml).getStringPool());
}

abstract class Chunk {
    offset: number;
    headerSize: number;
    chunkSize: number;
    parent?: Chunk;

    constructor(view: Seekable<DataView>, parent?: Chunk) {
        this.offset = view.byteOffset;

        this.headerSize = view.getUint16(2, true);
        this.chunkSize = view.getUint32(4, true);
        view.byteOffset += this.chunkSize;

        this.parent = parent;
    }

    static create(view: Seekable<DataView>, parent?: Chunk): Chunk {
        const type = view.getUint16(0, true) as keyof typeof types;
        if (!(type in types)) return new UnknownChunk(view, parent);

        return new types[type](view, parent);
    }
}

class ParentChunk extends Chunk {
    children: Chunk[];

    constructor(view: Seekable<DataView>, parent?: Chunk) {
        super(view, parent);

        this.children = [];

        view.byteOffset = this.offset + this.headerSize;
        while (view.byteOffset < this.offset + this.chunkSize) {
            const chunk = Chunk.create(view, this);
            this.children.push(chunk);
        }
    }
}

class StringPool extends Chunk {
    flags: number;
    strings: string[];

    constructor(view: Seekable<DataView>, parent?: Chunk) {
        super(view, parent);

        this.strings = [];

        view.byteOffset = this.offset + 8;

        const strCount = view.getUint32(0, true);
        // const styleCount = view.getUint32(4, true);
        const strFlags = view.getUint32(8, true);
        const strOffset = view.getUint32(12, true);
        // const styleStart = view.getUint32(16, true);

        this.flags = strFlags;

        console.log(strCount, strOffset);

        view.byteOffset = this.offset + strOffset;
        for (let i = 0; i < strCount; i++) {
            const offset = this.offset + view.getUint32(0, true) + strOffset;
            view.byteOffset += 4;

            if (this.flags & FLAG_UTF8) {
                const len = strlen(view.buffer.slice(offset));

                this.strings.push(Utf8D.decode(view.buffer.slice(offset, len)));
            } else {
                const len = wcslen(view.buffer.slice(offset));

                this.strings.push(Utf16D.decode(view.buffer.slice(offset, len)));
            }
        }

        view.byteOffset = this.offset + this.chunkSize;
    }
}

class Xml extends ParentChunk {
    getStringPool() {
        for (const chunk of this.children) {
            if (chunk instanceof StringPool) {
                return chunk;
            }
        }

        throw "fish";
    }
}

class UnknownChunk extends Chunk {}

const types = {
    0x0001: StringPool,
    0x0003: Xml,
};

// const FLAG_SORTED = 1 << 0;
const FLAG_UTF8 = 1 << 8;

const Utf8D = new TextDecoder("utf-8");
const Utf16D = new TextDecoder("utf-16le");

function strlen(buffer: ArrayBufferLike) {
    const data = new Uint8Array(buffer);

    let i;
    for (i = 0; data[i]; ++i) continue;

    return i;
}

function wcslen(buffer: ArrayBufferLike) {
    const view = new DataView(buffer);

    let i;
    for (i = 0; view.getUint16(i, true); ++i) continue;

    return i;
}

type Seekable<T extends { byteOffset: number }> =
    Omit<T, "byteOffset"> & { byteOffset: number };

function seekable<T extends { byteOffset: number }>(impl: (offset: number) => T): Seekable<T> {
    let buffer = impl(0);

    return new Proxy(buffer as any, {
        get(_target, prop) {
            const result = Reflect.get(buffer, prop, buffer);
            if (typeof result === "function") {
                return function (...args: any) {
                    return Reflect.apply(result, buffer, args);
                };
            }

            return result;
        },
        set(_target, prop, value, recv) {
            if (prop === "byteOffset") return buffer = impl(value), true;

            return Reflect.set(buffer, prop, value, recv);
        },
    });
}

await main();

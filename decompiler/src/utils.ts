export function fromEntries<K extends keyof any, V>(entries: Iterable<readonly [K, V]>) {
    return Object.fromEntries(entries) as Record<K, V>;
}

export function entries<K extends keyof any, V>(obj: { [key in K]?: V }) {
    return Object.entries(obj) as [K, V][];
}

export function hasOwn<O extends object>(obj: O, key: keyof any): key is keyof O {
    return Object.hasOwn(obj, key);
}

export function mapValues<K extends keyof any, V, W>(obj: { [key in K]?: V }, func: (v: V) => W) {
    return fromEntries(entries(obj).map(([k, v]) => [k, func(v)]));
}

/** Perform a binary search for a given element, returning the leftmost index. */
export function bisect<T>(arr: T[], value: any, key = (x: T) => x as any) {
    let lo = 0, hi = arr.length;

    while (lo < hi) {
        const mid = (lo + hi) / 2 | 0;

        if (key(arr[mid]) < value) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }

    return lo;
}

export function padSize(size: number) {
    return Math.ceil(size / 4) * 4;
}

/** Parses buffer as little-endian bigint */
export function toBigInt(buffer: Uint8Array) {
    let bigint = 0n;
    for (let i = 0; i < buffer.length; i++) {
        bigint |= BigInt(buffer[i]) << (BigInt(i) * 8n);
    }
    return bigint;
}

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

export function transpose<T>(matrix: T[][]): T[][] {
    const newArray: T[][] = [];
    for (let i = 0; i < matrix[0].length; i++) {
        newArray.push([]);
    }

    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[0].length; x++) {
            newArray[x].push(matrix[y][x]);
        }
    }

    return newArray;
}

// export function dedent(text: TemplateStringsArray, ...values: any[]) {
//     const [indent] = text[0].match(/^ */)!;
//     const re = new RegExp(`^${indent}`, "gm");

//     return String.raw({ raw: text.map(x => x.replace(re, "")) }, ...values);
// }

export function formatSizeUnit(bytes: number) {
    const units = ["B", "KiB", "MiB", "GiB"];

    while (bytes > 1024 && units.length > 1) {
        bytes /= 1024;
        units.shift();
    }

    bytes = Math.floor(+bytes.toPrecision(3) * 100) / 100;

    return bytes + units.shift()!;
}

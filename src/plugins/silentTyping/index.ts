import { Opcode } from "decompiler/opcodes";

import { definePlugin } from "#api/plugin.ts";

export default definePlugin({
    name: "SilentTyping",
    authors: ["paige"],

    patches: [
        {
            strings: ["Object", "defineProperty"],
            objectKeys: ["startTyping"],
            patches: {
                identifier: "startTyping",
                replace: [
                    [Opcode.LoadConstUndefined, 0],
                    [Opcode.Ret, 0],
                ],
            },
        },
    ],
});

import type { PatchDef } from "./patches.ts";

type Author = keyof Developer;

export interface PluginDef {
    name: string;
    authors: Author[];
    patches: PatchDef[];
}

export function definePlugin(plugin: PluginDef) {
    return plugin;
}

interface Developer {
    name: string;
    github: string;
    githubId: number;
}

export const Devs = {
    "rini": {
        name: "rini",
        github: "rniii",
        githubId: 142252300,
    },
} satisfies Record<string, Developer>;

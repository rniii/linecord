import { execFileSync } from "child_process";
import { unzip } from "fflate";
import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { parseArgs } from "util";

const { values } = parseArgs({ allowNegative: true, options: {
    copy: { type: "boolean", default: true },
    remote: { type: "boolean", default: false },
    platform: { type: "string" },
} });

const isLocal = process.platform === "android";
const target = values.platform === "android" || values.platform === "ios"
    ? values.platform
    : isLocal ? "android" : null;

if (values.copy) copyFiles();

for (const [app, bundle, assetPath] of [
    ["discord/base.apk", "discord/android.hbc", "assets/index.android.bundle"],
    ["discord/apple.ipa", "discord/apple.hbc", "Payload/Discord.app/main.jsbundle"],
]) {
    let buffer;

    try {
        buffer = readFileSync(app);
    } catch {
        continue;
    }

    unzip(buffer, { filter: file => file.name === assetPath }, (err, data) => {
        if (err) throw err;

        writeFileSync(bundle, data[assetPath]);
        console.log(app, "=>", bundle);
    });
}

function copyFiles() {
    if (target === "android") {
        if (!isLocal && !values.remote) return;

        const packages = pmPath()
            .replaceAll(/^package:/gm, "")
            .split("\n")
            .filter(name => /base\.apk$|split_config\.(arm.*|x86.*|xxhdpi|en)\.apk$/.test(name));

        for (const pkg of packages) {
            if (isLocal) $("cp", pkg, `discord/${basename(pkg)}`);
            else $("adb", "pull", pkg, `discord/${basename(pkg)}`);
        }
    } else if (target === "ios") {
        if (!values.remote) return;

        $("ipatool", "download", "-b", "com.hammerandchisel.Discord", "-o", "discord/Discord.ipa", "--purchase");
    } else {
        throw Error("Pass --platform android or --platform ios, or use --no-copy");
    }
}

function pmPath() {
    return isLocal
        ? execFileSync("pm", ["path", "com.discord"], { encoding: "utf8" })
        : execFileSync("adb", ["shell", "pm path com.discord"], { encoding: "utf8" });
}

function $(exe: string, ...args: string[]) {
    console.log(`$ ${exe} ${args.join(" ")}`);
    return execFileSync(exe, args, { encoding: "utf8" });
}

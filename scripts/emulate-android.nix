{ androidenv }:

(androidenv.emulateApp {
    name = "discord";
    package = "com.discord";
    activity = "com.discord.main.MainActivit";
    androidUserHome = "discord";

    configOptions = {
        "hw.gpu.enabled" = "yes";
        "hw.gpu.mode" = "swiftshader_indirect";
    };

    platformVersion = "35";
    systemImageType = "google_apis_playstore";
    abiVersion = "x86_64";
}).overrideAttrs (finalAttrs: { buildCommand = finalAttrs.buildCommand + ''
    mv $out/bin/{run-test-emulator,run-linecord-emulator}

    adb="$(grep -oEm1 "/.*/adb" $out/bin/run-linecord-emulator)"

    cat >> $out/bin/run-linecord-emulator << EOF
    if [ -f discord/base.apk ]; then
        $adb -s emulator-\$port install-multiple discord/base.apk \
            discord/split_config.{en,x86_64,xxhdpi}.apk
    fi

    if [ -f discord/patched/base.apk ]; then
        $adb -s emulator-\$port install-multiple discord/patched/base.apk \
            discord/split_config.{en,x86_64,xxhdpi}.apk
    fi

    wait
    EOF
''; meta.mainProgram = "run-linecord-emulator"; })

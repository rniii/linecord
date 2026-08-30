let
    nixpkgs = builtins.getFlake "nixpkgs/nixos-26.05";

    abiVersion = "x86_64";
    systemImageType = "google_apis_playstore";
    platformVersion = "35";
in (
    with nixpkgs.legacyPackages.${builtins.currentSystem};

    (androidenv.emulateApp {
        name = "discord";
        app = lib.sourceByRegex ../discord [
            "^base.apk$"
            "^split_config.(en|x86_64|xxhdpi).apk$"
        ];
        package = "com.discord";
        activity = "com.discord.main.MainActivity";
        androidUserHome = "./discord";

        configOptions = {
            "hw.gpu.enabled" = "yes";
            "hw.gpu.mode" = "swiftshader_indirect";
        };

        inherit platformVersion systemImageType abiVersion;
    }).overrideAttrs (finalAttrs: { buildCommand = finalAttrs.buildCommand + ''
        ${ed}/bin/ed $out/bin/run-test-emulator << "EOF"
        /install "$appPath"/s/^/    /
        d
        /appPath="\//x
        /appPath="$(/x
        s/install "$appPath"/install-multiple "''${appPath[@]}"/
        -1s/appPath="\$(echo \(.*\))"/appPath=(\1)/
        $a
        wait
        .
        w
        EOF
    ''; })
)

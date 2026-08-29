let
    nixpkgs = builtins.getFlake "nixpkgs/nixos-26.05";

    abiVersion = "x86_64";
    systemImageType = "google_apis_playstore";
    platformVersion = "35";
in (
    with nixpkgs.legacyPackages.${builtins.currentSystem};

    androidenv.emulateApp {
        name = "discord";
        app = lib.sourceByRegex ../discord [ "^(base|split_.*).apk$" ];
        package = "com.discord";

        configOptions = {
            "hw.gpu.enabled" = "yes";
            "hw.gpu.mode" = "swiftshader_indirect";
        };

        inherit platformVersion systemImageType abiVersion;
    }
)

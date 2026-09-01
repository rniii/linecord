{
    inputs.nixpkgs.url = "nixpkgs/nixos-26.05";

    outputs = { self, nixpkgs }:
        with nixpkgs;
        let
            forAllSystems = lib.genAttrs lib.systems.flakeExposed;
        in {
            packages = forAllSystems (system: let
                pkgs = legacyPackages.${system};
            in rec {
                inherit (pkgs.androidenv.composeAndroidPackages {
                    cmdLineToolsVersion = "8.0";
                }) androidsdk build-tools;

                emulator = pkgs.callPackage ./scripts/emulate-android.nix {};
                android-patcher = pkgs.callPackage ./scripts/patch-android.nix {
                    inherit androidsdk;
                };
            });

            # packages = forAllSystems (system: let
            # in {
            #     default = throw "fish";
            # });

            devShells = forAllSystems (system: let
                pkgs = legacyPackages.${system};

                shellOpts = opts: import ./shell.nix ({ inherit pkgs; } // opts);
            in {
                default = shellOpts {};

                all = shellOpts { android = true; ios = true; };
                android = shellOpts { android = true; ios = false; };
                ios = shellOpts { android = false; ios = true; };
            });
        };
}

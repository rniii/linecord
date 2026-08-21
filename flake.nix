{
    inputs.nixpkgs.url = "nixpkgs/nixos-unstable";

    outputs = { self, nixpkgs }:
        with nixpkgs;
        let
            forAllSystems = lib.genAttrs lib.systems.flakeExposed;
        in {
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

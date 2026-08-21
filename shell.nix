{
    pkgs ? import <nixpkgs> { },
    android ? !pkgs.stdenv.hostPlatform.isDarwin,
    ios ? pkgs.stdenv.hostPlatform.isDarwin,
}:

pkgs.mkShellNoCC {
    packages =
        with pkgs;
        [
            nodejs
            typescript
        ]
        ++ lib.optionals android [
            android-tools
        ]
        ++ lib.optionals ios [
            ipatool
        ];

    shellHook = ''
        npm install --no-audit --no-fund
    '';
}

{ androidsdk, file, lib, runtimeShell, stdenv, zip }:

stdenv.mkDerivation {
    name = "linecord-android-patcher";

    buildCommand = ''
        mkdir -p $out/bin

        cat > $out/bin/linecord-android-patcher << "EOF"
        #!${runtimeShell} -eu
        mkdir -p discord/patched
        cd discord/patched

        cp ../base.apk .

        mkdir -p assets
        cp ../patched.hbc assets/index.android.bundle

        ${lib.getExe' androidsdk "apkanalyzer"} manifest print base.apk >AndroidManifest.xml
        sed -i AndroidManifest.xml \
            -e 's/package="com.discord"/package="dev.reactnative.Linecord"/' \
            -e 's/<application/\0 android:debuggable="true"/'

        mkdir -p tmp
        ${androidsdk}/libexec/android-sdk/build-tools/*/aapt2 link \
            --warn-manifest-validation --output-to-dir -o tmp --manifest AndroidManifest.xml
        ${file} tmp/*
        return

        ${lib.getExe zip} -u base.apk AndroidManifest.xml assets/index.android.bundle
        ${lib.getExe zip} -d base.apk "META-INF/**/*"
        ${androidsdk}/libexec/android-sdk/build-tools/*/zipalign -P 16 4 base.apk align.apk
        mv align.apk base.apk

        rm AndroidManifest.xml
        rm assets/index.android.bundle
        rm manifest.xml
        rmdir assets
        EOF

        chmod +x $out/bin/linecord-android-patcher
    '';

    meta.mainProgram = "linecord-android-patcher";
}

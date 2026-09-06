mkdir -p discord/patched
cd discord/patched

cp ../*.apk .

unzip base.apk classes.dex
line=$(strings -t d classes.dex | grep -E '^[[:digit:]]+ discord\.com$')
node -e 'd = fs.readFileSync("classes.dex"),
    [offset]="'"$line"'".split(" "),
    d.set(offset, new TextEncoder().encode("url.invalid")),
    d.set(12, crypto.createHash("sha1").update(d.subarray(32)).digest()),
    a = 1, b = 0;
    for (i = 12; i < d.byteLength; i++) a = (a + d[i]) % 65521, b = (b + a) % 65521;
    d.writeUInt32LE(((b << 16) | a) >>> 0, 8),
    fs.writeFileSync("classes.dex", d)'
zip -u base.apk -0 classes.dex
rm classes.dex

# apkanalyzer manifest print base.apk >AndroidManifest.xml
# sed -i 's/package="com.discord"/package="dev.reactnative.Linecord"/' AndroidManifest.xml
# sed -i 's/<application/\0 android:debuggable="true"/' AndroidManifest.xml
# zip -u base.apk AndroidManifest.xml
# rm AndroidManifest.xml

mkdir assets
cp ../patched.hbc assets/index.android.bundle
zip -u base.apk -0 assets/index.android.bundle
rm assets/index.android.bundle
rmdir assets

[ -f giga-apk-signer.jar ] || \
curl -Lo giga-apk-signer.jar "https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar"

nix shell nixpkgs#jre8 -c \
    java -jar giga-apk-signer.jar --apks *.apk --overwrite --allowResign \
    --zipAlignPath "$(nix path-info --impure '../..#androidsdk')/libexec/android-sdk/build-tools/37.0.0/zipalign"

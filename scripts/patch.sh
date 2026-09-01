mkdir -p discord/patched
cd discord/patched

cp ../base.apk .

apkanalyzer manifest print base.apk >AndroidManifest.xml
sed -i 's/package="com.discord"/package="dev.reactnative.Linecord"/' AndroidManifest.xml
sed -i 's/<application/\0 android:debuggable="true"/' AndroidManifest.xml
zip -u base.apk AndroidManifest.xml
rm AndroidManifest.xml

mkdir assets
cp ../patched.hbc assets/index.android.bundle
zip -u base.apk assets/index.android.bundle
rm assets/index.android.bundle
rmdir assets

zip -d base.apk "META-INF/**/*"
zipalign base.apk

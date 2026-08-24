# linecord

![](logo.jpg)

WIP bytecode-based client mod for Discord mobile.

## Usage:

You need to have either .apk files (Android) or a .ipa (iOS). Using
`scripts/extract.ts` you can grab either from your mobile device after setting
up the respective tool:

```
$ node scripts/extract.ts --platform android    # Using ADB
$ node scripts/extract.ts --platform ios        # Or using ipatool
```

Or, place it the main split at `discord/base.apk` or the iOS ipa at `discord/apple.ipa` and run the same with `--no-copy`. Additionally if `process.platform` is `"android"` (yay termux), it will pull the apk from the device itself.

Now you can run `npm start`! And get a `discord/android.patched.hbc` and.. Sorry you have to figure out the rest for now.

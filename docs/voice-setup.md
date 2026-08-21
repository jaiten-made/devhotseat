# Voice setup

The app uses the browser's own speech APIs, so there is normally nothing to
install. Chrome ships its own voices — on this machine it exposes *Google US
English*, *Google UK English Female* and *Google UK English Male* — and the app
prefers those over anything else it finds.

## If nothing is read aloud

**Restart Chrome completely.** It builds its voice list at startup and the list
is empty until then; reloading the page is not enough.

Then check in the Chrome console (`F12` → Console; the first paste needs you to
type `allow pasting` once):

```bash
speechSynthesis.getVoices().filter(v => v.lang.startsWith('en')).map(v => v.name)
```

An array of names means Chrome can speak. An empty array after a full restart
means it genuinely has none, which is when the section below applies.

## System voices, if Chrome has none

```bash
sudo apt install speech-dispatcher espeak-ng
```

Then restart Chrome again and re-run the check.

Be aware this may change nothing: Chrome on Linux does not necessarily surface
speech-dispatcher voices, and on this machine it does not — espeak-ng and
mbrola are both installed and neither appears in the list above. Install these
only if the check keeps coming back empty.

To confirm the system audio path independently of Chrome:

```bash
spd-say "testing one two three"
```

## Browser support

Speech recognition is Chrome-family only — Firefox and Safari do not implement
it — and the microphone needs permission the first time a session runs.

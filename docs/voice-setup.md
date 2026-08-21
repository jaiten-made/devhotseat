# Voice setup on Ubuntu

The app uses the browser's own speech APIs, so there is nothing to install for
the project itself. Chrome on Linux, though, gets its voices from the system
rather than shipping its own, and a stock Ubuntu install has none. Without them
questions are never read aloud.

## Install the voices

```bash
sudo apt install speech-dispatcher espeak-ng
```

## Restart Chrome completely

Chrome enumerates system voices **once, at startup**. Reloading the page is not
enough — quit every Chrome window and open it again.

## Check it worked

In the Chrome console:

```bash
speechSynthesis.getVoices().length
```

Anything above zero means Chrome can see them. If it is still zero, Chrome was
not fully restarted.

To test the audio path on its own, independently of Chrome:

```bash
spd-say "testing one two three"
```

And to confirm English voices are installed at all:

```bash
espeak-ng --voices=en
```

## Voice quality

These are espeak-ng voices: clear, but obviously synthetic. Installing an
`mbrola` voice package gives more natural output through the same API and needs
no change to the app.

## Browser support

Speech recognition is Chrome-family only — Firefox and Safari do not implement
it — and the microphone needs permission the first time a session runs.

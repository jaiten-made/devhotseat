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

## Better voices

espeak-ng on its own is clear but obviously synthetic. mbrola voices are
diphone-based and markedly less robotic:

```bash
sudo apt install mbrola mbrola-us1 mbrola-us2 mbrola-us3 mbrola-en1
```

That is the engine plus American female, American male and British male
voices. Restart Chrome again afterwards, for the same reason as before.

The app picks the best installed English voice by name rather than accepting
the browser's default, which on Linux is the first espeak voice regardless of
what else is present.

## Browser support

Speech recognition is Chrome-family only — Firefox and Safari do not implement
it — and the microphone needs permission the first time a session runs.

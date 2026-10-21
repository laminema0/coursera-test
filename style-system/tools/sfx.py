"""sfx — sound effects for Deadpan Line episodes: real recordings (load) + procedural fallbacks.

Every function returns a mono float32 array at SR. Mix them into a
timeline with Track.add(time, sound, gain).
"""
import os
import subprocess
import wave

import numpy as np

SR = 48000
_rng = np.random.default_rng(11)


def seed(n):
    global _rng
    _rng = np.random.default_rng(n)


def _t(dur):
    return np.arange(int(dur * SR)) / SR


def band(x, lo=0, hi=None):
    """Brick-wall band filter via FFT (fine for noise-based effects)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | ((f > hi) if hi else False)] = 0
    return np.fft.irfft(X, len(x)).astype(np.float32)


def norm(x, peak=1.0):
    return (x * peak / (np.abs(x).max() + 1e-9)).astype(np.float32)


def env_ad(n, attack=0.01, decay=None, curve=4.0):
    a = max(1, int(attack * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    if decay is not None:
        e[a:] = np.exp(-np.linspace(0, curve, n - a))
    return e


def noise(dur):
    return _rng.standard_normal(int(dur * SR))


def tone(freq, dur, harmonics=1, phase_jitter=0.0):
    """freq may be a number or an array (glide) of len(dur*SR)."""
    n = int(dur * SR)
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros(n)
    for k in range(1, harmonics + 1):
        out += np.sin(k * ph + _rng.uniform(0, phase_jitter)) / k
    return out


# ---------------------------------------------------------------- effects
def ambience(dur):
    hum = 0.3 * np.sin(2 * np.pi * 50 * _t(dur)) + 0.15 * np.sin(2 * np.pi * 100 * _t(dur))
    return norm(band(noise(dur), 30, 400) + 0.2 * hum)


def rumble(dur, rise=0.5, fall=0.5):
    n = int(dur * SR)
    x = band(noise(dur), 20, 220) + 0.4 * np.sin(2 * np.pi * 42 * _t(dur))
    e = np.ones(n)
    r, f = int(rise * dur * SR), int(fall * dur * SR)
    e[:r] = np.linspace(0, 1, r) ** 2
    if f:
        e[n - f:] = np.linspace(1, 0, f) ** 1.5
    return norm(x * e)


def whoosh(dur):
    n = int(dur * SR)
    return norm(band(noise(dur), 300, 5000) * np.hanning(n) ** 1.5)


def clacks(dur, every=0.13):
    out = np.zeros(int(dur * SR))
    for k, t in enumerate(np.arange(0, dur - 0.05, every)):
        i = int(t * SR)
        hit = band(noise(0.05), 80, 900) * env_ad(int(0.05 * SR), 0.001, 0, 8)
        out[i:i + len(hit)] += hit * (1.0 if k % 2 else 0.7)
    return norm(out)


def horn(dur=0.8):
    x = tone(311, dur, 6) + tone(392, dur, 6)
    return norm(x * env_ad(len(x), 0.03) * np.linspace(1, 0.8, len(x)))


def brake_screech(dur=2.5):
    t = _t(dur)
    f1 = 3300 + 160 * np.sin(2 * np.pi * 13 * t) + 60 * _rng.standard_normal(len(t)).cumsum() / 400
    x = tone(f1, dur) + 0.6 * tone(f1 * 1.27, dur) + 0.3 * band(noise(dur), 2500, 6000)
    e = env_ad(len(t), 0.02) * np.exp(-t / (dur * 0.6))
    return norm(x * e)


def splash(dur=0.45):
    wet = band(noise(dur), 150, 2500) * env_ad(int(dur * SR), 0.003, 0, 7)
    out = wet.copy()
    for k in range(7):
        i = int(_rng.uniform(0.03, dur - 0.08) * SR)
        f = _rng.uniform(900, 2600)
        d = tone(np.linspace(f, f * 1.6, int(0.05 * SR)), 0.05) * env_ad(int(0.05 * SR), 0.001, 0, 9)
        out[i:i + len(d)] += d * 0.5
    return norm(out)


def slurp(dur=0.3):
    n = int(dur * SR)
    x = band(noise(dur), 400, 3000)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 28 * _t(dur))
    pitch = tone(np.linspace(600, 1100, n), dur, 3) * 0.25
    return norm((x * am + pitch) * np.hanning(n))


def motor_try(dur=1.4, f0=110, f1=360):
    n = int(dur * SR)
    f = np.linspace(f0, f1, n) ** 1.0
    x = tone(f, dur, 8) + 0.3 * band(noise(dur), 100, 1500)
    e = env_ad(n, 0.1) * np.concatenate([np.ones(n - int(0.25 * SR)), np.linspace(1, 0, int(0.25 * SR))])
    return norm(x * e)


def clunk():
    return norm(band(noise(0.18), 40, 400) * env_ad(int(0.18 * SR), 0.002, 0, 9))


_FORMANTS = {"a": ((800, 1.0), (1200, 0.6), (2600, 0.25)),
             "e": ((500, 1.0), (2000, 0.7), (2800, 0.3)),
             "o": ((550, 1.0), (900, 0.7), (2500, 0.15))}


def scream(dur, f0=900, vowel="a", glide=(1.0, 1.25, 0.9)):
    """Additive-synthesis scream: gliding pitch, vibrato, vowel formants, breath."""
    n = int(dur * SR)
    t = _t(dur)
    g = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(glide)), glide)
    f = f0 * g * (1 + 0.03 * np.sin(2 * np.pi * _rng.uniform(5, 7) * t)) \
        * (1 + 0.01 * _rng.standard_normal(n).cumsum() / np.sqrt(n))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros(n)
    for k in range(1, 14):
        fk = k * f
        amp = sum(a * np.exp(-((fk - fc) / 250) ** 2) for fc, a in _FORMANTS[vowel]) + 0.02
        out += amp * np.sin(k * ph) * (fk < SR / 2)
    out += 0.15 * band(noise(dur), 1500, 7000)
    e = env_ad(n, 0.06) * np.concatenate([np.ones(n - int(0.3 * n)), np.linspace(1, 0, int(0.3 * n))])
    return norm(out * e)


# ---------------------------------------------------------------- real recordings
SOUNDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sounds")


def load(name, tempo=1.0):
    """Load sounds/<name>.ogg as mono float32 at SR; tempo != 1 time-stretches (pitch kept)."""
    af = ["-af", f"rubberband=tempo={tempo}"] if tempo != 1.0 else []
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(SOUNDS, name + ".ogg"), *af,
                          "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def pitch(x, ratio):
    """Resample: ratio > 1 = higher and shorter (tape-style)."""
    n = int(len(x) / ratio)
    return np.interp(np.arange(n) * ratio, np.arange(len(x)), x).astype(np.float32)


def fade(x, fin=0.0, fout=0.0):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


# ---------------------------------------------------------------- mixing
class Track:
    def __init__(self, dur):
        self.x = np.zeros(int(dur * SR), np.float32)

    def add(self, t, sound, gain=1.0):
        i = int(t * SR)
        if i >= len(self.x):
            return
        s = np.asarray(sound, np.float32)[: len(self.x) - i]
        self.x[i:i + len(s)] += s * gain

    def write(self, path, peak=0.9):
        y = norm(self.x, peak)
        with wave.open(path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((y * 32767).astype(np.int16).tobytes())
        return path

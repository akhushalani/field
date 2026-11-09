"""Generate the short Mac smoke-test fixture without playing or recording audio."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
import wave
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_directory", type=Path)
    output = parser.parse_args().output_directory.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    transcript = Path(__file__).with_name("meetingboard-fixture.txt")
    speech = output / "synthetic-meeting.wav"
    with tempfile.TemporaryDirectory() as temporary:
        aiff = Path(temporary) / "speech.aiff"
        wav = Path(temporary) / "speech.wav"
        subprocess.run(
            [
                "/usr/bin/say",
                "-v",
                "Samantha",
                "-r",
                "165",
                "-f",
                str(transcript),
                "-o",
                str(aiff),
            ],
            check=True,
        )
        subprocess.run(
            [
                "/usr/bin/afconvert",
                "-f",
                "WAVE",
                "-d",
                "LEI16@16000",
                "-c",
                "1",
                str(aiff),
                str(wav),
            ],
            check=True,
        )
        speech.write_bytes(wav.read_bytes())
    with wave.open(str(output / "silence.wav"), "wb") as silence:
        silence.setnchannels(1)
        silence.setsampwidth(2)
        silence.setframerate(16000)
        silence.writeframes(b"\0\0" * 16000)
    with wave.open(str(speech)) as recording:
        metadata = {
            "synthetic": True,
            "voice": "macOS Samantha",
            "rate": 165,
            "duration_seconds": recording.getnframes() / recording.getframerate(),
            "sample_rate_hz": recording.getframerate(),
            "channels": recording.getnchannels(),
            "sha256": hashlib.sha256(speech.read_bytes()).hexdigest(),
            "purpose": "Short smoke test, not the 20-minute acceptance benchmark",
        }
    (output / "manifest.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata))


if __name__ == "__main__":
    main()

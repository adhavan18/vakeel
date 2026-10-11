#!/usr/bin/env bash
# Rebuild a cut with your recorded voice. Run from video/ after recording in the recorder.
#   bash rebuild_with_my_voice.sh main   # the calm film  (takes in public/vo_user)
#   bash rebuild_with_my_voice.sh hype   # the fast cut   (takes in public/vo_user_v3)
# Scene lengths follow your takes, so the music and visuals re-time automatically.
set -euo pipefail
cd "$(dirname "$0")"
stamp=$(date +%H%M%S)
case "${1:-main}" in
  main)
    python import_voice.py script_v2.json
    python score.py script_v2.json
    npx remotion render src/index.jsx LaunchV2 "out/frames_voice_$stamp" --sequence --image-format=jpeg --concurrency 8
    python encode.py final "out/frames_voice_$stamp" out/vakeel-launch-final-myvoice.mp4
    ;;
  hype)
    python import_voice.py script_v3.json
    python score_v3.py
    npx remotion render src/index.jsx Hype "out/frames_hype_voice_$stamp" --sequence --image-format=jpeg --jpeg-quality=92 --concurrency 8
    python encode.py hype "out/frames_hype_voice_$stamp" out/vakeel-launch-hype-myvoice.mp4
    ;;
  *) echo "usage: bash rebuild_with_my_voice.sh main|hype"; exit 1 ;;
esac

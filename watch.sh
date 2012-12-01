#! /bin/bash
# requires inotify-tools: sudo apt-get install inotify-tools

while :; do
  echo ""
  echo ""
  echo ""

  ./build.sh

  echo "Compile done."
  echo ""

  # testacular start --single-run

  kqwait ./src/*.ts ./src/util/*.ts ./src/events/*.ts
done

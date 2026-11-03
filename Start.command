#!/bin/zsh
# Double-click this file in Finder to open the local learning app.
cd -- "$(dirname -- "$0")" || exit 1
JS_LAB_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [[ ! -x "$JS_LAB_PYTHON" ]]; then
  JS_LAB_PYTHON="$(command -v python3)"
fi
if [[ -z "$JS_LAB_PYTHON" ]]; then
  print '未找到 Python 3。请安装 Python 3 后再打开。'
  read '?按 Enter 关闭。'
  exit 1
fi
"$JS_LAB_PYTHON" start_preview.py
if [[ $? -ne 0 ]]; then
  read '?启动未完成。按 Enter 关闭。'
fi

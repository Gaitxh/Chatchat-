#!/usr/bin/env bash
set -euo pipefail

# Every browser screenshot gate must have real Chinese/Japanese/Korean font
# coverage. Do not allow a successful exit on a missing or fallback font.
font_family() {
  fc-match -f '%{family}' 'Noto Sans CJK SC:lang=zh-cn'
}

has_noto_cjk() {
  command -v fc-match >/dev/null 2>&1 || return 1
  local family
  family="$(font_family)"
  [[ "$family" == *"Noto Sans CJK"* ]]
}

if has_noto_cjk; then
  echo "CJK screenshot font already available: $(font_family)"
  exit 0
fi

# Runner apt mirrors occasionally stall on the 61 MB Noto package. Bound
# individual network operations, retry transient fetch errors, and let the
# workflow's four-minute step limit fail explicitly if apt still cannot finish.
apt_options=(
  -o Acquire::Retries=2
  -o Acquire::http::Timeout=25
  -o Acquire::https::Timeout=25
  -o DPkg::Lock::Timeout=30
)
sudo apt-get "${apt_options[@]}" update
sudo env DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" install -y --no-install-recommends fonts-noto-cjk
fc-cache -f

if ! has_noto_cjk; then
  echo "ERROR: fonts-noto-cjk installed but Chromium's CJK font is unavailable." >&2
  exit 1
fi
echo "CJK screenshot font verified: $(font_family)"

#!/usr/bin/env bash
set -euo pipefail

# Every browser screenshot gate must have real Chinese/Japanese/Korean font
# coverage. Do not allow a successful exit on a missing or fallback font.
font_family() {
  fc-match -f '%{family}' 'WenQuanYi Micro Hei:lang=zh-cn'
}

has_chinese_font() {
  command -v fc-match >/dev/null 2>&1 || return 1
  local family
  family="$(font_family)"
  [[ "$family" == *"WenQuanYi Micro Hei"* ]]
}

if has_chinese_font; then
  echo "CJK screenshot font already available: $(font_family)"
  exit 0
fi

# Prefer Ubuntu's 1.6 MB WenQuanYi CJK font: downloading the 61 MB Noto
# package repeatedly stalled unrelated screenshot jobs on hosted runners.
# Keep network operations bounded and fail explicitly if apt cannot finish.
apt_options=(
  -o Acquire::Retries=2
  -o Acquire::http::Timeout=25
  -o Acquire::https::Timeout=25
  -o DPkg::Lock::Timeout=30
)
sudo apt-get "${apt_options[@]}" update
sudo env DEBIAN_FRONTEND=noninteractive apt-get "${apt_options[@]}" install -y --no-install-recommends fonts-wqy-microhei
fc-cache -f

if ! has_chinese_font; then
  echo "ERROR: fonts-wqy-microhei installed but Chromium's CJK font is unavailable." >&2
  exit 1
fi
echo "CJK screenshot font verified: $(font_family)"

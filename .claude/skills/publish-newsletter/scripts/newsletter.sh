#!/usr/bin/env bash
# Publish a monthly MVTA newsletter PDF: local copy, newsletter.htm link, FTP upload, git commit.
# Runs from the repo root. FTP host and user come from SETTINGS_FILE so they stay out of this public repo.
set -euo pipefail

SETTINGS_FILE="$HOME/.config/mvta-newsletter/settings.env"
SITE_URL="https://mvtrails.org"
NEWSLETTER_DIR="newsletter"
LINK_FILE="newsletter.htm"

usage() {
  cat <<'USAGE'
usage:
  newsletter.sh auto    <pdf> [--month YYYYMM] [--no-campaign] [--force]
                                            detect, publish when clear, then create the email campaign
  newsletter.sh detect  <pdf> [--offline]   print month facts as key=value lines
  newsletter.sh publish <pdf> <YYYYMM> [--force] [--no-commit]
  newsletter.sh set     KEY=value...        save FTP_HOST, FTP_USER, or TEST_EMAIL to the settings file
USAGE
  exit 2
}

die() { echo "status=error"; echo "error=$*"; exit 1; }

repo_root() { git rev-parse --show-toplevel 2>/dev/null || pwd; }

# --- settings and credentials ----------------------------------------------

setting() {
  [ -f "$SETTINGS_FILE" ] || return 0
  sed -n "s/^$1=//p" "$SETTINGS_FILE" | tail -1
}

FTP_HOST=""
FTP_USER=""
# Exit with status=needs_settings so the skill can ask the user and save the answers.
require_settings() {
  local key missing=""
  for key in "$@"; do
    [ -n "$(setting "$key")" ] || missing="${missing:+$missing,}$key"
  done
  if [ -n "$missing" ]; then
    echo "status=needs_settings"
    echo "missing=$missing"
    echo "settings_file=$SETTINGS_FILE"
    exit 4
  fi
  FTP_HOST="$(setting FTP_HOST)"
  FTP_USER="$(setting FTP_USER)"
}

FTP_PASSWORD=""
load_password() {
  if [ -n "${MVTA_FTP_PASSWORD:-}" ]; then
    FTP_PASSWORD="$MVTA_FTP_PASSWORD"; return 0
  fi
  # Match by account, not server, so the item still matches when FTP_HOST changes.
  # macOS may show a keychain dialog on first use. "Always Allow" stops future prompts.
  FTP_PASSWORD="$(security find-internet-password -a "$FTP_USER" -r "ftp " -w 2>/dev/null || true)"
  [ -n "$FTP_PASSWORD" ] && return 0
  if [ -f "$HOME/.netrc" ] && grep -q "$FTP_HOST" "$HOME/.netrc"; then
    FTP_PASSWORD="__netrc__"; return 0
  fi
  return 1
}

# --ssl-reqd with certificate checks: the password must never cross the network in plain text.
curl_ftp() {
  if [ "$FTP_PASSWORD" = "__netrc__" ]; then
    curl -sS --ssl-reqd --netrc "$@"
  else
    curl -sS --ssl-reqd -u "$FTP_USER:$FTP_PASSWORD" "$@"
  fi
}

# --- remote root -----------------------------------------------------------

FTP_ROOT=""
FTP_ERROR=""
find_remote_root() {
  if [ -n "${MVTA_FTP_ROOT:-}" ]; then FTP_ROOT="$MVTA_FTP_ROOT"; return 0; fi
  local candidate
  for candidate in "" "public_html" "www" "htdocs"; do
    if FTP_ERROR="$(curl_ftp --list-only "ftp://$FTP_HOST/${candidate:+$candidate/}$NEWSLETTER_DIR/" 2>&1 >/dev/null)"; then
      FTP_ROOT="$candidate"; return 0
    fi
  done
  FTP_ERROR="${FTP_ERROR%%$'\n'*}"
  return 1
}

remote_path() { echo "ftp://$FTP_HOST/${FTP_ROOT:+$FTP_ROOT/}$1"; }

remote_list() { curl_ftp --list-only "$(remote_path "$NEWSLETTER_DIR/")" | grep -oE '^[0-9]{6}\.pdf$' || true; }

# --- month helpers ---------------------------------------------------------

month_num() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    jan*) echo 01;; feb*) echo 02;; mar*) echo 03;; apr*) echo 04;;
    may) echo 05;; jun*) echo 06;; jul*) echo 07;; aug*) echo 08;;
    sep*) echo 09;; oct*) echo 10;; nov*) echo 11;; dec*) echo 12;;
    *) return 1;;
  esac
}

next_month() { date -j -v+1m -f "%Y%m%d" "${1}01" +%Y%m; }

MONTH_RE='(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)'
YEAR_RE='(19|20)[0-9]{2}'

# Print YYYYMM for the first "<month> <year>" or "<year> <month>" found in stdin, else fail.
month_from_text() {
  local input match mon yr
  input="$(cat)"
  match="$(echo "$input" | grep -oiE "(^|[^a-z])${MONTH_RE}[^a-z0-9]{0,3}${YEAR_RE}([^0-9]|$)" | head -1 || true)"
  if [ -z "$match" ]; then
    match="$(echo "$input" | grep -oiE "(^|[^0-9])${YEAR_RE}[^a-z0-9]{0,3}${MONTH_RE}([^a-z]|$)" | head -1 || true)"
  fi
  [ -z "$match" ] && return 1
  mon="$(echo "$match" | grep -oiE "$MONTH_RE" | head -1)"
  yr="$(echo "$match" | grep -oE "$YEAR_RE" | head -1)"
  echo "${yr}$(month_num "$mon")"
}

pdf_filename_month() { basename "$1" | month_from_text; }

pdf_first_page_text() {
  osascript -l JavaScript -e '
    ObjC.import("Quartz");
    var p = $.NSString.alloc.initWithUTF8String("'"$1"'").stringByStandardizingPath;
    var d = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(p));
    if (d.isNil()) { "" } else { d.pageAtIndex(0).string.js }' 2>/dev/null || true
}

pdf_text_month() { pdf_first_page_text "$1" | month_from_text; }

# --- detect ----------------------------------------------------------------

cmd_detect() {
  local pdf="${1:-}"; shift || true
  local offline=0
  [ "${1:-}" = "--offline" ] && offline=1
  [ -f "$pdf" ] || die "pdf not found: $pdf"
  cd "$(repo_root)"

  local latest_local latest_remote current_link latest next stated fname_month text_month created pages
  latest_local="$(ls "$NEWSLETTER_DIR" 2>/dev/null | grep -oE '^[0-9]{6}\.pdf$' | sort | tail -1 | cut -c1-6)"
  current_link="$(grep -oE "$NEWSLETTER_DIR/[0-9]{6}\.pdf" "$LINK_FILE" | head -1 | grep -oE '[0-9]{6}')"

  [ "$offline" = 1 ] || require_settings FTP_HOST FTP_USER

  latest_remote="unknown"
  if [ "$offline" = 0 ] && load_password && find_remote_root; then
    latest_remote="$(remote_list | sort | tail -1 | cut -c1-6)"
    [ -z "$latest_remote" ] && latest_remote="none"
  fi

  latest="$(printf '%s\n' "$latest_local" "$current_link" "$latest_remote" | grep -E '^[0-9]{6}$' | sort | tail -1)"
  next="$(next_month "$latest")"
  # Filename first: it is cheap and the user names files by month.
  fname_month="$(pdf_filename_month "$pdf" || echo unknown)"
  text_month="unknown"
  if [ "$fname_month" = "unknown" ]; then
    text_month="$(pdf_text_month "$pdf" || echo unknown)"
    stated="$text_month"
  else
    stated="$fname_month"
  fi
  created="$(mdls -raw -name kMDItemContentCreationDate "$pdf" 2>/dev/null | cut -c1-10)"
  pages="$(mdls -raw -name kMDItemNumberOfPages "$pdf" 2>/dev/null || echo unknown)"

  echo "pdf=$pdf"
  echo "pdf_pages=$pages"
  echo "pdf_created=$created"
  echo "pdf_filename_month=$fname_month"
  echo "pdf_text_month=$text_month"
  echo "pdf_stated_month=$stated"
  echo "latest_local=${latest_local:-none}"
  echo "latest_remote=$latest_remote"
  echo "current_link=${current_link:-none}"
  echo "latest=$latest"
  echo "next=$next"
  echo "ftp_root=/${FTP_ROOT}"
  if [ "$stated" = "$next" ]; then echo "verdict=clear"; else echo "verdict=unclear"; fi
}

# --- publish ---------------------------------------------------------------

cmd_publish() {
  local pdf="${1:-}" month="${2:-}"; shift 2 || usage
  local force=0 commit=1
  for arg in "$@"; do
    case "$arg" in
      --force) force=1;;
      --no-commit) commit=0;;
      *) usage;;
    esac
  done
  [ -f "$pdf" ] || die "pdf not found: $pdf"
  echo "$month" | grep -qE '^(19|20)[0-9]{2}(0[1-9]|1[0-2])$' || die "month must be YYYYMM, got: $month"
  cd "$(repo_root)"
  [ -f "$LINK_FILE" ] || die "$LINK_FILE not found in $(pwd)"

  local target="$NEWSLETTER_DIR/$month.pdf"
  local url="$SITE_URL/$NEWSLETTER_DIR/$month.pdf"

  require_settings FTP_HOST FTP_USER
  load_password || die "no FTP password. Set MVTA_FTP_PASSWORD, add an FTP keychain item for $FTP_USER, or add a ~/.netrc entry for $FTP_HOST."
  find_remote_root || die "cannot list $NEWSLETTER_DIR/ on $FTP_HOST: ${FTP_ERROR:-unknown error}. If the certificate does not match, set FTP_HOST to the name the certificate covers. If the web root is not /, public_html, www, or htdocs, set MVTA_FTP_ROOT."

  if [ "$force" = 0 ]; then
    [ -e "$target" ] && [ "$(realpath "$pdf")" != "$(realpath "$target")" ] && die "$target already exists locally. Re-run with --force to overwrite."
    remote_list | grep -qx "$month.pdf" && die "$month.pdf already exists on $FTP_HOST. Re-run with --force to overwrite."
  fi

  # 1. local copy
  mkdir -p "$NEWSLETTER_DIR"
  if [ "$(realpath "$pdf")" != "$(realpath -q "$target" 2>/dev/null || echo)" ]; then
    cp "$pdf" "$target"
  fi
  echo "copied: $target"

  # 2. link update
  grep -qE "$NEWSLETTER_DIR/[0-9]{6}\.pdf" "$LINK_FILE" || die "no $NEWSLETTER_DIR/YYYYMM.pdf link found in $LINK_FILE"
  sed -i '' -E "s#$NEWSLETTER_DIR/[0-9]{6}\.pdf#$NEWSLETTER_DIR/$month.pdf#" "$LINK_FILE"
  echo "linked: $LINK_FILE -> $url"

  # 3. upload
  curl_ftp -T "$target" "$(remote_path "$target")"
  curl_ftp -T "$LINK_FILE" "$(remote_path "$LINK_FILE")"
  echo "uploaded: $target, $LINK_FILE (root: /${FTP_ROOT})"

  # 4. verify over https
  local local_size remote_size status
  local_size="$(stat -f %z "$target")"
  remote_size="$(curl -sSI "$url" | grep -i '^content-length:' | tr -dc '0-9' || true)"
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  echo "verify: $url status=$status size_local=$local_size size_remote=${remote_size:-?}"
  [ "$status" = "200" ] || die "public URL did not return 200"
  [ -n "$remote_size" ] && [ "$remote_size" != "$local_size" ] && die "public size differs from local size"

  # 5. commit
  if [ "$commit" = 1 ]; then
    git add "$target" "$LINK_FILE"
    git commit -q -m "feat: publish ${month:0:4}-${month:4:2} newsletter"
    echo "committed: $(git rev-parse --short HEAD)"
  fi
  echo "done: $url"
}

# --- auto ------------------------------------------------------------------

CAMPAIGN_PY="$(cd "$(dirname "$0")/../../newsletter-campaign/scripts" 2>/dev/null && pwd)/cc_campaign.py"

cmd_auto() {
  local pdf="${1:-}"; shift || usage
  local month="" campaign=1 force=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --month) month="${2:-}"; shift;;
      --no-campaign) campaign=0;;
      --force) force="--force";;
      *) usage;;
    esac
    shift
  done
  [ -f "$pdf" ] || die "pdf not found: $pdf"
  # Ask for every missing setting before any work starts.
  if [ "$campaign" = 1 ]; then
    require_settings FTP_HOST FTP_USER TEST_EMAIL
  else
    require_settings FTP_HOST FTP_USER
  fi

  local facts
  facts="$(cmd_detect "$pdf")"
  echo "$facts"
  local stated latest
  stated="$(echo "$facts" | sed -n 's/^pdf_stated_month=//p')"
  latest="$(echo "$facts" | sed -n 's/^latest=//p')"
  if [ -z "$month" ] && [ "$stated" = "$latest" ]; then
    # Same PDF again: skip the upload, still make sure the campaign exists.
    echo "status=already_published"
    month="$stated"
  elif [ -z "$month" ]; then
    if echo "$facts" | grep -qx 'verdict=clear'; then
      month="$(echo "$facts" | sed -n 's/^next=//p')"
    else
      echo "status=needs_month"
      echo "next=Ask the user which YYYYMM to use, then re-run: newsletter.sh auto <pdf> --month YYYYMM"
      return 2
    fi
  fi

  if [ "$stated" != "$latest" ] || [ -n "$force" ]; then
    echo "=== publish $month ==="
    cmd_publish "$pdf" "$month" $force
    echo "status=published"
  fi

  if [ "$campaign" = 1 ]; then
    echo "=== campaign $month ==="
    [ -f "$CAMPAIGN_PY" ] || die "campaign script not found: $CAMPAIGN_PY"
    /usr/bin/python3 "$CAMPAIGN_PY" run "$month"
  fi
}

case "${1:-}" in
  auto) shift; cmd_auto "$@";;
  detect) shift; cmd_detect "$@";;
  publish) shift; cmd_publish "$@";;
  set) shift; exec /usr/bin/python3 "$CAMPAIGN_PY" set "$@";;
  *) usage;;
esac

---
name: publish-newsletter
description: Publish a monthly MVTA newsletter PDF. Copies it to newsletter/YYYYMM.pdf, points newsletter.htm at it, uploads both over FTP, commits, then creates the Constant Contact campaign with a test send. Use when the user gives a newsletter PDF path or says "publish the newsletter".
argument-hint: <path-to-newsletter.pdf>
---

Publish the newsletter PDF at `$ARGUMENTS`. One script does all the work. Do not read the PDF,
inspect the site, or call the Constant Contact API yourself.

## Step 1. Run

If `$ARGUMENTS` is empty, ask the user for the PDF path and stop.

Run from the repo root with a 600 second timeout:

```
.claude/skills/publish-newsletter/scripts/newsletter.sh auto "<pdf>"
```

## Step 2. Act on the last `status=` line

| status | What to do |
|---|---|
| `ok` | Done. Report as in Step 3. |
| `already_published` | The PDF was published before. The script skips the upload and only checks the campaign. Report the final status. |
| `exists` | The campaign already exists. Report its name and `send_from`. Do not re-run with `--force` unless the user asks. |
| `needs_month` | The PDF month and the next expected month disagree. Ask the user with AskUserQuestion. Offer `next` first, then `pdf_stated_month` if not `unknown`. Show `pdf_created` and `latest`. Re-run with `--month YYYYMM`. |
| `needs_settings` | Ask the user for every key in `missing` in one message. Describe each key as in Settings. End your turn. When they reply, save all answers in one command: `.claude/skills/publish-newsletter/scripts/newsletter.sh set KEY=value KEY=value`. Then re-run the same command. |
| `needs_login` | Show the user the `url` and `code` lines and end your turn. When they reply that they approved, re-run the same command. It resumes. |
| `error` | Quote the `error=` line to the user and stop. If it says a file already exists locally or on the server, ask before re-running with `--force`. If it says the certificate does not match, ask the user for the correct `FTP_HOST`, save it with `set`, and re-run. |

Other notes:

- A macOS keychain dialog can appear on the first run for the FTP password. Tell the user to
  click "Always Allow". If the run times out, run it again.
- `--no-campaign` skips the Constant Contact step when the user asks to publish only.
- Nothing is pushed to git and nothing is sent to the mailing list.

## Step 3. Report

Give the user, from the output: the `verify:` line, the `committed:` hash, `campaign`,
`test_sent_to`, and `send_from`. Tell them to check the test email and then send the campaign
from the `send_from` page.

## Settings

Personal values live in `~/.config/mvta-newsletter/settings.env`, not in this public repo. The
script reports `needs_settings` when a key is missing. Do not write the file by hand. Use `set`.

| Key | Ask the user for |
|---|---|
| `FTP_HOST` | The FTP server name that its TLS certificate covers. On Bluehost this is the `boxNNNN.bluehost.com` server name, not `ftp.<domain>`. |
| `FTP_USER` | The FTP account user name. |
| `TEST_EMAIL` | The address that receives the campaign test email. |

- FTP password: `MVTA_FTP_PASSWORD` env var, else a login keychain FTP item for `FTP_USER`,
  else a `~/.netrc` entry for `FTP_HOST`. Never store the password in `settings.env`.
- Uploads require TLS with a valid certificate. There is no plain FTP fallback.
- `MVTA_FTP_ROOT` overrides the remote web root when auto-detection fails.
- Campaign settings: see the `newsletter-campaign` skill.

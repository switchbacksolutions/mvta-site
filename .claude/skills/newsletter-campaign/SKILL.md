---
name: newsletter-campaign
description: Constant Contact campaign for a published MVTA newsletter PDF. Default creates the campaign, assigns the "Newsletter" list, and sends a test to the TEST_EMAIL address. With "send" it sends the reviewed campaign to the list. Use when the user says "create the newsletter campaign", "send the newsletter email", or "send the newsletter".
argument-hint: [send] [YYYYMM]
---

Arguments: `$ARGUMENTS`. One script does all the work, including login. Do not call the API
yourself, inspect the account, or edit `config.json` unless the user asks.

The month is optional and defaults to the current link in `newsletter.htm`. Run from the repo
root with a 300 second timeout.

## Step 1. Pick the mode

- Arguments contain `send`, or the user asked in this conversation to send the newsletter to the
  list: **send mode**. Run:

  ```
  /usr/bin/python3 .claude/skills/newsletter-campaign/scripts/cc_campaign.py send <YYYYMM>
  ```

- Otherwise: **create mode**. Run:

  ```
  /usr/bin/python3 .claude/skills/newsletter-campaign/scripts/cc_campaign.py run <YYYYMM>
  ```

Never add `--yes` in Step 1.

## Step 2. Act on the `status=` line

| status | What to do |
|---|---|
| `ok` | Done. Report `campaign`, `subject`, `list`, `test_sent_to`, and `send_from`. Tell the user to check the test email, then send from the `send_from` page. |
| `exists` | A live campaign for that month already exists. Report `campaign` and `send_from`. Re-run with `--force` only if the user asks for another one. |
| `confirm` | Send mode preflight passed. Ask the user with AskUserQuestion, showing `campaign`, `subject`, `from`, `recipients`, and `pdf`. Options: "Send now" and "Cancel". On "Send now", re-run the same send command with `--yes`. On anything else, stop. |
| `sent` | The campaign was scheduled to send now. Report `campaign`, `recipients`, and `campaign_status`. Note that Constant Contact sends in the background. |
| `needs_settings` | Ask the user for the address that receives the test email. End your turn. When they reply, run `/usr/bin/python3 .claude/skills/newsletter-campaign/scripts/cc_campaign.py set TEST_EMAIL=<address>`. Then re-run the same command. |
| `needs_login` | Show the user the `url` and `code` lines and end your turn. When they reply that they approved, re-run the same command. It resumes. |
| `error` | Quote the `error=` line and stop. |

Create mode never sends to the list. Send mode sends only after the user picks "Send now" and
only with `--yes`. Sending cannot be undone.

## Configuration

- `config.json`: `client_id` of the Constant Contact app (device flow, no secret), list name,
  sender fields, templates. Placeholders are `{month}` (`September 2026`),
  `{month_name}` (`September`), `{url}`, and `{org}`.
- `TEST_EMAIL`: in `~/.config/mvta-newsletter/settings.env`, not in this public repo. Only `run`
  needs it. Save it with the `set` command, not by hand.
- Tokens: `~/.config/mvta-newsletter/constantcontact.json`, written by the script.
- Manual helpers: `render <YYYYMM>` prints the email without touching the API. `info` lists
  sender emails and contact lists. `login` only logs in.
- `send` refuses when the campaign is not a Draft, has no list, has a list other than
  `list_name`, or lacks the PDF link.

#!/usr/bin/python3
"""Create a Constant Contact email campaign that links to a published MVTA newsletter PDF.
Stdlib only. `run` does everything and reports a status= line so the caller needs no judgment."""
import argparse
import calendar
import json
import os
import re
import stat
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

AUTHZ = "https://authz.constantcontact.com/oauth2/default/v1"
API = "https://api.cc.email/v3"
SCOPES = "campaign_data contact_data account_read offline_access"
CRED_PATH = os.path.expanduser("~/.config/mvta-newsletter/constantcontact.json")
SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(SKILL_DIR, "config.json")
REPO_ROOT = os.path.abspath(os.path.join(SKILL_DIR, "..", "..", ".."))
SITE = "https://mvtrails.org"
SEND_URL = "https://app.constantcontact.com/pages/campaigns/email#emails"
# The auth host's WAF rejects the default Python user agent with a 403 HTML page.
USER_AGENT = "mvta-newsletter/1.0"


class Fail(Exception):
    pass


def die(msg):
    print("status=error")
    print("error=" + msg)
    sys.exit(1)


# --- config and credentials -------------------------------------------------

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def load_creds():
    if not os.path.exists(CRED_PATH):
        return {}
    with open(CRED_PATH) as f:
        return json.load(f)


def save_creds(creds):
    os.makedirs(os.path.dirname(CRED_PATH), exist_ok=True)
    with open(CRED_PATH, "w") as f:
        json.dump(creds, f, indent=2)
    os.chmod(CRED_PATH, stat.S_IRUSR | stat.S_IWUSR)


def form_post(url, fields):
    data = urllib.parse.urlencode(fields, quote_via=urllib.parse.quote).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(body)
        except ValueError:
            return e.code, {"error": body[:200]}


def store_tokens(creds, tok):
    creds["access_token"] = tok["access_token"]
    if tok.get("refresh_token"):
        creds["refresh_token"] = tok["refresh_token"]
    creds["expires_at"] = int(time.time()) + int(tok.get("expires_in", 3600))
    creds.pop("pending_device", None)
    save_creds(creds)


def client_id_for(creds, cfg):
    cid = creds.get("client_id") or cfg.get("client_id")
    if not cid:
        raise Fail("no client_id. Put the Constant Contact app client_id in config.json as \"client_id\".")
    creds["client_id"] = cid
    return cid


def start_device_login(creds, cfg):
    """Request a device code and stash it. Returns the pending record."""
    cid = client_id_for(creds, cfg)
    status, dev = form_post(AUTHZ + "/device/authorize", {"client_id": cid, "scope": SCOPES})
    if status != 200:
        raise Fail("device authorize failed (%s): %s" % (status, dev))
    creds["pending_device"] = {
        "device_code": dev["device_code"],
        "user_code": dev["user_code"],
        "url": dev.get("verification_uri_complete", dev["verification_uri"]),
        "interval": int(dev.get("interval", 5)),
        "expires_at": int(time.time()) + int(dev.get("expires_in", 600)),
    }
    save_creds(creds)
    return creds["pending_device"]


def poll_device_login(creds, max_wait):
    """Poll for approval for up to max_wait seconds. True on success, False if still pending."""
    pending = creds["pending_device"]
    interval = pending["interval"]
    deadline = min(time.time() + max_wait, pending["expires_at"])
    while True:
        status, tok = form_post(AUTHZ + "/token", {
            "client_id": creds["client_id"],
            "device_code": pending["device_code"],
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        })
        if status == 200 and tok.get("access_token"):
            store_tokens(creds, tok)
            return True
        err = tok.get("error", "")
        if err == "slow_down":
            interval += 5
        elif err not in ("authorization_pending", ""):
            raise Fail("device flow failed: %s" % tok)
        if time.time() + interval > deadline:
            return False
        time.sleep(interval)


def refresh_access_token(creds):
    """True when a usable access token is in creds afterwards."""
    if not creds.get("refresh_token"):
        return False
    if time.time() < creds.get("expires_at", 0) - 120:
        return True
    status, tok = form_post(AUTHZ + "/token", {
        "client_id": creds["client_id"],
        "refresh_token": creds["refresh_token"],
        "grant_type": "refresh_token",
    })
    if status != 200 or not tok.get("access_token"):
        return False
    store_tokens(creds, tok)
    return True


def ensure_login(cfg, wait):
    """Log in without human judgment. Returns True when ready.
    Otherwise prints status=needs_login with the URL to approve and returns False."""
    creds = load_creds()
    client_id_for(creds, cfg)
    pending = creds.get("pending_device")
    if pending and time.time() < pending["expires_at"] - 30:
        if poll_device_login(creds, wait):
            return True
    elif refresh_access_token(creds):
        return True
    else:
        pending = start_device_login(creds, cfg)
        if wait and poll_device_login(creds, wait):
            return True
    pending = load_creds()["pending_device"]
    print("status=needs_login")
    print("url=" + pending["url"])
    print("code=" + pending["user_code"])
    print("expires_in=%d" % (pending["expires_at"] - time.time()))
    return False


def access_token():
    creds = load_creds()
    if not refresh_access_token(creds):
        raise Fail("not logged in. Run: cc_campaign.py run")
    return creds["access_token"]


# --- API -----------------------------------------------------------------

def api(method, path, body=None, allow=()):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Authorization", "Bearer " + access_token())
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        if e.code in allow:
            return e.code, raw
        raise Fail("%s %s -> %s: %s" % (method, path, e.code, raw[:300]))


def contact_lists():
    _, res = api("GET", "/contact_lists?limit=1000&include_count=true")
    return res.get("lists", [])


def account_emails():
    _, res = api("GET", "/account/emails")
    return res if isinstance(res, list) else res.get("emails", [])


def campaigns_named(base_name):
    """Live campaigns whose name is base_name or base_name followed by ' (n)'."""
    _, res = api("GET", "/emails?limit=50")
    pat = re.compile(r"^%s( \(\d+\))?$" % re.escape(base_name))
    return [c for c in res.get("campaigns", []) if pat.match(c.get("name", ""))]


def primary_activity_id(campaign_id):
    _, full = api("GET", "/emails/" + campaign_id)
    return next(a["campaign_activity_id"] for a in full["campaign_activities"] if a["role"] == "primary_email")


def url_is_live(url):
    req = urllib.request.Request(url, method="HEAD")
    req.add_header("User-Agent", USER_AGENT)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except urllib.error.HTTPError:
        return False


# --- content ---------------------------------------------------------------

def month_label(yyyymm):
    if not re.fullmatch(r"(19|20)\d{2}(0[1-9]|1[0-2])", yyyymm or ""):
        raise Fail("month must be YYYYMM, got: %r" % yyyymm)
    return "%s %s" % (calendar.month_name[int(yyyymm[4:])], yyyymm[:4])


def month_from_site():
    path = os.path.join(REPO_ROOT, "newsletter.htm")
    if not os.path.exists(path):
        raise Fail("no newsletter.htm in %s. Pass the month as YYYYMM." % REPO_ROOT)
    with open(path) as f:
        m = re.search(r"newsletter/(\d{6})\.pdf", f.read())
    if not m:
        raise Fail("no newsletter/YYYYMM.pdf link in newsletter.htm")
    return m.group(1)


def fill(template, values):
    out = template
    for k, v in values.items():
        out = out.replace("{" + k + "}", v)
    return out


def build(cfg, yyyymm):
    label = month_label(yyyymm)
    values = {
        "month": label,
        "month_name": label.split()[0],
        "url": "%s/newsletter/%s.pdf" % (SITE, yyyymm),
        "org": cfg.get("org_name", cfg.get("from_name", "")),
    }
    html = fill(cfg["html_template"], values)
    for bad in ("[#", "${", "<@"):
        if bad in html:
            raise Fail("html contains forbidden sequence %r" % bad)
    if "[[trackingImage]]" not in html:
        raise Fail("html_template must contain [[trackingImage]]")
    return {
        "values": values,
        "html": html,
        "name": fill(cfg["campaign_name_template"], values),
        "subject": fill(cfg["subject_template"], values),
        "preheader": fill(cfg.get("preheader_template", ""), values),
    }


# --- campaign --------------------------------------------------------------

def create_campaign(cfg, yyyymm, force=False, skip_url_check=False):
    """Create, assign the list, send the test, verify. Returns a report dict."""
    b = build(cfg, yyyymm)
    if not skip_url_check and not url_is_live(b["values"]["url"]):
        raise Fail("newsletter URL is not live: %s. Publish the PDF first." % b["values"]["url"])

    existing = campaigns_named(b["name"])
    if existing and not force:
        c = existing[0]
        return {"status": "exists", "campaign": c["name"], "campaign_id": c["campaign_id"],
                "campaign_status": c.get("current_status"), "send_from": SEND_URL}

    lists = [l for l in contact_lists() if l.get("name") == cfg["list_name"]]
    if len(lists) != 1:
        raise Fail("expected exactly one contact list named %r, found %d" % (cfg["list_name"], len(lists)))
    list_id = lists[0]["list_id"]

    confirmed = {e.get("email_address") for e in account_emails() if e.get("confirm_status") == "CONFIRMED"}
    for key in ("from_email", "reply_to_email"):
        if cfg.get(key) and cfg[key] not in confirmed:
            raise Fail("%s %r is not a confirmed sender. Confirmed: %s" % (key, cfg[key], ", ".join(sorted(confirmed))))

    activity = {
        "format_type": 5,
        "from_name": cfg["from_name"],
        "from_email": cfg["from_email"],
        "reply_to_email": cfg.get("reply_to_email") or cfg["from_email"],
        "subject": b["subject"],
        "html_content": b["html"],
    }
    if b["preheader"]:
        activity["preheader"] = b["preheader"]
    if cfg.get("physical_address_in_footer"):
        activity["physical_address_in_footer"] = cfg["physical_address_in_footer"]

    # Trashed campaigns still reserve their names, so retry with a numeric suffix on 409.
    name = b["name"]
    for n in range(1, 10):
        name = b["name"] if n == 1 else "%s (%d)" % (b["name"], n)
        status, created = api("POST", "/emails", {"name": name, "email_campaign_activities": [activity]}, allow=(409,))
        if status != 409:
            break
        if "notunique" not in str(created):
            raise Fail("POST /emails -> 409: %s" % created)
    else:
        raise Fail("could not find a free campaign name for %r" % b["name"])
    campaign_id = created["campaign_id"]
    activity_id = next(a["campaign_activity_id"] for a in created["campaign_activities"] if a["role"] == "primary_email")

    # PUT overwrites omitted fields, so send back every input field from the GET plus the list.
    _, current = api("GET", "/emails/activities/" + activity_id)
    update = {k: current[k] for k in (
        "from_name", "from_email", "reply_to_email", "subject", "preheader",
        "html_content", "physical_address_in_footer", "document_properties") if k in current}
    update["contact_list_ids"] = [list_id]
    api("PUT", "/emails/activities/" + activity_id, update)

    api("POST", "/emails/activities/%s/tests" % activity_id, {
        "email_addresses": [cfg["test_email"]],
        "personal_message": "Test send of %s. Review, then send from Constant Contact." % name,
    })

    _, final = api("GET", "/emails/activities/%s?include=html_content" % activity_id)
    problems = []
    if final.get("contact_list_ids") != [list_id]:
        problems.append("list not assigned")
    if b["values"]["url"] not in (final.get("html_content") or ""):
        problems.append("pdf link missing from html")
    if final.get("current_status") != "DRAFT":
        problems.append("status is %s" % final.get("current_status"))
    if problems:
        raise Fail("campaign %s created but verification failed: %s" % (campaign_id, "; ".join(problems)))

    return {"status": "ok", "campaign": name, "campaign_id": campaign_id,
            "campaign_activity_id": activity_id, "subject": b["subject"],
            "from": "%s <%s>" % (cfg["from_name"], cfg["from_email"]),
            "list": "%s (%s members)" % (cfg["list_name"], lists[0].get("membership_count", "?")),
            "pdf": b["values"]["url"], "test_sent_to": cfg["test_email"], "send_from": SEND_URL}


def find_month_campaign(cfg, yyyymm):
    """The single live campaign for this month's base name, or Fail."""
    b = build(cfg, yyyymm)
    found = campaigns_named(b["name"])
    if not found:
        raise Fail("no live campaign named %r. Run: cc_campaign.py run %s" % (b["name"], yyyymm))
    if len(found) > 1:
        raise Fail("more than one live campaign for %r: %s. Delete the extras in Constant Contact."
                   % (b["name"], ", ".join(c["name"] for c in found)))
    return found[0], b


def send_campaign(cfg, yyyymm, yes=False):
    """Preflight the month's campaign. With yes, schedule it to send now."""
    c, b = find_month_campaign(cfg, yyyymm)
    activity_id = primary_activity_id(c["campaign_id"])
    _, a = api("GET", "/emails/activities/%s?include=html_content" % activity_id)
    lists = {l["list_id"]: l for l in contact_lists()}
    assigned = [lists.get(i, {"name": i, "membership_count": "?"}) for i in a.get("contact_list_ids", [])]
    problems = []
    if a.get("current_status") != "DRAFT":
        problems.append("status is %s, not DRAFT" % a.get("current_status"))
    if not assigned:
        problems.append("no contact list assigned")
    if [l.get("name") for l in assigned] != [cfg["list_name"]]:
        problems.append("assigned lists are %s, expected only %r" % ([l.get("name") for l in assigned], cfg["list_name"]))
    if b["values"]["url"] not in (a.get("html_content") or ""):
        problems.append("pdf link missing from html")
    if problems:
        raise Fail("campaign %r is not ready: %s" % (c["name"], "; ".join(problems)))

    rep = {"status": "confirm", "campaign": c["name"], "campaign_id": c["campaign_id"],
           "subject": a.get("subject"), "from": "%s <%s>" % (a.get("from_name"), a.get("from_email")),
           "recipients": "%s (%s contacts)" % (assigned[0].get("name"), assigned[0].get("membership_count", "?")),
           "pdf": b["values"]["url"]}
    if not yes:
        rep["next"] = "Confirm with the user, then re-run with --yes to send now."
        return rep

    _, sched = api("POST", "/emails/activities/%s/schedules" % activity_id, {"scheduled_date": "0"})
    rep["scheduled_date"] = (sched[0] if isinstance(sched, list) and sched else sched or {}).get("scheduled_date", "now")
    # Sending is asynchronous. Report the status it reaches within a short wait.
    final = a.get("current_status")
    for _ in range(12):
        time.sleep(5)
        _, a2 = api("GET", "/emails/activities/" + activity_id)
        final = a2.get("current_status")
        if final in ("EXECUTING", "DONE", "ERROR"):
            break
    if final == "ERROR":
        raise Fail("campaign %r reached status ERROR after scheduling" % c["name"])
    rep["status"] = "sent"
    rep["campaign_status"] = final
    return rep


def print_report(rep):
    for k, v in rep.items():
        print("%s=%s" % (k, v))


# --- commands --------------------------------------------------------------

def cmd_run(args):
    cfg = load_config()
    yyyymm = args.month or month_from_site()
    print("month=" + yyyymm)
    if not ensure_login(cfg, wait=args.wait):
        return 2
    print_report(create_campaign(cfg, yyyymm, force=args.force, skip_url_check=args.skip_url_check))
    return 0


def cmd_send(args):
    cfg = load_config()
    yyyymm = args.month or month_from_site()
    print("month=" + yyyymm)
    if not ensure_login(cfg, wait=args.wait):
        return 2
    rep = send_campaign(cfg, yyyymm, yes=args.yes)
    print_report(rep)
    return 0 if rep["status"] == "sent" else 3


def cmd_login(args):
    cfg = load_config()
    creds = load_creds()
    if args.client_id:
        creds["client_id"] = args.client_id
        save_creds(creds)
    if ensure_login(cfg, wait=args.wait):
        print("status=ok")
        print("tokens=" + CRED_PATH)
        return 0
    return 2


def cmd_info(_args):
    access_token()
    print("account emails:")
    for e in account_emails():
        print("  %s  (%s)" % (e.get("email_address"), e.get("confirm_status")))
    print("contact lists:")
    for l in contact_lists():
        print("  %s  id=%s  members=%s" % (l.get("name"), l.get("list_id"), l.get("membership_count", "?")))
    return 0


def cmd_render(args):
    b = build(load_config(), args.month)
    print("name: " + b["name"])
    print("subject: " + b["subject"])
    print("preheader: " + b["preheader"])
    print(b["html"])
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("run", help="log in if needed, create campaign, assign list, send test, verify")
    s.add_argument("month", nargs="?", help="YYYYMM; default: current link in newsletter.htm")
    s.add_argument("--force", action="store_true", help="create even if a same-named live campaign exists")
    s.add_argument("--skip-url-check", action="store_true")
    s.add_argument("--wait", type=int, default=20, help="seconds to wait for a pending login approval")
    s.set_defaults(fn=cmd_run)
    s = sub.add_parser("send", help="send the month's campaign to its list now (preflight only without --yes)")
    s.add_argument("month", nargs="?", help="YYYYMM; default: current link in newsletter.htm")
    s.add_argument("--yes", action="store_true", help="actually schedule the send")
    s.add_argument("--wait", type=int, default=20)
    s.set_defaults(fn=cmd_send)
    s = sub.add_parser("login", help="device-flow login only")
    s.add_argument("--client-id")
    s.add_argument("--wait", type=int, default=20)
    s.set_defaults(fn=cmd_login)
    s = sub.add_parser("info", help="list account emails and contact lists")
    s.set_defaults(fn=cmd_info)
    s = sub.add_parser("render", help="print name, subject, preheader and HTML for a month")
    s.add_argument("month")
    s.set_defaults(fn=cmd_render)
    args = p.parse_args()
    try:
        sys.exit(args.fn(args))
    except Fail as e:
        die(str(e))


if __name__ == "__main__":
    main()

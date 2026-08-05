"""HIPAA-aware transactional email via AWS SES (BAA-covered).

Resend is intentionally not supported — it has no BAA. SMTP remains as a fallback
for non-SES providers when SMTP_HOST is set explicitly.
"""
from __future__ import annotations

import html as html_module
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional


def _default_sender() -> str:
    return (
        os.environ.get("EMAIL_FROM", "").strip()
        or os.environ.get("SMTP_FROM", "").strip()
        or "consult@cccdsmiles.com"
    )


def _default_reply_to(sender: str) -> str:
    return (os.environ.get("REPLY_TO_EMAIL") or "").strip() or sender


def _plain_from_html(html_body: str) -> str:
    """Minimal HTML → text fallback for deliverability."""
    text = html_module.unescape(html_body)
    for tag in ("<br>", "<br/>", "<br />"):
        text = text.replace(tag, "\n")
    # Drop remaining tags crudely — good enough for transactional mail.
    out = []
    in_tag = False
    for ch in text:
        if ch == "<":
            in_tag = True
            continue
        if ch == ">":
            in_tag = False
            continue
        if not in_tag:
            out.append(ch)
    return " ".join("".join(out).split())


def send_email(to_email: str, subject: str, html_body: str) -> tuple[bool, str]:
    """Send transactional email. Prefers AWS SES API, then generic SMTP.

    Returns (ok, detail). detail is empty on success.
    """
    sender = _default_sender()
    reply_to = _default_reply_to(sender)
    region = os.environ.get("AWS_DEFAULT_REGION", os.environ.get("SES_REGION", "us-east-2"))

    # --- AWS SES (preferred — covered by AWS BAA) ---
    if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        try:
            import boto3

            client = boto3.client("ses", region_name=region)
            plain = _plain_from_html(html_body)
            client.send_email(
                Source=sender,
                Destination={"ToAddresses": [to_email]},
                ReplyToAddresses=[reply_to],
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": plain, "Charset": "UTF-8"},
                    },
                },
            )
            return True, ""
        except Exception as e:
            detail = f"SES error: {e}"
            print(detail)
            return False, detail

    # --- Generic SMTP fallback (e.g. Google Workspace with BAA) ---
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    if smtp_host:
        try:
            plain = _plain_from_html(html_body)
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = sender
            msg["Reply-To"] = reply_to
            msg["To"] = to_email
            msg.attach(MIMEText(plain, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))
            port = int(os.environ.get("SMTP_PORT", "587"))
            password = os.environ.get("SMTP_PASSWORD") or os.environ.get("SMTP_PASS", "")
            user = os.environ.get("SMTP_USER", "")
            with smtplib.SMTP(smtp_host, port, timeout=20) as server:
                server.starttls()
                if user:
                    server.login(user, password)
                server.sendmail(sender, [to_email], msg.as_string())
            return True, ""
        except Exception as e:
            detail = f"SMTP error: {e}"
            print(detail)
            return False, detail

    detail = "Email not configured (set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for SES, or SMTP_HOST)"
    print(f"{detail} — skipping send")
    return False, detail


def zero_phi_video_ready_html(link: str, practice: str) -> str:
    """Patient video-ready notification — no name, no clinical detail (HIPAA-minimal)."""
    safe_practice = html_module.escape(practice)
    safe_link = html_module.escape(link)
    reply_addr = html_module.escape(
        (os.environ.get("REPLY_TO_EMAIL") or "info@destinationsmile.com").strip()
    )
    office_phone = html_module.escape((os.environ.get("OFFICE_PHONE") or "704.364.4711").strip())
    return (
        "<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222'>"
        f"<p>Your personalized video reply from {safe_practice} is ready to view.</p>"
        f"<p style='margin:26px 0'><a href='{safe_link}' style='background:#c4a052;color:#fff;"
        "padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:600'>Watch your consultation</a></p>"
        f"<p style='color:#666;font-size:13px'>Or paste this link into your browser:<br>{safe_link}</p>"
        "<p style='color:#666;font-size:13px'>This personalized link is just for you.</p>"
        f"<p style='color:#666;font-size:13px'>Questions? Reply to this email or reach us at "
        f"<a href='mailto:{reply_addr}' style='color:#c4a052'>{reply_addr}</a>"
        f" or {office_phone}.</p></div>"
    )

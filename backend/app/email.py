"""HIPAA-aware transactional email via AWS SES (BAA-covered).

Resend is intentionally not supported — it has no BAA. SMTP remains as a fallback
for non-SES providers when SMTP_HOST is set explicitly.
"""
from __future__ import annotations

import html as html_module
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _default_sender() -> str:
    return (
        os.environ.get("EMAIL_FROM", "").strip()
        or os.environ.get("SMTP_FROM", "").strip()
        or "consult@cccdsmiles.com"
    )


def _default_reply_to(sender: str) -> str:
    return (os.environ.get("REPLY_TO_EMAIL") or "info@destinationsmile.com").strip() or sender


def _plain_from_html(html_body: str) -> str:
    text = html_module.unescape(html_body)
    for tag in ("<br>", "<br/>", "<br />"):
        text = text.replace(tag, "\n")
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


def _brand_shell(*, title: str, body_html: str) -> str:
    """Email wrapper matching consult.cccdsmiles.com success-screen palette."""
    practice = html_module.escape(
        os.environ.get("PRACTICE_NAME", "Charlotte Center for Cosmetic Dentistry")
    )
    reply_addr = html_module.escape(_default_reply_to(_default_sender()))
    office_phone = html_module.escape((os.environ.get("OFFICE_PHONE") or "704.364.4711").strip())
    safe_title = html_module.escape(title)
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f0;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f0;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;
  box-shadow:0 2px 20px rgba(20,18,40,0.08);border:1px solid rgba(28,25,23,0.06);">
<tr><td style="height:4px;background:linear-gradient(90deg,#c4a052,#d4b062);"></td></tr>
<tr><td style="padding:32px 28px 8px;text-align:center;">
  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c4a052;font-family:Arial,sans-serif;">Destination Smile</p>
  <h1 style="margin:0;font-size:26px;font-weight:600;color:#1c1917;letter-spacing:-0.02em;">{safe_title}</h1>
</td></tr>
<tr><td style="padding:8px 28px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#57534e;">
{body_html}
</td></tr>
<tr><td style="padding:0 28px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#78716c;border-top:1px solid #f5f5f4;">
  <p style="margin:16px 0 0;">Questions? Reply to this email or call <a href="tel:{office_phone.replace(' ','')}" style="color:#c4a052;text-decoration:none;">{office_phone}</a>.</p>
  <p style="margin:8px 0 0;"><a href="mailto:{reply_addr}" style="color:#c4a052;text-decoration:none;">{reply_addr}</a></p>
  <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;">{practice}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>"""


def _cta_button(link: str, label: str) -> str:
    safe_link = html_module.escape(link)
    safe_label = html_module.escape(label)
    return (
        f'<p style="margin:28px 0;text-align:center;">'
        f'<a href="{safe_link}" style="display:inline-block;background:#c4a052;color:#ffffff;'
        f"padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;"
        f'font-size:15px;">{safe_label}</a></p>'
        f'<p style="margin:0 0 8px;font-size:13px;color:#78716c;">Or paste this link into your browser:</p>'
        f'<p style="margin:0;font-size:12px;color:#57534e;word-break:break-all;">{safe_link}</p>'
    )


def video_ready_html(link: str) -> str:
    """Zero-PHI video-ready notification — matches success-screen tone."""
    body = (
        "<p style='margin:0 0 12px;'>Your personalized video reply from Dr. Broome is ready to view.</p>"
        "<p style='margin:0;font-size:14px;color:#78716c;'>This private link is just for you. "
        "You can watch on your phone and download a copy to keep.</p>"
        + _cta_button(link, "Watch your consultation")
        + "<p style='margin:20px 0 0;font-size:13px;color:#78716c;'>Didn't see our earlier message? "
        "Check spam or promotions — or save <strong>consult@cccdsmiles.com</strong> to your contacts.</p>"
    )
    return _brand_shell(title="Your video is ready", body_html=body)


def video_nudge_html(link: str, days: int = 7) -> str:
    """Gentle reminder — zero PHI, for unwatched consultations."""
    body = (
        f"<p style='margin:0 0 12px;'>We sent your personalized consultation video "
        f"{days} days ago and wanted to make sure you received it.</p>"
        "<p style='margin:0;font-size:14px;color:#78716c;'>Dr. Broome recorded this just for you. "
        "The link below is still active — watch anytime on your phone or computer.</p>"
        + _cta_button(link, "Watch your consultation")
        + "<p style='margin:20px 0 0;font-size:13px;color:#78716c;'>If you already watched, you can ignore this note. "
        "Questions? Reply here or call our office.</p>"
    )
    return _brand_shell(title="Your video is waiting", body_html=body)


def zero_phi_video_ready_html(link: str, practice: str) -> str:
    """Backward-compatible alias."""
    return video_ready_html(link)


def send_email(to_email: str, subject: str, html_body: str) -> tuple[bool, str]:
    sender = _default_sender()
    reply_to = _default_reply_to(sender)
    region = os.environ.get("AWS_DEFAULT_REGION", os.environ.get("SES_REGION", "us-east-2"))

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

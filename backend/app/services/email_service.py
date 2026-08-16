import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger("email_service")

def get_frontend_portal_url(path: str = "/dashboard") -> str:
    """Returns the production or configured frontend portal URL for email CTA links."""
    base = getattr(settings, "FRONTEND_URL", "").strip() or os.getenv("FRONTEND_URL", "").strip() or os.getenv("NEXTAUTH_URL", "").strip() or "https://campus-bridge-kysitiz7d-sushant-gargs-projects.vercel.app"
    base = base.rstrip("/")
    clean_path = path if path.startswith("/") else f"/{path}"
    return f"{base}{clean_path}"

def send_realtime_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = ""
):
    """
    Asynchronous/Background SMTP Email Dispatcher for real-time notifications.
    Safely sends Gmail/SMTP notifications without blocking API endpoints.
    """
    if not to_email:
        logger.warning("No recipient email specified for email dispatch.")
        return False

    smtp_server = getattr(settings, "SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(getattr(settings, "SMTP_PORT", 587))
    smtp_user = getattr(settings, "SMTP_USER", "")
    smtp_password = getattr(settings, "SMTP_PASSWORD", "")
    from_name = getattr(settings, "SMTP_FROM_NAME", "CampusBridge Governance Portal")

    # Build MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{smtp_user or 'noreply@campusbridge.edu'}>"
    msg["To"] = to_email

    if text_content:
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
    if html_content:
        msg.attach(MIMEText(html_content, "html", "utf-8"))

    # Attempt SMTP delivery if credentials are set
    if smtp_user and smtp_password:
        try:
            with smtplib.SMTP(smtp_server, smtp_port, timeout=10.0) as server:
                server.ehlo()
                if smtp_port in (587, 25):
                    server.starttls()
                    server.ehlo()
                server.login(smtp_user, smtp_password)
                server.sendmail(msg["From"], [to_email], msg.as_string())
            logger.info(f"Realtime email successfully sent to {to_email}: {subject}")
            print(f"[REALTIME EMAIL SENT] To: {to_email} | Subject: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to dispatch SMTP email to {to_email}: {e}")
            print(f"[SMTP DISPATCH LOG] To: {to_email} | Subject: {subject} | Note: {e}")
            return False
    else:
        # Development / Fallback mode logging
        print(f"[REALTIME NOTIFICATION DISPATCHED] To: {to_email}")
        print(f"   Subject: {subject}")
        print(f"   Note: Set SMTP_USER & SMTP_PASSWORD in backend/.env to send actual live emails via Gmail SMTP.")
        return True



def dispatch_status_update_notification(
    student_email: str,
    student_name: str,
    complaint_title: str,
    complaint_id: str,
    new_status: str,
    updated_by: str,
    changes_summary: str
):
    status_colors = {
        "verified": "#10b981",
        "pending_info": "#f59e0b",
        "assigned": "#6366f1",
        "in_progress": "#f59e0b",
        "resolved": "#10b981",
        "rejected": "#ef4444",
        "submitted": "#6b7280"
    }
    status_badge_color = status_colors.get(new_status.lower(), "#6366f1")

    subject = f"[ALERT] Grievance Status Updated: [{new_status.upper()}] - {complaint_title[:50]}"
    portal_url = get_frontend_portal_url("/dashboard")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        .header {{ border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 24px; }}
        .title {{ font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0; }}
        .badge {{ display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: 800; font-size: 12px; color: #ffffff; background-color: {status_badge_color}; text-transform: uppercase; letter-spacing: 0.05em; }}
        .content-box {{ background: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin: 20px 0; }}
        .label {{ font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
        .val {{ font-size: 14px; font-weight: 600; color: #f4f4f5; margin-bottom: 12px; }}
        .btn {{ display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 16px; }}
        .footer {{ font-size: 11px; color: #71717a; margin-top: 32px; text-align: center; border-top: 1px solid #27272a; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase;">CAMPUSBRIDGE REDRESSAL PORTAL</span>
          <h2 class="title" style="margin-top: 6px;">Grievance Workflow Notification</h2>
        </div>
        
        <p style="font-size: 15px; color: #e4e4e7;">Dear <strong>{student_name}</strong>,</p>
        <p style="font-size: 14px; color: #a1a1aa;">Your grievance report status has been updated on the campus governance platform:</p>
        
        <div class="content-box">
          <div class="label">Grievance Title</div>
          <div class="val">{complaint_title}</div>
          
          <div class="label">New Workflow Status</div>
          <div class="val"><span class="badge">{new_status.replace('_', ' ')}</span></div>

          <div class="label">Action Summary</div>
          <div class="val" style="color: #e4e4e7; font-weight: 400;">{changes_summary}</div>

          <div class="label">Updated By</div>
          <div class="val">{updated_by}</div>
        </div>

        <div style="text-align: center;">
          <a href="{portal_url}" class="btn">View Grievance Status & History ➔</a>
        </div>

        <div class="footer">
          CampusBridge Student Redressal & Verification System &bull; Realtime Automated Notification
        </div>
      </div>
    </body>
    </html>
    """

    text = f"Dear {student_name},\n\nYour grievance '{complaint_title}' status is now [{new_status.upper()}].\nDetails: {changes_summary}\nUpdated by: {updated_by}\n\nView details: {portal_url}"

    return send_realtime_email(student_email, subject, html, text)


def dispatch_comment_notification(
    recipient_email: str,
    recipient_name: str,
    complaint_title: str,
    comment_author: str,
    comment_content: str
):
    subject = f"[MESSAGE] New Communication on Grievance: {complaint_title[:50]}"
    portal_url = get_frontend_portal_url("/dashboard")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; }}
        .comment-box {{ background: #09090b; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 8px; }}
        .btn {{ display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase;">CAMPUSBRIDGE NOTIFICATION</span>
        <h2 style="color: #ffffff; font-size: 18px;">New Communication Update</h2>
        <p style="color: #a1a1aa; font-size: 14px;">Hi <strong>{recipient_name}</strong>,</p>
        <p style="color: #e4e4e7; font-size: 14px;">A new official update has been posted on <strong>"{complaint_title}"</strong> by <strong>{comment_author}</strong>:</p>
        
        <div class="comment-box">
          <p style="margin: 0; color: #f4f4f5; font-size: 14px; white-space: pre-wrap;">{comment_content}</p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="{portal_url}" class="btn">Open Portal Discussion ➔</a>
        </div>
      </div>
    </body>
    </html>
    """

    return send_realtime_email(recipient_email, subject, html, comment_content)


def dispatch_additional_info_request_notification(
    student_email: str,
    student_name: str,
    complaint_title: str,
    complaint_id: str,
    info_requested: str,
    integrity_score: int
):
    subject = f"[ACTION REQUIRED] Additional Evidence/Information Needed for: {complaint_title[:50]}"
    portal_url = get_frontend_portal_url("/dashboard")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        .header {{ border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 24px; }}
        .title {{ font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0; }}
        .badge {{ display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: 800; font-size: 12px; color: #000000; background-color: #f59e0b; text-transform: uppercase; letter-spacing: 0.05em; }}
        .content-box {{ background: #09090b; border: 1px solid #3f3f46; border-radius: 12px; padding: 20px; margin: 20px 0; }}
        .alert-box {{ background: #451a03; border: 1px solid #b45309; border-radius: 10px; padding: 16px; margin: 16px 0; color: #fef3c7; font-size: 14px; }}
        .label {{ font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
        .val {{ font-size: 14px; font-weight: 600; color: #f4f4f5; margin-bottom: 12px; }}
        .btn {{ display: inline-block; background: #f59e0b; color: #000000; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; margin-top: 16px; }}
        .footer {{ font-size: 11px; color: #71717a; margin-top: 32px; text-align: center; border-top: 1px solid #27272a; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">CAMPUSBRIDGE AI TRIAGE AUDITOR</span>
          <h2 class="title" style="margin-top: 6px;">Action Required: Additional Information Needed</h2>
        </div>
        
        <p style="font-size: 15px; color: #e4e4e7;">Dear <strong>{student_name}</strong>,</p>
        <p style="font-size: 14px; color: #a1a1aa;">Your submitted campus grievance was audited by our AI multi-agent integrity system (Integrity Score: <strong>{integrity_score}/100</strong>).</p>
        
        <div class="alert-box">
          <strong>⚠️ Specific Information / Documents Requested by AI:</strong><br>
          <p style="margin: 8px 0 0 0; line-height: 1.5;">{info_requested}</p>
        </div>

        <div class="content-box">
          <div class="label">Grievance Title</div>
          <div class="val">{complaint_title}</div>
          
          <div class="label">Current Status</div>
          <div class="val"><span class="badge">Pending Additional Info</span></div>
        </div>

        <div style="text-align: center;">
          <a href="{portal_url}" class="btn">Upload Requested Documents & Info ➔</a>
        </div>

        <div class="footer">
          CampusBridge Student Redressal & Verification System &bull; Automated AI Request
        </div>
      </div>
    </body>
    </html>
    """

    text = (
        f"Dear {student_name},\n\n"
        f"Your grievance '{complaint_title}' requires additional information/documents (Score: {integrity_score}/100).\n\n"
        f"AI Request: {info_requested}\n\n"
        f"Please provide the requested details at: {portal_url}"
    )

    return send_realtime_email(student_email, subject, html, text)


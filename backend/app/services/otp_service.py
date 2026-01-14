"""
OTP Service for Email Verification.

Ported from the old Next.js implementation.
Uses in-memory store with Redis fallback for production.
"""

import random
import string
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import get_settings

settings = get_settings()


class OTPData:
    """OTP data structure."""
    def __init__(self, otp: str, expires: datetime, attempts: int = 0):
        self.otp = otp
        self.expires = expires
        self.attempts = attempts


class OTPStore:
    """In-memory OTP store with automatic cleanup."""
    
    def __init__(self):
        self._store: Dict[str, OTPData] = {}
    
    def set(self, email: str, data: OTPData):
        """Store OTP for an email."""
        self._store[email.lower().strip()] = data
    
    def get(self, email: str) -> Optional[OTPData]:
        """Get OTP for an email."""
        return self._store.get(email.lower().strip())
    
    def delete(self, email: str):
        """Delete OTP for an email."""
        key = email.lower().strip()
        if key in self._store:
            del self._store[key]
    
    def cleanup(self):
        """Remove expired OTPs."""
        now = datetime.utcnow()
        expired = [k for k, v in self._store.items() if v.expires < now]
        for key in expired:
            del self._store[key]


# Global OTP store instance
otp_store = OTPStore()


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


async def send_otp_email(email: str, otp: str, username: str = "User") -> bool:
    """
    Send OTP via SMTP email.
    
    Args:
        email: Recipient email address
        otp: The OTP code
        username: User's name for personalization
        
    Returns:
        True if sent successfully, False otherwise
    """
    if not settings.mail_username or not settings.mail_password:
        print("⚠️ Email not configured. OTP would be:", otp)
        return True  # Allow testing without email

    first_name = username.split()[0] if username else "User"

    # HTML email template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ 
          font-family: Arial, Helvetica, sans-serif; 
          line-height: 1.6; 
          color: #000000; 
          margin: 0;
          padding: 0;
          background-color: #ffffff;
        }}
        .container {{ 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 40px 20px;
        }}
        .otp-section {{
          margin: 30px 0;
          padding: 20px;
          border: 1px solid #000000;
          text-align: center;
        }}
        .otp-code {{ 
          font-size: 32px; 
          font-weight: bold; 
          letter-spacing: 8px; 
          color: #000000;
          font-family: 'Courier New', monospace;
        }}
        .warning {{
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #000000;
          font-size: 14px;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div>Hello {first_name},</div>
        <p>We received a request to verify your email. Your verification code is:</p>
        <div class="otp-section">
          <div class="otp-code">{otp}</div>
        </div>
        <div class="warning">This code will expire in 10 minutes.</div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <br>
        <div>Thank you,<br>Team ShopGPT</div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
Hello {first_name},

Your verification code is: {otp}

This code will expire in 10 minutes.

If you didn't request this, you can safely ignore this email.

Thank you,
Team ShopGPT
"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your Verification Code"
        msg["From"] = settings.mail_from or settings.mail_username
        msg["To"] = email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        # Connect to SMTP server
        if settings.mail_starttls:
            server = smtplib.SMTP(settings.mail_server, settings.mail_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.mail_server, settings.mail_port)

        server.login(settings.mail_username, settings.mail_password)
        server.sendmail(settings.mail_username, email, msg.as_string())
        server.quit()

        print(f"✅ OTP email sent to {email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send OTP email: {e}")
        return False


class OTPService:
    """Service for OTP operations."""

    OTP_EXPIRY_MINUTES = 10
    MAX_ATTEMPTS = 5
    RATE_LIMIT_MINUTES = 1  # Min time before new OTP can be requested

    async def send_otp(self, email: str, username: str = "User") -> Dict[str, Any]:
        """
        Generate and send OTP to email.
        
        Args:
            email: User's email address
            username: User's name for personalization
            
        Returns:
            Dict with success status and message
        """
        normalized_email = email.lower().strip()
        
        # Cleanup expired OTPs
        otp_store.cleanup()

        # Rate limiting check
        existing = otp_store.get(normalized_email)
        if existing:
            time_remaining = (existing.expires - datetime.utcnow()).total_seconds()
            # Allow new OTP only if less than 1 minute remaining
            if time_remaining > (self.OTP_EXPIRY_MINUTES - self.RATE_LIMIT_MINUTES) * 60:
                minutes_to_wait = int(time_remaining / 60) + 1
                return {
                    "success": False,
                    "message": f"Please wait {minutes_to_wait} minute(s) before requesting another OTP"
                }

        # Generate OTP
        otp = generate_otp()
        expires = datetime.utcnow() + timedelta(minutes=self.OTP_EXPIRY_MINUTES)
        
        print(f"🔐 Generated OTP for {normalized_email}: {otp}")

        # Store OTP
        otp_store.set(normalized_email, OTPData(otp=otp, expires=expires, attempts=0))

        # Send email
        sent = await send_otp_email(normalized_email, otp, username)
        
        if sent:
            return {"success": True, "message": "OTP sent successfully"}
        else:
            return {"success": False, "message": "Failed to send OTP email"}

    async def verify_otp(
        self, email: str, otp: str, skip_delete: bool = False
    ) -> Dict[str, Any]:
        """
        Verify OTP code.
        
        Args:
            email: User's email
            otp: OTP code to verify
            skip_delete: If True, keep OTP in store (for multi-step flows)
            
        Returns:
            Dict with success status and message
        """
        normalized_email = email.lower().strip()
        normalized_otp = otp.strip()

        stored = otp_store.get(normalized_email)

        if not stored:
            return {"success": False, "message": "No OTP found. Please request a new one."}

        # Check expiration
        if datetime.utcnow() > stored.expires:
            otp_store.delete(normalized_email)
            return {"success": False, "message": "OTP has expired. Please request a new one."}

        # Check attempts
        if stored.attempts >= self.MAX_ATTEMPTS:
            otp_store.delete(normalized_email)
            return {"success": False, "message": "Too many failed attempts. Please request a new OTP."}

        # Verify OTP
        if stored.otp == normalized_otp:
            print(f"✅ OTP verified for {normalized_email}")
            if not skip_delete:
                otp_store.delete(normalized_email)
            return {"success": True, "message": "OTP verified successfully"}

        # Increment attempts
        stored.attempts += 1
        otp_store.set(normalized_email, stored)
        
        remaining = self.MAX_ATTEMPTS - stored.attempts
        return {"success": False, "message": f"Invalid OTP. {remaining} attempts remaining."}


# Global service instance
otp_service = OTPService()

"""
Email Service

Handles email sending with SMTP and template management
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional, Dict, Any
from pathlib import Path
from jinja2 import Template
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.config import settings
from backend.models.content import EmailTemplate
from backend.core.exceptions import ResourceNotFoundError


logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails with template support"""
    
    # Default template types that must always exist
    DEFAULT_TEMPLATES = {
        'welcome': {
            'subject': 'Welcome to EagleChair',
            'body': '''
                <html>
                <body>
                    <h2>Welcome to EagleChair, {{ company_name }}!</h2>
                    <p>Thank you for registering with us. Your account is now active.</p>
                    <p>You can now browse our catalog and request quotes for your business needs.</p>
                    <p>Contact Email: {{ contact_email }}</p>
                    <br>
                    <p>Best regards,<br>The EagleChair Team</p>
                </body>
                </html>
            '''
        },
        'password_reset': {
            'subject': 'Password Reset Request',
            'body': '''
                <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>Hi {{ company_name }},</p>
                    <p>You requested to reset your password. Click the link below to reset it:</p>
                    <p><a href="{{ reset_link }}">Reset Password</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <br>
                    <p>Best regards,<br>The EagleChair Team</p>
                </body>
                </html>
            '''
        },
        'quote_created': {
            'subject': 'Quote Request Received',
            'body': '''
                <html>
                <body>
                    <h2>Quote Request Received</h2>
                    <p>Hi {{ company_name }},</p>
                    <p>We've received your quote request #{{ quote_number }}.</p>
                    <p>Total Items: {{ item_count }}</p>
                    <p>Our team will review your request and get back to you within 2 business days.</p>
                    <p>You can view your quote details at any time by logging into your account.</p>
                    <br>
                    <p>Best regards,<br>The EagleChair Team</p>
                </body>
                </html>
            '''
        },
        'quote_updated': {
            'subject': 'Quote #{{ quote_number }} Updated',
            'body': '''
                <html>
                <body>
                    <h2>Quote Status Updated</h2>
                    <p>Hi {{ company_name }},</p>
                    <p>Your quote #{{ quote_number }} has been updated.</p>
                    <p>Status: <strong>{{ status }}</strong></p>
                    {% if admin_notes %}
                    <p>Notes: {{ admin_notes }}</p>
                    {% endif %}
                    <p>Please log in to your account to view the full details.</p>
                    <br>
                    <p>Best regards,<br>The EagleChair Team</p>
                </body>
                </html>
            '''
        },
        'quote_approved': {
            'subject': 'Quote #{{ quote_number }} Approved',
            'body': '''
                <html>
                <body>
                    <h2>Quote Approved!</h2>
                    <p>Hi {{ company_name }},</p>
                    <p>Great news! Your quote #{{ quote_number }} has been approved.</p>
                    <p>Total Amount: ${{ total_amount }}</p>
                    {% if admin_notes %}
                    <p>Notes: {{ admin_notes }}</p>
                    {% endif %}
                    <p>Our team will contact you shortly to discuss next steps.</p>
                    <br>
                    <p>Best regards,<br>The EagleChair Team</p>
                </body>
                </html>
            '''
        },
        'admin_quote_notification': {
            'subject': 'New Quote Request #{{ quote_number }}',
            'body': '''
                <html>
                <body>
                    <h2>New Quote Request</h2>
                    <p>A new quote request has been submitted:</p>
                    <ul>
                        <li>Quote Number: #{{ quote_number }}</li>
                        <li>Company: {{ company_name }}</li>
                        <li>Items: {{ item_count }}</li>
                        <li>Contact: {{ contact_email }}</li>
                    </ul>
                    <p>Please review and respond to this request.</p>
                    <br>
                    <p>EagleChair Admin System</p>
                </body>
                </html>
            '''
        },
        'company_approved': {
            'subject': 'Your EagleChair Account is Approved',
            'body': '''
                <html>
                <body>
                    <h2>Account Approved!</h2>
                    <p>Hi {{ company_name }},</p>
                    <p>Your EagleChair account has been approved by our team.</p>
                    <p>You can now access all features including:</p>
                    <ul>
                        <li>Browse our complete product catalog</li>
                        <li>Request quotes</li>
                        <li>Download catalogs and installation guides</li>
                    </ul>
                    <p><a href="{{ login_url }}">Login to Your Account</a></p>
                    <br>
                    <p>Best regards,<br>The EagleChair Team</p>
                </body>
                </html>
            '''
        },
        'custom': {
            'subject': '{{ subject }}',
            'body': '{{ body }}'
        }
    }
    
    @staticmethod
    def _get_smtp_connection():
        """Create SMTP connection"""
        try:
            if settings.SMTP_TLS:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
            
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            return server
        except Exception as e:
            logger.error(f"Failed to connect to SMTP server: {e}")
            raise
    
    @staticmethod
    async def get_template(
        db: AsyncSession,
        template_type: str
    ) -> Optional[EmailTemplate]:
        """Get email template by type"""
        result = await db.execute(
            select(EmailTemplate).where(
                EmailTemplate.template_type == template_type,
                EmailTemplate.is_active == True
            )
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_template(
        db: AsyncSession,
        template_type: str,
        name: str,
        subject: str,
        body: str,
        description: Optional[str] = None,
        is_active: bool = True
    ) -> EmailTemplate:
        """Create a new email template"""
        template = EmailTemplate(
            template_type=template_type,
            name=name,
            subject=subject,
            body=body,
            description=description,
            is_active=is_active
        )
        db.add(template)
        await db.commit()
        await db.refresh(template)
        logger.info(f"Created email template: {template_type}")
        return template
    
    @staticmethod
    async def update_template(
        db: AsyncSession,
        template_id: int,
        **updates
    ) -> EmailTemplate:
        """Update email template"""
        result = await db.execute(
            select(EmailTemplate).where(EmailTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise ResourceNotFoundError(resource_type="Email Template", resource_id=template_id)
        
        for key, value in updates.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        await db.commit()
        await db.refresh(template)
        logger.info(f"Updated email template {template_id}")
        return template
    
    @staticmethod
    async def list_templates(
        db: AsyncSession,
        include_inactive: bool = False
    ) -> List[EmailTemplate]:
        """List all email templates"""
        query = select(EmailTemplate)
        
        if not include_inactive:
            query = query.where(EmailTemplate.is_active == True)
        
        query = query.order_by(EmailTemplate.template_type)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    async def send_email(
        db: AsyncSession,
        to_email: str,
        template_type: str,
        context: Dict[str, Any],
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        custom_subject: Optional[str] = None,
        custom_body: Optional[str] = None
    ) -> bool:
        """
        Send email using template
        
        Args:
            db: Database session
            to_email: Recipient email
            template_type: Type of template to use
            context: Variables for template rendering
            cc: CC recipients
            bcc: BCC recipients
            attachments: List of attachments with 'filename' and 'content' keys
            custom_subject: Override template subject
            custom_body: Override template body
        """
        try:
            # Get template from database or use default
            db_template = await EmailService.get_template(db, template_type)
            
            if db_template:
                subject_template = Template(db_template.subject)
                body_template = Template(db_template.body)
            elif template_type in EmailService.DEFAULT_TEMPLATES:
                default = EmailService.DEFAULT_TEMPLATES[template_type]
                subject_template = Template(default['subject'])
                body_template = Template(default['body'])
            else:
                logger.error(f"Email template not found: {template_type}")
                return False
            
            # Override with custom content if provided
            if custom_subject:
                subject_template = Template(custom_subject)
            if custom_body:
                body_template = Template(custom_body)
            
            # Render templates
            subject = subject_template.render(**context)
            body = body_template.render(**context)
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = to_email
            msg['Subject'] = subject
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            if bcc:
                msg['Bcc'] = ', '.join(bcc)
            
            # Attach body
            msg.attach(MIMEText(body, 'html'))
            
            # Attach files if provided
            if attachments:
                for attachment in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f"attachment; filename= {attachment['filename']}"
                    )
                    msg.attach(part)
            
            # Send email
            server = EmailService._get_smtp_connection()
            
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent to {to_email} using template {template_type}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    @staticmethod
    async def send_welcome_email(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        contact_email: str
    ) -> bool:
        """Send welcome email to new company"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='welcome',
            context={
                'company_name': company_name,
                'contact_email': contact_email
            }
        )
    
    @staticmethod
    async def send_password_reset_email(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        reset_link: str
    ) -> bool:
        """Send password reset email"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='password_reset',
            context={
                'company_name': company_name,
                'reset_link': reset_link
            }
        )
    
    @staticmethod
    async def send_quote_created_email(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        quote_number: str,
        item_count: int
    ) -> bool:
        """Send quote created confirmation"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='quote_created',
            context={
                'company_name': company_name,
                'quote_number': quote_number,
                'item_count': item_count
            }
        )
    
    @staticmethod
    async def send_quote_updated_email(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        quote_number: str,
        status: str,
        admin_notes: Optional[str] = None
    ) -> bool:
        """Send quote status update email"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='quote_updated',
            context={
                'company_name': company_name,
                'quote_number': quote_number,
                'status': status,
                'admin_notes': admin_notes or ''
            }
        )
    
    @staticmethod
    async def send_admin_quote_notification(
        db: AsyncSession,
        quote_number: str,
        company_name: str,
        item_count: int,
        contact_email: str
    ) -> bool:
        """Notify admins of new quote request"""
        return await EmailService.send_email(
            db=db,
            to_email=settings.ADMIN_EMAIL,
            template_type='admin_quote_notification',
            context={
                'quote_number': quote_number,
                'company_name': company_name,
                'item_count': item_count,
                'contact_email': contact_email
            }
        )
    
    @staticmethod
    async def send_company_approved_email(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        login_url: str
    ) -> bool:
        """Send company approval email"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='company_approved',
            context={
                'company_name': company_name,
                'login_url': login_url
            }
        )
    
    @staticmethod
    async def send_custom_email(
        db: AsyncSession,
        to_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send custom email (admin feature)"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='custom',
            context={
                'subject': subject,
                'body': body
            },
            cc=cc,
            bcc=bcc,
            attachments=attachments
        )


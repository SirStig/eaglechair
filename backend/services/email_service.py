"""
Email Service

Handles email sending with SMTP and template management
"""

import logging
import smtplib
from datetime import datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional

from jinja2 import Environment, Template
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.core.exceptions import ResourceNotFoundError
from backend.models.content import EmailTemplate

logger = logging.getLogger(__name__)

# Get the directory where this file is located
BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "email_templates"


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
        """
        Create authenticated SMTP connection
        
        Requires SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD to be configured.
        Authentication is required for sending emails.
        
        Raises:
            ValueError: If SMTP credentials are not configured
            smtplib.SMTPException: If connection or authentication fails
        """
        # Validate required SMTP settings
        if not settings.SMTP_HOST:
            raise ValueError("SMTP_HOST is not configured. Please set SMTP_HOST in environment variables.")
        
        if not settings.SMTP_USER:
            raise ValueError("SMTP_USER is not configured. Please set SMTP_USER in environment variables.")
        
        if not settings.SMTP_PASSWORD:
            raise ValueError("SMTP_PASSWORD is not configured. Please set SMTP_PASSWORD in environment variables.")
        
        try:
            # Create SMTP connection
            if settings.SMTP_TLS:
                # Use STARTTLS (default for port 587)
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
                server.set_debuglevel(0)  # Set to 1 for debugging
                # Start TLS encryption
                server.starttls()
            else:
                # Use SSL/TLS (for port 465)
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
                server.set_debuglevel(0)
            
            # Authenticate with credentials
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
            logger.debug(f"Successfully authenticated with SMTP server {settings.SMTP_HOST}:{settings.SMTP_PORT}")
            return server
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed for user {settings.SMTP_USER}: {e}")
            raise ValueError("SMTP authentication failed. Please check your SMTP_USER and SMTP_PASSWORD credentials.") from e
        except smtplib.SMTPConnectError as e:
            logger.error(f"Failed to connect to SMTP server {settings.SMTP_HOST}:{settings.SMTP_PORT}: {e}")
            raise ValueError("Failed to connect to SMTP server. Please check SMTP_HOST and SMTP_PORT settings.") from e
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            raise ValueError(f"SMTP error: {str(e)}") from e
        except Exception as e:
            logger.error(f"Unexpected error connecting to SMTP server: {e}")
            raise ValueError(f"Failed to connect to SMTP server: {str(e)}") from e
    
    @staticmethod
    async def get_template(
        db: AsyncSession,
        template_type: str
    ) -> Optional[EmailTemplate]:
        """Get email template by type"""
        result = await db.execute(
            select(EmailTemplate).where(
                EmailTemplate.template_type == template_type,
                EmailTemplate.is_active.is_(True)
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
            query = query.where(EmailTemplate.is_active.is_(True))
        
        query = query.order_by(EmailTemplate.template_type)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    def _load_base_template() -> str:
        """Load the base email template"""
        base_template_path = TEMPLATES_DIR / "base.html"
        if base_template_path.exists():
            return base_template_path.read_text(encoding='utf-8')
        else:
            logger.warning(f"Base template not found at {base_template_path}, using fallback")
            return """<!DOCTYPE html><html><head><meta charset="UTF-8"><title>{{ subject }}</title></head><body>{{ content|safe }}</body></html>"""
    
    @staticmethod
    async def _get_site_settings(db: AsyncSession) -> Dict[str, Any]:
        """Get site settings from database"""
        from sqlalchemy import select

        from backend.models.content import SiteSettings
        
        result = await db.execute(select(SiteSettings).limit(1))
        site_settings = result.scalar_one_or_none()
        
        if site_settings:
            return {
                'company_name': site_settings.company_name or 'EagleChair',
                'company_tagline': site_settings.company_tagline or 'Premium Office Furniture',
                'logo_url': site_settings.logo_url,
                'primary_email': site_settings.primary_email,
                'primary_phone': site_settings.primary_phone,
                'sales_email': site_settings.sales_email,
                'sales_phone': site_settings.sales_phone,
                'support_email': site_settings.support_email,
                'support_phone': site_settings.support_phone,
                'address_line1': site_settings.address_line1,
                'address_line2': site_settings.address_line2,
                'city': site_settings.city,
                'state': site_settings.state,
                'zip_code': site_settings.zip_code,
                'country': site_settings.country or 'USA',
            }
        
        # Return defaults if no settings found
        return {
            'company_name': 'EagleChair',
            'company_tagline': 'Premium Office Furniture',
            'logo_url': None,
            'primary_email': None,
            'primary_phone': None,
            'sales_email': None,
            'sales_phone': None,
            'support_email': None,
            'support_phone': None,
            'address_line1': None,
            'address_line2': None,
            'city': None,
            'state': None,
            'zip_code': None,
            'country': 'USA',
        }
    
    @staticmethod
    async def _render_with_base_template(
        content: str, 
        context: Dict[str, Any], 
        db: AsyncSession
    ) -> str:
        """
        Wrap content in base email template
        
        Args:
            content: Inner HTML content
            context: Template context (will be merged with base template context)
            db: Database session for fetching site settings
        """
        base_template_html = EmailService._load_base_template()
        base_template = Template(base_template_html)
        
        # Get site settings from database
        site_settings = await EmailService._get_site_settings(db)
        
        # Build address string
        address_parts = []
        if site_settings.get('address_line1'):
            address_parts.append(site_settings['address_line1'])
        if site_settings.get('address_line2'):
            address_parts.append(site_settings['address_line2'])
        city_state_zip = []
        if site_settings.get('city'):
            city_state_zip.append(site_settings['city'])
        if site_settings.get('state'):
            city_state_zip.append(site_settings['state'])
        if site_settings.get('zip_code'):
            city_state_zip.append(site_settings['zip_code'])
        if city_state_zip:
            address_parts.append(', '.join(city_state_zip))
        if site_settings.get('country') and site_settings['country'] != 'USA':
            address_parts.append(site_settings['country'])
        
        address_string = ' | '.join(address_parts) if address_parts else None
        
        # Merge context with base template defaults
        base_context = {
            'content': content,
            'subject': context.get('subject', site_settings.get('company_name', 'EagleChair')),
            'frontend_url': settings.FRONTEND_URL,
            'current_year': datetime.now().year,
            'logo_url': context.get('logo_url') or site_settings.get('logo_url'),
            'unsubscribe_url': context.get('unsubscribe_url'),
            'company_name': site_settings.get('company_name', 'EagleChair'),
            'company_tagline': site_settings.get('company_tagline', 'Premium Office Furniture'),
            'primary_email': site_settings.get('primary_email'),
            'primary_phone': site_settings.get('primary_phone'),
            'sales_email': site_settings.get('sales_email'),
            'sales_phone': site_settings.get('sales_phone'),
            'support_email': site_settings.get('support_email'),
            'support_phone': site_settings.get('support_phone'),
            'address_string': address_string,
            **context  # Allow context to override defaults
        }
        
        return base_template.render(**base_context)
    
    @staticmethod
    def _create_template_with_helpers(template_string: str) -> Template:
        """
        Create a Jinja2 template with helper functions available
        
        Helper functions available in templates:
        - {{ button(url, text, style='primary') }}
        - {{ code(value) }}
        - {{ image(url, alt) }}
        """
        # Create Jinja2 environment with custom functions
        env = Environment()
        
        def button(url: str, text: str, style: str = 'primary') -> str:
            """Generate button HTML"""
            style_class = 'button' if style == 'primary' else 'button button-secondary'
            bg_color = "#8b7355" if style == "primary" else "#d4c5b0"
            text_color = "#ffffff" if style == "primary" else "#2c2c2c"
            return f'<div class="button-container"><a href="{url}" class="{style_class}" style="display: inline-block; padding: 14px 32px; background-color: {bg_color}; color: {text_color}; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500; max-width: 100%; box-sizing: border-box;">{text}</a></div>'
        
        def code(value: str) -> str:
            """Generate verification code HTML"""
            return f'<div class="code-container"><div class="verification-code" style="display: inline-block; padding: 20px 40px; background-color: #f8f6f3; border: 2px dashed #d4c5b0; border-radius: 8px; font-size: 32px; font-weight: 600; letter-spacing: 8px; color: #2c2c2c; font-family: \'Courier New\', monospace;">{value}</div></div>'
        
        def image(url: str, alt: str = '') -> str:
            """Generate image HTML"""
            return f'<img src="{url}" alt="{alt}" class="content-image" style="max-width: 100%; height: auto; border-radius: 6px; margin: 20px 0; display: block;">'
        
        env.globals['button'] = button
        env.globals['code'] = code
        env.globals['image'] = image
        
        return env.from_string(template_string)
    
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
            context: Variables for template rendering (can include buttons, codes, images)
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
                subject_template = Template(str(db_template.subject))
                body_template_str = str(db_template.body)
            elif template_type in EmailService.DEFAULT_TEMPLATES:
                default = EmailService.DEFAULT_TEMPLATES[template_type]
                subject_template = Template(default['subject'])
                body_template_str = default['body']
            else:
                logger.error(f"Email template not found: {template_type}")
                return False
            
            # Override with custom content if provided
            if custom_subject:
                subject_template = Template(custom_subject)
            if custom_body:
                body_template_str = custom_body
            
            # Create body template with helper functions available
            body_template = EmailService._create_template_with_helpers(body_template_str)
            
            # Render subject
            subject = subject_template.render(**context)
            
            # Render body with helper functions (now available in template)
            body_content = body_template.render(**context)
            
            # Wrap in base template
            body = await EmailService._render_with_base_template(body_content, {**context, 'subject': subject}, db)
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
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
            
            # Validate SMTP configuration before attempting to send
            if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
                logger.error("SMTP not properly configured. SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required.")
                return False
            
            # Get authenticated SMTP connection
            server = EmailService._get_smtp_connection()
            
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            server.send_message(msg)
            server.quit()
            
            # Update template usage tracking
            if db_template:
                db_template.times_sent += 1
                db_template.last_sent_at = datetime.utcnow()
                await db.commit()
            
            logger.info(f"Email sent to {to_email} using template {template_type}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}", exc_info=True)
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
        admin_notes: Optional[str] = None,
        quoted_price: Optional[int] = None,
        quoted_lead_time: Optional[str] = None,
        quote_url: Optional[str] = None
    ) -> bool:
        """Send quote status update email"""
        context = {
            'company_name': company_name,
            'quote_number': quote_number,
            'status': status,
            'admin_notes': admin_notes or '',
            'quote_url': quote_url or f"{settings.FRONTEND_URL}/quotes/{quote_number}"
        }
        if quoted_price is not None:
            context['quoted_price'] = quoted_price
        if quoted_lead_time:
            context['quoted_lead_time'] = quoted_lead_time
        
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='quote_updated',
            context=context
        )
    
    @staticmethod
    async def send_quote_detailed_email(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        quote_number: str,
        status: str,
        items: List[Dict[str, Any]],
        subtotal: int,
        tax_amount: Optional[int],
        shipping_cost: Optional[int],
        total_amount: int,
        quoted_price: Optional[int] = None,
        quoted_lead_time: Optional[str] = None,
        quote_valid_until: Optional[str] = None,
        quote_notes: Optional[str] = None,
        quote_url: Optional[str] = None
    ) -> bool:
        """Send detailed quote email with full quote information"""
        context = {
            'company_name': company_name,
            'quote_number': quote_number,
            'status': status,
            'items': items,
            'subtotal': subtotal,
            'tax_amount': tax_amount or 0,
            'shipping_cost': shipping_cost or 0,
            'total_amount': total_amount,
            'quote_url': quote_url or f"{settings.FRONTEND_URL}/quotes/{quote_number}"
        }
        
        if quoted_price is not None:
            context['quoted_price'] = quoted_price
        if quoted_lead_time:
            context['quoted_lead_time'] = quoted_lead_time
        if quote_valid_until:
            context['quote_valid_until'] = quote_valid_until
        if quote_notes:
            context['quote_notes'] = quote_notes
        
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='quote_detailed',
            context=context
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
    async def send_email_verification(
        db: AsyncSession,
        to_email: str,
        company_name: str,
        verification_url: str
    ) -> bool:
        """Send email verification email"""
        return await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type='email_verification',
            context={
                'company_name': company_name,
                'verification_url': verification_url
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


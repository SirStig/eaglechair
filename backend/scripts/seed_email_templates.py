"""
Seed Email Templates Script

Creates required email templates with beautiful HTML content.
Run this script after setting up the database.

Usage:
    python -m backend.scripts.seed_email_templates
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import settings
from backend.models.content import EmailTemplate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Required email templates with beautiful HTML
REQUIRED_TEMPLATES = {
    'email_verification': {
        'name': 'Email Verification',
        'description': 'Sent to users when they need to verify their email address',
        'subject': 'Verify Your EagleChair Email Address',
        'body': '''<h1>Verify Your Email Address</h1>
<p>Hi {{ company_name }},</p>
<p>Thank you for registering with EagleChair! To complete your registration and activate your account, please verify your email address by clicking the button below.</p>

{{ button(verification_url, 'Verify Email Address', 'primary') }}

<p>This link will expire in 24 hours. If you did not create an account with EagleChair, you can safely ignore this email.</p>

<p>If the button doesn't work, copy and paste this link into your browser:</p>
<p style="color: #8b7355; word-break: break-all;">{{ verification_url }}</p>''',
        'available_variables': {
            'company_name': 'Name of the company/user',
            'verification_url': 'URL to verify the email address'
        }
    },
    'welcome': {
        'name': 'Welcome Email',
        'description': 'Sent to new users after email verification',
        'subject': 'Welcome to EagleChair!',
        'body': '''<h1>Welcome to EagleChair, {{ company_name }}!</h1>
<p>Thank you for joining EagleChair. Your account has been successfully verified and activated.</p>

<p>You can now access all of our premium features:</p>
<ul>
    <li>Browse our complete product catalog</li>
    <li>Request custom quotes</li>
    <li>Download catalogs and installation guides</li>
    <li>Manage your saved configurations</li>
</ul>

{{ button(login_url, 'Access Your Account', 'primary') }}

<p>If you have any questions, our team is here to help. Simply reply to this email or contact us through your account dashboard.</p>

<p>Welcome aboard!</p>
<p><strong>The EagleChair Team</strong></p>''',
        'available_variables': {
            'company_name': 'Name of the company',
            'login_url': 'URL to login page'
        }
    },
    'password_reset': {
        'name': 'Password Reset',
        'description': 'Sent when user requests password reset',
        'subject': 'Reset Your EagleChair Password',
        'body': '''<h1>Password Reset Request</h1>
<p>Hi {{ company_name }},</p>
<p>We received a request to reset the password for your EagleChair account.</p>

<p>Click the button below to create a new password:</p>

{{ button(reset_link, 'Reset Password', 'primary') }}

<p>This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact our support team if you have concerns.</p>

<p>For security reasons, never share this link with anyone. EagleChair staff will never ask for your password or this reset link.</p>''',
        'available_variables': {
            'company_name': 'Name of the company',
            'reset_link': 'URL to reset password page'
        }
    },
    'quote_created': {
        'name': 'Quote Created',
        'description': 'Sent to user when they create a quote request',
        'subject': 'Quote Request #{{ quote_number }} Received',
        'body': '''<h1>Quote Request Received</h1>
<p>Hi {{ company_name }},</p>
<p>Thank you for your quote request! We've received your submission and our team is already reviewing it.</p>

<h2>Quote Details</h2>
<ul>
    <li><strong>Quote Number:</strong> #{{ quote_number }}</li>
    <li><strong>Items:</strong> {{ item_count }}</li>
    <li><strong>Total Items:</strong> {{ total_quantity|default('N/A') }}</li>
</ul>

<p>Our team will review your request and get back to you within 2 business days with a detailed quote.</p>

{{ button(quote_url, 'View Quote Details', 'primary') }}

<p>You'll receive another email once we've prepared your quote.</p>''',
        'available_variables': {
            'company_name': 'Name of the company',
            'quote_number': 'Quote reference number',
            'item_count': 'Number of items in quote',
            'total_quantity': 'Total quantity of items',
            'quote_url': 'URL to view the quote'
        }
    },
    'quote_updated': {
        'name': 'Quote Updated',
        'description': 'Sent when a quote is updated (status change, pricing, etc.)',
        'subject': 'Quote #{{ quote_number }} Has Been Updated',
        'body': '''<h1>Quote Updated</h1>
<p>Hi {{ company_name }},</p>
<p>Your quote #{{ quote_number }} has been updated by our team.</p>

<h2>Update Summary</h2>
<ul>
    <li><strong>Status:</strong> {{ status|title }}</li>
    {% if quoted_price %}
    <li><strong>Quoted Price:</strong> ${{ "%.2f"|format(quoted_price / 100) }}</li>
    {% endif %}
    {% if quoted_lead_time %}
    <li><strong>Lead Time:</strong> {{ quoted_lead_time }}</li>
    {% endif %}
</ul>

{% if admin_notes %}
<div style="background-color: #f8f6f3; padding: 20px; border-radius: 6px; margin: 20px 0;">
    <h3 style="margin-top: 0;">Notes from our team:</h3>
    <p style="margin-bottom: 0;">{{ admin_notes }}</p>
</div>
{% endif %}

{{ button(quote_url, 'View Full Quote Details', 'primary') }}

<p>If you have any questions about this quote, please don't hesitate to reach out to our team.</p>''',
        'available_variables': {
            'company_name': 'Name of the company',
            'quote_number': 'Quote reference number',
            'status': 'Current quote status',
            'quoted_price': 'Quoted price in cents',
            'quoted_lead_time': 'Estimated lead time',
            'admin_notes': 'Optional notes from admin',
            'quote_url': 'URL to view the quote'
        }
    },
    'quote_detailed': {
        'name': 'Quote Detailed Email',
        'description': 'Detailed quote email with full quote information',
        'subject': 'Your Quote #{{ quote_number }} - {{ status|title }}',
        'body': '''<h1>Your Quote Details</h1>
<p>Hi {{ company_name }},</p>
<p>Your quote request has been processed. Below are the complete details:</p>

<h2>Quote Information</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;"><strong>Quote Number:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;">#{{ quote_number }}</td>
    </tr>
    <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;"><strong>Status:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;">{{ status|title }}</td>
    </tr>
    {% if quoted_price %}
    <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;"><strong>Quoted Price:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3; font-size: 18px; font-weight: 600; color: #8b7355;">${{ "%.2f"|format(quoted_price / 100) }}</td>
    </tr>
    {% endif %}
    {% if quoted_lead_time %}
    <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;"><strong>Lead Time:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;">{{ quoted_lead_time }}</td>
    </tr>
    {% endif %}
    {% if quote_valid_until %}
    <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;"><strong>Valid Until:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e8e6e3;">{{ quote_valid_until }}</td>
    </tr>
    {% endif %}
</table>

{% if items %}
<h2>Quote Items</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
        <tr style="background-color: #f8f6f3;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d4c5b0;">Product</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #d4c5b0;">Quantity</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #d4c5b0;">Unit Price</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #d4c5b0;">Total</th>
        </tr>
    </thead>
    <tbody>
        {% for item in items %}
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e8e6e3;">
                <strong>{{ item.product_name }}</strong><br>
                <span style="color: #8a8a8a; font-size: 14px;">{{ item.product_model_number }}</span>
            </td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e8e6e3;">{{ item.quantity }}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e8e6e3;">${{ "%.2f"|format(item.unit_price / 100) }}</td>
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e8e6e3;"><strong>${{ "%.2f"|format(item.line_total / 100) }}</strong></td>
        </tr>
        {% endfor %}
    </tbody>
    <tfoot>
        <tr>
            <td colspan="3" style="padding: 12px; text-align: right; border-top: 2px solid #d4c5b0;"><strong>Subtotal:</strong></td>
            <td style="padding: 12px; text-align: right; border-top: 2px solid #d4c5b0;">${{ "%.2f"|format(subtotal / 100) }}</td>
        </tr>
        {% if tax_amount %}
        <tr>
            <td colspan="3" style="padding: 12px; text-align: right;"><strong>Tax:</strong></td>
            <td style="padding: 12px; text-align: right;">${{ "%.2f"|format(tax_amount / 100) }}</td>
        </tr>
        {% endif %}
        {% if shipping_cost %}
        <tr>
            <td colspan="3" style="padding: 12px; text-align: right;"><strong>Shipping:</strong></td>
            <td style="padding: 12px; text-align: right;">${{ "%.2f"|format(shipping_cost / 100) }}</td>
        </tr>
        {% endif %}
        <tr>
            <td colspan="3" style="padding: 12px; text-align: right; font-size: 18px; border-top: 2px solid #8b7355;"><strong>Total:</strong></td>
            <td style="padding: 12px; text-align: right; font-size: 18px; font-weight: 600; color: #8b7355; border-top: 2px solid #8b7355;">${{ "%.2f"|format(total_amount / 100) }}</td>
        </tr>
    </tfoot>
</table>
{% endif %}

{% if quote_notes %}
<div style="background-color: #f8f6f3; padding: 20px; border-radius: 6px; margin: 20px 0;">
    <h3 style="margin-top: 0;">Quote Notes:</h3>
    <p style="margin-bottom: 0;">{{ quote_notes }}</p>
</div>
{% endif %}

{{ button(quote_url, 'View Full Quote & Accept', 'primary') }}

<p>If you have any questions or need to make changes, please contact our team. We're here to help!</p>''',
        'available_variables': {
            'company_name': 'Name of the company',
            'quote_number': 'Quote reference number',
            'status': 'Quote status',
            'quoted_price': 'Quoted price in cents',
            'quoted_lead_time': 'Lead time',
            'quote_valid_until': 'Quote expiration date',
            'items': 'Array of quote items',
            'subtotal': 'Subtotal in cents',
            'tax_amount': 'Tax amount in cents',
            'shipping_cost': 'Shipping cost in cents',
            'total_amount': 'Total amount in cents',
            'quote_notes': 'Quote notes',
            'quote_url': 'URL to view the quote'
        }
    },
    'company_approved': {
        'name': 'Company Approved',
        'description': 'Sent when a company account is approved by admin',
        'subject': 'Your EagleChair Account Has Been Approved',
        'body': '''<h1>Account Approved!</h1>
<p>Hi {{ company_name }},</p>
<p>Great news! Your EagleChair account has been approved by our team.</p>

<p>You now have full access to:</p>
<ul>
    <li>Browse our complete product catalog</li>
    <li>Request custom quotes</li>
    <li>Download catalogs and installation guides</li>
    <li>Access wholesale pricing</li>
</ul>

{{ button(login_url, 'Login to Your Account', 'primary') }}

<p>If you have any questions, our team is ready to assist you.</p>

<p>Welcome to EagleChair!</p>''',
        'available_variables': {
            'company_name': 'Name of the company',
            'login_url': 'URL to login page'
        }
    },
    'admin_quote_notification': {
        'name': 'Admin Quote Notification',
        'description': 'Sent to admins when a new quote is created',
        'subject': 'New Quote Request #{{ quote_number }}',
        'body': '''<h1>New Quote Request</h1>
<p>A new quote request has been submitted and requires your attention.</p>

<h2>Quote Details</h2>
<ul>
    <li><strong>Quote Number:</strong> #{{ quote_number }}</li>
    <li><strong>Company:</strong> {{ company_name }}</li>
    <li><strong>Contact:</strong> {{ contact_email }}</li>
    <li><strong>Items:</strong> {{ item_count }}</li>
</ul>

{{ button(quote_url, 'Review Quote', 'primary') }}

<p>Please review and respond to this request as soon as possible.</p>''',
        'available_variables': {
            'quote_number': 'Quote reference number',
            'company_name': 'Name of the company',
            'contact_email': 'Contact email address',
            'item_count': 'Number of items',
            'quote_url': 'URL to view the quote in admin panel'
        }
    },
    'company_invite': {
        'name': 'Company Invite',
        'description': 'Sent to companies when invited by admin to create an account',
        'subject': "You're Invited to Join EagleChair",
        'body': '''<h1>You're Invited to Join EagleChair!</h1>
<p>Hi {{ company_name }},</p>
<p>You have been invited to create a company account on EagleChair, where you can access our premium office furniture catalog and wholesale pricing.</p>

<p>With an EagleChair account, you'll be able to:</p>
<ul>
    <li>Browse our complete product catalog with detailed specifications</li>
    <li>Request custom quotes for your business needs</li>
    <li>Download catalogs and installation guides</li>
    <li>Access wholesale pricing and manage your orders</li>
    <li>Save and manage your favorite product configurations</li>
</ul>

<p>Click the button below to create your company account:</p>

{{ button(registration_url, 'Create Your Account', 'primary') }}

<p>If the button doesn't work, copy and paste this link into your browser:</p>
<p style="color: #8b7355; word-break: break-all;">{{ registration_url }}</p>

{% if inviter_name %}
<p>This invitation was sent by {{ inviter_name }} from the EagleChair team.</p>
{% endif %}

<p>If you have any questions about your invitation, please don't hesitate to reach out to our team.</p>

<p>We look forward to working with you!</p>
<p><strong>The EagleChair Team</strong></p>''',
        'available_variables': {
            'company_name': 'Name of the company being invited',
            'registration_url': 'URL to the registration page',
            'inviter_name': 'Name of the admin who sent the invite (optional)'
        }
    }
}


async def seed_email_templates():
    """Create required email templates"""
    
    # Create async engine (convert postgresql:// to postgresql+asyncpg://)
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(
        db_url,
        echo=False,
        future=True
    )
    
    # Create async session factory
    async_session_factory = async_sessionmaker(
        engine, 
        expire_on_commit=False
    )
    
    async with async_session_factory() as session:
        try:
            created_count = 0
            updated_count = 0
            
            for template_type, template_data in REQUIRED_TEMPLATES.items():
                # Check if template already exists
                result = await session.execute(
                    select(EmailTemplate).where(
                        EmailTemplate.template_type == template_type
                    )
                )
                existing_template = result.scalar_one_or_none()
                
                if existing_template:
                    # Update existing template
                    logger.info(f"Updating email template: {template_type}")
                    existing_template.name = template_data['name']
                    existing_template.description = template_data['description']
                    existing_template.subject = template_data['subject']
                    existing_template.body = template_data['body']
                    existing_template.available_variables = json.dumps(template_data.get('available_variables', {}))
                    existing_template.is_active = True
                    updated_count += 1
                else:
                    # Create new template
                    logger.info(f"Creating email template: {template_type}")
                    template = EmailTemplate(
                        template_type=template_type,
                        name=template_data['name'],
                        description=template_data['description'],
                        subject=template_data['subject'],
                        body=template_data['body'],
                        available_variables=json.dumps(template_data.get('available_variables', {})),
                        is_active=True
                    )
                    session.add(template)
                    created_count += 1
            
            await session.commit()
            
            logger.info(f"✅ Email templates seeded successfully!")
            logger.info(f"   Created: {created_count}")
            logger.info(f"   Updated: {updated_count}")
            
        except Exception as e:
            logger.error(f"❌ Error seeding email templates: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_email_templates())


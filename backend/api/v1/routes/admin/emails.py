"""
Admin Email Template Routes

Admin-only endpoints for email template management
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.admin import (
    EmailTemplateCreate,
    EmailTemplateResponse,
    EmailTemplateUpdate,
    EmailTestRequest,
)
from backend.api.v1.schemas.common import MessageResponse
from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.database.base import get_db
from backend.models.company import AdminRole, AdminUser
from backend.models.content import EmailTemplate
from backend.services.email_service import EmailService
from backend.utils.serializers import orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Email Templates"])


@router.get(
    "",
    summary="Get all email templates (Admin)",
    description="Retrieve all email templates"
)
async def get_all_email_templates(
    include_inactive: bool = False,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all email templates.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching email templates")
    
    templates = await EmailService.list_templates(
        db=db,
        include_inactive=include_inactive
    )
    
    # Convert to dicts and parse available_variables
    templates_data = []
    for template in templates:
        template_dict = orm_to_dict(template)
        # Parse available_variables JSON
        if template.available_variables:
            try:
                template_dict['available_variables'] = json.loads(template.available_variables)
            except (json.JSONDecodeError, TypeError):
                template_dict['available_variables'] = {}
        else:
            template_dict['available_variables'] = {}
        templates_data.append(template_dict)
    
    return {
        "templates": templates_data,
        "total": len(templates_data)
    }


@router.get(
    "/{template_id}",
    summary="Get email template by ID (Admin)",
    description="Retrieve a specific email template"
)
async def get_email_template(
    template_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get email template by ID.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching email template {template_id}")
    
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise ResourceNotFoundError(resource_type="Email Template", resource_id=template_id)
    
    template_dict = orm_to_dict(template)
    # Parse available_variables JSON
    if template.available_variables:
        try:
            template_dict['available_variables'] = json.loads(template.available_variables)
        except (json.JSONDecodeError, TypeError):
            template_dict['available_variables'] = {}
    else:
        template_dict['available_variables'] = {}
    
    return template_dict


@router.post(
    "",
    status_code=201,
    summary="Create email template (Admin)",
    description="Create a new email template"
)
async def create_email_template(
    template_data: EmailTemplateCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new email template.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} creating email template: {template_data.template_type}")
    
    # Check if template type already exists
    existing = await EmailService.get_template(db, template_data.template_type)
    if existing:
        raise ValidationError("Template type already exists")
    
    # Create template
    template = await EmailService.create_template(
        db=db,
        template_type=template_data.template_type,
        name=template_data.name,
        subject=template_data.subject,
        body=template_data.body,
        description=template_data.description,
        is_active=template_data.is_active
    )
    
    # Update available_variables if provided
    if template_data.available_variables:
        template.available_variables = json.dumps(template_data.available_variables)
        await db.commit()
        await db.refresh(template)
    
    template_dict = orm_to_dict(template)
    if template.available_variables:
        try:
            template_dict['available_variables'] = json.loads(template.available_variables)
        except (json.JSONDecodeError, TypeError):
            template_dict['available_variables'] = {}
    else:
        template_dict['available_variables'] = {}
    
    logger.info(f"Email template created: {template.id}")
    return template_dict


@router.patch(
    "/{template_id}",
    summary="Update email template (Admin)",
    description="Update an email template"
)
async def update_email_template(
    template_id: int,
    template_data: EmailTemplateUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an email template.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating email template {template_id}")
    
    # Build update dict
    update_dict = template_data.model_dump(exclude_unset=True)
    
    # Handle available_variables
    if 'available_variables' in update_dict:
        update_dict['available_variables'] = json.dumps(update_dict['available_variables'])
    
    # Update template
    template = await EmailService.update_template(
        db=db,
        template_id=template_id,
        **update_dict
    )
    
    template_dict = orm_to_dict(template)
    if template.available_variables:
        try:
            template_dict['available_variables'] = json.loads(template.available_variables)
        except (json.JSONDecodeError, TypeError):
            template_dict['available_variables'] = {}
    else:
        template_dict['available_variables'] = {}
    
    logger.info(f"Email template updated: {template_id}")
    return template_dict


@router.delete(
    "/{template_id}",
    summary="Delete email template (Admin)",
    description="Delete an email template (actually deactivates it)"
)
async def delete_email_template(
    template_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete (deactivate) an email template.
    
    **Admin only** - Requires admin role.
    
    Note: Templates are not actually deleted, just deactivated.
    """
    logger.info(f"Admin {admin.username} deleting email template {template_id}")
    
    # Deactivate instead of delete
    template = await EmailService.update_template(
        db=db,
        template_id=template_id,
        is_active=False
    )
    
    logger.info(f"Email template deactivated: {template_id}")
    return MessageResponse(
        message="Email template deactivated",
        detail="Template has been deactivated. It can be reactivated by updating it."
    )


@router.post(
    "/test",
    summary="Send test email (Admin)",
    description="Send a test email using a template"
)
async def send_test_email(
    test_data: EmailTestRequest,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a test email using a template.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} sending test email to {test_data.to_email}")
    
    # Send test email
    success = await EmailService.send_email(
        db=db,
        to_email=test_data.to_email,
        template_type=test_data.template_type,
        context=test_data.context or {}
    )
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to send test email. Check logs for details."
        )
    
    return MessageResponse(
        message="Test email sent successfully",
        detail=f"Test email has been sent to {test_data.to_email}"
    )


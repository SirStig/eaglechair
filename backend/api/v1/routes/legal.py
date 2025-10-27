"""
Legal & Policy Routes - API v1

Public routes for legal documents, terms, policies, and warranties.
No authentication required - these are public-facing legal pages.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.models.legal import (
    LegalDocument,
    LegalDocumentType,
    ShippingPolicy,
    WarrantyInformation,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Legal & Terms"])


# ============================================================================
# Legal Documents
# ============================================================================

@router.get(
    "/legal/documents",
    summary="Get all legal documents",
    description="Retrieve all active legal documents (terms, policies, warranties)"
)
async def get_legal_documents(
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active legal documents.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching legal documents (type={document_type})")
    
    query = select(LegalDocument).where(LegalDocument.is_active == True)
    
    if document_type:
        try:
            doc_type_enum = LegalDocumentType(document_type)
            query = query.where(LegalDocument.document_type == doc_type_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid document type: {document_type}"
            )
    
    query = query.order_by(LegalDocument.display_order, LegalDocument.title)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return [
        {
            "id": doc.id,
            "documentType": doc.document_type.value,
            "title": doc.title,
            "content": doc.content,
            "shortDescription": doc.short_description,
            "slug": doc.slug,
            "version": doc.version,
            "effectiveDate": doc.effective_date,
            "displayOrder": doc.display_order
        }
        for doc in documents
    ]


@router.get(
    "/legal/documents/{slug}",
    summary="Get legal document by slug",
    description="Retrieve a specific legal document by its slug"
)
async def get_legal_document_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific legal document by slug.
    
    **Public endpoint** - No authentication required.
    
    Common slugs:
    - terms-and-conditions
    - privacy-policy
    - warranty
    - returns-policy
    - shipping-policy
    """
    logger.info(f"Fetching legal document: {slug}")
    
    result = await db.execute(
        select(LegalDocument).where(
            LegalDocument.slug == slug,
            LegalDocument.is_active == True
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail=f"Legal document '{slug}' not found"
        )
    
    return {
        "id": document.id,
        "documentType": document.document_type.value,
        "title": document.title,
        "content": document.content,
        "shortDescription": document.short_description,
        "slug": document.slug,
        "version": document.version,
        "effectiveDate": document.effective_date,
        "metaTitle": document.meta_title,
        "metaDescription": document.meta_description
    }


@router.get(
    "/legal/documents/type/{document_type}",
    summary="Get legal document by type",
    description="Retrieve a specific legal document by its type"
)
async def get_legal_document_by_type(
    document_type: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific legal document by type.
    
    **Public endpoint** - No authentication required.
    
    Document types:
    - price_list, dimensions_sizes, orders, com_col_orders, minimum_order
    - payments, terms, taxes, legal_costs, quotations
    - warranty, flammability, custom_finishes
    - partial_shipments, storage, returns, cancellations
    - maintenance, special_service, shipments_damage
    - freight_classification, ip_disclaimer, ip_assignment
    - conditions_of_sale, privacy_policy
    """
    logger.info(f"Fetching legal document by type: {document_type}")
    
    try:
        doc_type_enum = LegalDocumentType(document_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type: {document_type}. Must be one of: {', '.join([t.value for t in LegalDocumentType])}"
        )
    
    result = await db.execute(
        select(LegalDocument).where(
            LegalDocument.document_type == doc_type_enum,
            LegalDocument.is_active == True
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail=f"Legal document of type '{document_type}' not found"
        )
    
    return {
        "id": document.id,
        "documentType": document.document_type.value,
        "title": document.title,
        "content": document.content,
        "shortDescription": document.short_description,
        "slug": document.slug,
        "version": document.version,
        "effectiveDate": document.effective_date,
        "metaTitle": document.meta_title,
        "metaDescription": document.meta_description
    }


# ============================================================================
# Warranties
# ============================================================================

@router.get(
    "/legal/warranties",
    summary="Get all warranties",
    description="Retrieve all active warranty information"
)
async def get_warranties(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active warranties.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching warranties")
    
    result = await db.execute(
        select(WarrantyInformation)
        .where(WarrantyInformation.is_active == True)
        .order_by(WarrantyInformation.display_order, WarrantyInformation.id)
    )
    warranties = result.scalars().all()
    
    return [
        {
            "id": warranty.id,
            "warrantyType": warranty.warranty_type,
            "title": warranty.title,
            "description": warranty.description,
            "duration": warranty.duration,
            "coverage": warranty.coverage,
            "exclusions": warranty.exclusions,
            "claimProcess": warranty.claim_process,
            "displayOrder": warranty.display_order
        }
        for warranty in warranties
    ]


@router.get(
    "/legal/warranties/{warranty_id}",
    summary="Get warranty by ID",
    description="Retrieve a specific warranty by ID"
)
async def get_warranty(
    warranty_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific warranty by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching warranty {warranty_id}")
    
    result = await db.execute(
        select(WarrantyInformation).where(
            WarrantyInformation.id == warranty_id,
            WarrantyInformation.is_active == True
        )
    )
    warranty = result.scalar_one_or_none()
    
    if not warranty:
        raise HTTPException(status_code=404, detail=f"Warranty {warranty_id} not found")
    
    return {
        "id": warranty.id,
        "warrantyType": warranty.warranty_type,
        "title": warranty.title,
        "description": warranty.description,
        "duration": warranty.duration,
        "coverage": warranty.coverage,
        "exclusions": warranty.exclusions,
        "claimProcess": warranty.claim_process,
        "displayOrder": warranty.display_order
    }


# ============================================================================
# Shipping Policies
# ============================================================================

@router.get(
    "/legal/shipping-policies",
    summary="Get all shipping policies",
    description="Retrieve all active shipping policies"
)
async def get_shipping_policies(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active shipping policies.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching shipping policies")
    
    result = await db.execute(
        select(ShippingPolicy).where(ShippingPolicy.is_active == True)
    )
    policies = result.scalars().all()
    
    return [
        {
            "id": policy.id,
            "policyName": policy.policy_name,
            "description": policy.description,
            "freightClassification": policy.freight_classification,
            "shippingTimeframe": policy.shipping_timeframe,
            "specialInstructions": policy.special_instructions,
            "damageClaimProcess": policy.damage_claim_process
        }
        for policy in policies
    ]


@router.get(
    "/legal/shipping-policies/{policy_id}",
    summary="Get shipping policy by ID",
    description="Retrieve a specific shipping policy by ID"
)
async def get_shipping_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific shipping policy by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching shipping policy {policy_id}")
    
    result = await db.execute(
        select(ShippingPolicy).where(ShippingPolicy.id == policy_id)
    )
    policy = result.scalar_one_or_none()
    
    if not policy:
        raise HTTPException(status_code=404, detail=f"Shipping policy {policy_id} not found")
    
    return {
        "id": policy.id,
        "policyName": policy.policy_name,
        "description": policy.description,
        "freightClassification": policy.freight_classification,
        "shippingTimeframe": policy.shipping_timeframe,
        "specialInstructions": policy.special_instructions,
        "damageClaimProcess": policy.damage_claim_process
    }

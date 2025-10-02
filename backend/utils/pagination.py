"""
Pagination utilities
"""

import logging
from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

T = TypeVar('T')


class PaginationParams(BaseModel):
    """
    Pagination parameters for API requests
    """
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    per_page: int = Field(default=20, ge=1, le=100, description="Items per page")
    
    @property
    def offset(self) -> int:
        """Calculate offset for SQL query"""
        return (self.page - 1) * self.per_page
    
    @property
    def limit(self) -> int:
        """Get limit for SQL query"""
        return self.per_page


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic paginated response
    """
    items: List[T]
    total: int
    page: int
    per_page: int
    total_pages: int
    has_next: bool
    has_prev: bool
    
    class Config:
        from_attributes = True


async def paginate(
    db: AsyncSession,
    query,
    pagination: PaginationParams,
    model_class: type = None
) -> dict:
    """
    Paginate a SQLAlchemy query
    
    Args:
        db: Database session
        query: SQLAlchemy select query
        pagination: Pagination parameters
        model_class: Optional model class for response
        
    Returns:
        Dictionary with pagination data
        
    Example:
        query = select(Product).where(Product.is_active == True)
        result = await paginate(db, query, PaginationParams(page=1, per_page=20))
    """
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    
    # Apply pagination
    paginated_query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(paginated_query)
    items = result.scalars().all()
    
    # Calculate pagination metadata
    total_pages = (total + pagination.per_page - 1) // pagination.per_page
    has_next = pagination.page < total_pages
    has_prev = pagination.page > 1
    
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": total_pages,
        "has_next": has_next,
        "has_prev": has_prev
    }


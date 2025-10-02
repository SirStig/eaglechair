"""
EagleChair API v1 Routes

All API v1 endpoint definitions
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from backend.database.base import get_db
from backend.models.user import User
from backend.models.product import Product
from backend.api.v1 import schemas
from backend.core.security import security_manager, get_current_token, require_token_type
from backend.core.middleware import limiter
from backend.core.config import settings


# Create router
router = APIRouter()


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@router.get(
    "/health",
    response_model=schemas.HealthCheckResponse,
    tags=["System"]
)
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint for monitoring
    """
    # Check database connection
    try:
        await db.execute(select(1))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": db_status,
        "cache": "connected",  # TODO: Add Redis check when implemented
    }


# ============================================================================
# Authentication Endpoints
# ============================================================================

@router.post(
    "/auth/register",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"]
)
@limiter.limit("5/minute")
async def register(
    user_data: schemas.UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user
    """
    # Check if user already exists
    result = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists"
        )
    
    # Create new user
    hashed_password = security_manager.hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.post(
    "/auth/login",
    response_model=schemas.TokenResponse,
    tags=["Authentication"]
)
@limiter.limit("10/minute")
async def login(
    login_data: schemas.LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login and receive JWT tokens
    """
    # Find user
    result = await db.execute(
        select(User).where(User.email == login_data.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not security_manager.verify_password(
        login_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Create tokens
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = security_manager.create_access_token(token_data)
    refresh_token = security_manager.create_refresh_token(token_data)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post(
    "/auth/refresh",
    response_model=schemas.TokenResponse,
    tags=["Authentication"]
)
async def refresh_token(
    token_data: dict = Depends(require_token_type("refresh")),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token
    """
    user_id = int(token_data.get("sub"))
    
    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or user inactive"
        )
    
    # Create new tokens
    new_token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = security_manager.create_access_token(new_token_data)
    refresh_token = security_manager.create_refresh_token(new_token_data)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# ============================================================================
# User Endpoints
# ============================================================================

@router.get(
    "/users/me",
    response_model=schemas.UserResponse,
    tags=["Users"]
)
async def get_current_user(
    token_data: dict = Depends(get_current_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current authenticated user profile
    """
    user_id = int(token_data.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.patch(
    "/users/me",
    response_model=schemas.UserResponse,
    tags=["Users"]
)
async def update_current_user(
    user_update: schemas.UserUpdate,
    token_data: dict = Depends(get_current_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user profile
    """
    user_id = int(token_data.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return user


# ============================================================================
# Product Endpoints
# ============================================================================

@router.get(
    "/products",
    response_model=schemas.ProductListResponse,
    tags=["Products"]
)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List products with pagination and filtering
    """
    # Build query
    query = select(Product).where(Product.is_available == True)
    
    # Apply filters
    if category:
        query = query.where(Product.category == category)
    
    if search:
        query = query.where(
            Product.name.ilike(f"%{search}%") |
            Product.description.ilike(f"%{search}%")
        )
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    products = result.scalars().all()
    
    return {
        "items": products,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get(
    "/products/{product_id}",
    response_model=schemas.ProductResponse,
    tags=["Products"]
)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get product by ID
    """
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Increment view count
    product.view_count += 1
    await db.commit()
    await db.refresh(product)
    
    return product


@router.post(
    "/products",
    response_model=schemas.ProductResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Products"]
)
async def create_product(
    product_data: schemas.ProductCreate,
    token_data: dict = Depends(get_current_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product (Admin only)
    """
    # Check if user is admin
    if token_data.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Check if SKU already exists
    result = await db.execute(
        select(Product).where(Product.sku == product_data.sku)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product with this SKU already exists"
        )
    
    # Create product
    new_product = Product(**product_data.model_dump())
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    
    return new_product


@router.patch(
    "/products/{product_id}",
    response_model=schemas.ProductResponse,
    tags=["Products"]
)
async def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    token_data: dict = Depends(get_current_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Update product (Admin only)
    """
    # Check if user is admin
    if token_data.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Find product
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Update fields
    update_data = product_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    
    return product


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Products"]
)
async def delete_product(
    product_id: int,
    token_data: dict = Depends(get_current_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete product (Admin only)
    """
    # Check if user is admin
    if token_data.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Find product
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    await db.delete(product)
    await db.commit()


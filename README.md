# 🪑 EagleChair - Premium Chair Company

A modern, production-ready full-stack application for a premium chair company, featuring a **FastAPI** backend and a frontend (to be developed).

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

## ✨ Features

### Backend Features

- **🔐 Security First**
  - JWT-based authentication with access and refresh tokens
  - Password hashing with bcrypt
  - Rate limiting to prevent abuse
  - Security headers (CSP, HSTS, XSS protection)
  - HTTPS redirect for production

- **⚡ High Performance**
  - Async SQLAlchemy with PostgreSQL
  - Redis caching support
  - GZip compression
  - Connection pooling
  - Non-blocking I/O

- **🔄 Versioned APIs**
  - API versioning (v1, v2, etc.)
  - Backward compatibility
  - Versioned Pydantic schemas

- **🧪 Testing**
  - Comprehensive test suite with pytest
  - Async test support
  - Factory pattern for test data
  - Code coverage reporting

- **🔍 Advanced Features**
  - Fuzzy search for products
  - Pagination and filtering
  - Middleware for logging, CORS, security
  - Database migrations with Alembic

## 🛠️ Tech Stack

### Backend

- **Framework**: FastAPI 0.118.0
- **Database**: PostgreSQL with async SQLAlchemy
- **Caching**: Redis
- **Authentication**: JWT (python-jose)
- **Password Hashing**: bcrypt (passlib)
- **Testing**: pytest, pytest-asyncio, httpx
- **Migrations**: Alembic
- **Rate Limiting**: SlowAPI
- **Validation**: Pydantic v2

### Frontend (Coming Soon)

- React / Next.js
- TypeScript
- Tailwind CSS

## 📁 Project Structure

```
eaglechair/
├── backend/                    # Backend application
│   ├── alembic/               # Database migrations
│   │   ├── versions/          # Migration versions
│   │   ├── env.py            # Alembic environment
│   │   └── script.py.mako    # Migration template
│   ├── api/                   # API routes
│   │   └── v1/               # API version 1
│   │       ├── routes.py     # All v1 endpoints
│   │       └── schemas.py    # Pydantic schemas
│   ├── core/                  # Core functionality
│   │   ├── config.py         # Settings management
│   │   ├── security.py       # Auth & security
│   │   └── middleware.py     # Custom middleware
│   ├── database/              # Database configuration
│   │   └── base.py           # Async SQLAlchemy setup
│   ├── models/                # SQLAlchemy models
│   │   ├── user.py           # User model
│   │   └── product.py        # Product model
│   ├── services/              # Business logic
│   ├── main.py                # Application entry point
│   └── run.py                 # Development server runner
├── tests/                     # Test suite
│   ├── conftest.py           # Pytest fixtures
│   ├── test_auth.py          # Authentication tests
│   └── test_products.py      # Product tests
├── venv/                      # Virtual environment
├── alembic.ini               # Alembic configuration
├── pytest.ini                # Pytest configuration
├── requirements.txt          # Python dependencies
├── env.example               # Environment variables template
└── README.md                 # This file
```

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- PostgreSQL 14+
- Redis (optional, for caching)
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/eaglechair.git
cd eaglechair
```

2. **Set up virtual environment**

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Set up environment variables**

```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your configuration
# Important: Update DATABASE_URL, SECRET_KEY, etc.
```

5. **Set up PostgreSQL database**

```bash
# Create database
createdb eaglechair

# For testing
createdb eaglechair_test
```

6. **Run database migrations**

```bash
alembic upgrade head
```

7. **Start the development server**

```bash
# Option 1: Using the run script
python backend/run.py

# Option 2: Using uvicorn directly
uvicorn backend.main:app --reload --port 8000
```

8. **Access the application**

- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 💻 Development

### Running the Backend

```bash
# Development mode with hot reload
python backend/run.py

# Or with uvicorn
uvicorn backend.main:app --reload
```

### Creating Database Migrations

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Code Quality

```bash
# Format code (if you install black)
black backend/

# Lint code (if you install ruff)
ruff backend/

# Type checking (if you install mypy)
mypy backend/
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=backend --cov-report=html

# Run specific test file
pytest tests/test_auth.py

# Run specific test
pytest tests/test_auth.py::TestAuthentication::test_login_success

# Run with verbose output
pytest -v

# Run only fast tests (exclude slow ones)
pytest -m "not slow"
```

### Test Coverage

After running tests with coverage, open `htmlcov/index.html` in your browser to view the detailed coverage report.

## 📚 API Documentation

### Interactive API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### API Endpoints Overview

#### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token

#### Users

- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update user profile

#### Products

- `GET /api/v1/products` - List products (with pagination, search, filters)
- `GET /api/v1/products/{id}` - Get product by ID
- `POST /api/v1/products` - Create product (Admin only)
- `PATCH /api/v1/products/{id}` - Update product (Admin only)
- `DELETE /api/v1/products/{id}` - Delete product (Admin only)

#### System

- `GET /api/v1/health` - Health check

## 🚢 Deployment

### DreamHost Deployment

1. **Prepare your application**

```bash
# Ensure all environment variables are set in .env
# Set DEBUG=False for production
# Set proper CORS_ORIGINS
```

2. **Database Setup**

- Create a PostgreSQL database on DreamHost
- Update `DATABASE_URL` in your `.env` file
- Run migrations: `alembic upgrade head`

3. **HTTPS Configuration**

The application is configured to:
- Redirect HTTP to HTTPS in production
- Add security headers
- Support SSL termination

4. **Using Gunicorn (WSGI server)**

```bash
# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

5. **Environment Variables**

Ensure all production environment variables are set:
- `DATABASE_URL` (PostgreSQL connection string)
- `SECRET_KEY` (generate with `openssl rand -hex 32`)
- `CORS_ORIGINS` (your frontend domain)
- `DEBUG=False`
- `HTTPS_REDIRECT=True`

### Docker Deployment (Alternative)

```dockerfile
# Dockerfile example
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🔐 Environment Variables

Key environment variables (see `env.example` for full list):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `SECRET_KEY` | JWT secret key | - |
| `DEBUG` | Debug mode | `True` |
| `CORS_ORIGINS` | Allowed CORS origins | `["http://localhost:3000"]` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `RATE_LIMIT_PER_MINUTE` | API rate limit | `60` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- FastAPI for the amazing framework
- SQLAlchemy for database ORM
- Pydantic for data validation
- All open-source contributors

---

Built with ❤️ using FastAPI, PostgreSQL, and modern best practices.


from backend.core.config import settings


def get_api_docs_html():
    """
    Returns the HTML content for the API documentation page.
    """
    return f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>{settings.APP_NAME}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }}
                
                .container {{
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    max-width: 800px;
                    width: 100%;
                    padding: 40px;
                }}
                
                .header {{
                    text-align: center;
                    margin-bottom: 40px;
                }}
                
                .logo {{
                    font-size: 4rem;
                    margin-bottom: 10px;
                }}
                
                h1 {{
                    color: #1a202c;
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                }}
                
                .subtitle {{
                    color: #718096;
                    font-size: 1.1rem;
                }}
                
                .version {{
                    display: inline-block;
                    background: #667eea;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    margin: 10px 0;
                }}
                
                .features {{
                    background: #f7fafc;
                    border-radius: 10px;
                    padding: 30px;
                    margin: 30px 0;
                }}
                
                .features h2 {{
                    color: #2d3748;
                    margin-bottom: 20px;
                    font-size: 1.5rem;
                }}
                
                .feature-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }}
                
                .feature-item {{
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                }}
                
                .feature-item strong {{
                    color: #2d3748;
                    display: block;
                    margin-bottom: 5px;
                }}
                
                .feature-item span {{
                    color: #718096;
                    font-size: 0.9rem;
                }}
                
                .links {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 30px;
                }}
                
                .link-card {{
                    display: block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    transition: transform 0.2s, box-shadow 0.2s;
                }}
                
                .link-card:hover {{
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
                }}
                
                .link-card .icon {{
                    font-size: 2rem;
                    margin-bottom: 10px;
                }}
                
                .link-card .title {{
                    font-weight: bold;
                    font-size: 1.1rem;
                    margin-bottom: 5px;
                }}
                
                .link-card .desc {{
                    font-size: 0.9rem;
                    opacity: 0.9;
                }}
                
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #718096;
                    font-size: 0.9rem;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🪑</div>
                    <h1>EagleChair API</h1>
                    <p class="subtitle">Premium Chair Company Backend</p>
                    <span class="version">v{settings.APP_VERSION}</span>
                </div>
                
                <div class="features">
                    <h2>🚀 Features</h2>
                    <div class="feature-grid">
                        <div class="feature-item">
                            <strong>🔐 Security</strong>
                            <span>JWT, HTTPS, Rate Limiting</span>
                        </div>
                        <div class="feature-item">
                            <strong>⚡ Performance</strong>
                            <span>Async, Caching, Compression</span>
                        </div>
                        <div class="feature-item">
                            <strong>🔄 Versioned APIs</strong>
                            <span>v1, v2 Support</span>
                        </div>
                        <div class="feature-item">
                            <strong>🧪 Tested</strong>
                            <span>Pytest, Factories, Coverage</span>
                        </div>
                        <div class="feature-item">
                            <strong>🗄️ PostgreSQL</strong>
                            <span>Async SQLAlchemy</span>
                        </div>
                        <div class="feature-item">
                            <strong>🔍 Fuzzy Search</strong>
                            <span>Advanced Product Search</span>
                        </div>
                    </div>
                </div>
                
                <div class="links">
                    <a href="/docs" class="link-card">
                        <div class="icon">📚</div>
                        <div class="title">API Documentation</div>
                        <div class="desc">Swagger UI</div>
                    </a>
                    <a href="/redoc" class="link-card">
                        <div class="icon">📖</div>
                        <div class="title">ReDoc</div>
                        <div class="desc">Alternative Docs</div>
                    </a>
                    <a href="{settings.API_V1_PREFIX}/health" class="link-card">
                        <div class="icon">💚</div>
                        <div class="title">Health Check</div>
                        <div class="desc">System Status</div>
                    </a>
                </div>
                
                <div class="footer">
                    <p>Built with FastAPI, PostgreSQL, and ❤️</p>
                    <p>Mode: {"🔧 Development" if settings.DEBUG else "🚀 Production"}</p>
                </div>
            </div>
        </body>
    </html>
    """

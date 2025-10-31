#!/usr/bin/env python3
"""
Export API Documentation to PDF or HTML

This script exports your FastAPI OpenAPI documentation to various formats:
- PDF (using redoc-cli or weasyprint)
- HTML (standalone ReDoc HTML)
- Markdown (using openapi-markdown or similar)

Usage:
    python backend/scripts/export_api_docs.py --format pdf --output docs/api-documentation.pdf
    python backend/scripts/export_api_docs.py --format html --output docs/api-documentation.html
    python backend/scripts/export_api_docs.py --format markdown --output docs/api-documentation.md
"""

import argparse
import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path to import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.main import app
from backend.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_openapi_schema() -> dict:
    """
    Get the OpenAPI schema from the FastAPI app
    
    Returns:
        dict: OpenAPI schema as JSON
    """
    return app.openapi()


def export_to_pdf_openapi_cli(openapi_spec: dict, output_path: Path) -> bool:
    """
    Export to PDF using redoc-cli (npm package)
    
    Args:
        openapi_spec: OpenAPI schema dict
        output_path: Path to save PDF
        
    Returns:
        bool: True if successful
    """
    try:
        # Check if redoc-cli is installed
        result = subprocess.run(
            ["npx", "--version"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            logger.warning("npx not found. Install Node.js to use redoc-cli")
            return False
        
        # Save OpenAPI spec to temp file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(openapi_spec, f, indent=2)
            temp_file = Path(f.name)
        
        try:
            # Use redoc-cli to generate PDF
            logger.info("Generating PDF with redoc-cli...")
            cmd = [
                "npx", "-y", "@redocly/cli",
                "build-docs", str(temp_file),
                "--output", str(output_path)
            ]
            
            # Try redoc-cli first
            result = subprocess.run(
                ["npx", "-y", "redoc-cli", "bundle", str(temp_file), "-o", str(output_path)],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                logger.info(f"✅ PDF generated successfully: {output_path}")
                return True
            else:
                logger.warning(f"redoc-cli failed: {result.stderr}")
                
        finally:
            # Clean up temp file
            if temp_file.exists():
                temp_file.unlink()
                
    except FileNotFoundError:
        logger.warning("Node.js/npx not found. Install Node.js to use redoc-cli")
    except Exception as e:
        logger.error(f"Error using redoc-cli: {e}")
    
    return False


def export_to_pdf_weasyprint(openapi_spec: dict, output_path: Path) -> bool:
    """
    Export to PDF using weasyprint (Python library)
    
    Args:
        openapi_spec: OpenAPI schema dict
        output_path: Path to save PDF
        
    Returns:
        bool: True if successful
    """
    try:
        import weasyprint
        
        # First generate HTML
        html_content = generate_redoc_html(openapi_spec)
        
        # Convert HTML to PDF
        logger.info("Converting HTML to PDF with weasyprint...")
        weasyprint.HTML(string=html_content).write_pdf(output_path)
        logger.info(f"✅ PDF generated successfully: {output_path}")
        return True
        
    except ImportError:
        logger.warning("weasyprint not installed. Install with: pip install weasyprint")
        return False
    except Exception as e:
        logger.error(f"Error using weasyprint: {e}")
        return False


def export_to_pdf_playwright(openapi_spec: dict, output_path: Path) -> bool:
    """
    Export to PDF using Playwright (headless browser)
    
    Args:
        openapi_spec: OpenAPI schema dict
        output_path: Path to save PDF
        
    Returns:
        bool: True if successful
    """
    try:
        from playwright.sync_api import sync_playwright
        
        html_content = generate_redoc_html(openapi_spec)
        
        # Save temporary HTML file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
            f.write(html_content)
            temp_html = Path(f.name)
        
        try:
            logger.info("Generating PDF with Playwright...")
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.goto(f"file://{temp_html.absolute()}")
                # Wait for ReDoc to render
                page.wait_for_timeout(2000)
                page.pdf(path=str(output_path), format='A4', print_background=True)
                browser.close()
            
            logger.info(f"✅ PDF generated successfully: {output_path}")
            return True
            
        finally:
            if temp_html.exists():
                temp_html.unlink()
                
    except ImportError:
        logger.warning("playwright not installed. Install with: pip install playwright && playwright install chromium")
        return False
    except Exception as e:
        logger.error(f"Error using Playwright: {e}")
        return False


def generate_redoc_html(openapi_spec: dict) -> str:
    """
    Generate standalone HTML with ReDoc embedded
    
    Args:
        openapi_spec: OpenAPI schema dict
        
    Returns:
        str: HTML content
    """
    import base64
    spec_json = json.dumps(openapi_spec, indent=2)
    # Base64 encode for safe embedding
    spec_json_b64 = base64.b64encode(spec_json.encode('utf-8')).decode('utf-8')
    
    html_template = f"""<!DOCTYPE html>
<html>
<head>
    <title>{settings.APP_NAME} API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body {{
            margin: 0;
            padding: 0;
        }}
    </style>
</head>
<body>
    <div id="redoc-container"></div>
    <script>
        // Decode and parse OpenAPI spec from base64
        const specJson = atob('{spec_json_b64}');
        const spec = JSON.parse(specJson);
    </script>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
        Redoc.init(spec, {{
            scrollYOffset: 0,
            hideHostname: false,
            pathInMiddlePanel: true
        }}, document.getElementById('redoc-container'));
    </script>
</body>
</html>"""
    
    return html_template


def export_to_html(openapi_spec: dict, output_path: Path) -> bool:
    """
    Export to standalone HTML file with ReDoc
    
    Args:
        openapi_spec: OpenAPI schema dict
        output_path: Path to save HTML
        
    Returns:
        bool: True if successful
    """
    try:
        html_content = generate_redoc_html(openapi_spec)
        output_path.write_text(html_content, encoding='utf-8')
        logger.info(f"✅ HTML generated successfully: {output_path}")
        logger.info(f"   Open {output_path} in a browser to view the documentation")
        return True
    except Exception as e:
        logger.error(f"Error generating HTML: {e}")
        return False


def export_to_markdown(openapi_spec: dict, output_path: Path) -> bool:
    """
    Export to Markdown format
    
    Args:
        openapi_spec: OpenAPI schema dict
        output_path: Path to save Markdown
        
    Returns:
        bool: True if successful
    """
    try:
        # Try using openapi-markdown library
        import openapi_markdown
        
        md_content = openapi_markdown.convert(openapi_spec)
        output_path.write_text(md_content, encoding='utf-8')
        logger.info(f"✅ Markdown generated successfully: {output_path}")
        return True
        
    except ImportError:
        logger.warning("openapi-markdown not installed. Install with: pip install openapi-markdown")
        
        # Fallback: generate a basic markdown representation
        logger.info("Generating basic Markdown from OpenAPI spec...")
        md_lines = [
            f"# {settings.APP_NAME} API Documentation",
            f"\n**Version:** {settings.APP_VERSION}",
            f"\n**Description:** {settings.APP_DESCRIPTION}",
            "\n## Endpoints\n"
        ]
        
        if 'paths' in openapi_spec:
            for path, methods in openapi_spec['paths'].items():
                md_lines.append(f"### {path}\n")
                for method, details in methods.items():
                    if isinstance(details, dict):
                        summary = details.get('summary', '')
                        description = details.get('description', '')
                        md_lines.append(f"**{method.upper()}** {path}")
                        if summary:
                            md_lines.append(f"\n*{summary}*")
                        if description:
                            md_lines.append(f"\n{description}\n")
        
        output_path.write_text('\n'.join(md_lines), encoding='utf-8')
        logger.info(f"✅ Basic Markdown generated: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error generating Markdown: {e}")
        return False


def export_to_json(openapi_spec: dict, output_path: Path) -> bool:
    """
    Export OpenAPI spec as JSON
    
    Args:
        openapi_spec: OpenAPI schema dict
        output_path: Path to save JSON
        
    Returns:
        bool: True if successful
    """
    try:
        output_path.write_text(
            json.dumps(openapi_spec, indent=2),
            encoding='utf-8'
        )
        logger.info(f"✅ JSON exported successfully: {output_path}")
        return True
    except Exception as e:
        logger.error(f"Error exporting JSON: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Export FastAPI OpenAPI documentation to various formats"
    )
    parser.add_argument(
        "--format",
        "-f",
        choices=["pdf", "html", "markdown", "json"],
        default="html",
        help="Output format (default: html)"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        help="Output file path (default: docs/api-docs.{format})"
    )
    
    args = parser.parse_args()
    
    # Determine output path
    if args.output is None:
        docs_dir = Path(__file__).parent.parent.parent / "docs"
        docs_dir.mkdir(exist_ok=True)
        args.output = docs_dir / f"api-docs.{args.format}"
    
    # Ensure output directory exists
    args.output.parent.mkdir(parents=True, exist_ok=True)
    
    # Get OpenAPI schema
    logger.info("Generating OpenAPI schema...")
    openapi_spec = get_openapi_schema()
    logger.info(f"✅ OpenAPI schema generated ({len(str(openapi_spec))} characters)")
    
    # Export based on format
    success = False
    if args.format == "pdf":
        # Try multiple methods
        logger.info("Attempting to generate PDF...")
        if export_to_pdf_openapi_cli(openapi_spec, args.output):
            success = True
        elif export_to_pdf_weasyprint(openapi_spec, args.output):
            success = True
        elif export_to_pdf_playwright(openapi_spec, args.output):
            success = True
        else:
            logger.error("❌ Could not generate PDF. Install one of:")
            logger.error("   1. Node.js + redoc-cli: npm install -g redoc-cli")
            logger.error("   2. weasyprint: pip install weasyprint")
            logger.error("   3. playwright: pip install playwright && playwright install chromium")
            logger.info("\n💡 Alternative: Generate HTML first, then use browser 'Print to PDF'")
            logger.info(f"   Run: python {sys.argv[0]} --format html -o {args.output.with_suffix('.html')}")
            
    elif args.format == "html":
        success = export_to_html(openapi_spec, args.output)
        
    elif args.format == "markdown":
        success = export_to_markdown(openapi_spec, args.output)
        
    elif args.format == "json":
        success = export_to_json(openapi_spec, args.output)
    
    if success:
        logger.info(f"\n✨ Documentation exported to: {args.output.absolute()}")
        sys.exit(0)
    else:
        logger.error("❌ Failed to export documentation")
        sys.exit(1)


if __name__ == "__main__":
    main()


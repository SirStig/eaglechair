#!/usr/bin/env python3
"""
Test Runner Script

Convenient script to run different types of tests
"""

import subprocess
import sys
import argparse


def run_command(cmd):
    """Run a command and return the result."""
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit code {e.returncode}")
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Run tests for EagleChair")
    parser.add_argument(
        "--type",
        choices=["unit", "integration", "all", "coverage"],
        default="all",
        help="Type of tests to run"
    )
    parser.add_argument(
        "--markers",
        nargs="+",
        help="Specific test markers to run (e.g., auth products admin)"
    )
    parser.add_argument(
        "--file",
        help="Specific test file to run"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Run tests in parallel (requires pytest-xdist)"
    )
    
    args = parser.parse_args()
    
    # Base pytest command
    cmd_parts = ["python", "-m", "pytest"]
    
    # Add verbosity
    if args.verbose:
        cmd_parts.append("-vv")
    
    # Add parallel execution
    if args.parallel:
        cmd_parts.extend(["-n", "auto"])
    
    # Add test type or markers
    if args.type == "unit":
        cmd_parts.extend(["-m", "unit"])
    elif args.type == "integration":
        cmd_parts.extend(["-m", "integration"])
    elif args.type == "coverage":
        cmd_parts.extend([
            "--cov=backend",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--cov-fail-under=80"
        ])
    
    # Add specific markers
    if args.markers:
        cmd_parts.extend(["-m", " or ".join(args.markers)])
    
    # Add specific file
    if args.file:
        cmd_parts.append(args.file)
    
    # Run the command
    cmd = " ".join(cmd_parts)
    print(f"Running: {cmd}")
    
    success = run_command(cmd)
    
    if not success:
        sys.exit(1)
    
    print("\n✅ All tests passed!")


if __name__ == "__main__":
    main()

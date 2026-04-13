"""CLI entry point for the GovOps demo.

Usage:
    govops-demo          # starts on http://127.0.0.1:8000
    govops-demo --port 9000
"""

from __future__ import annotations

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        description="GovOps - Policy-Driven Service Delivery Machine",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError:
        print("Error: uvicorn is required. Install with: pip install govops", file=sys.stderr)
        sys.exit(1)

    print()
    print("  GovOps - Policy-Driven Service Delivery Machine")
    print("  Pension Eligibility Case Study Demo")
    print()
    print(f"  Open http://{args.host}:{args.port} in your browser")
    print()
    print("  API docs:       http://{host}:{port}/docs".format(host=args.host, port=args.port))
    print("  Authority chain: http://{host}:{port}/authority".format(host=args.host, port=args.port))
    print()

    uvicorn.run(
        "govops.api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()

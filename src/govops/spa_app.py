"""Entry point for the v2.1 hosted-demo deploy.

Imports the FastAPI app from `govops.api` and mounts the built SPA on
top of it. The Dockerfile runs `uvicorn govops.spa_app:app` so the demo
is one process; local dev keeps using `govops.api:app` directly with
the SPA served on its own port (`vite dev` on :8080 per
CONTRIBUTING.md).
"""

from govops.api import app
from govops.spa import mount_spa

mount_spa(app)

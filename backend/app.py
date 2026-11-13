"""GridWatch Main Application Entry Point."""

import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from .db.store import init_db
from .api.routes import api_bp
from .simulation.clock import start_ticker_thread

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))


def create_app(test_config=None) -> Flask:
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialize SQLite database
    init_db()

    # Register API blueprint
    app.register_blueprint(api_bp, url_prefix="/api")

    # Start simulation background thread
    start_ticker_thread()

    # Serve React SPA frontend
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        elif os.path.exists(os.path.join(app.static_folder, "index.html")):
            return send_from_directory(app.static_folder, "index.html")
        else:
            return jsonify({
                "app": "GridWatch: Smart Meter Anomaly Reporter",
                "status": "online",
                "backend": "Flask + SQLite",
                "api_docs": "/api/state",
                "frontend_status": "Frontend not yet built. Run npm run build in /frontend."
            })

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)

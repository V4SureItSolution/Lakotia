import os
from flask import Flask, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from config import Config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ✅ Enable CORS (allow frontend communication)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # ✅ Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # ==================================================
    # ✅ SERVE UPLOADED FILES (FIX FOR IMAGE 404)
    # ==================================================
    UPLOAD_ROOT = os.path.join(os.getcwd(), "uploads")

    @app.route("/uploads/<path:filename>")
    def serve_uploads(filename):
        return send_from_directory(UPLOAD_ROOT, filename)

    # ==================================================
    # ✅ Register blueprints
    # ==================================================
    from app.routes.login_routes import auth_bp
    from app.routes.usertype_routes import user_type_bp
    from app.routes.designation_routes import designation_bp
    from app.routes.department_routes import department_bp
    from app.routes.employee_routes import employee_bp
    from app.routes.company_routes import company_bp
    from app.routes.visitreport_routes import visitreport_bp
    from app.routes.attendance_routes import attendance_bp
    from app.routes.task_routes import task_bp
    from app.routes.attendance_summary_routes import attendance_summary_bp
    from app.routes.IndustrialSegmentation_routes import industrial_bp
    from app.routes.advance_routes import advance_bp
    from app.routes.setting_routes import settings_bp
    from app.routes.access_control_routes import access_bp
    from app.routes.holiday_routes import holiday_bp
    from app.routes.noesipf_routes import noesi_bp
    from app.routes.stock_routes import stock_bp
    from app.routes.casual_routes import casual_bp
    from app.routes.esi_routes import esipf_bp
    from app.routes.grn_routes import grn_bp
    from app.routes.stocksold_routes import stock_sold_bp
    from app.routes.mrpchange_routes import mrp_bp
    from app.routes.quotation_routes import quotation_bp
    from app.routes.purchaseorder_routes import purchase_order_bp
    from app.routes.enquiry_routes import enquiry_bp
    from app.routes.dashboardsetter_routes import dashboardsetter_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_type_bp, url_prefix="/api")
    app.register_blueprint(designation_bp, url_prefix="/api")
    app.register_blueprint(department_bp, url_prefix="/api/department")
    app.register_blueprint(employee_bp, url_prefix="/api/employee")
    app.register_blueprint(company_bp, url_prefix="/api")
    app.register_blueprint(visitreport_bp)
    app.register_blueprint(task_bp)
    app.register_blueprint(industrial_bp)
    app.register_blueprint(advance_bp)
    app.register_blueprint(access_bp, url_prefix="/api")
    app.register_blueprint(holiday_bp)
    app.register_blueprint(noesi_bp)
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(attendance_bp, url_prefix="/api")
    app.register_blueprint(attendance_summary_bp)
    app.register_blueprint(stock_bp)
    app.register_blueprint(casual_bp)
    app.register_blueprint(esipf_bp)
    app.register_blueprint(grn_bp, url_prefix="/api/grn/")
    app.register_blueprint(stock_sold_bp)
    app.register_blueprint(mrp_bp)
    app.register_blueprint(quotation_bp)
    app.register_blueprint(dashboardsetter_bp)
    app.register_blueprint(purchase_order_bp, url_prefix="/api/purchase-orders")
    app.register_blueprint(enquiry_bp)

    # ==================================================
    # ✅ Health check
    # ==================================================
    @app.route("/api/ping")
    def ping():
        return jsonify({"success": True, "message": "pong"}), 200

    return app

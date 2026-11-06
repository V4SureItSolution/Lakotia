import os
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from app import db
from app.models.dashboardsetter import DashboardSetter

dashboardsetter_bp = Blueprint(
    "dashboardsetter",
    __name__,
    url_prefix="/api/dashboard-setter"
)

# =====================================================
# ✅ ABSOLUTE PATH (PROJECT ROOT SAFE)
# =====================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "dashboard")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("Dashboard images stored at:", UPLOAD_FOLDER)

# =====================================================
# HELPERS
# =====================================================
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# =====================================================
# POST – Upload New Image
# =====================================================
@dashboardsetter_bp.route("/upload", methods=["POST"])
def upload_dashboard_image():
    if "image" not in request.files:
        return jsonify({"message": "No image provided"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"message": "No selected file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"message": "Invalid file type"}), 400

    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))

    # ✅ Store ONLY filename
    image_record = DashboardSetter(image_path=filename)
    db.session.add(image_record)
    db.session.commit()

    return jsonify({
        "id": image_record.id,
        "filename": filename,
        "image_url": f"/uploads/dashboard/{filename}"
    }), 201


# =====================================================
# GET – Fetch Latest Image
# =====================================================
@dashboardsetter_bp.route("/latest", methods=["GET"])
def get_latest_dashboard_image():
    image = (
        DashboardSetter.query
        .order_by(DashboardSetter.created_at.desc())
        .first()
    )

    if not image:
        return jsonify({
            "success": False,
            "message": "No dashboard image found",
            "image_url": None
        }), 200

    return jsonify({
        "id": image.id,
        "image_path": image.image_path,  # filename only
        "image_url": f"/uploads/dashboard/{image.image_path}",
        "created_at": image.created_at.isoformat()
    }), 200


# =====================================================
# PUT – Replace Image
# =====================================================
@dashboardsetter_bp.route("/update/<int:image_id>", methods=["PUT"])
def update_dashboard_image(image_id):
    image = DashboardSetter.query.get(image_id)

    if not image:
        return jsonify({"message": "Image not found"}), 404

    if "image" not in request.files:
        return jsonify({"message": "No image provided"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"message": "No selected file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"message": "Invalid file type"}), 400

    # ✅ Delete old file safely
    if image.image_path:
        old_path = os.path.join(UPLOAD_FOLDER, image.image_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))

    image.image_path = filename
    db.session.commit()

    return jsonify({
        "message": "Dashboard image updated successfully",
        "filename": filename,
        "image_url": f"/uploads/dashboard/{filename}"
    }), 200


# =====================================================
# ✅ SERVE DASHBOARD IMAGES (THIS FIXES 404)
# =====================================================
@dashboardsetter_bp.route("/uploads/dashboard/<filename>", methods=["GET"])
def serve_dashboard_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

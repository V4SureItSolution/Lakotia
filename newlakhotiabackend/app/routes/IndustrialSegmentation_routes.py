from flask import Blueprint, request, jsonify
from app import db
from app.models.IndustrialSegmentation import IndustrialSegmentation
from sqlalchemy.exc import IntegrityError

industrial_bp = Blueprint("industrial_bp", __name__, url_prefix="/api/industrial_segmentation")

# ✅ 1. Add new industry segment
@industrial_bp.route("/add", methods=["POST"])
def add_segment():
    data = request.get_json()
    name = data.get("name")

    if not name:
        return jsonify({"error": "Name is required"}), 400

    new_segment = IndustrialSegmentation(name=name)

    try:
        db.session.add(new_segment)
        db.session.commit()
        return jsonify({"message": "Segment added successfully", "segment": new_segment.to_dict()}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Segment already exists"}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ✅ 2. Get all industry segments
@industrial_bp.route("/all", methods=["GET"])
def get_segments():
    segments = IndustrialSegmentation.query.order_by(IndustrialSegmentation.id.desc()).all()
    return jsonify([seg.to_dict() for seg in segments])


# ✅ 3. Update segment
@industrial_bp.route("/update/<int:id>", methods=["PUT"])
def update_segment(id):
    data = request.get_json()
    name = data.get("name")

    segment = IndustrialSegmentation.query.get(id)
    if not segment:
        return jsonify({"error": "Segment not found"}), 404

    if not name:
        return jsonify({"error": "Name is required"}), 400

    # Check if name already exists (duplicate prevention)
    existing = IndustrialSegmentation.query.filter(
        IndustrialSegmentation.name == name, IndustrialSegmentation.id != id
    ).first()
    if existing:
        return jsonify({"error": "Segment name already exists"}), 409

    try:
        segment.name = name
        db.session.commit()
        return jsonify({"message": "Segment updated successfully", "segment": segment.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ✅ 4. Delete segment
@industrial_bp.route("/delete/<int:id>", methods=["DELETE"])
def delete_segment(id):
    segment = IndustrialSegmentation.query.get(id)
    if not segment:
        return jsonify({"error": "Segment not found"}), 404

    try:
        db.session.delete(segment)
        db.session.commit()
        return jsonify({"message": "Segment deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

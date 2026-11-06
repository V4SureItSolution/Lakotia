from flask import Blueprint, jsonify, request
from app import db
from app.models.designation import Designation

designation_bp = Blueprint("designation_bp", __name__)

# Get all designations
@designation_bp.route("/designations", methods=["GET"])
def get_designations():
    designations = Designation.query.all()
    return jsonify([d.to_dict() for d in designations]), 200

# Add new designation
@designation_bp.route("/designations", methods=["POST"])
def add_designation():
    data = request.get_json()
    name = data.get("name")

    if not name:
        return jsonify({"error": "Name is required"}), 400

    if Designation.query.filter_by(name=name).first():
        return jsonify({"error": "Designation already exists"}), 400

    new_designation = Designation(name=name)
    db.session.add(new_designation)
    db.session.commit()
    return jsonify({"message": "Designation added successfully", "designation": new_designation.to_dict()}), 201

# Update designation
@designation_bp.route("/designations/<int:id>", methods=["PUT"])
def update_designation(id):
    data = request.get_json()
    name = data.get("name")

    designation = Designation.query.get(id)
    if not designation:
        return jsonify({"error": "Designation not found"}), 404

    if Designation.query.filter(Designation.name == name, Designation.id != id).first():
        return jsonify({"error": "Designation name already taken"}), 400

    designation.name = name
    db.session.commit()
    return jsonify({"message": "Designation updated successfully", "designation": designation.to_dict()}), 200

# Delete designation
@designation_bp.route("/designations/<int:id>", methods=["DELETE"])
def delete_designation(id):
    designation = Designation.query.get(id)
    if not designation:
        return jsonify({"error": "Designation not found"}), 404

    db.session.delete(designation)
    db.session.commit()
    return jsonify({"message": "Designation deleted successfully"}), 200

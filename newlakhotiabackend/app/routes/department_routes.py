from flask import Blueprint, jsonify, request
from app import db
from app.models.department import Department

department_bp = Blueprint("department_bp", __name__)

# ✅ Create Department
@department_bp.route("/add", methods=["POST"])
def add_department():
    data = request.get_json()
    name = data.get("name")

    if not name:
        return jsonify({"success": False, "message": "Department name is required"}), 400

    # Check duplicate
    if Department.query.filter_by(name=name).first():
        return jsonify({"success": False, "message": "Department already exists"}), 409

    new_department = Department(name=name)
    db.session.add(new_department)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Department added successfully",
        "department": new_department.to_dict()
    }), 201


# ✅ Get All Departments
@department_bp.route("/all", methods=["GET"])
def get_departments():
    departments = Department.query.order_by(Department.created_at.desc()).all()
    return jsonify([dept.to_dict() for dept in departments]), 200


# ✅ Get Single Department by ID
@department_bp.route("/<int:dept_id>", methods=["GET"])
def get_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({"success": False, "message": "Department not found"}), 404

    return jsonify(department.to_dict()), 200


# ✅ Update Department
@department_bp.route("/update/<int:dept_id>", methods=["PUT"])
def update_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({"success": False, "message": "Department not found"}), 404

    data = request.get_json()
    department.name = data.get("name", department.name)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Department updated successfully",
        "department": department.to_dict()
    }), 200


# ✅ Delete Department
@department_bp.route("/delete/<int:dept_id>", methods=["DELETE"])
def delete_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({"success": False, "message": "Department not found"}), 404

    db.session.delete(department)
    db.session.commit()

    return jsonify({"success": True, "message": "Department deleted successfully"}), 200

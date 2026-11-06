# routes/settings_routes.py
from flask import Blueprint, request, jsonify
from app import db
from app.models.module import Module
from app.models.permission import Permission
from app.models.usertype import UserType
from sqlalchemy.exc import IntegrityError

settings_bp = Blueprint("settings_bp", __name__, url_prefix="/api")

# ==============================================================
#                     MODULE CRUD OPERATIONS
# ==============================================================

@settings_bp.route("/modules", methods=["GET"])
def get_modules():
    modules = Module.query.all()
    return jsonify({
        "success": True,
        "data": [m.to_dict() for m in modules]
    }), 200


@settings_bp.route("/modules", methods=["POST"])
def create_module():
    data = request.get_json()
    name = data.get("name")

    if not name:
        return jsonify({"success": False, "error": "Module name is required"}), 400

    if Module.query.filter_by(name=name).first():
        return jsonify({"success": False, "error": "Module already exists"}), 400

    try:
        module = Module(name=name)
        db.session.add(module)
        db.session.commit()
        return jsonify({"success": True, "data": module.to_dict()}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "error": "Database error"}), 500


@settings_bp.route("/modules/<int:module_id>", methods=["PUT"])
def update_module(module_id):
    module = Module.query.get_or_404(module_id)
    data = request.get_json()
    name = data.get("name")

    if not name:
        return jsonify({"success": False, "error": "Module name is required"}), 400

    module.name = name
    db.session.commit()
    return jsonify({"success": True, "data": module.to_dict()}), 200


@settings_bp.route("/modules/<int:module_id>", methods=["DELETE"])
def delete_module(module_id):
    module = Module.query.get_or_404(module_id)
    db.session.delete(module)
    db.session.commit()
    return jsonify({"success": True, "message": "Module deleted successfully"}), 200


# ==============================================================
#                    PERMISSION CRUD OPERATIONS
# ==============================================================

@settings_bp.route("/permissions", methods=["GET"])
def get_permissions():
    permissions = Permission.query.all()
    return jsonify({
        "success": True,
        "data": [p.to_dict() for p in permissions]
    }), 200


# ⭐ MISSING ROUTE ADDED HERE!
# --------------------------------------------------------------

@settings_bp.route("/permissions/<int:user_type_id>", methods=["GET"])
def get_permissions_by_user_type(user_type_id):
    """Return allowed modules for Sidebar.js"""

    permissions = Permission.query.filter_by(
        user_type_id=user_type_id
    ).all()

    formatted = [
        {
            "module_name": p.module.name if p.module else None,
            "can_view": p.can_view
        }
        for p in permissions
    ]

    return jsonify({
        "success": True,
        "data": formatted
    }), 200


# --------------------------------------------------------------


@settings_bp.route("/permissions/upsert", methods=["POST"])
def upsert_permissions_bulk():
    data = request.get_json()
    updates = data.get("updates", [])

    if not isinstance(updates, list):
        return jsonify({"success": False, "error": "Invalid format for updates"}), 400

    for item in updates:
        user_type_id = item.get("user_type_id") or item.get("usertype_id")
        module_name = item.get("module_name")
        can_view = item.get("can_view")
        if can_view is None:
            can_view = bool(item.get("has_access", 0))

        if not user_type_id or not module_name:
            continue

        module = Module.query.filter(Module.name.ilike(module_name)).first()
        if not module:
            module = Module(name=module_name)
            db.session.add(module)
            db.session.flush()

        permission = Permission.query.filter_by(
            user_type_id=user_type_id, module_id=module.id
        ).first()

        if permission:
            permission.can_view = can_view
        else:
            db.session.add(Permission(
                user_type_id=user_type_id,
                module_id=module.id,
                can_view=can_view
            ))

    db.session.commit()
    return jsonify({"success": True, "message": "Permissions updated successfully"}), 200


# ==============================================================
#                   USER TYPE PERMISSION VIEW
# ==============================================================

@settings_bp.route("/user-type/<string:user_type_name>", methods=["GET"])
def get_user_type_permissions(user_type_name):
    user_type = UserType.query.filter(UserType.name.ilike(user_type_name)).first()

    if not user_type:
        modules = Module.query.all()
        return jsonify({
            "success": True,
            "user_type_name": "",
            "permissions": [m.name for m in modules]
        }), 200

    permissions = Permission.query.filter_by(
        user_type_id=user_type.id, can_view=True
    ).all()

    allowed_module_names = [p.module.name for p in permissions if p.module]

    return jsonify({
        "success": True,
        "user_type_name": user_type.name,
        "permissions": allowed_module_names
    }), 200

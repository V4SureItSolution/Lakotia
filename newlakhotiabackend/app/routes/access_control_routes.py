from flask import Blueprint, request, jsonify
from app import db
from app.models.access_control import AccessControl
from app.models.usertype import UserType

access_bp = Blueprint("access_bp", __name__, url_prefix="/api")


# ---------------------------------------------------
#  SAVE MULTIPLE ACCESS CONTROL ENTRIES
# ---------------------------------------------------
@access_bp.route("/access-control", methods=["POST"])
def save_access_control():
    data = request.get_json()

    user_type_ids = data.get("user_type_ids", [])
    allow_access = data.get("allow_access", 0)

    if not isinstance(user_type_ids, list) or len(user_type_ids) == 0:
        return jsonify({
            "success": False,
            "message": "Select at least one user type"
        }), 400

    # Convert to boolean
    allow_access_bool = True if allow_access == 1 else False

    try:
        # DELETE old access entries for selected user types
        (
            AccessControl.query
            .filter(AccessControl.user_type_id.in_(user_type_ids))
            .delete(synchronize_session=False)
        )

        # INSERT new ones
        for uid in user_type_ids:
            add_entry = AccessControl(
                user_type_id=uid,
                allow_access=allow_access_bool
            )
            db.session.add(add_entry)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Access control updated successfully"
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Error saving access control",
            "error": str(e)
        }), 500


# ---------------------------------------------------
#  GET ALL ACCESS CONTROL DATA
# ---------------------------------------------------
@access_bp.route("/access-control", methods=["GET"])
def get_access_control():
    try:
        records = AccessControl.query.all()

        return jsonify({
            "success": True,
            "data": [r.to_dict() for r in records]
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Failed to fetch access control",
            "error": str(e)
        }), 500

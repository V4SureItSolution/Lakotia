from flask import Blueprint, request, jsonify
from app import db
from app.models.holiday import Holiday
from datetime import datetime

holiday_bp = Blueprint("holiday_bp", __name__, url_prefix="/api/holidays")

# ---------------------------------------------------
# SAVE HOLIDAYS (Frontend Format)
# ---------------------------------------------------
@holiday_bp.route("/", methods=["POST"])
def save_holidays():
    data = request.get_json()

    month = data.get("month")
    year = data.get("year")
    holiday_list = data.get("holidays", [])

    if not month or not year:
        return jsonify({"success": False, "message": "month and year required"}), 400

    try:
        # ---------------------------------------------------
        # 🗑 Delete only this month's holidays
        # ---------------------------------------------------
        Holiday.query.filter(
            db.extract("month", Holiday.date) == month,
            db.extract("year", Holiday.date) == year
        ).delete()

        # ---------------------------------------------------
        # 🟢 Insert new holidays
        # ---------------------------------------------------
        for date_str in holiday_list:
            new_holiday = Holiday(
                date=date_str,
                description=""  # frontend doesn't send description
            )
            db.session.add(new_holiday)

        db.session.commit()

        return jsonify({"success": True, "message": "Holidays saved"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------
# GET HOLIDAYS BY MONTH & YEAR
# ---------------------------------------------------
@holiday_bp.route("/", methods=["GET"])
def get_holidays():
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)

    if not month or not year:
        return jsonify({"success": False, "message": "month and year required"}), 400

    holidays = Holiday.query.filter(
        db.extract("month", Holiday.date) == month,
        db.extract("year", Holiday.date) == year
    ).all()

    return jsonify({
        "success": True,
        "holidays": [h.date for h in holidays]
    }), 200


# ---------------------------------------------------
# DELETE A HOLIDAY BY ID
# ---------------------------------------------------
@holiday_bp.route("/<int:id>", methods=["DELETE"])
def delete_holiday(id):
    holiday = Holiday.query.get(id)

    if not holiday:
        return jsonify({"success": False, "message": "Holiday not found"}), 404

    db.session.delete(holiday)
    db.session.commit()

    return jsonify({"success": True, "message": "Holiday deleted"}), 200

from flask import Blueprint, request, jsonify
from app import db
from app.models.casual import CasualSalary

casual_bp = Blueprint("casual_bp", __name__, url_prefix="/api/casual")


# -------------------------------------------
# SAVE BULK CASUAL SALARY RECORDS
# -------------------------------------------
@casual_bp.route("/save", methods=["POST"])
def save_casual_salary():
    try:
        data = request.get_json()
        records = data.get("records", [])

        if not records:
            return jsonify({"success": False, "message": "No records found"}), 400

        month = data.get("month")
        year = data.get("year")

        # Delete already existing records for the month/year
        CasualSalary.query.filter_by(month=month, year=year).delete()

        for rec in records:
            entry = CasualSalary(
                email=rec.get("email"),
                name=rec.get("name"),
                month=month,
                year=year,
                leave=rec.get("leave", 0),
                grace=rec.get("grace", 0),
                working_days=rec.get("workingDays", 30),
                present_days=rec.get("presentDays", 0),
                salary=float(rec.get("salaryInput", 0)),
                salary_payable=float(rec.get("salaryPayable", 0)),
                loan=float(rec.get("loan", 0)),
                net_salary=float(rec.get("netSalary", 0)),
            )
            db.session.add(entry)

        db.session.commit()
        return jsonify({"success": True, "message": "Casual salary saved successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# -------------------------------------------
# FETCH SALARY FOR A MONTH + YEAR
# -------------------------------------------
@casual_bp.route("/fetch", methods=["GET"])
def fetch_month_data():
    month = request.args.get("month")
    year = request.args.get("year")

    if not month or not year:
        return jsonify({"success": False, "message": "Month & Year required"}), 400

    records = CasualSalary.query.filter_by(month=month, year=year).all()
    return jsonify([r.to_dict() for r in records])


# -------------------------------------------
# FETCH ALL CASUAL SALARY DATA
# -------------------------------------------
@casual_bp.route("/all", methods=["GET"])
def fetch_all_casual_salary():
    records = CasualSalary.query.order_by(CasualSalary.created_at.desc()).all()
    return jsonify([r.to_dict() for r in records])

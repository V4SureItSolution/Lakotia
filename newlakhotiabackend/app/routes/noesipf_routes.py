from flask import Blueprint, request, jsonify
from app import db
from app.models.noesipf import NoEsiPfSalary

noesi_bp = Blueprint("noesi_bp", __name__)

# ---------------- SAVE REPORT -------------------
@noesi_bp.route("/api/salary/noesi/save", methods=["POST"])
def save_noesi_salary():
    try:
        data = request.json
        month = data.get("month")
        year = data.get("year")
        records = data.get("records", [])

        if not month or not year:
            return jsonify({"error": "Month and Year required"}), 400

        # Delete previous entries for same month/year
        NoEsiPfSalary.query.filter_by(month=month, year=year).delete()
        db.session.commit()

        # Save new report rows
        for rec in records:
            entry = NoEsiPfSalary(
                name=rec.get("name"),
                email=rec.get("email"),

                month=month,
                year=year,

                salary=float(rec.get("salaryInput", 0)),
                leave=float(rec.get("leave", 0)),
                grace=float(rec.get("grace", 0)),
                working_days=int(rec.get("workingDays", 0)),
                present_days=float(rec.get("presentDays", 0)),

                salary_payable=float(rec.get("salaryPayable", 0)),
                loan=float(rec.get("loan", 0)),
                net_salary=float(rec.get("netSalary", 0)),
            )
            db.session.add(entry)

        db.session.commit()

        return jsonify({"message": "No ESI/PF salary report saved successfully!"}), 200

    except Exception as e:
        db.session.rollback()
        print("Error:", e)
        return jsonify({"error": str(e)}), 500


# ---------------- FETCH REPORT -------------------
@noesi_bp.route("/api/salary/noesi", methods=["GET"])
def get_noesi_salary():
    try:
        month = request.args.get("month")
        year = request.args.get("year")

        if not month or not year:
            return jsonify({"error": "month & year required"}), 400

        reports = NoEsiPfSalary.query.filter_by(month=month, year=year).all()

        return jsonify([r.to_dict() for r in reports]), 200

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

from flask import Blueprint, request, jsonify
from app import db
from app.models.esi import SalaryESIPF

esipf_bp = Blueprint("esipf_bp", __name__, url_prefix="/api/salary/esipf")

# -----------------------------------------------------
# SAVE MONTHLY SALARY RECORDS (Bulk Save)
# -----------------------------------------------------
@esipf_bp.route("/save", methods=["POST"])
def save_salary_esipf():
    try:
        data = request.get_json()
        month = data.get("month")
        year = data.get("year")
        records = data.get("records", [])

        if not month or not year:
            return jsonify({"success": False, "message": "Month & Year required"}), 400

        if not records:
            return jsonify({"success": False, "message": "No records to save"}), 400

        # Delete existing entries (overwrite behavior)
        SalaryESIPF.query.filter_by(month=month, year=year).delete()

        for r in records:
            entry = SalaryESIPF(
                email=r.get("email"),
                name=r.get("name"),
                month=month,
                year=year,
                leave=r.get("leave", 0),
                grace=r.get("grace", 0),
                working_days=r.get("workingDays", 30),
                present_days=r.get("presentDays", 0),
                salary_input=float(r.get("salaryInput", 0)),
                monthly_salary=float(r.get("monthlySalary", 0)),
                basic=float(r.get("basic", 0)),
                hra=float(r.get("hra", 0)),
                conv=float(r.get("conv", 0)),
                total=float(r.get("total", 0)),
                basic_conv=float(r.get("basicConv", 0)),
                restricted_basic=float(r.get("restrictedBasic", 0)),
                pf=float(r.get("pf", 0)),
                esi=float(r.get("esi", 0)),
                loan=float(r.get("loan", 0)),
                tds=float(r.get("tds", 0)),
                ptax=float(r.get("ptax", 0)),
                total_ded=float(r.get("totalDed", 0)),
                net_salary=float(r.get("netSalary", 0)),
            )
            db.session.add(entry)

        db.session.commit()
        return jsonify({"success": True, "message": "ESI/PF Salaries saved successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500



# -----------------------------------------------------
# FETCH RECORDS FOR A MONTH + YEAR
# -----------------------------------------------------
@esipf_bp.route("/fetch", methods=["GET"])
def fetch_month():
    month = request.args.get("month")
    year = request.args.get("year")

    if not month or not year:
        return jsonify({"success": False, "message": "Month & Year required"}), 400

    data = SalaryESIPF.query.filter_by(month=month, year=year).all()
    return jsonify([d.to_dict() for d in data])



# -----------------------------------------------------
# FETCH ALL RECORDS
# -----------------------------------------------------
@esipf_bp.route("/all", methods=["GET"])
def fetch_all():
    data = SalaryESIPF.query.order_by(SalaryESIPF.created_at.desc()).all()
    return jsonify([d.to_dict() for d in data])

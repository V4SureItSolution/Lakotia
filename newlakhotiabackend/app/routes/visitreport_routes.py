from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from app import db
from app.models.visitreport import VisitReport
from app.models.company import Company  # ✅ To fetch company details by mobile

visitreport_bp = Blueprint("visitreport", __name__, url_prefix="/api")

# ✅ Absolute path for file uploads
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads", "visit_reports")
UPLOAD_FOLDER = os.path.abspath(UPLOAD_FOLDER)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ----------------------------------------------------------
# ✅ Add Visit Report
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport", methods=["POST"])
def add_visit_report():
    data = request.form
    attachment = None

    # ✅ Handle attachment upload
    if "attachment" in request.files:
        file = request.files["attachment"]
        if file.filename:
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            attachment = filename

    new_report = VisitReport(
        company_name=data.get("company_name"),
        company_address=data.get("company_address"),
        pin_code=data.get("pin_code"),
        industry_segment=data.get("industry_segment"),
        customer_name=data.get("customer_name"),
        customer_mobile=data.get("customer_mobile"),
        customer_email=data.get("customer_email"),
        department=data.get("department"),
        notes=data.get("notes"),
        attachment=attachment,
        created_by=data.get("created_by", "Admin"),  # ✅ Dynamic from frontend
    )

    db.session.add(new_report)
    db.session.commit()
    return jsonify({"message": "Visit report added successfully"}), 201


# ----------------------------------------------------------
# ✅ Get All Visit Reports (Admin use only)
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport", methods=["GET"])
def get_all_visit_reports():
    reports = VisitReport.query.order_by(VisitReport.id.desc()).all()
    return jsonify([r.to_dict() for r in reports])


# ----------------------------------------------------------
# ✅ Get Visit Reports by Logged-in User
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/user/<string:username>", methods=["GET"])
def get_visit_reports_by_user(username):
    reports = (
        VisitReport.query.filter_by(created_by=username)
        .order_by(VisitReport.id.desc())
        .all()
    )
    return jsonify([r.to_dict() for r in reports])


# ----------------------------------------------------------
# ✅ Get a Report by ID
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/<int:id>", methods=["GET"])
def get_visit_report(id):
    report = VisitReport.query.get(id)
    if not report:
        return jsonify({"error": "Visit report not found"}), 404
    return jsonify(report.to_dict())


# ----------------------------------------------------------
# ✅ Update Visit Report
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/<int:id>", methods=["PUT"])
def update_visit_report(id):
    report = VisitReport.query.get(id)
    if not report:
        return jsonify({"error": "Report not found"}), 404

    data = request.form

    # ✅ Update attachment if new one uploaded
    if "attachment" in request.files:
        file = request.files["attachment"]
        if file.filename:
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))
            report.attachment = filename

    # ✅ Update all editable fields
    report.company_name = data.get("company_name", report.company_name)
    report.company_address = data.get("company_address", report.company_address)
    report.pin_code = data.get("pin_code", report.pin_code)
    report.industry_segment = data.get("industry_segment", report.industry_segment)
    report.customer_name = data.get("customer_name", report.customer_name)
    report.customer_mobile = data.get("customer_mobile", report.customer_mobile)
    report.customer_email = data.get("customer_email", report.customer_email)
    report.department = data.get("department", report.department)
    report.notes = data.get("notes", report.notes)
    report.created_by = data.get("created_by", report.created_by)

    db.session.commit()
    return jsonify({"message": "Visit report updated successfully"})


# ----------------------------------------------------------
# ✅ Delete Visit Report
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/<int:id>", methods=["DELETE"])
def delete_visit_report(id):
    report = VisitReport.query.get(id)
    if not report:
        return jsonify({"error": "Report not found"}), 404

    db.session.delete(report)
    db.session.commit()
    return jsonify({"message": "Visit report deleted"})


# ----------------------------------------------------------
# ✅ Serve Uploaded Files (Fix for 404)
# ----------------------------------------------------------
@visitreport_bp.route("/visit_reports/<filename>", methods=["GET"])
def get_uploaded_file(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404


# ----------------------------------------------------------
# ✅ Fetch company details by mobile (from Company table)
# ----------------------------------------------------------
@visitreport_bp.route("/company/mobile/<string:mobile>", methods=["GET"])
def get_company_by_mobile(mobile):
    cleaned_mobile = ''.join(filter(str.isdigit, mobile))[-10:]

    company = Company.query.filter(
        (Company.customer_mobile.like(f"%{cleaned_mobile}%")) |
        (Company.personal_mobile.like(f"%{cleaned_mobile}%"))
    ).first()

    if company:
        return jsonify({
            "company_name": company.company_name,
            "companyName": company.company_name,
            "customer_name": company.customer_name,
            "customerName": company.customer_name,
            "gst_number": company.gst_number,
            "gstNumber": company.gst_number,
            "pin_code": company.pin_code,
            "pinCode": company.pin_code,
            "company_address": company.company_address,
            "companyAddress": company.company_address,
            "customer_email": company.customer_email,
            "customerEmail": company.customer_email,
            "department": company.department,
            "industry_segment": company.industry_segment,
            "industrySegment": company.industry_segment,
        }), 200

    # Fallback to previous Visit Report
    prev_report = VisitReport.query.filter(
        VisitReport.customer_mobile.like(f"%{cleaned_mobile}%")
    ).order_by(VisitReport.id.desc()).first()

    if prev_report:
        return jsonify({
            "company_name": prev_report.company_name,
            "companyName": prev_report.company_name,
            "customer_name": prev_report.customer_name,
            "customerName": prev_report.customer_name,
            "pin_code": prev_report.pin_code or "",
            "pinCode": prev_report.pin_code or "",
            "company_address": prev_report.company_address or "",
            "companyAddress": prev_report.company_address or "",
            "customer_email": prev_report.customer_email or "",
            "customerEmail": prev_report.customer_email or "",
            "department": prev_report.department or "",
        }), 200

    return jsonify({"error": "No company found for this mobile", "message": "Company not found"}), 404


# ----------------------------------------------------------
# ✅ Search Visit Reports by Date Range
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/search", methods=["GET"])
def search_visit_reports():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return jsonify({"error": "Please provide both start_date and end_date"}), 400

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    reports = (
        VisitReport.query.filter(VisitReport.created_at.between(start, end))
        .order_by(VisitReport.created_at.desc())
        .all()
    )

    return jsonify([r.to_dict() for r in reports])


# ----------------------------------------------------------
# ✅ Search Visit Reports by Name / Created By / Pincode
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/searchname", methods=["GET"])
def search_by_name():
    term = request.args.get("term", "").strip()
    if not term:
        return jsonify([])

    results = VisitReport.query.filter(
        (VisitReport.company_name.ilike(f"%{term}%"))
        | (VisitReport.customer_name.ilike(f"%{term}%"))
        | (VisitReport.created_by.ilike(f"%{term}%"))
        | (VisitReport.pin_code.ilike(f"%{term}%"))
    ).order_by(VisitReport.id.desc()).all()

    return jsonify([r.to_dict() for r in results])


# ----------------------------------------------------------
# ✅ Search Visit Reports by Pincode
# ----------------------------------------------------------
@visitreport_bp.route("/visitreport/searchpincode", methods=["GET"])
def search_by_pincode():
    pincode = request.args.get("pincode", "").strip()
    if not pincode:
        return jsonify([])

    results = VisitReport.query.filter(
        VisitReport.pin_code.ilike(f"%{pincode}%")
    ).order_by(VisitReport.id.desc()).all()

    return jsonify([r.to_dict() for r in results])

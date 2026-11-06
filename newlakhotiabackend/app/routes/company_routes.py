from flask import Blueprint, request, jsonify
from app import db
from app.models.company import Company

company_bp = Blueprint("company_bp", __name__)

# ======================================================
#                 ADD COMPANY
# ======================================================
@company_bp.route("/company", methods=["POST"])
def add_company():
    data = request.json

    try:
        # 🔁 Check duplicate email
        existing = Company.query.filter_by(customer_email=data.get("customerEmail")).first()
        if existing:
            return jsonify({
                "success": False,
                "message": "Company with this email already exists"
            }), 409

        new_company = Company(
            company_name=data.get("companyName"),
            company_address=data.get("companyAddress"),
            pin_code=data.get("pinCode"),
            industry_segment=data.get("industrySegment"),
            customer_name=data.get("customerName"),
            customer_mobile=data.get("customerMobile"),
            customer_email=data.get("customerEmail"),
            department=data.get("department"),
            personal_mobile=data.get("personalMobile"),
            personal_email=data.get("personalEmail"),
            gst_number=data.get("gstNumber"),
            password=data.get("password")   # ✅ PASSWORD ADDED
        )

        db.session.add(new_company)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Company added successfully!"
        }), 201

    except Exception as e:
        print("Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Error adding company"}), 500


# ======================================================
#                 COMPANY LOGIN
# ======================================================
@company_bp.route("/company/login", methods=["POST"])
def company_login():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({
                "success": False,
                "message": "Email and password are required"
            }), 400

        company = Company.query.filter_by(customer_email=email).first()

        if not company or company.password != password:
            return jsonify({
                "success": False,
                "message": "Invalid email or password"
            }), 401

        return jsonify({
            "success": True,
            "message": "Login successful",
            "company": company.to_dict()
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


# ======================================================
#                 GET ALL COMPANIES
# ======================================================
@company_bp.route("/company", methods=["GET"])
def get_companies():
    companies = Company.query.all()
    return jsonify([c.to_dict() for c in companies]), 200


# ======================================================
#                 GET COMPANY BY ID
# ======================================================
@company_bp.route("/company/<int:id>", methods=["GET"])
def get_company(id):
    company = Company.query.get(id)

    if not company:
        return jsonify({"message": "Company not found"}), 404

    return jsonify(company.to_dict()), 200


# ======================================================
# ⭐ GET COMPANY BY MOBILE — NAME + CUSTOMER + GST
# ======================================================
@company_bp.route("/company/mobile/<string:mobile>", methods=["GET"])
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

    # Fallback to previous Visit Report with this mobile
    try:
        from app.models.visitreport import VisitReport
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
    except Exception as e:
        print("Fallback search in visit reports error:", e)

    return jsonify({"message": "Company not found", "error": "Company not found"}), 404


# ======================================================
#                 GET COMPANY BY NAME
# ======================================================
@company_bp.route("/company/name/<string:name>", methods=["GET"])
def get_company_by_name(name):
    company = Company.query.filter(
        Company.company_name.ilike(f"%{name}%")
    ).first()

    if not company:
        return jsonify({"message": "Company not found"}), 404

    return jsonify(company.to_dict()), 200


# ======================================================
#                 UPDATE COMPANY
# ======================================================
@company_bp.route("/company/<int:id>", methods=["PUT"])
def update_company(id):
    company = Company.query.get(id)

    if not company:
        return jsonify({"message": "Company not found"}), 404

    data = request.json

    try:
        company.company_name = data.get("companyName", company.company_name)
        company.company_address = data.get("companyAddress", company.company_address)
        company.pin_code = data.get("pinCode", company.pin_code)
        company.industry_segment = data.get("industrySegment", company.industry_segment)
        company.customer_name = data.get("customerName", company.customer_name)
        company.customer_mobile = data.get("customerMobile", company.customer_mobile)
        company.customer_email = data.get("customerEmail", company.customer_email)
        company.department = data.get("department", company.department)
        company.personal_mobile = data.get("personalMobile", company.personal_mobile)
        company.personal_email = data.get("personalEmail", company.personal_email)
        company.gst_number = data.get("gstNumber", company.gst_number)

        # ✅ Update password only if provided
        if data.get("password"):
            company.password = data.get("password")

        db.session.commit()

        return jsonify({"message": "Company updated successfully!"}), 200

    except Exception as e:
        print("Error:", e)
        db.session.rollback()
        return jsonify({"message": "Error updating company"}), 500


# ======================================================
#                 DELETE COMPANY
# ======================================================
@company_bp.route("/company/<int:id>", methods=["DELETE"])
def delete_company(id):
    company = Company.query.get(id)

    if not company:
        return jsonify({"success": False, "message": "Company not found"}), 404

    try:
        db.session.delete(company)
        db.session.commit()
        return jsonify({"success": True, "message": "Company deleted!"}), 200

    except Exception as e:
        db.session.rollback()
        error_msg = str(e)
        if "foreign key constraint fails" in error_msg.lower() or "1451" in error_msg:
            return jsonify({
                "success": False,
                "message": "Cannot delete this partner because it is linked to existing records (Purchase Orders, Quotations, etc.)."
            }), 400
        return jsonify({"success": False, "message": f"Error deleting company: {error_msg}"}), 500

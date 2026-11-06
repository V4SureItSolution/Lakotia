import os
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from app import db
from app.models.employee import Employee

employee_bp = Blueprint("employee_bp", __name__)

# 📁 Folder where files are stored
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ✅ EMPLOYEE LOGIN ROUTE
@employee_bp.route("/login", methods=["POST"])
def employee_login():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password are required"}), 400

        employee = Employee.query.filter_by(email=email).first()

        if not employee or employee.password != password:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401

        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": employee.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500


# ✅ CHECK FOR DUPLICATE EMAIL
@employee_bp.route("/check-email", methods=["POST"])
def check_duplicate_email():
    try:
        data = request.get_json()
        email = data.get("email")
        exclude_id = data.get("excludeId")
        
        if not email:
            return jsonify({"exists": False}), 200
        
        query = Employee.query.filter_by(email=email)
        if exclude_id:
            query = query.filter(Employee.id != exclude_id)
        
        employee = query.first()
        
        return jsonify({
            "exists": employee is not None,
            "employee": employee.to_dict() if employee else None
        }), 200
        
    except Exception as e:
        return jsonify({"exists": False, "error": str(e)}), 500


# ✅ ADD EMPLOYEE
@employee_bp.route("/add", methods=["POST"])
def add_employee():
    try:
        # Check for duplicate email first
        email = request.form.get("email")
        if email:
            existing = Employee.query.filter_by(email=email).first()
            if existing:
                return jsonify({
                    "success": False, 
                    "message": f"Email '{email}' already exists for employee: {existing.name}"
                }), 409  # 409 Conflict
        
        # 📋 Basic info
        name = request.form.get("name")
        dob = request.form.get("dob")
        gender = request.form.get("gender")
        email = request.form.get("email")
        address = request.form.get("address")
        department = request.form.get("department")
        designation = request.form.get("designation")
        doj = request.form.get("doj")
        empType = request.form.get("empType")
        userType = request.form.get("userType")
        mobile = request.form.get("mobile")
        altContact = request.form.get("altContact")
        pan = request.form.get("pan")
        aadhar = request.form.get("aadhar")
        password = request.form.get("password")
        createdBy = request.form.get("createdBy")

        # ✅ Now esiPfStatus will be a string (like "ESI", "PF", "Both", "None")
        esiPfStatus = request.form.get("esiPfStatus")

        # 📂 File uploads
        photo = request.files.get("photo")
        pan_attachment = request.files.get("panAttachment")
        aadhar_attachment = request.files.get("aadharAttachment")

        photo_filename = None
        pan_filename = None
        aadhar_filename = None

        if photo and allowed_file(photo.filename):
            filename = secure_filename(photo.filename)
            photo_filename = f"photo_{email}_{filename}"
            photo.save(os.path.join(UPLOAD_FOLDER, photo_filename))

        if pan_attachment and allowed_file(pan_attachment.filename):
            filename = secure_filename(pan_attachment.filename)
            pan_filename = f"pan_{email}_{filename}"
            pan_attachment.save(os.path.join(UPLOAD_FOLDER, pan_filename))

        if aadhar_attachment and allowed_file(aadhar_attachment.filename):
            filename = secure_filename(aadhar_attachment.filename)
            aadhar_filename = f"aadhar_{email}_{filename}"
            aadhar_attachment.save(os.path.join(UPLOAD_FOLDER, aadhar_filename))

        # 🧠 Create new employee record
        new_employee = Employee(
            name=name,
            dob=dob,
            gender=gender,
            email=email,
            address=address,
            department=department,
            designation=designation,
            doj=doj,
            empType=empType,
            userType=userType,
            mobile=mobile,
            altContact=altContact,
            pan=pan,
            aadhar=aadhar,
            password=password,
            photo=photo_filename,
            panAttachment=pan_filename,
            aadharAttachment=aadhar_filename,
            esiPfStatus=esiPfStatus,
            createdBy=createdBy,
        )

        db.session.add(new_employee)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Employee added successfully",
            "employee": new_employee.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500


# ✅ GET ALL EMPLOYEES
@employee_bp.route("/all", methods=["GET"])
def get_all_employees():
    employees = Employee.query.all()
    return jsonify([emp.to_dict() for emp in employees]), 200


# ✅ GET SINGLE EMPLOYEE
@employee_bp.route("/<int:id>", methods=["GET"])
def get_employee(id):
    emp = Employee.query.get(id)
    if not emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404
    
    # Get employee data
    employee_data = emp.to_dict()
    
    # Ensure password is included (backward compatibility)
    if 'password' not in employee_data:
        employee_data['password'] = emp.password
    
    return jsonify(employee_data), 200


# ✅ UPDATE EMPLOYEE
@employee_bp.route("/update/<int:id>", methods=["PUT"])
def update_employee(id):
    try:
        emp = Employee.query.get(id)
        if not emp:
            return jsonify({"success": False, "message": "Employee not found"}), 404
        
        # Check for duplicate email (excluding current employee)
        new_email = request.form.get("email")
        if new_email and new_email != emp.email:
            existing = Employee.query.filter_by(email=new_email).first()
            if existing and existing.id != id:
                return jsonify({
                    "success": False, 
                    "message": f"Email '{new_email}' already exists for employee: {existing.name}"
                }), 409

        # 📋 Update basic fields
        emp.name = request.form.get("name", emp.name)
        emp.dob = request.form.get("dob", emp.dob)
        emp.gender = request.form.get("gender", emp.gender)
        emp.email = request.form.get("email", emp.email)
        emp.address = request.form.get("address", emp.address)
        emp.department = request.form.get("department", emp.department)
        emp.designation = request.form.get("designation", emp.designation)
        emp.doj = request.form.get("doj", emp.doj)
        emp.empType = request.form.get("empType", emp.empType)
        emp.userType = request.form.get("userType", emp.userType)
        emp.mobile = request.form.get("mobile", emp.mobile)
        emp.altContact = request.form.get("altContact", emp.altContact)
        emp.pan = request.form.get("pan", emp.pan)
        emp.aadhar = request.form.get("aadhar", emp.aadhar)
        
        # Only update password if provided
        new_password = request.form.get("password")
        if new_password:
            emp.password = new_password
        
        emp.createdBy = request.form.get("createdBy", emp.createdBy)
        emp.esiPfStatus = request.form.get("esiPfStatus", emp.esiPfStatus)

        # 📂 Handle new file uploads
        photo = request.files.get("photo")
        pan_attachment = request.files.get("panAttachment")
        aadhar_attachment = request.files.get("aadharAttachment")

        if photo and allowed_file(photo.filename):
            if emp.photo:
                old_path = os.path.join(UPLOAD_FOLDER, emp.photo)
                if os.path.exists(old_path):
                    os.remove(old_path)
            filename = secure_filename(photo.filename)
            new_photo_name = f"photo_{emp.email}_{filename}"
            photo.save(os.path.join(UPLOAD_FOLDER, new_photo_name))
            emp.photo = new_photo_name

        if pan_attachment and allowed_file(pan_attachment.filename):
            if emp.panAttachment:
                old_path = os.path.join(UPLOAD_FOLDER, emp.panAttachment)
                if os.path.exists(old_path):
                    os.remove(old_path)
            filename = secure_filename(pan_attachment.filename)
            new_pan_name = f"pan_{emp.email}_{filename}"
            pan_attachment.save(os.path.join(UPLOAD_FOLDER, new_pan_name))
            emp.panAttachment = new_pan_name

        if aadhar_attachment and allowed_file(aadhar_attachment.filename):
            if emp.aadharAttachment:
                old_path = os.path.join(UPLOAD_FOLDER, emp.aadharAttachment)
                if os.path.exists(old_path):
                    os.remove(old_path)
            filename = secure_filename(aadhar_attachment.filename)
            new_aadhar_name = f"aadhar_{emp.email}_{filename}"
            aadhar_attachment.save(os.path.join(UPLOAD_FOLDER, new_aadhar_name))
            emp.aadharAttachment = new_aadhar_name

        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Employee updated successfully",
            "employee": emp.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500


# ✅ DELETE EMPLOYEE
@employee_bp.route("/<int:id>", methods=["DELETE"])
def delete_employee(id):
    emp = Employee.query.get(id)
    if not emp:
        return jsonify({"success": False, "message": "Employee not found"}), 404

    files_to_remove = [emp.photo, emp.panAttachment, emp.aadharAttachment]
    for filename in files_to_remove:
        if filename:
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

    db.session.delete(emp)
    db.session.commit()
    return jsonify({"success": True, "message": "Employee deleted successfully"}), 200


# ✅ SERVE UPLOADED FILES
@employee_bp.route("/uploads/<filename>")
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ✅ FILTER BY ESI/PF STATUS
@employee_bp.route("/status/<string:status>", methods=["GET"])
def get_employees_by_esipf_status(status):
    """
    Get employees filtered by esiPfStatus (e.g., 'ESI', 'PF', 'Both', 'None')
    """
    try:
        employees = Employee.query.filter_by(esiPfStatus=status).all()
        data = [emp.to_dict() for emp in employees]
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ✅ DEBUG: Check if password is in to_dict() - ADD THIS NEW ENDPOINT
@employee_bp.route("/debug/<int:id>", methods=["GET"])
def debug_employee(id):
    emp = Employee.query.get(id)
    if not emp:
        return jsonify({"error": "Not found"}), 404
    
    dict_data = emp.to_dict()
    
    return jsonify({
        "has_password_field": "password" in dict_data,
        "password_value": dict_data.get("password"),
        "password_length": len(dict_data.get("password", "")) if dict_data.get("password") else 0,
        "all_keys": list(dict_data.keys())
    }), 200
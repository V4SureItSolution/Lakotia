# routes/attendance_routes.py
from flask import Blueprint, request, jsonify
from app import db
from app.models.attendance import Attendance
from datetime import datetime

attendance_bp = Blueprint("attendance", __name__)


# Helper to parse various time formats safely
def parse_time(time_str):
    if not time_str:
        raise ValueError("Empty time string")
    clean_str = str(time_str).strip().replace('\u202f', ' ').replace('\xa0', ' ')
    for fmt in ("%I:%M:%S %p", "%I:%M %p", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(clean_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognized time format: '{time_str}'")


# ✅ Create new record (check-in) - Supports multiple check-ins per day
@attendance_bp.route("/attendance/checkin", methods=["POST"])
def check_in():
    data = request.get_json() or {}
    email = data.get("email")
    username = data.get("username")
    date = data.get("date")

    if not email or not username or not date:
        return jsonify({"message": "Missing email, username, or date"}), 400

    # ✅ Allow multiple check-ins per day, but prevent duplicate active check-ins
    # Check if there is already an active session (status == 'checked-in' or no check_out)
    active_session = Attendance.query.filter(
        Attendance.email == email,
        Attendance.date == date,
        (Attendance.status == "checked-in") | (Attendance.check_out == None) | (Attendance.check_out == "")
    ).order_by(Attendance.id.desc()).first()

    if active_session:
        return jsonify({
            "message": "You already have an active check-in. Please check out before checking in again."
        }), 400

    new_record = Attendance(
        email=email,
        username=username,
        date=date,
        check_in=data.get("checkIn"),
        status="checked-in",
        device_in=data.get("device"),
        location_in=data.get("location"),
    )
    db.session.add(new_record)
    db.session.commit()

    return jsonify({
        "message": "Checked in successfully",
        "record": new_record.to_dict()
    }), 201


# ✅ Update record (check-out) - Closes the active check-in session
@attendance_bp.route("/attendance/checkout", methods=["PUT"])
def check_out():
    data = request.get_json() or {}
    email = data.get("email")
    date = data.get("date")
    record_id = data.get("id") or data.get("recordId")

    if not email or not date:
        return jsonify({"message": "Missing email or date"}), 400

    record = None
    if record_id:
        record = Attendance.query.filter_by(id=record_id, email=email).first()

    # Fallback to the latest active check-in session for today
    if not record or record.status != "checked-in":
        record = Attendance.query.filter(
            Attendance.email == email,
            Attendance.date == date,
            (Attendance.status == "checked-in") | (Attendance.check_out == None) | (Attendance.check_out == "")
        ).order_by(Attendance.id.desc()).first()

    if not record or not record.check_in:
        return jsonify({"message": "No active check-in found to check out"}), 404

    record.check_out = data.get("checkOut")
    record.status = "checked-out"
    record.device_out = data.get("deviceOut")
    record.location_out = data.get("locationOut")

    # ✅ Calculate duration (HHh MMm)
    try:
        t1 = parse_time(record.check_in)
        t2 = parse_time(record.check_out)
        delta = t2 - t1
        total_seconds = int(delta.total_seconds())
        if total_seconds < 0:
            total_seconds += 86400  # Crosses midnight
        hours, remainder = divmod(total_seconds, 3600)
        minutes = remainder // 60
        record.duration = f"{hours}h {minutes}m"
    except Exception as e:
        print("Duration calculation error:", e)
        record.duration = "-"

    db.session.commit()
    return jsonify({
        "message": "Checked out successfully",
        "record": record.to_dict()
    })


# ✅ Fetch attendance by email
@attendance_bp.route("/attendance/email/<email>", methods=["GET"])
def get_attendance_by_email(email):
    records = Attendance.query.filter_by(email=email).order_by(Attendance.date.desc(), Attendance.id.desc()).all()
    return jsonify([r.to_dict() for r in records])


# ✅ Fetch all attendance records (Admin view)
@attendance_bp.route("/attendance", methods=["GET"])
def get_all_attendance():
    records = Attendance.query.order_by(Attendance.date.desc(), Attendance.id.desc()).all()
    return jsonify([r.to_dict() for r in records])

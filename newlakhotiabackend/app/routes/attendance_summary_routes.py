from flask import Blueprint, request, jsonify
from app import db
from app.models.attendance_summary import AttendanceSummary

attendance_summary_bp = Blueprint("attendance_summary", __name__, url_prefix="/api")

# ✅ Save monthly summary from frontend
@attendance_summary_bp.route("/attendance/summary", methods=["POST"])
def save_attendance_summary():
    data = request.get_json()

    # Must be a list of summary records
    if not isinstance(data, list):
        return jsonify({"message": "Expected a list of summary data"}), 400

    saved_records = []

    for record in data:
        email = record.get("email")
        month = record.get("month")
        year = record.get("year")

        # Skip incomplete records
        if not email or not month or not year:
            continue

        existing = AttendanceSummary.query.filter_by(
            email=email, month=month, year=year
        ).first()

        if existing:
            # Update existing record
            existing.present = record.get("present", existing.present)
            existing.absent = record.get("absent", existing.absent)
            existing.total_days = record.get("totalDays", existing.total_days)
        else:
            # Insert new record
            new_record = AttendanceSummary(
                name=record.get("name"),
                email=email,
                month=month,
                year=year,
                present=record.get("present", 0),
                absent=record.get("absent", 0),
                total_days=record.get("totalDays", 0),
            )
            db.session.add(new_record)

        saved_records.append(record)

    db.session.commit()
    return jsonify({
        "message": "Attendance summary saved successfully",
        "data": saved_records
    }), 201


# ✅ Fetch attendance summary by month & year
@attendance_summary_bp.route("/attendance/summary", methods=["GET"])
def get_summary():
    month = request.args.get("month")
    year = request.args.get("year")

    # Validation
    if not month or not year:
        return jsonify({"message": "Please provide both month and year"}), 400

    try:
        month = int(month)
        year = int(year)
    except ValueError:
        return jsonify({"message": "Month and year must be integers"}), 400

    # Filter records
    summaries = AttendanceSummary.query.filter_by(month=month, year=year).all()

    if not summaries:
        return jsonify([])  # Return empty list if no data found

    # Convert each record to dict
    response = [s.to_dict() for s in summaries]
    return jsonify(response)

from flask import Blueprint, request, jsonify
from app import db
from app.models.advance import Advance
from datetime import datetime
import json

advance_bp = Blueprint("advance_bp", __name__, url_prefix="/api")

@advance_bp.route("/advance", methods=["GET"])
def get_all_advances():
    try:
        # Get all advances ordered by latest first
        advances = Advance.query.order_by(Advance.created_at.desc()).all()
        
        # Convert to dictionary
        result = []
        for advance in advances:
            advance_dict = advance.to_dict()
            result.append(advance_dict)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error fetching advances: {str(e)}")
        return jsonify({"error": "Failed to fetch advances", "details": str(e)}), 500

@advance_bp.route("/advance", methods=["POST"])
def add_advance():
    try:
        data = request.json
        
        # Parse deduction_schedule if present
        deduction_schedule = data.get("deduction_schedule", [])
        if isinstance(deduction_schedule, list):
            deduction_schedule = json.dumps(deduction_schedule)
        
        # Calculate split_months automatically if not provided
        split_months = data.get("split_months")
        split_percentage = data.get("split_percentage", 100)
        
        if not split_months and split_percentage:
            # Calculate months automatically: 50% = 2 months, 33% = 3 months, etc.
            split_months = (100 // split_percentage) + (1 if 100 % split_percentage > 0 else 0)
        
        # Create new advance
        new_advance = Advance(
            email=data["email"],
            name=data["name"],
            department=data.get("department", ""),
            amount=float(data["amount"]),
            reason=data.get("reason", ""),
            date=data.get("date", datetime.now().strftime("%Y-%m-%d")),
            time=data.get("time", datetime.now().strftime("%H:%M:%S")),
            
            # Split deduction fields
            split_percentage=float(split_percentage),
            split_months=int(split_months) if split_months else 1,
            deduction_start=data.get("deduction_start"),
            
            # Schedule and calculations
            deduction_schedule=deduction_schedule,
            per_month_deduction=data.get("per_month_deduction"),
            total_deduction_months=data.get("total_deduction_months"),
            deduction_start_month=data.get("deduction_start_month"),
            deduction_end_month=data.get("deduction_end_month"),
            
            # Status tracking
            status=data.get("status", "active"),
            amount_deducted=float(data.get("amount_deducted", 0)),
            amount_remaining=float(data.get("amount_remaining", data["amount"])),
            deductions_completed=int(data.get("deductions_completed", 0))
        )
        
        db.session.add(new_advance)
        db.session.commit()
        
        return jsonify({
            "message": "Advance added successfully",
            "advance": new_advance.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error adding advance: {str(e)}")
        return jsonify({"error": "Failed to add advance", "details": str(e)}), 400

@advance_bp.route("/advance/<int:id>", methods=["GET"])
def get_advance(id):
    try:
        advance = Advance.query.get_or_404(id)
        return jsonify(advance.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@advance_bp.route("/advance/<int:id>", methods=["PUT"])
def update_advance(id):
    try:
        advance = Advance.query.get_or_404(id)
        data = request.json
        
        # Update fields if provided
        if "status" in data:
            advance.status = data["status"]
        if "amount_deducted" in data:
            advance.amount_deducted = float(data["amount_deducted"])
        if "amount_remaining" in data:
            advance.amount_remaining = float(data["amount_remaining"])
        if "deductions_completed" in data:
            advance.deductions_completed = int(data["deductions_completed"])
        
        db.session.commit()
        return jsonify({
            "message": "Advance updated successfully",
            "advance": advance.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@advance_bp.route("/advance/<int:id>/deduct", methods=["POST"])
def record_deduction(id):
    try:
        advance = Advance.query.get_or_404(id)
        data = request.json
        
        amount = float(data.get("amount", advance.per_month_deduction or advance.amount))
        month = data.get("month")
        year = data.get("year")
        
        # Update amounts
        advance.amount_deducted = (advance.amount_deducted or 0) + amount
        advance.amount_remaining = (advance.amount_remaining or advance.amount) - amount
        advance.deductions_completed = (advance.deductions_completed or 0) + 1
        
        # Update deduction schedule if exists
        if advance.deduction_schedule:
            try:
                schedule = json.loads(advance.deduction_schedule)
                month_year_str = f"{int(month):02d}/{year}" if month and year else None
                
                for deduction in schedule:
                    if month_year_str and deduction.get("date_format") == month_year_str:
                        deduction["status"] = "completed"
                        deduction["deducted_date"] = datetime.now().strftime("%Y-%m-%d")
                        break
                    elif not month_year_str:
                        # Mark first pending as completed
                        if deduction.get("status") == "pending":
                            deduction["status"] = "completed"
                            deduction["deducted_date"] = datetime.now().strftime("%Y-%m-%d")
                            break
                
                advance.deduction_schedule = json.dumps(schedule)
            except:
                pass
        
        # Check if fully deducted
        if advance.amount_remaining <= 0:
            advance.status = "completed"
            advance.amount_remaining = 0
        
        db.session.commit()
        
        return jsonify({
            "message": "Deduction recorded successfully",
            "advance": advance.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@advance_bp.route("/advance/employee/<email>", methods=["GET"])
def get_employee_advances(email):
    try:
        advances = Advance.query.filter_by(email=email).order_by(Advance.created_at.desc()).all()
        return jsonify([a.to_dict() for a in advances])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@advance_bp.route("/advance/summary", methods=["GET"])
def get_advance_summary():
    try:
        # Get summary statistics
        total_advances = Advance.query.count()
        active_advances = Advance.query.filter_by(status="active").count()
        
        # Calculate totals
        total_amount_result = db.session.query(db.func.sum(Advance.amount)).scalar() or 0
        total_remaining_result = db.session.query(db.func.sum(Advance.amount_remaining)).filter_by(status="active").scalar() or 0
        
        return jsonify({
            "total_advances": total_advances,
            "active_advances": active_advances,
            "total_amount": float(total_amount_result),
            "total_remaining": float(total_remaining_result)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@advance_bp.route("/advance/<int:id>", methods=["DELETE"])
def delete_advance(id):
    try:
        advance = Advance.query.get_or_404(id)
        db.session.delete(advance)
        db.session.commit()
        return jsonify({"message": "Advance deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
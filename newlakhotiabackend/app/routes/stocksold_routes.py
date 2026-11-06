from flask import Blueprint, request, jsonify
from app import db
from app.models.stocksold import StockSold
from datetime import datetime

stock_sold_bp = Blueprint("stock_sold_bp", __name__, url_prefix="/api/stock_sold")

@stock_sold_bp.route("/save", methods=["POST"])
def save_stock_sold():
    try:
        data = request.get_json()
        
        # Create new stock sold record
        sold_record = StockSold(
            task_id=data.get("task_id"),
            item_name=data.get("item_name", ""),
            company_name=data.get("company_name", ""),
            quantity=float(data.get("quantity", 0) or 0),
            unit=data.get("unit", "PCS"),
            sold_date=data.get("sold_date", datetime.now().strftime("%Y-%m-%d")),
            customer_name=data.get("customer_name", ""),
            sold_remarks=data.get("sold_remarks", ""),
            
            # ✅ Stock deducted status (default is "No")
            stock_deducted=data.get("stock_deducted", "No"),
            
            # Additional fields
            hsn_sac=data.get("hsn_sac", ""),
            invoice_remarks=data.get("invoice_remarks", ""),
            invoice_amount=float(data.get("invoice_amount", 0) or 0),
            mrp=float(data.get("mrp", 0) or 0),
            material_type=data.get("material_type", ""),
            production_end_date=data.get("production_end_date", ""),
            production_start_date=data.get("production_start_date", ""),
            production_status=data.get("production_status", ""),
            quality_check=data.get("quality_check", ""),
            thickness=data.get("thickness", ""),
            due_date=data.get("due_date", ""),
            
            # New fields via properties
            length=data.get("length", 0.0),
            width=data.get("width", 0.0),
            batch_code=data.get("batch_code", ""),
            brand_code=data.get("brand_code", ""),
            brand=data.get("brand", "")
        )
        
        db.session.add(sold_record)
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Stock sold record saved successfully",
            "id": sold_record.id
        }), 201
        
    except Exception as e:
        print("ERROR save_stock_sold:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

@stock_sold_bp.route("/all", methods=["GET"])
def get_all_sold():
    try:
        rows = StockSold.query.order_by(StockSold.id.desc()).all()
        out = []
        for r in rows:
            out.append(r.to_dict())
        return jsonify({"success": True, "data": out})
    except Exception as e:
        print("ERROR get_all_sold:", e)
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

@stock_sold_bp.route("/<int:id>", methods=["GET"])
def get_sold_by_id(id):
    try:
        record = StockSold.query.get(id)
        if not record:
            return jsonify({"success": False, "message": "Record not found"}), 404
            
        return jsonify({
            "success": True,
            "data": record.to_dict()
        })
    except Exception as e:
        print("ERROR get_sold_by_id:", e)
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

@stock_sold_bp.route("/update/<int:id>", methods=["PUT"])
def update_sold_record(id):
    try:
        data = request.get_json()
        record = StockSold.query.get(id)
        
        if not record:
            return jsonify({"success": False, "message": "Record not found"}), 404
        
        # Update basic fields
        record.item_name = data.get("item_name", record.item_name)
        record.company_name = data.get("company_name", record.company_name)
        record.quantity = float(data.get("quantity", record.quantity) or 0)
        record.unit = data.get("unit", record.unit)
        record.sold_date = data.get("sold_date", record.sold_date)
        record.customer_name = data.get("customer_name", record.customer_name)
        record.sold_remarks = data.get("sold_remarks", record.sold_remarks)
        
        # ✅ Update stock deducted status
        record.stock_deducted = data.get("stock_deducted", record.stock_deducted)
        if data.get("stock_deducted") == "Yes" and record.stock_deducted != "Yes":
            record.deducted_on = datetime.utcnow()
        elif data.get("stock_deducted") == "No":
            record.deducted_on = None
        
        # Update additional fields
        record.hsn_sac = data.get("hsn_sac", record.hsn_sac)
        record.invoice_remarks = data.get("invoice_remarks", record.invoice_remarks)
        record.invoice_amount = float(data.get("invoice_amount", record.invoice_amount) or 0)
        record.mrp = float(data.get("mrp", record.mrp) or 0)
        record.material_type = data.get("material_type", record.material_type)
        record.production_end_date = data.get("production_end_date", record.production_end_date)
        record.production_start_date = data.get("production_start_date", record.production_start_date)
        record.production_status = data.get("production_status", record.production_status)
        record.quality_check = data.get("quality_check", record.quality_check)
        record.thickness = data.get("thickness", record.thickness)
        record.due_date = data.get("due_date", record.due_date)
        
        # Update property fields
        if 'length' in data:
            record.length = data.get('length')
        if 'width' in data:
            record.width = data.get('width')
        if 'batch_code' in data:
            record.batch_code = data.get('batch_code')
        if 'brand_code' in data:
            record.brand_code = data.get('brand_code')
        if 'brand' in data:
            record.brand = data.get('brand')
        
        db.session.commit()
        
        return jsonify({"success": True, "message": "Record updated successfully"})
        
    except Exception as e:
        print("ERROR update_sold_record:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

@stock_sold_bp.route("/delete/<int:id>", methods=["DELETE"])
def delete_sold_record(id):
    try:
        record = StockSold.query.get(id)
        if not record:
            return jsonify({"success": False, "message": "Record not found"}), 404
            
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({"success": True, "message": "Record deleted successfully"})
        
    except Exception as e:
        print("ERROR delete_sold_record:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

@stock_sold_bp.route("/search", methods=["GET"])
def search_sold_items():
    try:
        item_name = request.args.get("item_name", "")
        customer_name = request.args.get("customer_name", "")
        from_date = request.args.get("from_date", "")
        to_date = request.args.get("to_date", "")
        stock_deducted = request.args.get("stock_deducted", "")  # ✅ Added filter
        
        query = StockSold.query
        
        if item_name:
            query = query.filter(StockSold.item_name.ilike(f"%{item_name}%"))
        if customer_name:
            query = query.filter(StockSold.customer_name.ilike(f"%{customer_name}%"))
        if from_date:
            query = query.filter(StockSold.sold_date >= from_date)
        if to_date:
            query = query.filter(StockSold.sold_date <= to_date)
        if stock_deducted:  # ✅ Filter by stock deducted status
            query = query.filter(StockSold.stock_deducted == stock_deducted)
        
        rows = query.order_by(StockSold.id.desc()).all()
        out = []
        for r in rows:
            out.append(r.to_dict())
            
        return jsonify({"success": True, "data": out})
        
    except Exception as e:
        print("ERROR search_sold_items:", e)
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

# ✅ NEW: Endpoint to mark stock as deducted
@stock_sold_bp.route("/mark_deducted/<int:id>", methods=["PUT"])
def mark_stock_deducted(id):
    try:
        record = StockSold.query.get(id)
        if not record:
            return jsonify({"success": False, "message": "Record not found"}), 404
        
        record.mark_stock_deducted()
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Stock marked as deducted",
            "stock_deducted": record.stock_deducted,
            "deducted_on": record.deducted_on.isoformat() if record.deducted_on else None
        })
        
    except Exception as e:
        print("ERROR mark_stock_deducted:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

# ✅ NEW: Endpoint to mark stock as not deducted
@stock_sold_bp.route("/mark_not_deducted/<int:id>", methods=["PUT"])
def mark_stock_not_deducted(id):
    try:
        record = StockSold.query.get(id)
        if not record:
            return jsonify({"success": False, "message": "Record not found"}), 404
        
        record.mark_stock_not_deducted()
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Stock marked as not deducted",
            "stock_deducted": record.stock_deducted
        })
        
    except Exception as e:
        print("ERROR mark_stock_not_deducted:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

# ✅ NEW: Endpoint to get records with stock not deducted
@stock_sold_bp.route("/not_deducted", methods=["GET"])
def get_not_deducted():
    try:
        rows = StockSold.query.filter_by(stock_deducted="No").order_by(StockSold.id.desc()).all()
        out = []
        for r in rows:
            out.append(r.to_dict())
        return jsonify({"success": True, "data": out})
    except Exception as e:
        print("ERROR get_not_deducted:", e)
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500

# ✅ NEW: Endpoint to bulk update stock deducted status
@stock_sold_bp.route("/bulk_update_deducted", methods=["PUT"])
def bulk_update_deducted():
    try:
        data = request.get_json()
        ids = data.get("ids", [])
        status = data.get("status", "Yes")
        
        if not ids:
            return jsonify({"success": False, "message": "No IDs provided"}), 400
        
        if status not in ["Yes", "No"]:
            return jsonify({"success": False, "message": "Status must be 'Yes' or 'No'"}), 400
        
        records = StockSold.query.filter(StockSold.id.in_(ids)).all()
        
        if not records:
            return jsonify({"success": False, "message": "No records found"}), 404
        
        update_time = datetime.utcnow() if status == "Yes" else None
        
        for record in records:
            record.stock_deducted = status
            record.deducted_on = update_time
        
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": f"Updated {len(records)} records to stock_deducted='{status}'"
        })
        
    except Exception as e:
        print("ERROR bulk_update_deducted:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error: " + str(e)}), 500
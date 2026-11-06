from flask import Blueprint, request, jsonify
from app import db
from app.models.stock import Stock
from flask_cors import CORS
from sqlalchemy import or_, and_

stock_bp = Blueprint("stock_bp", __name__, url_prefix="/api/stock")
CORS(stock_bp)

# -------------------------------------------------------
# SEARCH STOCK (BY BRAND CODE, ITEM NAME, BRAND, HSN, ETC.)
# -------------------------------------------------------
@stock_bp.route("/search", methods=["GET"])
def search_stock():
    try:
        search_term = request.args.get("q", "").strip()
        
        if not search_term:
            return jsonify({"success": False, "message": "Search term required"}), 400
        
        # Search in multiple fields
        search_query = Stock.query.filter(
            or_(
                Stock.brand_code.ilike(f"%{search_term}%"),
                Stock.item_name.ilike(f"%{search_term}%"),
                Stock.brand.ilike(f"%{search_term}%"),
                Stock.hsn.ilike(f"%{search_term}%"),
                Stock.brand_description.ilike(f"%{search_term}%"),
                Stock.batch_code.ilike(f"%{search_term}%")
            )
        ).order_by(Stock.id.desc())
        
        items = search_query.limit(50).all()  # Limit to 50 results
        
        output = []
        for s in items:
            output.append({
                "id": s.id,
                "ID": s.stock_id,
                "Item Name": s.item_name,
                "Brand": s.brand,
                "Length": s.length,
                "Width": s.width,
                "Qty": s.quantity,
                "AutoCalculate Count": s.auto_calculate_count,
                "Buy Price": s.buy_price,
                "Batch Code": s.batch_code,
                "Brand Code": s.brand_code,
                "Brand Description": s.brand_description,
                "HSN": s.hsn,
                "MRP": s.mrp,
                "Unit": s.unit,
                "GST": s.gst,
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        return jsonify({
            "success": True, 
            "data": output,
            "count": len(output)
        }), 200
        
    except Exception as e:
        print("Search Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# CHECK BATCH UNIQUE ENDPOINT - FIXED to properly handle different batch codes
# -------------------------------------------------------
@stock_bp.route("/check-batch-unique", methods=["POST", "OPTIONS"])
def check_batch_unique():
    """Check which item+batch combinations already exist in stock.
    IMPORTANT: Items with different batch codes are ALWAYS considered unique,
    even if other fields match."""
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200
    
    try:
        data = request.get_json()
        items = data.get("items", [])
        
        if not items:
            return jsonify({
                'success': True,
                'existing': [],
                'existing_keys': []
            })
        
        existing_items = []
        existing_keys = set()
        
        for item in items:
            item_name = item.get('item_name', '').strip()
            batch_code = item.get('batch_code', '').strip() if item.get('batch_code') else ''
            brand_code = item.get('brand_code', '').strip()
            
            # Skip items without item name
            if not item_name:
                continue
            
            # Build query based on available fields
            if batch_code:
                # If batch code is provided, use exact match with both item name and batch code
                stock_item = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        Stock.batch_code == batch_code
                    )
                ).first()
            else:
                # If no batch code, only match items that also have no batch code
                stock_item = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                    )
                ).first()
            
            if stock_item:
                key = f"{item_name}|{batch_code if batch_code else 'NO_BATCH'}"
                existing_keys.add(key)
                existing_items.append({
                    'id': stock_item.id,
                    'stock_id': stock_item.stock_id,
                    'item_name': stock_item.item_name,
                    'batch_code': stock_item.batch_code,
                    'brand_code': stock_item.brand_code,
                    'quantity': stock_item.quantity,
                    'length': stock_item.length,
                    'width': stock_item.width,
                    'buy_price': stock_item.buy_price,
                    'mrp': stock_item.mrp,
                    'unit': stock_item.unit
                })
        
        return jsonify({
            'success': True,
            'existing': existing_items,
            'existing_keys': list(existing_keys)
        })
        
    except Exception as e:
        print(f"Error in check_batch_unique: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# -------------------------------------------------------
# GET BUY PRICE BY BRAND CODE (SPECIFIC ENDPOINT)
# -------------------------------------------------------
@stock_bp.route("/buy-price/<string:brand_code>", methods=["GET"])
def get_buy_price(brand_code):
    try:
        if not brand_code or brand_code.strip() == "":
            return jsonify({"success": False, "message": "Brand Code required"}), 400
        
        stock = Stock.query.filter_by(brand_code=brand_code.strip()).first()
        
        if not stock:
            return jsonify({
                "success": False, 
                "message": f"Stock item with Brand Code '{brand_code}' not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": {
                "stock_id": stock.stock_id,
                "brand_code": stock.brand_code,
                "item_name": stock.item_name,
                "buy_price": stock.buy_price,
                "mrp": stock.mrp,
                "brand": stock.brand,
                "hsn": stock.hsn,
                "unit": stock.unit,
                "batch_code": stock.batch_code
            }
        }), 200
        
    except Exception as e:
        print("Get Buy Price Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# GET MULTIPLE BUY PRICES (BULK LOOKUP)
# -------------------------------------------------------
@stock_bp.route("/bulk-buy-prices", methods=["POST"])
def get_bulk_buy_prices():
    try:
        data = request.get_json()
        brand_codes = data.get("brand_codes", [])
        
        if not brand_codes:
            return jsonify({"success": False, "message": "Brand codes list required"}), 400
        
        # Remove duplicates and empty strings
        unique_codes = list(set([code.strip() for code in brand_codes if code and str(code).strip()]))
        
        if not unique_codes:
            return jsonify({"success": False, "message": "No valid brand codes provided"}), 400
        
        # Query for all brand codes at once
        stocks = Stock.query.filter(Stock.brand_code.in_(unique_codes)).all()
        
        # Create a map for quick lookup
        stock_map = {stock.brand_code: stock for stock in stocks}
        
        results = []
        not_found = []
        
        for code in unique_codes:
            stock = stock_map.get(code)
            if stock:
                results.append({
                    "stock_id": stock.stock_id,
                    "brand_code": code,
                    "item_name": stock.item_name,
                    "buy_price": stock.buy_price,
                    "mrp": stock.mrp,
                    "brand": stock.brand,
                    "hsn": stock.hsn,
                    "unit": stock.unit,
                    "batch_code": stock.batch_code
                })
            else:
                not_found.append(code)
        
        return jsonify({
            "success": True,
            "data": results,
            "not_found": not_found,
            "found_count": len(results),
            "not_found_count": len(not_found)
        }), 200
        
    except Exception as e:
        print("Bulk Buy Prices Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# BULK SAVE (INSERT NEW RECORDS) - FIXED: Treats different batch codes as unique
# -------------------------------------------------------
@stock_bp.route("/bulk-save", methods=["POST", "OPTIONS"])
def bulk_save_stock():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        data = request.get_json()
        records = data.get("records", [])

        if not records:
            return jsonify({"success": False, "message": "No data provided"}), 400

        saved = 0
        new_count = 0
        updated_count = 0
        duplicate_strings = []
        duplicate_details = []
        skipped = []

        for r in records:
            stock_id = str(r.get("ID", "")).strip()
            brand_code = str(r.get("Brand Code", "")).strip()
            batch_code = str(r.get("Batch Code", "")).strip()
            item_name = str(r.get("Item Name", "")).strip()
            
            # Skip if no item name
            if not item_name:
                skipped.append("Item with no name")
                continue
            
            # CRITICAL: Check for existing item using Item Name + Batch Code combination
            # Different batch codes mean different items!
            existing_stock = None
            if item_name:
                if batch_code:
                    # If batch code is provided, require exact match on both
                    existing_stock = Stock.query.filter(
                        and_(
                            Stock.item_name == item_name,
                            Stock.batch_code == batch_code
                        )
                    ).first()
                else:
                    # If no batch code, only match items with no batch code
                    existing_stock = Stock.query.filter(
                        and_(
                            Stock.item_name == item_name,
                            or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                        )
                    ).first()
            
            # If not found by Item Name + Batch Code, try stock_id (but careful!)
            if not existing_stock and stock_id:
                existing_stock = Stock.query.filter_by(stock_id=stock_id).first()
            
            # If found, update existing item
            if existing_stock:
                # Parse numeric values
                try:
                    length_val = float(r.get("Length", existing_stock.length)) if r.get("Length") is not None else existing_stock.length
                    width_val = float(r.get("Width", existing_stock.width)) if r.get("Width") is not None else existing_stock.width
                    qty_val = float(r.get("Qty", existing_stock.quantity)) if r.get("Qty") is not None else existing_stock.quantity
                    auto_count = length_val * width_val * qty_val
                except:
                    length_val = existing_stock.length
                    width_val = existing_stock.width
                    qty_val = existing_stock.quantity
                    auto_count = existing_stock.auto_calculate_count
                
                # Update fields
                if item_name:
                    existing_stock.item_name = item_name
                if r.get("Brand"):
                    existing_stock.brand = r.get("Brand", existing_stock.brand).strip()
                if r.get("Length") is not None:
                    existing_stock.length = length_val
                if r.get("Width") is not None:
                    existing_stock.width = width_val
                if r.get("Qty") is not None:
                    existing_stock.quantity = qty_val
                    existing_stock.auto_calculate_count = auto_count
                if r.get("Buy Price") is not None:
                    existing_stock.buy_price = float(r.get("Buy Price", existing_stock.buy_price))
                if r.get("Batch Code"):
                    existing_stock.batch_code = batch_code
                if r.get("Brand Code"):
                    existing_stock.brand_code = brand_code
                if r.get("Brand Description"):
                    existing_stock.brand_description = r.get("Brand Description", existing_stock.brand_description).strip()
                if r.get("HSN"):
                    existing_stock.hsn = r.get("HSN", existing_stock.hsn).strip()
                if r.get("MRP") is not None:
                    existing_stock.mrp = float(r.get("MRP", existing_stock.mrp))
                if r.get("Unit"):
                    existing_stock.unit = r.get("Unit", existing_stock.unit).strip()
                if r.get("GST") is not None:
                    existing_stock.gst = float(r.get("GST", existing_stock.gst))
                
                updated_count += 1
                duplicate_strings.append(f"{item_name} (Batch: {batch_code if batch_code else 'NO BATCH'})")
                duplicate_details.append({
                    "item_name": item_name,
                    "batch_code": batch_code,
                    "reason": "Updated existing item"
                })
                continue
            
            # If no ID provided, generate one from item name and batch code
            if not stock_id and item_name:
                stock_id = f"ID_{item_name.replace(' ', '_')}"
                if batch_code:
                    stock_id = f"ID_{item_name.replace(' ', '_')}_{batch_code}"
            
            # Parse numeric values with defaults
            try:
                length_val = float(r.get("Length", 0)) if r.get("Length") else 0
                width_val = float(r.get("Width", 0)) if r.get("Width") else 0
                qty_val = float(r.get("Qty", 0)) if r.get("Qty") else 0
                auto_count = length_val * width_val * qty_val
            except:
                length_val = 0
                width_val = 0
                qty_val = 0
                auto_count = 0

            # CREATE NEW RECORD
            new_stock = Stock(
                stock_id=stock_id,
                item_name=item_name,
                brand=r.get("Brand", "").strip(),
                length=length_val,
                width=width_val,
                quantity=qty_val,
                auto_calculate_count=auto_count,
                buy_price=float(r.get("Buy Price", 0)) if r.get("Buy Price") else 0,
                batch_code=batch_code if batch_code else None,
                brand_code=brand_code if brand_code else None,
                brand_description=r.get("Brand Description", "").strip(),
                hsn=r.get("HSN", "").strip(),
                mrp=float(r.get("MRP", 0)) if r.get("MRP") else 0,
                unit=r.get("Unit", "").strip(),
                gst=float(r.get("GST", 0)) if r.get("GST") else 0
            )

            db.session.add(new_stock)
            saved += 1
            new_count += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Bulk stock saved successfully",
            "saved": saved,
            "new_count": new_count,
            "updated_count": updated_count,
            "duplicates": duplicate_strings,
            "duplicate_details": duplicate_details,
            "skipped": skipped
        }), 200

    except Exception as e:
        print("Bulk Save Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": f"Server Error: {str(e)}"}), 500


# -------------------------------------------------------
# BULK UPDATE ALL FIELDS (USING ID, BRAND CODE, OR BATCH CODE)
# -------------------------------------------------------
@stock_bp.route("/update", methods=["PUT", "OPTIONS"])
def update_stock_bulk():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        data = request.get_json()
        
        # Support both formats: { "records": [...] } or { "criteria": {...}, "updateData": {...} }
        if "criteria" in data and "updateData" in data:
            # Single item update format
            records = [{
                **data["updateData"],
                **data["criteria"]
            }]
        elif "records" in data:
            records = data.get("records", [])
        else:
            return jsonify({"success": False, "message": "Invalid request format"}), 400

        if not records:
            return jsonify({"success": False, "message": "No data found"}), 400

        updated_count = 0
        not_found = []

        for r in records:
            # Remove React internal ID if present
            if '_id' in r:
                del r['_id']
            
            stock_id = str(r.get("ID", "")).strip()
            brand_code = str(r.get("Brand Code", "")).strip()
            batch_code = str(r.get("Batch Code", "")).strip()
            item_name = str(r.get("Item Name", "")).strip()
            
            stock = None
            
            # Try by Item Name + Batch Code combination (most accurate)
            if item_name and batch_code:
                stock = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        Stock.batch_code == batch_code
                    )
                ).first()
            elif item_name and not batch_code:
                # If no batch code, match items with no batch code
                stock = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                    )
                ).first()
            
            # Try by ID
            if not stock and stock_id:
                stock = Stock.query.filter_by(stock_id=stock_id).first()
            
            # Try by Brand Code + Batch Code combination
            if not stock and brand_code and batch_code:
                stock = Stock.query.filter_by(
                    brand_code=brand_code, 
                    batch_code=batch_code
                ).first()
            
            # Try by Brand Code only (be careful - might match wrong item)
            if not stock and brand_code:
                stock = Stock.query.filter_by(brand_code=brand_code).first()

            if not stock:
                not_found.append(stock_id if stock_id else brand_code if brand_code else batch_code if batch_code else item_name)
                continue

            # Parse and calculate auto count
            try:
                length_val = float(r.get("Length", stock.length)) if r.get("Length") is not None else stock.length
                width_val = float(r.get("Width", stock.width)) if r.get("Width") is not None else stock.width
                qty_val = float(r.get("Qty", stock.quantity)) if r.get("Qty") is not None else stock.quantity
                auto_count = length_val * width_val * qty_val
            except:
                length_val = stock.length
                width_val = stock.width
                qty_val = stock.quantity
                auto_count = stock.auto_calculate_count
            
            # Update fields only if they are provided
            if "Item Name" in r:
                stock.item_name = r.get("Item Name", stock.item_name).strip()
            if "Brand" in r:
                stock.brand = r.get("Brand", stock.brand).strip()
            if "Length" in r:
                stock.length = length_val
            if "Width" in r:
                stock.width = width_val
            if "Qty" in r:
                stock.quantity = qty_val
                stock.auto_calculate_count = auto_count
            if "AutoCalculate Count" in r:
                stock.auto_calculate_count = auto_count
            if "Buy Price" in r:
                stock.buy_price = float(r.get("Buy Price", stock.buy_price))
            if "Batch Code" in r:
                stock.batch_code = r.get("Batch Code", stock.batch_code).strip()
            if "Brand Code" in r:
                stock.brand_code = r.get("Brand Code", stock.brand_code).strip()
            if "Brand Description" in r:
                stock.brand_description = r.get("Brand Description", stock.brand_description).strip()
            if "HSN" in r:
                stock.hsn = r.get("HSN", stock.hsn).strip()
            if "MRP" in r:
                stock.mrp = float(r.get("MRP", stock.mrp))
            if "Unit" in r:
                stock.unit = r.get("Unit", stock.unit).strip()
            if "GST" in r:
                stock.gst = float(r.get("GST", stock.gst))

            updated_count += 1

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Stock updated successfully",
            "updated": updated_count,
            "not_found": not_found
        }), 200

    except Exception as e:
        print("Bulk Update Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# UPDATE SINGLE ITEM (DEDICATED ENDPOINT FOR FRONTEND)
# -------------------------------------------------------
@stock_bp.route("/update-single", methods=["PUT", "OPTIONS"])
def update_stock_single():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        data = request.get_json()
        criteria = data.get("criteria", {})
        update_data = data.get("updateData", {})

        if not criteria:
            return jsonify({"success": False, "message": "No criteria provided"}), 400

        # Find the stock item
        stock_id = str(criteria.get("ID", "")).strip()
        brand_code = str(criteria.get("Brand Code", "")).strip()
        batch_code = str(criteria.get("Batch Code", "")).strip()
        item_name = str(criteria.get("Item Name", "")).strip()
        
        stock = None
        
        # Try by Item Name + Batch Code combination
        if item_name and batch_code:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    Stock.batch_code == batch_code
                )
            ).first()
        elif item_name and not batch_code:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                )
            ).first()
        
        # Try by ID
        if not stock and stock_id:
            stock = Stock.query.filter_by(stock_id=stock_id).first()
        
        # Try by Brand Code + Batch Code combination
        if not stock and brand_code and batch_code:
            stock = Stock.query.filter_by(
                brand_code=brand_code, 
                batch_code=batch_code
            ).first()
        
        # Try by Brand Code only
        if not stock and brand_code:
            stock = Stock.query.filter_by(brand_code=brand_code).first()

        if not stock:
            return jsonify({
                "success": False, 
                "message": f"Stock item not found with criteria: {criteria}"
            }), 404

        # Update the stock item
        field_mapping = {
            "ID": "stock_id",
            "Item Name": "item_name",
            "Brand": "brand",
            "Length": "length",
            "Width": "width",
            "Qty": "quantity",
            "Buy Price": "buy_price",
            "Batch Code": "batch_code",
            "Brand Code": "brand_code",
            "Brand Description": "brand_description",
            "HSN": "hsn",
            "MRP": "mrp",
            "Unit": "unit",
            "GST": "gst"
        }
        
        for key, value in update_data.items():
            if key in field_mapping:
                db_field = field_mapping[key]
                if key in ["Length", "Width", "Qty", "Buy Price", "MRP", "GST"]:
                    setattr(stock, db_field, float(value) if value else 0)
                else:
                    setattr(stock, db_field, str(value).strip() if value else "")
            elif key == "AutoCalculate Count":
                pass

        # Recalculate auto count if quantity, length, or width changed
        if "Length" in update_data or "Width" in update_data or "Qty" in update_data:
            stock.auto_calculate_count = stock.length * stock.width * stock.quantity

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Stock updated successfully"
        }), 200

    except Exception as e:
        print("Single Update Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500


# -------------------------------------------------------
# UPDATE QUANTITY SPECIFICALLY (PUT METHOD)
# -------------------------------------------------------
@stock_bp.route("/update-quantity", methods=["PUT", "OPTIONS"])
def update_quantity_bulk():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        data = request.get_json()
        records = data.get("records", [])

        if not records:
            return jsonify({"success": False, "message": "No data found"}), 400

        updated = 0
        not_found = []

        for r in records:
            stock_id = str(r.get("ID", "")).strip()
            brand_code = str(r.get("Brand Code", "")).strip()
            batch_code = str(r.get("Batch Code", "")).strip()
            item_name = str(r.get("Item Name", "")).strip()
            new_quantity = r.get("Qty", None)
            
            if new_quantity is None:
                continue

            stock = None
            
            # Try by Item Name + Batch Code
            if item_name and batch_code:
                stock = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        Stock.batch_code == batch_code
                    )
                ).first()
            elif item_name and not batch_code:
                stock = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                    )
                ).first()
            
            if not stock and stock_id:
                stock = Stock.query.filter_by(stock_id=stock_id).first()
            
            if not stock and brand_code and batch_code:
                stock = Stock.query.filter_by(
                    brand_code=brand_code, 
                    batch_code=batch_code
                ).first()
            
            if not stock and brand_code:
                stock = Stock.query.filter_by(brand_code=brand_code).first()

            if stock:
                try:
                    qty_val = float(new_quantity)
                    stock.quantity = qty_val
                    stock.auto_calculate_count = stock.length * stock.width * qty_val
                    updated += 1
                except ValueError:
                    not_found.append(f"{stock_id if stock_id else brand_code} (invalid quantity)")
            else:
                not_found.append(stock_id if stock_id else brand_code if brand_code else batch_code if batch_code else item_name)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Quantity updated successfully",
            "updated": updated,
            "not_found": not_found
        }), 200

    except Exception as e:
        print("Bulk Quantity Update Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# UPDATE ONLY MRP (USING PUT)
# -------------------------------------------------------
@stock_bp.route("/update-mrp", methods=["PUT", "OPTIONS"])
def update_mrp_bulk():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        data = request.get_json()
        records = data.get("records", [])

        if not records:
            return jsonify({"success": False, "message": "No data found"}), 400

        updated = 0
        not_found = []

        for r in records:
            stock_id = str(r.get("ID", "")).strip()
            brand_code = str(r.get("Brand Code", "")).strip()
            batch_code = str(r.get("Batch Code", "")).strip()
            item_name = str(r.get("Item Name", "")).strip()
            mrp = r.get("NBP", r.get("MRP", r.get("mrp", None)))

            stock = None
            
            if item_name and batch_code:
                stock = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        Stock.batch_code == batch_code
                    )
                ).first()
            elif item_name and not batch_code:
                stock = Stock.query.filter(
                    and_(
                        Stock.item_name == item_name,
                        or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                    )
                ).first()
            
            if not stock and stock_id:
                stock = Stock.query.filter_by(stock_id=stock_id).first()
            
            if not stock and brand_code and batch_code:
                stock = Stock.query.filter_by(
                    brand_code=brand_code, 
                    batch_code=batch_code
                ).first()
            
            if not stock and brand_code:
                stock = Stock.query.filter_by(brand_code=brand_code).first()

            if stock:
                if mrp is not None:
                    stock.mrp = float(mrp)
                updated += 1
            else:
                not_found.append(stock_id if stock_id else brand_code if brand_code else batch_code if batch_code else item_name)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "MRP updated successfully",
            "updated": updated,
            "not_found": not_found
        }), 200

    except Exception as e:
        print("Bulk MRP Update Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# GET ALL STOCK
# -------------------------------------------------------
@stock_bp.route("/all", methods=["GET"])
def get_all_stock():
    try:
        items = Stock.query.order_by(Stock.id.desc()).all()

        output = []
        for s in items:
            output.append({
                "id": s.id,
                "ID": s.stock_id,
                "Item Name": s.item_name,
                "Brand": s.brand,
                "Length": s.length,
                "Width": s.width,
                "Qty": s.quantity,
                "AutoCalculate Count": s.auto_calculate_count,
                "Buy Price": s.buy_price,
                "Batch Code": s.batch_code,
                "Brand Code": s.brand_code,
                "Brand Description": s.brand_description,
                "HSN": s.hsn,
                "MRP": s.mrp,
                "Unit": s.unit,
                "GST": s.gst,
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        return jsonify({"success": True, "data": output}), 200

    except Exception as e:
        print("Get All Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# DELETE STOCK BY ID, BRAND CODE, or BATCH CODE
# -------------------------------------------------------
@stock_bp.route("/delete", methods=["DELETE", "OPTIONS"])
def delete_stock():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        data = request.get_json()
        stock_id = str(data.get("ID", "")).strip()
        brand_code = str(data.get("Brand Code", "")).strip()
        batch_code = str(data.get("Batch Code", "")).strip()
        item_name = str(data.get("Item Name", "")).strip()

        stock = None
        
        # Try by Item Name + Batch Code
        if item_name and batch_code:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    Stock.batch_code == batch_code
                )
            ).first()
        elif item_name and not batch_code:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                )
            ).first()
        
        # Try by ID
        if not stock and stock_id:
            stock = Stock.query.filter_by(stock_id=stock_id).first()
        
        # Try by Brand Code + Batch Code combination
        if not stock and brand_code and batch_code:
            stock = Stock.query.filter_by(
                brand_code=brand_code, 
                batch_code=batch_code
            ).first()
        
        # Try by Brand Code only
        if not stock and brand_code:
            stock = Stock.query.filter_by(brand_code=brand_code).first()

        if not stock:
            return jsonify({
                "success": False,
                "message": "Stock item not found"
            }), 404

        db.session.delete(stock)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Stock deleted successfully"
        }), 200

    except Exception as e:
        print("Delete Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# GET STOCK BY BATCH CODE
# -------------------------------------------------------
@stock_bp.route("/batch/<string:batch_code>", methods=["GET"])
def get_stock_by_batch(batch_code):
    try:
        if not batch_code or batch_code.strip() == "":
            return jsonify({"success": False, "message": "Batch Code required"}), 400
        
        stock = Stock.query.filter_by(batch_code=batch_code.strip()).first()
        
        if not stock:
            return jsonify({
                "success": False, 
                "message": f"Stock item with Batch Code '{batch_code}' not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": {
                "id": stock.id,
                "ID": stock.stock_id,
                "Item Name": stock.item_name,
                "Brand": stock.brand,
                "Length": stock.length,
                "Width": stock.width,
                "Qty": stock.quantity,
                "AutoCalculate Count": stock.auto_calculate_count,
                "Buy Price": stock.buy_price,
                "Batch Code": stock.batch_code,
                "Brand Code": stock.brand_code,
                "Brand Description": stock.brand_description,
                "HSN": stock.hsn,
                "MRP": stock.mrp,
                "Unit": stock.unit,
                "GST": stock.gst
            }
        }), 200
        
    except Exception as e:
        print("Get Stock by Batch Code Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# GET STOCK BY ITEM NAME AND BATCH CODE
# -------------------------------------------------------
@stock_bp.route("/by-item-batch", methods=["POST"])
def get_stock_by_item_batch():
    try:
        data = request.get_json()
        item_name = data.get("item_name", "").strip()
        batch_code = data.get("batch_code", "").strip()
        
        if not item_name:
            return jsonify({"success": False, "message": "Item Name required"}), 400
        
        if batch_code:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    Stock.batch_code == batch_code
                )
            ).first()
        else:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                )
            ).first()
        
        if not stock:
            return jsonify({
                "success": False, 
                "message": f"Stock item with Item Name '{item_name}' and Batch Code '{batch_code}' not found"
            }), 404
        
        return jsonify({
            "success": True,
            "data": {
                "id": stock.id,
                "ID": stock.stock_id,
                "Item Name": stock.item_name,
                "Brand": stock.brand,
                "Length": stock.length,
                "Width": stock.width,
                "Qty": stock.quantity,
                "AutoCalculate Count": stock.auto_calculate_count,
                "Buy Price": stock.buy_price,
                "Batch Code": stock.batch_code,
                "Brand Code": stock.brand_code,
                "Brand Description": stock.brand_description,
                "HSN": stock.hsn,
                "MRP": stock.mrp,
                "Unit": stock.unit,
                "GST": stock.gst
            }
        }), 200
        
    except Exception as e:
        print("Get Stock by Item Name and Batch Code Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# CHECK IF ITEM NAME AND BATCH CODE COMBINATION EXISTS
# -------------------------------------------------------
@stock_bp.route("/exists", methods=["POST"])
def check_item_exists():
    try:
        data = request.get_json()
        item_name = data.get("item_name", "").strip()
        batch_code = data.get("batch_code", "").strip()
        
        if not item_name:
            return jsonify({"success": False, "message": "Item Name required"}), 400
        
        if batch_code:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    Stock.batch_code == batch_code
                )
            ).first()
        else:
            stock = Stock.query.filter(
                and_(
                    Stock.item_name == item_name,
                    or_(Stock.batch_code == '', Stock.batch_code.is_(None))
                )
            ).first()
        
        return jsonify({
            "success": True,
            "exists": stock is not None,
            "data": {
                "id": stock.id if stock else None,
                "quantity": stock.quantity if stock else None
            } if stock else None
        }), 200
        
    except Exception as e:
        print("Check Item Exists Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500
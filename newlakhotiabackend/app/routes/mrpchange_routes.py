from flask import Blueprint, request, jsonify
from app import db
from app.models.mrpchange import Product
import pandas as pd
import os

mrp_bp = Blueprint("mrp_bp", __name__, url_prefix="/api/mrp")


# -------------------------------------------------------
# ✔ BULK SAVE MRP (REPLACE MODE)
# -------------------------------------------------------
@mrp_bp.route("/bulk-save", methods=["POST"])
def bulk_save_mrp():
    try:
        # Check if a file is uploaded
        if "file" not in request.files:
            return jsonify({"success": False, "message": "No file uploaded"}), 400

        file = request.files["file"]

        # Save uploaded file
        upload_folder = "uploads"
        os.makedirs(upload_folder, exist_ok=True)
        filepath = os.path.join(upload_folder, file.filename)
        file.save(filepath)

        # Read Excel file
        df = pd.read_excel(filepath)

        # Normalize column names: item_name, brand_code, etc.
        df.columns = df.columns.str.lower().str.replace(" ", "_")

        # Required columns
        required_cols = ["item_name", "brand", "brand_code", "brand_description", "mrp"]

        for col in required_cols:
            if col not in df.columns:
                return jsonify({"success": False, "message": f"Missing column: {col}"}), 400

        # -------------------------------
        # ❌ Delete all existing MRP records
        # -------------------------------
        Product.query.delete()
        db.session.commit()

        # -------------------------------
        # ✅ Insert new Excel records
        # -------------------------------
        for _, row in df.iterrows():

            item_name = str(row.get("item_name", "")).strip()
            brand = str(row.get("brand", "")).strip()
            brand_code = str(row.get("brand_code", "")).strip()
            brand_description = str(row.get("brand_description", "")).strip()
            mrp_value = float(row.get("mrp", 0) or 0)

            # Skip blank rows
            if not item_name or not brand:
                continue

            product = Product(
                item_name=item_name,
                brand=brand,
                brand_code=brand_code,
                brand_description=brand_description,
                mrp=mrp_value
            )

            db.session.add(product)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "MRP table replaced successfully!"
        }), 200

    except Exception as e:
        print("MRP Save Error:", e)
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error"}), 500


# -------------------------------------------------------
# ✔ GET ALL MRP RECORDS
# -------------------------------------------------------
@mrp_bp.route("/all", methods=["GET"])
def get_all_mrp():
    try:
        products = Product.query.order_by(Product.id.desc()).all()
        data = [p.to_dict() for p in products]

        return jsonify({"success": True, "data": data}), 200

    except Exception as e:
        print("MRP Fetch Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500

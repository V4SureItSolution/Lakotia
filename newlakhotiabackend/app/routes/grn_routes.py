from flask import Blueprint, request, jsonify
from datetime import datetime
from sqlalchemy import func, and_, or_
from app import db
from app.models.grn import GRN, is_po_fully_delivered
from app.models.purchaseorder import PurchaseOrder

grn_bp = Blueprint("grn_bp", __name__, url_prefix="/api/grn")


# -------------------------------------------------------------------
# HELPER: Reconcile and group pending receipts by receipt_id
# -------------------------------------------------------------------
def reconcile_and_get_pending_receipts(po):
    po_received_items = po.received_items or []
    modified = False
    
    # Get existing deliveries from GRN table
    existing_deliveries = GRN.query.filter_by(po_number=po.po_number, status='active').all()
    existing_grn_totals = {}
    for delivery in existing_deliveries:
        existing_grn_totals[delivery.item_name] = existing_grn_totals.get(delivery.item_name, 0.0) + delivery.quantity
        
    for idx, rec in enumerate(po_received_items):
        history = rec.get('receipt_history', [])
        item_name = rec.get('item_name')
        for h_idx, h in enumerate(history):
            if 'receipt_id' not in h:
                date_str = h.get('date') or datetime.utcnow().isoformat()
                h['receipt_id'] = f"REC-LEGACY-{date_str.replace(':', '').replace('-', '').replace('.', '')}-{idx}-{h_idx}"
                modified = True
            
            if 'grn_generated' not in h:
                qty = float(h.get('quantity', 0))
                grn_qty = existing_grn_totals.get(item_name, 0.0)
                if grn_qty >= qty:
                    h['grn_generated'] = True
                    existing_grn_totals[item_name] -= qty
                    modified = True
                else:
                    h['grn_generated'] = False
                    modified = True
                    
    if modified:
        po.received_items = po_received_items
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(po, "received_items")
        db.session.commit()
        
    # Group by receipt_id
    receipts_map = {}
    for idx, rec in enumerate(po_received_items):
        item_name = rec.get('item_name')
        history = rec.get('receipt_history', [])
        
        po_item = None
        for p_item in po.items:
            if p_item.get('item_name') == item_name:
                po_item = p_item
                break
                
        if not po_item:
            continue
            
        for h in history:
            if not h.get('grn_generated', False):
                r_id = h.get('receipt_id')
                r_date = h.get('date')
                r_qty = float(h.get('quantity', 0))
                r_remarks = h.get('remarks', '')
                
                if r_id not in receipts_map:
                    receipts_map[r_id] = {
                        "receipt_id": r_id,
                        "date": r_date,
                        "remarks": r_remarks,
                        "items": []
                    }
                    
                receipts_map[r_id]["items"].append({
                    "item_name": item_name,
                    "brand": po_item.get("brand", ""),
                    "brand_code": po_item.get("brand_code", ""),
                    "brand_description": po_item.get("brand_description", ""),
                    "hsn_code": po_item.get("hsn_code", ""),
                    "length": po_item.get("length", ""),
                    "width": po_item.get("width", ""),
                    "unit": po_item.get("unit", "PCS"),
                    "buy_price": float(po_item.get("buy_price", 0)),
                    "original_quantity": float(po_item.get("quantity", 0)),
                    "received_quantity": r_qty,
                    "item_index": idx
                })
                
    pending_receipts = list(receipts_map.values())
    pending_receipts.sort(key=lambda x: x.get('date', ''))
    return pending_receipts


# -------------------------------------------------------------------
# GET ALL BATCH CODES (For duplicate prevention)
# -------------------------------------------------------------------
@grn_bp.route("/all-batch-codes", methods=["GET"])
def get_all_batch_codes():
    try:
        # Get all active batch codes
        batch_codes = db.session.query(GRN.batch_code).filter(
            GRN.status == 'active'
        ).all()
        
        batch_code_list = [bc[0] for bc in batch_codes if bc[0]]
        
        return jsonify({
            'success': True,
            'count': len(batch_code_list),
            'data': batch_code_list
        }), 200
        
    except Exception as e:
        print(f"Error fetching batch codes: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# -------------------------------------------------------------------
# GET ALL POs WITH DELIVERY STATUS (Completed & Partially Delivered)
# -------------------------------------------------------------------
@grn_bp.route("/all-pos-with-status", methods=["GET"])
def get_all_pos_with_status():
    try:
        # Get all completed POs
        all_pos = PurchaseOrder.query.filter(
            PurchaseOrder.status == 'completed','approved'
        ).order_by(PurchaseOrder.created_on.desc()).all()
        
        # Get all partial deliveries from GRN
        partial_deliveries = db.session.query(
            GRN.po_number,
            GRN.item_name,
            func.sum(GRN.quantity).label('total_delivered')
        ).filter(
            GRN.status == 'active'
        ).group_by(GRN.po_number, GRN.item_name).all()
        
        # Create delivery tracking dict
        delivery_tracking = {}
        for delivery in partial_deliveries:
            if delivery.po_number not in delivery_tracking:
                delivery_tracking[delivery.po_number] = {}
            delivery_tracking[delivery.po_number][delivery.item_name] = delivery.total_delivered
        
        completed_pos = []
        partial_pos = []
        
        for po in all_pos:
            po_dict = po.to_dict()
            items = po.items if po.items else []
            
            # Calculate delivery status for each PO
            total_items = len(items)
            delivered_items = 0
            total_delivered_qty = 0
            total_ordered_qty = 0
            
            # Track if all items are fully delivered
            all_items_fully_delivered = True
            po_delivery_tracking = delivery_tracking.get(po.po_number, {})
            
            for item in items:
                item_name = item.get('item_name')
                ordered_qty = item.get('quantity', 0)
                delivered_qty = po_delivery_tracking.get(item_name, 0)
                
                total_ordered_qty += ordered_qty
                total_delivered_qty += min(delivered_qty, ordered_qty)
                
                if delivered_qty >= ordered_qty:
                    delivered_items += 1
                else:
                    all_items_fully_delivered = False
            
            # Check if GRN already exists
            existing_grn = GRN.query.filter_by(po_number=po.po_number).first()
            po_dict['has_grn'] = existing_grn is not None
            po_dict['grn_invoice'] = existing_grn.invoice_number if existing_grn else None
            
            if all_items_fully_delivered:
                # Fully delivered PO
                po_dict['delivery_status'] = 'completed'
                po_dict['delivered_percent'] = 100
                po_dict['delivered_items'] = total_items
                po_dict['total_items'] = total_items
                completed_pos.append(po_dict)
            else:
                # Partially delivered PO
                delivered_percent = (total_delivered_qty / total_ordered_qty * 100) if total_ordered_qty > 0 else 0
                po_dict['delivery_status'] = 'partial'
                po_dict['delivered_percent'] = round(delivered_percent, 1)
                po_dict['delivered_items'] = delivered_items
                po_dict['total_items'] = total_items
                po_dict['delivered_quantity'] = total_delivered_qty
                po_dict['total_quantity'] = total_ordered_qty
                partial_pos.append(po_dict)
        
        return jsonify({
            'success': True,
            'data': {
                'completed': completed_pos,
                'partial': partial_pos
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching POs with status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# -------------------------------------------------------------------
# GET POs READY FOR GRN (Approved & Partially Received)
# -------------------------------------------------------------------
@grn_bp.route("/ready-for-grn", methods=["GET"])
def get_pos_ready_for_grn():
    try:
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.status.in_(['approved', 'partially_received', 'completed'])
        ).order_by(PurchaseOrder.created_on.desc()).all()
        
        result = []
        for po in purchase_orders:
            pending_receipts = reconcile_and_get_pending_receipts(po)
            
            # Only include PO if it has pending receipts
            if pending_receipts:
                po_dict = po.to_dict()
                # Include pending receipts details in the response
                po_dict['pending_receipts'] = pending_receipts
                po_dict['remaining_amount'] = sum(
                    float(item.get('received_quantity', 0)) * float(item.get('buy_price', 0))
                    for r in pending_receipts for item in r['items']
                )
                po_dict['delivery_status'] = 'partial' if po.status == 'partially_received' else 'pending'
                result.append(po_dict)
        
        return jsonify({
            'success': True,
            'count': len(result),
            'data': result
        }), 200
        
    except Exception as e:
        print(f"Error getting POs ready for GRN: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# -------------------------------------------------------------------
# GET PARTIAL DELIVERIES SUMMARY
# -------------------------------------------------------------------
@grn_bp.route("/partial-deliveries", methods=["GET"])
def get_partial_deliveries():
    try:
        # Get all partial deliveries (items with remaining quantity)
        partial_deliveries = db.session.query(
            GRN.po_number,
            GRN.item_name,
            func.sum(GRN.quantity).label('total_delivered')
        ).filter(
            GRN.status == 'active'
        ).group_by(GRN.po_number, GRN.item_name).all()
        
        result = []
        for delivery in partial_deliveries:
            # Get PO to find original quantity
            po = PurchaseOrder.query.filter_by(po_number=delivery.po_number).first()
            if po and po.items:
                for item in po.items:
                    if item.get('item_name') == delivery.item_name:
                        result.append({
                            'po_number': delivery.po_number,
                            'item_name': delivery.item_name,
                            'delivered_quantity': delivery.total_delivered,
                            'ordered_quantity': item.get('quantity', 0),
                            'remaining_quantity': max(0, item.get('quantity', 0) - delivery.total_delivered)
                        })
                        break
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        print(f"Error fetching partial deliveries: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# -------------------------------------------------------------------
# GET COMPLETED PURCHASE ORDERS (Legacy - kept for compatibility)
# -------------------------------------------------------------------
@grn_bp.route("/completed-po", methods=["GET"])
def get_completed_po():
    try:
        # Get only completed purchase orders
        completed_orders = PurchaseOrder.query.filter(
            PurchaseOrder.status == 'completed'
        ).order_by(PurchaseOrder.created_on.desc()).all()
        
        # Get partial deliveries to check if PO is fully delivered
        partial_deliveries = db.session.query(
            GRN.po_number,
            GRN.item_name,
            func.sum(GRN.quantity).label('total_delivered')
        ).filter(
            GRN.status == 'active'
        ).group_by(GRN.po_number, GRN.item_name).all()
        
        delivery_tracking = {}
        for delivery in partial_deliveries:
            if delivery.po_number not in delivery_tracking:
                delivery_tracking[delivery.po_number] = {}
            delivery_tracking[delivery.po_number][delivery.item_name] = delivery.total_delivered
        
        # Format the data
        orders_data = []
        for po in completed_orders:
            po_dict = po.to_dict()
            
            # Check if all items are fully delivered
            items = po.items if po.items else []
            all_delivered = True
            
            for item in items:
                item_name = item.get('item_name')
                ordered_qty = item.get('quantity', 0)
                delivered_qty = delivery_tracking.get(po.po_number, {}).get(item_name, 0)
                
                if delivered_qty < ordered_qty:
                    all_delivered = False
                    break
            
            # Only include fully delivered POs
            if all_delivered:
                existing_grn = GRN.query.filter_by(po_number=po.po_number).first()
                po_dict['has_grn'] = existing_grn is not None
                po_dict['grn_invoice'] = existing_grn.invoice_number if existing_grn else None
                orders_data.append(po_dict)
        
        return jsonify({
            'success': True,
            'count': len(orders_data),
            'data': orders_data
        }), 200
        
    except Exception as e:
        print(f"Error fetching completed POs: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# -------------------------------------------------------------------
# GET PURCHASE ORDER DETAILS BY PO NUMBER (With Delivery Info)
# -------------------------------------------------------------------
@grn_bp.route("/get-po/<string:po_number>", methods=["GET"])
def get_purchase_order_details(po_number):
    try:
        # Find purchase order by PO number
        po = PurchaseOrder.query.filter_by(po_number=po_number).first()
        
        if not po:
            return jsonify({"success": False, "message": "Purchase Order not found"}), 404
        
        # Check if PO is approved, partially received or completed
        if po.status not in ['approved', 'partially_received', 'completed']:
            return jsonify({
                "success": False, 
                "message": f"Purchase Order status is '{po.status}', only approved, partially received or completed POs can be converted to GRN"
            }), 400
            
        pending_receipts = reconcile_and_get_pending_receipts(po)
        
        # Get existing deliveries for this PO
        existing_deliveries = GRN.query.filter_by(po_number=po_number).all()
        
        # Calculate delivered quantities per item
        delivered_quantities = {}
        for delivery in existing_deliveries:
            if delivery.item_name not in delivered_quantities:
                delivered_quantities[delivery.item_name] = 0
            delivered_quantities[delivery.item_name] += delivery.quantity
        
        # Get Order Delivery received quantities per item
        od_received = {}
        if po.received_items:
            for rec in po.received_items:
                name = rec.get('item_name')
                od_received[name] = max(
                    od_received.get(name, 0),
                    float(rec.get('received_quantity', 0))
                )
        
        # Check if PO already has any deliveries (partial or full)
        has_deliveries = len(existing_deliveries) > 0
        is_fully_delivered = is_po_fully_delivered(po_number)
        
        # Enhance items with delivery information
        enhanced_items = []
        for item in po.items:
            item_name = item.get('item_name')
            ordered_qty = float(item.get('quantity', 0))
            
            # Quantity already converted to GRN
            grn_delivered_qty = float(delivered_quantities.get(item_name, 0))
            
            # Quantity received in stock (Order Delivery)
            od_received_qty = float(od_received.get(item_name, 0))
            
            # Available quantity to be pushed to GRN right now
            available_for_grn = max(0.0, od_received_qty - grn_delivered_qty)
            
            enhanced_item = {
                **item,
                'original_quantity': ordered_qty,
                'already_grned_quantity': grn_delivered_qty,
                'od_received_quantity': od_received_qty,
                # Set delivered_quantity so Grn.js correctly uses it as the default input limit
                'delivered_quantity': available_for_grn,
                'remaining_quantity': ordered_qty - grn_delivered_qty
            }
            enhanced_items.append(enhanced_item)
        
        return jsonify({
            "success": True,
            "data": {
                "po_number": po.po_number,
                "po_date": po.po_date.isoformat() if po.po_date and isinstance(po.po_date, datetime) else po.po_date,
                "company_name": po.company_name,
                "company_address": po.company_address,
                "customer_name": po.customer_name,
                "customer_mobile": po.customer_mobile,
                "customer_email": po.customer_email,
                "department": po.department,
                "gst_number": po.gst_number,
                "supplier_part_no": po.supplier_part_no,
                "supplier_description": po.supplier_description,
                "items": enhanced_items,
                "total_amount": float(po.total_amount) if po.total_amount else 0.0,
                "status": po.status,
                "has_partial_deliveries": has_deliveries,
                "is_fully_delivered": is_fully_delivered,
                "delivery_status": 'partial' if has_deliveries and not is_fully_delivered else 'pending',
                "pending_receipts": pending_receipts
            }
        })
        
    except Exception as e:
        print(f"Error fetching PO details: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500



# -------------------------------------------------------------------
# GENERATE INVOICE NUMBER
# -------------------------------------------------------------------
def generate_invoice_number():
    today = datetime.now()
    year_month = today.strftime("%Y%m")  # YYYYMM
    
    # Find latest invoice for this month
    latest_invoice = (
        GRN.query
        .filter(GRN.invoice_number.like(f'INV-{year_month}-%'))
        .order_by(GRN.created_on.desc())
        .first()
    )
    
    if latest_invoice and latest_invoice.invoice_number:
        try:
            last_seq = int(latest_invoice.invoice_number.split('-')[-1])
            sequence = last_seq + 1
        except ValueError:
            sequence = 1
    else:
        sequence = 1
    
    return f"INV-{year_month}-{str(sequence).zfill(3)}"


# -------------------------------------------------------------------
# GENERATE BATCH CODE (Guaranteed Unique)
# -------------------------------------------------------------------
def generate_batch_code(brand, po_number=None, date_str=None, exclude_codes=None):
    if not brand:
        brand = "GEN"
    
    brand_code = brand[:3].upper()
    today = datetime.now()
    if not date_str:
        date_str = today.strftime("%Y%m%d")
    
    if exclude_codes is None:
        exclude_codes = set()
    
    # Count existing batch codes with same brand and date as base
    count = GRN.query.filter(
        GRN.batch_code.like(f'{brand_code}-{date_str}-%')
    ).count()
    
    seq = count + 1
    while True:
        candidate = f"{brand_code}-{date_str}-{str(seq).zfill(3)}"
        if candidate not in exclude_codes and not GRN.query.filter_by(batch_code=candidate).first():
            exclude_codes.add(candidate)
            return candidate
        seq += 1


# -------------------------------------------------------------------
# SAVE GRN ITEMS FROM PURCHASE ORDER (Supports Partial Delivery)
# -------------------------------------------------------------------
@grn_bp.route("/save-from-po", methods=["POST"])
def save_grn_from_po():
    try:
        data = request.get_json()
        
        # Required fields
        po_number = data.get("po_number")
        items = data.get("items", [])
        is_partial_param = data.get("is_partial", False)
        remaining_items = data.get("remaining_items", False)
        receipt_id = data.get("receipt_id")
        
        print(f"\nDEBUG SAVE_GRN_FROM_PO - po_number: {po_number}, receipt_id: {receipt_id}, items: {items}\n")
        
        if not po_number:
            return jsonify({"success": False, "message": "PO Number is required"}), 400
            
        if not items or not isinstance(items, list):
            return jsonify({"success": False, "message": "No items provided"}), 400
        
        # Get PO details
        po = PurchaseOrder.query.filter_by(po_number=po_number).first()
        if not po:
            return jsonify({"success": False, "message": "Purchase Order not found"}), 404
        
        # Check if PO is approved, partially received or completed
        if po.status not in ['approved', 'partially_received', 'completed']:
            return jsonify({
                "success": False, 
                "message": f"Cannot create GRN for PO with status '{po.status}', only approved, partially received or completed POs allowed"
            }), 400
        
        # Get existing deliveries for this PO
        existing_deliveries = GRN.query.filter_by(po_number=po_number, status='active').all()
        existing_delivery_items = {}
        for delivery in existing_deliveries:
            if delivery.item_name not in existing_delivery_items:
                existing_delivery_items[delivery.item_name] = 0
            existing_delivery_items[delivery.item_name] += delivery.quantity
            
        # Get Order Delivery received quantities per item
        od_received = {}
        if po.received_items:
            for rec in po.received_items:
                name = rec.get('item_name')
                od_received[name] = max(
                    od_received.get(name, 0),
                    float(rec.get('received_quantity', 0))
                )
        
        # Pre-validate quantities and compute any_remaining
        any_remaining = False
        for po_item in po.items:
            item_name = po_item.get('item_name')
            ordered_qty = float(po_item.get('quantity', 0))
            delivered_qty = float(existing_delivery_items.get(item_name, 0))
            
            # Find if this item was submitted in the new batch
            new_delivery_qty = 0.0
            for submitted_item in items:
                if submitted_item.get('item_name') == item_name:
                    new_delivery_qty = float(submitted_item.get('quantity', 0))
                    break
            
            total_delivered = delivered_qty + new_delivery_qty
            
            # Check if we're exceeding ordered quantities
            if total_delivered > ordered_qty:
                return jsonify({
                    "success": False, 
                    "message": f"Quantity exceeded for {item_name}. Ordered: {ordered_qty}, Already delivered: {delivered_qty}, Trying to deliver: {new_delivery_qty}"
                }), 400
                
            # Check if we're exceeding received stock quantity
            od_qty = float(od_received.get(item_name, 0))
            if total_delivered > od_qty:
                return jsonify({
                    "success": False,
                    "message": f"Quantity to GRN exceeds received quantity in stock for {item_name}. Received in stock: {od_qty}, Already GRNed: {delivered_qty}, Trying to GRN: {new_delivery_qty}"
                }), 400
                
            if total_delivered < ordered_qty:
                any_remaining = True
        
        is_partial = any_remaining
        
        # Validate batch codes are unique in the submitted list
        batch_codes = [item.get('batch_code') for item in items if item.get('batch_code')]
        if len(batch_codes) != len(set(batch_codes)):
            return jsonify({
                "success": False, 
                "message": "Duplicate batch codes detected! Please ensure all batch codes are unique."
            }), 400
        
        # Generate invoice number
        invoice_number = generate_invoice_number()
        today_date = datetime.now().date()
        invoice_date_str = today_date.strftime("%Y-%m-%d")
        
        # Save each item
        saved_items = []
        used_batch_codes = set()
        for item in items:
            item_name = item.get("item_name")
            new_qty = float(item.get("quantity", 0))
            
            # Use provided batch code or auto-generate a guaranteed unique one
            batch_code = (item.get('batch_code') or '').strip()
            if not batch_code or batch_code in used_batch_codes or GRN.query.filter_by(batch_code=batch_code).first():
                batch_code = generate_batch_code(
                    item.get("brand", ""),
                    po_number,
                    today_date.strftime("%Y%m%d"),
                    used_batch_codes
                )
            used_batch_codes.add(batch_code)
            
            # Find original ordered quantity for this item
            ordered_qty = 0.0
            for po_item in po.items:
                if po_item.get('item_name') == item_name:
                    ordered_qty = float(po_item.get('quantity', 0))
                    break
                    
            delivered_qty = existing_delivery_items.get(item_name, 0.0)
            
            # Calculate delivery sequence
            prev_deliveries_count = GRN.query.filter_by(
                po_number=po_number,
                item_name=item_name,
                status="active"
            ).count()
            delivery_sequence = prev_deliveries_count + 1
            
            new_grn = GRN(
                po_number=po_number,
                invoice_number=invoice_number,
                invoice_date=invoice_date_str,
                
                # Company details from PO
                company_name=po.company_name,
                company_address=po.company_address,
                customer_name=po.customer_name,
                customer_mobile=po.customer_mobile,
                customer_email=po.customer_email,
                department=po.department,
                gst_number=po.gst_number,
                supplier_part_no=po.supplier_part_no,
                supplier_description=po.supplier_description,
                
                # Item details
                item_name=item_name,
                brand=item.get("brand"),
                brand_code=item.get("brand_code"),
                brand_description=item.get("brand_description"),
                length=item.get("length"),
                width=item.get("width"),
                unit=item.get("unit", "PCS"),
                quantity=new_qty,
                buy_price=float(item.get("buy_price", 0)),
                batch_code=batch_code,
                status="active",
                is_partial=is_partial,
                delivery_sequence=delivery_sequence,
                original_quantity=ordered_qty,
                delivered_before=delivered_qty
            )
            
            db.session.add(new_grn)
            saved_items.append({
                "item_name": item_name,
                "batch_code": batch_code,
                "brand": item.get("brand"),
                "quantity": new_qty,
                "buy_price": item.get("buy_price"),
                "status": "active"
            })
        
        # Update receipt history entries matching receipt_id or matching item names for backward compatibility
        if po.received_items:
            if receipt_id:
                for rec in po.received_items:
                    history = rec.get('receipt_history', [])
                    for h in history:
                        if h.get('receipt_id') == receipt_id:
                            h['grn_generated'] = True
                            h['grn_invoice'] = invoice_number
            else:
                # Fallback: mark oldest un-GRN'd entries matching items as GRN'd
                for item in items:
                    item_name = item.get("item_name")
                    submitted_qty = float(item.get("quantity", 0))
                    
                    for rec in po.received_items:
                        if rec.get('item_name') == item_name:
                            history = rec.get('receipt_history', [])
                            for h in history:
                                if not h.get('grn_generated', False) and submitted_qty > 0:
                                    qty = float(h.get('quantity', 0))
                                    if qty <= submitted_qty:
                                        h['grn_generated'] = True
                                        h['grn_invoice'] = invoice_number
                                        submitted_qty -= qty
                                    else:
                                        h['grn_generated'] = True
                                        h['grn_invoice'] = invoice_number
                                        submitted_qty = 0
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(po, "received_items")
        
        if not any_remaining:
            # No remaining items overall, PO is completely GRN'd
            po.status = 'converted_to_grn'
        else:
            # There are remaining items, PO is partially received
            po.status = 'partially_received'
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"GRN created successfully! Invoice: {invoice_number}",
            "invoice_number": invoice_number,
            "invoice_date": invoice_date_str,
            "items_count": len(saved_items),
            "items": saved_items,
            "is_partial": is_partial,
            "remaining_items": any_remaining
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving GRN from PO: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# GET ALL GRN RECORDS (with status filter)
# -------------------------------------------------------------------
@grn_bp.route("/all", methods=["GET"])
def get_all_grn():
    try:
        # Get status filter from query parameter
        status_filter = request.args.get('status')
        
        # Build query with optional status filter
        query = GRN.query
        
        if status_filter:
            query = query.filter(GRN.status == status_filter)
        
        grn_list = query.order_by(GRN.created_on.desc()).all()
        
        result = []
        for g in grn_list:
            result.append({
                "id": g.id,
                "po_number": g.po_number,
                "invoice_number": g.invoice_number,
                "invoice_date": g.invoice_date,
                
                # Company details
                "company_name": g.company_name,
                "company_address": g.company_address,
                "customer_name": g.customer_name,
                "customer_mobile": g.customer_mobile,
                "customer_email": g.customer_email,
                "department": g.department,
                "gst_number": g.gst_number,
                "supplier_part_no": g.supplier_part_no,
                "supplier_description": g.supplier_description,
                
                # Item details
                "item_name": g.item_name,
                "brand": g.brand,
                "brand_code": g.brand_code,
                "brand_description": g.brand_description,
                "length": g.length,
                "width": g.width,
                "unit": g.unit,
                "quantity": g.quantity,
                "buy_price": float(g.buy_price) if g.buy_price else 0.0,
                "batch_code": g.batch_code,
                "status": g.status,
                "is_partial": getattr(g, 'is_partial', False),
                
                "created_on": g.created_on.strftime("%Y-%m-%d %H:%M:%S") if g.created_on else None,
                "updated_on": g.updated_on.strftime("%Y-%m-%d %H:%M:%S") if g.updated_on else None
            })
        
        return jsonify({"success": True, "count": len(result), "data": result})
        
    except Exception as e:
        print(f"Error loading GRN list: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# GET GRN BY INVOICE NUMBER
# -------------------------------------------------------------------
@grn_bp.route("/invoice/<string:invoice_number>", methods=["GET"])
def get_grn_by_invoice(invoice_number):
    try:
        grn_items = GRN.query.filter_by(invoice_number=invoice_number).all()
        
        if not grn_items:
            return jsonify({"success": False, "message": "Invoice not found"}), 404
        
        result = []
        total_amount = 0.0
        for g in grn_items:
            item_total = g.quantity * (float(g.buy_price) if g.buy_price else 0)
            total_amount += item_total
            
            result.append({
                "id": g.id,
                "po_number": g.po_number,
                "invoice_number": g.invoice_number,
                "invoice_date": g.invoice_date,
                
                # Company details
                "company_name": g.company_name,
                "company_address": g.company_address,
                "customer_name": g.customer_name,
                "customer_mobile": g.customer_mobile,
                "customer_email": g.customer_email,
                "department": g.department,
                "gst_number": g.gst_number,
                "supplier_part_no": g.supplier_part_no,
                "supplier_description": g.supplier_description,
                
                # Item details
                "item_name": g.item_name,
                "brand": g.brand,
                "brand_code": g.brand_code,
                "brand_description": g.brand_description,
                "length": g.length,
                "width": g.width,
                "unit": g.unit,
                "quantity": g.quantity,
                "buy_price": float(g.buy_price) if g.buy_price else 0.0,
                "item_total": item_total,
                "batch_code": g.batch_code,
                "status": g.status,
                "is_partial": getattr(g, 'is_partial', False),
                
                "created_on": g.created_on.strftime("%Y-%m-%d %H:%M:%S") if g.created_on else None,
                "updated_on": g.updated_on.strftime("%Y-%m-%d %H:%M:%S") if g.updated_on else None
            })
        
        return jsonify({
            "success": True, 
            "count": len(result),
            "total_amount": total_amount,
            "data": result
        })
        
    except Exception as e:
        print(f"Error loading GRN by invoice: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# GET DISTINCT INVOICE NUMBERS (with status filter)
# -------------------------------------------------------------------
@grn_bp.route("/invoices", methods=["GET"])
def get_invoice_numbers():
    try:
        # Get status filter from query parameter
        status_filter = request.args.get('status')
        
        # Build query
        query = db.session.query(
            GRN.invoice_number,
            GRN.invoice_date,
            GRN.po_number,
            func.count(GRN.id).label('item_count'),
            func.sum(GRN.quantity * GRN.buy_price).label('total_amount')
        )
        
        # Apply status filter if provided
        if status_filter:
            query = query.filter(GRN.status == status_filter)
        
        # Execute query
        invoices = query.group_by(
            GRN.invoice_number, 
            GRN.invoice_date, 
            GRN.po_number
        ).order_by(GRN.created_on.desc()).all()
        
        result = []
        for inv in invoices:
            # Get company name and status from first item
            first_item = GRN.query.filter_by(
                invoice_number=inv.invoice_number
            ).first()
            
            # Check if this is a partial invoice
            is_partial = any(getattr(item, 'is_partial', False) for item in 
                            GRN.query.filter_by(invoice_number=inv.invoice_number).all())
            
            result.append({
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date,
                "po_number": inv.po_number,
                "company_name": first_item.company_name if first_item else "",
                "customer_name": first_item.customer_name if first_item else "",
                "status": first_item.status if first_item else "active",
                "item_count": inv.item_count,
                "total_amount": float(inv.total_amount) if inv.total_amount else 0.0,
                "is_partial": is_partial
            })
        
        return jsonify({
            "success": True, 
            "count": len(result),
            "data": result
        })
        
    except Exception as e:
        print(f"Error loading invoice list: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# UPDATE GRN ITEM
# -------------------------------------------------------------------
@grn_bp.route("/update/<int:grn_id>", methods=["PUT"])
def update_grn_item(grn_id):
    try:
        data = request.get_json()
        
        grn_item = GRN.query.get(grn_id)
        if not grn_item:
            return jsonify({"success": False, "message": "GRN item not found"}), 404
        
        # Update fields
        update_fields = [
            'invoice_number', 'invoice_date', 'brand', 'brand_code', 
            'brand_description', 'length', 'width', 'buy_price', 
            'batch_code', 'quantity', 'unit', 'status', 'is_partial'
        ]
        
        for field in update_fields:
            if field in data:
                setattr(grn_item, field, data[field])
        
        # Validate status
        if 'status' in data and data['status'] not in ['active', 'cancelled', 'returned']:
            return jsonify({
                "success": False, 
                "message": "Invalid status. Must be one of: active, cancelled, returned"
            }), 400
        
        # Validate batch code uniqueness
        if 'batch_code' in data:
            existing_batch = GRN.query.filter(
                GRN.batch_code == data['batch_code'],
                GRN.id != grn_id
            ).first()
            if existing_batch:
                return jsonify({
                    "success": False, 
                    "message": f"Batch code '{data['batch_code']}' already exists"
                }), 400
        
        # Validate quantity doesn't exceed PO ordered quantity
        if 'quantity' in data:
            po = PurchaseOrder.query.filter_by(po_number=grn_item.po_number).first()
            if po and po.items:
                for item in po.items:
                    if item.get('item_name') == grn_item.item_name:
                        ordered_qty = item.get('quantity', 0)
                        # Get total delivered excluding current item
                        total_delivered = GRN.query.filter(
                            GRN.po_number == grn_item.po_number,
                            GRN.item_name == grn_item.item_name,
                            GRN.id != grn_id
                        ).with_entities(func.sum(GRN.quantity)).scalar() or 0
                        
                        if total_delivered + data['quantity'] > ordered_qty:
                            return jsonify({
                                "success": False,
                                "message": f"Quantity would exceed ordered quantity. Ordered: {ordered_qty}, Already delivered: {total_delivered}, New quantity: {data['quantity']}"
                            }), 400
                        break
        
        # Validate invoice date format if provided
        if 'invoice_date' in data:
            try:
                datetime.strptime(data['invoice_date'], '%Y-%m-%d')
            except ValueError:
                return jsonify({
                    "success": False, 
                    "message": "Invalid invoice date format. Use YYYY-MM-DD"
                }), 400
        
        # Update timestamp
        grn_item.updated_on = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "GRN item updated successfully",
            "data": grn_item.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating GRN item: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# UPDATE GRN STATUS (bulk update for invoice)
# -------------------------------------------------------------------
@grn_bp.route("/update-status/<string:invoice_number>", methods=["PUT"])
def update_grn_status(invoice_number):
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({"success": False, "message": "Status is required"}), 400
        
        if new_status not in ['active', 'cancelled', 'returned']:
            return jsonify({
                "success": False, 
                "message": "Invalid status. Must be one of: active, cancelled, returned"
            }), 400
        
        # Find all items with this invoice number
        grn_items = GRN.query.filter_by(invoice_number=invoice_number).all()
        
        if not grn_items:
            return jsonify({"success": False, "message": "Invoice not found"}), 404
        
        # Update all items
        for item in grn_items:
            item.status = new_status
            item.updated_on = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Updated {len(grn_items)} items to status: {new_status}",
            "invoice_number": invoice_number,
            "status": new_status,
            "items_updated": len(grn_items)
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating GRN status: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# DELETE GRN ITEM
# -------------------------------------------------------------------
@grn_bp.route("/delete/<int:grn_id>", methods=["DELETE"])
def delete_grn_item(grn_id):
    try:
        grn_item = GRN.query.get(grn_id)
        if not grn_item:
            return jsonify({"success": False, "message": "GRN item not found"}), 404
        
        # Check if this is the only item in the invoice
        invoice_items = GRN.query.filter_by(
            invoice_number=grn_item.invoice_number
        ).count()
        
        invoice_number = grn_item.invoice_number
        po_number = grn_item.po_number
        
        db.session.delete(grn_item)
        
        # If this was the last item, revert PO status
        if invoice_items == 1:
            po = PurchaseOrder.query.filter_by(
                po_number=po_number
            ).first()
            if po and po.status == 'converted_to_grn':
                po.status = 'completed','approved'
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"GRN item deleted successfully. Invoice {invoice_number} updated."
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting GRN item: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# GET GRN STATISTICS (with status breakdown)
# -------------------------------------------------------------------
@grn_bp.route("/stats", methods=["GET"])
def get_grn_statistics():
    try:
        # Total GRN records by status
        total_count = GRN.query.count()
        
        # Count by status
        active_count = GRN.query.filter_by(status='active').count()
        cancelled_count = GRN.query.filter_by(status='cancelled').count()
        returned_count = GRN.query.filter_by(status='returned').count()
        
        # Count partial deliveries
        partial_count = GRN.query.filter_by(is_partial=True).count() if hasattr(GRN, 'is_partial') else 0
        
        # Total invoices
        invoice_count = db.session.query(
            func.count(func.distinct(GRN.invoice_number))
        ).scalar()
        
        # Total amount (only active items)
        total_amount_result = db.session.query(
            func.sum(GRN.quantity * GRN.buy_price)
        ).filter_by(status='active').scalar()
        total_amount = float(total_amount_result) if total_amount_result else 0.0
        
        # Today's GRN
        today = datetime.now().date()
        today_count = GRN.query.filter(
            func.date(GRN.created_on) == today
        ).count()
        
        # This month's GRN
        current_month = datetime.now().month
        current_year = datetime.now().year
        month_count = GRN.query.filter(
            func.extract('month', GRN.created_on) == current_month,
            func.extract('year', GRN.created_on) == current_year
        ).count()
        
        return jsonify({
            "success": True,
            "data": {
                "total_grn_items": total_count,
                "status_breakdown": {
                    "active": active_count,
                    "cancelled": cancelled_count,
                    "returned": returned_count
                },
                "partial_deliveries": partial_count,
                "total_invoices": invoice_count,
                "total_amount": total_amount,
                "today_count": today_count,
                "month_count": month_count
            }
        })
        
    except Exception as e:
        print(f"Error loading GRN statistics: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# SEARCH GRN (with status filter)
# -------------------------------------------------------------------
@grn_bp.route("/search", methods=["GET"])
def search_grn():
    try:
        search_term = request.args.get('q', '')
        status_filter = request.args.get('status')
        
        if not search_term:
            return jsonify({"success": False, "message": "Search term required"}), 400
        
        # Build query
        query = GRN.query.filter(
            or_(
                GRN.invoice_number.ilike(f'%{search_term}%'),
                GRN.po_number.ilike(f'%{search_term}%'),
                GRN.company_name.ilike(f'%{search_term}%'),
                GRN.customer_name.ilike(f'%{search_term}%'),
                GRN.item_name.ilike(f'%{search_term}%'),
                GRN.batch_code.ilike(f'%{search_term}%'),
                GRN.brand.ilike(f'%{search_term}%')
            )
        )
        
        # Apply status filter if provided
        if status_filter:
            query = query.filter(GRN.status == status_filter)
        
        results = query.order_by(GRN.created_on.desc()).limit(50).all()
        
        result_data = []
        for g in results:
            result_data.append({
                "id": g.id,
                "po_number": g.po_number,
                "invoice_number": g.invoice_number,
                "invoice_date": g.invoice_date,
                "company_name": g.company_name,
                "customer_name": g.customer_name,
                "item_name": g.item_name,
                "brand": g.brand,
                "batch_code": g.batch_code,
                "quantity": g.quantity,
                "buy_price": float(g.buy_price) if g.buy_price else 0.0,
                "status": g.status,
                "is_partial": getattr(g, 'is_partial', False),
                "created_on": g.created_on.strftime("%Y-%m-%d") if g.created_on else None,
                "updated_on": g.updated_on.strftime("%Y-%m-%d") if g.updated_on else None
            })
        
        return jsonify({
            "success": True,
            "count": len(result_data),
            "data": result_data
        })
        
    except Exception as e:
        print(f"Error searching GRN: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# GET STATUS SUMMARY
# -------------------------------------------------------------------
@grn_bp.route("/status-summary", methods=["GET"])
def get_status_summary():
    try:
        # Count items by status for each invoice
        status_summary = db.session.query(
            GRN.invoice_number,
            GRN.status,
            func.count(GRN.id).label('item_count')
        ).group_by(
            GRN.invoice_number,
            GRN.status
        ).all()
        
        result = {}
        for summary in status_summary:
            invoice = summary.invoice_number
            status = summary.status
            count = summary.item_count
            
            if invoice not in result:
                result[invoice] = {}
            
            result[invoice][status] = count
        
        return jsonify({
            "success": True,
            "data": result
        })
        
    except Exception as e:
        print(f"Error getting status summary: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# UPDATE GRN STATUS (BULK UPDATE BY IDs)
# -------------------------------------------------------------------
@grn_bp.route("/update-status-bulk", methods=["PUT"])
def update_grn_status_bulk():
    try:
        data = request.get_json()
        grn_ids = data.get('grn_ids', [])
        new_status = data.get('status')
        
        if not grn_ids:
            return jsonify({"success": False, "message": "No GRN IDs provided"}), 400
        
        if not new_status:
            return jsonify({"success": False, "message": "Status is required"}), 400
        
        if new_status not in ['active', 'cancelled', 'returned', 'done']:
            return jsonify({
                "success": False, 
                "message": "Invalid status. Must be one of: active, cancelled, returned, done"
            }), 400
        
        # Update all items with given IDs
        updated_count = 0
        for grn_id in grn_ids:
            grn_item = GRN.query.get(grn_id)
            if grn_item:
                grn_item.status = new_status
                grn_item.updated_on = datetime.utcnow()
                updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Updated {updated_count} GRN items to status: {new_status}",
            "updated_count": updated_count
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating GRN status in bulk: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------------
# GET PENDING POs FOR DIRECT GRN ENTRY
# -------------------------------------------------------------------
@grn_bp.route("/pending-pos", methods=["GET"])
def get_pending_pos_for_grn():
    """
    Fetch all purchase orders that have pending/balance items to be received.
    Provides auto-fill data for the GRN module:
      - PO NO, PO Date, Company Name
      - Items: Item Name, Total PO Qty, Delivered Qty, Balance Qty, PO Rate
    """
    try:
        # Get active POs (exclude cancelled / rejected)
        pos = PurchaseOrder.query.filter(
            PurchaseOrder.status.in_(['approved', 'pending', 'partially_received', 'completed'])
        ).order_by(PurchaseOrder.created_on.desc()).all()
        
        # Get all delivered quantities from active GRNs
        existing_deliveries = GRN.query.filter(GRN.status == 'active').all()
        grn_totals = {}
        for d in existing_deliveries:
            key = (d.po_number, d.item_name)
            grn_totals[key] = grn_totals.get(key, 0.0) + float(d.quantity or 0)

        result = []
        for po in pos:
            items = po.items or []
            pending_items = []
            
            for item in items:
                item_name = item.get('item_name')
                ordered_qty = float(item.get('quantity', 0) or item.get('original_quantity', 0))
                key = (po.po_number, item_name)
                delivered_qty = grn_totals.get(key, 0.0)
                balance_qty = max(0.0, ordered_qty - delivered_qty)
                
                item_info = {
                    'item_name': item_name,
                    'brand': item.get('brand', ''),
                    'brand_code': item.get('brand_code', ''),
                    'brand_description': item.get('brand_description', ''),
                    'hsn_code': item.get('hsn_code', ''),
                    'length': item.get('length', ''),
                    'width': item.get('width', ''),
                    'unit': item.get('unit', 'PCS'),
                    'po_rate': float(item.get('buy_price', 0)),
                    'total_po_qty': ordered_qty,
                    'delivered_qty': delivered_qty,
                    'balance_qty': balance_qty,
                }
                pending_items.append(item_info)

            # Check if this PO has items with remaining balance
            has_pending = any(i['balance_qty'] > 0 for i in pending_items)
            
            # Include PO if it has pending items or is recently approved
            if has_pending:
                po_date_str = po.po_date.isoformat() if hasattr(po.po_date, 'isoformat') else str(po.po_date or '')
                result.append({
                    'id': po.id,
                    'po_number': po.po_number,
                    'po_date': po_date_str,
                    'company_name': po.company_name,
                    'customer_name': po.customer_name,
                    'gst_number': po.gst_number,
                    'status': po.status,
                    'items': pending_items
                })
                
        return jsonify({
            'success': True,
            'count': len(result),
            'data': result
        }), 200
    except Exception as e:
        print(f"Error fetching pending POs for GRN: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# -------------------------------------------------------------------
# CREATE DIRECT GRN RECORD
# -------------------------------------------------------------------
@grn_bp.route("/create-direct", methods=["POST"])
def create_direct_grn():
    """
    Direct GRN creation from the new GRN module.
    Takes PO details, auto fields + filled fields (Invoice Qty, Received Qty, Invoice Rate,
    Batch Code, Transport Charges, Other Expense, Remarks) and generates GRN records.
    """
    try:
        data = request.get_json() or {}
        po_number = data.get("po_number")
        po_date = data.get("po_date")
        company_name = data.get("company_name")
        invoice_number = data.get("invoice_number") or generate_invoice_number()
        invoice_date = data.get("invoice_date") or datetime.now().strftime("%Y-%m-%d")
        transport_charges = float(data.get("transport_charges") or 0.0)
        other_expense = float(data.get("other_expense") or 0.0)
        remarks = data.get("remarks") or ""
        items = data.get("items", [])

        if not po_number:
            return jsonify({"success": False, "message": "PO Number is required"}), 400

        if not items:
            return jsonify({"success": False, "message": "At least one item must be received"}), 400

        po = PurchaseOrder.query.filter_by(po_number=po_number).first()
        if not po:
            return jsonify({"success": False, "message": f"PO '{po_number}' not found"}), 404

        from app.models.stock import Stock
        from sqlalchemy.orm.attributes import flag_modified

        saved_grn_records = []
        used_batch_codes = set()
        
        # Calculate existing deliveries for this PO
        existing_deliveries = GRN.query.filter_by(po_number=po_number, status='active').all()
        existing_delivery_map = {}
        for d in existing_deliveries:
            existing_delivery_map[d.item_name] = existing_delivery_map.get(d.item_name, 0.0) + d.quantity

        for item in items:
            item_name = item.get("item_name")
            received_qty = float(item.get("received_quantity") or 0.0)
            if received_qty <= 0:
                continue

            invoice_qty = float(item.get("invoice_quantity") or received_qty)
            po_rate = float(item.get("po_rate") or item.get("buy_price") or 0.0)
            invoice_rate = float(item.get("invoice_rate") or po_rate)
            batch_code = (item.get("batch_code") or "").strip()
            item_transport = float(item.get("transport_charges") or transport_charges or 0.0)
            item_other = float(item.get("other_expense") or other_expense or 0.0)
            item_remarks = item.get("remarks") or remarks

            # Find matching item in PO items for metadata
            po_item = next((pi for pi in (po.items or []) if pi.get("item_name") == item_name), {})
            brand = item.get("brand") or po_item.get("brand", "GENERIC")
            brand_code = item.get("brand_code") or po_item.get("brand_code", "")
            brand_desc = item.get("brand_description") or po_item.get("brand_description", "")
            length = item.get("length") or po_item.get("length", "")
            width = item.get("width") or po_item.get("width", "")
            unit = item.get("unit") or po_item.get("unit", "PCS")
            original_qty = float(item.get("total_po_qty") or po_item.get("quantity", 0))

            # Auto-generate guaranteed unique batch code if not provided or if duplicate
            if not batch_code or batch_code in used_batch_codes or GRN.query.filter_by(batch_code=batch_code).first():
                batch_code = generate_batch_code(brand, po_number, datetime.now().strftime("%Y%m%d"), used_batch_codes)
            used_batch_codes.add(batch_code)

            # Delivery sequence
            prev_seq_count = GRN.query.filter_by(po_number=po_number, item_name=item_name, status="active").count()
            delivered_before = existing_delivery_map.get(item_name, 0.0)
            
            is_partial = (delivered_before + received_qty) < original_qty

            new_grn = GRN(
                po_number=po_number,
                invoice_number=invoice_number,
                invoice_date=invoice_date,
                company_name=company_name or po.company_name,
                customer_name=po.customer_name,
                item_name=item_name,
                brand=brand,
                buy_price=po_rate,
                batch_code=batch_code,
                company_address=po.company_address,
                customer_mobile=po.customer_mobile,
                customer_email=po.customer_email,
                department=po.department,
                gst_number=po.gst_number,
                supplier_part_no=po.supplier_part_no,
                supplier_description=po.supplier_description,
                brand_code=brand_code,
                brand_description=brand_desc,
                length=str(length),
                width=str(width),
                unit=unit,
                quantity=received_qty,
                status="active",
                is_partial=is_partial,
                delivery_sequence=prev_seq_count + 1,
                original_quantity=original_qty,
                delivered_before=delivered_before,
                po_date=po_date or (po.po_date.isoformat() if hasattr(po.po_date, 'isoformat') else str(po.po_date)),
                invoice_quantity=invoice_qty,
                invoice_rate=invoice_rate,
                transport_charges=item_transport,
                other_expense=item_other,
                remarks=item_remarks
            )
            db.session.add(new_grn)
            saved_grn_records.append(new_grn)

            # Update / Create Stock item
            try:
                stock_item = Stock.query.filter_by(batch_code=batch_code).first()
                if stock_item:
                    stock_item.quantity = (stock_item.quantity or 0) + received_qty
                    stock_item.calculate_auto_count()
                else:
                    len_val = float(length) if length and str(length).replace('.', '', 1).isdigit() else 0.0
                    wid_val = float(width) if width and str(width).replace('.', '', 1).isdigit() else 0.0
                    new_stock = Stock(
                        item_name=item_name,
                        brand=brand,
                        brand_code=brand_code,
                        brand_description=brand_desc,
                        length=len_val,
                        width=wid_val,
                        quantity=received_qty,
                        buy_price=invoice_rate or po_rate,
                        batch_code=batch_code,
                        unit=unit
                    )
                    db.session.add(new_stock)
            except Exception as stock_err:
                print(f"Warning: Stock update failed: {stock_err}")

        if not saved_grn_records:
            return jsonify({"success": False, "message": "No valid received items to save"}), 400

        # Update PO status and received items
        po_received = po.received_items or []
        for grn_rec in saved_grn_records:
            rec_found = False
            for ri in po_received:
                if ri.get("item_name") == grn_rec.item_name:
                    ri["received_quantity"] = float(ri.get("received_quantity", 0)) + grn_rec.quantity
                    history = ri.setdefault("receipt_history", [])
                    history.append({
                        "date": datetime.now().isoformat(),
                        "quantity": grn_rec.quantity,
                        "batch_code": grn_rec.batch_code,
                        "grn_invoice": invoice_number,
                        "grn_generated": True
                    })
                    rec_found = True
                    break
            if not rec_found:
                po_received.append({
                    "item_name": grn_rec.item_name,
                    "received_quantity": grn_rec.quantity,
                    "receipt_history": [{
                        "date": datetime.now().isoformat(),
                        "quantity": grn_rec.quantity,
                        "batch_code": grn_rec.batch_code,
                        "grn_invoice": invoice_number,
                        "grn_generated": True
                    }]
                })

        po.received_items = po_received
        flag_modified(po, "received_items")

        # Determine overall PO status
        all_po_items = po.items or []
        all_completed = True
        for pi in all_po_items:
            pi_name = pi.get("item_name")
            pi_ordered = float(pi.get("quantity", 0))
            pi_received = sum(ri.get("received_quantity", 0) for ri in po_received if ri.get("item_name") == pi_name)
            if pi_received < pi_ordered:
                all_completed = False
                break

        if all_completed:
            po.status = "completed"
        else:
            po.status = "partially_received"

        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"GRN created successfully! Invoice Number: {invoice_number}",
            "invoice_number": invoice_number,
            "items_count": len(saved_grn_records),
            "data": [r.to_dict() for r in saved_grn_records]
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error in create_direct_grn: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

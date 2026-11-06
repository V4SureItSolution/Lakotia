from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from app import db
from app.models.purchaseorder import PurchaseOrder

purchase_order_bp = Blueprint('purchase_orders', __name__)

VALID_STATUSES = ['pending', 'approved', 'rejected', 'completed', 'partially_received', 'converted_to_grn']


# ---------------------------
# Helper: Generate PO Number
# ---------------------------
def generate_po_number():
    today = datetime.now()
    year_month = today.strftime("%Y%m")

    latest_po = (
        PurchaseOrder.query
        .filter(PurchaseOrder.po_number.like(f'PO-{year_month}-%'))
        .order_by(PurchaseOrder.created_on.desc())
        .first()
    )

    if latest_po and latest_po.po_number:
        try:
            last_seq = int(latest_po.po_number.split('-')[-1])
            sequence = last_seq + 1
        except ValueError:
            sequence = 1
    else:
        sequence = 1

    return f"PO-{year_month}-{str(sequence).zfill(3)}"


# ---------------------------
# Helper: Calculate remaining quantities
# ---------------------------
def calculate_remaining_items_with_received(po):
    """Calculate remaining quantities for each item in PO"""
    items = po.items.copy() if po.items else []
    received_items = po.received_items if po.received_items else []
    
    # Create a mapping of received quantities by item index
    received_map = {}
    for received in received_items:
        item_idx = received.get('item_index')
        if item_idx is not None:
            received_map[item_idx] = received.get('received_quantity', 0)
    
    # Calculate remaining for each item
    for idx, item in enumerate(items):
        ordered_qty = item.get('quantity', 0)
        delivered_qty = received_map.get(idx, 0)
        remaining_qty = ordered_qty - delivered_qty
        
        item['delivered_quantity'] = delivered_qty
        item['remaining_quantity'] = remaining_qty
        item['original_quantity'] = ordered_qty
    
    # Filter out items with zero remaining quantity
    remaining_items = [item for idx, item in enumerate(items) if item.get('remaining_quantity', 0) > 0]
    
    # Format received items for response
    formatted_received_items = []
    for received in received_items:
        item_idx = received.get('item_index')
        if item_idx is not None and item_idx < len(items):
            formatted_received_items.append({
                'item_index': item_idx,
                'item_name': items[item_idx].get('item_name'),
                'ordered_quantity': items[item_idx].get('quantity'),
                'received_quantity': received.get('received_quantity', 0),
                'pending_quantity': items[item_idx].get('quantity', 0) - received.get('received_quantity', 0),
                'receipt_history': received.get('receipt_history', []),
                'last_received_date': received.get('last_received_date')
            })
    
    return items, remaining_items, formatted_received_items


# ---------------------------
# Create Purchase Order
# ---------------------------
@purchase_order_bp.route('/create', methods=['POST'])
def create_purchase_order():
    try:
        data = request.get_json() or {}

        if not data.get('company_name'):
            return jsonify({'success': False, 'error': 'Company Name is required'}), 400
            
        if not data.get('customer_name'):
            return jsonify({'success': False, 'error': 'Customer Name is required'}), 400

        items = data.get('items')
        if not isinstance(items, list) or not items:
            return jsonify({'success': False, 'error': 'At least one item is required'}), 400

        total_amount = 0.0
        for item in items:
            quantity = float(item.get('quantity', 0))
            buy_price = float(item.get('buy_price', 0))
            total_amount += quantity * buy_price

        po_number = generate_po_number()

        po_date = (
            datetime.strptime(data['po_date'], '%Y-%m-%d').date()
            if data.get('po_date') else date.today()
        )

        delivery_date = None
        if data.get('delivery_date'):
            delivery_date = datetime.strptime(data['delivery_date'], '%Y-%m-%d').date()

        status = data.get('status', 'pending')
        if status not in VALID_STATUSES:
            return jsonify({
                'success': False,
                'error': f'Status must be one of {", ".join(VALID_STATUSES)}'
            }), 400

        company_id = data.get('company_id')
        if company_id == "":
            company_id = None

        new_po = PurchaseOrder(
            po_number=po_number,
            po_date=po_date,
            company_id=company_id,
            company_name=data['company_name'],
            company_address=data.get('company_address'),
            customer_name=data['customer_name'],
            customer_mobile=data.get('customer_mobile'),
            customer_email=data.get('customer_email'),
            department=data.get('department'),
            gst_number=data.get('gst_number'),
            supplier_part_no=data.get('supplier_part_no'),
            supplier_description=data.get('supplier_description'),
            delivery_date=delivery_date,
            status=status,
            items=items,
            total_amount=total_amount,
            received_items=[]
        )

        db.session.add(new_po)
        db.session.commit()

        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(new_po)
        
        po_dict = new_po.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items
        
        return jsonify({
            'success': True,
            'message': 'Purchase Order created successfully',
            'data': po_dict
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creating purchase order: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get All Purchase Orders
# ---------------------------
@purchase_order_bp.route('/all', methods=['GET'])
def get_all_purchase_orders():
    try:
        status = request.args.get('status')

        query = PurchaseOrder.query
        if status and status != 'all':
            query = query.filter(PurchaseOrder.status == status)

        purchase_orders = query.order_by(PurchaseOrder.created_on.desc()).all()
        
        result = []
        for po in purchase_orders:
            items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(po)
            
            po_dict = po.to_dict()
            po_dict['items'] = items_with_delivery
            po_dict['remaining_items'] = remaining_items
            po_dict['received_items'] = received_items
            
            result.append(po_dict)

        return jsonify({
            'success': True,
            'count': len(result),
            'data': result
        }), 200

    except Exception as e:
        print(f"Error getting purchase orders: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get PO by Number
# ---------------------------
@purchase_order_bp.route('/by-number/<po_number>', methods=['GET'])
def get_po_by_number(po_number):
    try:
        purchase_order = PurchaseOrder.query.filter_by(po_number=po_number).first()
        
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404
        
        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        po_dict = purchase_order.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items
        
        return jsonify({
            'success': True,
            'data': po_dict
        }), 200
        
    except Exception as e:
        print(f"Error getting PO: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get PO by ID
# ---------------------------
@purchase_order_bp.route('/get/<int:po_id>', methods=['GET'])
def get_po_by_id(po_id):
    try:
        purchase_order = PurchaseOrder.query.get(po_id)
        
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404
        
        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        po_dict = purchase_order.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items
        
        return jsonify({
            'success': True,
            'data': po_dict
        }), 200
        
    except Exception as e:
        print(f"Error getting PO: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Update PO Status
# ---------------------------
@purchase_order_bp.route('/update-status/<int:po_id>', methods=['PUT'])
def update_purchase_order_status(po_id):
    try:
        data = request.get_json() or {}
        new_status = data.get('status')
        approval_remarks = data.get('approval_remarks')
        rejection_remarks = data.get('rejection_remarks')

        if new_status not in VALID_STATUSES:
            return jsonify({
                'success': False,
                'error': f'Status must be one of {", ".join(VALID_STATUSES)}'
            }), 400

        purchase_order = PurchaseOrder.query.get(po_id)
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404

        purchase_order.status = new_status
        
        if new_status == 'approved':
            purchase_order.approval_remarks = approval_remarks
            purchase_order.approved_date = datetime.utcnow()
            purchase_order.rejection_remarks = None
            purchase_order.rejected_date = None
        elif new_status == 'rejected':
            purchase_order.rejection_remarks = rejection_remarks
            purchase_order.rejected_date = datetime.utcnow()
            purchase_order.approval_remarks = None
            purchase_order.approved_date = None
        else:
            if new_status == 'pending':
                purchase_order.approval_remarks = None
                purchase_order.approved_date = None
                purchase_order.rejection_remarks = None
                purchase_order.rejected_date = None

        db.session.commit()

        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        po_dict = purchase_order.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items

        return jsonify({
            'success': True,
            'message': f'Status updated to {new_status}',
            'data': po_dict
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating status: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Update Purchase Order
# ---------------------------
@purchase_order_bp.route('/update/<int:po_id>', methods=['PUT'])
def update_purchase_order(po_id):
    try:
        data = request.get_json() or {}
        purchase_order = PurchaseOrder.query.get(po_id)

        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404

        if purchase_order.status != 'pending':
            return jsonify({
                'success': False,
                'error': f'Cannot update PO with status {purchase_order.status}'
            }), 400

        update_fields = [
            'company_name', 'company_address', 'customer_name', 
            'customer_mobile', 'customer_email', 'department',
            'gst_number', 'company_id', 'supplier_part_no', 
            'supplier_description', 'status'
        ]
        
        for field in update_fields:
            if field in data:
                val = data[field]
                if field == 'company_id' and val == "":
                    val = None
                setattr(purchase_order, field, val)

        if data.get('po_date'):
            purchase_order.po_date = datetime.strptime(data['po_date'], '%Y-%m-%d').date()

        if 'delivery_date' in data:
            purchase_order.delivery_date = (
                datetime.strptime(data['delivery_date'], '%Y-%m-%d').date()
                if data['delivery_date'] else None
            )

        if 'items' in data:
            if not isinstance(data['items'], list) or not data['items']:
                return jsonify({'success': False, 'error': 'Items must be a non-empty list'}), 400

            purchase_order.items = data['items']
            purchase_order.total_amount = sum(
                float(i.get('quantity', 0)) * float(i.get('buy_price', 0))
                for i in data['items']
            )

        db.session.commit()

        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        po_dict = purchase_order.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items

        return jsonify({
            'success': True,
            'message': 'Purchase Order updated successfully',
            'data': po_dict
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating purchase order: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Delete Purchase Order
# ---------------------------
@purchase_order_bp.route('/delete/<int:po_id>', methods=['DELETE'])
def delete_purchase_order(po_id):
    try:
        purchase_order = PurchaseOrder.query.get(po_id)

        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404

        if purchase_order.status != 'pending':
            return jsonify({
                'success': False,
                'error': f'Cannot delete PO with status {purchase_order.status}'
            }), 400

        db.session.delete(purchase_order)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Purchase Order deleted'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting purchase order: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Purchase Order Statistics
# ---------------------------
@purchase_order_bp.route('/stats', methods=['GET'])
def get_po_statistics():
    try:
        total = PurchaseOrder.query.count()

        by_status = {
            status: PurchaseOrder.query.filter_by(status=status).count()
            for status in VALID_STATUSES
        }

        amount_by_status = {
            status: float(
                db.session.query(db.func.sum(PurchaseOrder.total_amount))
                .filter_by(status=status)
                .scalar() or 0
            )
            for status in ['pending', 'approved', 'completed']
        }

        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_count = PurchaseOrder.query.filter(
            PurchaseOrder.created_on >= week_ago
        ).count()

        return jsonify({
            'success': True,
            'data': {
                'total': total,
                'pending': by_status.get('pending', 0),
                'approved': by_status.get('approved', 0),
                'rejected': by_status.get('rejected', 0),
                'completed': by_status.get('completed', 0),
                'amount_by_status': amount_by_status,
                'recent_count': recent_count
            }
        }), 200

    except Exception as e:
        print(f"Error getting statistics: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# DEBUG: Check all approved POs
# ---------------------------
@purchase_order_bp.route('/debug-check', methods=['GET'])
def debug_check():
    try:
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.status == 'approved'
        ).all()
        
        result = []
        for po in purchase_orders:
            total_ordered = sum(item.get('quantity', 0) for item in po.items)
            total_received = 0
            if po.received_items:
                for received in po.received_items:
                    total_received += received.get('received_quantity', 0)
            
            result.append({
                'id': po.id,
                'po_number': po.po_number,
                'status': po.status,
                'ordered_qty': total_ordered,
                'received_qty': total_received,
                'pending_qty': total_ordered - total_received,
                'items': po.items,
                'received_items': po.received_items
            })
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get Approved POs (Ready for Receipt)
# ---------------------------
@purchase_order_bp.route('/approved-not-completed', methods=['GET'])
def get_approved_not_completed():
    try:
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.status == 'approved'
        ).all()
        
        print(f"\n=== Found {len(purchase_orders)} approved POs ===")
        
        result = []
        for po in purchase_orders:
            print(f"\n--- PO: {po.po_number} ---")
            print(f"Items: {po.items}")
            print(f"Received Items: {po.received_items}")
            
            items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(po)
            
            # Calculate total pending quantity
            total_pending = sum(item.get('remaining_quantity', 0) for item in items_with_delivery)
            print(f"Total pending: {total_pending}")
            
            # Only include if pending > 0
            if total_pending > 0:
                po_dict = po.to_dict()
                po_dict['items'] = items_with_delivery
                po_dict['remaining_items'] = remaining_items
                po_dict['received_items'] = received_items
                po_dict['total_pending'] = total_pending
                
                result.append(po_dict)
                print(f"✓ ADDED to result")
            else:
                print(f"✗ SKIPPED (no pending items)")
        
        print(f"\n=== Total POs with pending: {len(result)} ===\n")
        
        return jsonify({
            'success': True,
            'count': len(result),
            'data': result
        }), 200
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Receive Items (POST method)
# ---------------------------
@purchase_order_bp.route('/receive-items/<int:po_id>', methods=['POST'])
def receive_items(po_id):
    try:
        data = request.get_json() or {}
        received_quantities = data.get('received_quantities', [])
        
        purchase_order = PurchaseOrder.query.get(po_id)
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404
        
        if not purchase_order.received_items:
            purchase_order.received_items = []
        
        # Generate a unique receipt_id for this transaction
        receipt_id = f"REC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Create a dictionary of existing received items by index
        received_dict = {}
        for received in purchase_order.received_items:
            item_idx = received.get('item_index')
            if item_idx is not None:
                received_dict[item_idx] = received
        
        # Update received quantities
        for received_item in received_quantities:
            item_index = received_item.get('item_index')
            received_qty = float(received_item.get('received_quantity', 0))
            remarks = received_item.get('remarks', '')
            
            if item_index is not None and item_index < len(purchase_order.items):
                ordered_qty = purchase_order.items[item_index].get('quantity', 0)
                item_name = purchase_order.items[item_index].get('item_name', '')
                
                current_received = 0
                if item_index in received_dict:
                    current_received = received_dict[item_index].get('received_quantity', 0)
                
                if current_received + received_qty > ordered_qty:
                    return jsonify({
                        'success': False,
                        'error': f'Received quantity exceeds ordered quantity for item {item_name}'
                    }), 400
                
                if item_index in received_dict:
                    received_dict[item_index]['received_quantity'] = current_received + received_qty
                    received_dict[item_index]['pending_quantity'] = ordered_qty - (current_received + received_qty)
                    
                    if 'receipt_history' not in received_dict[item_index]:
                        received_dict[item_index]['receipt_history'] = []
                    
                    received_dict[item_index]['receipt_history'].append({
                        'receipt_id': receipt_id,
                        'date': datetime.utcnow().isoformat(),
                        'quantity': received_qty,
                        'remarks': remarks,
                        'type': 'receive',
                        'grn_generated': False,
                        'grn_invoice': None
                    })
                    
                    # Update last received date
                    received_dict[item_index]['last_received_date'] = datetime.utcnow().isoformat()
                else:
                    received_dict[item_index] = {
                        'item_index': item_index,
                        'item_name': item_name,
                        'ordered_quantity': ordered_qty,
                        'received_quantity': received_qty,
                        'pending_quantity': ordered_qty - received_qty,
                        'receipt_history': [{
                            'receipt_id': receipt_id,
                            'date': datetime.utcnow().isoformat(),
                            'quantity': received_qty,
                            'remarks': remarks,
                            'type': 'receive',
                            'grn_generated': False,
                            'grn_invoice': None
                        }],
                        'last_received_date': datetime.utcnow().isoformat()
                    }
        
        purchase_order.received_items = list(received_dict.values())
        
        # Check if all items are fully received
        all_received = True
        for idx, item in enumerate(purchase_order.items):
            ordered_qty = item.get('quantity', 0)
            received_qty = 0
            if idx in received_dict:
                received_qty = received_dict[idx].get('received_quantity', 0)
            if received_qty < ordered_qty:
                all_received = False
                break
        
        if all_received:
            purchase_order.status = 'completed'
            message = "All items received! PO completed."
        else:
            purchase_order.status = 'partially_received'
            message = "Items received successfully. PO partially completed."
            
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(purchase_order, "received_items")
        db.session.commit()
        
        # Get updated data
        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        po_dict = purchase_order.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items
        
        return jsonify({
            'success': True,
            'message': message,
            'data': po_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error receiving items: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# UPDATE Received Items (PUT method) - NEW
# ---------------------------
@purchase_order_bp.route('/update-received-items/<int:po_id>', methods=['PUT'])
def update_received_items(po_id):
    """
    Update existing received items for a purchase order
    This is a PUT method to update receipt data
    """
    try:
        data = request.get_json() or {}
        received_quantities = data.get('received_quantities', [])
        
        purchase_order = PurchaseOrder.query.get(po_id)
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404
        
        # Validate received quantities
        for received_item in received_quantities:
            item_index = received_item.get('item_index')
            new_total_qty = float(received_item.get('received_quantity', 0))
            
            if item_index is not None and item_index < len(purchase_order.items):
                ordered_qty = purchase_order.items[item_index].get('quantity', 0)
                item_name = purchase_order.items[item_index].get('item_name', '')
                
                # New total should not exceed ordered quantity
                if new_total_qty > ordered_qty:
                    return jsonify({
                        'success': False,
                        'error': f'Cannot set received quantity to {new_total_qty} for {item_name}. Ordered quantity is {ordered_qty}.'
                    }), 400
                
                if new_total_qty < 0:
                    return jsonify({
                        'success': False,
                        'error': f'Received quantity cannot be negative for {item_name}'
                    }), 400
        
        # Initialize received_items if None
        if purchase_order.received_items is None:
            purchase_order.received_items = []
        
        # Create a dictionary of existing received items by index
        received_dict = {}
        for received in purchase_order.received_items:
            item_idx = received.get('item_index')
            if item_idx is not None:
                received_dict[item_idx] = received
        
        # Update received quantities
        for received_item in received_quantities:
            item_index = received_item.get('item_index')
            new_total_qty = float(received_item.get('received_quantity', 0))
            remarks = received_item.get('remarks', '')
            
            if item_index is not None and item_index < len(purchase_order.items):
                item = purchase_order.items[item_index]
                item_name = item.get('item_name', '')
                ordered_qty = item.get('quantity', 0)
                
                # Get old quantity if exists
                old_qty = 0
                if item_index in received_dict:
                    old_qty = received_dict[item_index].get('received_quantity', 0)
                
                # Calculate the difference
                qty_difference = new_total_qty - old_qty
                
                if item_index in received_dict:
                    # Update existing item
                    received_dict[item_index]['received_quantity'] = new_total_qty
                    received_dict[item_index]['pending_quantity'] = ordered_qty - new_total_qty
                    
                    # Add to receipt history if there's a change
                    if qty_difference != 0:
                        if 'receipt_history' not in received_dict[item_index]:
                            received_dict[item_index]['receipt_history'] = []
                        
                        received_dict[item_index]['receipt_history'].append({
                            'date': datetime.utcnow().isoformat(),
                            'quantity': abs(qty_difference),
                            'remarks': remarks,
                            'type': 'update',
                            'old_quantity': old_qty,
                            'new_quantity': new_total_qty
                        })
                    
                    # Update last received date if quantity increased
                    if qty_difference > 0:
                        received_dict[item_index]['last_received_date'] = datetime.utcnow().isoformat()
                else:
                    # Add new item
                    received_dict[item_index] = {
                        'item_index': item_index,
                        'item_name': item_name,
                        'ordered_quantity': ordered_qty,
                        'received_quantity': new_total_qty,
                        'pending_quantity': ordered_qty - new_total_qty,
                        'receipt_history': [{
                            'date': datetime.utcnow().isoformat(),
                            'quantity': new_total_qty,
                            'remarks': remarks,
                            'type': 'initial_setup'
                        }],
                        'last_received_date': datetime.utcnow().isoformat() if new_total_qty > 0 else None
                    }
        
        # Update the received_items list
        purchase_order.received_items = list(received_dict.values())
        
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(purchase_order, "received_items")
        
        # Check if all items are fully received
        all_received = True
        for idx, item in enumerate(purchase_order.items):
            ordered_qty = item.get('quantity', 0)
            received_qty = 0
            if idx in received_dict:
                received_qty = received_dict[idx].get('received_quantity', 0)
            if received_qty < ordered_qty:
                all_received = False
                break
        
        # Update PO status based on receipt status
        if all_received:
            purchase_order.status = 'completed'
        elif purchase_order.status == 'completed' and not all_received:
            purchase_order.status = 'approved'
        
        # Commit to database
        db.session.commit()
        
        # Get updated data
        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        po_dict = purchase_order.to_dict()
        po_dict['items'] = items_with_delivery
        po_dict['remaining_items'] = remaining_items
        po_dict['received_items'] = received_items
        
        return jsonify({
            'success': True,
            'message': 'Received items updated successfully',
            'data': po_dict
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating received items: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get Receipt History
# ---------------------------
@purchase_order_bp.route('/receipt-history/<int:po_id>', methods=['GET'])
def get_receipt_history(po_id):
    try:
        purchase_order = PurchaseOrder.query.get(po_id)
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404
        
        items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(purchase_order)
        
        return jsonify({
            'success': True,
            'data': {
                'po_number': purchase_order.po_number,
                'received_items': received_items,
                'items': items_with_delivery,
                'remaining_items': remaining_items,
                'status': purchase_order.status
            }
        }), 200
        
    except Exception as e:
        print(f"Error getting receipt history: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get Pending Items by PO Number
# ---------------------------
@purchase_order_bp.route('/pending-items', methods=['GET'])
def get_pending_items():
    """
    Get all pending items across POs or for a specific PO
    Query params:
        po_number: (optional) get pending items for specific PO
        status: (optional) filter by PO status (default: 'approved')
    """
    try:
        po_number = request.args.get('po_number')
        status = request.args.get('status', 'approved')
        
        # Build query
        query = PurchaseOrder.query
        
        if status and status != 'all':
            query = query.filter(PurchaseOrder.status == status)
        
        if po_number:
            query = query.filter(PurchaseOrder.po_number == po_number)
        
        purchase_orders = query.all()
        
        pending_items = []
        
        for po in purchase_orders:
            # Calculate remaining quantities
            items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(po)
            
            # Add pending items to result
            for item in remaining_items:
                pending_items.append({
                    'po_id': po.id,
                    'po_number': po.po_number,
                    'po_date': po.po_date.isoformat() if po.po_date else None,
                    'company_name': po.company_name,
                    'customer_name': po.customer_name,
                    'item_index': item.get('index', items_with_delivery.index(item)),
                    'item_name': item.get('item_name'),
                    'item_description': item.get('item_description', ''),
                    'ordered_quantity': item.get('original_quantity', 0),
                    'received_quantity': item.get('delivered_quantity', 0),
                    'pending_quantity': item.get('remaining_quantity', 0),
                    'unit': item.get('unit', ''),
                    'buy_price': item.get('buy_price', 0),
                    'total_pending_value': item.get('remaining_quantity', 0) * item.get('buy_price', 0),
                    'status': po.status
                })
        
        return jsonify({
            'success': True,
            'count': len(pending_items),
            'data': pending_items
        }), 200
        
    except Exception as e:
        print(f"Error getting pending items: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Simple Pending Summary by PO
# ---------------------------
@purchase_order_bp.route('/pending-summary', methods=['GET'])
def get_pending_summary():
    """
    Get summary of pending quantities grouped by PO
    """
    try:
        status = request.args.get('status', 'approved')
        
        query = PurchaseOrder.query.filter(PurchaseOrder.status == status)
        purchase_orders = query.all()
        
        po_summary = []
        total_pending_items = 0
        total_pending_value = 0
        
        for po in purchase_orders:
            items_with_delivery, remaining_items, received_items = calculate_remaining_items_with_received(po)
            
            po_pending_items = len(remaining_items)
            po_pending_quantity = sum(item.get('remaining_quantity', 0) for item in remaining_items)
            po_pending_value = sum(
                item.get('remaining_quantity', 0) * item.get('buy_price', 0) 
                for item in remaining_items
            )
            
            if po_pending_items > 0:
                po_summary.append({
                    'po_id': po.id,
                    'po_number': po.po_number,
                    'po_date': po.po_date.isoformat() if po.po_date else None,
                    'company_name': po.company_name,
                    'customer_name': po.customer_name,
                    'total_items': len(po.items),
                    'pending_items_count': po_pending_items,
                    'pending_quantity_total': po_pending_quantity,
                    'pending_value_total': po_pending_value,
                    'status': po.status
                })
                
                total_pending_items += po_pending_items
                total_pending_value += po_pending_value
        
        return jsonify({
            'success': True,
            'summary': {
                'total_pos_with_pending': len(po_summary),
                'total_pending_items': total_pending_items,
                'total_pending_value': total_pending_value
            },
            'data': po_summary
        }), 200
        
    except Exception as e:
        print(f"Error getting pending summary: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------------------
# Get Single Received Item Details
# ---------------------------
@purchase_order_bp.route('/received-items/<int:po_id>/<int:item_index>', methods=['GET'])
def get_received_item(po_id, item_index):
    """Get received item details for a specific PO and item index"""
    try:
        purchase_order = PurchaseOrder.query.get(po_id)
        if not purchase_order:
            return jsonify({'success': False, 'error': 'Purchase Order not found'}), 404
        
        # Find the received item
        received_item = None
        for item in purchase_order.received_items or []:
            if item.get('item_index') == item_index:
                received_item = item
                break
        
        if not received_item:
            return jsonify({'success': False, 'error': 'Item not found in received items'}), 404
        
        return jsonify({
            'success': True,
            'data': received_item
        }), 200
        
    except Exception as e:
        print(f"Error getting received item: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

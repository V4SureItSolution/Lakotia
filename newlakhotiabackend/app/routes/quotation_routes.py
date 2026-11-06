from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app.models.quotation import Quotation
from app import db
from sqlalchemy import desc
import uuid
from sqlalchemy import func, extract
from app.models.quotation import QuotationItem


quotation_bp = Blueprint('quotations', __name__)

# Generate unique quote number
def generate_quote_number():
    date_str = datetime.now().strftime("%Y%m%d")
    random_num = str(uuid.uuid4().int)[:6]
    return f"Q-{date_str}-{random_num}"

# Generate unique sales order number
def generate_sales_order_number():
    date_str = datetime.now().strftime("%Y%m%d")
    random_num = str(uuid.uuid4().int)[:6]
    return f"SO-{date_str}-{random_num}"

# Helper function to generate requote number
def generate_requote_number(original_quote_number):
    """Generate requote number by adding -R1, -R2, etc."""
    import re
    # Check if already has -R{n} suffix
    pattern = r'^(.*?)(?:-R(\d+))?$'
    match = re.match(pattern, original_quote_number)
    if match:
        base = match.group(1)
        current_count = int(match.group(2)) if match.group(2) else 0
        new_count = current_count + 1
        return f"{base}-R{new_count}"
    return f"{original_quote_number}-R1"

# Get all quotations
@quotation_bp.route('/api/quotations', methods=['GET'])
def get_quotations():
    try:
        status = request.args.get('status')
        sales_order_status = request.args.get('sales_order_status')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        query = Quotation.query
        
        if status:
            if ',' in status:
                statuses = [s.strip().lower() for s in status.split(',')]
                query = query.filter(func.lower(Quotation.status).in_(statuses))
            else:
                query = query.filter(func.lower(Quotation.status) == status.strip().lower())
        
        if sales_order_status:
            query = query.filter_by(sales_order_status=sales_order_status)
        
        quotations = query.order_by(Quotation.created_at.desc())\
                         .paginate(page=page, per_page=per_page, error_out=False)
        
        result = {
            'success': True,
            'data': [quote.to_dict() for quote in quotations.items],
            'pagination': {
                'page': quotations.page,
                'per_page': quotations.per_page,
                'total': quotations.total,
                'pages': quotations.pages
            }
        }
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Get single quotation
@quotation_bp.route('/api/quotations/<int:quote_id>', methods=['GET'])
def get_quotation(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        return jsonify({'success': True, 'data': quotation.to_dict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Create new quotation
@quotation_bp.route('/api/quotations', methods=['POST'])
def create_quotation():
    try:
        data = request.get_json()
        
        # Generate quote number if not provided
        quote_number = data.get('quote_number') or generate_quote_number()
        
        # Check if this is a re-quote
        original_quote_id = data.get('original_quote_id')
        if original_quote_id:
            # If it's a re-quote, generate re-quote number
            original_quote = Quotation.query.get(original_quote_id)
            if original_quote:
                quote_number = generate_requote_number(original_quote.quote_number)
        
        # Create quotation
        quotation = Quotation(
            quote_number=quote_number,
            date=data.get('date', datetime.now().date().isoformat()),
            time=data.get('time', datetime.now().time().strftime('%H:%M:%S')),
            issuer_details=data.get('issuer_details', {}),
            company_id=data.get('company_id'),
            company_name=data.get('company_name'),
            company_address=data.get('company_address'),
            company_gstin=data.get('company_gstin'),
            contact_person=data.get('contact_person'),
            contact_mobile=data.get('contact_mobile'),
            contact_email=data.get('contact_email'),
            subtotal=data.get('subtotal', 0),
            total_discount=data.get('total_discount', 0),
            total_packing=data.get('total_packing', 0),
            total_freight=data.get('total_freight', 0),
            total_tax=data.get('total_tax', 0),
            grand_total=data.get('grand_total', 0),
            notes=data.get('notes', ''),
            requote_note=data.get('requote_note', ''),
            original_quote_id=original_quote_id,
            requote_date=datetime.now() if original_quote_id else None,
            status=data.get('status', 'draft'),
            review_status=data.get('review_status', 'pending'),
            # Sales Order Fields (NEW)
            sales_order_number=data.get('sales_order_number'),
            sales_order_date=datetime.fromisoformat(data['sales_order_date']) if data.get('sales_order_date') else None,
            sales_order_status=data.get('sales_order_status', 'not_created'),
            sales_order_remark=data.get('sales_order_remark', ''),
            created_by=data.get('created_by'),
            updated_by=data.get('updated_by'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.session.add(quotation)
        db.session.flush()  # Get the quotation ID
        
        # Add items
        items = data.get('items', [])
        for item_data in items:
            item = QuotationItem(
                quotation_id=quotation.id,
                item_name=item_data.get('item_name'),
                hsn_sac=item_data.get('hsn_sac'),
                supplier_part_no=item_data.get('supplier_part_no'),
                customer_part_no=item_data.get('customer_part_no'),
                description=item_data.get('description'),
                customer_description=item_data.get('customer_description'),
                cut_width=item_data.get('cut_width', 0),
                length=item_data.get('length', 0),
                batch_no=item_data.get('batch_no'),
                mrp=item_data.get('mrp', 0),
                quantity=item_data.get('quantity', 1),
                unit=item_data.get('unit', 'pcs'),
                discount=item_data.get('discount', 0),
                discount_type=item_data.get('discount_type', 'amount'),
                packing_charges=item_data.get('packing_charges', 0),
                freight_charges=item_data.get('freight_charges', 0),
                profit_percentage=item_data.get('profit_percentage', 20),
                tax_rate=item_data.get('tax_rate', 18),
                item_status=item_data.get('item_status', 'pending'),
                review_status=item_data.get('review_status', 'pending'),
                sales_order_created=item_data.get('sales_order_created', False),
                sales_order_remark=item_data.get('sales_order_remark', ''),
                sales_order_item_status=item_data.get('sales_order_item_status', 'not_created'),
                rejection_reason=item_data.get('rejection_reason', ''),
                updated_by=data.get('updated_by'),
                price_per_unit=item_data.get('price_per_unit', 0),
                amount_before_discount=item_data.get('amount_before_discount', 0),
                discount_amount=item_data.get('discount_amount', 0),
                amount_after_discount=item_data.get('amount_after_discount', 0),
                tax_amount=item_data.get('tax_amount', 0),
                item_total=item_data.get('item_total', 0)
            )
            db.session.add(item)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quotation created successfully',
            'data': quotation.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Update quotation
@quotation_bp.route('/api/quotations/<int:quote_id>', methods=['PUT'])
def update_quotation(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        data = request.get_json()
        
        # Completed quotations are completely non-editable
        if quotation.status and quotation.status.lower() == 'completed':
            return jsonify({
                'success': False, 
                'message': 'Completed quotations are non-editable.'
            }), 400
        
        # Update quotation fields
        update_fields = [
            'company_name', 'company_address', 'company_gstin', 
            'contact_person', 'contact_mobile', 'contact_email',
            'subtotal', 'total_discount', 'total_packing', 'total_freight', 'total_tax', 'grand_total',
            'notes', 'status', 'review_status', 'updated_by',
            # Sales Order Fields (NEW)
            'sales_order_number', 'sales_order_status', 'sales_order_remark'
        ]
        
        for field in update_fields:
            if field in data:
                setattr(quotation, field, data[field])
        
        # Handle sales order date
        if 'sales_order_date' in data and data['sales_order_date']:
            quotation.sales_order_date = datetime.fromisoformat(data['sales_order_date'])
        
        # Handle re-quote specific fields
        if 'requote_note' in data:
            quotation.requote_note = data['requote_note']
        
        # If marking as re-quote, update quote number
        if data.get('status') == 'requote' and 'quote_number' in data:
            quotation.quote_number = data['quote_number']
            if 'original_quote_id' in data:
                quotation.original_quote_id = data['original_quote_id']
            if 'requote_date' in data:
                quotation.requote_date = datetime.fromisoformat(data['requote_date'])
            elif data.get('status') == 'requote':
                # If status changed to requote but no date provided, set it
                quotation.requote_date = datetime.now()
        
        quotation.updated_at = datetime.now()
        
        # Update items if provided
        if 'items' in data:
            valid_item_ids = [item_data['id'] for item_data in data['items'] if 'id' in item_data and item_data['id'] and isinstance(item_data['id'], int)]
            
            # Delete items that are no longer in the updated quotation
            if valid_item_ids:
                QuotationItem.query.filter(
                    QuotationItem.quotation_id == quote_id,
                    ~QuotationItem.id.in_(valid_item_ids)
                ).delete(synchronize_session=False)

            for item_data in data['items']:
                item_id = item_data.get('id')
                item = None
                if item_id and isinstance(item_id, int):
                    item = QuotationItem.query.get(item_id)

                if item and item.quotation_id == quote_id:
                    # Update existing item in place
                    update_item_fields = [
                        'item_name', 'hsn_sac', 'supplier_part_no', 'customer_part_no', 'description', 'customer_description',
                        'cut_width', 'length', 'batch_no', 'mrp', 'quantity', 'unit',
                        'discount', 'discount_type', 'packing_charges', 'freight_charges', 'profit_percentage', 'tax_rate', 'item_status',
                        'review_status', 'sales_order_created', 'sales_order_remark',
                        'sales_order_item_status', 'rejection_reason', 'updated_by', 
                        'price_per_unit', 'amount_before_discount', 'discount_amount',
                        'amount_after_discount', 'tax_amount', 'item_total'
                    ]
                    for field in update_item_fields:
                        if field in item_data and item_data[field] is not None:
                            setattr(item, field, item_data[field])
                else:
                    # Add new item explicitly added by user
                    new_item = QuotationItem(
                        quotation_id=quote_id,
                        item_name=item_data.get('item_name'),
                        hsn_sac=item_data.get('hsn_sac'),
                        supplier_part_no=item_data.get('supplier_part_no'),
                        customer_part_no=item_data.get('customer_part_no'),
                        description=item_data.get('description'),
                        customer_description=item_data.get('customer_description'),
                        cut_width=item_data.get('cut_width', 0),
                        length=item_data.get('length', 0),
                        batch_no=item_data.get('batch_no'),
                        mrp=item_data.get('mrp', 0),
                        quantity=item_data.get('quantity', 1),
                        unit=item_data.get('unit', 'pcs'),
                        discount=item_data.get('discount', 0),
                        discount_type=item_data.get('discount_type', 'amount'),
                        packing_charges=item_data.get('packing_charges', 0),
                        freight_charges=item_data.get('freight_charges', 0),
                        profit_percentage=item_data.get('profit_percentage') if item_data.get('profit_percentage') is not None else 20,
                        tax_rate=item_data.get('tax_rate') if item_data.get('tax_rate') is not None else 18,
                        item_status=item_data.get('item_status', 'pending'),
                        review_status=item_data.get('review_status', 'pending'),
                        sales_order_created=item_data.get('sales_order_created', False),
                        sales_order_remark=item_data.get('sales_order_remark', ''),
                        sales_order_item_status=item_data.get('sales_order_item_status', 'not_created'),
                        rejection_reason=item_data.get('rejection_reason', ''),
                        updated_by=data.get('updated_by', quotation.updated_by),
                        price_per_unit=item_data.get('price_per_unit', 0),
                        amount_before_discount=item_data.get('amount_before_discount', 0),
                        discount_amount=item_data.get('discount_amount', 0),
                        amount_after_discount=item_data.get('amount_after_discount', 0),
                        tax_amount=item_data.get('tax_amount', 0),
                        item_total=item_data.get('item_total', 0)
                    )
                    db.session.add(new_item)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quotation updated successfully',
            'data': quotation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Delete quotation
@quotation_bp.route('/api/quotations/<int:quote_id>', methods=['DELETE'])
def delete_quotation(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        
        # Check if quotation is completed
        if quotation.status.lower() == 'completed':
            return jsonify({
                'success': False, 
                'message': 'Cannot delete a completed quotation'
            }), 400
        
        # Delete associated items first
        QuotationItem.query.filter_by(quotation_id=quote_id).delete()
        
        # Delete quotation
        db.session.delete(quotation)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quotation deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Update quotation status
@quotation_bp.route('/api/quotations/<int:quote_id>/status', methods=['PATCH', 'PUT'])
def update_quotation_status(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        data = request.get_json() or {}
        
        new_status = data.get('status')
        valid_statuses = ['draft', 'pending', 'approved', 'sent', 'accepted', 'rejected', 'paid', 'cancelled', 'completed', 'requote']
        
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
        if quotation.status and quotation.status.lower() == 'completed' and new_status != 'completed':
            return jsonify({'success': False, 'message': 'Completed quotations are non-editable.'}), 400
        
        quotation.status = new_status
        
        # Auto-approve quotation items when quotation status is approved or completed
        if new_status and new_status.lower() in ['approved', 'completed']:
            for item in quotation.items:
                if item.item_status != 'rejected':
                    item.item_status = 'approved'
        
        # Handle special cases
        if new_status == 'requote':
            # Generate new quote number for re-quote
            quotation.quote_number = generate_requote_number(quotation.quote_number)
            quotation.requote_note = data.get('requote_note', '')
            quotation.requote_date = datetime.now()
        
        quotation.updated_at = datetime.now()
        quotation.updated_by = data.get('updated_by', quotation.updated_by)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Status updated to {new_status}',
            'data': quotation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# NEW: Update quotation sales order status
@quotation_bp.route('/api/quotations/<int:quote_id>/sales-order-status', methods=['PATCH'])
def update_sales_order_status(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        data = request.get_json()
        
        new_status = data.get('sales_order_status')
        valid_statuses = ['not_created', 'draft', 'confirmed', 'in_production', 
                         'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled']
        
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid sales order status'}), 400
        
        # Update sales order status
        quotation.sales_order_status = new_status
        
        # Generate sales order number if not already present and status is not 'not_created'
        if new_status != 'not_created' and not quotation.sales_order_number:
            quotation.sales_order_number = generate_sales_order_number()
        
        # Set sales order date if not already set and status is confirmed or beyond
        if new_status in ['confirmed', 'in_production', 'ready_for_dispatch', 'dispatched', 'delivered']:
            if not quotation.sales_order_date:
                quotation.sales_order_date = datetime.now()
        
        # Update sales order remark if provided
        if 'sales_order_remark' in data:
            quotation.sales_order_remark = data['sales_order_remark']
        
        quotation.updated_at = datetime.now()
        quotation.updated_by = data.get('updated_by', quotation.updated_by)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Sales order status updated to {new_status}',
            'data': quotation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Update item status in quotation (supports both with and without quote_id)
@quotation_bp.route('/api/quotations/items/<int:item_id>/status', methods=['PATCH', 'PUT'])
@quotation_bp.route('/api/quotations/<int:quote_id>/items/<int:item_id>/status', methods=['PATCH', 'PUT'])
def update_item_status(item_id, quote_id=None):
    try:
        if quote_id:
            item = QuotationItem.query.filter_by(id=item_id, quotation_id=quote_id).first()
        else:
            item = QuotationItem.query.get(item_id)
            
        if not item:
            return jsonify({'success': False, 'message': 'Item not found'}), 404
            
        quotation = Quotation.query.get(item.quotation_id)
        
        data = request.get_json() or {}
        
        new_status = data.get('status') or data.get('item_status')
        # Accept both old and new status values
        valid_statuses = ['pending', 'approved', 'rejected', 'ordered', 'dispatched', 'delivered', 'accepted']
        
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid item status'}), 400
        
        item.item_status = new_status
        item.updated_by = data.get('updated_by', item.updated_by)
        item.updated_at = datetime.now()
        
        # Handle sales order creation
        if 'sales_order_created' in data:
            item.sales_order_created = data['sales_order_created']
            if data.get('sales_order_created'):
                item.sales_order_date = datetime.now()
                item.sales_order_remark = data.get('sales_order_remark', 'Sales order created')
                # Auto-set sales order item status to 'ordered' when sales order is created
                item.sales_order_item_status = 'ordered'
            else:
                item.sales_order_date = None
                item.sales_order_remark = ''
                item.sales_order_item_status = 'not_created'
        
        # Handle sales order item status
        if 'sales_order_item_status' in data:
            item.sales_order_item_status = data['sales_order_item_status']
        
        # Handle rejection reason
        if 'rejection_reason' in data:
            item.rejection_reason = data['rejection_reason']
        
        if quotation:
            quotation.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Item status updated to {new_status}',
            'data': item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Mark item as sales order created
@quotation_bp.route('/api/quotations/items/<int:item_id>/mark-sales-order', methods=['PATCH'])
def mark_sales_order_created(item_id):
    try:
        data = request.get_json()
        
        # Find the item
        item = QuotationItem.query.get(item_id)
        if not item:
            return jsonify({'success': False, 'message': 'Item not found'}), 404
        
        # Update sales order fields
        item.sales_order_created = True
        item.sales_order_date = datetime.now()
        item.sales_order_remark = data.get('remark', 'Sales order created')
        item.sales_order_item_status = 'ordered'
        item.item_status = 'ordered'  # Update status to ordered
        item.updated_by = data.get('updated_by', 'system')
        item.updated_at = datetime.now()
        
        # Update quotation sales order status if not already set
        quotation = Quotation.query.get(item.quotation_id)
        if quotation:
            quotation.updated_at = datetime.now()
            # If quotation sales order status is 'not_created', update it
            if quotation.sales_order_status == 'not_created':
                quotation.sales_order_status = 'draft'
                if not quotation.sales_order_number:
                    quotation.sales_order_number = generate_sales_order_number()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Item marked as sales order created',
            'data': item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Update item sales order status
@quotation_bp.route('/api/quotations/items/<int:item_id>/sales-order-status', methods=['PATCH'])
def update_item_sales_order_status(item_id):
    try:
        data = request.get_json()
        
        # Find the item
        item = QuotationItem.query.get(item_id)
        if not item:
            return jsonify({'success': False, 'message': 'Item not found'}), 404
        
        new_status = data.get('sales_order_item_status')
        valid_statuses = ['not_created', 'ordered', 'in_production', 'ready', 'dispatched', 'delivered', 'rejected']
        
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid sales order item status'}), 400
        
        # Update sales order item status
        item.sales_order_item_status = new_status
        
        # Auto-update item_status based on sales order item status
        status_mapping = {
            'ordered': 'ordered',
            'in_production': 'ordered',
            'ready': 'dispatched',
            'dispatched': 'dispatched',
            'delivered': 'delivered',
            'rejected': 'rejected'
        }
        
        if new_status in status_mapping:
            item.item_status = status_mapping[new_status]
        
        # Set sales order created to True if status is beyond 'not_created'
        if new_status != 'not_created' and not item.sales_order_created:
            item.sales_order_created = True
            item.sales_order_date = datetime.now()
        
        item.updated_by = data.get('updated_by', 'system')
        item.updated_at = datetime.now()
        
        # Update quotation
        quotation = Quotation.query.get(item.quotation_id)
        if quotation:
            quotation.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Item sales order status updated to {new_status}',
            'data': item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Update rejection reason for item
@quotation_bp.route('/api/quotations/items/<int:item_id>/rejection-reason', methods=['PATCH'])
def update_rejection_reason(item_id):
    try:
        data = request.get_json()
        
        # Find the item
        item = QuotationItem.query.get(item_id)
        if not item:
            return jsonify({'success': False, 'message': 'Item not found'}), 404
        
        rejection_reason = data.get('rejection_reason', '').strip()
        
        # Update rejection reason
        item.rejection_reason = rejection_reason
        
        # If rejection reason is provided, automatically set status to rejected
        if rejection_reason:
            item.item_status = 'rejected'
            item.sales_order_item_status = 'rejected'
        
        item.updated_by = data.get('updated_by', 'system')
        item.updated_at = datetime.now()
        
        # Update quotation timestamp
        quotation = Quotation.query.get(item.quotation_id)
        if quotation:
            quotation.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Rejection reason updated',
            'data': item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# NEW: Bulk update item statuses for completed quotations
@quotation_bp.route('/api/quotations/<int:quote_id>/items/status', methods=['PUT'])
def update_items_status(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        data = request.get_json()
        
        # Check if quotation is completed
        if quotation.status.lower() != 'completed':
            return jsonify({
                'success': False, 
                'message': 'Can only update item statuses for completed quotations'
            }), 400
        
        item_updates = data.get('item_updates', [])
        if not item_updates:
            return jsonify({'success': False, 'message': 'No item updates provided'}), 400
        
        updated_count = 0
        for update in item_updates:
            item_id = update.get('id')
            new_status = update.get('item_status')
            
            if not item_id or not new_status:
                continue
            
            # Accept both old and new status values
            valid_statuses = ['pending', 'approved', 'rejected', 'ordered', 'dispatched', 'delivered', 'accepted']
            if new_status not in valid_statuses:
                continue
            
            # Find and update the specific item
            item = QuotationItem.query.filter_by(id=item_id, quotation_id=quote_id).first()
            if item:
                item.item_status = new_status
                item.updated_by = data.get('updated_by', 'system')
                item.updated_at = datetime.now()
                
                # Handle rejection reason
                if 'rejection_reason' in update:
                    item.rejection_reason = update['rejection_reason']
                
                # Handle sales order item status
                if 'sales_order_item_status' in update:
                    item.sales_order_item_status = update['sales_order_item_status']
                
                updated_count += 1
        
        quotation.updated_at = datetime.now()
        quotation.updated_by = data.get('updated_by', 'system')
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Updated {updated_count} item(s)',
            'data': {
                'updated_count': updated_count,
                'quotation_id': quote_id,
                'quote_number': quotation.quote_number
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Get item status statistics for a quotation
@quotation_bp.route('/api/quotations/<int:quote_id>/item-statistics', methods=['GET'])
def get_item_statistics(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        
        # Count items by status (include both old and new status values)
        status_counts = {}
        all_statuses = ['pending', 'approved', 'rejected', 'ordered', 'dispatched', 'delivered', 'accepted']
        
        for status in all_statuses:
            count = QuotationItem.query.filter_by(quotation_id=quote_id, item_status=status).count()
            if count > 0:
                status_counts[status] = count
        
        # Count sales orders
        sales_order_count = QuotationItem.query.filter_by(
            quotation_id=quote_id, 
            sales_order_created=True
        ).count()
        
        # Count by sales order item status (NEW)
        sales_order_status_counts = {}
        all_sales_order_statuses = ['not_created', 'ordered', 'in_production', 'ready', 'dispatched', 'delivered', 'rejected']
        
        for status in all_sales_order_statuses:
            count = QuotationItem.query.filter_by(quotation_id=quote_id, sales_order_item_status=status).count()
            if count > 0:
                sales_order_status_counts[status] = count
        
        return jsonify({
            'success': True,
            'data': {
                'quotation_id': quote_id,
                'quote_number': quotation.quote_number,
                'total_items': len(quotation.items),
                'status_counts': status_counts,
                'sales_order_count': sales_order_count,
                'sales_order_status_counts': sales_order_status_counts
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Export quotation as PDF
@quotation_bp.route('/api/quotations/<int:quote_id>/export', methods=['GET'])
def export_quotation(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        
        # This would generate PDF using a library like ReportLab or WeasyPrint
        # For now, return the quotation data
        return jsonify({
            'success': True,
            'message': 'PDF export functionality to be implemented',
            'data': quotation.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Get quotation statistics
@quotation_bp.route('/api/quotations/statistics', methods=['GET'])
def get_statistics():
    try:
        # Get current year
        current_year = datetime.now().year
        
        # Total count
        total_count = Quotation.query.count()
        
        # Count by status (including new statuses)
        status_counts = {}
        valid_statuses = ['draft', 'sent', 'accepted', 'rejected', 'paid', 'cancelled', 'completed', 'requote']
        for status in valid_statuses:
            count = Quotation.query.filter_by(status=status).count()
            status_counts[status] = count
        
        # Count by sales order status (NEW)
        sales_order_status_counts = {}
        valid_sales_order_statuses = ['not_created', 'draft', 'confirmed', 'in_production', 
                                     'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled']
        for status in valid_sales_order_statuses:
            count = Quotation.query.filter_by(sales_order_status=status).count()
            sales_order_status_counts[status] = count
        
        # Monthly totals for current year
        monthly_totals = db.session.query(
            extract('month', Quotation.created_at).label('month'),
            func.sum(Quotation.grand_total).label('total')
        ).filter(extract('year', Quotation.created_at) == current_year)\
         .group_by('month')\
         .order_by('month')\
         .all()
        
        # Format monthly totals
        monthly_data = {str(month): float(m_total or 0) for month, m_total in monthly_totals}
        
        # Current month revenue
        current_month = datetime.now().month
        current_month_revenue = 0
        for month, m_total in monthly_totals:
            if month == current_month:
                current_month_revenue = float(m_total or 0)
                break
        
        # Get all item status counts (include all status values)
        item_status_counts = {}
        all_item_statuses = ['pending', 'approved', 'rejected', 'ordered', 'dispatched', 'delivered', 'accepted']
        for status in all_item_statuses:
            count = QuotationItem.query.filter_by(item_status=status).count()
            if count > 0:
                item_status_counts[status] = count
        
        # Get sales order item status counts (NEW)
        sales_order_item_status_counts = {}
        all_sales_order_item_statuses = ['not_created', 'ordered', 'in_production', 'ready', 'dispatched', 'delivered', 'rejected']
        for status in all_sales_order_item_statuses:
            count = QuotationItem.query.filter_by(sales_order_item_status=status).count()
            if count > 0:
                sales_order_item_status_counts[status] = count
        
        # Calculate average items per quotation
        total_items = QuotationItem.query.count()
        avg_items_per_quotation = round(total_items / total_count, 2) if total_count > 0 else 0
        
        # Get completed quotations statistics
        completed_quotations = Quotation.query.filter_by(status='completed').count()
        completed_items = QuotationItem.query.join(Quotation).filter(Quotation.status == 'completed').count()
        
        # Get sales order statistics
        sales_order_items = QuotationItem.query.filter_by(sales_order_created=True).count()
        rejected_items = QuotationItem.query.filter_by(item_status='rejected').count()
        
        # Get item status counts for completed quotations only
        completed_item_status_counts = {}
        for status in all_item_statuses:
            count = QuotationItem.query.join(Quotation)\
                .filter(Quotation.status == 'completed')\
                .filter(QuotationItem.item_status == status)\
                .count()
            if count > 0:
                completed_item_status_counts[status] = count
        
        # Get sales order item status counts for completed quotations (NEW)
        completed_sales_order_item_status_counts = {}
        for status in all_sales_order_item_statuses:
            count = QuotationItem.query.join(Quotation)\
                .filter(Quotation.status == 'completed')\
                .filter(QuotationItem.sales_order_item_status == status)\
                .count()
            if count > 0:
                completed_sales_order_item_status_counts[status] = count
        
        return jsonify({
            'success': True,
            'data': {
                'total': total_count,
                'status_counts': status_counts,
                'sales_order_status_counts': sales_order_status_counts,
                'monthly_totals': monthly_data,
                'current_month_revenue': current_month_revenue,
                'year': current_year,
                'item_statistics': {
                    'total_items': total_items,
                    'avg_items_per_quotation': avg_items_per_quotation,
                    'status_counts': item_status_counts,
                    'sales_order_item_status_counts': sales_order_item_status_counts,
                    'sales_order_items': sales_order_items,
                    'rejected_items': rejected_items
                },
                'completed_statistics': {
                    'total_completed': completed_quotations,
                    'total_completed_items': completed_items,
                    'item_status_counts': completed_item_status_counts,
                    'sales_order_item_status_counts': completed_sales_order_item_status_counts
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Bulk update item statuses
@quotation_bp.route('/api/quotations/<int:quote_id>/items/bulk-status', methods=['PATCH'])
def bulk_update_item_status(quote_id):
    try:
        quotation = Quotation.query.get_or_404(quote_id)
        
        data = request.get_json()
        
        item_ids = data.get('item_ids', [])
        new_status = data.get('status')
        
        if not item_ids:
            return jsonify({'success': False, 'message': 'No items provided'}), 400
        
        # Accept both old and new status values
        valid_statuses = ['pending', 'approved', 'rejected', 'ordered', 'dispatched', 'delivered', 'accepted']
        if new_status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid item status'}), 400
        
        # Update all specified items
        updated_count = QuotationItem.query.filter(
            QuotationItem.id.in_(item_ids),
            QuotationItem.quotation_id == quote_id
        ).update({
            'item_status': new_status, 
            'updated_by': data.get('updated_by'),
            'updated_at': datetime.now()
        })
        
        quotation.updated_at = datetime.now()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Updated {updated_count} item(s) to {new_status}',
            'data': {
                'updated_count': updated_count,
                'status': new_status
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Search quotations by company, item name, or quote number
@quotation_bp.route('/api/quotations/search', methods=['GET'])
def search_quotations():
    try:
        search_term = request.args.get('q', '').strip()
        status_filter = request.args.get('status')
        sales_order_status_filter = request.args.get('sales_order_status')
        
        if not search_term:
            return jsonify({'success': False, 'message': 'Search term required'}), 400
        
        # Build base query
        base_query = Quotation.query
        
        # Apply status filter if provided
        if status_filter:
            base_query = base_query.filter_by(status=status_filter)
        
        # Apply sales order status filter if provided (NEW)
        if sales_order_status_filter:
            base_query = base_query.filter_by(sales_order_status=sales_order_status_filter)
        
        # Search in company name, quote number, contact person, and notes
        quotations = base_query.filter(
            (Quotation.company_name.ilike(f'%{search_term}%')) |
            (Quotation.quote_number.ilike(f'%{search_term}%')) |
            (Quotation.contact_person.ilike(f'%{search_term}%')) |
            (Quotation.notes.ilike(f'%{search_term}%')) |
            (Quotation.requote_note.ilike(f'%{search_term}%')) |
            (Quotation.sales_order_number.ilike(f'%{search_term}%'))  # NEW: Search in sales order number
        ).order_by(Quotation.created_at.desc()).limit(50).all()
        
        # Also search in items
        item_base_query = Quotation.query
        if status_filter:
            item_base_query = item_base_query.filter_by(status=status_filter)
        if sales_order_status_filter:
            item_base_query = item_base_query.filter_by(sales_order_status=sales_order_status_filter)
            
        item_quotations = item_base_query.join(QuotationItem).filter(
            QuotationItem.item_name.ilike(f'%{search_term}%') |
            QuotationItem.description.ilike(f'%{search_term}%') |
            QuotationItem.supplier_part_no.ilike(f'%{search_term}%')
        ).order_by(Quotation.created_at.desc()).limit(50).all()
        
        # Combine results and remove duplicates
        all_quotations = quotations + item_quotations
        unique_quotations = list({quote.id: quote for quote in all_quotations}.values())
        
        return jsonify({
            'success': True,
            'data': [quote.to_dict() for quote in unique_quotations],
            'count': len(unique_quotations)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Get recent quotations
@quotation_bp.route('/api/quotations/recent', methods=['GET'])
def get_recent_quotations():
    try:
        limit = int(request.args.get('limit', 10))
        status_filter = request.args.get('status')
        sales_order_status_filter = request.args.get('sales_order_status')
        
        query = Quotation.query
        
        if status_filter:
            query = query.filter_by(status=status_filter)
        
        if sales_order_status_filter:
            query = query.filter_by(sales_order_status=sales_order_status_filter)
            
        recent_quotations = query\
            .order_by(Quotation.created_at.desc())\
            .limit(limit)\
            .all()
        
        return jsonify({
            'success': True,
            'data': [quote.to_dict() for quote in recent_quotations],
            'count': len(recent_quotations)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Create re-quote from existing quotation
@quotation_bp.route('/api/quotations/<int:quote_id>/requote', methods=['POST'])
def create_requote(quote_id):
    try:
        original_quotation = Quotation.query.get_or_404(quote_id)
        data = request.get_json()
        
        # Generate new quote number for re-quote
        new_quote_number = generate_requote_number(original_quotation.quote_number)
        
        # Create re-quote
        requote = Quotation(
            quote_number=new_quote_number,
            date=datetime.now().date().isoformat(),
            time=datetime.now().time().strftime('%H:%M:%S'),
            issuer_details=original_quotation.issuer_details,
            company_id=original_quotation.company_id,
            company_name=original_quotation.company_name,
            company_address=original_quotation.company_address,
            company_gstin=original_quotation.company_gstin,
            contact_person=original_quotation.contact_person,
            contact_mobile=original_quotation.contact_mobile,
            contact_email=original_quotation.contact_email,
            subtotal=original_quotation.subtotal,
            total_discount=original_quotation.total_discount,
            total_tax=original_quotation.total_tax,
            grand_total=original_quotation.grand_total,
            notes=data.get('notes', original_quotation.notes),
            requote_note=data.get('requote_note', ''),
            original_quote_id=quote_id,
            requote_date=datetime.now(),
            status='draft',  # New re-quote starts as draft
            review_status='pending',
            # Reset sales order fields for re-quote
            sales_order_number=None,
            sales_order_date=None,
            sales_order_status='not_created',
            sales_order_remark='',
            created_by=data.get('created_by', original_quotation.created_by),
            updated_by=data.get('updated_by'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.session.add(requote)
        db.session.flush()
        
        # Copy items from original quotation
        for original_item in original_quotation.items:
            item = QuotationItem(
                quotation_id=requote.id,
                item_name=original_item.item_name,
                hsn_sac=original_item.hsn_sac,
                supplier_part_no=original_item.supplier_part_no,
                description=original_item.description,
                cut_width=original_item.cut_width,
                length=original_item.length,
                batch_no=original_item.batch_no,
                mrp=original_item.mrp,
                quantity=original_item.quantity,
                unit=original_item.unit,
                discount=original_item.discount,
                discount_type=original_item.discount_type,
                tax_rate=original_item.tax_rate,
                item_status='pending',  # Reset status for re-quote
                review_status='pending',
                sales_order_created=False,  # Reset sales order status
                sales_order_remark='',
                sales_order_item_status='not_created',  # Reset sales order item status
                rejection_reason='',  # Reset rejection reason
                updated_by=data.get('updated_by'),
                price_per_unit=original_item.price_per_unit,
                amount_before_discount=original_item.amount_before_discount,
                discount_amount=original_item.discount_amount,
                amount_after_discount=original_item.amount_after_discount,
                tax_amount=original_item.tax_amount,
                item_total=original_item.item_total
            )
            db.session.add(item)
        
        # Update original quotation status to 'requote' if requested
        if data.get('update_original_status', False):
            original_quotation.status = 'requote'
            original_quotation.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Re-quote created successfully',
            'data': requote.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# Get all re-quotes for a quotation
@quotation_bp.route('/api/quotations/<int:quote_id>/requotes', methods=['GET'])
def get_requotes(quote_id):
    try:
        requotes = Quotation.query.filter_by(original_quote_id=quote_id)\
            .order_by(Quotation.created_at.desc())\
            .all()
        
        return jsonify({
            'success': True,
            'data': [quote.to_dict() for quote in requotes],
            'count': len(requotes)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Get rejected items from completed quotations
@quotation_bp.route("/api/quotations/items/rejected", methods=["GET"])
def get_rejected_items():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Filter: status == 'completed' AND item_status == 'rejected'
        query = QuotationItem.query\
            .join(Quotation, QuotationItem.quotation_id == Quotation.id)\
            .filter(Quotation.status == 'completed')\
            .filter(QuotationItem.item_status == 'rejected')
        
        # Get total count
        total = query.count()
        
        # Calculate offset
        offset = (page - 1) * per_page
        
        # Get paginated results
        items = query.order_by(Quotation.created_at.desc())\
            .offset(offset).limit(per_page).all()
        
        result = []
        for item in items:
            quotation = item.quotation
            result.append({
                "id": item.id,
                "item_name": item.item_name,
                "description": item.description,
                "quantity": item.quantity,
                "unit": item.unit,
                "price_per_unit": item.price_per_unit,
                "item_total": item.item_total,
                "item_status": item.item_status,
                "sales_order_item_status": item.sales_order_item_status,
                "rejection_reason": item.rejection_reason,
                "quotation_id": quotation.id,
                "quote_number": quotation.quote_number,
                "sales_order_number": quotation.sales_order_number,
                "sales_order_status": quotation.sales_order_status,
                "date": quotation.date,
                "time": quotation.time,
                "company_name": quotation.company_name,
                "company_address": quotation.company_address,
                "contact_person": quotation.contact_person,
                "contact_mobile": quotation.contact_mobile,
                "contact_email": quotation.contact_email,
                "subtotal": quotation.subtotal,
                "total_tax": quotation.total_tax,
                "grand_total": quotation.grand_total
            })
        
        # Calculate total pages
        total_pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        
        return jsonify({
            "success": True,
            "data": result,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Get rejected items statistics
@quotation_bp.route('/api/quotations/items/rejected/stats', methods=['GET'])
def get_rejected_stats():
    try:
        # Get total count of rejected items from completed quotations
        total_rejected = QuotationItem.query\
            .join(Quotation, QuotationItem.quotation_id == Quotation.id)\
            .filter(Quotation.status == 'completed')\
            .filter(QuotationItem.item_status == 'rejected')\
            .count()
        
        # Get current year
        current_year = datetime.now().year
        
        # Get rejected items by month (current year)
        monthly_stats = db.session.query(
            extract('month', Quotation.created_at).label('month'),
            func.count().label('count')
        ).join(QuotationItem, QuotationItem.quotation_id == Quotation.id)\
         .filter(Quotation.status == 'completed')\
         .filter(QuotationItem.item_status == 'rejected')\
         .filter(extract('year', Quotation.created_at) == current_year)\
         .group_by(extract('month', Quotation.created_at))\
         .order_by('month')\
         .all()
        
        # Format monthly data
        by_month = []
        for stat in monthly_stats:
            by_month.append({
                'month': stat.month,
                'count': stat.count
            })
        
        # Get rejected items by company (top 5)
        company_stats = db.session.query(
            Quotation.company_name,
            func.count().label('count')
        ).join(QuotationItem, QuotationItem.quotation_id == Quotation.id)\
         .filter(Quotation.status == 'completed')\
         .filter(QuotationItem.item_status == 'rejected')\
         .group_by(Quotation.company_name)\
         .order_by(func.count().desc())\
         .limit(5)\
         .all()
        
        # Format company data
        by_company = []
        for stat in company_stats:
            by_company.append({
                'company_name': stat.company_name,
                'count': stat.count
            })
        
        return jsonify({
            'success': True,
            'data': {
                'total': total_rejected,
                'byMonth': by_month,
                'byCompany': by_company
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# NEW: Get quotations by sales order status
@quotation_bp.route('/api/quotations/by-sales-order-status/<string:status>', methods=['GET'])
def get_quotations_by_sales_order_status(status):
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        valid_statuses = ['not_created', 'draft', 'confirmed', 'in_production', 
                         'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled']
        
        if status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid sales order status'}), 400
        
        query = Quotation.query.filter_by(sales_order_status=status)
        
        quotations = query.order_by(Quotation.created_at.desc())\
                         .paginate(page=page, per_page=per_page, error_out=False)
        
        result = {
            'success': True,
            'data': [quote.to_dict() for quote in quotations.items],
            'pagination': {
                'page': quotations.page,
                'per_page': quotations.per_page,
                'total': quotations.total,
                'pages': quotations.pages
            }
        }
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# NEW: Get items by sales order item status
@quotation_bp.route('/api/quotations/items/by-sales-order-status/<string:status>', methods=['GET'])
def get_items_by_sales_order_item_status(status):
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        quotation_id = request.args.get('quotation_id')
        
        valid_statuses = ['not_created', 'ordered', 'in_production', 'ready', 'dispatched', 'delivered', 'rejected']
        
        if status not in valid_statuses:
            return jsonify({'success': False, 'message': 'Invalid sales order item status'}), 400
        
        query = QuotationItem.query.filter_by(sales_order_item_status=status)
        
        # Filter by quotation if provided
        if quotation_id:
            query = query.filter_by(quotation_id=quotation_id)
        
        # Get total count
        total = query.count()
        
        # Calculate offset
        offset = (page - 1) * per_page
        
        # Get paginated results
        items = query.order_by(QuotationItem.updated_at.desc())\
            .offset(offset).limit(per_page).all()
        
        result = []
        for item in items:
            quotation = item.quotation
            result.append({
                "id": item.id,
                "item_name": item.item_name,
                "description": item.description,
                "quantity": item.quantity,
                "unit": item.unit,
                "price_per_unit": item.price_per_unit,
                "item_total": item.item_total,
                "item_status": item.item_status,
                "sales_order_item_status": item.sales_order_item_status,
                "sales_order_created": item.sales_order_created,
                "sales_order_remark": item.sales_order_remark,
                "rejection_reason": item.rejection_reason,
                "quotation_id": quotation.id,
                "quote_number": quotation.quote_number,
                "sales_order_number": quotation.sales_order_number,
                "sales_order_status": quotation.sales_order_status,
                "date": quotation.date,
                "time": quotation.time,
                "company_name": quotation.company_name,
                "company_address": quotation.company_address,
                "contact_person": quotation.contact_person,
                "contact_mobile": quotation.contact_mobile,
                "contact_email": quotation.contact_email
            })
        
        # Calculate total pages
        total_pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        
        return jsonify({
            "success": True,
            "data": result,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    
@quotation_bp.route('/api/quotations/export', methods=['GET'])
def export_quotations():
    """Export quotations for a given date range"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        status = request.args.get('status', 'completed')

        if not start_date or not end_date:
            return jsonify({
                "success": False,
                "message": "Start date and end date are required"
            }), 400

        # Parse dates
        start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)

        # ✅ Use Flask-SQLAlchemy session
        query = db.session.query(Quotation)

        # Status filter
        if status != 'all':
            query = query.filter(Quotation.status == status)

        # Date filter
        if hasattr(Quotation, 'createdAt'):
            query = query.filter(
                Quotation.createdAt >= start_datetime,
                Quotation.createdAt < end_datetime
            )
        elif hasattr(Quotation, 'date'):
            query = query.filter(
                Quotation.date >= start_date,
                Quotation.date <= end_date
            )

        # Ordering
        if hasattr(Quotation, 'createdAt'):
            query = query.order_by(desc(Quotation.createdAt))
        elif hasattr(Quotation, 'date'):
            query = query.order_by(desc(Quotation.date))

        quotations = query.all()

        result = []
        for quote in quotations:
            quote_dict = quote.to_dict() if hasattr(quote, 'to_dict') else {}

            if 'items' not in quote_dict and hasattr(quote, 'items'):
                quote_dict['items'] = [
                    item.to_dict() if hasattr(item, 'to_dict') else {}
                    for item in quote.items
                ]

            if hasattr(quote, 'createdAt') and quote.createdAt:
                quote_dict['createdAt'] = quote.createdAt.isoformat()

            result.append(quote_dict)

        return jsonify({
            "success": True,
            "data": result,
            "count": len(result),
            "message": f"Found {len(result)} quotations"
        }), 200

    except ValueError as e:
        return jsonify({
            "success": False,
            "message": f"Invalid date format: {str(e)}"
        }), 400

    except Exception as e:
        print("Export error:", e)
        return jsonify({
            "success": False,
            "message": f"Server error: {str(e)}"
        }), 500

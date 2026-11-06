from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from sqlalchemy import func, or_
from sqlalchemy import desc
import uuid

from app import db
from app.models.enquiry import Enquiry, EnquiryItem
from app.models.quotation import Quotation, QuotationItem
from app.models.stock import Stock

enquiry_bp = Blueprint('enquiries', __name__, url_prefix='/api/enquiries')

def create_quotation_from_enquiry(enquiry, created_by='System'):
    """Automatically create a draft quotation from a converted enquiry if not already created."""
    try:
        # Check if a quotation already exists for this enquiry
        note_tag = f"Converted from Enquiry #{enquiry.enquiry_number}"
        existing_quote = Quotation.query.filter(
            Quotation.notes.like(f"%Enquiry #{enquiry.enquiry_number}%")
        ).first()

        if existing_quote:
            print(f"ℹ️ Quotation already exists for Enquiry #{enquiry.enquiry_number}: {existing_quote.quote_number}")
            return existing_quote

        # Generate unique quote number
        date_str = datetime.utcnow().strftime("%Y%m%d")
        random_num = str(uuid.uuid4().int)[:6]
        quote_number = f"Q-{date_str}-{random_num}"

        now = datetime.utcnow()
        quotation = Quotation(
            quote_number=quote_number,
            date=now.date().isoformat(),
            time=now.time().strftime('%H:%M:%S'),
            company_id=enquiry.company_id,
            company_name=enquiry.company_name,
            company_address=enquiry.company_address or '',
            company_gstin=enquiry.company_gstin or '',
            contact_person=enquiry.contact_person or '',
            contact_mobile=enquiry.contact_mobile or '',
            contact_email=enquiry.contact_email or '',
            status='draft',
            review_status='pending',
            notes=note_tag,
            created_by=created_by or 'System',
            updated_by=created_by or 'System',
            subtotal=0,
            total_discount=0,
            total_packing=0,
            total_freight=0,
            total_tax=0,
            grand_total=0
        )

        db.session.add(quotation)
        db.session.flush()

        subtotal = 0.0

        for item in enquiry.items:
            cut_width = float(item.cut_width or 1.0)
            length = float(item.length or 1.0)
            quantity = float(item.quantity or 1.0)

            # Try to lookup stock item for MRP
            stock_item = None
            if item.brand_code:
                stock_item = Stock.query.filter(Stock.brand_code == item.brand_code).first()
            if not stock_item and item.item_name:
                stock_item = Stock.query.filter(Stock.item_name.ilike(f"%{item.item_name}%")).first()

            mrp = float(stock_item.mrp) if (stock_item and stock_item.mrp) else 0.0
            price_per_unit = mrp * cut_width * length
            amount_before_discount = price_per_unit * quantity
            item_total = amount_before_discount

            q_item = QuotationItem(
                quotation_id=quotation.id,
                item_name=item.item_name or '',
                hsn_sac=item.hsn_sac or (stock_item.hsn if stock_item else ''),
                supplier_part_no=item.supplier_part_no or '',
                customer_part_no='',
                description=item.description or '',
                customer_description=item.customer_description or '',
                cut_width=cut_width,
                length=length,
                batch_no=item.batch_no or f"B-{str(uuid.uuid4().int)[:6]}",
                mrp=mrp,
                quantity=quantity,
                unit=item.unit or 'pcs',
                discount=0,
                discount_type='amount',
                tax_rate=18.0,
                packing_charges=0,
                freight_charges=0,
                profit_percentage=20.0,
                price_per_unit=price_per_unit,
                amount_before_discount=amount_before_discount,
                discount_amount=0,
                amount_after_discount=amount_before_discount,
                tax_amount=0,
                item_total=item_total,
                item_status='pending',
                review_status='pending'
            )
            db.session.add(q_item)
            subtotal += item_total

        quotation.subtotal = subtotal
        quotation.grand_total = subtotal

        print(f"✨ Auto-created Quotation {quotation.quote_number} for Enquiry #{enquiry.enquiry_number}")
        return quotation

    except Exception as e:
        print(f"❌ Error in create_quotation_from_enquiry: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def build_item_description(item_data):
    """Build description string from item data (legacy support)"""
    description_parts = []
    
    if item_data.get("description"):
        description_parts.append(str(item_data["description"]))
    
    if item_data.get("customer_description"):
        description_parts.append(f"[CUSTOMER_DESC:{item_data['customer_description']}]")
    
    if item_data.get("brand_code"):
        description_parts.append(f"[BRAND_CODE:{item_data['brand_code']}]")
    
    if item_data.get("customer_requirements"):
        description_parts.append(f"[REQUIREMENTS:{item_data['customer_requirements']}]")
    
    return " ".join(description_parts) if description_parts else ""

def parse_description(description):
    """Parse description to extract embedded data (legacy support)"""
    if not description:
        return "", "", "", ""

    brand_code = ""
    customer_description = ""
    customer_requirements = ""
    clean_description = description

    try:
        if '[BRAND_CODE:' in description:
            brand_code = description.split('[BRAND_CODE:')[1].split(']')[0]

        if '[CUSTOMER_DESC:' in description:
            customer_description = description.split('[CUSTOMER_DESC:')[1].split(']')[0]

        if '[REQUIREMENTS:' in description:
            customer_requirements = description.split('[REQUIREMENTS:')[1].split(']')[0]

        for tag in ['[BRAND_CODE:', '[CUSTOMER_DESC:', '[REQUIREMENTS:']:
            while tag in clean_description:
                start = clean_description.find(tag)
                end = clean_description.find(']', start) + 1
                clean_description = clean_description[:start] + clean_description[end:]

        clean_description = clean_description.strip()

    except Exception:
        pass

    return clean_description, brand_code, customer_description, customer_requirements

@enquiry_bp.before_request
def log_request_info():
    """Log request info for debugging"""
    if request.method in ['POST', 'PUT', 'DELETE']:
        print(f"\n{'='*50}")
        print(f"{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{request.method} {request.path}")
        print(f"{'='*50}")


@enquiry_bp.route('/', methods=['GET'])
def get_enquiries():
    """Get all enquiries with pagination and filtering"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('q', '').strip()
    status = request.args.get('status', '').strip()

    query = Enquiry.query

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Enquiry.enquiry_number.ilike(like),
                Enquiry.company_name.ilike(like),
                Enquiry.contact_person.ilike(like),
                Enquiry.contact_email.ilike(like),
            )
        )

    if status and status != 'all':
        query = query.filter(Enquiry.status == status)

    total = query.count()
    enquiries = query.order_by(Enquiry.created_at.desc()) \
        .offset((page - 1) * per_page) \
        .limit(per_page) \
        .all()

    return jsonify({
        "success": True,
        "data": [e.to_dict() for e in enquiries],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page
        }
    })


@enquiry_bp.route('/', methods=['POST'])
def create_enquiry():
    """Create a new enquiry"""
    data = request.get_json()

    print(f"\n📝 CREATE ENQUIRY REQUEST:")
    print(f"Company: {data.get('company_name')}")
    print(f"Contact: {data.get('contact_person')}")
    print(f"Items: {len(data.get('items', []))}")

    if not data.get("company_name"):
        return jsonify({"success": False, "message": "Company name is required"}), 400

    try:
        # Convert company_id if provided
        company_id = None
        if 'company_id' in data and data['company_id']:
            try:
                company_id = int(data['company_id'])
            except (ValueError, TypeError):
                company_id = None
                print("⚠️ Warning: Invalid company_id, setting to None")

        # Create enquiry
        enquiry = Enquiry(
            enquiry_number=Enquiry.generate_enquiry_number(),
            company_name=data["company_name"],
            company_address=data.get("company_address", ""),
            company_pincode=data.get("company_pincode", ""),
            company_gstin=data.get("company_gstin", ""),
            contact_person=data.get("contact_person", ""),
            contact_mobile=data.get("contact_mobile", ""),
            contact_email=data.get("contact_email", ""),
            status=data.get("status", "draft"),
            created_by=data.get("created_by", "User"),
            updated_by=data.get("updated_by", "User"),
            company_id=company_id
        )

        db.session.add(enquiry)
        db.session.flush()  # Get the enquiry ID

        total_quantity = 0
        total_items = len(data.get("items", []))

        print(f"\n📦 Processing {total_items} items...")
        
        for idx, item in enumerate(data.get("items", []), 1):
            # Build description (legacy support)
            description = build_item_description(item)
            
            # Calculate count (width × length × quantity)
            cut_width = float(item.get("cut_width", 1.0))
            length = float(item.get("length", 1.0))
            quantity = float(item.get("quantity", 1.0))
            count = cut_width * length * quantity
            
            total_quantity += quantity
            
            # Create enquiry item
            enquiry_item = EnquiryItem(
                enquiry_id=enquiry.id,
                item_name=item.get("item_name", ""),
                hsn_sac=item.get("hsn_sac", ""),
                supplier_part_no=item.get("supplier_part_no", ""),
                description=description,
                cut_width=cut_width,
                length=length,
                count=count,
                batch_no=item.get("batch_no", ""),
                brand_code=item.get("brand_code", ""),
                quantity=quantity,
                unit=item.get("unit", "pcs"),
                # Store customer description and requirements in separate fields
                customer_description=item.get("customer_description", ""),
                customer_requirements=item.get("customer_requirements", ""),
                notes=item.get("notes", ""),
                source=item.get("source", "email")
            )
            
            db.session.add(enquiry_item)
            print(f"  {idx}. {item.get('item_name')[:30]}... (Qty: {quantity})")

        # Update totals
        enquiry.total_items = total_items
        enquiry.total_quantity = total_quantity

        db.session.commit()
        
        print(f"\n✅ ENQUIRY CREATED: {enquiry.enquiry_number}")
        print(f"   Items: {total_items}, Total Qty: {total_quantity}")
        print(f"{'='*50}\n")
        
        return jsonify({
            "success": True,
            "message": "Enquiry created successfully",
            "data": enquiry.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"\n❌ ERROR creating enquiry: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*50}\n")
        
        return jsonify({
            "success": False,
            "message": f"Failed to create enquiry: {str(e)}"
        }), 500


@enquiry_bp.route('/<int:enquiry_id>', methods=['GET'])
def get_enquiry(enquiry_id):
    """Get a single enquiry by ID"""
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    return jsonify({"success": True, "data": enquiry.to_dict()})


@enquiry_bp.route('/<int:enquiry_id>', methods=['PUT'])
def update_enquiry(enquiry_id):
    """Update an existing enquiry"""
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    data = request.get_json()
    
    print(f"\n🔄 UPDATE ENQUIRY {enquiry_id} ({enquiry.enquiry_number})")
    
    try:
        old_status = enquiry.status
        # Update enquiry status
        if 'status' in data:
            enquiry.status = data['status']
            print(f"Status: {old_status} → {data['status']}")
            if data['status'] == 'converted' and old_status != 'converted':
                create_quotation_from_enquiry(enquiry, data.get('updated_by', 'System'))
        
        # Update contact info if provided
        if 'contact_person' in data:
            enquiry.contact_person = data['contact_person']
        if 'contact_mobile' in data:
            enquiry.contact_mobile = data['contact_mobile']
        if 'contact_email' in data:
            enquiry.contact_email = data['contact_email']
        
        # Update updated_by
        if 'updated_by' in data:
            enquiry.updated_by = data['updated_by']
        
        db.session.commit()
        
        print(f"✅ Enquiry {enquiry_id} updated successfully")
        
        return jsonify({
            "success": True,
            "message": "Enquiry updated successfully",
            "data": enquiry.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR updating enquiry: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to update enquiry: {str(e)}"
        }), 500


@enquiry_bp.route('/<int:enquiry_id>/convert', methods=['POST'])
def convert_enquiry_to_quotation(enquiry_id):
    """Convert an enquiry to a quotation and create the quotation record in Quotation Management"""
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    data = request.get_json() or {}
    user = data.get('created_by') or data.get('updated_by') or 'User'

    try:
        old_status = enquiry.status
        enquiry.status = 'converted'
        enquiry.updated_by = user

        quote = create_quotation_from_enquiry(enquiry, created_by=user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Enquiry #{enquiry.enquiry_number} converted to Quotation #{quote.quote_number if quote else ''}",
            "data": {
                "enquiry": enquiry.to_dict(),
                "quotation": quote.to_dict() if quote else None
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR converting enquiry: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Failed to convert enquiry: {str(e)}"
        }), 500


@enquiry_bp.route('/<int:enquiry_id>', methods=['DELETE'])
def delete_enquiry(enquiry_id):
    """Delete an enquiry"""
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    
    print(f"\n🗑️ DELETE ENQUIRY {enquiry_id} ({enquiry.enquiry_number})")
    
    try:
        db.session.delete(enquiry)
        db.session.commit()
        
        print(f"✅ Enquiry {enquiry_id} deleted successfully")
        
        return jsonify({
            "success": True, 
            "message": "Enquiry deleted successfully"
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR deleting enquiry: {str(e)}")
        return jsonify({
            "success": False, 
            "message": f"Failed to delete enquiry: {str(e)}"
        }), 500


# ==================== ITEMS ====================

@enquiry_bp.route('/<int:enquiry_id>/items', methods=['GET'])
def get_items(enquiry_id):
    """Get all items for an enquiry"""
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    items = enquiry.items
    
    result = []
    for item in items:
        # Parse description for legacy support
        clean_desc, brand, cust_desc, req = parse_description(item.description)
        
        # Use separate fields if available, otherwise use parsed data
        d = {
            'id': item.id,
            'item_name': item.item_name,
            'hsn_sac': item.hsn_sac,
            'supplier_part_no': item.supplier_part_no,
            'description': clean_desc,
            'cut_width': item.cut_width,
            'length': item.length,
            'count': item.count,
            'batch_no': item.batch_no,
            'brand_code': item.brand_code or brand,
            'quantity': item.quantity,
            'unit': item.unit,
            'customer_description': item.customer_description or cust_desc,
            'customer_requirements': item.customer_requirements or req,
            'notes': item.notes,
            'source': item.source,
            'enquiry_id': item.enquiry_id,
            'created_at': item.created_at.isoformat() if item.created_at else None,
            'updated_at': item.updated_at.isoformat() if item.updated_at else None
        }
        result.append(d)

    return jsonify({"success": True, "data": result})


# ==================== STATUS MANAGEMENT ====================

@enquiry_bp.route('/<int:enquiry_id>/status', methods=['PUT'])
def update_enquiry_status(enquiry_id):
    """Update enquiry status only"""
    enquiry = Enquiry.query.get_or_404(enquiry_id)
    data = request.get_json()
    
    if not data.get('status'):
        return jsonify({
            "success": False,
            "message": "Status is required"
        }), 400
    
    valid_statuses = ['draft', 'in_progress', 'responded', 'converted', 'lost']
    new_status = data['status']
    
    if new_status not in valid_statuses:
        return jsonify({
            "success": False,
            "message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        }), 400
    
    print(f"\n🔄 UPDATE STATUS: Enquiry {enquiry_id} ({enquiry.enquiry_number})")
    print(f"Current: {enquiry.status} → New: {new_status}")
    
    try:
        old_status = enquiry.status
        enquiry.status = new_status
        enquiry.updated_by = data.get('updated_by', 'System')
        
        created_quote = None
        if new_status == 'converted' and old_status != 'converted':
            created_quote = create_quotation_from_enquiry(enquiry, data.get('updated_by', 'System'))

        db.session.commit()
        
        print(f"✅ Status updated successfully")
        
        res_data = {
            'id': enquiry.id,
            'enquiry_number': enquiry.enquiry_number,
            'old_status': old_status,
            'new_status': new_status,
            'updated_at': enquiry.updated_at.isoformat() if enquiry.updated_at else None
        }
        if created_quote:
            res_data['quotation'] = created_quote.to_dict()

        return jsonify({
            "success": True,
            "message": f"Enquiry status updated from '{old_status}' to '{new_status}'",
            "data": res_data
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR updating status: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to update status: {str(e)}"
        }), 500


@enquiry_bp.route('/status/bulk-update', methods=['POST'])
def bulk_update_status():
    """Bulk update enquiry statuses"""
    data = request.get_json()
    
    if not data.get('enquiry_ids') or not data.get('status'):
        return jsonify({
            "success": False,
            "message": "enquiry_ids and status are required"
        }), 400
    
    valid_statuses = ['draft', 'in_progress', 'responded', 'converted', 'lost']
    new_status = data['status']
    
    if new_status not in valid_statuses:
        return jsonify({
            "success": False,
            "message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        }), 400
    
    print(f"\n🔄 BULK UPDATE STATUS:")
    print(f"Enquiries: {len(data['enquiry_ids'])}")
    print(f"New Status: {new_status}")
    
    try:
        enquiry_ids = data['enquiry_ids']
        updated_by = data.get('updated_by', 'System')
        
        # Update enquiries
        updated_count = Enquiry.query.filter(Enquiry.id.in_(enquiry_ids)).update(
            {
                'status': new_status,
                'updated_by': updated_by,
                'updated_at': datetime.utcnow()
            },
            synchronize_session=False
        )
        
        db.session.commit()
        
        print(f"✅ Updated {updated_count} enquiries")
        
        return jsonify({
            "success": True,
            "message": f"Updated status for {updated_count} enquiries to '{new_status}'",
            "data": {
                "updated_count": updated_count,
                "new_status": new_status
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR in bulk update: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Failed to update statuses: {str(e)}"
        }), 500


# ==================== DASHBOARD & STATISTICS ====================

@enquiry_bp.route('/statistics', methods=['GET'])
def enquiry_statistics():
    """Get enquiry statistics"""
    try:
        stats = Enquiry.get_statistics()
        
        return jsonify({
            "success": True,
            "data": stats
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error fetching statistics: {str(e)}"
        }), 500


@enquiry_bp.route('/dashboard/summary', methods=['GET'])
def dashboard_summary():
    """Dashboard summary endpoint"""
    return enquiry_statistics()


# ==================== DEBUG & TEST ENDPOINTS ====================

@enquiry_bp.route('/test', methods=['GET'])
def test_endpoint():
    """Test if API is working"""
    return jsonify({
        "success": True,
        "message": "Enquiries API is working",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0",
        "features": [
            "Enquiry creation with customer_description support",
            "Enquiry-level status management (no item-level status)",
            "Bulk status updates",
            "Enhanced debugging logs"
        ]
    })


@enquiry_bp.route('/fields', methods=['GET'])
def expected_fields():
    """Show expected fields for enquiry creation"""
    return jsonify({
        "success": True,
        "expected_fields": {
            "enquiry": {
                "required": ["company_name"],
                "optional": [
                    "company_address", "company_pincode", "company_gstin",
                    "contact_person", "contact_mobile", "contact_email",
                    "status", "created_by", "updated_by", "company_id"
                ]
            },
            "items": {
                "required": ["item_name"],
                "optional": [
                    "customer_description",  # Direct field
                    "brand_code",  # Direct field
                    "customer_requirements",  # Direct field
                    "hsn_sac", "supplier_part_no", "description",
                    "cut_width", "length", "quantity", "batch_no",
                    "unit", "notes", "source"
                ],
                "note": "customer_description, brand_code, and customer_requirements are now direct fields (no tags needed)"
            }
        }
    })


@enquiry_bp.route('/export', methods=['GET'])
def export_enquiries():
    """Export enquiries for a given date range"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        status = request.args.get('status', '').strip()

        if not start_date or not end_date:
            return jsonify({
                "success": False,
                "message": "start_date and end_date are required (YYYY-MM-DD)"
            }), 400

        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)

        query = db.session.query(Enquiry)

        # Status filter
        if status and status != "all":
            query = query.filter(Enquiry.status == status)

        # Date filter
        if hasattr(Enquiry, "created_at"):
            query = query.filter(
                Enquiry.created_at >= start_dt,
                Enquiry.created_at < end_dt
            )

        enquiries = query.order_by(desc(Enquiry.created_at)).all()

        data = []
        for e in enquiries:
            d = e.to_dict()

            # include items if needed
            if hasattr(e, "items"):
                d["items"] = [
                    item.to_dict() if hasattr(item, "to_dict") else {}
                    for item in e.items
                ]

            data.append(d)

        return jsonify({
            "success": True,
            "count": len(data),
            "data": data
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
            "message": str(e)
        }), 500

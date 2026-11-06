from flask import Blueprint, request, jsonify
from app import db
from app.models.task import Task
from app.models.quotation import Quotation, QuotationItem
from sqlalchemy import func
from datetime import datetime

task_bp = Blueprint("task", __name__)

# ✅ CREATE TASK - UPDATED WITH PO_NUMBER, BRAND_CODE, BATCH_NO
@task_bp.route("/api/tasks", methods=["POST"])
def create_task():
    try:
        data = request.get_json()
        print("📥 Received task data:", data)
        
        item_details = data.get("item_details", {})
        
        # Extract brand_code and batch_no from data
        brand_code = data.get("brand_code") or item_details.get("brand_code", "")
        batch_no = data.get("batch_no") or item_details.get("batch_no", "")
        
        # Generate PO number if not provided
        po_number = data.get("po_number", "").strip()
        if not po_number:
            # Auto-generate PO number
            timestamp = datetime.utcnow().strftime("%y%m%d%H%M")
            quotation_number = data.get("quotation_number") or item_details.get("quote_number") or item_details.get("quotation_number", "")
            quote_part = quotation_number[-4:] if quotation_number else "0000"
            po_number = f"PO-{timestamp}-{quote_part}"
        
        # Create task with new fields
        task = Task(
            po_number=po_number,  # ✅ Auto-generated or provided
            
            description=data.get("description", ""),
            priority=data.get("priority", "Medium"),
            dueDate=data.get("dueDate", ""),
            assignedTo=data.get("assignedTo", ""),
            assignedBy=data.get("assignedBy", ""),
            assignedByEmail=data.get("assignedByEmail", ""),
            
            # Quotation details
            quotation_id=data.get("quotation_id") or item_details.get("quotation_id"),
            quotation_number=data.get("quotation_number") or item_details.get("quote_number") or item_details.get("quotation_number", ""),
            company_name=data.get("company_name") or item_details.get("company_name", ""),
            company_address=data.get("company_address") or item_details.get("company_address", ""),  # ✅ NEW
            
            item_id=data.get("item_id") or item_details.get("id"),
            item_name=data.get("item_name") or item_details.get("item_name", ""),
            
            # Item details with brand and batch
            supplier_part_no=data.get("supplier_part_no") or item_details.get("supplier_part_no", ""),
            brand_code=brand_code,  # ✅ NEW
            batch_no=batch_no,      # ✅ NEW
            hsn_sac=data.get("hsn_sac") or item_details.get("hsn_sac", ""),
            cut_width=data.get("cut_width") or item_details.get("cut_width", ""),
            length=data.get("length") or item_details.get("length", ""),
            quantity=data.get("quantity") or item_details.get("quantity", ""),
            unit=data.get("unit") or item_details.get("unit", "pcs"),
            mrp=data.get("mrp") or item_details.get("mrp", ""),
            material_type=data.get("material_type") or item_details.get("material_type", ""),
            thickness=data.get("thickness") or item_details.get("thickness", ""),
            
            # Task status
            status=data.get("status", "Pending"),
            status_check=data.get("status_check"),
            note=data.get("note", ""),
            createdAt=datetime.utcnow(),
        )
        
        db.session.add(task)
        db.session.commit()
        
        print("✅ Task saved:", task.id, task.po_number)
        return jsonify({
            "success": True,
            "message": "✅ Task created successfully",
            "task": task.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print("❌ Error creating task:", str(e))
        return jsonify({
            "success": False,
            "error": "Failed to create task",
            "message": str(e)
        }), 500


# ✅ GET ALL TASKS WITH FILTERS - UPDATED SEARCH FIELDS
@task_bp.route("/api/tasks", methods=["GET"])
def get_tasks():
    try:
        # Get query parameters
        status = request.args.get('status')
        priority = request.args.get('priority')
        assigned_to = request.args.get('assigned_to')
        search = request.args.get('search')
        show_completed = request.args.get('show_completed', 'true').lower() == 'true'
        po_number = request.args.get('po_number')
        brand_code = request.args.get('brand_code')
        batch_no = request.args.get('batch_no')
        
        query = Task.query
        
        # Apply filters
        if status and status != 'all':
            query = query.filter_by(status=status)
        
        if priority and priority != 'all':
            query = query.filter_by(priority=priority)
            
        if assigned_to and assigned_to != 'all':
            query = query.filter_by(assignedTo=assigned_to)
            
        if po_number:
            query = query.filter(Task.po_number.ilike(f'%{po_number}%'))
            
        if brand_code:
            query = query.filter(Task.brand_code.ilike(f'%{brand_code}%'))
            
        if batch_no:
            query = query.filter(Task.batch_no.ilike(f'%{batch_no}%'))
            
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Task.po_number.ilike(search_term)) |          # ✅ Search by PO number
                (Task.description.ilike(search_term)) |
                (Task.item_name.ilike(search_term)) |
                (Task.company_name.ilike(search_term)) |
                (Task.quotation_number.ilike(search_term)) |
                (Task.supplier_part_no.ilike(search_term)) |
                (Task.brand_code.ilike(search_term)) |         # ✅ NEW: Search by brand code
                (Task.batch_no.ilike(search_term))             # ✅ NEW: Search by batch no
            )
        
        # By default exclude finally completed tasks (Status=Completed & Invoice exists)
        include_finally_completed = request.args.get('include_finally_completed', 'false').lower() == 'true'
        
        # Order by priority, due date, then creation date
        tasks = query.order_by(
            db.case(
                (Task.priority == 'High', 1),
                (Task.priority == 'Medium', 2),
                (Task.priority == 'Low', 3),
                else_=4
            )
        ).order_by(Task.dueDate).order_by(Task.createdAt.desc()).all()
        
        if not include_finally_completed:
            active_tasks = [t.to_dict() for t in tasks if not t.is_finally_completed]
            return jsonify(active_tasks), 200
        
        return jsonify([task.to_dict() for task in tasks]), 200
    except Exception as e:
        print("❌ Error fetching tasks:", str(e))
        return jsonify({
            "success": False,
            "error": "Failed to fetch tasks",
            "message": str(e)
        }), 500


# ✅ GET TASKS BY ASSIGNER EMAIL
@task_bp.route("/api/tasks/assigned-by/<string:email>", methods=["GET"])
def get_tasks_by_assigner(email):
    try:
        tasks = Task.query.filter_by(assignedByEmail=email).order_by(Task.createdAt.desc()).all()
        return jsonify([task.to_dict() for task in tasks]), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch tasks",
            "message": str(e)
        }), 500


# ✅ UPDATE TASK - UPDATED WITH NEW FIELDS
@task_bp.route("/api/tasks/<int:id>", methods=["PUT"])
def update_task(id):
    try:
        data = request.get_json()
        task = Task.query.get_or_404(id)

        update_fields = [
            'po_number', 'description', 'priority', 'dueDate',
            'assignedTo', 'assignedBy', 'assignedByEmail',
            'quotation_id', 'quotation_number', 'company_name', 'company_address',
            'item_id', 'item_name', 'supplier_part_no', 'brand_code', 'batch_no',
            'hsn_sac', 'cut_width', 'length', 'quantity', 'unit', 'mrp',
            'material_type', 'thickness', 'status', 'status_check', 
            'note', 'production_start_date', 'production_end_date',
            'production_status', 'quality_check', 'completedAt',
            'cancelledAt', 'cancellation_reason'
        ]
        
        for field in update_fields:
            if field in data:
                value = data[field]
                if field in ['production_start_date', 'production_end_date', 'completedAt', 'cancelledAt'] and value:
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        # Try different format
                        try:
                            value = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f")
                        except ValueError:
                            try:
                                value = datetime.strptime(value, "%Y-%m-%d")
                            except ValueError:
                                value = None
                setattr(task, field, value)
        
        # Auto-update updatedAt timestamp
        task.updatedAt = datetime.utcnow()

        db.session.commit()
        return jsonify({
            "success": True,
            "message": "✅ Task updated successfully",
            "task": task.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        print("❌ Error updating task:", str(e))
        return jsonify({
            "success": False,
            "error": "Failed to update task",
            "message": str(e)
        }), 500


# ✅ UPDATE INVOICE DETAILS (BY TASK CREATOR)
@task_bp.route("/api/tasks/<int:id>/invoice", methods=["PUT"])
def update_task_invoice(id):
    try:
        data = request.get_json() or {}
        task = Task.query.get_or_404(id)
        
        invoice_number = (data.get("invoice_number") or "").strip()
        user_email = (data.get("user_email") or data.get("updated_by") or "").strip().lower()
        
        # Check permissions: Invoice No must be entered/updated by task creator
        creator_email = (task.assignedByEmail or task.assignedBy or "").strip().lower()
        if user_email and creator_email and user_email != creator_email:
            return jsonify({
                "success": False,
                "message": "Only the task creator can enter or update the Invoice No."
            }), 403
        
        if not invoice_number:
            return jsonify({
                "success": False,
                "message": "Invoice number is required"
            }), 400
        
        task.invoice_number = invoice_number
        if data.get("invoice_amount"):
            task.invoice_amount = float(data.get("invoice_amount"))
        task.invoice_date = datetime.utcnow()
        task.invoice_remarks = data.get("invoice_remarks", "")
        task.invoice_created_at = datetime.utcnow()
        task.updatedAt = datetime.utcnow()
        
        # Auto-finalize if status is already Completed
        if task.status == "Completed" or task.status_check == "Completed":
            task.completedAt = datetime.utcnow()

        db.session.commit()
        return jsonify({
            "success": True,
            "message": "✅ Invoice details updated successfully",
            "task": task.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to update invoice details",
            "message": str(e)
        }), 500


# ✅ PATCH TASK STATUS WITH REMARKS AND STATUS HISTORY
@task_bp.route("/api/tasks/<int:id>/status", methods=["PATCH", "PUT"])
def update_task_status(id):
    try:
        data = request.get_json() or {}
        task = Task.query.get_or_404(id)
        
        # Prevent status modification if task is already finally completed and locked
        if task.is_finally_completed:
            return jsonify({
                "success": False,
                "message": "This task is finally completed and locked. Status cannot be changed."
            }), 400

        prev_status = task.status_check or task.status or "Pending"
        new_status = data.get("status") or data.get("status_check")
        remarks = data.get("remarks") or data.get("note") or ""
        updated_by = data.get("updated_by") or data.get("updatedByEmail") or data.get("updatedBy") or "User"
        is_creator_action = data.get("is_creator_action", False)
        
        if not new_status:
            return jsonify({"success": False, "message": "Status is required"}), 400
        
        valid_statuses = ["Pending", "In Progress", "No Stock", "Completed", "Cancelled"]
        if new_status not in valid_statuses:
            # Case insensitive fallback
            matched = next((s for s in valid_statuses if s.lower() == new_status.lower()), None)
            if matched:
                new_status = matched
            else:
                return jsonify({"success": False, "message": f"Invalid status '{new_status}'"}), 400

        # If Task Creator is attempting to finalize Completed status in Task Management, validate Invoice No
        if new_status == "Completed" and is_creator_action:
            if not task.invoice_number or not str(task.invoice_number).strip():
                return jsonify({
                    "success": False,
                    "message": "Please enter the Invoice No before completing this task."
                }), 400
            task.completedAt = datetime.utcnow()

        if new_status == "Completed" and task.invoice_number and str(task.invoice_number).strip():
            task.completedAt = datetime.utcnow()
        elif new_status != "Completed":
            task.completedAt = None

        if new_status == "Cancelled":
            task.cancelledAt = datetime.utcnow()
            task.cancellation_reason = remarks

        task.status = new_status
        task.status_check = new_status
        if remarks:
            task.note = remarks
        task.updatedAt = datetime.utcnow()

        # Create status history audit record
        from app.models.task import TaskStatusHistory
        history = TaskStatusHistory(
            task_id=task.id,
            previous_status=prev_status,
            new_status=new_status,
            remarks=remarks,
            updated_by=updated_by
        )
        db.session.add(history)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"✅ Task status updated to '{new_status}'",
            "task": task.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to update task status",
            "message": str(e)
        }), 500

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to update task status",
            "message": str(e)
        }), 500


# ✅ GET TASK STATUS HISTORY
@task_bp.route("/api/tasks/<int:id>/history", methods=["GET"])
def get_task_status_history(id):
    try:
        from app.models.task import TaskStatusHistory
        history = TaskStatusHistory.query.filter_by(task_id=id).order_by(TaskStatusHistory.created_at.asc()).all()
        return jsonify({
            "success": True,
            "data": [h.to_dict() for h in history]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ✅ DELETE TASK
@task_bp.route("/api/tasks/<int:id>", methods=["DELETE"])
def delete_task(id):
    try:
        task = Task.query.get_or_404(id)
        db.session.delete(task)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "🗑️ Task deleted successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to delete task",
            "message": str(e)
        }), 500


# ✅ GET TASKS BY QUOTATION ID
@task_bp.route("/api/tasks/quotation/<int:quotation_id>", methods=["GET"])
def get_tasks_by_quotation(quotation_id):
    try:
        tasks = Task.query.filter_by(quotation_id=quotation_id).order_by(Task.createdAt.desc()).all()
        return jsonify({
            "success": True,
            "data": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch tasks for quotation",
            "message": str(e)
        }), 500


# ✅ SEARCH TASKS - UPDATED WITH BRAND_CODE AND BATCH_NO
@task_bp.route("/api/tasks/search", methods=["GET"])
def search_tasks():
    try:
        search_term = request.args.get('q', '').strip()
        if not search_term:
            return jsonify({
                "success": False,
                "error": "Search term required"
            }), 400
        
        tasks = Task.query.filter(
            (Task.po_number.ilike(f'%{search_term}%')) |           # ✅ Search by PO number
            (Task.description.ilike(f'%{search_term}%')) |
            (Task.item_name.ilike(f'%{search_term}%')) |
            (Task.company_name.ilike(f'%{search_term}%')) |
            (Task.quotation_number.ilike(f'%{search_term}%')) |
            (Task.supplier_part_no.ilike(f'%{search_term}%')) |
            (Task.brand_code.ilike(f'%{search_term}%')) |          # ✅ NEW
            (Task.batch_no.ilike(f'%{search_term}%'))              # ✅ NEW
        ).order_by(Task.createdAt.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to search tasks",
            "message": str(e)
        }), 500


# ✅ GET TASK STATISTICS
@task_bp.route("/api/tasks/statistics", methods=["GET"])
def get_task_statistics():
    try:
        email = request.args.get('email')
        query = Task.query
        
        if email:
            query = query.filter_by(assignedByEmail=email)
        
        total_tasks = query.count()
        
        status_counts = {}
        for status in ["Pending", "In Progress", "Completed"]:
            count = query.filter_by(status=status).count()
            status_counts[status] = count
        
        priority_counts = {}
        for priority in ["High", "Medium", "Low"]:
            count = query.filter_by(priority=priority).count()
            priority_counts[priority] = count
        
        overdue_tasks = query.filter(
            Task.dueDate < datetime.utcnow().date().isoformat(),
            Task.status != "Completed"
        ).count()
        
        # Count by brand code
        brand_counts = {}
        brand_results = db.session.query(
            Task.brand_code, 
            db.func.count(Task.id).label('count')
        ).filter(Task.brand_code.isnot(None), Task.brand_code != '').group_by(Task.brand_code).all()
        
        for brand, count in brand_results:
            brand_counts[brand] = count
        
        return jsonify({
            "success": True,
            "data": {
                "total_tasks": total_tasks,
                "status_counts": status_counts,
                "priority_counts": priority_counts,
                "overdue_tasks": overdue_tasks,
                "brand_counts": brand_counts  # ✅ NEW: Count by brand
            }
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch task statistics",
            "message": str(e)
        }), 500


# ✅ GET TASK DETAILS
@task_bp.route("/api/tasks/<int:id>", methods=["GET"])
def get_task_details(id):
    try:
        task = Task.query.get_or_404(id)
        return jsonify({
            "success": True,
            "task": task.to_dict()
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch task details",
            "message": str(e)
        }), 500


# ✅ GET ONLY COMPLETED TASKS (FOR STOCK / SOLD / INVENTORY)
@task_bp.route("/api/tasks/completed", methods=["GET"])
def get_completed_tasks():
    try:
        tasks = (
            Task.query
            .filter(Task.status_check == "Completed")
            .order_by(Task.createdAt.desc())
            .all()
        )

        return jsonify({
            "success": True,
            "data": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ✅ GET APPROVED ITEMS FROM QUOTATIONS FOR TASK CREATION
@task_bp.route("/api/tasks/approved-items", methods=["GET"])
def get_approved_quotation_items():
    try:
        # 1. Get all item IDs that already have an active/created task
        assigned_tasks = Task.query.all()
        assigned_item_ids = {
            t.item_id for t in assigned_tasks 
            if t.item_id is not None and getattr(t, 'status_check', None) != 'Cancelled'
        }
        
        # 2. Query quotations with status 'approved' or 'completed' (case-insensitive)
        eligible_quotations = Quotation.query.filter(
            func.lower(Quotation.status).in_(['approved', 'completed'])
        ).all()
        
        approved_items = []
        print("\n=== [DEBUG] FETCHING APPROVED ITEMS FOR TASK CREATION ===")
        
        for quote in eligible_quotations:
            print(f"Quotation found: {quote.quote_number}")
            print(f"Quotation status: {quote.status}")
            print(f"Quotation items count: {len(quote.items)}")
            
            # Auto-sync item_status for approved/completed quotations if needed
            for item in quote.items:
                if item.item_status != 'rejected' and item.item_status != 'approved':
                    print(f"  --> Auto-syncing item {item.id} ({item.item_name}) status from '{item.item_status}' to 'approved'")
                    item.item_status = 'approved'
            
            db.session.commit()
            
            for item in quote.items:
                has_existing_task = item.id in assigned_item_ids
                item_status_str = (item.item_status or '').strip().lower()
                is_eligible = (item_status_str == 'approved') and not has_existing_task
                
                print(f"  Item ID: {item.id}, Name: {item.item_name}")
                print(f"  Item status: {item.item_status}")
                print(f"  Existing task: {has_existing_task}")
                print(f"  Eligible for task creation: {is_eligible}")
                
                if is_eligible:
                    # Parse description tags if present
                    brand_code = item.supplier_part_no or ""
                    customer_description = item.customer_description or ""
                    description = item.description or ""
                    
                    if description and '[BRAND_CODE:' in description:
                        import re
                        brand_match = re.search(r'\[BRAND_CODE:(.*?)\]', description)
                        desc_match = re.search(r'\[CUSTOMER_DESC:(.*?)\]', description)
                        if brand_match:
                            brand_code = brand_match.group(1)
                        if desc_match:
                            customer_description = desc_match.group(1)
                        description = re.sub(r'\[BRAND_CODE:.*?\]', '', description)
                        description = re.sub(r'\[CUSTOMER_DESC:.*?\]', '', description).strip()
                    
                    approved_items.append({
                        'id': item.id,
                        'item_name': item.item_name,
                        'hsn_sac': item.hsn_sac,
                        'supplier_part_no': item.supplier_part_no,
                        'customer_part_no': item.customer_part_no,
                        'brand_code': brand_code,
                        'batch_no': item.batch_no or '',
                        'description': description,
                        'customer_description': customer_description,
                        'cut_width': float(item.cut_width) if item.cut_width else 0,
                        'length': float(item.length) if item.length else 0,
                        'quantity': float(item.quantity) if item.quantity else 1,
                        'unit': item.unit or 'pcs',
                        'mrp': float(item.mrp) if item.mrp else 0,
                        'price_per_unit': float(item.price_per_unit) if item.price_per_unit else 0,
                        'item_status': item.item_status,
                        'quotation_id': quote.id,
                        'quotation_number': quote.quote_number,
                        'company_id': quote.company_id,
                        'company_name': quote.company_name,
                        'company_address': quote.company_address or '',
                        'company_gstin': quote.company_gstin or '',
                        'contact_person': quote.contact_person or '',
                        'contact_mobile': quote.contact_mobile or '',
                        'contact_email': quote.contact_email or ''
                    })
        
        print(f"=== Total Eligible Approved Items Returned: {len(approved_items)} ===\n")
        return jsonify({'success': True, 'data': approved_items}), 200
        
    except Exception as e:
        print("❌ Error in get_approved_quotation_items:", str(e))
        return jsonify({'success': False, 'message': str(e)}), 500

    except Exception as e:
        print("❌ Error fetching completed tasks:", str(e))
        return jsonify({
            "success": False,
            "error": "Failed to fetch completed tasks",
            "message": str(e)
        }), 500


# ✅ NEW: GET TASKS BY BRAND CODE
@task_bp.route("/api/tasks/brand/<string:brand_code>", methods=["GET"])
def get_tasks_by_brand(brand_code):
    try:
        tasks = Task.query.filter_by(brand_code=brand_code).order_by(Task.createdAt.desc()).all()
        return jsonify({
            "success": True,
            "brand_code": brand_code,
            "data": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch tasks by brand",
            "message": str(e)
        }), 500


# ✅ NEW: GET TASKS BY BATCH NO
@task_bp.route("/api/tasks/batch/<string:batch_no>", methods=["GET"])
def get_tasks_by_batch(batch_no):
    try:
        tasks = Task.query.filter_by(batch_no=batch_no).order_by(Task.createdAt.desc()).all()
        return jsonify({
            "success": True,
            "batch_no": batch_no,
            "data": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch tasks by batch",
            "message": str(e)
        }), 500


# ✅ NEW: GET TASKS BY PO NUMBER
@task_bp.route("/api/tasks/po/<string:po_number>", methods=["GET"])
def get_tasks_by_po(po_number):
    try:
        tasks = Task.query.filter_by(po_number=po_number).order_by(Task.createdAt.desc()).all()
        return jsonify({
            "success": True,
            "po_number": po_number,
            "data": [task.to_dict() for task in tasks],
            "count": len(tasks)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch tasks by PO number",
            "message": str(e)
        }), 500


# ✅ NEW: BULK UPDATE TASKS STATUS
@task_bp.route("/api/tasks/bulk-status", methods=["POST"])
def bulk_update_task_status():
    try:
        data = request.get_json()
        task_ids = data.get("task_ids", [])
        new_status = data.get("status")
        new_status_check = data.get("status_check")
        note = data.get("note", "")
        
        if not task_ids:
            return jsonify({
                "success": False,
                "error": "No task IDs provided"
            }), 400
        
        updated_tasks = []
        for task_id in task_ids:
            task = Task.query.get(task_id)
            if task:
                if new_status:
                    task.status = new_status
                if new_status_check:
                    task.status_check = new_status_check
                    if new_status_check == "Completed":
                        task.status = "Completed"
                        task.completedAt = datetime.utcnow()
                if note:
                    task.note = f"{task.note or ''}\n{note}".strip()
                
                task.updatedAt = datetime.utcnow()
                updated_tasks.append(task)
        
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"✅ Updated {len(updated_tasks)} tasks",
            "updated_count": len(updated_tasks)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to bulk update tasks",
            "message": str(e)
        }), 500


# ✅ GET FINALLY COMPLETED TASKS FOR ADMIN TASK REPORT
@task_bp.route("/api/tasks/admin-report", methods=["GET"])
def get_admin_task_report():
    try:
        all_completed = Task.query.all()
        finally_completed_tasks = [
            task.to_dict() for task in all_completed
            if task.is_finally_completed
        ]
        return jsonify({
            "success": True,
            "count": len(finally_completed_tasks),
            "data": finally_completed_tasks
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Failed to fetch admin task report",
            "message": str(e)
        }), 500
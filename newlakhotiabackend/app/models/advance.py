from app import db
import json
from datetime import datetime

class Advance(db.Model):
    __tablename__ = 'advances'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic information
    email = db.Column(db.String(100), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100))
    amount = db.Column(db.Float, nullable=False)
    reason = db.Column(db.Text)
    date = db.Column(db.String(20), nullable=False)
    time = db.Column(db.String(20), nullable=False)
    
    # Split deduction configuration
    split_percentage = db.Column(db.Float, default=100.0)  # Percentage per month
    split_months = db.Column(db.Integer, default=1)  # Number of months to split
    deduction_start = db.Column(db.String(10))  # YYYY-MM format
    
    # Deduction schedule and calculations
    deduction_schedule = db.Column(db.Text)  # JSON string of schedule
    per_month_deduction = db.Column(db.Float)  # Calculated monthly amount
    total_deduction_months = db.Column(db.Integer)
    deduction_start_month = db.Column(db.String(50))
    deduction_end_month = db.Column(db.String(50))
    
    # Status and tracking
    status = db.Column(db.String(20), default='active')  # active, completed, cancelled
    amount_deducted = db.Column(db.Float, default=0.0)
    amount_remaining = db.Column(db.Float)
    deductions_completed = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Ensure amount_remaining is set
        if self.amount_remaining is None:
            self.amount_remaining = self.amount
    
    def to_dict(self):
        """Convert model to dictionary"""
        try:
            # Parse deduction_schedule if it exists
            deduction_schedule = []
            if self.deduction_schedule:
                try:
                    deduction_schedule = json.loads(self.deduction_schedule)
                except:
                    deduction_schedule = []
            
            # Calculate split_months if not set
            split_months = self.split_months
            if not split_months and self.split_percentage:
                split_months = (100 // self.split_percentage) + (1 if 100 % self.split_percentage > 0 else 0)
            
            return {
                "id": self.id,
                "email": self.email,
                "name": self.name,
                "department": self.department,
                "amount": float(self.amount),
                "reason": self.reason,
                "date": self.date,
                "time": self.time,
                
                # Split deduction fields
                "split_percentage": float(self.split_percentage) if self.split_percentage else 100.0,
                "split_months": split_months,
                "deduction_start": self.deduction_start,
                
                # Calculation results
                "per_month_deduction": float(self.per_month_deduction) if self.per_month_deduction else float(self.amount * (self.split_percentage or 100) / 100),
                "total_deduction_months": self.total_deduction_months if self.total_deduction_months else split_months,
                "deduction_start_month": self.deduction_start_month,
                "deduction_end_month": self.deduction_end_month,
                
                # Status and tracking
                "status": self.status,
                "amount_deducted": float(self.amount_deducted) if self.amount_deducted else 0.0,
                "amount_remaining": float(self.amount_remaining) if self.amount_remaining else float(self.amount),
                "deductions_completed": self.deductions_completed if self.deductions_completed else 0,
                
                # Schedule
                "deduction_schedule": deduction_schedule,
                
                # Timestamps
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None
            }
        except Exception as e:
            print(f"Error converting advance to dict: {str(e)}")
            # Return basic info if conversion fails
            return {
                "id": self.id,
                "email": self.email,
                "name": self.name,
                "department": self.department,
                "amount": float(self.amount),
                "reason": self.reason,
                "date": self.date,
                "time": self.time,
                "status": self.status or "active",
                "split_percentage": float(self.split_percentage) if self.split_percentage else 100.0
            }
    
    def calculate_monthly_deduction(self, month, year):
        """Calculate deduction amount for specific month"""
        if not self.deduction_schedule:
            return self.per_month_deduction or self.amount
        
        try:
            schedule = json.loads(self.deduction_schedule)
            month_year_str = f"{int(month):02d}/{year}"
            
            for deduction in schedule:
                if deduction.get("date_format") == month_year_str:
                    return float(deduction.get("amount", 0))
        except:
            pass
        
        return 0
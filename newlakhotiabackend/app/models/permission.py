from datetime import datetime
from app import db
from app.models.module import Module
from app.models.usertype import UserType


class Permission(db.Model):
    __tablename__ = "user_permissions"

    id = db.Column(db.Integer, primary_key=True)
    user_type_id = db.Column(db.Integer, db.ForeignKey("user_types.id"), nullable=False)
    module_id = db.Column(db.Integer, db.ForeignKey("modules.id"), nullable=False)
    can_view = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # ✅ Relationships
    user_type = db.relationship("UserType", backref=db.backref("permissions", lazy=True))
    module = db.relationship("Module", backref=db.backref("permissions", lazy=True))

    def __repr__(self):
        return f"<Permission user_type={self.user_type.name if self.user_type else None}, module={self.module.name if self.module else None}, can_view={self.can_view}>"

    def to_dict(self):
        return {
            "id": self.id,
            "user_type_id": self.user_type_id,
            "user_type_name": self.user_type.name if self.user_type else None,
            "module_id": self.module_id,
            "module_name": self.module.name if self.module else None,
            "can_view": self.can_view,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }

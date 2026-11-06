from flask import Blueprint, request, jsonify
from app import db
from app.models.login import User

auth_bp = Blueprint("auth", __name__)


# Helper function for uniform error responses
def bad_request(message):
    return jsonify({"success": False, "message": message}), 400


# -------------------------
# REGISTER USER
# -------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Expected JSON:
    {
      "username": "john",
      "email": "john@example.com",
      "password": "123456",
      "confirm_password": "123456"
    }
    """
    data = request.get_json() or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    if not username:
        return bad_request("Username is required.")
    if not email:
        return bad_request("Email is required.")
    if not password:
        return bad_request("Password is required.")
    if password != confirm_password:
        return bad_request("Password and Confirm Password do not match.")
    if len(password) < 4:
        return bad_request("Password must be at least 4 characters long.")

    # Check for duplicates
    if User.query.filter_by(username=username).first():
        return bad_request("Username already exists.")
    if User.query.filter_by(email=email).first():
        return bad_request("Email already registered.")

    # Create new user
    new_user = User(username=username, email=email, password=password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "User registered successfully.",
        "user": new_user.to_dict()
    }), 201


# -------------------------
# LOGIN USER
# -------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Expected JSON:
    {
      "email": "john@example.com",
      "password": "123456"
    }
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return bad_request("Email and Password are required.")

    user = User.query.filter_by(email=email).first()
    if not user or user.password != password:
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "user": user.to_dict()
    }), 200


# -------------------------
# GET PROFILE (using email)
# -------------------------
@auth_bp.route("/profile", methods=["POST"])
def profile():
    """
    Expected JSON:
    {
      "email": "john@example.com"
    }
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return bad_request("Email is required.")

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    return jsonify({
        "success": True,
        "user": user.to_dict()
    }), 200

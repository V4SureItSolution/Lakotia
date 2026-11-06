import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE as BASE, FILE_BASE } from "../config";

const HEADER_HEIGHT = 64;
const API_BASE = `${BASE}/dashboard-setter`;

const DashboardImageSetter = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageId, setImageId] = useState(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // =========================
  // GET latest image
  // =========================
  useEffect(() => {
    const fetchLatestImage = async () => {
      try {
        const res = await axios.get(`${API_BASE}/latest`);

        if (res.data?.image_url) {
          setImageId(res.data.id);
          setImageLoading(true);

          // 🔥 cache busting
          setImagePreview(
            `${FILE_BASE}${res.data.image_url}?v=${Date.now()}`
          );
        }
      } catch {
        // No image yet is OK
      } finally {
        setPageLoading(false);
      }
    };

    fetchLatestImage();
  }, []);

  // =========================
  // Change image (local preview)
  // =========================
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImageLoading(true);
    setImagePreview(URL.createObjectURL(file));
  };

  // =========================
  // Save image
  // =========================
  const handleSave = async () => {
    if (!imageFile) {
      alert("Please select an image first");
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      setSaving(true);

      let res;
      if (imageId) {
        res = await axios.put(
          `${API_BASE}/update/${imageId}`,
          formData
        );
      } else {
        res = await axios.post(`${API_BASE}/upload`, formData);
        setImageId(res.data?.id || null);
      }

      if (res?.data?.image_url) {
        setImageLoading(true);
        setImagePreview(
          `${FILE_BASE}${res.data.image_url}?v=${Date.now()}`
        );
      }

      alert("Dashboard image saved successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to save image");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Action Bar */}
      <div style={styles.actionBar}>
        <label style={styles.button}>
          Change Photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageChange}
          />
        </label>

        <button
          style={{
            ...styles.saveButton,
            opacity: saving ? 0.6 : 1,
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {pageLoading && <Loader text="Loading dashboard image..." />}

        {!pageLoading && imagePreview && (
          <>
            {imageLoading && <Loader text="Rendering image..." />}
            <img
              src={imagePreview}
              alt="Dashboard"
              style={{
                ...styles.image,
                display: imageLoading ? "none" : "block",
              }}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
          </>
        )}

        {!pageLoading && !imagePreview && (
          <div style={styles.placeholder}>
            <h2>No Image Selected</h2>
            <p>Choose an image and click Save</p>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================
// Loader
// =========================
const Loader = ({ text }) => (
  <div style={styles.loaderWrapper}>
    <div style={styles.spinner}></div>
    <p style={{ marginTop: 12 }}>{text}</p>
  </div>
);

// =========================
// Styles
// =========================
const styles = {
  wrapper: {
    width: "100%",
    height: `calc(100vh - ${HEADER_HEIGHT}px)`,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#0f172a",
  },

  actionBar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    padding: "12px 20px",
    backgroundColor: "#020617",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },

  button: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 600,
  },

  saveButton: {
    backgroundColor: "#22c55e",
    color: "#022c22",
    padding: "10px 22px",
    borderRadius: "10px",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },

  content: {
    flex: 1,
    position: "relative",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  placeholder: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#cbd5f5",
  },

  loaderWrapper: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#cbd5f5",
    backgroundColor: "rgba(15,23,42,0.75)",
    zIndex: 10,
  },

  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #334155",
    borderTop: "4px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};

export default DashboardImageSetter;

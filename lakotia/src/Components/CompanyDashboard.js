import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE as CENTRAL_API_BASE, FILE_BASE as CENTRAL_FILE_BASE } from "../config";


const HEADER_HEIGHT = 64;
const API_BASE = `${CENTRAL_API_BASE}/dashboard-setter`;
const FILE_BASE = CENTRAL_FILE_BASE;


const DashboardImageSetter = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);

  // =========================
  // GET latest image
  // =========================
  useEffect(() => {
    const fetchLatestImage = async () => {
      try {
        const res = await axios.get(`${API_BASE}/latest`);

        if (res.data?.image_url) {
          setImageLoading(true);
          // cache busting
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
            <p>No dashboard image available</p>
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
    backgroundColor: "#0f172a",
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
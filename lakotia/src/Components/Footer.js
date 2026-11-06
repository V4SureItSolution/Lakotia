import React from "react";

const Footer = () => {
  return (
    <footer style={styles.footer}>
      © 2025 All rights reserved | <strong>Lakhotia ERP Solutions</strong>
    </footer>
  );
};

const styles = {
  footer: {
    backgroundColor: "#fff8dc", // same as header
    textAlign: "center",
    height: "42px", // match header height
    lineHeight: "42px", // vertically center the text
    fontSize: "14px",
    color: "#555",
    boxShadow: "0 -2px 5px rgba(0,0,0,0.1)", // subtle shadow
    position: "sticky",
    bottom: 0,
    width: "100%",
    fontFamily: "Poppins, sans-serif",
  },
};

export default Footer;

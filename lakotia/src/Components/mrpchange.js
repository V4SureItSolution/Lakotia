import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import * as XLSX from "xlsx";

const API_STOCK_ALL = `${API_BASE}/stock/all`;
const API_MRP_UPDATE = `${API_BASE}/stock/update-mrp`;


export default function MRPChangePage() {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [allStock, setAllStock] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [brands, setBrands] = useState([]);

  const [selectedItemName, setSelectedItemName] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");

  /* =========================
     LOAD STOCK DATA
  ========================= */
  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    try {
      const res = await axios.get(API_STOCK_ALL);
      const data = res.data.data || [];

      setAllStock(data);

      setBrands([...new Set(data.map(d => d["Brand"]))]);
      setItemNames([...new Set(data.map(d => d["Item Name"]))]);
    } catch (error) {
      console.error("Error loading stock data", error);
    }
  };

  /* =========================
     BRAND → ITEM FILTER
  ========================= */
  useEffect(() => {
    if (!selectedBrand) {
      setItemNames([...new Set(allStock.map(d => d["Item Name"]))]);
    } else {
      const filteredItems = allStock
        .filter(d => d["Brand"] === selectedBrand)
        .map(d => d["Item Name"]);

      setItemNames([...new Set(filteredItems)]);
      setSelectedItemName(""); // reset item when brand changes
    }
  }, [selectedBrand, allStock]);

  /* =========================
     DOWNLOAD EXCEL
  ========================= */
  const handleDownloadExcel = async () => {
    try {
      let data = [...allStock];

      if (selectedBrand) {
        data = data.filter(d => d["Brand"] === selectedBrand);
      }

      if (selectedItemName) {
        data = data.filter(d => d["Item Name"] === selectedItemName);
      }

      if (!data.length) {
        return alert("No records found!");
      }

      const ws = XLSX.utils.json_to_sheet(
        data.map(d => ({
          "Item Name": d["Item Name"],
          Brand: d["Brand"],
          "Brand Code": d["Brand Code"],
          "Brand Description": d["Brand Description"],
          NBP: d["NBP"] || d["MRP"],
        }))
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "NBP Update");
      XLSX.writeFile(wb, "NBP_Update.xlsx");
    } catch (error) {
      console.error(error);
      alert("Failed to download Excel");
    }
  };

  /* =========================
     FILE UPLOAD PREVIEW
  ========================= */
  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target.result, { type: "binary" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      setPreviewData(data);
    };
    reader.readAsBinaryString(selectedFile);
  };

  /* =========================
     UPDATE MRP
  ========================= */
  const handleMRPUpdate = async () => {
    if (!file) return alert("Upload Excel first!");

    setLoading(true);
    try {
      const res = await axios.put(API_MRP_UPDATE, {
        records: previewData,
      });

      alert(res.data.message || "NBP Updated Successfully!");
      setFile(null);
      setPreviewData([]);
    } catch (error) {
      console.error(error);
      alert("Error updating NBP");
    }
    setLoading(false);
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center fw-bold mb-4">PRICE LIST-NBP</h2>

      {/* FILTER CARD */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h4 className="fw-semibold mb-3">Download Filters</h4>

          <div className="d-flex gap-2 flex-wrap align-items-center mb-3">

            {/* BRAND FILTER */}
            <select
              className="form-select form-select-sm"
              style={{ width: "200px" }}
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="">All Brands</option>
              {brands.map((b, i) => (
                <option key={i} value={b}>{b}</option>
              ))}
            </select>

            {/* ITEM FILTER */}
            <select
              className="form-select form-select-sm"
              style={{ width: "200px" }}
              value={selectedItemName}
              onChange={(e) => setSelectedItemName(e.target.value)}
            >
              <option value="">All Items</option>
              {itemNames.map((item, i) => (
                <option key={i} value={item}>{item}</option>
              ))}
            </select>

            <input
              type="file"
              accept=".xlsx,.xls"
              className="form-control form-control-sm"
              style={{ width: "200px" }}
              onChange={handleFileUpload}
            />

            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadExcel}
            >
              Download Excel
            </button>

            <button
              className="btn btn-success btn-sm"
              onClick={handleMRPUpdate}
              disabled={!file || loading}
            >
              {loading ? "Updating..." : "Update NBP"}
            </button>
          </div>
        </div>
      </div>

      {/* PREVIEW TABLE */}
      {previewData.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h4 className="fw-semibold mb-3">Excel Preview</h4>

            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead className="table-warning">
                  <tr>
                    {Object.keys(previewData[0]).map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

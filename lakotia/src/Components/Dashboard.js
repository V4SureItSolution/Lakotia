import React, { useEffect, useState } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { API_BASE } from "../config";

const Dashboard = () => {
  const email = localStorage.getItem("email"); // logged-in user
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    totalCompanies: 0,
    tasksAssignedToMe: {},
    tasksAssignedByMe: {},
  });

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Total employees
      const empRes = await axios.get(`${API_BASE}/employee/all`);
      const totalEmployees = Array.isArray(empRes.data) ? empRes.data.length : 0;

      // Total companies
      const companyRes = await axios.get(`${API_BASE}/company`);
      const totalCompanies = Array.isArray(companyRes.data) ? companyRes.data.length : 0;

      // Tasks assigned TO me
      const assignedToRes = await axios.get(`${API_BASE}/tasks`, {
        params: { assigned_to: email },
      });
      const tasksAssignedToMe = { Pending: 0, "In Progress": 0, Completed: 0 };
      assignedToRes.data.forEach(task => {
        tasksAssignedToMe[task.status] = (tasksAssignedToMe[task.status] || 0) + 1;
      });

      // Tasks assigned BY me
      const assignedByRes = await axios.get(`${API_BASE}/tasks/assigned-by/${email}`);
      const tasksAssignedByMe = { Pending: 0, "In Progress": 0, Completed: 0 };
      assignedByRes.data.forEach(task => {
        tasksAssignedByMe[task.status] = (tasksAssignedByMe[task.status] || 0) + 1;
      });

      setMetrics({
        totalEmployees,
        totalCompanies,
        tasksAssignedToMe,
        tasksAssignedByMe,
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  const generatePieData = data => {
    return Object.keys(data).map(key => ({ name: key, value: data[key] }));
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ marginBottom: "20px" }}>Dashboard</h2>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <Card title="Total Employees" value={metrics.totalEmployees} />
        <Card title="Total Companies" value={metrics.totalCompanies} />
      </div>

      <div style={{ display: "flex", gap: "40px", marginTop: "40px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>Tasks</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={generatePieData(metrics.tasksAssignedToMe)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                label
              >
                {generatePieData(metrics.tasksAssignedToMe).map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          <h3>Tasks Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={generatePieData(metrics.tasksAssignedByMe)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#82ca9d"
                label
              >
                {generatePieData(metrics.tasksAssignedByMe).map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, value }) => (
  <div
    style={{
      background: "#1976d2",
      color: "#fff",
      padding: "20px",
      borderRadius: "10px",
      flex: "1 1 200px",
      textAlign: "center",
    }}
  >
    <p style={{ margin: 0 }}>{title}</p>
    <h2 style={{ margin: 0 }}>{value}</h2>
  </div>
);

export default Dashboard;

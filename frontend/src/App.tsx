import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ProtectedRoute from "./lib/ProtectedRoute";
import LoginPage from "./auth/LoginPage";
import Owner from "./users/owner/Owner";
import Sales from "./users/sales/Sales";
import Production from "./users/production/Production";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/owner" element={<ProtectedRoute allowedRoles={["owner"]}><Owner /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute allowedRoles={["sales-staff"]}><Sales /></ProtectedRoute>} />
        <Route
          path="/production"
          element={<ProtectedRoute allowedRoles={["production-head", "production-staff"]}><Production /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { Navigate } from "react-router";

export default function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const token = sessionStorage.getItem("token");
  const role = sessionStorage.getItem("role");
  if (!token || !role || !allowedRoles.includes(role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

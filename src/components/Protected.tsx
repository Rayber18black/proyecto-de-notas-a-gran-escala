import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "./AppLayout";

interface Props {
  children: ReactNode;
  requiredPerm?: keyof ReturnType<typeof useAuth>['perms'];
  requireStaff?: boolean;
}

const Protected = ({ children, requiredPerm, requireStaff }: Props) => {
  const { user, loading, perms, isStaff } = useAuth();
  
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  
  if (requireStaff && !isStaff) return <Navigate to="/" replace />;
  
  if (requiredPerm && !perms[requiredPerm]) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
};

export default Protected;
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import "./AppShell.css";

export default function AppShell({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-left">
          <Link to="/" className="shell-logo">
            🌳 <span>FamilyHealth Tree</span>
          </Link>
          {breadcrumb && <span className="shell-breadcrumb">{breadcrumb}</span>}
        </div>
        <div className="shell-header-right">
          {actions}
          <div className="shell-user">
            <span className="shell-user-name">{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="shell-main">
        <h1 className="shell-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}

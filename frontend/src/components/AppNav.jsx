import { Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import useAuth from "../hooks/useAuth";

const NAV_LINKS = [
  { to: "/", label: "Guide", end: true },
  { to: "/chat", label: "Chat" },
  { to: "/activities", label: "Activities" },
  { to: "/buddies", label: "Buddies" },
  { to: "/forum", label: "Peer Q&A" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/profile", label: "Profile" },
];

function isLinkActive(pathname, { to, end }) {
  if (end) return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AppNav() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  return (
    <nav className="nv-app-nav" aria-label="App sections">
      <div className="nv-app-nav-links">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`nv-nav-tab nv-nav-link-tab${
              isLinkActive(pathname, link) ? " nv-active" : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <button type="button" className="nv-btn-logout" onClick={logout}>
        <LogOut size={16} aria-hidden />
        Log out
      </button>
    </nav>
  );
}

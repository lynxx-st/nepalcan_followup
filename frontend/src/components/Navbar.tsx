import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, LogOut, ChevronDown, ArrowUpRight } from "lucide-react";
export default function Navbar() {
  const location = useLocation(),
    navigate = useNavigate();
  const [search, setSearch] = useState(""),
    [more, setMore] = useState(false);
  let user: any;
  try {
    user = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    user = {};
  }
  const manager = ["super-admin", "admin", "manager"].includes(user.role),
    admin = ["super-admin", "admin"].includes(user.role);
  const links = [
    ["/today", "My tasks"],
    ["/orders", "Orders"],
    ["/returns", "Returns"],
    ["/reviews", "Reviews"],
    ...(manager
      ? [
          ["/team-work", "Workload"],
          ["/users", "Team"],
        ]
      : []),
    ...(admin ? [["/stats", "Analytics"]] : []),
  ];
  const extra = [
    ...(manager ? [["/archive", "History"]] : []),
    ...(admin
      ? [
          ["/automation", "Automation"],
          ["/settings", "Settings"],
          ["/rules", "Task rules"],
        ]
      : []),
  ];
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
    window.location.href = "/login";
  };
  return (
    <header className="app-header">
      <div className="app-header-top">
        <Link className="app-brand" to="/today">
          <span className="brand-mark">N</span>
          <span>
            NepalCan <strong>Follow up</strong>
          </span>
        </Link>
        <form
          className="app-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/orders?search=${encodeURIComponent(search)}`);
          }}
        >
          <Search size={16} />
          <input
            aria-label="Find an order"
            placeholder="Find an order…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button aria-label="Search orders">
            <ArrowUpRight size={16} />
          </button>
        </form>
        <div className="app-account">
          <span>
            {user.name || user.email || "Employee"}
            <small>{user.role === "staff" ? "Employee" : user.role}</small>
          </span>
          <button onClick={logout} aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
      <nav className="app-desktop-nav" aria-label="Main navigation">
        {links.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            aria-current={location.pathname === to ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        {extra.length > 0 && (
          <div className="app-more">
            <button aria-expanded={more} onClick={() => setMore(!more)}>
              More <ChevronDown size={14} />
            </button>
            {more && (
              <div>
                {extra.map(([to, label]) => (
                  <Link key={to} to={to} onClick={() => setMore(false)}>
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}

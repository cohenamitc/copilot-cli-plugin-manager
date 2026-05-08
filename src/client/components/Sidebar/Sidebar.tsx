import { useLocation, useNavigate } from "react-router-dom";
import { Package, Search, ArrowUpCircle, Store, Plus, Settings } from "lucide-react";
import styles from "./Sidebar.module.css";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Plugins",
    items: [
      { path: "/", label: "Installed", icon: Package },
      { path: "/browse", label: "Browse", icon: Search },
      { path: "/updates", label: "Updates", icon: ArrowUpCircle },
    ],
  },
  {
    title: "Sources",
    items: [
      { path: "/marketplaces", label: "Marketplaces", icon: Store },
      { path: "/add-source", label: "Add Source", icon: Plus },
    ],
  },
  {
    title: "System",
    items: [{ path: "/settings", label: "Settings", icon: Settings }],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/logo-sidebar.png" alt="" className={styles.logoIcon} />
        Plugin Manager
      </div>
      {sections.map((section) => (
        <div key={section.title} className={styles.section}>
          <div className={styles.sectionTitle}>{section.title}</div>
          {section.items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                onClick={() => navigate(item.path)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

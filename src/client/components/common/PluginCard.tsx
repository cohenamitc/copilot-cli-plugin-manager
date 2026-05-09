import { useNavigate } from "react-router-dom";
import Badge from "./Badge";
import styles from "./common.module.css";

interface PluginCardProps {
  name: string;
  version?: string;
  description?: string;
  marketplace: string;
  installed?: boolean;
  disabled?: boolean;
  skillCount?: number;
  agentCount?: number;
  hookCount?: number;
  mcpCount?: number;
  onInstall?: () => void;
  onUninstall?: () => void;
  onUpdate?: () => void;
  onDisable?: () => void;
  onEnable?: () => void;
  isLoading?: boolean;
}

export default function PluginCard({
  name,
  version,
  description,
  marketplace,
  installed = true,
  disabled = false,
  skillCount = 0,
  agentCount = 0,
  hookCount = 0,
  mcpCount = 0,
  onInstall,
  onUninstall,
  onUpdate,
  onDisable,
  onEnable,
  isLoading,
}: PluginCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (installed && !disabled) navigate(`/plugins/${encodeURIComponent(name)}`);
  };

  return (
    <div className={`${styles.pluginCard} ${disabled ? styles.pluginCardDisabled : ""}`} onClick={handleClick}>
      <div className={styles.cardHeader}>
        <span className={styles.cardName}>{name}</span>
        {disabled && <Badge variant="warning">Disabled</Badge>}
        {version && <Badge variant="success">v{version}</Badge>}
      </div>
      <div className={styles.cardDescription}>
        {description ?? "No description"}
      </div>
      <div className={styles.cardMarketplace}>{marketplace}</div>
      <div className={styles.cardMeta}>
        {skillCount > 0 && (
          <Badge>{skillCount} skill{skillCount !== 1 ? "s" : ""}</Badge>
        )}
        {agentCount > 0 && (
          <Badge>{agentCount} agent{agentCount !== 1 ? "s" : ""}</Badge>
        )}
        {hookCount > 0 && (
          <Badge>{hookCount} hook{hookCount !== 1 ? "s" : ""}</Badge>
        )}
        {mcpCount > 0 && <Badge>{mcpCount} MCP</Badge>}
      </div>
      <div
        className={styles.cardActions}
        onClick={(e) => e.stopPropagation()}
      >
        {disabled && onEnable && (
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onEnable}
            disabled={isLoading}
          >
            Enable
          </button>
        )}
        {installed && !disabled && onDisable && (
          <button
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={onDisable}
            disabled={isLoading}
          >
            Disable
          </button>
        )}
        {installed && !disabled && onUpdate && (
          <button
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={onUpdate}
            disabled={isLoading}
          >
            Update
          </button>
        )}
        {installed && !disabled && onUninstall && (
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={onUninstall}
            disabled={isLoading}
          >
            Remove
          </button>
        )}
        {!installed && !disabled && onInstall && (
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onInstall}
            disabled={isLoading}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

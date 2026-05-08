import { Link } from "lucide-react";
import type { PluginComponent } from "../../types";
import EmptyState from "../common/EmptyState";
import Badge from "../common/Badge";
import styles from "./PluginDetail.module.css";

export default function McpTab({ mcpServers }: { mcpServers: PluginComponent[] }) {
  if (!mcpServers.length) return <EmptyState icon={<Link size={48} />} title="No MCP servers" message="This plugin doesn't include any MCP servers." />;
  return (
    <div className={styles.componentGrid}>
      {mcpServers.map((mcp) => {
        const meta = mcp.metadata ?? {};
        const type = (meta.type as string) ?? "unknown";
        const command = meta.command as string | undefined;
        const args = meta.args as string[] | undefined;
        const url = meta.url as string | undefined;
        const envKeys = meta.env as string[] | undefined;

        return (
          <div key={mcp.name} className={styles.componentCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className={styles.componentName}>{mcp.name}</div>
              <Badge variant={type === "local" ? "primary" : type === "http" ? "success" : "default"}>
                {type}
              </Badge>
            </div>

            {command && (
              <div className={styles.mcpDetail}>
                <span className={styles.mcpLabel}>Command</span>
                <code className={styles.mcpCode}>{command} {args?.join(" ") ?? ""}</code>
              </div>
            )}

            {url && (
              <div className={styles.mcpDetail}>
                <span className={styles.mcpLabel}>URL</span>
                <code className={styles.mcpCode}>{url}</code>
              </div>
            )}

            {envKeys && envKeys.length > 0 && (
              <div className={styles.mcpDetail}>
                <span className={styles.mcpLabel}>Env vars</span>
                <span>{envKeys.join(", ")}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

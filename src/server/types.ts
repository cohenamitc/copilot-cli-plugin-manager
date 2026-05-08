export interface PluginAuthor {
  name: string;
  email?: string;
}

export interface InstalledPluginEntry {
  name: string;
  marketplace: string;
  version?: string;
  installed_at: string;
  enabled: boolean;
  cache_path: string;
}

export interface PluginMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  homepage?: string;
  repository?: string;
  license?: string;
}

export interface PluginComponent {
  name: string;
  description?: string;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface PluginDetails extends PluginMetadata {
  marketplace: string;
  installed_at?: string;
  enabled: boolean;
  skills: PluginComponent[];
  agents: PluginComponent[];
  hooks: PluginComponent[];
  mcpServers: PluginComponent[];
}

export interface MarketplaceSource {
  source: string;
  repo?: string;
  url?: string;
}

export interface MarketplaceInfo {
  name: string;
  source: MarketplaceSource;
  isDefault: boolean;
}

export interface MarketplacePlugin {
  name: string;
  description?: string;
  version?: string;
  source: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  installed: boolean;
  marketplace: string;
}

export interface MarketplaceCatalog {
  name: string;
  metadata?: {
    description?: string;
    version?: string;
  };
  owner?: PluginAuthor;
  plugins: MarketplacePlugin[];
}

export interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AppSettings {
  theme: "light" | "dark" | "copilot";
}

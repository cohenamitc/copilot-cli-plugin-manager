import styles from "./common.module.css";

type BadgeVariant = "default" | "success" | "error" | "warning" | "primary";

const variantClass: Record<BadgeVariant, string> = {
  default: styles.badgeDefault,
  success: styles.badgeSuccess,
  error: styles.badgeError,
  warning: styles.badgeWarning,
  primary: styles.badgePrimary,
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export default function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${variantClass[variant]}`}>
      {children}
    </span>
  );
}

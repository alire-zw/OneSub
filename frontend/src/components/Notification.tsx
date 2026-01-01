"use client";

import { useEffect } from "react";
import styles from "./Notification.module.css";

interface NotificationProps {
  show: boolean;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  onClose?: () => void;
}

export default function Notification({ show, message, type = "success", onClose }: NotificationProps) {
  useEffect(() => {
    if (show && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className={`${styles.notification} ${styles[type]}`}>
      <div className={styles.content}>
        <span className={styles.message}>{message}</span>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} aria-label="بستن">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}


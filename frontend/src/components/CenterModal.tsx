"use client";

import { useEffect, useState } from "react";
import styles from "./CenterModal.module.css";

interface CenterModalButton {
  label: string;
  onClick: () => void;
  variant?: "primary" | "default" | "danger";
  disabled?: boolean;
}

interface CenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  buttons?: CenterModalButton[];
  showCloseButton?: boolean;
}

export default function CenterModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  buttons,
  showCloseButton = true,
}: CenterModalProps) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // تشخیص باز/بسته شدن کیبورد
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: NodeJS.Timeout;
    const initialHeight = window.innerHeight;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialHeight - currentHeight;
        const keyboardIsOpen = heightDifference > 150;
        setIsKeyboardOpen(keyboardIsOpen);
      }, 50);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    } else {
      window.addEventListener("resize", handleResize);
    }

    handleResize();

    return () => {
      clearTimeout(timeoutId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      } else {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [isOpen]);

  // بستن مودال با کلید Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.modalOverlay} ${isKeyboardOpen ? styles.keyboardAdjusted : ""}`}
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title}</div>
          {showCloseButton && (
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="بستن">
              <span className={styles.modalCloseX}>
                <svg fillRule="evenodd" viewBox="64 64 896 896" focusable="false" width="1em" height="1em" fill="currentColor">
                  <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z"></path>
                </svg>
              </span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {description && <blockquote className={styles.modalDescription}>{description}</blockquote>}
          {children}
        </div>

        {/* Footer */}
        {buttons && buttons.length > 0 && (
          <div className={styles.modalFooter}>
            <div className={styles.footerButtons}>
              {buttons.map((button, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles.btn} ${
                    button.variant === "primary"
                      ? styles.btnPrimary
                      : button.variant === "danger"
                      ? styles.btnDanger
                      : styles.btnDefault
                  }`}
                  onClick={button.onClick}
                  disabled={button.disabled}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


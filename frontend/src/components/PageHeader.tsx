"use client";

import { useRouter } from "next/navigation";
import styles from "./PageHeader.module.css";
import ArrowBackIcon from "./icons/ArrowBackIcon";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
}

export default function PageHeader({ title, onBack }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.backButton} onClick={handleBack}>
          <ArrowBackIcon />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.headerOptions}></div>
      </div>
    </header>
  );
}


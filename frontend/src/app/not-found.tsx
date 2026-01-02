"use client";

import NotFoundIcon from "@/components/icons/NotFoundIcon";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconContainer}>
          <NotFoundIcon width={128} height={128} color="var(--primary)" />
        </div>
        <p className={styles.message}>
          404! این صفحه یا وجود نداره یا از دست شما قهر کرده!
        </p>
      </div>
    </div>
  );
}


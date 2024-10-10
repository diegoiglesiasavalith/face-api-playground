"use client";

import { useState, useContext, ChangeEvent } from "react";
import styles from "./page.module.css";
import SmileCapture from "@/components/SmileCapture";

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return (
      <main className={styles.DashboardMainLoader}>
        <section className={styles.DashboardSectionLoader}>
          <p>cargando...</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.DashboardMain}>
      <h1 className={styles.DashboardTitle}>Face Api</h1>
      <SmileCapture />
    </main>
  );
};

export default Dashboard;

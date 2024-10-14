"use client";

import styles from "./page.module.css";
import SmileCapture from "@/components/SmileCapture";

const Dashboard = () => {
  return (
    <main className={styles.DashboardMain}>
      <h1 className={styles.DashboardTitle}>Face Api</h1>
      <SmileCapture />
    </main>
  );
};

export default Dashboard;

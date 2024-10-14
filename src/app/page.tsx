"use client";

import styles from "./page.module.css";
import SmileCapture from "@/components/SmileCapture";
import AntiSpoofingComponent from "@/components/antiSpoofingComponent/AntiSpoofingComponent";

const Dashboard = () => {
  return (
    <main className={styles.DashboardMain}>
      <h1 className={styles.DashboardTitle}>Face Api</h1>
      {/* <SmileCapture /> */}
      <AntiSpoofingComponent />
    </main>
  );
};

export default Dashboard;

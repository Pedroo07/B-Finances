"use client";
import React, { useEffect, useState } from "react";
import Header, { AppTabHref } from "./components/header";
import { Main as DashboardMain } from "./components/main";
import { Main as TransactionsMain } from "@/app/transactions/components/main";
import { Main as InvestmentsMain } from "@/app/investments/components/main";
import { Main as CreditCardMain } from "@/app/CreditCard/components/main";
import { Main as AccountsMain } from "@/app/accounts/components/main";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const VALID_TABS: Set<AppTabHref> = new Set([
  "/dashboard",
  "/transactions",
  "/investments",
  "/CreditCard",
  "/accounts",
]);

const Dashboard = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTabHref>("/dashboard");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(
        "bfinance_active_tab",
      ) as AppTabHref | null;
      if (saved && VALID_TABS.has(saved)) {
        setActiveTab(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleTabChange = (nextTab: AppTabHref) => {
    setActiveTab(nextTab);
    try {
      window.sessionStorage.setItem("bfinance_active_tab", nextTab);
    } catch {}
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      {activeTab === "/dashboard" && <DashboardMain />}
      {activeTab === "/transactions" && <TransactionsMain />}
      {activeTab === "/investments" && <InvestmentsMain />}
      {activeTab === "/CreditCard" && <CreditCardMain />}
      {activeTab === "/accounts" && <AccountsMain />}
    </div>
  );
};

export default Dashboard;

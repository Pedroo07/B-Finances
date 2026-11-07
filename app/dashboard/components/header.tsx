"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import ThemeToggle from "../../ThemeToggle";
import { AccountMenu } from "@/app/AccountMenu";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Visão geral",
    mobileLabel: "Início",
    icon: LayoutDashboard,
  },
  {
    href: "/transactions",
    label: "Transações",
    mobileLabel: "Transações",
    icon: ArrowLeftRight,
  },
  {
    href: "/investments",
    label: "Investimentos",
    mobileLabel: "Investir",
    icon: TrendingUp,
  },
  {
    href: "/CreditCard",
    label: "Cartões",
    mobileLabel: "Cartões",
    icon: CreditCard,
  },
  {
    href: "/accounts",
    label: "Contas a Pagar",
    mobileLabel: "Contas",
    icon: ReceiptText,
  },
];

const Header = () => {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b soft-divider bg-[#F8FAFC]/85 backdrop-blur-xl dark:bg-[#0F172A]/85">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div>
              <Image
                src="/Logo.png"
                alt="logo"
                width={42}
                height={42}
                className="h-9 w-9 rounded-xl object-contain sm:h-10 sm:w-10"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A] sm:text-base dark:text-white">
                B Finance
              </p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#94A3BB] sm:text-[11px] sm:tracking-[0.28em]">
                Sistema financeiro
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <AccountMenu />
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-6">
            <ul className="flex flex-wrap items-center gap-2 font-Inter">
              {navItems.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "surface-chip inline-flex items-center px-4 py-2",
                        isActive &&
                          "border-[#22C55E]/40 bg-[#22C55E]/12 text-[#15803D] dark:border-[#22C55E]/40 dark:bg-[#22C55E]/18 dark:text-[#4ADE80]",
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ul className="flex items-center gap-2">
              <li className="text-xl">
                <ThemeToggle />
              </li>
              <li className="text-xl">
                <AccountMenu />
              </li>
            </ul>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navegação principal mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t soft-divider bg-[#F8FAFC]/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-[#0F172A]/94 dark:shadow-[0_-10px_34px_rgba(2,6,23,0.55)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 items-center gap-1 px-2 py-1.5">
          {navItems.map(({ href, mobileLabel, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-medium transition-all active:scale-95",
                    isActive
                      ? "bg-[#22C55E]/12 font-semibold text-[#15803D] dark:bg-[#22C55E]/18 dark:text-[#4ADE80]"
                      : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3BB] dark:hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{mobileLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};

export default Header;

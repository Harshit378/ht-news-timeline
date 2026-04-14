'use client'

import React, { Suspense } from "react";
import Header from "../components/header";
import SportsContent from "./sportsContent";
import LoadingSpinner from "../loading";

export default function SportsPage() {
  return (
    <div>
      <Header />
      <Suspense fallback={<LoadingSpinner />}>
        <SportsContent />
      </Suspense>
    </div>
  );
}
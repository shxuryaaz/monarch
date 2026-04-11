import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Hero from "@/components/Hero";
import ProblemSolution from "@/components/ProblemSolution";
import HowItWorks from "@/components/HowItWorks";
import FeaturedAssets from "@/components/FeaturedAssets";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";
import LandingHeader from "@/components/LandingHeader";
import WalletAuthModal from "@/components/WalletAuthModal";

const Index = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("login") !== "1") return;
    setAuthOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("login");
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader onLaunchApp={() => setAuthOpen(true)} />
      <WalletAuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <Hero onOpenAuth={() => setAuthOpen(true)} />
      <ProblemSolution />
      <HowItWorks />
      <FeaturedAssets />
      <Stats />
      <Footer />
    </div>
  );
};

export default Index;

import Hero from "@/components/Hero";
import ProblemSolution from "@/components/ProblemSolution";
import HowItWorks from "@/components/HowItWorks";
import FeaturedAssets from "@/components/FeaturedAssets";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <ProblemSolution />
      <HowItWorks />
      <FeaturedAssets />
      <Stats />
      <Footer />
    </div>
  );
};

export default Index;

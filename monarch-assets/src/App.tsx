import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletAuthProvider } from "@/contexts/WalletAuthContext";
import AppLayout from "./layouts/AppLayout.tsx";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Marketplace from "./pages/Marketplace.tsx";
import AssetDetail from "./pages/AssetDetail.tsx";
import ListAsset from "./pages/ListAsset.tsx";
import KYCVerification from "./pages/KYCVerification.tsx";
import NotFound from "./pages/NotFound.tsx";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <WalletAuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:assetId" element={<AssetDetail />} />
            <Route path="/list-asset" element={<ListAsset />} />
            <Route path="/kyc" element={<KYCVerification />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </WalletAuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;

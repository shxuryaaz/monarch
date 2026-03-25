import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";

export default function AppLayout() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <Outlet />
      </main>
    </>
  );
}

import "./index.css";
import { useState } from "react";
import { HeroSection } from "./components/HeroSection";
import { Navbar } from "./components/Navbar";

export function App() {
  const [museumSearchQuery, setMuseumSearchQuery] = useState("");

  return (
    <div className="layout-main pt-14 pb-16 sm:pb-0">
      <Navbar
        museumSearchQuery={museumSearchQuery}
        onMuseumSearchQueryChange={setMuseumSearchQuery}
      />
      <HeroSection searchQuery={museumSearchQuery} />

      <section id="spirits" className="sr-only" aria-hidden />
    </div>
  );
}

export default App;

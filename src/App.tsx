import "./index.css";
import { HeroSection } from "./components/HeroSection";
import { Navbar } from "./components/Navbar";

export function App() {
  return (
    <div className="layout-main pt-14 pb-16 sm:pb-0">
      <Navbar />
      <HeroSection />

      <section id="spirits" className="sr-only" aria-hidden />
    </div>
  );
}

export default App;

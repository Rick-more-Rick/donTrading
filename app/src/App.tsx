import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';
import MusicPlayer from './components/MusicPlayer';
import HeroSection from './sections/HeroSection';
import PoweredBySection from './sections/PoweredBySection';
import FeaturesSection from './sections/FeaturesSection';
import WhyGoDarkSection from './sections/WhyGoDarkSection';
import AboutSection from './sections/AboutSection';
import Footer from './sections/Footer';
import VIPFormPage from './pages/VIPFormPage';
import './App.css';

// Background component to reuse across pages
const Background = () => (
  <>
    {/* Fixed Background with neural networks, candles and world map */}
    <div 
      className="fixed inset-0 z-0"
      style={{
        backgroundImage: 'url(/trading-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    />
    
    {/* Dark overlay for better text readability */}
    <div className="fixed inset-0 z-0 bg-black/40" />
    
    {/* Circuit pattern overlay */}
    <div className="fixed inset-0 z-0 circuit-overlay opacity-50" />
    
    {/* Animated twinkling stars */}
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Star 1 - New York */}
      <div className="absolute top-[35%] left-[22%] w-2 h-2 bg-white rounded-full animate-twinkle" style={{ animationDelay: '0s' }} />
      {/* Star 2 - London */}
      <div className="absolute top-[28%] left-[48%] w-1.5 h-1.5 bg-[#00D4FF] rounded-full animate-twinkle-slow" style={{ animationDelay: '0.5s' }} />
      {/* Star 3 - Tokyo */}
      <div className="absolute top-[38%] left-[85%] w-2 h-2 bg-white rounded-full animate-twinkle-fast" style={{ animationDelay: '1s' }} />
      {/* Star 4 - Singapore */}
      <div className="absolute top-[55%] left-[78%] w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-twinkle" style={{ animationDelay: '1.5s' }} />
      {/* Star 5 - Dubai */}
      <div className="absolute top-[42%] left-[58%] w-2 h-2 bg-white rounded-full animate-twinkle-slow" style={{ animationDelay: '2s' }} />
      {/* Star 6 - Hong Kong */}
      <div className="absolute top-[48%] left-[80%] w-1.5 h-1.5 bg-[#00D4FF] rounded-full animate-twinkle-fast" style={{ animationDelay: '0.3s' }} />
      {/* Star 7 - Frankfurt */}
      <div className="absolute top-[30%] left-[52%] w-2 h-2 bg-[#D4AF37] rounded-full animate-twinkle" style={{ animationDelay: '0.8s' }} />
      {/* Star 8 - Sydney */}
      <div className="absolute top-[75%] left-[88%] w-1.5 h-1.5 bg-white rounded-full animate-twinkle-slow" style={{ animationDelay: '1.2s' }} />
      {/* Additional decorative stars */}
      <div className="absolute top-[15%] left-[10%] w-1 h-1 bg-[#00D4FF] rounded-full animate-twinkle" style={{ animationDelay: '0.2s' }} />
      <div className="absolute top-[20%] left-[70%] w-1 h-1 bg-white rounded-full animate-twinkle-fast" style={{ animationDelay: '0.7s' }} />
      <div className="absolute top-[60%] left-[15%] w-1 h-1 bg-[#D4AF37] rounded-full animate-twinkle-slow" style={{ animationDelay: '1.3s' }} />
      <div className="absolute top-[80%] left-[40%] w-1 h-1 bg-[#00D4FF] rounded-full animate-twinkle" style={{ animationDelay: '0.9s' }} />
      <div className="absolute top-[45%] left-[35%] w-1 h-1 bg-white rounded-full animate-twinkle-fast" style={{ animationDelay: '1.7s' }} />
    </div>
    
    {/* Data stream effect */}
    <div className="fixed inset-0 z-0 data-stream opacity-30 pointer-events-none" />
    
    {/* Gradient overlay */}
    <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
  </>
);

// Home page component
const HomePage = () => (
  <>
    <main className="relative z-10">
      <HeroSection />
      <PoweredBySection />
      <FeaturesSection />
      <WhyGoDarkSection />
      <AboutSection />
    </main>
    <Footer />
  </>
);

function App() {
  return (
    <Router>
      <div className="min-h-screen text-white overflow-x-hidden relative">
        <Background />
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/vip-form" element={<VIPFormPage />} />
        </Routes>
        <MusicPlayer />
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #D4AF37',
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;

import { useState, useEffect } from 'react';
import { Globe, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const navLinks = [
  { name: 'Ventajas', href: '#features' },
  { name: 'Por qué DT', href: '#why-dt' },
  { name: 'Nosotros', href: '#about' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-black/80 backdrop-blur-md border-b border-[#D4AF37]/30'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 lg:h-24">
          {/* Logo + Brand */}
          <a href="#" className="flex items-center gap-4">
            <img 
              src="/dt-logo.png" 
              alt="DT" 
              className="w-14 h-14 lg:w-16 lg:h-16 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-[#D4AF37] font-light text-xs tracking-[0.3em] uppercase">Trading</span>
              <span className="text-[#D4AF37] font-extralight text-xs tracking-[0.2em] uppercase">Inteligente</span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-300 hover:text-[#D4AF37] transition-colors text-sm font-light tracking-wide"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Right side buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <Link to="/vip-form">
              <Button
                className="bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-semibold px-6 rounded-full"
              >
                Solicita tu Acceso Temprano VIP
              </Button>
            </Link>
            <button className="flex items-center gap-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
              <Globe className="w-4 h-4" />
              <span className="text-sm font-light">Español</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-black/95 backdrop-blur-md border-t border-[#D4AF37]/30 py-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-gray-300 hover:text-[#D4AF37] transition-colors text-sm font-light px-4 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="px-4 pt-4 border-t border-[#D4AF37]/30">
                <Link to="/vip-form" className="block">
                  <Button
                    className="w-full bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-semibold rounded-full"
                  >
                    Solicita tu Acceso Temprano VIP
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

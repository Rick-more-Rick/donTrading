import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const footerLinks = [
  { name: 'Privacidad', href: '#' },
  { name: 'Términos', href: '#' },
  { name: 'FAQ', href: '#' },
  { name: 'Contacto', href: '#' },
  { name: 'Institucional', href: '#' },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[#D4AF37]/30">
      {/* CTA Section */}
      <div className="relative py-20">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-[#D4AF37]/20 to-[#00D4FF]/20 rounded-full blur-[150px]" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            ¿Listo para unirte?
          </h2>
          <p className="text-[#00D4FF] text-xl mb-8">
            No Operes Solo. Entra al Círculo.
          </p>
          <Link to="/vip-form">
            <Button
              className="bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-semibold px-8 py-6 rounded-full text-lg group"
            >
              Solicita tu Acceso Temprano VIP
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#D4AF37]/20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <img 
                src="/dt-logo.png" 
                alt="DT" 
                className="w-12 h-12 object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[#D4AF37] font-light text-xs tracking-[0.3em] uppercase">Trading</span>
                <span className="text-[#D4AF37] font-extralight text-xs tracking-[0.2em] uppercase">Inteligente</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-6">
              {footerLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-gray-400 hover:text-[#D4AF37] transition-colors text-sm font-light"
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* Copyright */}
            <p className="text-gray-500 text-sm font-light">
              © 2025 DT Trading Inteligente
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

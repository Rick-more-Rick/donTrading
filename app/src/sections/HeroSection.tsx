import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const heroTexts = [
  { line1: "Social Trading.", line2: "Red social Privada solo para Traders" },
  { line1: "Más que una Comunidad.", line2: "Tu Ventaja Institucional" },
  { line1: "Olvida el Hype.", line2: "Enfócate en el Trade" },
  { line1: "Sin Memes. Sin Novatos.", line2: "Solo Negocios" },
  { line1: "Filtra la Distracción.", line2: "Ejecuta con Precisión" },
  { line1: "Información de Nivel Institucional.", line2: "Sin Filtros." },
  { line1: "Análisis Crudo.", line2: "Opiniones Sin Censura" },
  { line1: "Inteligencia Colectiva", line2: "de Alto Nivel" },
  { line1: "Sin Límites de Crecimiento.", line2: "Sin Barreras de Información" },
  { line1: "Tu Tribu de", line2: "Traders de Élite" },
  { line1: "Conecta con Mentes Afines.", line2: "Eleva tu Nivel" },
  { line1: "No Operes", line2: "Solo" },
];

export default function HeroSection() {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentTextIndex((prev) => (prev + 1) % heroTexts.length);
        setIsAnimating(false);
      }, 500);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const currentText = heroTexts[currentTextIndex];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="flex flex-col items-start gap-8">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[#D4AF37] text-sm font-medium tracking-wide">ACCESO POR INVITACIÓN</span>
          </div>

          {/* Main heading */}
          <div className="space-y-2">
            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-white transition-all duration-500 drop-shadow-lg ${
                isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
              }`}
            >
              {currentText.line1}
            </h1>
            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-bold gradient-text transition-all duration-500 delay-100 drop-shadow-lg ${
                isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
              }`}
            >
              {currentText.line2}
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-gray-300 text-lg sm:text-xl max-w-xl drop-shadow-md">
            La primera red social exclusiva para traders serios. Análisis, inteligencia de mercado y conexiones de alto nivel.
          </p>

          {/* Features list */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-[#D4AF37]">Trading Privado</span>
            <span className="text-gray-500">|</span>
            <span className="text-[#00D4FF]">Análisis Institucional</span>
            <span className="text-gray-500">|</span>
            <span className="text-[#D4AF37]">Red de Élite</span>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/vip-form">
              <Button
                className="bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-semibold px-8 py-6 rounded-full text-lg group"
              >
                Solicita tu Acceso Temprano VIP
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#features" className="text-gray-300 hover:text-[#00D4FF] transition-colors text-lg">
              Conoce Más
            </a>
          </div>

          {/* Verification badge */}
          <div className="flex items-center gap-3 pt-4">
            <span className="text-gray-400 text-sm">CUENTAS VERIFICADAS POR</span>
            <div className="flex items-center gap-2">
              <span className="text-[#D4AF37] font-bold">MetaApi</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

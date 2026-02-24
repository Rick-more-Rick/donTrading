import { Users, Eye, Shield, ArrowRight, TrendingUp, Lock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Eye,
    title: 'Análisis Crudo',
    description: 'Opiniones Sin Censura. Accede a análisis técnicos y fundamentales sin filtros de traders experimentados.',
  },
  {
    icon: Users,
    title: 'Tu Tribu de Élite',
    description: 'Conecta con Mentes Afines. Eleva tu Nivel rodeándote de traders que operan a tu mismo nivel.',
  },
  {
    icon: Shield,
    title: 'Sin Distracciones',
    description: 'Filtra la Distracción. Ejecuta con Precisión en un entorno libre de ruido y memes.',
  },
];

const networkBenefits = [
  { label: 'Información de Nivel Institucional', sublabel: 'Sin Filtros' },
  { label: 'Inteligencia Colectiva de Alto Nivel', sublabel: 'Decisiones informadas' },
  { label: 'Sin Límites de Crecimiento', sublabel: 'Sin Barreras de Información' },
  { label: 'Sin Memes. Sin Novatos.', sublabel: 'Solo Negocios' },
  { label: 'Trading Privado', sublabel: 'Tu estrategia es tuya' },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-24">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-[#D4AF37] text-sm uppercase tracking-wider mb-4">Desarrollado Por</p>
          <p className="text-gray-300 text-lg">Traders Profesionales para Traders Profesionales</p>
        </div>

        {/* Features title */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">Ventajas</h2>
          <h3 className="text-2xl sm:text-3xl font-semibold text-[#00D4FF] mb-4 drop-shadow-md">Diseñado para traders serios</h3>
          <p className="text-gray-400 max-w-xl mx-auto">
            Todo lo que necesitas para elevar tu trading al siguiente nivel
          </p>
          <Link to="/vip-form">
            <Button
              className="mt-8 bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-semibold px-8 py-6 rounded-full text-lg group"
            >
              Solicita tu Acceso Temprano VIP
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass rounded-2xl p-8 card-hover backdrop-blur-md"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/30 to-[#00D4FF]/30 flex items-center justify-center mb-6 border border-[#D4AF37]/30">
                <feature.icon className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-4">{feature.title}</h4>
              <p className="text-gray-300 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Network Benefits Diagram */}
        <div className="glass rounded-3xl p-8 sm:p-12 border border-[#D4AF37]/20 backdrop-blur-md">
          <h3 className="text-2xl font-semibold text-white text-center mb-4 drop-shadow-md">Más que una Comunidad</h3>
          <p className="text-[#00D4FF] text-center mb-12 drop-shadow-md">Tu Ventaja Institucional</p>
          
          {/* Flow diagram */}
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 mb-12">
            {/* Trader Individual */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4AF37]/30 to-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center mb-3 backdrop-blur-sm">
                <TrendingUp className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <span className="text-gray-300 text-sm">Trader</span>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2">
              <span className="text-[#D4AF37] text-xl hidden lg:block">→</span>
              <span className="text-[#D4AF37] text-xl lg:hidden">↓</span>
            </div>

            {/* Red DT */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-[#00D4FF]/30 to-[#D4AF37]/10 border border-[#00D4FF]/40 flex flex-col items-center justify-center mb-3 p-4 backdrop-blur-sm">
                <Lock className="w-8 h-8 text-[#00D4FF] mb-2" />
                <span className="text-white font-semibold text-center">Red DT</span>
                <span className="text-gray-300 text-xs text-center mt-1">Privada & Exclusiva</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2">
              <span className="text-[#00D4FF] text-xl hidden lg:block">→</span>
              <span className="text-[#00D4FF] text-xl lg:hidden">↓</span>
            </div>

            {/* Resultado */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4AF37]/30 to-[#00D4FF]/10 border border-[#D4AF37]/40 flex items-center justify-center mb-3 backdrop-blur-sm">
                <MessageSquare className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <span className="text-gray-300 text-sm">Conexiones</span>
            </div>
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {networkBenefits.map((benefit, index) => (
              <div
                key={benefit.label}
                className="text-center p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 backdrop-blur-sm"
                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
              >
                <p className="text-white font-medium text-sm mb-1">{benefit.label}</p>
                {benefit.sublabel && <p className="text-[#00D4FF] text-xs">{benefit.sublabel}</p>}
              </div>
            ))}
          </div>

          {/* Settlement info */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className="text-gray-300 text-sm">Sin Memes</span>
            <span className="text-[#D4AF37]">•</span>
            <span className="text-[#00D4FF] text-sm font-medium">Sin Novatos</span>
            <span className="text-[#D4AF37]">•</span>
            <span className="text-gray-300 text-sm">Solo</span>
            <span className="text-[#D4AF37] font-semibold">Negocios</span>
          </div>
        </div>
      </div>
    </section>
  );
}

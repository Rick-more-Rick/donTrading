import { Check, X } from 'lucide-react';

const comparisonFeatures = [
  { name: 'Acceso por Invitación', others: false, dt: true },
  { name: 'Sin Memes ni Spam', others: false, dt: true },
  { name: 'Análisis Sin Censura', others: false, dt: true },
  { name: 'Red de Traders Verificados', others: false, dt: true },
  { name: 'Información Institucional', others: false, dt: true },
  { name: 'Sin Influencers', others: false, dt: true },
  { name: 'Chat Privado', others: true, dt: true },
  { name: 'Contenido Educativo', others: true, dt: true },
];

export default function WhyGoDarkSection() {
  return (
    <section id="why-dt" className="relative py-24">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">Por qué DT</h2>
          <p className="text-xl text-[#00D4FF] drop-shadow-md">Olvida el Hype. Enfócate en el Trade</p>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-center max-w-3xl mx-auto mb-16">
          Las redes sociales tradicionales están llenas de ruido. DT te da lo que realmente necesitas: 
          información de calidad, análisis crudo y una red de traders que operan en serio.
        </p>

        {/* Comparison table */}
        <div className="glass rounded-3xl overflow-hidden border border-[#D4AF37]/20 backdrop-blur-md">
          {/* Table header */}
          <div className="grid grid-cols-3 gap-4 p-6 border-b border-[#D4AF37]/30 bg-[#D4AF37]/10">
            <div className="text-gray-300 font-medium">Característica</div>
            <div className="text-gray-300 font-medium text-center">Otras Redes</div>
            <div className="text-[#D4AF37] font-medium text-center">DT Trading</div>
          </div>

          {/* Table rows */}
          {comparisonFeatures.map((feature, index) => (
            <div
              key={feature.name}
              className={`grid grid-cols-3 gap-4 p-6 ${
                index !== comparisonFeatures.length - 1 ? 'border-b border-[#D4AF37]/10' : ''
              } hover:bg-[#D4AF37]/5 transition-colors`}
            >
              <div className="text-white">{feature.name}</div>
              <div className="flex justify-center">
                {feature.others ? (
                  <Check className="w-5 h-5 text-gray-500" />
                ) : (
                  <X className="w-5 h-5 text-gray-700" />
                )}
              </div>
              <div className="flex justify-center">
                <Check className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <p className="text-center text-[#D4AF37] mt-12 text-lg drop-shadow-md">
          Tu Tribu de Traders de Élite.
        </p>
      </div>
    </section>
  );
}

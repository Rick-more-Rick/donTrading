import { Send, UserCheck, Lock } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Send,
    title: 'Solicita Acceso',
    description: 'Completa tu solicitud. Evaluamos tu experiencia como trader y tu enfoque profesional.',
  },
  {
    number: '02',
    icon: UserCheck,
    title: 'Verificación',
    description: 'Revisamos tu perfil para mantener la calidad de la red. Solo traders serios.',
  },
  {
    number: '03',
    icon: Lock,
    title: 'Entra al Círculo',
    description: 'Una vez aprobado, accede a la red privada y comienza a conectar con la élite.',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">Cómo Funciona</h2>
          <p className="text-xl text-[#D4AF37] drop-shadow-md">Tres pasos para entrar al círculo</p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative glass rounded-3xl p-8 text-center card-hover backdrop-blur-md opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.2}s`, animationFillMode: 'forwards' }}
            >
              {/* Step number */}
              <div className="absolute -top-4 left-8 text-6xl font-bold text-[#D4AF37]/20">
                {step.number}
              </div>

              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37]/30 to-[#00D4FF]/30 flex items-center justify-center mx-auto mb-6 border border-[#D4AF37]/30">
                <step.icon className="w-8 h-8 text-[#D4AF37]" />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-semibold text-white mb-4">{step.title}</h3>
              <p className="text-gray-300 leading-relaxed">{step.description}</p>

              {/* Connector line (hidden on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-[#D4AF37]/50 to-transparent" />
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <button className="bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-semibold px-8 py-4 rounded-full text-lg transition-all hover:scale-105">
            Solicita tu Acceso Privado
          </button>
        </div>
      </div>
    </section>
  );
}

import { BookOpen, MessageCircle, Twitter } from 'lucide-react';

const socialLinks = [
  { name: 'Telegram', icon: MessageCircle, href: '#' },
  { name: 'Discord', icon: MessageCircle, href: '#' },
  { name: 'X', icon: Twitter, href: '#' },
];

export default function ResourcesSection() {
  return (
    <section id="docs" className="relative py-24">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">Recursos</h2>
          <p className="text-xl text-[#00D4FF] drop-shadow-md">Aprende & Conecta</p>
        </div>

        {/* Resources grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Docs card */}
          <a
            href="#"
            className="glass rounded-2xl p-8 card-hover group border border-[#D4AF37]/20 backdrop-blur-md"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/30 to-[#00D4FF]/30 flex items-center justify-center mb-6 border border-[#D4AF37]/30">
              <BookOpen className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">
              Guía de Acceso
            </h3>
            <p className="text-gray-300">Todo lo que necesitas saber para unirte a DT Trading</p>
          </a>

          {/* Community card */}
          <div className="glass rounded-2xl p-8 border border-[#00D4FF]/20 backdrop-blur-md">
            <h3 className="text-xl font-semibold text-white mb-6">Síguenos</h3>
            <div className="flex gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all backdrop-blur-sm"
                  title={link.name}
                >
                  <link.icon className="w-5 h-5 text-[#D4AF37]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

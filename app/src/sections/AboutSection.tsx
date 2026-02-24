export default function AboutSection() {
  return (
    <section id="about" className="relative py-24">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">Nosotros</h2>
        </div>

        {/* Main content */}
        <div className="glass rounded-3xl p-8 sm:p-12 border border-[#D4AF37]/20 backdrop-blur-md mb-16">
          <p className="text-2xl sm:text-3xl font-semibold text-[#D4AF37] mb-8 drop-shadow-md text-center">
            El mercado no es injusto; simplemente no juegas con las mismas reglas que ellos.
          </p>
          
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p>
              Durante años, el trader retail ha sido alimentado con migajas: indicadores que llegan tarde, 
              sin acceso a noticias y análisis verdaderamente relevantes, ruido tóxico en redes sociales 
              y la sensación constante de ser la "liquidez" de los gigantes. Sabemos lo que se siente 
              operar a oscuras, viendo cómo tus stop loss son cazados mientras la información real fluye 
              en despachos cerrados.
            </p>
            
            <p>
              <span className="text-[#D4AF37] font-semibold">DT Trading Inteligente</span> nació de esa 
              misma frustración. Tras <span className="text-[#00D4FF] font-semibold">25 años</span> en el 
              corazón del mundo institucional, nuestro fundador decidió que el secretismo debía terminar. 
              No somos una red social más para buscar validación o seguir el hype del momento. Somos una 
              trinchera privada diseñada para operadores que se cansaron de los filtros y las distracciones.
            </p>
            
            <p>
              Aquí no encontrarás gurús, sino <span className="text-[#D4AF37]">maestría</span>. 
              No verás censura, sino <span className="text-[#00D4FF]">análisis crudo</span>. 
              Te ofrecemos el acceso a la información de grado institucional que antes era inalcanzable 
              para ti, respaldado por la experiencia de quien estuvo "al otro lado" y hoy elige pelear 
              en tu equipo.
            </p>
            
            <p>
              Buscamos a los pocos que están listos para dejar de ser retail y empezar a pensar como la élite.
            </p>
            
            <p className="text-xl text-[#D4AF37] font-semibold text-center pt-4">
              Es hora de equilibrar la balanza. Bienvenido al búnker del trading profesional.
            </p>
          </div>
        </div>

        {/* Mission */}
        <div className="text-center">
          <p className="text-[#D4AF37] text-sm uppercase tracking-wider mb-4">Nuestra Misión</p>
          <p className="text-3xl sm:text-4xl font-bold gradient-text drop-shadow-lg">
            "No Operes Solo"
          </p>
        </div>
      </div>
    </section>
  );
}

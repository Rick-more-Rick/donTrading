export default function PoweredBySection() {
  const partners = [
    { name: 'Nasdaq', logo: '/logos/nasdaq.png' },
    { name: 'NYSE', logo: '/logos/nyse.png' },
    { name: 'Benzinga', logo: '/logos/benzinga.png' },
    { name: 'Claude', logo: '/logos/claude.png' },
    { name: 'Gemini', logo: '/logos/gemini.png' },
    { name: 'FMP', logo: '/logos/fmp.png' },
    { name: 'MetaApi', logo: '/logos/metaapi.png' },
    { name: 'VitaWallet', logo: '/logos/vitawallet.png' },
  ];

  return (
    <section className="relative py-12 border-y border-white/10">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-gray-500 text-sm uppercase tracking-wider mb-8">
          Powered by
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity duration-300"
            >
              <img 
                src={partner.logo} 
                alt={partner.name}
                className="h-12 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

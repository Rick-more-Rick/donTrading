import { useState, useRef } from 'react';
import { Copy, Check, ArrowLeft, Wallet, CreditCard, Sparkles, Crown, Loader2, X, Image as ImageIcon, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const countryCodes = [
  { code: '+1', country: 'USA/Canadá' },
  { code: '+52', country: 'México' },
  { code: '+34', country: 'España' },
  { code: '+54', country: 'Argentina' },
  { code: '+55', country: 'Brasil' },
  { code: '+56', country: 'Chile' },
  { code: '+57', country: 'Colombia' },
  { code: '+58', country: 'Venezuela' },
  { code: '+593', country: 'Ecuador' },
  { code: '+51', country: 'Perú' },
  { code: '+598', country: 'Uruguay' },
  { code: '+591', country: 'Bolivia' },
  { code: '+506', country: 'Costa Rica' },
  { code: '+507', country: 'Panamá' },
  { code: '+502', country: 'Guatemala' },
  { code: '+503', country: 'El Salvador' },
];

const walletAddress = '0x55Af9dfea5cbe1525C162B4dBd7B1bd6d58990F8';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export default function VIPFormPage() {
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'100' | '300' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    countryCode: '+52',
    telefono: '',
    walletAddress: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success('Dirección copiada al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar la dirección');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Solo se permiten imágenes (JPG, PNG, WebP)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'El archivo no debe superar los 5MB';
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    toast.success('Comprobante cargado correctamente');
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const uploadImage = async (file: File, applicationId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${applicationId}_${Date.now()}.${fileExt}`;
    const filePath = `transactions/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('vip-receipts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      toast.error('Error al subir el comprobante');
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('vip-receipts')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombres.trim()) newErrors.nombres = 'Campo requerido';
    if (!formData.apellidoPaterno.trim()) newErrors.apellidoPaterno = 'Campo requerido';
    if (!formData.apellidoMaterno.trim()) newErrors.apellidoMaterno = 'Campo requerido';
    if (!formData.email.trim()) {
      newErrors.email = 'Campo requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    if (!formData.telefono.trim()) newErrors.telefono = 'Campo requerido';
    if (!formData.walletAddress.trim()) {
      newErrors.walletAddress = 'Campo requerido';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress.trim())) {
      newErrors.walletAddress = 'Dirección de wallet inválida';
    }
    if (!selectedPlan) newErrors.plan = 'Selecciona un plan';
    if (!uploadedFile) newErrors.receipt = 'Debes subir el comprobante de pago';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      // First, insert the application data
      const { data: applicationData, error: insertError } = await supabase
        .from('vip_applications')
        .insert({
          nombres: formData.nombres.trim(),
          apellido_paterno: formData.apellidoPaterno.trim(),
          apellido_materno: formData.apellidoMaterno.trim(),
          email: formData.email.trim().toLowerCase(),
          country_code: formData.countryCode,
          telefono: formData.telefono.trim(),
          wallet_address: formData.walletAddress.trim(),
          plan_selected: selectedPlan,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error de Supabase:', insertError);
        if (insertError.code === '23505') {
          toast.error('Este email ya está registrado. Por favor usa otro email.');
        } else {
          toast.error('Error al enviar la solicitud. Inténtalo de nuevo.');
        }
        return;
      }

      // Upload the image
      if (uploadedFile && applicationData) {
        const imageUrl = await uploadImage(uploadedFile, applicationData.id);
        
        if (imageUrl) {
          // Update the application with the image URL
          const { error: updateError } = await supabase
            .from('vip_applications')
            .update({ transaction_receipt_url: imageUrl })
            .eq('id', applicationData.id);

          if (updateError) {
            console.error('Error updating image URL:', updateError);
          }
        }
      }

      toast.success('¡Solicitud enviada correctamente! Revisa tu email para los siguientes pasos.');
      
      // Reset form
      setFormData({
        nombres: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        email: '',
        countryCode: '+52',
        telefono: '',
        walletAddress: '',
      });
      setSelectedPlan(null);
      handleRemoveFile();
      
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error inesperado. Por favor intenta más tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <a 
          href="/" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-[#D4AF37] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al inicio</span>
        </a>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 backdrop-blur-sm mb-6">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-[#D4AF37] text-sm font-medium tracking-wide">ACCESO TEMPRANO VIP</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Solicita tu <span className="gradient-text">Acceso Exclusivo</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Completa el formulario y realiza el pago para unirte a la red social privada más exclusiva para traders.
          </p>
        </div>

        {/* Wallet Address Card */}
        <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#00D4FF]/20 border border-[#D4AF37]/50 rounded-2xl p-6 mb-8 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6 text-[#D4AF37]" />
            <h3 className="text-lg font-semibold text-white">Dirección de Pago USDT (ERC20)</h3>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <code className="flex-1 bg-black/50 border border-[#D4AF37]/30 rounded-lg px-4 py-3 text-[#00D4FF] font-mono text-sm break-all">
              {walletAddress}
            </code>
            <Button
              onClick={handleCopy}
              disabled={copied}
              className={`shrink-0 px-6 ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-[#D4AF37] hover:bg-[#D4AF37]/90'} text-black font-semibold`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <p className="text-gray-400 text-sm mt-3">
            Envía únicamente USDT en red ERC20. Cualquier otro token o red resultará en la pérdida de fondos.
          </p>
        </div>

        {/* Payment Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Plan 100 USDT */}
          <div
            onClick={() => !isSubmitting && setSelectedPlan('100')}
            className={`relative cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 ${
              selectedPlan === '100'
                ? 'border-[#00ff66] bg-[#00ff66]/10'
                : 'border-white/10 bg-white/5 hover:border-white/30'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''} ${errors.plan ? 'border-red-500' : ''}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#00ff66]/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[#00ff66]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">100 USDT</h3>
                  <p className="text-gray-400 text-sm">Plan Early Access</p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === '100' ? 'border-[#00ff66] bg-[#00ff66]' : 'border-gray-500'
              }`}>
                {selectedPlan === '100' && <Check className="w-4 h-4 text-black" />}
              </div>
            </div>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#00ff66] shrink-0 mt-0.5" />
                <span>Acceso temprano a la plataforma</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#00ff66] shrink-0 mt-0.5" />
                <span>12 meses de membresía mensual bloqueada</span>
              </li>
            </ul>
          </div>

          {/* Plan 300 USDT */}
          <div
            onClick={() => !isSubmitting && setSelectedPlan('300')}
            className={`relative cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 ${
              selectedPlan === '300'
                ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                : 'border-white/10 bg-white/5 hover:border-white/30'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''} ${errors.plan ? 'border-red-500' : ''}`}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#D4AF37] text-black text-xs font-bold rounded-full">
              RECOMENDADO
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">300 USDT</h3>
                  <p className="text-gray-400 text-sm">Plan Fundador</p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedPlan === '300' ? 'border-[#D4AF37] bg-[#D4AF37]' : 'border-gray-500'
              }`}>
                {selectedPlan === '300' && <Check className="w-4 h-4 text-black" />}
              </div>
            </div>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>Acceso temprano a la plataforma</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>Membresía mensual de por vida a 100 USDT</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>Distintivo de Miembro Fundador</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>20% de descuento en temas educativos por 12 meses</span>
              </li>
            </ul>
          </div>
        </div>
        {errors.plan && <p className="text-red-500 text-sm -mt-8 mb-8 text-center">{errors.plan}</p>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#00D4FF]/20 flex items-center justify-center text-[#00D4FF] text-sm">1</span>
            Información Personal
          </h2>

          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <Label htmlFor="nombres" className="text-gray-300">Nombres *</Label>
              <Input
                id="nombres"
                name="nombres"
                value={formData.nombres}
                onChange={handleInputChange}
                placeholder="Ingresa tus nombres"
                className={`bg-black/30 border-white/20 text-white placeholder:text-gray-500 focus:border-[#D4AF37] ${errors.nombres ? 'border-red-500' : ''}`}
                required
                disabled={isSubmitting}
              />
              {errors.nombres && <p className="text-red-500 text-xs">{errors.nombres}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidoPaterno" className="text-gray-300">Apellido Paterno *</Label>
              <Input
                id="apellidoPaterno"
                name="apellidoPaterno"
                value={formData.apellidoPaterno}
                onChange={handleInputChange}
                placeholder="Ingresa tu apellido paterno"
                className={`bg-black/30 border-white/20 text-white placeholder:text-gray-500 focus:border-[#D4AF37] ${errors.apellidoPaterno ? 'border-red-500' : ''}`}
                required
                disabled={isSubmitting}
              />
              {errors.apellidoPaterno && <p className="text-red-500 text-xs">{errors.apellidoPaterno}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <Label htmlFor="apellidoMaterno" className="text-gray-300">Apellido Materno *</Label>
              <Input
                id="apellidoMaterno"
                name="apellidoMaterno"
                value={formData.apellidoMaterno}
                onChange={handleInputChange}
                placeholder="Ingresa tu apellido materno"
                className={`bg-black/30 border-white/20 text-white placeholder:text-gray-500 focus:border-[#D4AF37] ${errors.apellidoMaterno ? 'border-red-500' : ''}`}
                required
                disabled={isSubmitting}
              />
              {errors.apellidoMaterno && <p className="text-red-500 text-xs">{errors.apellidoMaterno}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Correo Electrónico *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="tu@email.com"
                className={`bg-black/30 border-white/20 text-white placeholder:text-gray-500 focus:border-[#D4AF37] ${errors.email ? 'border-red-500' : ''}`}
                required
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <Label htmlFor="telefono" className="text-gray-300">Teléfono *</Label>
              <div className="flex gap-2">
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="bg-black/30 border border-white/20 text-white rounded-md px-3 py-2 text-sm focus:border-[#D4AF37] focus:outline-none disabled:opacity-50"
                >
                  {countryCodes.map((cc) => (
                    <option key={cc.code} value={cc.code} className="bg-black">
                      {cc.code}
                    </option>
                  ))}
                </select>
                <Input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  placeholder="123 456 7890"
                  className={`flex-1 bg-black/30 border-white/20 text-white placeholder:text-gray-500 focus:border-[#D4AF37] ${errors.telefono ? 'border-red-500' : ''}`}
                  required
                  disabled={isSubmitting}
                />
              </div>
              {errors.telefono && <p className="text-red-500 text-xs">{errors.telefono}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="walletAddress" className="text-gray-300">Dirección de Wallet (desde donde envías) *</Label>
              <Input
                id="walletAddress"
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleInputChange}
                placeholder="0x..."
                className={`bg-black/30 border-white/20 text-white placeholder:text-gray-500 focus:border-[#D4AF37] ${errors.walletAddress ? 'border-red-500' : ''}`}
                required
                disabled={isSubmitting}
              />
              {errors.walletAddress && <p className="text-red-500 text-xs">{errors.walletAddress}</p>}
            </div>
          </div>

          {/* File Upload Section */}
          <div className="border-t border-white/10 pt-8 mb-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-sm">2</span>
              Comprobante de Pago *
            </h2>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!uploadedFile ? (
              <div className={`grid sm:grid-cols-2 gap-4 ${errors.receipt ? 'border border-red-500 rounded-2xl p-4' : ''}`}>
                {/* Upload from files */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-white/30 bg-white/5 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all disabled:opacity-50"
                >
                  <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-[#D4AF37]" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Subir desde archivos</p>
                    <p className="text-gray-400 text-sm">JPG, PNG, WebP (max 5MB)</p>
                  </div>
                </button>

                {/* Take photo */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-white/30 bg-white/5 hover:border-[#00D4FF] hover:bg-[#00D4FF]/5 transition-all disabled:opacity-50"
                >
                  <div className="w-16 h-16 rounded-full bg-[#00D4FF]/20 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-[#00D4FF]" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Tomar foto</p>
                    <p className="text-gray-400 text-sm">Usa la cámara de tu dispositivo</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-[#D4AF37]/30">
                <img
                  src={previewUrl!}
                  alt="Comprobante de pago"
                  className="w-full max-h-80 object-contain bg-black/50"
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isSubmitting}
                    className="w-10 h-10 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-white font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00ff66]" />
                    {uploadedFile.name}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
            {errors.receipt && <p className="text-red-500 text-sm mt-2">{errors.receipt}</p>}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#00ff66] hover:bg-[#00ff66]/90 text-black font-bold py-6 text-lg rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando solicitud...
              </>
            ) : (
              'Enviar Solicitud de Acceso VIP'
            )}
          </Button>

          <p className="text-center text-gray-500 text-sm mt-4">
            Al enviar, aceptas los términos y condiciones de DT Trading Inteligente.
          </p>
        </form>
      </div>
    </div>
  );
}

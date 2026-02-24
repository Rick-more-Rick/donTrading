-- =====================================================
-- SQL para configurar Supabase - DT Trading Inteligente
-- Ejecuta este código en el SQL Editor de Supabase
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA DE APLICACIONES VIP
-- =====================================================

-- Crear la tabla vip_applications
CREATE TABLE IF NOT EXISTS vip_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    country_code VARCHAR(10) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    plan_selected VARCHAR(10) NOT NULL CHECK (plan_selected IN ('100', '300')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    transaction_receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_vip_applications_email ON vip_applications(email);

-- Crear índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_vip_applications_status ON vip_applications(status);

-- Crear índice para ordenar por fecha
CREATE INDEX IF NOT EXISTS idx_vip_applications_created_at ON vip_applications(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE vip_applications ENABLE ROW LEVEL SECURITY;

-- Política: Permitir inserts anónimos (para el formulario)
CREATE POLICY "Allow anonymous inserts" ON vip_applications
    FOR INSERT TO anon
    WITH CHECK (true);

-- Política: Solo usuarios autenticados pueden leer
CREATE POLICY "Allow authenticated read" ON vip_applications
    FOR SELECT TO authenticated
    USING (true);

-- Política: Solo usuarios autenticados pueden actualizar
CREATE POLICY "Allow authenticated update" ON vip_applications
    FOR UPDATE TO authenticated
    USING (true);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vip_applications_updated_at
    BEFORE UPDATE ON vip_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. CREAR BUCKET DE STORAGE PARA COMPROBANTES
-- =====================================================

-- Insertar el bucket (esto se hace normalmente desde la UI, pero aquí está el SQL equivalente)
-- Nota: Los buckets deben crearse desde Storage > New bucket en la UI de Supabase
-- o usando la API de administración

-- Políticas para el bucket 'vip-receipts'
-- Estas se configuran en Storage > Policies después de crear el bucket

/*
INSTRUCCIONES PARA CREAR EL BUCKET:

1. Ve a tu proyecto Supabase → Storage
2. Click en "New bucket"
3. Nombre: vip-receipts
4. Marca "Public bucket" como SÍ (para que las imágenes sean accesibles)
5. Click en "Create bucket"

LUEGO configura estas políticas en Storage → vip-receipts → Policies:

Política 1 - Allow anonymous uploads:
- Name: Allow anonymous uploads
- Allowed operation: INSERT
- Target roles: anon
- Policy definition: true

Política 2 - Allow public read:
- Name: Allow public read
- Allowed operation: SELECT
- Target roles: anon, authenticated
- Policy definition: true

Política 3 - Allow authenticated delete (opcional):
- Name: Allow authenticated delete
- Allowed operation: DELETE
- Target roles: authenticated
- Policy definition: true
*/

-- =====================================================
-- 3. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE vip_applications IS 'Tabla para almacenar solicitudes de acceso VIP de DT Trading Inteligente';
COMMENT ON COLUMN vip_applications.nombres IS 'Nombres del solicitante';
COMMENT ON COLUMN vip_applications.apellido_paterno IS 'Apellido paterno del solicitante';
COMMENT ON COLUMN vip_applications.apellido_materno IS 'Apellido materno del solicitante';
COMMENT ON COLUMN vip_applications.email IS 'Correo electrónico único del solicitante';
COMMENT ON COLUMN vip_applications.country_code IS 'Código de país del teléfono (ej: +52)';
COMMENT ON COLUMN vip_applications.telefono IS 'Número de teléfono del solicitante';
COMMENT ON COLUMN vip_applications.wallet_address IS 'Dirección de wallet desde donde se enviará el pago';
COMMENT ON COLUMN vip_applications.plan_selected IS 'Plan seleccionado: 100 o 300 USDT';
COMMENT ON COLUMN vip_applications.status IS 'Estado de la solicitud: pending, verified, rejected';
COMMENT ON COLUMN vip_applications.transaction_receipt_url IS 'URL pública de la imagen del comprobante de pago';

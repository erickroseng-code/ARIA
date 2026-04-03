export default function PreviewCarousel() {
  const previews = [
    { label: '🌑 Dark', src: '/carousel-dark-preview.jpg', filename: 'carousel-dark-preview.jpg' },
    { label: '☀️ Light', src: '/carousel-light-preview.jpg', filename: 'carousel-light-preview.jpg' },
  ];

  return (
    <main style={{ background: '#09090A', minHeight: '100vh', padding: '40px 24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 32 }}>
        Prévia dos Temas de Carrossel
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        {previews.map(({ label, src, filename }) => (
          <div key={filename}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 }}>{label}</p>
              <a
                href={src}
                download={filename}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                ⬇ Baixar
              </a>
            </div>
            <img
              src={src}
              alt={`${label} theme preview`}
              style={{ width: '100%', maxWidth: 900, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="relative mx-auto max-w-2xl px-6 py-24 text-zinc-300">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-white">
        Política de privacidad
      </h1>
      <p className="mt-6 text-sm leading-relaxed">
        Escuela Nómada Digital trata los datos que nos facilitas (nombre y email) con la única
        finalidad de gestionar tu inscripción a este lanzamiento y, si nos has dado tu consentimiento,
        enviarte comunicaciones comerciales relacionadas por email. Puedes darte de baja en cualquier
        momento desde el enlace incluido en cada email o escribiéndonos a{" "}
        <a href="mailto:hola@escuelanomadadigital.com" className="text-[var(--color-red-bright)] hover:underline">
          hola@escuelanomadadigital.com
        </a>
        .
      </p>
      <p className="mt-4 text-sm leading-relaxed">
        Tus datos se almacenan en nuestra propia infraestructura y en ActiveCampaign, nuestro
        proveedor de email marketing, y no se ceden a terceros ajenos a la prestación de este servicio.
      </p>
    </main>
  );
}

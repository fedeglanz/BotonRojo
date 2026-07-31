import { SubmitButton } from "@/components/admin/submit-button";

type Launch = { slug: string; name: string };

type Props = {
  launches: Launch[];
  action: (formData: FormData) => Promise<void>;
};

export function LinkGenerator({ launches, action }: Props) {
  return (
    <form action={action} className="glass space-y-4 p-5">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">Nuevo enlace</h3>

      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Lanzamiento</span>
        <select
          name="launchSlug"
          required
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
        >
          <option value="">— elige uno —</option>
          {launches.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="UTM source (opcional)" name="utmSource" placeholder="instagram" />
        <Field label="UTM medium" name="utmMedium" placeholder="bio" />
        <Field label="UTM campaign" name="utmCampaign" placeholder="lanzamiento-q1" />
        <Field label="UTM content" name="utmContent" placeholder="stories-dia-1" />
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Generando…">Generar enlace</SubmitButton>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <input
        {...rest}
        type="text"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
      />
    </label>
  );
}

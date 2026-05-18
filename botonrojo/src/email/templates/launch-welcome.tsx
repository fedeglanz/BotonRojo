import { Html, Head, Preview, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";

type Props = {
  name?: string;
  launchName: string;
  promise: string;
  ctaUrl: string;
};

export default function LaunchWelcomeEmail({ name, launchName, promise, ctaUrl }: Props) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{promise}</Preview>
      <Body style={{ backgroundColor: "#050505", color: "#f4f4f5", fontFamily: "Inter, system-ui, sans-serif" }}>
        <Container style={{ padding: "40px 24px", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#ef2b3d" }} />
            <Text style={{ margin: 0, fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#a1a1aa" }}>
              Botón Rojo
            </Text>
          </div>

          <Heading style={{ marginTop: 24, fontSize: 32, lineHeight: 1.1 }}>
            Hola{name ? `, ${name}` : ""}.
          </Heading>

          <Text style={{ marginTop: 16, fontSize: 18, color: "#d4d4d8" }}>
            Te acabas de unir a <strong>{launchName}</strong>.
          </Text>

          <Text style={{ marginTop: 12, fontSize: 16, color: "#a1a1aa" }}>{promise}</Text>

          <Button
            href={ctaUrl}
            style={{
              marginTop: 32,
              display: "inline-block",
              background: "linear-gradient(180deg, #ff3849, #d4172a)",
              color: "#fff",
              padding: "14px 28px",
              borderRadius: 999,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: 1,
            }}
          >
            Empezar →
          </Button>

          <Hr style={{ borderColor: "#27272a", marginTop: 40 }} />
          <Text style={{ fontSize: 12, color: "#71717a" }}>Escuela Nómada Digital</Text>
        </Container>
      </Body>
    </Html>
  );
}

import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

const c = { neem: "#173f30", moss: "#4e6b57", paper: "#fce7b2", deep: "#f3d488", haldi: "#f2b33d", saffron: "#e8622a" };

export type MessageEmailProps = { name: string; text: string; url: string };

/** "A message from your organizer", sent only when the organizer picks email (or both) for a message. */
export function MessageEmail({ name, text, url }: MessageEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{text.slice(0, 90)}</Preview>
      <Body style={{ backgroundColor: c.paper, margin: 0, padding: "24px 12px", fontFamily: "Helvetica, Arial, sans-serif", color: c.neem }}>
        <Container style={{ maxWidth: 480, margin: "0 auto" }}>
          <Section style={{ backgroundColor: c.neem, borderRadius: "24px 24px 0 0", padding: "20px 28px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 26, fontWeight: 700, color: c.haldi }}>taskora</Text>
          </Section>
          <Section style={{ backgroundColor: c.deep, borderRadius: "0 0 24px 24px", padding: "28px" }}>
            <Heading as="h1" style={{ margin: "0 0 10px", fontSize: 24, color: c.neem }}>
              Hi {name.split(" ")[0]}, a message from your organizer
            </Heading>
            <Section style={{ backgroundColor: c.paper, borderRadius: 16, padding: "16px 18px", margin: "0 0 20px" }}>
              <Text style={{ margin: 0, fontSize: 17, lineHeight: "24px", whiteSpace: "pre-wrap" }}>{text}</Text>
            </Section>
            <Section style={{ textAlign: "center", margin: "0 0 18px" }}>
              <Button
                href={url}
                style={{ backgroundColor: c.saffron, color: c.neem, fontWeight: 700, fontSize: 17, padding: "14px 30px", borderRadius: 999, textDecoration: "none", border: `2px solid ${c.neem}` }}
              >
                Open my workspace
              </Button>
            </Section>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: c.moss }}>
              If the button asks you to sign in, use &quot;Intern sign in&quot; with this email address.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

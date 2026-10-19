import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

const c = { neem: "#173f30", moss: "#4e6b57", paper: "#fce7b2", deep: "#f3d488", haldi: "#f2b33d", saffron: "#e8622a" };

/** Plain sign-in link for an intern who has already joined. */
export function LoginEmail({ name, url }: { name: string; url: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Taskora sign-in link</Preview>
      <Body style={{ backgroundColor: c.paper, margin: 0, padding: "24px 12px", fontFamily: "Helvetica, Arial, sans-serif", color: c.neem }}>
        <Container style={{ maxWidth: 480, margin: "0 auto" }}>
          <Section style={{ backgroundColor: c.neem, borderRadius: "24px 24px 0 0", padding: "20px 28px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 26, fontWeight: 700, color: c.haldi }}>taskora</Text>
          </Section>
          <Section style={{ backgroundColor: c.deep, borderRadius: "0 0 24px 24px", padding: "28px" }}>
            <Heading as="h1" style={{ margin: "0 0 10px", fontSize: 24, color: c.neem }}>
              Hi {name.split(" ")[0]}, here is your link
            </Heading>
            <Text style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "24px" }}>Tap the button to sign in to your Taskora workspace. The link works once.</Text>
            <Section style={{ textAlign: "center", margin: "0 0 18px" }}>
              <Button
                href={url}
                style={{ backgroundColor: c.saffron, color: c.neem, fontWeight: 700, fontSize: 17, padding: "14px 30px", borderRadius: 999, textDecoration: "none", border: `2px solid ${c.neem}` }}
              >
                Sign in to Taskora
              </Button>
            </Section>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: c.moss }}>
              Didn&apos;t ask for this? You can ignore the email.
              <br />
              <span style={{ wordBreak: "break-all" }}>{url}</span>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

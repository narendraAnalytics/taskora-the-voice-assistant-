import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type InviteEmailProps = {
  internName: string;
  organizerName: string;
  acceptUrl: string;
  position?: string | null;
  college?: string | null;
  duration?: string | null;
  startDate?: string | null;
  language?: string | null;
};

// Palette: neem green, haldi, saffron, paper. No white, black or blue.
const c = { neem: "#173f30", moss: "#4e6b57", paper: "#fce7b2", deep: "#f3d488", haldi: "#f2b33d", saffron: "#e8622a", tulsi: "#7dbe8f" };

export function InviteEmail({ internName, organizerName, acceptUrl, position, college, duration, startDate, language }: InviteEmailProps) {
  const first = internName.split(" ")[0];
  const rows = [
    position && ["Position", position],
    college && ["College", college],
    duration && ["Duration", duration],
    startDate && ["Starts", startDate],
    language && ["Standups in", language],
  ].filter(Boolean) as [string, string][];

  return (
    <Html lang="en">
      <Head />
      <Preview>{organizerName} added you to their intern batch on Taskora. Set up your account.</Preview>
      <Body style={{ backgroundColor: c.paper, margin: 0, padding: "24px 12px", fontFamily: "Helvetica, Arial, sans-serif", color: c.neem }}>
        <Container style={{ maxWidth: 520, margin: "0 auto" }}>
          <Section style={{ backgroundColor: c.neem, borderRadius: "24px 24px 0 0", padding: "22px 28px", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 28, fontWeight: 700, color: c.haldi, letterSpacing: 0.5 }}>taskora</Text>
            <Text style={{ margin: "2px 0 0", fontSize: 13, color: "#c9d8b8" }}>Your team&apos;s voice coordinator</Text>
          </Section>

          <Section style={{ backgroundColor: c.deep, borderRadius: "0 0 24px 24px", padding: "28px" }}>
            <Heading as="h1" style={{ margin: "0 0 10px", fontSize: 26, lineHeight: "32px", color: c.neem }}>
              Welcome, {first}!
            </Heading>
            <Text style={{ margin: "0 0 18px", fontSize: 16, lineHeight: "24px" }}>
              <strong>{organizerName}</strong> has added you to their intern batch on Taskora. Give a 20-second voice update each day, in the
              language you like, and Taskora keeps the board current for you.
            </Text>

            {rows.length > 0 && (
              <Section style={{ backgroundColor: c.paper, borderRadius: 16, padding: "14px 18px", margin: "0 0 22px" }}>
                {rows.map(([k, v]) => (
                  <Text key={k} style={{ margin: "4px 0", fontSize: 15, lineHeight: "22px" }}>
                    <span style={{ color: c.moss }}>{k}: </span>
                    <strong>{v}</strong>
                  </Text>
                ))}
              </Section>
            )}

            <Section style={{ textAlign: "center", margin: "0 0 18px" }}>
              <Button
                href={acceptUrl}
                style={{ backgroundColor: c.saffron, color: c.neem, fontWeight: 700, fontSize: 17, padding: "14px 30px", borderRadius: 999, textDecoration: "none", border: `2px solid ${c.neem}` }}
              >
                Set up my account
              </Button>
            </Section>

            <Text style={{ margin: 0, fontSize: 14, lineHeight: "21px", color: c.moss }}>
              You will choose your own password, or sign in with Google. Nobody else ever sees it.
            </Text>
            <Hr style={{ borderColor: c.neem, opacity: 0.2, margin: "18px 0" }} />
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: c.moss }}>
              Button not working? Paste this link into your browser:
              <br />
              <span style={{ wordBreak: "break-all" }}>{acceptUrl}</span>
            </Text>
          </Section>

          <Text style={{ textAlign: "center", fontSize: 12, color: c.moss, margin: "14px 0 0" }}>
            Didn&apos;t expect this? You can ignore the email and nothing will happen.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

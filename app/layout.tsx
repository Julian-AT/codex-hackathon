export const metadata = {
  title: 'Offline Specialist-LLM Pipeline',
  description: 'Airplane-mode fine-tuned Gemma on iPhone — hackathon demo.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

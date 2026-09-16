import './globals.css';

export const metadata = {
  title: 'NextMove',
  description: 'Scans jobs, scores fit against your own profile, tailors CVs, and drafts hidden-market outreach — you approve everything before applying or sending.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

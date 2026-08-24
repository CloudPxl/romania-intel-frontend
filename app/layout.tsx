import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata = {
  title: "RO-INTEL Desk — B2B Commercial Intelligence",
  description: "Institutional Opportunity Stream & Market Analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className="dark">
      <body className="bg-[#090d16] text-zinc-100 antialiased font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

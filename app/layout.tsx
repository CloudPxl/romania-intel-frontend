import { Roboto } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata = {
  title: "RO-INTEL Desk — B2B Commercial Intelligence",
  description: "Institutional Opportunity Stream & Market Analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={roboto.variable}>
      <body className="bg-white text-[#111] antialiased" style={{ fontFamily: "var(--font-roboto), Roboto, sans-serif" }}>
        <AuthProvider>
          <div className="min-h-screen bg-white text-[#111] flex flex-col">
            <NavBar />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

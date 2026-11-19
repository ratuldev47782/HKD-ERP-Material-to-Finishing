import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import DarkModeProvider from "./provider/DarkModeProvider";
import { AuthProvider } from "@/app/provider/AuthProvider";
import { SidebarProvider } from "./provider/SidebarContext";
import AppChrome from "./provider/AppChrome";

const plex = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "HKD Outdoor Innovations",
  description: "HKD Outdoor Innovations Ltd. is a leading provider of outdoor solutions...",
  icons: { icon: "/HKD_LOGO.png" },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${plex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <DarkModeProvider>
            <SidebarProvider>
              <AppChrome>{children}</AppChrome>
            </SidebarProvider>
          </DarkModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
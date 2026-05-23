import { WelcomeCarousel } from "./_components/welcome-carousel";

export const metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return <WelcomeCarousel />;
}

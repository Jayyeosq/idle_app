import Dial from "@/components/Dial";
import OnboardingForm from "@/components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <Dial size={56} />
      <h1 className="font-display text-3xl mt-5 tracking-tight">Set your dial</h1>
      <p className="text-mist mt-2 mb-10 text-center max-w-md">
        This becomes the first entry in your profile — IDLE refines it every time you react to a
        recommendation.
      </p>
      <OnboardingForm />
    </main>
  );
}

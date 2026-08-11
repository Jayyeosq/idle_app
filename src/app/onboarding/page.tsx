import Dial from "@/components/Dial";
import OnboardingForm from "@/components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <div className="panel-plate rounded-2xl px-8 pt-8 pb-6 flex flex-col items-center mb-10">
        <Dial size={36} />
        <h1 className="font-display text-3xl mt-5 tracking-tight">Set your dial</h1>
        <p className="text-mist mt-2 text-center max-w-md">
          This becomes the first entry in your profile — IDLE refines it every time you react to a
          recommendation.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}

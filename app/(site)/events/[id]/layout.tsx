import { JourneyProvider } from "@/lib/state/JourneyProvider";
import { DevPanel } from "@/components/site/chrome";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <JourneyProvider eventId={decodeURIComponent(id)}>
      {children}
      <DevPanel />
    </JourneyProvider>
  );
}

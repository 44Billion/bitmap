import { useSeoMeta } from '@unhead/react';
import { EphemeralHeatMap } from '@/components/EphemeralHeatMap';

const Index = () => {
  useSeoMeta({
    title: 'Bitmap - Bitchat Heat Map',
    description: 'Real-time monitoring and visualization of ephemeral Nostr events with geospatial analysis.',
  });

  return (
    <div className="min-h-screen bg-black">
      <EphemeralHeatMap className="h-screen" />
    </div>
  );
};

export default Index;

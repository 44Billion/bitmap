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
      {/* Vibed with MKStack branding */}
      <div className="fixed bottom-4 right-4 z-50">
        <a
          href="https://soapbox.pub/mkstack"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-500/60 hover:text-green-400 text-xs font-mono transition-colors"
        >
          Vibed with MKStack
        </a>
      </div>
    </div>
  );
};

export default Index;

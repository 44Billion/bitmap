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
      {/* Footer */}
      <div className="absolute bottom-4 right-4 text-xs font-mono text-gray-500 z-10">
        <a
          href="https://nostrhub.io/naddr1qvzqqqrhnypzppscgyy746fhmrt0nq955z6xmf80pkvrat0yq0hpknqtd00z8z68qyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqqe3xjardv9cq5q8qjf"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bitmap
        </a>
        {' '} | Vibed with{' '}
        <a
          href="https://soapbox.pub/mkstack"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          MKStack
        </a>
        {' '} & {' '}
        <a
          href="https://shakespeare.diy"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Shakespeare
        </a>
      </div>
    </div>
  );
};

export default Index;

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import ClientOnlyWrapper from './ClientOnlyWrapper';

const Masonry = dynamic(() => import('react-masonry-css'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {/* Fallback loading */}
    </div>
  )
});


interface DynamicMasonryProps {
  breakpointCols: any;
  className: string;
  columnClassName: string;
  children: ReactNode;
}

export default function DynamicMasonry(props: DynamicMasonryProps) {
  return (
    <ClientOnlyWrapper
      fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {props.children}
        </div>
      }
    >
      <Masonry {...props} />
    </ClientOnlyWrapper>
  );
}

import type { Metadata } from 'next';

const baseMetadata = {
  applicationName: 'SeatFinderSRM',
  authors: [
    { name: 'Nidhi Nayana', url: 'https://github.com/nidhi-nayana' },
    { name: 'Tanish Poddar', url: 'https://github.com/tanishpoddar' },
    { name: 'Nishant Ranjan', url: 'https://github.com/nishant-codess' },
  ],
  keywords: [
    'SRM University',
    'library seat booking',
    'seat reservation',
    'SRMIST',
    'library management',
    'real-time booking',
    'QR code check-in',
    'student portal',
  ],
  creator: 'Department of Computing Technologies, SRMIST',
  publisher: 'SRM Institute of Science and Technology',
};

export function createMetadata(page: {
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  return {
    title: `${page.title} | SeatFinderSRM`,
    description: page.description,
    keywords: [...baseMetadata.keywords, ...(page.keywords || [])],
    authors: baseMetadata.authors,
    creator: baseMetadata.creator,
    publisher: baseMetadata.publisher,
    applicationName: baseMetadata.applicationName,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${page.title} | SeatFinderSRM`,
      description: page.description,
      type: 'website',
      siteName: 'SeatFinderSRM',
    },
  };
}
